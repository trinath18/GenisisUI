// Contribution Billing > Refund Listing (MCO Refund Listing). Read only, against the real members of the refund views; nothing is written.
import { start, BASE } from './lib.mjs'
import { mint } from './mint.mjs'

const t = await start()
const { page, check } = t

const get = (path, token = mint()) => fetch(`${BASE}${path}`, { headers: { Authorization: `Bearer ${token}` } })
const json = async (path) => (await get(path)).json()
const rowsOf = () =>
  page.$$eval('table[aria-label="MCO refund"] tbody tr', (trs) =>
    trs.map((tr) => [...tr.querySelectorAll('td')].map((td) => td.textContent.trim())).filter((r) => r.length > 2),
  )
const headers = () => page.$$eval('table[aria-label="MCO refund"] thead th', (ths) => ths.map((th) => th.textContent.trim()).filter(Boolean))
const stat = (label) =>
  page.evaluate(
    (l) =>
      [...document.querySelectorAll('.stat')].find((s) => s.querySelector('.stat-label')?.textContent === l)?.querySelector('.stat-value')?.textContent ?? null,
    label,
  )
const money = (n) => n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const q = (o) => new URLSearchParams(Object.entries(o).filter(([, v]) => v !== undefined)).toString()
const R = '/api/contribution-billing/refund-listing'
const range = { dateFrom: '2021-07-01', dateTo: '2021-12-31' }

// ---------------- the API
const noSelection = await get(R)
check(
  'api: a search without a date selection is refused with the desktop message',
  noSelection.status === 400 && (await noSelection.json()).message === 'Please Select Date Selection!',
)
const noPayor = await get(`${R}?dateBy=effective`)
check('api: then without a payor', noPayor.status === 400 && (await noPayor.json()).message === 'Please Select Payor!')
check('api: a payor that is not there is not found', (await get(`${R}?${q({ dateBy: 'effective', payor: 'QQ' })}`)).status === 404)
check('api: an unknown date selection is refused', (await get(`${R}?${q({ dateBy: 'monthly', payor: 'ST' })}`)).status === 400)
const st = await json(`${R}?${q({ dateBy: 'effective', payor: 'ST - x', ...range })}`)
check(
  'api: a payor gives its principals with their supplementary members after them',
  st.principals > 0 && st.supplementary > 0 && st.rows.length === st.principals + st.supplementary,
  `${st.principals}+${st.supplementary}`,
)
check(
  'api: every supplementary member follows the principal with the same member number',
  st.rows.every((r, i) => r.kind === 'principal' || st.rows[i - 1].memberNo === r.memberNo),
)
check(
  'api: the endorsement dates are in the range',
  st.rows.every((r) => r.endtEffDate >= '2021-07-01' && r.endtEffDate < '2022-01-01'),
)
check(
  'api: the total refund adds the principals refunds',
  Math.abs(st.totalRefund - st.rows.filter((r) => r.kind === 'principal').reduce((s, r) => s + (r.mcoRefund ?? 0), 0)) < 0.005,
)
const withUtilised = st.rows.find((r) => r.kind === 'principal' && r.mcoUtilised > 0)
const minimum = withUtilised && ['F', 'H'].length ? 50 : 25
check(
  'api: the refund (Min.) follows the desktop: the fee less the minimum below it, the utilised fee above',
  !withUtilised ||
    Math.abs(withUtilised.mcoRefundMin - (withUtilised.mcoUtilised <= minimum ? withUtilised.mcoFee - minimum : withUtilised.mcoUtilised)) < 0.005,
  JSON.stringify(withUtilised),
)
check(
  'api: a member with cases says so in the remarks',
  st.rows.filter((r) => r.remarks).every((r) => /^This member had \d+ Case\(s\)$/.test(r.remarks)),
)
const printed = await json(`${R}?${q({ dateBy: 'effective', payor: 'ST', ...range, printed: 'Y' })}`)
check('api: members with a credit note are listed apart (none yet)', printed.rows.length === 0)
check(
  'api: an endorsement bordx date after all of them finds nothing',
  (await json(`${R}?${q({ dateBy: 'bordx', payor: 'ST', dateFrom: '2099-01-01' })}`)).rows.length === 0,
)

