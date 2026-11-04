// Maintenance > Panel Hospital Maintenance. Reads the real panels; the PUT that would change one is intercepted and answered here (the database writes are covered by the API's own rolled-back database
// tests), so nothing is written.
import { start, sleep, BASE } from './lib.mjs'
import { mint } from './mint.mjs'

const t = await start()
const { page, check } = t

const get = (path, token = mint()) => fetch(`${BASE}${path}`, { headers: { Authorization: `Bearer ${token}` } })
const json = async (path) => (await get(path)).json()
const D = '/api/maintenance/panel-hospitals'
const dialogs = () => page.$$eval('[role=dialog]', (d) => d.map((x) => x.textContent.replace(/\s+/g, ' ').trim()))
const rowsOf = () =>
  page.$$eval('table tbody tr', (trs) => trs.map((tr) => [...tr.querySelectorAll('td')].map((td) => td.textContent.trim())).filter((r) => r.length > 1))
const boxes = () => page.$$eval('table tbody tr input[type=checkbox]', (b) => b.map((x) => x.checked))
const stat = (label) =>
  page.evaluate(
    (l) =>
      [...document.querySelectorAll('.stat')].find((s) => s.querySelector('.stat-label')?.textContent === l)?.querySelector('.stat-value')?.textContent ?? null,
    label,
  )

const puts = []
await page.setRequestInterception(true)
page.on('request', (req) => {
  if (req.method() === 'PUT' && new URL(req.url()).pathname === D) {
    const body = JSON.parse(req.postData())
    puts.push(body)
    return req.respond({ status: 200, contentType: 'application/json', body: JSON.stringify({ added: body.add.length, removed: body.remove.length }) })
  }
  req.continue()
})

// ---------------- the API
const codes = await json(`${D}/codes`)
check('api: the hospital panel codes', Array.isArray(codes) && codes.length >= 1 && !!codes[0].code, `${codes.length}`)
let panel = null
let members = []
for (const c of codes) {
  members = await json(`${D}?code=${encodeURIComponent(c.code)}`)
  if (members.length >= 2) {
    panel = c.code
    break
  }
}
check(
  'api: a panel lists its hospitals with their addresses',
  panel !== null && members.every((m) => m.code && 'add1' in m && 'town' in m),
  `${panel} ${members.length}`,
)
const available = await json(`${D}/available?code=${encodeURIComponent(panel)}`)
check(
  'api: the hospitals that can be added are not in the panel',
  available.length > 0 && available.every((a) => !members.some((m) => m.code === a.code)) && 'tel' in available[0],
  `${available.length}`,
)
const noCode = await get(`${D}`)
check('api: a search without a panel code says so', noCode.status === 400 && (await noCode.json()).message === 'Please Select Hospital Panel Code!')
check('api: so does Add', (await (await get(`${D}/available`)).json()).message === 'Please Select Hospital Panel Code!')
const bad = await fetch(`${BASE}${D}`, {
  method: 'PUT',
  headers: { Authorization: `Bearer ${mint()}`, 'Content-Type': 'application/json' },
  body: JSON.stringify({ code: ' ' }),
})
check('api: an update without a panel code says so', bad.status === 400 && (await bad.json()).message === 'Please Select Hospital Panel Code!')
const both = await fetch(`${BASE}${D}`, {
  method: 'PUT',
  headers: { Authorization: `Bearer ${mint()}`, 'Content-Type': 'application/json' },
  body: JSON.stringify({ code: panel, add: ['H1'], remove: ['h1'] }),
})
check(
  'api: a hospital cannot be added and removed in one update',
  both.status === 400 && (await both.json()).message === 'A hospital cannot be added and removed in the same update.',
)

