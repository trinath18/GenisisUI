// Claim Bordx > Storage > Document (Storage / Cartons). Reads the real bordereaux, payment vouchers and receipts; the POST that would store or change a document is intercepted and answered here
// (the database writes are covered by the API's own rolled-back database tests), and a fake stored row is served once to exercise Edit. Nothing is written.
import { start, sleep, BASE } from './lib.mjs'
import { mint } from './mint.mjs'

const t = await start()
const { page, check } = t

const get = (path, token = mint()) => fetch(`${BASE}${path}`, { headers: { Authorization: `Bearer ${token}` } })
const json = async (path) => (await get(path)).json()
const post = (path, body) =>
  fetch(`${BASE}${path}`, { method: 'POST', headers: { Authorization: `Bearer ${mint()}`, 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
const dialogs = () => page.$$eval('[role=dialog]', (d) => d.map((x) => x.textContent.replace(/\s+/g, ' ').trim()))
const rowsOf = () =>
  page.$$eval('table[aria-label="Documents"] tbody tr', (trs) =>
    trs.map((tr) => [...tr.querySelectorAll('td')].map((td) => td.textContent.trim())).filter((r) => r.length > 2),
  )
const stat = (label) =>
  page.evaluate(
    (l) =>
      [...document.querySelectorAll('.stat')].find((s) => s.querySelector('.stat-label')?.textContent === l)?.querySelector('.stat-value')?.textContent ?? null,
    label,
  )
const tick = (index) =>
  page.evaluate((i) => document.querySelectorAll('table[aria-label="Documents"] tbody tr')[i]?.querySelector('input[type=checkbox]')?.click(), index)
const clickRow = (index) =>
  page.evaluate((i) => document.querySelectorAll('table[aria-label="Documents"] tbody tr')[i]?.querySelectorAll('td')[2]?.click(), index)

/** The box called `label` inside the fieldset called `legend` (Document Type, Carton No and others appear in both). */
async function boxIn(legend, label) {
  const h = await page.evaluateHandle(
    (lg, lb) => {
      const group = [...document.querySelectorAll('fieldset')].find((f) => f.querySelector('legend')?.textContent === lg)
      return [...(group?.querySelectorAll('label.form-field') ?? [])]
        .find((x) => x.querySelector('span')?.textContent.replace('*', '').trim() === lb)
        ?.querySelector('input, select, textarea')
    },
    legend,
    label,
  )
  return h.asElement()
}
async function typeIn(legend, label, text) {
  const el = await boxIn(legend, label)
  await el.focus()
  await page.keyboard.down('Control')
  await page.keyboard.press('KeyA')
  await page.keyboard.up('Control')
  await page.keyboard.press('Backspace')
  if (text) await page.keyboard.type(text)
}
const pick = async (legend, label, value) => (await boxIn(legend, label)).select(value)
const valueIn = async (legend, label) => (await boxIn(legend, label)).evaluate((e) => e.value)
const disabledIn = async (legend, label) => (await boxIn(legend, label)).evaluate((e) => e.matches(':disabled'))
const disabled = async (label) => (await t.btn(label)).evaluate((b) => b.disabled)

const posts = []
let fake = false
await page.setRequestInterception(true)
page.on('request', (req) => {
  const url = new URL(req.url())
  if (url.pathname !== '/api/claim-bordx/storage-documents') return req.continue()
  if (req.method() === 'POST') {
    posts.push(JSON.parse(req.postData()))
    return req.respond({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ message: JSON.parse(req.postData()).edit ? 'Record Updated...' : 'Record Saved...' }),
    })
  }
  if (fake) {
    return req.respond({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        truncated: false,
        rows: [
          {
            documentNo: 'CA13201',
            cartonNo: 'C-9',
            docType: 'P',
            fileStatus: 'O',
            registerDate: '2007-10-22T00:00:00',
            requestBy: 'USER1',
            requestDate: '2007-10-23T00:00:00',
            deliveryDate: null,
            returnDate: null,
            remarks: 'BOX',
            department: 'ACCOUNT',
          },
          {
            documentNo: 'CA13299',
            cartonNo: null,
            docType: null,
            fileStatus: null,
            registerDate: null,
            requestBy: null,
            requestDate: null,
            deliveryDate: null,
            returnDate: null,
            remarks: null,
            department: null,
          },
        ],
      }),
    })
  }
  return req.continue()
})

