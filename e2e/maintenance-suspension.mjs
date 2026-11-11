// Maintenance > Suspension (Suspension Detail): the Suspension Category and Suspension Details tabs. Reads the real categories and payors; every POST, PUT and DELETE that would change data is
// intercepted and answered here (the database writes are covered by the API's own rolled-back database tests), so nothing is written.
import { start, sleep, BASE } from './lib.mjs'
import { mint } from './mint.mjs'

const t = await start()
const { page, check } = t

const get = (path, token = mint()) => fetch(`${BASE}${path}`, { headers: { Authorization: `Bearer ${token}` } })
const json = async (path) => (await get(path)).json()
const dialogs = () => page.$$eval('[role=dialog]', (d) => d.map((x) => x.textContent.replace(/\s+/g, ' ').trim()))
const rowsOf = (caption) =>
  page.$$eval(`table[aria-label="${caption}"] tbody tr`, (trs) =>
    trs.map((tr) => [...tr.querySelectorAll('td')].map((td) => td.textContent.trim())).filter((r) => r.length > 1),
  )
const clickRow = (caption, index = 0) => page.evaluate((c, i) => document.querySelectorAll(`table[aria-label="${c}"] tbody tr`)[i]?.click(), caption, index)
const tab = async (name) => {
  await page.evaluate((n) => [...document.querySelectorAll('[role=tab]')].find((b) => b.textContent === n)?.click(), name)
  await sleep(300)
}
const disabled = async (label) => (await t.btn(label)).evaluate((b) => b.disabled)

const calls = []
let fakeDetails = false
await page.setRequestInterception(true)
page.on('request', (req) => {
  const url = new URL(req.url())
  if (!url.pathname.startsWith('/api/maintenance/suspension')) return req.continue()
  if (req.method() !== 'GET') {
    calls.push({ method: req.method(), path: url.pathname + url.search, body: req.postData() ? JSON.parse(req.postData()) : null })
    return req.respond({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ message: req.method() === 'DELETE' ? 'Record Deleted...' : req.method() === 'PUT' ? 'Record Updated...' : 'Record Saved...' }),
    })
  }
  if (fakeDetails && url.pathname.endsWith('/details')) {
    return req.respond({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify([
        { selection: '01', keyCode: 'XL0001*01', description: 'LATE PAYMENT', payorCode: 'XL', payorName: 'A PAYOR', payor: 'XL - A PAYOR' },
        { selection: '02', keyCode: 'AGENT7', description: 'LICENCE', payorCode: 'XL', payorName: 'A PAYOR', payor: 'XL - A PAYOR' },
      ]),
    })
  }
  return req.continue()
})

