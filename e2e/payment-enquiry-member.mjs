// Payment > Enquiry > Payment To Member. Read only: the claims with a debit / credit note and their payments, their receipts and the payments that were reissued.
import { start, sleep, BASE } from './lib.mjs'
import { mint } from './mint.mjs'

const t = await start()
const { page, check } = t

const get = (path, token = mint()) => fetch(`${BASE}${path}`, { headers: { Authorization: `Bearer ${token}` } })
const json = async (path) => (await get(path)).json()
const D = '/api/payment/enquiry-member'
const rowsOf = () =>
  page.$$eval('table tbody tr', (trs) => trs.map((tr) => [...tr.querySelectorAll('td')].map((td) => td.textContent.trim())).filter((r) => r.length > 2))
const panelRows = async (name) => {
  await t.tab(name)
  await sleep(200)
  return rowsOf()
}
const stat = (label) =>
  page.evaluate(
    (l) =>
      [...document.querySelectorAll('.stat')].find((s) => s.querySelector('.stat-label')?.textContent === l)?.querySelector('.stat-value')?.textContent ?? null,
    label,
  )

// ---------------- the API
const lookups = await json(`${D}/lookups`)
check(
  'api: the payors and the health types',
  lookups.payors.length > 10 && lookups.healthTypes.length >= 2,
  `${lookups.payors.length}/${lookups.healthTypes.length}`,
)
const one = await json(`${D}?caseNo=AC00000644`)
check(
  'api: a claim with its debit / credit note, payments and totals',
  one.payments.length >= 1 &&
    one.payments.every((p) => p.caseNo === 'AC00000644' && p.crNo) &&
    Math.abs(one.totalPayable - one.payments.reduce((s, p) => s + (p.payable ?? 0), 0)) < 0.01,
  JSON.stringify(one.payments[0]),
)
const unpaid = await json(`${D}?caseNo=AC00000096&version=1`)
check(
  'api: an unpaid claim has the whole amount outstanding and no payment total',
  unpaid.payments.length === 1 &&
    !unpaid.payments[0].payStatus &&
    unpaid.payments[0].os === unpaid.payments[0].payable &&
    unpaid.payments[0].paidTotal === null &&
    unpaid.payments[0].memberName === 'ZICO YEAP YUWAN BIN JEFERY',
  JSON.stringify(unpaid.payments[0]),
)
const reissued = await json(`${D}?caseNo=ST00073162&version=1`)
check(
  'api: a reissued payment is in the reissue list',
  reissued.reissues.length >= 1 && reissued.reissues.every((r) => r.pvStatus === 'R') && reissued.reissues[0].pvNo === 'CB00111427',
  JSON.stringify(reissued.reissues[0]),
)
const withReceipt = await json(`${D}?caseNo=AC00001595&version=1`)
check(
  'api: the receipts of the claims come as a line for each receipt',
  withReceipt.receipts.length >= 1 && withReceipt.receipts.every((r) => ['MNRB', 'PAY', 'MBM'].includes(r.kind) && r.receiptNo && r.caseNo === 'AC00001595'),
  JSON.stringify(withReceipt.receipts[0]),
)
const byName = await json(`${D}?mbmName=ZICO&payment=2`)
check(
  'api: a member name and an unpaid status',
  byName.payments.length >= 1 && byName.payments.every((p) => p.memberName.includes('ZICO') && !p.payStatus),
  `${byName.payments.length}`,
)
const none = await get(`${D}?caseNo=ZZZZZZZZ`)
check('api: nothing found is No record found!', none.status === 404 && (await none.json()).message === 'No record found!')
check('api: a wrong payment status is refused', (await (await get(`${D}?payment=9`)).json()).message === 'Select a valid Pymt Status.')
check('api: a wrong month is refused', (await (await get(`${D}?monthFrom=13`)).json()).message === 'A/C Period Mth must be 1 to 12.')
const hostile = await get(`${D}?mbmName=${encodeURIComponent("x'; DROP TABLE dbo.PAY;--")}`)
check('api: criteria are typed (a quote is only text)', hostile.status === 404 && (await hostile.json()).message === 'No record found!')