// ---------------- the API
const lookups = await json('/api/claim-bordx/storage-documents/lookups')
check(
  'api: the lookups hold cartons, users and departments',
  lookups.cartons.length > 100 && lookups.users.length > 0 && lookups.departments.length > 0,
  `${lookups.cartons.length}/${lookups.users.length}/${lookups.departments.length}`,
)
const bordx = await json('/api/claim-bordx/storage-documents?docType=B')
check(
  'api: bordx are listed unstored (no document type) with their number',
  bordx.rows.length > 0 && bordx.rows.every((r) => r.documentNo) && bordx.rows.some((r) => r.docType === null),
  `${bordx.rows.length}`,
)
const one = bordx.rows[0].documentNo
const exact = await json(`/api/claim-bordx/storage-documents?docType=B&docFrom=${encodeURIComponent(one.toLowerCase())}&docTo=${encodeURIComponent(one)}`)
check('api: a number range of one bordx gives that bordx', exact.rows.length === 1 && exact.rows[0].documentNo === one)
const pv = await json('/api/claim-bordx/storage-documents?docType=P')
check(
  'api: payment vouchers are listed and the list is cut at 5,000 with a note when it is longer',
  pv.rows.length > 0 && (pv.truncated ? pv.rows.length === 5000 : pv.rows.length < 5000),
  `${pv.rows.length} ${pv.truncated}`,
)
const receipts = await json('/api/claim-bordx/storage-documents?docType=R')
check('api: receipts are listed', receipts.rows.length > 0 && receipts.rows.every((r) => r.documentNo))
check('api: an unknown carton matches nothing', (await json(`/api/claim-bordx/storage-documents?docType=B&carton=NO-SUCH-CARTON`)).rows.length === 0)
check('api: an unknown document type is refused', (await get('/api/claim-bordx/storage-documents?docType=X')).status === 400)
const none = await post('/api/claim-bordx/storage-documents', {})
check(
  'api: a save with no document is refused with the desktop message',
  none.status === 400 && (await none.json()).message === 'Please checked at least 1 Claim !',
)
const noCarton = await post('/api/claim-bordx/storage-documents', { documents: [one], docType: 'B', carton: 'NO-SUCH-CARTON', fileStatus: 'I' })
check(
  'api: a carton that does not exist is refused and nothing is saved',
  noCarton.status === 400 && (await noCarton.json()).message === 'Carton Number not found',
)
check(
  'api: and the document is still unstored',
  (await json(`/api/claim-bordx/storage-documents?docType=B&docFrom=${encodeURIComponent(one)}&docTo=${encodeURIComponent(one)}`)).rows[0].docType === null,
)

