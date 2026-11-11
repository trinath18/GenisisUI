// Receipt > Others (Receipt (Others)). Reads the real receipts; the POST, PUT and DELETE that would change them are intercepted and answered here (the database writes are covered by the API's own rolled-back
// database tests), so nothing is written. The API checks that stop before the database are real calls.
import { start, sleep, BASE } from './lib.mjs'
import { mint } from './mint.mjs'

const t = await start()
const { page, check } = t

const call = (method, path, body, token = mint()) =>
  fetch(`${BASE}${path}`, {
    method,
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  })
const json = async (path) => (await call('GET', path)).json()
const D = '/api/receipt/others'
const dialogs = () => page.$$eval('[role=dialog]', (d) => d.map((x) => x.textContent.replace(/\s+/g, ' ').trim()))
const rowsOf = () =>
  page.$$eval('table tbody tr', (trs) => trs.map((tr) => [...tr.querySelectorAll('td')].map((td) => td.textContent.trim())).filter((r) => r.length > 2))
const stat = (label) =>
  page.evaluate(
    (l) =>
      [...document.querySelectorAll('.stat')].find((s) => s.querySelector('.stat-label')?.textContent === l)?.querySelector('.stat-value')?.textContent ?? null,
    label,
  )
const errors = () => t.errors()

const writes = []
await page.setRequestInterception(true)
page.on('request', (req) => {
  const path = new URL(req.url()).pathname
  if (path.startsWith(D) && ['POST', 'PUT', 'DELETE'].includes(req.method())) {
    writes.push({ method: req.method(), path, body: req.postData() ? JSON.parse(req.postData()) : null })
    const message = { POST: 'Record Saved...', PUT: 'Record Updated...', DELETE: 'Record Deleted...' }[req.method()]
    return req.respond({ status: 200, contentType: 'application/json', body: JSON.stringify({ id: 99, message }) })
  }
  req.continue()
})

// ---------------- the API
const hospitals = await json(`${D}/hospitals`)
check('api: the hospitals', hospitals.length > 100 && !!hospitals[0].code && !!hospitals[0].name, `${hospitals.length}`)
const all = await json(D)
check(
  'api: the receipts, with the hospital code and name, the total and no cut-off',
  all.rows.length >= 1 &&
    all.rows.some((r) => r.hospitalCode === 'OTHER' && r.hospitalName === null && r.receiptNo === 'RCB0849/02') &&
    all.truncated === false &&
    Math.abs(all.totalAmount - all.rows.reduce((s, r) => s + (r.amount ?? 0), 0)) < 0.01,
  JSON.stringify(all.rows[0]),
)
const filtered = await json(`${D}?hospital=OTHER&noFrom=RCB0849/02&noTo=RCB0849/02&yearFrom=2002&yearTo=2002&monthFrom=1&monthTo=1`)
check('api: a hospital, receipt no, month and year', filtered.rows.length === 1 && filtered.rows[0].id === 4, JSON.stringify(filtered.rows))
const none = await call('GET', `${D}?hospital=ZZZZ`)
check('api: nothing found is No record found!', none.status === 404 && (await none.json()).message === 'No record found!')
check('api: a wrong month is refused', (await (await call('GET', `${D}?monthFrom=13`)).json()).message === 'A/C Period Mth must be 1 to 12.')
const msg = async (method, path, body) => (await (await call(method, path, body)).json()).message
const ok = { hospital: 'H1', receiptNo: 'R1', receiptDate: '2026-03-04', amount: 10, chequeNo: 'C1' }
check('api: Save asks for the hospital code first', (await msg('POST', D, {})) === 'Please Enter Hospital Code')
check(
  'api: then the receipt no, date, amount and cheque no',
  (await msg('POST', D, { hospital: 'H1' })) === 'Please Enter Receipt No' &&
    (await msg('POST', D, { hospital: 'H1', receiptNo: 'R' })) === 'Please Enter Receipt Date' &&
    (await msg('POST', D, { hospital: 'H1', receiptNo: 'R', receiptDate: '2026-03-04' })) === 'Please Enter Receipt Amount' &&
    (await msg('POST', D, { ...ok, chequeNo: '' })) === 'Please Enter Cheque No',
)
check(
  'api: Update has its own messages, the cheque no before the amount',
  (await msg('PUT', `${D}/4`, {})) === 'Please Enter Hospital Name!' &&
    (await msg('PUT', `${D}/4`, { hospital: 'H1', receiptNo: 'R', receiptDate: '2026-03-04' })) === 'Please Enter Cheque No!' &&
    (await msg('PUT', `${D}/4`, { hospital: 'H1', receiptNo: 'R', receiptDate: '2026-03-04', chequeNo: 'C' })) === 'Please Enter Cheque Amt!',
)
check('api: a negative amount is refused', (await msg('POST', D, { ...ok, amount: -1 })) === 'Receipt Amount cannot be negative.')

