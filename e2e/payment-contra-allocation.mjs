// Payment > Contra Allocation. Reads the real contra rows; the POST that would allocate them is intercepted and answered here (the database writes are covered by the API's own rolled-back database
// tests), so nothing is written.
import { start, sleep, BASE } from './lib.mjs'
import { mint } from './mint.mjs'

const t = await start()
const { page, check } = t

const get = (path, token = mint()) => fetch(`${BASE}${path}`, { headers: { Authorization: `Bearer ${token}` } })
const json = async (path) => (await get(path)).json()
const D = '/api/payment/contra-allocation'
const dialogs = () => page.$$eval('[role=dialog]', (d) => d.map((x) => x.textContent.replace(/\s+/g, ' ').trim()))
const rowsOf = () =>
  page.$$eval('table tbody tr', (trs) => trs.map((tr) => [...tr.querySelectorAll('td')].map((td) => td.textContent.trim())).filter((r) => r.length > 2))
const boxes = () => page.$$eval('table tbody tr input[type=checkbox]', (b) => b.map((x) => x.checked))
const stat = (label) =>
  page.evaluate(
    (l) =>
      [...document.querySelectorAll('.stat')].find((s) => s.querySelector('.stat-label')?.textContent === l)?.querySelector('.stat-value')?.textContent ?? null,
    label,
  )
const tick = (i) => page.evaluate((n) => document.querySelectorAll('table tbody tr input[type=checkbox]')[n].click(), i)

const posts = []
await page.setRequestInterception(true)
page.on('request', (req) => {
  if (req.method() === 'POST' && new URL(req.url()).pathname === `${D}/allocate`) {
    const body = JSON.parse(req.postData())
    posts.push(body)
    return req.respond({ status: 200, contentType: 'application/json', body: JSON.stringify({ allocationNo: '100007', count: body.ids.length }) })
  }
  req.continue()
})

// ---------------- the API
const all = await json(`${D}?status=0`)
const allocated = await json(`${D}?status=1`)
const open = await json(`${D}?status=2`)
check(
  'api: every contra row, split into allocated and not allocated',
  all.rows.length === allocated.rows.length + open.rows.length && allocated.rows.length >= 1 && open.rows.length >= 1 && all.truncated === false,
  `${all.rows.length} = ${allocated.rows.length} + ${open.rows.length}`,
)
check(
  'api: an allocated row has its number, date and status A',
  allocated.rows.every((r) => r.contraStatus === 'A' && r.allocationNo && r.allocationDate),
  JSON.stringify(allocated.rows[0]),
)
const byCase = await json(`${D}?scanCase=XI00480`)
check('api: a scanned claim finds its rows', byCase.rows.length >= 1 && byCase.rows.every((r) => r.caseNo === 'XI00480'), JSON.stringify(byCase.rows[0]))
const ranged = await json(`${D}?caseFrom=MA00003&caseTo=MA00006&status=1`)
check('api: a case range', ranged.rows.length >= 2 && ranged.rows.every((r) => r.caseNo >= 'MA00003' && r.caseNo <= 'MA00006'), `${ranged.rows.length}`)
const refFrom = await json(`${D}?refFrom=RB52941`)
check(
  'api: a Ref No from alone is a lower bound (the desktop found nothing)',
  refFrom.rows.length >= 1 && refFrom.rows.every((r) => r.refNo >= 'RB52941'),
  `${refFrom.rows.length}`,
)
const none = await get(`${D}?caseFrom=ZZZZZZZZ`)
check('api: nothing found is No record found!', none.status === 404 && (await none.json()).message === 'No record found!')
const bad = await get(`${D}?status=3`)
check('api: a wrong status is refused', bad.status === 400 && (await bad.json()).message === 'Select a valid status.')
const empty = await fetch(`${BASE}${D}/allocate`, {
  method: 'POST',
  headers: { Authorization: `Bearer ${mint()}`, 'Content-Type': 'application/json' },
  body: JSON.stringify({ ids: [] }),
})
check('api: Update without a row says so', empty.status === 400 && (await empty.json()).message === 'Please select the record')
const receiptOnly = open.rows.find((r) => !r.caseNo)
const refused = await fetch(`${BASE}${D}/allocate`, {
  method: 'POST',
  headers: { Authorization: `Bearer ${mint()}`, 'Content-Type': 'application/json' },
  body: JSON.stringify({ ids: [receiptOnly.id] }),
})
check(
  'api: a receipt-only row cannot be allocated and the number is not used',
  refused.status >= 400 && (await refused.json()).message === 'The record has no claim to allocate.',
)

