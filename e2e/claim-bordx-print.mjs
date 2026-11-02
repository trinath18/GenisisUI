// Claim Bordx > Print Bordx. Reads the real claims of bordx NUT0000072 to NUT0000074 (none printed); the previews and the summary report are real calls that write nothing, and the POST that would mark the bordx
// as printed (Print Detail) is intercepted and answered here (the marking is covered by the API's own rolled-back database test), so nothing is written.
import { start, BASE } from './lib.mjs'
import { mint } from './mint.mjs'

const t = await start()
const { page, check } = t

const get = (path, token = mint()) => fetch(`${BASE}${path}`, { headers: { Authorization: `Bearer ${token}` } })
const json = async (path) => (await get(path)).json()
const post = (path, body, token = mint()) =>
  fetch(`${BASE}${path}`, { method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
const rowsOf = () =>
  page.$$eval('table[aria-label="Print bordx"] tbody tr', (trs) =>
    trs.map((tr) => [...tr.querySelectorAll('td')].map((td) => td.textContent.trim())).filter((r) => r.length > 2),
  )
const headers = () => page.$$eval('table[aria-label="Print bordx"] thead th', (ths) => ths.map((th) => th.textContent.trim()).filter(Boolean))
const stat = (label) =>
  page.evaluate(
    (l) =>
      [...document.querySelectorAll('.stat')].find((s) => s.querySelector('.stat-label')?.textContent === l)?.querySelector('.stat-value')?.textContent ?? null,
    label,
  )
const money = (n) => n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const q = (o) => new URLSearchParams(Object.entries(o).filter(([, v]) => v !== undefined)).toString()
const P = '/api/claim-bordx/print-bordx'
const range = { bordxFrom: 'NUT0000072', bordxTo: 'NUT0000074' }

const posted = []
await page.setRequestInterception(true)
page.on('request', (req) => {
  const url = new URL(req.url())
  if (url.pathname !== `${P}/print` || req.method() !== 'POST') return req.continue()
  const body = JSON.parse(req.postData())
  posted.push(body)
  if (!(body.print && body.kind === 'detail' && body.printOption === 'new')) return req.continue()
  return req.respond({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({
      kind: 'detail',
      reportType: body.reportType,
      btbg: body.btbg,
      printedDate: '2026-10-30T00:00:00',
      bordxFrom: body.bordxFrom,
      bordxTo: body.bordxTo,
      payor: null,
      rows: [],
      summary: [],
      marked: true,
    }),
  })
})

// ---------------- the API
const refused = async (res) => ({ status: res.status, message: (await res.json().catch(() => ({}))).message })
check('api: a search without the range is refused with the desktop message', (await refused(await get(P))).message === 'Please enter Bordx Reference No')
check('api: so is one with only one end', (await refused(await get(`${P}?bordxFrom=NUT0000072`))).message === 'Please enter Bordx Reference No')
const none = await refused(await get(`${P}?${q({ bordxFrom: 'ZZZ1', bordxTo: 'ZZZ2' })}`))
check('api: a range with no claims is No record found', none.status === 404 && none.message === 'No record found ', JSON.stringify(none))
const found = await json(`${P}?${q(range)}`)
check('api: the claims of the three bordx', found.rows.length >= 15 && new Set(found.rows.map((r) => r.bordxNo)).size === 3, `${found.rows.length}`)
check(
  'api: none is printed, so the suggested Print Status is Print New',
  found.printed === 0 && found.notPrinted === found.rows.length && found.printOption === 'new',
)
check(
  'api: the bordx amount is the approved amount (not BTBG) and the total follows the desktop rule',
  found.rows.every((r) => r.bordxAmount === r.totalApproved) &&
    Math.abs(
      found.totalAmount -
        found.rows.reduce(
          (s, r) => s + (r.btbg === 'Y' && r.payTo === 'H' ? r.payableToHospital : r.btbg === 'Y' && r.payTo === 'M' ? r.payableToMember : r.totalMgmtFee),
          0,
        ),
    ) < 0.005,
)
const detail = await (await post(`${P}/print`, { ...range, kind: 'detail', reportType: 'single', btbg: 'N', printOption: 'new', print: false })).json()
check(
  'api: the detail preview has the claims, the payor and the product, and writes nothing',
  detail.marked === false && detail.rows.length >= found.rows.length - 2 && detail.payor?.code === 'UT' && detail.rows.every((r) => r.patientName),
  `${detail.rows.length}`,
)
check(
  'api: the summary has one line per bordx that adds up to the claims',
  detail.summary.length === 3 &&
    detail.summary.reduce((s, l) => s + l.claims, 0) === detail.rows.length &&
    Math.abs(detail.summary.reduce((s, l) => s + l.totalApproved, 0) - detail.rows.reduce((s, r) => s + r.totalApproved, 0)) < 0.005,
)
const summary = await (await post(`${P}/print`, { ...range, kind: 'summary', reportType: 'single', btbg: 'N', printOption: 'new', print: true })).json()
check('api: printing the summary report does not mark anything', summary.marked === false && summary.kind === 'summary')
const wrong = await refused(await post(`${P}/print`, { ...range, kind: 'detail', reportType: 'single', btbg: 'N', printOption: 'reprint', print: true }))
check(
  'api: Print Detail with Reprint on a bordx never printed is refused and nothing is saved',
  wrong.status === 400 && wrong.message === "Please select 'Print New' option for this report",
  JSON.stringify(wrong),
)
check('api: a bad choice is refused', (await post(`${P}/print`, { ...range, kind: 'pdf', print: false })).status === 400)
check('api: the bordx are still unprinted', (await json(`${P}?${q(range)}`)).printed === 0)

// ---------------- the screen
await t.go('/claim-bordx/print-bordx')
check('screen: title', (await page.$eval('h2', (e) => e.textContent)) === 'Print Bordx')
const side = await page.$$eval('.sidebar a', (els) => els.map((e) => e.textContent.trim()))
check('menu: Print Bordx is a link in the Claim Bordx menu', side.includes('Print Bordx'), side.join('|'))
check(
  'screen: the report buttons are off until a search found claims',
  (await t.isDisabled('Detail Preview')) && (await t.isDisabled('Print Detail')) && (await t.isDisabled('Print to File')),
)
await t.click('Search', 400)
check('screen: Search without the range says so', (await t.errors()).includes('Please enter Bordx Reference No'), JSON.stringify(await t.errors()))
await t.type('Bordx No from', range.bordxFrom)
await t.type('Bordx No to', range.bordxTo)
await t.click('Search', 1500)
const shown = await rowsOf()
check('screen: Search lists the claims of the range', shown.length === found.rows.length, `${shown.length} vs ${found.rows.length}`)
check(
  'screen: the list is headed as the desktop headed it',
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
    ]),
  JSON.stringify(await headers()),
)
check(
  'screen: the counters show the records and the total',
  (await stat('Records')) === String(found.rows.length) && (await stat('Total Amt')) === money(found.totalAmount),
  `${await stat('Total Amt')} vs ${money(found.totalAmount)}`,
)
check(
  'screen: every claim shows NO for the print status and the Print Status box offers Print New',
  shown.every((r) => r[12] === 'NO') && (await page.$eval('select[name=printOption]', (s) => s.value)) === 'new',
)
check(
  'screen: the report buttons are on',
  !(await t.isDisabled('Detail Preview')) && !(await t.isDisabled('Print Detail')) && !(await t.isDisabled('Print to File')),
)
await t.click('Detail Preview', 1500)
check(
  'screen: Detail Preview asks the server for the detail report without printing',
  posted.length === 1 && posted[0].kind === 'detail' && posted[0].print === false && posted[0].bordxFrom === range.bordxFrom,
  JSON.stringify(posted[0]),
)
await t.click('Summary Preview', 1500)
check('screen: Summary Preview asks for the summary', posted.length === 2 && posted[1].kind === 'summary' && posted[1].print === false)
await t.click('Print Summary', 1500)
check(
  'screen: Print Summary does not mark the bordx (no message)',
  posted.length === 3 && posted[2].kind === 'summary' && posted[2].print === true && !(await t.toast('The bordx are marked as printed.')),
)
await t.click('Print Detail', 1500)
check(
  'screen: Print Detail marks the bordx and says so',
  posted.length === 4 && posted[3].print === true && posted[3].kind === 'detail' && (await t.toast('The bordx are marked as printed.')),
  JSON.stringify(posted[3]),
)
await t.select('Print Status', 'reprint')
await t.click('Print Detail', 1200)
check('screen: Print Detail with Reprint on a bordx never printed shows the server message', await t.toast("Please select 'Print New' option for this report"))
await t.click('Search', 1500)
check(
  'screen: Search again lists the claims',
  (await rowsOf()).length === found.rows.length && (await page.$eval('select[name=printOption]', (s) => s.value)) === 'new',
)
await t.click('Clear', 300)
check('screen: Clear empties the list', (await rowsOf()).length === 0 && (await stat('Records')) === '0')

// ---------------- access: position 17 withheld
const access = '1'.repeat(16) + '0' + '1'.repeat(13)
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
await limited.goto(`${BASE}/claim-bordx/print-bordx`, { waitUntil: 'networkidle0' })
await limited.waitForSelector('h2')
check('access: without position 17 the page says Access Denied!', (await limited.$eval('h2', (e) => e.textContent)) === 'Access Denied!')
check('access: and the API refuses with 403', (await get(`${P}?${q(range)}`, mint(access))).status === 403)

console.log(`screenshots: ${t.shots}`)
const ok = t.summary()
await t.browser.close()
process.exit(ok ? 0 : 1)