// ---------------- the screen
await t.go('/payment/enquiry-member')
check('screen: title', (await page.$eval('h2', (e) => e.textContent)) === 'Enquiry Payment to Member')
const menu = await page.$$eval('.sidebar a', (a) => a.map((x) => x.textContent.trim()))
check('menu: Payment lists Payment To Member as a link', menu.includes('Payment To Member'), menu.join('|'))
check(
  'screen: Use Scan is on, Stop is off, nothing is listed',
  (await page.$eval('input[name=scan]', (e) => e.checked)) && (await t.isDisabled('Stop')) && (await stat('Records')) === '0',
)
const tabs = await page.$$eval('[role=tab]', (x) => x.map((e) => e.textContent.trim()))
check('screen: three lists: Payment To Member, Receipts and Reissue', tabs.join('|') === 'Payment To Member|Receipts|Reissue', tabs.join('|'))
await t.click('Search', 400)
check('screen: Search in Use Scan asks for the worksheet number', await t.toast('Please Enter Worksheet No'))
await t.type('Case No', 'AC00000096')
await t.type('Ver', '1')
await t.click('Search', 1500)
const shown = await panelRows('Payment To Member')
check(
  'screen: a scanned claim is listed with the desktop headings and the sums',
  shown.length === 1 &&
    shown[0][0] === 'CAC00033' &&
    shown[0][1] === 'Unpaid' &&
    shown[0][4] === 'AC00000096-1' &&
    shown[0][5] === '1,000.00' &&
    shown[0][7] === '1,000.00',
  JSON.stringify(shown[0]),
)
check(
  'screen: Records, Pay2MBM Amt and Amt Paid are shown',
  (await stat('Records')) === '1' && (await stat('Pay2MBM Amt')) === '1,000.00' && (await stat('Amt Paid')) === '0.00',
  `${await stat('Records')} ${await stat('Pay2MBM Amt')} ${await stat('Amt Paid')}`,
)
await t.type('Case No', 'AC00000096')
await t.click('Search', 600)
check('screen: scanning it again says Data has been uploaded!', await t.toast('Data has been uploaded!'))
await t.type('Case No', 'ST00073162')
await t.type('Ver', '1')
await t.click('Search', 1500)
check('screen: another claim is added to the list', (await panelRows('Payment To Member')).length >= 2)
const reissue = await panelRows('Reissue')
check(
  'screen: the Reissue list shows the payment that was reissued',
  reissue.length >= 1 && reissue[0][1] === 'ST00073162-1' && reissue[0][4] === 'CB00111427',
  JSON.stringify(reissue[0]),
)
const receiptsShown = await panelRows('Receipts')
check(
  'screen: the Receipts list has its headings',
  (await page.$$eval('table thead th', (t2) => t2.map((x) => x.textContent.trim()))).includes('Receipt From') && Array.isArray(receiptsShown),
)
await t.type('Case No', 'LOM001')
await t.click('Search', 800)
check('screen: a scan code that starts with LO opens that screen', page.url().endsWith('/membership/registration'), page.url())
await t.go('/payment/enquiry-member')

await t.checkbox('Use Scan')
await t.type('Member Name', 'ZICO')
await t.select('Pymt Status', '2')
await t.click('Search', 1500)
check('screen: with Use Scan off the boxes find the claims of a member', (await panelRows('Payment To Member')).length >= 1)
await t.click('Print to File', 300)
check('screen: Print to File writes the list', !(await t.toasts()).includes('Report cannot be printed without any record.'))
await t.click('Clear', 300)
check(
  'screen: Clear empties the lists and turns Use Scan on again',
  (await panelRows('Payment To Member')).length === 0 && (await stat('Records')) === '0' && (await page.$eval('input[name=scan]', (e) => e.checked)),
)
await t.click('Print to File', 400)
check('screen: Print to File without a record says so', await t.toast('Report cannot be printed without any record.'))
await t.type('Case No', 'ZZZZZZZZ')
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
await limited.goto(`${BASE}/payment/enquiry-member`, { waitUntil: 'networkidle0' })
await limited.waitForSelector('h2')
check('access: without position 12 the page says Access Denied!', (await limited.$eval('h2', (e) => e.textContent)) === 'Access Denied!')
check('access: and the API refuses with 403', (await get(`${D}/lookups`, mint(access))).status === 403)

console.log(`screenshots: ${t.shots}`)
const done = t.summary()
await t.browser.close()
process.exit(done ? 0 : 1)