// ---------------- the screen
await t.go('/claim-bordx/storage-document')
check('screen: title', (await page.$eval('h2', (e) => e.textContent)) === 'Storage / Cartons')
const side = await page.$$eval('.sidebar a', (els) => els.map((e) => e.textContent.trim()))
check('menu: Document is a link in the Claim Bordx menu', side.includes('Document'), side.join('|'))
check('screen: the storage form is locked until Add', await disabledIn('Storage details', 'Carton No'))
await typeIn('Search', 'Document No from', one)
await typeIn('Search', 'Document No to', one)
await t.click('Search', 1200)
const found = await rowsOf()
check('screen: Search lists the bordx with its number', found.length === 1 && found[0][1] === one, JSON.stringify(found))
check('screen: Add with nothing ticked says so', (await t.click('Add', 400), await t.toast('Please checked at least 1 Claim !')))
await tick(0)
await sleep(200)
check('screen: ticking counts the document', (await stat('No. of Rec. checked')) === '1')
await t.click('Add', 400)
check(
  'screen: Add opens the storage form with the searched document type',
  !(await disabledIn('Storage details', 'Carton No')) && (await valueIn('Storage details', 'Document Type')) === 'B',
)
await pick('Storage details', 'Document Type', '')
await t.click('Save', 400)
check('screen: Save without a document type says so', (await t.errors()).includes('Please Enter Document Type'), JSON.stringify(await t.errors()))
await pick('Storage details', 'Document Type', 'B')
await t.click('Save', 400)
check('screen: then the carton number', (await t.errors()).includes('Please Enter Carton Number'), JSON.stringify(await t.errors()))
await typeIn('Storage details', 'Carton No', lookups.cartons[0])
await t.click('Save', 400)
check('screen: then the file status', (await t.errors()).includes('Please Enter File Status'), JSON.stringify(await t.errors()))
await pick('Storage details', 'File Status', 'I')
await typeIn('Storage details', 'Request By', lookups.users[0])
await t.click('Save', 400)
check('screen: a request by without a date of request says so', (await t.errors()).includes('Please Enter Date Of Request'), JSON.stringify(await t.errors()))
await typeIn('Storage details', 'Date Of Req', '10052021')
await typeIn('Storage details', 'Date Of Del', '09052021')
await t.click('Save', 400)
check(
  'screen: a delivery before the request says so',
  (await t.errors()).includes('Invalid Date ! Date of Delivery must greater than Date of Request'),
  JSON.stringify(await t.errors()),
)
await typeIn('Storage details', 'Date Of Del', '11052021')
await typeIn('Storage details', 'Date Of Ret', '10052021')
await t.click('Save', 400)
check(
  'screen: a return before the delivery says so',
  (await t.errors()).includes('Invalid Date ! Date of Return must greater than Date of Delivery'),
  JSON.stringify(await t.errors()),
)
await typeIn('Storage details', 'Date Of Ret', '12052021')
await t.click('Save', 600)
check(
  'screen: Save asks Do you want to save the record?',
  (await dialogs()).some((d) => d.includes('Do you want to save the record?')),
  JSON.stringify(await dialogs()),
)
await (await t.btn('No')).click()
await sleep(300)
check('screen: No saves nothing', posts.length === 0)
await t.click('Save', 600)
await t.yes()
check('screen: Yes reports Record Saved...', await t.toast('Record Saved...'))
check(
  'screen: and sends the ticked bordx with the details as ISO days',
  posts.length === 1 &&
    posts[0].documents[0] === one &&
    posts[0].carton === lookups.cartons[0] &&
    posts[0].fileStatus === 'I' &&
    posts[0].requestDate === '2021-05-10' &&
    posts[0].deliveryDate === '2021-05-11' &&
    posts[0].returnDate === '2021-05-12' &&
    posts[0].edit === false,
  JSON.stringify(posts[0]),
)
check('screen: the form locks again', await disabledIn('Storage details', 'Carton No'))

// ---------------- a stored document: Edit
fake = true
await t.click('Search', 1000)
await tick(0)
await sleep(300)
check(
  'screen: a document in a carton cannot be ticked: Claim has been stored!',
  (await t.toast('Claim has been stored!')) && (await stat('No. of Rec. checked')) === '0',
)
await tick(1)
await sleep(200)
check('screen: one that is not stored can', (await stat('No. of Rec. checked')) === '1')
await tick(1)
await clickRow(0)
await sleep(300)
check(
  'screen: clicking a stored document shows its storage row, locked, and enables Edit',
  (await valueIn('Storage details', 'Carton No')) === 'C-9' &&
    (await valueIn('Storage details', 'Dept')) === 'ACCOUNT' &&
    (await valueIn('Storage details', 'Date Of Req')) === '23/10/2007' &&
    !(await disabled('Edit')) &&
    (await disabledIn('Storage details', 'Carton No')),
)
await t.click('Edit', 300)
check('screen: Edit unlocks the form and the button says Update', !(await disabledIn('Storage details', 'Carton No')) && (await t.btn('Update')) !== null)
await typeIn('Storage details', 'Carton No', 'C-10')
await t.click('Update', 600)
await t.yes()
const edited = posts.at(-1)
check(
  'screen: saving an edit sends only that document with edit set and reports Record Updated...',
  edited.edit === true &&
    edited.documents.length === 1 &&
    edited.documents[0] === 'CA13201' &&
    edited.carton === 'C-10' &&
    (await t.toast('Record Updated...')),
  JSON.stringify(edited),
)
fake = false

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
await limited.goto(`${BASE}/claim-bordx/storage-document`, { waitUntil: 'networkidle0' })
await limited.waitForSelector('h2')
check('access: without position 15 the page says Access Denied!', (await limited.$eval('h2', (e) => e.textContent)) === 'Access Denied!')
check('access: and the API refuses with 403', (await get('/api/claim-bordx/storage-documents', mint(access))).status === 403)

console.log(`screenshots: ${t.shots}`)
const ok = t.summary()
await t.browser.close()
process.exit(ok ? 0 : 1)