// ---------------- the screen
await t.go('/receipt/others')
check('screen: title', (await page.$eval('h2', (e) => e.textContent)) === 'Receipt (Others)')
const menu = await page.$$eval('.sidebar a', (a) => a.map((x) => x.textContent.trim()))
check('menu: Receipt lists Others as a link', menu.includes('Others'), menu.join('|'))
check('screen: nothing is listed until Search', (await rowsOf()).length === 0 && (await stat('Records')) === '0')
await t.click('Search', 1500)
const shown = await rowsOf()
check(
  'screen: Search lists the receipts as the desktop did (an unknown hospital is Empty)',
  shown.some((r) => r.join('|') === 'Empty|RCB0849/02|18/01/2002|3,861.50||EON192915|1/2002'),
  JSON.stringify(shown[0]),
)
check(
  'screen: Records and Receipt Amt are totalled',
  (await stat('Records')) === String(shown.length) && (await stat('Receipt Amt')) !== '0.00',
  `${await stat('Records')} ${await stat('Receipt Amt')}`,
)

// Save
await t.click('Save', 400)
check('screen: Save asks for the hospital code first', (await errors()).includes('Please Enter Hospital Code'))
await t.type('Hospital Code', 'OTHER')
await t.click('Save', 400)
check('screen: then the receipt no', (await errors()).includes('Please Enter Receipt No'))
await t.type('Receipt No', 'ZZ-R1')
await t.click('Save', 400)
check('screen: then the receipt date', (await errors()).includes('Please Enter Receipt Date'))
await t.type('Receipt Date', '04/03/2026')
await sleep(300)
check('screen: a valid receipt date fills the A/C period', (await t.value('A/C Period Mth')) === '3' && (await t.value('A/C Period Yr')) === '2026')
await t.click('Save', 400)
check('screen: then the amount', (await errors()).includes('Please Enter Receipt Amount'))
await t.type('Amount', '1500.50')
await t.click('Save', 400)
check('screen: then the cheque no', (await errors()).includes('Please Enter Cheque No'))
await t.type('Cheque No', 'CHQ-1')
await t.type('Bank Charge', '5')
await t.type('Remarks', 'e2e')
await t.click('Save', 500)
check(
  'screen: Save asks first',
  (await dialogs()).some((d) => d.includes('Do you want to save the record?')),
)
await (await t.btn('No')).click()
await sleep(300)
check('screen: No saves nothing', writes.length === 0)
await t.click('Save', 500)
await t.yes()
check('screen: Yes saves and says so', await t.toast('Record Saved...'))
const post = writes[0]
check(
  'screen: the POST carries the receipt',
  post?.method === 'POST' &&
    post.body.hospital === 'OTHER' &&
    post.body.receiptNo === 'ZZ-R1' &&
    post.body.receiptDate === '2026-03-04' &&
    post.body.amount === 1500.5 &&
    post.body.bankCharge === 5 &&
    post.body.chequeNo === 'CHQ-1' &&
    post.body.accMonth === 3 &&
    post.body.accYear === 2026 &&
    post.body.remarks === 'e2e' &&
    /^[A-Z0-9]+$/.test(post.body.hospital),
  JSON.stringify(post?.body),
)
check('screen: the form is cleared and the list is shown again', (await t.value('Receipt No')) === '' && (await rowsOf()).length >= 1)