// ---------------- the API
const categories = await json('/api/maintenance/suspension/categories')
check(
  'api: the categories are 01 MEMBERSHIP and 02 AGENT',
  categories.length >= 2 && categories[0].code === '01' && categories[1].code === '02',
  JSON.stringify(categories),
)
check(
  'api: a search by code finds the one the code starts',
  (await json('/api/maintenance/suspension/categories?code=02%20x')).map((c) => c.code).join() === '02',
)
const post = (path, body, token = mint()) =>
  fetch(`${BASE}${path}`, { method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
check(
  'api: a category without a code is refused with the desktop message',
  (await (await post('/api/maintenance/suspension/categories', { description: 'x' })).json()).message === 'Please Enter Code',
)
check(
  'api: a suspension without a selection is refused with the desktop message',
  (await (await post('/api/maintenance/suspension/details', { key: 'x' })).json()).message === 'Please Enter Selection',
)
check(
  'api: a member number that does not start with the payor code is refused',
  (await (await post('/api/maintenance/suspension/details', { selection: '01', key: 'ZZ1', description: 'x', payor: 'XL - OTHER' })).json()).message ===
    'Payor Code Not Match',
)

const payors = await json('/api/worksheet/lookups/payors')
const unknownCode = ['QQ', 'QX', 'Q9'].find((c) => !payors.some((p) => p.code.toUpperCase() === c))

// ---------------- Suspension Category
await t.go('/maintenance/suspension')
check('screen: title', (await page.$eval('h2', (e) => e.textContent)) === 'Suspension Detail')
const side = await page.$$eval('.sidebar a', (els) => els.map((e) => e.textContent.trim()))
check('menu: Suspension is in the Maintenance menu', side.includes('Suspension'), side.join('|'))
check(
  'category: Edit, Delete and Save are off until something is chosen or added',
  (await disabled('Edit')) && (await disabled('Delete')) && (await disabled('Save')),
)
await t.click('Search', 800)
const catRows = await rowsOf('Suspension categories')
check(
  'category: Search lists the categories',
  catRows.length === categories.length && catRows[0][0] === '01' && catRows[0][1] === 'MEMBERSHIP',
  JSON.stringify(catRows),
)
check(
  'category: the counter shows the total',
  (await page.$$eval('.stat', (s) => s.map((x) => x.textContent))).some((x) => x.includes(String(categories.length))),
)
await clickRow('Suspension categories', 1)
await sleep(200)
check(
  'category: a chosen row fills the form and enables Edit and Delete',
  (await t.value('Suspension Code')) === '02' &&
    (await t.value('Suspension Description')) === 'AGENT' &&
    !(await disabled('Edit')) &&
    !(await disabled('Delete')),
)
await t.click('Delete', 600)
check(
  'category: Delete asks Do you want to delete this record?',
  (await dialogs()).some((d) => d.includes('Do you want to delete this record?')),
  JSON.stringify(await dialogs()),
)
await (await t.btn('No')).click()
await sleep(300)
check('category: No deletes nothing', calls.length === 0)
await t.click('Delete', 600)
await t.yes()
check(
  'category: Yes sends the delete and reports it',
  calls.at(-1)?.method === 'DELETE' && calls.at(-1).path.endsWith('/categories/02') && (await t.toast('Record Deleted...')),
  JSON.stringify(calls.at(-1)),
)

await t.click('Add', 400)
await t.click('Save', 400)
check('category: Save without a code says so', (await t.errors()).includes('Please Enter Code'), JSON.stringify(await t.errors()))
await t.type('Suspension Code', '03')
await t.click('Save', 400)
check('category: then without a description', (await t.errors()).includes('Please Enter Description'), JSON.stringify(await t.errors()))
await t.type('Suspension Description', 'blocked')
await t.click('Save', 600)
check(
  'category: Save asks Do you want to save the record?',
  (await dialogs()).some((d) => d.includes('Do you want to save the record?')),
)
const before = calls.length
await (await t.btn('No')).click()
await sleep(300)
check('category: No saves nothing', calls.length === before)
await t.click('Save', 600)
await t.yes()
check(
  'category: Yes sends the new category cleaned up (upper case) and reports it',
  calls.at(-1)?.method === 'POST' &&
    JSON.stringify(calls.at(-1).body) === JSON.stringify({ code: '03', description: 'BLOCKED' }) &&
    (await t.toast('Record Saved...')),
  JSON.stringify(calls.at(-1)),
)

await clickRow('Suspension categories', 0)
await sleep(200)
await t.click('Edit', 300)
check(
  'category: Edit locks the code and frees the description',
  (await (await t.field('Suspension Code')).evaluate((e) => e.disabled)) &&
    !(await (await t.field('Suspension Description')).evaluate((e) => e.readOnly || e.disabled)),
)
await t.type('Suspension Description', 'membership changed')
await t.click('Save', 600)
await t.yes()
check(
  'category: saving an edit sends a PUT and says Record Updated...',
  calls.at(-1)?.method === 'PUT' && calls.at(-1).body.description === 'MEMBERSHIP CHANGED' && (await t.toast('Record Updated...')),
  JSON.stringify(calls.at(-1)),
)

// ---------------- Suspension Details
await tab('Suspension Details')
await t.click('Search', 800)
check('details: nothing is suspended in the data, so Search says Record not found', await t.toast('Record not found'))
await t.click('Add', 300)
await t.click('Save', 400)
check('details: Save without a selection says so', (await t.errors()).includes('Please Enter Selection'), JSON.stringify(await t.errors()))
await t.select('Selection', '01')
await t.click('Save', 400)
check('details: then the member number', (await t.errors()).includes('Please Enter Member Number/Agent Code'), JSON.stringify(await t.errors()))
await t.type('Member Number', unknownCode.toLowerCase() + '00001*01')
await page.keyboard.press('Tab')
await sleep(300)
check(
  'details: leaving the box upper-cases the number and, for an unknown payor, says Invalid MembershipNumber',
  (await t.value('Member Number')) === unknownCode + '00001*01' && (await t.toast('Invalid MembershipNumber')),
)
await t.click('Save', 400)
check('details: then the description', (await t.errors()).includes('Please Enter Description'), JSON.stringify(await t.errors()))
await t.type('Description', 'late payment')
await t.click('Save', 400)
check('details: then the payor', (await t.errors()).includes('Please Enter Payor'), JSON.stringify(await t.errors()))
const payor = payors.find((p) => p.name) ?? payors[0]
const other = payors.find((p) => p.code !== payor.code)
await t.type('Member Number', `${payor.code}00001*01`)
await page.keyboard.press('Tab')
await sleep(400)
check('details: leaving a member number fills in its payor', (await t.value('Payor')).startsWith(payor.code), await t.value('Payor'))
await t.type('Payor', `${other.code} - ${other.name ?? ''}`)
await t.click('Save', 400)
check(
  'details: a payor other than the member number payor says Payor Code Not Match',
  (await t.errors()).includes('Payor Code Not Match'),
  JSON.stringify(await t.errors()),
)
await t.type('Member Number', `${payor.code}00001*01`)
await page.keyboard.press('Tab')
await sleep(400)
await t.click('Save', 600)
await t.yes()
const added = calls.at(-1)
check(
  'details: Yes sends the suspension cleaned up and reports it',
  added.method === 'POST' &&
    added.path.endsWith('/details') &&
    added.body.selection === '01' &&
    added.body.key === `${payor.code.toUpperCase()}00001*01` &&
    added.body.description === 'LATE PAYMENT' &&
    (await t.toast('Record Saved...')),
  JSON.stringify(added),
)

fakeDetails = true
await t.click('Clear', 300)
await t.click('Search', 800)
const detRows = await rowsOf('Suspended members and agents')
check(
  'details: Search lists the suspensions with the payor as code - name',
  detRows.length === 2 && detRows[0][1] === 'XL0001*01' && detRows[0][3] === 'XL - A PAYOR',
  JSON.stringify(detRows),
)
await clickRow('Suspended members and agents', 1)
await sleep(200)
check(
  'details: a chosen row fills the form (an agent shows Agent Code) and locks the key',
  (await t.value('Agent Code')) === 'AGENT7' &&
    (await (await t.field('Agent Code')).evaluate((e) => e.disabled)) &&
    (await t.value('Description')) === 'LICENCE',
)
await t.click('Edit', 300)
await t.type('Description', 'licence suspended')
await t.click('Save', 600)
await t.yes()
check(
  'details: saving an edit sends a PUT and says Record Updated...',
  calls.at(-1)?.method === 'PUT' &&
    calls.at(-1).body.key === 'AGENT7' &&
    calls.at(-1).body.description === 'LICENCE SUSPENDED' &&
    (await t.toast('Record Updated...')),
  JSON.stringify(calls.at(-1)),
)
await t.click('Search', 800)
await clickRow('Suspended members and agents', 0)
await sleep(200)
await t.click('Delete', 600)
check(
  'details: Delete asks Do you want to delete the record?',
  (await dialogs()).some((d) => d.includes('Do you want to delete the record?')),
  JSON.stringify(await dialogs()),
)
await t.yes()
check(
  'details: Yes deletes that member and reports it',
  calls.at(-1)?.method === 'DELETE' &&
    calls.at(-1).path.includes('selection=01') &&
    calls.at(-1).path.includes('XL0001') &&
    (await t.toast('Record Deleted...')),
  JSON.stringify(calls.at(-1)),
)
fakeDetails = false

// ---------------- access: position 27 withheld
const access = '1'.repeat(26) + '0' + '1'.repeat(3)
const limited = await t.browser.newPage()
await limited.evaluateOnNewDocument(
  (token, a) =>
    localStorage.setItem(
      'genisis.session',
      JSON.stringify({ token, expiresUtc: '2035-01-01T00:00:00Z', user: { userCode: 'E2E', userName: 'E2E Tester', access: a } }),
    ),
  mint(access),
  access,
)
await limited.goto(`${BASE}/maintenance/suspension`, { waitUntil: 'networkidle0' })
await limited.waitForSelector('h2')
check('access: without position 27 the page says Access Denied!', (await limited.$eval('h2', (e) => e.textContent)) === 'Access Denied!')
check('access: and the API refuses with 403', (await get('/api/maintenance/suspension/categories', mint(access))).status === 403)

console.log(`screenshots: ${t.shots}`)
const ok = t.summary()
await t.browser.close()
process.exit(ok ? 0 : 1)