// ---------------- the screen
await t.go('/maintenance/panel-hospitals')
check('screen: title', (await page.$eval('h2', (e) => e.textContent)) === 'Panel Hospital Maintenance')
const menu = await page.$$eval('.sidebar a', (a) => a.map((x) => x.textContent.trim()))
check('menu: Maintenance lists Panel Hospital Maintenance', menu.includes('Panel Hospital Maintenance'), menu.join('|'))
check(
  'screen: no panel code is chosen, Update is off and the list is empty',
  (await t.isDisabled('Update')) && (await rowsOf()).length === 0 && (await stat('Record(s)')) === '0',
)
await t.click('Search', 400)
check('screen: Search without a panel code says so', await t.toast('Please Select Hospital Panel Code!'))
await t.click('Add', 400)
check('screen: so does Add', (await t.toasts()).filter((x) => x === 'Please Select Hospital Panel Code!').length >= 1)

await t.select('Hospital Panel Code', panel)
await t.waitFor(async () => (await rowsOf()).length === members.length)
const shown = await rowsOf()
check(
  'screen: choosing a panel lists its hospitals',
  shown.length === members.length && (await stat('Record(s)')) === String(members.length),
  `${shown.length}/${members.length}`,
)
check('screen: every hospital of the panel is ticked', (await boxes()).length === members.length && (await boxes()).every(Boolean))
check('screen: the list has the address columns', (await page.$$eval('table thead th', (t) => t.map((x) => x.textContent.trim()))).includes('Address 1'))
check('screen: Update is on', !(await t.isDisabled('Update')))

await page.evaluate(() => document.querySelectorAll('table tbody tr input[type=checkbox]')[1].click())
await sleep(200)
await t.click('Update', 500)
check(
  'screen: Update asks first',
  (await dialogs()).some((d) => d.includes('Do you want to update the record?')),
)
await (await t.btn('No')).click()
await sleep(300)
check('screen: No writes nothing', puts.length === 0)
await t.click('Update', 500)
await t.yes()
check('screen: Yes saves and says so', await t.toast('Record updated !'))
check(
  'screen: unticking a hospital takes it out of the panel',
  puts.length === 1 && JSON.stringify(puts[0]) === JSON.stringify({ code: panel, add: [], remove: [members[1].code] }),
  JSON.stringify(puts[0]),
)
check('screen: the panel is listed again with every hospital ticked', (await boxes()).every(Boolean) && (await rowsOf()).length === members.length)

await t.click('Add', 600)
const addable = await rowsOf()
check(
  'screen: Add lists the hospitals that are not in the panel, none ticked',
  addable.length === available.length && (await boxes()).every((b) => !b) && (await stat('Record(s)')) === String(available.length),
  `${addable.length}/${available.length}`,
)
check(
  'screen: with their phone and fax, without addresses',
  (await page.$$eval('table thead th', (t) => t.map((x) => x.textContent.trim()).filter(Boolean))).join() === 'Hos Code,Hospital Name,Tel No,Fax No',
)
await page.evaluate(() => {
  const b = document.querySelectorAll('table tbody tr input[type=checkbox]')
  b[0].click()
  b[1].click()
})
await sleep(200)
await t.click('Update', 500)
await t.yes()
check('screen: ticking hospitals adds them', await t.waitFor(() => puts.length === 2))
check(
  'screen: the PUT carries the two hospitals',
  JSON.stringify(puts[1]) === JSON.stringify({ code: panel, add: [available[0].code, available[1].code], remove: [] }),
  JSON.stringify(puts[1]),
)
await sleep(1200)
await t.click('Clear', 300)
check(
  'screen: Clear empties the list',
  await t.waitFor(async () => (await boxes()).length === 0 && (await stat('Record(s)')) === '0' && (await t.isDisabled('Update')), 5000),
)

// ---------------- access: position 1 withheld
const access = '0' + '1'.repeat(29)
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
await limited.goto(`${BASE}/maintenance/panel-hospitals`, { waitUntil: 'networkidle0' })
await limited.waitForSelector('h2')
check('access: without position 1 the page says Access Denied!', (await limited.$eval('h2', (e) => e.textContent)) === 'Access Denied!')
check('access: and the API refuses with 403', (await get(`${D}/codes`, mint(access))).status === 403)

console.log(`screenshots: ${t.shots}`)
const ok = t.summary()
await t.browser.close()
process.exit(ok ? 0 : 1)