// ---------------- the screen
await t.go('/payment/contra-allocation')
check('screen: title', (await page.$eval('h2', (e) => e.textContent)) === 'Contra Allocation')
const menu = await page.$$eval('.sidebar a', (a) => a.map((x) => x.textContent.trim()))
const pending = await page.$$eval('.sidebar span', (a) => a.map((x) => x.textContent.trim()))
check(
  'menu: Payment lists Contra Allocation and Update Invoice as links',
  menu.includes('Contra Allocation') && menu.includes('Update Invoice') && menu.includes('Chq. Reissue'),
  menu.join('|'),
)
check(
  'menu: the forms that are not in the source are disabled',
  ['To Hospital', 'Pay2MBM(Auto)', 'Pay2MBM', 'Chq. Cancellation', 'Payor', 'Others', 'Payment Tracking', 'PV Update (Manual)'].every((x) =>
    pending.includes(x),
  ),
  pending.join('|'),
)
check(
  'screen: Status starts as 0 - ALL, nothing is listed',
  (await page.$eval('select[name=status]', (e) => e.value)) === '0' && (await stat('Record(s)')) === '0',
)

await t.select('Status', '1')
await t.click('Search', 1500)
const shown = await rowsOf()
check(
  'screen: Search lists the allocated rows with their status, claim and allocation',
  shown.length === allocated.rows.length && shown.every((r) => r[1] === 'ALLOCATED' && /^[A-Z]+\d+-\d+$/.test(r[2]) && r[6] !== ''),
  JSON.stringify(shown[0]),
)
check('screen: Record(s) counts them', (await stat('Record(s)')) === String(shown.length))
await tick(0)
await sleep(300)
check('screen: an allocated row cannot be ticked', (await t.toasts()).includes('Record has been allocated!') && (await boxes())[0] === false)

await t.select('Status', '2')
await t.type('Ref No from', '123')
await t.type('Ref No to', '123')
await t.click('Search', 1500)
const open123 = await rowsOf()
check('screen: Ref No from and to find the row of that receipt', open123.length >= 1 && open123.every((r) => r[1] === ''), JSON.stringify(open123[0]))
await t.click('Check All', 300)
check('screen: Check All ticks the rows that can be ticked', (await boxes()).every(Boolean))
await t.click('Update', 500)
check(
  'screen: Update asks first',
  (await dialogs()).some((d) => d.includes('Do you want to update the record?')),
)
await (await t.btn('No')).click()
await sleep(300)
check('screen: No allocates nothing', posts.length === 0)
await t.click('Update', 500)
await t.yes()
check('screen: Yes says the allocation number', await t.toast('Record Updated, Your Allocation Number is : 100007'))
check('screen: the POST carries the rows ticked', posts.length === 1 && posts[0].ids.length === open123.length, JSON.stringify(posts[0]))
check('screen: the list is cleared and the number shown', (await rowsOf()).length === 0 && (await stat('Allocation No')) === '100007')
await t.click('Update', 400)
check('screen: Update with nothing ticked says so', (await t.toasts()).includes('Please select the record'))

await t.click('Clear', 300)
await t.checkbox('Use Scan')
await t.select('Status', '2')
await t.type('Case No', '')
await t.click('Search', 400)
check('screen: Use Scan without a claim number says so', await t.toast('Please Enter Case No'))
await t.type('Case No', 'XI00480')
await t.click('Search', 1500)
const scanned = await rowsOf()
check('screen: a scanned claim is added to the list', scanned.length >= 1 && scanned.every((r) => r[2].startsWith('XI00480-')), JSON.stringify(scanned))
await t.type('Case No', 'XI00480')
await t.click('Search', 800)
check('screen: scanning it again says Data has been uploaded!', await t.toast('Data has been uploaded!'))
check('screen: and does not add it twice', (await rowsOf()).length === scanned.length)

await t.click('Clear', 300)
await t.select('Status', '2')
await t.type('Ref No from', 'RB52941')
await t.type('Ref No to', 'RB52941')
await t.click('Search', 1500)
await tick(0)
await sleep(300)
check(
  'screen: a receipt-only row (no claim) cannot be ticked',
  (await t.toasts()).includes('The record has no claim to allocate.') && (await boxes())[0] === false,
)
await t.click('Clear', 300)
await t.type('Case No from', 'ZZZZZZZZ')
await t.click('Search', 1500)
check('screen: nothing found says No record found!', await t.toast('No record found!'))

// ---------------- access: position 12 withheld
const access = '1'.repeat(11) + '0' + '1'.repeat(18)
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
await limited.goto(`${BASE}/payment/contra-allocation`, { waitUntil: 'networkidle0' })
await limited.waitForSelector('h2')
check('access: without position 12 the page says Access Denied!', (await limited.$eval('h2', (e) => e.textContent)) === 'Access Denied!')
check('access: and the API refuses with 403', (await get(`${D}?status=1`, mint(access))).status === 403)

console.log(`screenshots: ${t.shots}`)
const ok = t.summary()
await t.browser.close()
process.exit(ok ? 0 : 1)
