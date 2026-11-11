// Claim Bordx > Print Recovery (Generate Recovery Listing). Read only, against the real recoveries of the BTBG clients; nothing is written.
import { start, BASE } from './lib.mjs'
import { mint } from './mint.mjs'

const t = await start()
const { page, check } = t

const get = (path, token = mint()) => fetch(`${BASE}${path}`, { headers: { Authorization: `Bearer ${token}` } })
const json = async (path) => (await get(path)).json()
const rowsOf = () =>
  page.$$eval('table[aria-label="Recoveries"] tbody tr', (trs) =>
    trs.map((tr) => [...tr.querySelectorAll('td')].map((td) => td.textContent.trim())).filter((r) => r.length > 2),
  )
const headers = () => page.$$eval('table[aria-label="Recoveries"] thead th', (ths) => ths.map((th) => th.textContent.trim()).filter(Boolean))
const stat = (label) =>
  page.evaluate(
    (l) =>
      [...document.querySelectorAll('.stat')].find((s) => s.querySelector('.stat-label')?.textContent === l)?.querySelector('.stat-value')?.textContent ?? null,
    label,
  )
const money = (n) => n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const q = (o) => new URLSearchParams(Object.entries(o).filter(([, v]) => v !== undefined)).toString()

// ---------------- the API
const companies = await json('/api/claim-bordx/recovery/companies')
check(
  'api: the clients come with their report layout',
  companies.length > 10 && companies.some((c) => c.reportType === '1') && companies.some((c) => c.reportType === '2'),
  `${companies.length}`,
)
const missing = await get('/api/claim-bordx/recovery')
check(
  'api: a search without a group company is refused with the desktop message',
  missing.status === 400 && (await missing.json()).message === 'Please select Group Company',
)
check('api: a company that is not a client is not found', (await get('/api/claim-bordx/recovery?company=NO%20SUCH%20COMPANY')).status === 404)
const gas = companies.find((c) => c.name === 'GAS MALAYSIA BERHAD') ?? companies.find((c) => c.reportType === '1')
const result = await json(`/api/claim-bordx/recovery?${q({ company: gas.name })}`)
check(
  'api: a client gives its recoveries, every one a negative amount, with the client layout',
  result.rows.length > 0 && result.rows.every((r) => r.recovery < 0) && result.reportType === gas.reportType,
  `${gas.name} ${result.rows.length}`,
)
check(
  'api: the totals add up the rows',
  Math.abs(result.totalRecovery - result.rows.reduce((s, r) => s + r.recovery, 0)) < 0.005 &&
    Math.abs(result.totalBordxAmount - result.rows.reduce((s, r) => s + (r.bordxAmount ?? 0), 0)) < 0.005,
)
check(
  'api: the rows are in case and version order',
  result.rows.every(
    (r, i) => i === 0 || result.rows[i - 1].caseNo < r.caseNo || (result.rows[i - 1].caseNo === r.caseNo && result.rows[i - 1].claimVersion <= r.claimVersion),
  ),
)
const withBordx = result.rows.find((r) => r.bordxNo)
const oneBordx = await json(`/api/claim-bordx/recovery?${q({ company: gas.name, bordxFrom: withBordx.bordxNo.toLowerCase(), bordxTo: withBordx.bordxNo })}`)
check(
  'api: a bordx number range of one bordx keeps only its recoveries',
  oneBordx.rows.length >= 1 && oneBordx.rows.length <= result.rows.length && oneBordx.rows.every((r) => r.bordxNo === withBordx.bordxNo),
)
check(
  'api: a bordx date after all of them finds nothing',
  (await json(`/api/claim-bordx/recovery?${q({ company: gas.name, bordxDateFrom: '2099-01-01' })}`)).rows.length === 0,
)
const mdec = companies.find((c) => c.reportType === '2')
check('api: the MDEC client is sent the second layout', (await json(`/api/claim-bordx/recovery?${q({ company: mdec.name })}`)).reportType === '2')

// ---------------- the screen
await t.go('/claim-bordx/print-recovery')
check('screen: title', (await page.$eval('h2', (e) => e.textContent)) === 'Generate Recovery Listing')
const side = await page.$$eval('.sidebar a', (els) => els.map((e) => e.textContent.trim()))
check('menu: Print Recovery is a link in the Claim Bordx menu', side.includes('Print Recovery'), side.join('|'))
check('screen: Print is off until a search found something', await t.isDisabled('Print'))
await t.click('Search', 400)
check('screen: Search without a group company says so', (await t.errors()).includes('Please select Group Company'), JSON.stringify(await t.errors()))
await t.type('Grp Company', gas.name)
await t.click('Search', 1500)
const shown = await rowsOf()
check(
  'screen: Search lists the recoveries of the client',
  shown.length === result.rows.length && shown[0][0] === `${result.rows[0].caseNo}-${result.rows[0].claimVersion}`,
  `${shown.length} vs ${result.rows.length}`,
)
check(
  'screen: the headings are the list headings',
  JSON.stringify(await headers()) === JSON.stringify(['Case No', 'Patient', 'Member No', 'Hospital', 'Actual Amt', 'Recovery', 'Bordx Amt', 'Bordx Ref']),
  JSON.stringify(await headers()),
)
check(
  'screen: the recovery is shown as a positive amount, as the desktop showed it (times -1)',
  shown[0][5] === money(-result.rows[0].recovery),
  `${shown[0][5]} vs ${money(-result.rows[0].recovery)}`,
)
check(
  'screen: the counters show the rows and the total of the bordx amounts',
  (await stat('Records')) === String(shown.length) && (await stat('Total Amt')) === money(result.totalBordxAmount),
  `${await stat('Total Amt')} vs ${money(result.totalBordxAmount)}`,
)
check('screen: Print is on once there are rows', !(await t.isDisabled('Print')))
await t.type('Bordx No to', '0')
await t.click('Search', 1500)
check('screen: a search that matches nothing says No record found', await t.toast('No record found'))
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
await limited.goto(`${BASE}/claim-bordx/print-recovery`, { waitUntil: 'networkidle0' })
await limited.waitForSelector('h2')
check('access: without position 15 the page says Access Denied!', (await limited.$eval('h2', (e) => e.textContent)) === 'Access Denied!')
check('access: and the API refuses with 403', (await get('/api/claim-bordx/recovery/companies', mint(access))).status === 403)

console.log(`screenshots: ${t.shots}`)
const ok = t.summary()
await t.browser.close()
process.exit(ok ? 0 : 1)