// Edit, Update, Delete
await t.click('Update', 400)
check('screen: Update does nothing before Edit', writes.length === 1)
await t.click('Delete', 400)
check('screen: Delete needs a row', (await t.toasts()).includes('Please select the record'))
await page.evaluate(() => [...document.querySelectorAll('table tbody tr')].find((tr) => tr.textContent.includes('RCB0849/02')).click())
await sleep(200)
await t.click('Edit', 400)
check(
  'screen: Edit loads the row selected and turns Save off',
  (await t.value('Receipt No')) === 'RCB0849/02' &&
    (await t.value('Hospital Code')) === 'OTHER' &&
    (await t.value('Amount')) === '3861.5' &&
    (await t.value('Cheque No')) === 'EON192915' &&
    (await t.value('A/C Period Yr')) === '2002' &&
    (await t.isDisabled('Save')),
)
await t.type('Receipt No', '')
await t.click('Update', 400)
check('screen: Update asks for the receipt no', (await t.toasts()).includes('Please Enter Receipt No!'))
await t.type('Receipt No', 'RCB0849/02')
await t.type('Cheque No', '')
await t.click('Update', 400)
check('screen: then the cheque no before the amount', (await t.toasts()).includes('Please Enter Cheque No!'))
await t.type('Cheque No', 'EON192915')
await t.type('Amount', '3900')
await t.click('Update', 500)
check(
  'screen: Update asks first',
  (await dialogs()).some((d) => d.includes('Do you want to update the record?')),
)
await t.yes()
check('screen: Yes updates and says so', await t.toast('Record Updated...'))
const put = writes.find((w) => w.method === 'PUT')
check(
  'screen: the PUT is for that receipt',
  put?.path === `${D}/4` && put.body.amount === 3900 && put.body.receiptNo === 'RCB0849/02' && put.body.hospital === 'OTHER',
  JSON.stringify(put),
)
await page.evaluate(() => [...document.querySelectorAll('table tbody tr')].find((tr) => tr.textContent.includes('RCB0849/02')).click())
await sleep(200)
await t.click('Delete', 500)
check(
  'screen: Delete asks first',
  (await dialogs()).some((d) => d.includes('Do you want to delete this record?')),
)
await (await t.btn('No')).click()
await sleep(300)
check('screen: No deletes nothing', !writes.some((w) => w.method === 'DELETE'))
await t.click('Delete', 500)
await t.yes()
check(
  'screen: Yes deletes the row selected and says so',
  (await t.toast('Record Deleted...')) && writes.some((w) => w.method === 'DELETE' && w.path === `${D}/4`),
)

await t.click('Clear', 300)
check('screen: Clear empties the list and the totals', (await rowsOf()).length === 0 && (await stat('Records')) === '0')
await t.click('Print to File', 400)
check('screen: Print to File without a record says so', await t.toast('Report cannot be printed without any record.'))
await t.type('Receipt No from', 'ZZZZ')
await t.click('Search', 1500)
check('screen: nothing found says No record found!', await t.toast('No record found!'))

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
await limited.goto(`${BASE}/receipt/others`, { waitUntil: 'networkidle0' })
await limited.waitForSelector('h2')
check('access: without position 9 the page says Access Denied!', (await limited.$eval('h2', (e) => e.textContent)) === 'Access Denied!')
check('access: and the API refuses with 403', (await call('GET', D, undefined, mint(access))).status === 403)

console.log(`screenshots: ${t.shots}`)
const done = t.summary()
await t.browser.close()
process.exit(done ? 0 : 1)
