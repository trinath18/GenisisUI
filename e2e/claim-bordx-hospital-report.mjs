// Claim Bordx > Payment Advice > Hospital Report. Read only, against the real claims, views and cost allocation; nothing is written (the files the buttons write are made in the browser from the API's answers,
// which are checked here).
import { start, sleep, BASE } from './lib.mjs'
import { mint } from './mint.mjs'

const t = await start()
const { page, check } = t

const get = (path, token = mint()) => fetch(`${BASE}${path}`, { headers: { Authorization: `Bearer ${token}` } })
const json = async (path) => (await get(path)).json()
const rowsOf = () =>
  page.$$eval('table[aria-label="Payment advice bordx"] tbody tr', (trs) =>
    trs.map((tr) => [...tr.querySelectorAll('td')].map((td) => td.textContent.trim())).filter((r) => r.length > 2),
  )
const headers = () => page.$$eval('table[aria-label="Payment advice bordx"] thead th', (ths) => ths.map((th) => th.textContent.trim()).filter(Boolean))
const stat = (label) =>
  page.evaluate(
    (l) =>
      [...document.querySelectorAll('.stat')].find((s) => s.querySelector('.stat-label')?.textContent === l)?.querySelector('.stat-value')?.textContent ?? null,
    label,
  )
const money = (n) => n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const q = (o) => new URLSearchParams(Object.entries(o).filter(([, v]) => v !== undefined)).toString()
const H = '/api/claim-bordx/hospital-report'

const calls = []
page.on('response', (res) => {
  const url = new URL(res.url())
  if (url.pathname.startsWith(H)) calls.push({ path: url.pathname.slice(H.length), query: url.search, status: res.status() })
})

// ---------------- the API
const refused = async (res) => ({ status: res.status, message: (await res.json().catch(() => ({}))).message })
check(
  'api: a search without the range is refused with the desktop message',
  (await refused(await get(`${H}/search`))).message === 'Please enter Bordx Reference No',
)
const none = await refused(await get(`${H}/search?${q({ bordxFrom: 'ZZZ1', bordxTo: 'ZZZ2' })}`))
check('api: a range with no claims is No record found', none.status === 404 && none.message === 'No record found ', JSON.stringify(none))
const found = await json(`${H}/search?${q({ bordxFrom: 'NWK0024483', bordxTo: 'NWK0024483' })}`)
check('api: the claims of the bordx', found.rows.length >= 1 && found.rows.every((r) => r.bordxNo === 'NWK0024483'), `${found.rows.length}`)
check(
  'api: nothing is found for another hospital or a later discharge date',
  (await get(`${H}/search?${q({ bordxFrom: 'NWK0024483', bordxTo: 'NWK0024483', hospital: 'NO SUCH HOSPITAL' })}`)).status === 404 &&
    (await get(`${H}/search?${q({ bordxFrom: 'NWK0024483', bordxTo: 'NWK0024483', dodFrom: '2099-01-01' })}`)).status === 404,
)
check('api: the payment advice needs a bordx chosen', (await refused(await get(`${H}/payment-advice`))).message === 'Please Select Bordx')
check('api: a bordx that is not in the list is not found', (await get(`${H}/payment-advice?bordxNo=NO-SUCH`)).status === 404)
const advice = await json(`${H}/payment-advice?bordxNo=nwk0024483`)
const panelSummary = advice.sections.find((s) => s.title === 'Payment Advice - Panel Hospitals')
const panelClaims = advice.sections.find((s) => s.title === 'Payment Advice - Panel Hospitals - claims')
check(
  'api: the payment advice has the hospital summary with its total row',
  advice.name === 'NWK0024483' &&
    panelSummary &&
    panelSummary.rows.at(-1)[1] === 'Total' &&
    panelSummary.header.join() === 'No,Hospital,Cases,Actual Amt,Paid by Member,Payable to Hospital',
  JSON.stringify(advice.sections.map((s) => s.title)),
)
check(
  'api: the summary adds up to the claims behind it',
  panelSummary && panelClaims && Number(panelSummary.rows.at(-1)[2]) === panelClaims.rows.filter((r) => r[5] !== 'Sub Total' && r[1] !== 'Payable to').length,
)
const members = await json(`${H}/payment-advice?bordxNo=NXI0003416`)
check(
  'api: a bordx with payments to members has that section',
  members.sections.some((s) => s.title === 'Payment to Members'),
  JSON.stringify(members.sections.map((s) => s.title)),
)
const cc = await json(`${H}/cost-centre?${q({ bordxFrom: 'NMH00115', bordxTo: 'NMH00115' })}`)
const allocation = cc.sections[0]
const expenses = cc.sections[2]
check(
  'api: the cost allocation uses the desktop account codes',
  allocation.title === 'Cost Allocation' &&
    allocation.rows.length > 0 &&
    allocation.rows.every((r) => r[0] === '10HEQ2510' && r[1] === '95010000' && r[3] === 'MYR' && r[6] === 'EA'),
  JSON.stringify(allocation.rows[0]),
)
check(
  'api: the grand total is the sum of the cost centre amounts and of the wing amounts',
  cc.sections.at(-1).rows[0][0] === 'Grand Total' && expenses.rows.length > 0,
)
check(
  'api: a range with nothing in the cost allocation is No record found',
  (await get(`${H}/cost-centre?${q({ bordxFrom: 'ZZZ1', bordxTo: 'ZZZ2' })}`)).status === 404,
)

