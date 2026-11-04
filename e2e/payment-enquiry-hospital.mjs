// Payment > Enquiry > Payment To Hospital. Read only: the claims payable to hospitals and what has been paid.
import { start, sleep, BASE } from './lib.mjs'
import { mint } from './mint.mjs'

const t = await start()
const { page, check } = t

const get = (path, token = mint()) => fetch(`${BASE}${path}`, { headers: { Authorization: `Bearer ${token}` } })
const json = async (path) => (await get(path)).json()
const D = '/api/payment/enquiry-hospital'
const headers = () => page.$$eval('table thead th', (ths) => ths.map((th) => th.textContent.trim()).filter(Boolean))
const rowsOf = () =>
  page.$$eval('table tbody tr', (trs) => trs.map((tr) => [...tr.querySelectorAll('td')].map((td) => td.textContent.trim())).filter((r) => r.length > 2))
const stat = (label) =>
  page.evaluate(
    (l) =>
      [...document.querySelectorAll('.stat')].find((s) => s.querySelector('.stat-label')?.textContent === l)?.querySelector('.stat-value')?.textContent ?? null,
    label,
  )

// ---------------- the API
const lookups = await json(`${D}/lookups`)
check(
  'api: the hospitals, payors and health types',
  lookups.hospitals.length > 100 && lookups.payors.length > 10 && lookups.healthTypes.length >= 2 && !!lookups.hospitals[0].code,
  `${lookups.hospitals.length}/${lookups.payors.length}/${lookups.healthTypes.length}`,
)
const one = await json(`${D}?scanCase=AC00000644`)
check(
  'api: a claim with its payment, cheque, receipt and amounts',
  one.rows.length >= 1 &&
    one.rows[0].caseNo === 'AC00000644' &&
    one.rows[0].payStatus === 'F' &&
    one.rows[0].pvNo === 'CB00106720' &&
    one.rows[0].chequeNo === '01032021' &&
    one.rows[0].payable === 91,
  JSON.stringify(one.rows[0]),
)
check(
  'api: the total is the sum payable of the rows',
  Math.abs(one.totalPayable - one.rows.reduce((s, r) => s + (r.payable ?? 0), 0)) < 0.01 && one.truncated === false,
)
const byPv = await json(`${D}?pvNoFrom=CB00106720&pvNoTo=CB00106720`)
check('api: a PV number', byPv.rows.length >= 1 && byPv.rows.every((r) => r.pvNo === 'CB00106720'), `${byPv.rows.length}`)
const byPayor = await json(`${D}?payor=AC&caseFrom=AC00000644&caseTo=AC00000700&wsStatus=AA`)
check(
  'api: a payor, a claim range and a claimability',
  byPayor.rows.length >= 1 && byPayor.rows.every((r) => r.caseNo >= 'AC00000644' && r.caseNo <= 'AC00000700' && r.wsStatus === 'AA'),
  `${byPayor.rows.length}`,
)
const unpaid = await json(`${D}?payment=2&caseFrom=AC00000644&caseTo=AC00009999`).catch(() => ({ rows: [] }))
check(
  'api: an unpaid claim has the whole amount outstanding and no payment total',
  unpaid.rows.every((r) => !r.payStatus && r.os === r.payable && r.paidTotal === null),
  `${unpaid.rows.length}`,
)
const none = await get(`${D}?scanCase=ZZZZZZZZ`)
check('api: nothing found is No record found!', none.status === 404 && (await none.json()).message === 'No record found!')
check('api: a wrong payment status is refused', (await (await get(`${D}?payment=6`)).json()).message === 'Select a valid Pymt Status.')
check('api: a wrong claimability is refused', (await (await get(`${D}?wsStatus=ZZ`)).json()).message === 'Select a valid WS Claimability.')
const hostile = await get(`${D}?invNo=${encodeURIComponent("x'; DROP TABLE dbo.PAY;--")}`)
check('api: criteria are typed (a quote is only text)', hostile.status === 404 && (await hostile.json()).message === 'No record found!')

