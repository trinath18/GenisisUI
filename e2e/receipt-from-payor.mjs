// Receipt > Payor (Receipt From Payor). Reads the real bordx and claims; the POST, PUT and remove that would write receipts are intercepted and answered here (the writes themselves are covered by the API's
// rolled-back database tests), so nothing is stored. The API checks that stop before the database are real calls.
import { start, sleep, BASE } from './lib.mjs'
import { mint } from './mint.mjs'

const t = await start()
const { page, check } = t

const get = (path, token = mint()) => fetch(`${BASE}${path}`, { headers: { Authorization: `Bearer ${token}` } })
const json = async (path) => (await get(path)).json()
const send = (method, path, body, token = mint()) =>
  fetch(`${BASE}${path}`, { method, headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
const grid = 'table[aria-label="Receipt From Payor"]'
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
const bodyText = () => page.evaluate(() => document.body.innerText)
const answer = async (text) => {
  await page.evaluate((x) => [...document.querySelectorAll('[role=dialog] button')].find((b) => b.textContent.trim() === x)?.click(), text)
  await sleep(500)
}
const tickRow = async (n) => {
  await page.click(`${grid} tbody tr:nth-child(${n}) input[type=checkbox]`)
  await sleep(300)
}
const selectRow = async (n) => {
  await page.click(`${grid} tbody tr:nth-child(${n}) td:nth-child(3)`)
  await sleep(500)
}
const toggleScan = async () => {
  await page.click('input[name=scan]')
  await sleep(300)
}
const q = (o) => new URLSearchParams(Object.entries(o).filter(([, v]) => v !== undefined)).toString()
const R = '/api/receipt/from-payor'

const writes = []
await page.setRequestInterception(true)
page.on('request', (req) => {
  const url = new URL(req.url())
  const write = url.pathname === R && ['POST', 'PUT'].includes(req.method())
  const remove = url.pathname === `${R}/remove` && req.method() === 'POST'
  if (write || remove) {
    writes.push({ method: req.method(), path: url.pathname, body: JSON.parse(req.postData()) })
    if (remove) return req.respond({ status: 200, contentType: 'application/json', body: '{"deleted":1}' })
    return req.respond({
      status: req.method() === 'POST' ? 200 : 204,
      contentType: 'application/json',
      body: req.method() === 'POST' ? '{"receiptNo":"RB99999","saved":1}' : '',
    })
  }
  if (url.pathname === R && req.method() === 'GET' && url.searchParams.get('recFrom') === 'RB99999')
    return req.respond({
      status: 200,
      contentType: 'application/json',
      body: '{"bordx":[],"worksheets":[],"totalAmount":0,"totalReceived":0,"authorised":false,"truncated":false}',
    })
  return req.continue()
})

// ---------------- the API
const refused = async (res) => ({ status: res.status, message: (await res.json().catch(() => ({}))).message })
check(
  'api: Use Scan needs a bordx or a worksheet',
  (await refused(await get(`${R}?scan=true`))).message === 'Please Enter Bordx No' &&
    (await refused(await get(`${R}?scan=true&mode=worksheet`))).message === 'Please Enter Worksheet No',
)
const none = await refused(await get(`${R}?${q({ scan: true, bordxFrom: 'NO-SUCH-BORDX' })}`))
check('api: nothing found is No record found!', none.status === 404 && none.message === 'No record found!', JSON.stringify(none))
const unreceived = await json(`${R}?${q({ scan: true, bordxFrom: 'NWK0022102' })}`)
check(
  'api: a bordx not yet received lists with its amount and nothing received',
  unreceived.bordx.length === 1 && unreceived.bordx[0].bordxAmount === 3003.12 && !unreceived.bordx[0].receiptNo && unreceived.totalAmount === 3003.12,
  JSON.stringify(unreceived.bordx),
)
check('api: the user is not authorised (status N, or no user row)', unreceived.authorised === false)
const partial = await json(`${R}?${q({ scan: true, bordxFrom: 'NWK0022265' })}`)
check(
  'api: a partly received bordx carries its status, receipt and amount received',
  partial.bordx[0].bordxStatus === 'P' && partial.bordx[0].receiptNo === 'RB54712' && partial.bordx[0].received === 242.5,
  JSON.stringify(partial.bordx[0]),
)
const claims = await json(`${R}?${q({ mode: 'worksheet', scan: true, wsFrom: 'WK00009914' })}`)
const claim5 = claims.worksheets.find((c) => c.claimVersion === 5)
check(
  'api: a claim lists with its patient, receipt row and the amount all its receipts add up to',
  claim5?.receiptIndex === 1046428 && claim5.received === 242.5 && claim5.amount === 416.3 && !!claim5.patientName,
  JSON.stringify(claim5),
)
check(
  'api: Bordx Status Not Received never lists a bordx with a receipt',
  (await json(`${R}?${q({ bordxFrom: 'NWK0022265', bordxTo: 'NWK0022265', status: 2 })}`).catch(() => ({ bordx: [] }))).bordx?.every((b) => !b.receiptNo) ??
    true,
)
check('api: the group companies of a payor', (await json(`${R}/group-companies?payor=WK`)).length >= 1)
const body = { mode: 'bordx', receiptAmt: 3003.12, checkedAmount: 3003.12, chequeNo: 'ZZ', receiptDate: '2026-10-30', bordxNos: ['NWK0022102'] }
check(
  'api: Save checks in the desktop order',
  (await refused(await send('POST', R, {}))).message === 'Please select at least one record to be updated! ' &&
    (await refused(await send('POST', R, { bordxNos: ['B'] }))).message === 'Please Enter Receipt Amt!' &&
    (await refused(await send('POST', R, { bordxNos: ['B'], receiptAmt: 1 }))).message === 'Please Enter Cheque No!' &&
    (await refused(await send('POST', R, { bordxNos: ['B'], receiptAmt: 1, chequeNo: 'x' }))).message === 'Please Enter Receipt Date' &&
    (await refused(await send('POST', R, { bordxNos: ['B'], receiptAmt: 1, chequeNo: 'x', receiptDate: '2026-10-30', checkedAmount: 2 }))).message ===
      'Please Enter Remark!',
)
const part = await refused(await send('POST', R, { ...body, bordxNos: ['NWK0022265'], receiptAmt: 242.5, checkedAmount: 242.5 }))
check(
  'api: a partly received bordx is refused and nothing is saved',
  part.status === 409 && part.message === 'Record has been Partial Paid ! Please Pay by Receipt Type - Worksheet !',
  JSON.stringify(part),
)
const paid = await refused(await send('POST', R, { ...body, bordxNos: ['NWK0024320'], receiptAmt: 860.2, checkedAmount: 860.2 }))
check(
  'api: a bordx received in full is refused to a user who is not authorised',
  paid.status === 409 && paid.message === 'Record has been paid !',
  JSON.stringify(paid),
)
const absent = await refused(await send('POST', R, { ...body, bordxNos: ['NO-SUCH-BORDX'] }))
check('api: a bordx that does not exist is not found', absent.status === 404 && absent.message === 'Bordx NO-SUCH-BORDX not found', JSON.stringify(absent))
const wsBody = {
  mode: 'worksheet',
  receiptAmt: 5,
  checkedAmount: 5,
  chequeNo: 'ZZ',
  receiptDate: '2026-10-30',
  items: [{ caseNo: 'WK00010007', version: 1, bordxNo: 'NWK0022102', status: 'P', paymentAmt: 5, contraCase: 'X' }],
}
check(
  'api: the contra case needs its version and amount',
  (await refused(await send('POST', R, wsBody))).message === 'Invalid Contra Case..., Please Keyin Contra Case No. or Contra Version ' &&
    (await refused(await send('POST', R, { ...wsBody, items: [{ ...wsBody.items[0], contraVersion: '1' }] }))).message === 'Please Keyin Contra Case Amount ',
)
check(
  'api: Update checks in the desktop order',
  (await refused(await send('PUT', R, {}))).message === 'Please select the record' &&
    (await refused(await send('PUT', R, { mode: 'bordx', bordxNos: ['B'], receiptNo: 'R' }))).message === 'Please Enter Rec Amt!',
)
check(
  'api: Remove checks the bordx or the claim',
  (await refused(await send('POST', `${R}/remove`, {}))).message === 'Please Select Bordx to delete!' &&
    (await refused(await send('POST', `${R}/remove`, { mode: 'worksheet' }))).message === 'Please Select Claim to delete!',
)
const nothing = await refused(await send('POST', `${R}/remove`, { mode: 'worksheet', caseNo: 'ZZ-NO-CASE', version: 1 }))
check(
  'api: Remove with nothing to delete is not found and changes nothing',
  nothing.status === 404 && nothing.message === 'No receipt to delete.',
  JSON.stringify(nothing),
)
check(
  'api: the official receipt needs a receipt number and lists the bordx of one',
  (await refused(await get(`${R}/official-receipt`))).message === 'Please Enter or Generate Receipt No' &&
    (await json(`${R}/official-receipt?receiptNo=RB54712`)).length >= 1,
)

// ---------------- the screen: By Bordx
await t.go('/receipt/from-payor')
check('screen: title', (await page.$eval('h2', (e) => e.textContent)) === 'Receipt From Payor')
const links = await page.$$eval('.sidebar a', (a) => a.map((x) => x.textContent.trim()))
check(
  'menu: Payor, From Member and Receipt Tracking are links in the Receipt menu',
  ['Payor', 'From Member', 'Receipt Tracking'].every((x) => links.includes(x)),
  links.join('|'),
)
await toggleScan()
await t.click('Search', 400)
check('screen: Use Scan without a bordx number says so', (await t.errors()).includes('Please Enter Bordx No'), JSON.stringify(await t.errors()))
await t.type('Bordx No', 'NWK0022102')
await t.click('Search', 1500)
const shown = await rowsOf()
check(
  'screen: the scan lists the bordx and clears the box for the next scan',
  shown.length === 1 && (await page.$eval('input[name=bordxFrom]', (e) => e.value)) === '',
  JSON.stringify(shown),
)
check(
  'screen: the list is headed as the desktop headed it',
  JSON.stringify(await headers()) ===
    JSON.stringify([
      'Status',
      'Bordx No',
      'Bordx Amt',
      'Receipt Amt',
      'OS Amt',
      'Paying',
      'OrgStatus',
      'PVNo',
      'PVDate',
      'ReceiptNo',
      'ReceiptDate',
      'AC Period',
      'ReceiptChq',
      'PVRemark',
      'ChqAmt',
      'BordxDate',
      'RecInd',
      'Group Company',
      'Policy Number',
    ]),
  JSON.stringify(await headers()),
)
check('screen: Tot. Bordx Amt and Records', (await stat('Tot. Bordx Amt')) === '3,003.12' && (await stat('Records')) === '1')
await t.type('Bordx No', 'NWK0022102')
await t.click('Search', 500)
check('screen: scanning a bordx that is in the list says Data has been uploaded!', await t.toast('Data has been uploaded!'))
await t.click('Save', 400)
check('screen: Save with nothing ticked says so', await t.toast('Please select at least one record to be updated!'))
await tickRow(1)
check(
  'screen: ticking pays what is outstanding and the Checked Amt follows',
  (await rowsOf())[0].includes('Full') && (await rowsOf())[0].includes('3,003.12') && (await stat('Checked Amt')) === '3,003.12',
  JSON.stringify((await rowsOf())[0]),
)
await t.click('Save', 400)
check('screen: Save checks the receipt amount first', (await t.errors()).includes('Please Enter Receipt Amt!'), JSON.stringify(await t.errors()))
await t.type('Rec Amt', '3000')
await t.click('Save', 400)
check('screen: then the cheque number', (await t.errors()).includes('Please Enter Cheque No!'), JSON.stringify(await t.errors()))
await t.type('Cheque No', 'CHQ-1')
await t.click('Save', 400)
check('screen: then the receipt date', (await t.errors()).includes('Please Enter Receipt Date'), JSON.stringify(await t.errors()))
await t.type('Date', '30102026')
check(
  'screen: the account period follows the date',
  (await page.$eval('select[name=accMonth]', (e) => e.value)) === '10' && (await page.$eval('input[name=accYear]', (e) => e.value)) === '2026',
)
await t.click('Save', 400)
check('screen: an amount that is not the checked amount needs a remark', (await t.errors()).includes('Please Enter Remark!'), JSON.stringify(await t.errors()))
await t.type('Remark', 'short paid')
await t.click('Save', 1200)
check('screen: Save says Record Saved... with the receipt number the server gave', await t.toast('Record Saved... Receipt RB99999'))
const saved = writes.find((w) => w.method === 'POST' && w.path === R)?.body
check(
  'screen: the save carries the bordx and the receipt',
  saved?.mode === 'bordx' &&
    saved.bordxNos.join() === 'NWK0022102' &&
    saved.receiptAmt === 3000 &&
    saved.chequeNo === 'CHQ-1' &&
    saved.receiptDate === '2026-10-30' &&
    saved.checkedAmount === 3003.12 &&
    saved.remark === 'short paid' &&
    saved.accMonth === 10 &&
    saved.accYear === 2026,
  JSON.stringify(saved),
)

// a partly received bordx cannot be ticked
await t.click('Clear', 300)
await toggleScan()
await t.type('Bordx No', 'NWK0022265')
await t.click('Search', 1500)
await tickRow(1)
check(
  'screen: a partly received bordx says to pay it by worksheet and stays unticked',
  (await bodyText()).includes('Record has been Partial Paid !') && (await stat('Checked Amt')) === '0.00',
)
await selectRow(1)
check(
  'screen: choosing the bordx shows its receipt in the boxes',
  (await page.$eval('input[name=chequeNo]', (e) => e.value)) === 'ONLINE' && (await page.$eval('input[name=receiptAmt]', (e) => e.value)) === '50760.07',
)
await t.click('Print OR', 1500)
const official = await json(`${R}/official-receipt?receiptNo=RB54712`)
check('screen: Print OR needs the receipt number in the box and the server has the lines', official.length >= 1)

// ---------------- the screen: By Worksheet
await t.select('Receipt Type', 'worksheet')
await toggleScan()
await t.click('Search', 400)
check('screen: By Worksheet needs a worksheet number to scan', (await t.errors()).includes('Please Enter Worksheet No'), JSON.stringify(await t.errors()))
await t.type('Worksheet No', 'WK00010007')
await t.click('Search', 1500)
const wsRows = await rowsOf()
check(
  'screen: the claim lists with its patient and the amount outstanding',
  wsRows.length === 1 && wsRows[0].includes('WK00010007-1') && wsRows[0].includes('3,003.12'),
  JSON.stringify(wsRows),
)
await tickRow(1)
await selectRow(1)
check('screen: ticking a claim pays what is outstanding', (await stat('Checked Amt')) === '3,003.12' && (await rowsOf())[0].includes('Full'))
await t.type('Contra Case', 'WK00010008')
await t.click('Update Case', 400)
check(
  'screen: a contra case without its version is refused',
  (await t.errors()).includes('Invalid Contra Case..., Please Keyin Contra Case No. or Contra Version '),
  JSON.stringify(await t.errors()),
)
await t.type('Contra Ver', '1')
await t.click('Update Case', 400)
check('screen: and without its amount', (await t.errors()).includes('Please Keyin Contra Case Amount '), JSON.stringify(await t.errors()))
await t.type('Contra Amt', '10')
await t.type('Amt Paid', '1000')
await t.type('Bank Chrg', '2')
await t.click('Update Case', 500)
check(
  'screen: Update Case asks first',
  (await dialogs()).some((d) => d.includes('Update WK00010007-1 ?')),
  JSON.stringify(await dialogs()),
)
await answer('Yes')
const staged = (await rowsOf())[0]
check(
  'screen: a smaller amount paid makes the claim Partial with the rest outstanding',
  staged.includes('Partial') && staged.includes('2,003.12') && staged.includes('1,000.00') && (await stat('Checked Amt')) === '1,000.00',
  JSON.stringify(staged),
)
check('screen: the staged amounts are on the row', staged.includes('WK00010008-1') && staged.includes('2'), JSON.stringify(staged))
await t.type('Rec Amt', '1000')
await t.type('Cheque No', 'CHQ-2')
await t.type('Date', '30102026')
await t.click('Save', 1200)
const wsSaved = writes.filter((w) => w.method === 'POST' && w.path === R).at(-1)?.body
check(
  'screen: the worksheet save carries the claim with its status, amount and contra case',
  wsSaved?.mode === 'worksheet' &&
    wsSaved.items.length === 1 &&
    wsSaved.items[0].caseNo === 'WK00010007' &&
    wsSaved.items[0].status === 'P' &&
    wsSaved.items[0].paymentAmt === 1000 &&
    wsSaved.items[0].contraCase === 'WK00010008' &&
    wsSaved.items[0].contraVersion === '1' &&
    wsSaved.items[0].contraAmt === 10 &&
    wsSaved.items[0].bankCharge === 2 &&
    wsSaved.checkedAmount === 1000,
  JSON.stringify(wsSaved),
)

// Edit, Update and Remove of a received claim
await t.click('Clear', 300)
await t.select('Receipt Type', 'worksheet')
await toggleScan()
await t.type('Worksheet No', 'WK00009914')
await t.click('Search', 1500)
await selectRow((await rowsOf()).findIndex((r) => r.includes('WK00009914-5')) + 1)
check(
  'screen: choosing a received claim shows its receipt',
  (await page.$eval('input[name=chequeNo]', (e) => e.value)) === 'ONLINE' && (await page.$eval('input[name=receiptAmt]', (e) => e.value)) === '50760.07',
)
await t.click('Update', 300)
check('screen: Update is off until Edit', await t.isDisabled('Update'))
await t.click('Edit', 300)
await t.type('Cheque No', 'CHQ-EDIT')
await t.click('Update', 1200)
const put = writes.find((w) => w.method === 'PUT')?.body
check(
  'screen: the update carries the receipt number, the claim and its receipt row',
  put?.mode === 'worksheet' &&
    put.receiptNo === 'RB54712' &&
    put.chequeNo === 'CHQ-EDIT' &&
    put.items[0].caseNo === 'WK00009914' &&
    put.items[0].receiptIndex === 1046428,
  JSON.stringify(put),
)
check('screen: Record Updated... is said', await t.toast('Record Updated...'))
const afterUpdate = await rowsOf()
await selectRow(afterUpdate.findIndex((r) => r.includes('WK00009914-5')) + 1)
await t.click('Remove', 500)
check(
  'screen: Remove asks first',
  (await dialogs()).some((d) => d.includes('Do you want to delete the record?')),
  JSON.stringify(await dialogs()),
)
await answer('Yes')
const removed = writes.find((w) => w.path === `${R}/remove`)?.body
check(
  'screen: Remove sends the claim and says Record has been deleted!',
  removed?.mode === 'worksheet' && removed.caseNo === 'WK00009914' && removed.version === 5 && (await t.toast('Record has been deleted!')),
  JSON.stringify(removed),
)
await t.click('Clear', 300)
check('screen: Clear empties the list', (await rowsOf()).length === 0 && (await stat('Records')) === '0')
await t.click('Print to File', 400)
check('screen: Print to File without a record says so', await t.toast('Report cannot be printed without any record.'))

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
await limited.goto(`${BASE}/receipt/from-payor`, { waitUntil: 'networkidle0' })
await limited.waitForSelector('h2')
check('access: without position 9 the page says Access Denied!', (await limited.$eval('h2', (e) => e.textContent)) === 'Access Denied!')
check('access: and the API refuses with 403', (await get(`${R}?scan=true&bordxFrom=NWK0022102`, mint(access))).status === 403)

console.log(`screenshots: ${t.shots}`)
const ok = t.summary()
await t.browser.close()
process.exit(ok ? 0 : 1)