// ---------------- the screen
await t.go('/contribution-billing/refund-listing')
check('screen: title', (await page.$eval('h2', (e) => e.textContent)) === 'MCO Refund Listing')
check(
  'menu: the Contribution Billing module is in the rail',
  (await page.$$eval('.rail [aria-label]', (els) => els.map((e) => e.getAttribute('aria-label')))).includes('Contribution Billing'),
)
const side = await page.$$eval('.sidebar > *', (els) => els.map((e) => e.textContent.trim()))
check(
  'menu: the unbuilt Contribution Billing screens are disabled and Refund Listing is the link',
  ['Generate Invoice', 'Generate Invoice (Endorsement)', 'MCO Reinstatement'].every((x) => side.includes(x)) &&
    (await page.$$eval('.sidebar a', (a) => a.map((x) => x.textContent.trim()))).join() === 'Refund Listing',
  side.join('|'),
)
check('screen: Print is off until a search found something', await t.isDisabled('Print'))
await t.click('Search', 400)
check('screen: Search without a date selection says so', (await t.errors()).includes('Please Select Date Selection!'), JSON.stringify(await t.errors()))
await t.select('Date Selection', 'effective')
await t.click('Search', 400)
check('screen: then without a payor', (await t.errors()).includes('Please Select Payor!'), JSON.stringify(await t.errors()))
check(
  'screen: the date boxes are named after the selection',
  await page.evaluate(() => [...document.querySelectorAll('label.form-field span')].some((s) => s.textContent.trim() === 'Endt. Eff Date from')),
)
await t.select('Date Selection', 'bordx')
check(
  'screen: and follow it when it changes',
  await page.evaluate(() => [...document.querySelectorAll('label.form-field span')].some((s) => s.textContent.trim() === 'Endt. Bordx Date from')),
)
await t.select('Date Selection', 'effective')
await t.type('Payor', 'ST')
await t.type('Endt. Eff Date from', '01072021')
await t.type('Endt. Eff Date to', '31122021')
await t.click('Search', 2500)
const shown = await rowsOf()
check('screen: Search lists the principals and their supplementary members', shown.length === st.rows.length, `${shown.length} vs ${st.rows.length}`)
check(
  'screen: the headings are the desktop headings with the type of line added',
  JSON.stringify(await headers()) ===
    JSON.stringify([
      'Member No',
      'Cover ID',
      'Policy No',
      'Member Name',
      'I/C No',
      'Bordx Date',
      'Eff. Date',
      'Exp. Date',
      'Days Insured',
      'Cancellation Date',
      'Endt. Bordx Date',
      'Days Utilised',
      'Month Utilised',
      'MCO fees Charged',
      'MCO fees Utilised',
      'MCO fees Refund',
      'MCO fees Refund (Min.)',
      'Invoice No',
      'Invoice Date',
      'Remarks',
      'Credit Note',
      'Credit Date',
      'Type',
    ]),
  JSON.stringify(await headers()),
)
check(
  'screen: the member name carries the status after it',
  shown.some((r) => r[3].endsWith(' (Cancelled)') || r[3].endsWith(' (Pending)')),
  shown[0]?.[3],
)
check(
  'screen: the totals show the principals, the supplementary members and the refund',
  (await stat('Total Principal')) === String(st.principals) &&
    (await stat('Total Supp')) === String(st.supplementary) &&
    (await stat('Total MCO Refund')) === money(st.totalRefund),
  `${await stat('Total MCO Refund')} vs ${money(st.totalRefund)}`,
)
check('screen: Print is on once there are rows', !(await t.isDisabled('Print')))
await t.select('Print Status', 'Y')
await t.click('Search', 1500)
check('screen: members with a credit note: none, so No record found!', await t.toast('No record found!'))
await t.click('Clear', 300)
check('screen: Clear empties the list', (await rowsOf()).length === 0 && (await stat('Total Principal')) === '0')

// ---------------- access: position 21 withheld
const access = '1'.repeat(20) + '0' + '1'.repeat(9)
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
await limited.goto(`${BASE}/contribution-billing/refund-listing`, { waitUntil: 'networkidle0' })
await limited.waitForSelector('h2')
check('access: without position 21 the page says Access Denied!', (await limited.$eval('h2', (e) => e.textContent)) === 'Access Denied!')
check('access: and the API refuses with 403', (await get(`${R}?${q({ dateBy: 'effective', payor: 'ST' })}`, mint(access))).status === 403)

console.log(`screenshots: ${t.shots}`)
const ok = t.summary()
await t.browser.close()
process.exit(ok ? 0 : 1)