// ---------------- the screen
await t.go('/payment/enquiry-hospital')
check('screen: title', (await page.$eval('h2', (e) => e.textContent)) === 'Enquiry Payment to Hospital')
const menu = await page.$$eval('.sidebar a', (a) => a.map((x) => x.textContent.trim()))
check('menu: Payment lists Payment To Hospital as a link', menu.includes('Payment To Hospital'), menu.join('|'))
check(
  'screen: Use Scan is on, Pymt Status is 0 - All, Stop is off and nothing is listed',
  (await page.$eval('input[name=scan]', (e) => e.checked)) &&
    (await page.$eval('select[name=payment]', (e) => e.value)) === '0' &&
    (await t.isDisabled('Stop')) &&
    (await stat('Records')) === '0',
)
await t.click('Search', 400)
check('screen: Search in Use Scan asks for the worksheet number', await t.toast('Please Enter Worksheet No'))
await t.type('Clm No', 'AC00000644')
await t.click('Search', 1500)
const shown = await rowsOf()
check(
  'screen: a scanned claim is listed with the desktop headings',
  shown.length >= 1 &&
    (await headers()).length === 26 &&
    (await headers())[0] === 'Pymt Status' &&
    (await headers())[25] === 'SUN PVDate' &&
    shown[0][0] === 'Full' &&
    shown[0][8] === 'AC00000644-1' &&
    shown[0][16] === 'CB00106720',
  JSON.stringify(shown[0]),
)
check(
  'screen: Records and Pay Hosp Amt are shown',
  (await stat('Records')) === String(shown.length) && (await stat('Pay Hosp Amt')) === '91.00',
  `${await stat('Records')} ${await stat('Pay Hosp Amt')}`,
)
await t.type('Clm No', 'AC00000644')
await t.click('Search', 600)
check('screen: scanning it again says Data has been uploaded!', await t.toast('Data has been uploaded!'))
check('screen: and does not add it twice', (await rowsOf()).length === shown.length)
await t.type('Clm No', 'AC00000855')
await t.click('Search', 1500)
check(
  'screen: another claim is added to the list',
  (await rowsOf()).length > shown.length && (await rowsOf()).some((r) => r[8].startsWith('AC00000855-')),
  `${(await rowsOf()).length}`,
)
await t.type('Clm No', 'LOM001')
await t.click('Search', 800)
check('screen: a scan code that starts with LO opens that screen', page.url().endsWith('/membership/registration'), page.url())
await t.go('/payment/enquiry-hospital')

await t.checkbox('Use Scan')
await t.select('Pymt Status', '1')
await t.type('Clm No from', 'AC00000644')
await t.type('Clm No to', 'AC00000700')
await t.click('Search', 1500)
const ranged = await rowsOf()
check(
  'screen: with Use Scan off a claim range lists the claims of it',
  ranged.length >= 1 && ranged.every((r) => r[0] === 'Full' && r[8] >= 'AC00000644' && r[8] <= 'AC00000700-9'),
  `${ranged.length}`,
)
await t.click('Print to File', 300)
check('screen: Print to File writes the list', !(await t.toasts()).includes('Report cannot be printed without any record.'))
await t.click('Clear', 300)
check(
  'screen: Clear empties the list and turns Use Scan on again',
  (await rowsOf()).length === 0 && (await stat('Records')) === '0' && (await page.$eval('input[name=scan]', (e) => e.checked)),
)
await t.click('Print to File', 400)
check('screen: Print to File without a record says so', await t.toast('Report cannot be printed without any record.'))
await t.type('Clm No', 'ZZZZZZZZ')
await t.click('Search', 1500)
check('screen: nothing found says No record found!', await t.toast('No record found!'))
await sleep(200)

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
await limited.goto(`${BASE}/payment/enquiry-hospital`, { waitUntil: 'networkidle0' })
await limited.waitForSelector('h2')
check('access: without position 12 the page says Access Denied!', (await limited.$eval('h2', (e) => e.textContent)) === 'Access Denied!')
check('access: and the API refuses with 403', (await get(`${D}/lookups`, mint(access))).status === 403)

console.log(`screenshots: ${t.shots}`)
const done = t.summary()
await t.browser.close()
process.exit(done ? 0 : 1)
