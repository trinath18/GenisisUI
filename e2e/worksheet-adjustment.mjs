// Worksheet > Worksheet Adjustment: the saved worksheet with the editable payment details and remarks. It reads real data; the save request is intercepted and answered
// here, so nothing is written (the database writes are covered by the API's rolled-back database tests).
import { start, BASE } from './lib.mjs'
import { mint } from './mint.mjs'

const t = await start()
const { page, check } = t

const get = async (p) => (await fetch(`${BASE}${p}`, { headers: { Authorization: `Bearer ${mint()}` } })).json()
const options = (label) => t.field(label).then((el) => el.evaluate((s) => [...s.options].map((o) => o.value)))
const loaded = () =>
  t.waitFor(async () => (await t.readValue('Mem Num')) !== null && (await page.$('form[aria-label="Payment details and remarks"]')) !== null, 15000)

const puts = []
await page.setRequestInterception(true)
page.on('request', (req) => {
  if (req.method() === 'PUT' && /\/api\/worksheet\/adjustment\/[^/]+\/\d+\/payment$/.test(req.url())) {
    puts.push({ path: new URL(req.url()).pathname, body: JSON.parse(req.postData()) })
    return req.respond({ status: 200, contentType: 'application/json', body: JSON.stringify({ message: 'Record Save' }) })
  }
  req.continue()
})

// A case with several worksheet versions, and its first version.
const found = await get('/api/worksheet/enquiry/cases?by=number&q=AH0000')
const cas = found.find((c) => c.versions >= 2)?.caseNo
check('data: the search finds a case with several worksheet versions', !!cas)
const v1 = await get(`/api/worksheet/enquiry/${cas}?version=1`)

// ---------------- The screen
await t.go(`/worksheet/adjustment?cas=${cas}`)
check('adjustment: title', (await page.$eval('h2', (e) => e.textContent)) === 'Worksheet Adjustment')
check('adjustment: the worksheet loads from the case number in the address', await loaded())
check(
  'adjustment: the three edit sections and the Update button are there',
  (await page.$$eval('form[aria-label="Payment details and remarks"] legend', (l) => l.map((x) => x.textContent))).join('|') ===
    "Payment details|Member's address|Note and remarks" && !(await t.isDisabled('Update')),
)
check(
  'adjustment: the payment panel of the enquiry is replaced by the editor',
  (await page.$$eval('fieldset legend', (l) => l.map((x) => x.textContent))).filter((x) => x === 'Payment and address').length === 0,
)

const o = v1.others ?? {}
check(
  'fields: they hold the saved values',
  (await t.value('Pay To')) === (v1.header.payTo ?? '').trim() &&
    (await t.value('Add 1')) === (o.address1 ?? '').trim() &&
    (await t.value('Post Code')) === (o.postCode ?? '').trim(),
  `${await t.value('Pay To')} / ${await t.value('Add 1')}`,
)
const banks = await options('Bank')
const states = await options('State')
check('lookups: banks come from the maintenance database', banks.includes('AFFIN BANK') && banks.length >= 20, String(banks.length))
check('lookups: states are listed', states.length >= 10, String(states.length))
check('lookups: payment mode offers BY POST and BANK-IN', JSON.stringify(await options('Pymt Mode')) === JSON.stringify(['', 'BY POST', 'BANK-IN']))
check('fields: Post Code holds six characters at most', (await (await t.field('Post Code')).evaluate((e) => e.maxLength)) === 6)

// ---------------- Update
await t.type('Note', 'e2e note')
await t.type('Add 2', 'Taman E2E')
await t.select('Pymt Mode', 'BANK-IN')
await t.click('Update')
check('update: it asks Are you sure?', await t.waitFor(() => page.$('[role=dialog]').then((d) => !!d)))
await t.yes()
check(
  'update: the confirmed save sends one PUT for this version',
  puts.length === 1 && puts[0].path === `/api/worksheet/adjustment/${cas}/1/payment`,
  JSON.stringify(puts.map((p) => p.path)),
)
check(
  'update: the request carries what was typed',
  puts[0]?.body.note === 'e2e note' && puts[0]?.body.address2 === 'Taman E2E' && puts[0]?.body.paymentMode === 'BANK-IN',
)
check(
  'update: Record Save is reported',
  (await t.toasts()).some((x) => x.includes('Record Save')),
  JSON.stringify(await t.toasts()),
)

await t.click('Update')
await page.waitForSelector('[role=dialog]')
await (await t.btn('No')).click()
check('update: answering No sends nothing', (await new Promise((r) => setTimeout(() => r(puts.length), 500))) === 1)

// ---------------- Master and the cumulative views are not versions
await t.select('Version', 'Master')
check(
  'master: the editor gives way to a hint and the Update button is gone',
  await t.waitFor(
    async () =>
      (await page.evaluate(() => document.body.textContent.includes('Choose one worksheet version'))) &&
      (await page.$('form[aria-label="Payment details and remarks"]')) === null,
  ),
)

// ---------------- Menu and access
const nav = await page.$$eval('.sidebar a', (els) => els.map((e) => e.textContent.trim()))
check('menu: Adjustment is a live item of the Worksheet section', nav.includes('Adjustment'))

const access = '1'.repeat(22) + '0' + '1'.repeat(7)
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
await limited.goto(`${BASE}/worksheet/adjustment`, { waitUntil: 'networkidle0' })
await limited.waitForSelector('h2')
check('access: without position 23 the page says Access Denied!', (await limited.$eval('h2', (e) => e.textContent)) === 'Access Denied!')
const put = await fetch(`${BASE}/api/worksheet/adjustment/${cas}/1/payment`, {
  method: 'PUT',
  headers: { Authorization: `Bearer ${mint(access)}`, 'Content-Type': 'application/json' },
  body: '{}',
})
check('access: and the API refuses the save with 403', put.status === 403, String(put.status))
const read = await fetch(`${BASE}/api/worksheet/enquiry/${cas}`, { headers: { Authorization: `Bearer ${mint('1'.repeat(12) + '0' + '1'.repeat(17))}` } })
check('access: a user with Adjustment but not Enquiry can still read the worksheet', read.status === 200, String(read.status))

const ok = t.summary()
await t.browser.close()
process.exit(ok ? 0 : 1)