// ---------------- the screen
await t.go('/claim-bordx/hospital-report')
check('screen: title', (await page.$eval('h2', (e) => e.textContent)) === 'Payment Advice - By Hospital')
const side = await page.$$eval('.sidebar a', (els) => els.map((e) => e.textContent.trim()))
check('menu: Hospital Report is a link in the Claim Bordx menu', side.includes('Hospital Report'), side.join('|'))
await t.click('Search', 400)
check('screen: Search without the range says so', (await t.errors()).includes('Please enter Bordx Reference No'), JSON.stringify(await t.errors()))
await t.click('Print Report', 400)
check('screen: Print Report without the range says so', await t.toast('Please enter Bordx Reference No'))
await t.type('Bordx No from', 'NWK0024483')
await t.type('Bordx No to', 'NWK0024483')
await t.click('Print Report', 400)
check('screen: Print Report before a bordx is chosen says so', await t.toast('Please Select Bordx'))
await t.click('Search', 1200)
const shown = await rowsOf()
check('screen: Search lists the claims of the bordx', shown.length === found.rows.length, `${shown.length} vs ${found.rows.length}`)
check(
  "screen: the list is Print Bordx's with the bordx date",
  JSON.stringify(await headers()) ===
    JSON.stringify([
      'Plan Code',
      'Claim No',
      'Patient Name',
      'Member No',
      'Hospital',
      'Bordx Amt',
      'Bill Amt',
      'Approve Amt',
      'Recovery Amt',
      'Case Mgmt Fee',
      'Debit Credit Ref No',
      'Bordx No',
      'Print Status',
      'HLT Code',
      'Payor',
      'BTBG',
      'BordxDate',
    ]),
  JSON.stringify(await headers()),
)
check(
  'screen: the counters show the records and the total',
  (await stat('Records')) === String(found.rows.length) && (await stat('Total Amt')) === money(found.totalAmount),
  `${await stat('Total Amt')} vs ${money(found.totalAmount)}`,
)
await page.click('table[aria-label="Payment advice bordx"] tbody tr')
await sleep(300)
check('screen: choosing a row shows its bordx number', (await stat('Bordx No')) === 'NWK0024483', await stat('Bordx No'))
await t.click('Print Report', 1500)
check(
  'screen: Print Report asks the server for the payment advice of the chosen bordx',
  calls.some((c) => c.path === '/payment-advice' && c.query.includes('bordxNo=NWK0024483') && c.status === 200),
  JSON.stringify(calls),
)
await t.type('Bordx No from', 'NMH00115')
await t.type('Bordx No to', 'NMH00115')
await t.click('CC Report', 1500)
check(
  'screen: CC Report asks the server for the cost allocation of the range',
  calls.some((c) => c.path === '/cost-centre' && c.query.includes('bordxFrom=NMH00115') && c.status === 200),
  JSON.stringify(calls),
)
await t.click('Clear', 300)
check('screen: Clear empties the list', (await rowsOf()).length === 0 && (await stat('Records')) === '0')

// ---------------- access: position 15 withheld
const access = '1'.repeat(14) + '0' + '1'.repeat(15)
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
await limited.goto(`${BASE}/claim-bordx/hospital-report`, { waitUntil: 'networkidle0' })
await limited.waitForSelector('h2')
check('access: without position 15 the page says Access Denied!', (await limited.$eval('h2', (e) => e.textContent)) === 'Access Denied!')
check('access: and the API refuses with 403', (await get(`${H}/search?bordxFrom=A&bordxTo=Z`, mint(access))).status === 403)

console.log(`screenshots: ${t.shots}`)
const ok = t.summary()
await t.browser.close()
process.exit(ok ? 0 : 1)
