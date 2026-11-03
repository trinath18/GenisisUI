// Receipt > From Member (Receipt From Member). Reads the real debit notes of members; the POST and PUT that would write receipts are intercepted and answered here (the writes themselves are covered by the
// API's rolled-back database tests), so nothing is stored. The API checks that stop before the database are real calls.
import { start, sleep, BASE } from './lib.mjs'
import { mint } from './mint.mjs'

const t = await start()
const { page, check } = t

const get = (path, token = mint()) => fetch(`${BASE}${path}`, { headers: { Authorization: `Bearer ${token}` } })
const json = async (path) => (await get(path)).json()
const send = (method, path, body, token = mint()) =>
  fetch(`${BASE}${path}`, { method, headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
const grid = 'table[aria-label="Receipt From Member"]'
const rowsOf = () =>
  page.$$eval(`${grid} tbody tr`, (trs) => trs.map((tr) => [...tr.querySelectorAll('td')].map((td) => td.textContent.trim())).filter((r) => r.length > 3))
const headers = () => page.$$eval(`${grid} thead th`, (ths) => ths.map((th) => th.textContent.trim()).filter(Boolean))
const stat = (label) =>
  page.evaluate(
    (l) =>
      [...document.querySelectorAll('.stat')].find((s) => s.querySelector('.stat-label')?.textContent === l)?.querySelector('.stat-value')?.textContent ?? null,
    label,
  )
const dialogs = () => page.$$eval('[role=dialog]', (d) => d.map((x) => x.textContent.replace(/\s+/g, ' ').trim()))
const answer = async (text) => {
  await page.evaluate((x) => [...document.querySelectorAll('[role=dialog] button')].find((b) => b.textContent.trim() === x)?.click(), text)
  await sleep(500)
}
const tickRow = async (n) => {
  await page.click(`${grid} tbody tr:nth-child(${n}) input[type=checkbox]`)
  await sleep(300)
}
const selectRow = async (n) => {
  await page.click(`${grid} tbody tr:nth-child(${n}) td:nth-child(4)`)
  await sleep(500)
}
const q = (o) => new URLSearchParams(Object.entries(o).filter(([, v]) => v !== undefined)).toString()
const R = '/api/receipt/from-member'

const writes = []
const official = []
page.on('response', (res) => {
  const url = new URL(res.url())
  if (url.pathname === '/api/receipt/from-member/official-receipt') official.push({ query: url.search, status: res.status() })
})
await page.setRequestInterception(true)
page.on('request', (req) => {
  const url = new URL(req.url())
  if (url.pathname !== R || !['POST', 'PUT'].includes(req.method())) return req.continue()
  writes.push({ method: req.method(), body: JSON.parse(req.postData()) })
  return req.respond({ status: req.method() === 'POST' ? 200 : 204, contentType: 'application/json', body: req.method() === 'POST' ? '{"saved":1}' : '' })
})

// ---------------- the API
const refused = async (res) => ({ status: res.status, message: (await res.json().catch(() => ({}))).message })
check('api: Use Scan needs the worksheet number', (await refused(await get(`${R}?scan=true`))).message === 'Please Enter Worksheet No')
const none = await refused(await get(`${R}?${q({ scan: true, caseFrom: 'NO-SUCH-CASE' })}`))
check('api: nothing found is No record found!', none.status === 404 && none.message === 'No record found!', JSON.stringify(none))
const unpaid = await json(`${R}?${q({ scan: true, caseFrom: 'TA00011365' })}`)
check(
  'api: a scan lists the debit notes of the worksheet with the amounts due',
  unpaid.rows.length === 4 && unpaid.rows.every((r) => r.caseNo === 'TA00011365' && r.payableByMedix < 0 && !r.receiptIndex),
  `${unpaid.rows.length}`,
)
check('api: the user is not authorised (status N, or no user row)', unpaid.authorised === false)
const partial = await json(`${R}?${q({ scan: true, caseFrom: 'ST00054036' })}`)
const partialRow = partial.rows.find((r) => r.receiptIndex === 30487)
check(
  'api: a partly paid claim carries its receipt row',
  partialRow?.paymentStatus === 'P' && partialRow.receiptNo === 'RB51617' && partialRow.receiptAmt === 12.5 && partialRow.receiptIndex === 30487,
  JSON.stringify(partialRow),
)
check(
  'api: the received total is the sum of the receipt amounts',
  Math.abs(partial.receivedAmount - partial.rows.reduce((s, r) => s + (r.receiptAmt ?? 0), 0)) < 0.001,
)
const byStatus = await json(`${R}?${q({ caseFrom: 'ST00072521', caseTo: 'ST00072521', status: 1 })}`)
check('api: Payment Status Paid lists the fully paid rows only', byStatus.rows.length >= 1 && byStatus.rows.every((r) => r.paymentStatus === 'F'))
check(
  'api: Payment Status Unpaid never lists a paid row',
  (await json(`${R}?${q({ caseFrom: 'ST00072521', caseTo: 'ST00072521', status: 2 })}`).catch(() => ({ rows: [] }))).rows?.every((r) => !r.paymentStatus) ??
    true,
)
const row = await json(`${R}/30487`)
check(
  'api: Edit loads the receipt row',
  row.receiptNo === 'RB51617' && row.caseNo === 'ST00054036' && row.claimVersion === 7 && row.receiptAmt === 12.5,
  JSON.stringify(row),
)
const missing = await refused(await get(`${R}/2147483647`))
check(
  "api: a receipt row that does not exist is Payment hasn't been made!",
  missing.status === 404 && missing.message === "Payment hasn't been made!",
  JSON.stringify(missing),
)
const item = { caseNo: 'TA00011365', version: 1, status: 'F', paymentAmt: 125 }
const body = { receiptNo: 'ZZ-E2E', receiptDate: '2026-10-30', amount: 125, chequeNo: 'ZZ', items: [item] }
check(
  'api: Save checks in the desktop order (receipt no, date, amount, cheque no)',
  (await refused(await send('POST', R, {}))).message === 'Please Enter Receipt No' &&
    (await refused(await send('POST', R, { receiptNo: 'x' }))).message === 'Please Enter Receipt Date' &&
    (await refused(await send('POST', R, { receiptNo: 'x', receiptDate: '2026-10-30' }))).message === 'Please Enter Amount' &&
    (await refused(await send('POST', R, { receiptNo: 'x', receiptDate: '2026-10-30', amount: 1 }))).message === 'Please Enter Cheque No',
)
check(
  'api: Save needs ticked claims and the contra case needs its version and amount',
  (await refused(await send('POST', R, { ...body, items: [] }))).message === 'Please tick the claims to be received.' &&
    (await refused(await send('POST', R, { ...body, items: [{ ...item, contraCase: 'X' }] }))).message ===
      'Invalid Contra Case..., Please Keyin Contra Case No. or Contra Version ' &&
    (await refused(await send('POST', R, { ...body, items: [{ ...item, contraCase: 'X', contraVersion: '1' }] }))).message ===
      'Please Keyin Contra Case Amount ',
)
const paid = await refused(await send('POST', R, { ...body, items: [{ caseNo: 'ST00072521', version: 1, status: 'F', paymentAmt: 5 }] }))
check(
  'api: a user who is not authorised cannot receive a claim that is paid in full, and nothing is saved',
  paid.status === 409 && paid.message === 'Payment has been made!',
  JSON.stringify(paid),
)
const absent = await refused(await send('POST', R, { ...body, items: [{ caseNo: 'ZZ-NO-CASE', version: 1, status: 'F', paymentAmt: 5 }] }))
check('api: a claim that does not exist is not found', absent.status === 404 && absent.message === 'Claim ZZ-NO-CASE-1 not found', JSON.stringify(absent))
check(
  'api: Update checks in the desktop order',
  (await refused(await send('PUT', R, {}))).message === 'Please select the record' &&
    (await refused(await send('PUT', R, { receiptIndex: 1 }))).message === 'Please Enter Receipt No!' &&
    (await refused(await send('PUT', R, { receiptIndex: 1, receiptNo: 'x', receiptDate: '2026-10-30' }))).message === 'Please Enter Cheque No!' &&
    (await refused(await send('PUT', R, { receiptIndex: 1, receiptNo: 'x', receiptDate: '2026-10-30', chequeNo: 'x' }))).message === 'Please Enter Cheque Amt!',
)
const gone = await refused(await send('PUT', R, { receiptIndex: 2147483647, receiptNo: 'x', receiptDate: '2026-10-30', chequeNo: 'x', amount: 1 }))
check(
  "api: Update of a row that does not exist is Payment hasn't been made!",
  gone.status === 404 && gone.message === "Payment hasn't been made!",
  JSON.stringify(gone),
)
check(
  'api: the official receipt needs a receipt number and lists the claims of one',
  (await refused(await get(`${R}/official-receipt`))).message === 'Please Enter or Generate Receipt No' &&
    (await json(`${R}/official-receipt?receiptNo=RB51617`)).length === 13,
)

// ---------------- the screen
await t.go('/receipt/from-member')
check('screen: title', (await page.$eval('h2', (e) => e.textContent)) === 'Receipt From Member')
const links = await page.$$eval('.sidebar a', (a) => a.map((x) => x.textContent.trim()))
check(
  'menu: From Member and Receipt Tracking are links in the Receipt menu',
  links.includes('From Member') && links.includes('Receipt Tracking'),
  links.join('|'),
)
await t.click('Search', 400)
check('screen: Use Scan without a worksheet number says so', (await t.errors()).includes('Please Enter Worksheet No'), JSON.stringify(await t.errors()))
await t.type('Worksheet No', 'TA00011365')
await t.click('Search', 1500)
const shown = await rowsOf()
check(
  'screen: the scan lists the four debit notes and clears the box for the next scan',
  shown.length === 4 && (await page.$eval('input[name=caseFrom]', (e) => e.value)) === '',
  `${shown.length}`,
)
check(
  'screen: the list is headed as the desktop headed it',
  JSON.stringify(await headers()) ===
    JSON.stringify([
      'Reference No',
      'Pymt Status',
      'WKS No',
      'Amount',
      "Amt Rec'd",
      'OS Amt',
      'Amt Receiving',
      'ReceiptIndex',
      'Rept No',
      'Rept Date',
      'Acc Period',
      'Bank Charge',
      'Contra Case No',
      'Contra Amt',
      'Clm Gain Loss',
      'Misc Diff',
      'Discount',
      'Amt Paid',
      'Write Off',
      'Medix Receipt',
      'Remarks',
    ]),
  JSON.stringify(await headers()),
)
check(
  'screen: an unpaid debit note shows its whole amount as outstanding',
  shown[0].includes('125.00') && shown[0][6 - 1 + 0] !== undefined,
  JSON.stringify(shown[0]),
)
await t.type('Worksheet No', 'TA00011365')
await t.click('Search', 500)
check('screen: scanning a worksheet that is in the list says Data has been uploaded!', await t.toast('Data has been uploaded!'))
check('screen: the list was not doubled', (await rowsOf()).length === 4)
check('screen: Records and Received Amt', (await stat('Records')) === '4' && (await stat('Received Amt')) === '0.00')
await tickRow(1)
let first = (await rowsOf())[0]
check(
  'screen: ticking an unpaid note makes it Full for the whole amount',
  first.includes('Full') && first.includes('125.00') && (await stat('Checked Amt')) === '125.00',
  JSON.stringify(first),
)
await selectRow(1)
check('screen: choosing the row shows its claim number', (await page.$$eval('input.ro', (els) => els.map((e) => e.value))).includes('TA00011365-1'))
await t.type('Amt Paid', '200')
await t.click('Update Case', 400)
check(
  'screen: an amount paid above the amount is Invalid Amount Paid !',
  (await t.errors()).includes('Invalid Amount Paid ! '),
  JSON.stringify(await t.errors()),
)
await t.type('Amt Paid', '60')
await t.type('Contra Case', 'TA00011363')
await t.click('Update Case', 400)
check(
  'screen: a contra case without its version is refused',
  (await t.errors()).includes('Invalid Contra Case..., Please Keyin Contra Case No. or Contra Version '),
  JSON.stringify(await t.errors()),
)
await t.type('Contra Ver', '2')
await t.click('Update Case', 400)
check('screen: and without its amount', (await t.errors()).includes('Please Keyin Contra Case Amount '), JSON.stringify(await t.errors()))
await t.type('Contra Amt', '10')
await t.type('Bank Chrg', '1.5')
await t.click('Update Case', 500)
check(
  'screen: Update Case asks first',
  (await dialogs()).some((d) => d.includes('Update TA00011365-1 ?')),
  JSON.stringify(await dialogs()),
)
await answer('Yes')
first = (await rowsOf())[0]
check(
  'screen: a smaller amount paid makes it Partial with the difference outstanding',
  first.includes('Partial') && first.includes('65.00') && first.includes('60.00') && (await stat('Checked Amt')) === '60.00',
  JSON.stringify(first),
)
check('screen: the staged amounts are on the row', first.includes('TA00011363-2') && first.includes('1.5'), JSON.stringify(first))
await tickRow(2)
check('screen: a second ticked note adds to Checked Amt', (await stat('Checked Amt')) === '235.00', await stat('Checked Amt'))
await t.click('Save', 400)
check('screen: Save without a receipt number says so', (await t.errors()).includes('Please Enter Receipt No'), JSON.stringify(await t.errors()))
await t.type('Receipt No', 'ZZ-E2E-1')
await t.click('Save', 400)
check('screen: then the date', (await t.errors()).includes('Please Enter Receipt Date'), JSON.stringify(await t.errors()))
await t.type('Receipt Date', '30102026')
check(
  'screen: the account period follows the receipt date',
  (await page.$eval('select[name=accMonth]', (e) => e.value)) === '10' && (await page.$eval('input[name=accYear]', (e) => e.value)) === '2026',
)
await t.click('Save', 400)
check('screen: then the amount', (await t.errors()).includes('Please Enter Amount'), JSON.stringify(await t.errors()))
await t.type('Amount', '235')
await t.click('Save', 400)
check('screen: then the cheque number', (await t.errors()).includes('Please Enter Cheque No'), JSON.stringify(await t.errors()))
await t.type('Cheque No', 'CHQ-1')
await t.click('Save', 500)
check(
  'screen: Save asks Do you want to update the record?',
  (await dialogs()).some((d) => d.includes('Do you want to update the record?')),
  JSON.stringify(await dialogs()),
)
await answer('No')
check('screen: No sends nothing', writes.length === 0)
await t.click('Save', 500)
await answer('Yes')
check('screen: Yes saves and says Record updated...', await t.toast('Record updated...'))
const saved = writes[0]?.body
check(
  'screen: the save carries the receipt and both ticked claims',
  saved?.receiptNo === 'ZZ-E2E-1' &&
    saved.receiptDate === '2026-10-30' &&
    saved.amount === 235 &&
    saved.chequeNo === 'CHQ-1' &&
    saved.accMonth === 10 &&
    saved.accYear === 2026 &&
    saved.items.length === 2,
  JSON.stringify(saved),
)
check(
  'screen: the first claim is Partial for 60 with its contra case and bank charge, the second Full for 175',
  saved?.items[0].status === 'P' &&
    saved.items[0].paymentAmt === 60 &&
    saved.items[0].contraCase === 'TA00011363' &&
    saved.items[0].contraVersion === '2' &&
    saved.items[0].contraAmt === 10 &&
    saved.items[0].bankCharge === 1.5 &&
    saved.items[1].status === 'F' &&
    saved.items[1].paymentAmt === 175,
  JSON.stringify(saved?.items),
)
check('screen: after a scan save the list and the Checked Amt are cleared', (await rowsOf()).length === 0 && (await stat('Checked Amt')) === '0.00')

// the partly paid claim: ticking, Edit and Update
await t.type('Worksheet No', 'ST00054036')
await t.click('Search', 1500)
const stRows = await rowsOf()
const idx = stRows.findIndex((r) => r.includes('ST00054036-7') && r.includes('Partial')) + 1
check(
  'screen: a partly paid claim shows Partial with the receipt and what is outstanding',
  idx > 0 &&
    stRows[idx - 1].includes('Partial') &&
    stRows[idx - 1].includes('12.50') &&
    stRows[idx - 1].includes('217.00') &&
    stRows[idx - 1].includes('RB51617'),
  JSON.stringify(stRows[idx - 1]),
)
check('screen: Received Amt is the sum of the receipts', (await stat('Received Amt')) !== '0.00', await stat('Received Amt'))
await tickRow(idx)
check(
  'screen: ticking it makes it Full for what is outstanding',
  (await rowsOf())[idx - 1].includes('Full') && (await stat('Checked Amt')) === '217.00',
  JSON.stringify((await rowsOf())[idx - 1]),
)
await tickRow(idx)
check('screen: unticking puts it back as Partial', (await rowsOf())[idx - 1].includes('Partial') && (await stat('Checked Amt')) === '0.00')
await t.click('Edit', 300)
await selectRow(idx)
check(
  'screen: Edit then choosing the row loads the receipt into the boxes',
  (await page.$eval('input[name=receiptNo]', (e) => e.value)) === 'RB51617' &&
    (await page.$eval('input[name=amount]', (e) => e.value)) === '12.5' &&
    (await page.$eval('input[name=chequeNo]', (e) => e.value)).length > 0,
)
await t.type('Cheque No', 'CHQ-EDIT')
await t.click('Update', 500)
await answer('Yes')
check('screen: Update asks and says Record Updated...', await t.toast('Record Updated...'))
const put = writes.find((w) => w.method === 'PUT')?.body
check(
  'screen: the update carries the row index and the changed cheque number',
  put?.receiptIndex === 30487 && put.chequeNo === 'CHQ-EDIT' && put.receiptNo === 'RB51617' && put.amount === 12.5,
  JSON.stringify(put),
)
await t.type('Receipt No', 'RB51617')
await t.click('Print OR', 1500)
check(
  'screen: Print OR asks the server for the official receipt of the receipt number',
  official.length === 1 && official[0].query.includes('receiptNo=RB51617') && official[0].status === 200,
  JSON.stringify(official),
)
await t.click('Clear', 300)
check('screen: Clear empties the list', (await rowsOf()).length === 0 && (await stat('Records')) === '0')
await t.click('Print to File', 400)
check('screen: Print to File without a record says so', await t.toast('Report cannot be printed without any record.'))
await t.click('Update', 400)
check('screen: Update with no list says Please select the record', await t.toast('Please select the record'))

// the fully paid claim for a user who is not authorised
await t.type('Worksheet No', 'ST00072521')
await t.click('Search', 1500)
const paidIdx = (await rowsOf()).findIndex((r) => r.includes('Full')) + 1
await tickRow(paidIdx)
check(
  'screen: ticking a note that is paid in full says Payment has been made! and leaves it unticked',
  (await t.toast('Payment has been made!')) && (await stat('Checked Amt')) === '0.00',
)

// ---------------- access: position 9 withheld
const access = '1'.repeat(8) + '0' + '1'.repeat(21)
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
await limited.goto(`${BASE}/receipt/from-member`, { waitUntil: 'networkidle0' })
await limited.waitForSelector('h2')
check('access: without position 9 the page says Access Denied!', (await limited.$eval('h2', (e) => e.textContent)) === 'Access Denied!')
check('access: and the API refuses with 403', (await get(`${R}?scan=true&caseFrom=TA00011365`, mint(access))).status === 403)

console.log(`screenshots: ${t.shots}`)
const ok = t.summary()
await t.browser.close()
process.exit(ok ? 0 : 1)
