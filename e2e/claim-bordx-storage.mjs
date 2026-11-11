// Claim Bordx > Storage > Enquiry (Storage Enquiry): the Carton Details and Storage Details tabs. Read only, against the real cartons and claim files; nothing is written.
import { start, sleep, BASE } from './lib.mjs'
import { mint } from './mint.mjs'

const t = await start()
const { page, check } = t

const get = (path, token = mint()) => fetch(`${BASE}${path}`, { headers: { Authorization: `Bearer ${token}` } })
const json = async (path) => (await get(path)).json()
const rowsOf = (caption) =>
  page.$$eval(`table[aria-label="${caption}"] tbody tr`, (trs) =>
    trs.map((tr) => [...tr.querySelectorAll('td')].map((td) => td.textContent.trim())).filter((r) => r.length > 1),
  )
const headers = (caption) => page.$$eval(`table[aria-label="${caption}"] thead th`, (ths) => ths.map((th) => th.textContent.trim()).filter(Boolean))
const stat = (label) =>
  page.evaluate(
    (l) =>
      [...document.querySelectorAll('.stat')].find((s) => s.querySelector('.stat-label')?.textContent === l)?.querySelector('.stat-value')?.textContent ?? null,
    label,
  )
const tab = async (name) => {
  await page.evaluate((n) => [...document.querySelectorAll('[role=tab]')].find((b) => b.textContent === n)?.click(), name)
  await sleep(300)
}
const q = (o) => new URLSearchParams(Object.entries(o).filter(([, v]) => v !== undefined)).toString()

// ---------------- the API
const lookups = await json('/api/claim-bordx/storage/lookups')
check(
  'api: the lookups hold carton numbers and user names',
  lookups.cartons.length > 100 && lookups.users.length > 0,
  `${lookups.cartons.length} cartons ${lookups.users.length} users`,
)
const all = await json('/api/claim-bordx/storage/cartons')
check('api: all the cartons are more than a page, so the list is cut at 5,000 and says so', all.truncated === true && all.rows.length === 5000)
const returned = await json('/api/claim-bordx/storage/cartons?status=r')
check(
  'api: a status search gives only that status',
  returned.rows.length > 0 && returned.rows.every((c) => c.status === 'R'),
  JSON.stringify(returned.rows.slice(0, 1)),
)
const store = await json('/api/claim-bordx/storage/cartons?status=S')
check('api: and the other statuses', store.rows.length > 100 && store.rows.every((c) => c.status === 'S'))
const sent2019 = await json('/api/claim-bordx/storage/cartons?sendFrom=2019-01-01&sendTo=2019-12-31')
check(
  'api: a date range keeps only the cartons sent in it',
  sent2019.rows.length > 0 && sent2019.rows.every((c) => c.sendDate?.startsWith('2019')),
  `${sent2019.rows.length}`,
)
const range = await json(`/api/claim-bordx/storage/cartons?${q({ cartonFrom: store.rows[0].cartonNo, cartonTo: store.rows[0].cartonNo })}`)
check('api: a carton range of one number gives that carton', range.rows.length === 1 && range.rows[0].cartonNo === store.rows[0].cartonNo)
const bad = await get('/api/claim-bordx/storage/cartons?status=Z')
check('api: an unknown carton status is refused', bad.status === 400)
const scanRefused = await get('/api/claim-bordx/storage/files?useScan=true')
check(
  'api: a scan without a case number is refused with the desktop message',
  scanRefused.status === 400 && (await scanRefused.json()).message === 'Please Enter Case No',
)
const payorFiles = await json('/api/claim-bordx/storage/files?payorFrom=AC&payorTo=AC')
check(
  'api: files of one payor all start with its code and are in case order',
  payorFiles.rows.length > 0 &&
    payorFiles.rows.every((f) => f.caseNo.startsWith('AC')) &&
    payorFiles.rows.every((f, i) => i === 0 || payorFiles.rows[i - 1].caseNo <= f.caseNo),
)
const sample = payorFiles.rows[0]
const scanned = await json(`/api/claim-bordx/storage/files?${q({ useScan: true, caseFrom: sample.caseNo.toLowerCase() })}`)
check('api: a scan finds the files of that one case', scanned.rows.length >= 1 && scanned.rows.every((f) => f.caseNo === sample.caseNo))
check(
  'api: the carton check sheet lists its files',
  (await json(`/api/claim-bordx/storage/carton-files?carton=${encodeURIComponent(sample.cartonNo)}`)).length >= 1,
)
const noCarton = await get('/api/claim-bordx/storage/carton-files?carton=')
check(
  'api: a check sheet without a carton is refused with the desktop message',
  noCarton.status === 400 && (await noCarton.json()).message === 'Please select Carton No.',
)

// ---------------- the screen
await t.go('/claim-bordx/storage-enquiry')
check('screen: title', (await page.$eval('h2', (e) => e.textContent)) === 'Storage Enquiry')
const side = await page.$$eval('.sidebar a', (els) => els.map((e) => e.textContent.trim()))
check('menu: Storage Enquiry is a link in the Claim Bordx menu', side.includes('Storage Enquiry'), side.join('|'))
await t.select('Carton Status', 'R')
await t.click('Search', 900)
const cartonRows = await rowsOf('Cartons')
check(
  'carton: a status search lists those cartons',
  cartonRows.length === returned.rows.length && cartonRows[0][0] === returned.rows[0].cartonNo,
  `${cartonRows.length} vs ${returned.rows.length}`,
)
check(
  'carton: the headings are the desktop list headings',
  JSON.stringify(await headers('Cartons')) ===
    JSON.stringify(['CartonNo', 'Status', 'Date Register', 'Date Send', 'Date Request', 'Date Delivery', 'Date Return', 'Date Destroy', 'Remarks']),
  JSON.stringify(await headers('Cartons')),
)
check('carton: the counter shows the rows', (await stat('Records')) === String(cartonRows.length))
await t.select('Carton Status', 'M')
await t.type('Date Of Sending from', '01012031')
await t.click('Search', 900)
check('carton: a search that matches nothing says No record found!', await t.toast('No record found!'))
await t.click('Clear', 300)
check('carton: Clear empties the list', (await rowsOf('Cartons')).length === 0 && (await stat('Records')) === '0')

await tab('Storage Details')
check('storage: the scan box is ticked and asks for one Case No', (await t.value('Case No')) === '')
await t.click('Search', 500)
check('storage: a scan without a case number says so', (await t.errors()).includes('Please Enter Case No'), JSON.stringify(await t.errors()))
await t.type('Case No', sample.caseNo)
await t.click('Search', 900)
const fileRows = await rowsOf('Claim files in storage')
check(
  'storage: a scan lists that case',
  fileRows.length === scanned.rows.length && fileRows[0][0] === sample.caseNo,
  `${fileRows.length} vs ${scanned.rows.length}`,
)
check(
  'storage: the headings are the desktop list headings',
  JSON.stringify(await headers('Claim files in storage')) ===
    JSON.stringify([
      'CaseNo',
      'Version',
      'CartonNo',
      'Carton Status',
      'File Status',
      'Bill Amt',
      'Date Sent',
      'Date Register',
      'Request By',
      'Date Request',
      'Date Delivery',
      'Date Return',
      'Duration',
      'Remarks',
    ]),
  JSON.stringify(await headers('Claim files in storage')),
)
await t.type('Case No', sample.caseNo)
await t.click('Search', 700)
check(
  'storage: scanning it again says Data has been uploaded! and adds nothing',
  (await t.toast('Data has been uploaded!')) && (await rowsOf('Claim files in storage')).length === fileRows.length,
)
await t.click('Listing', 500)
check('storage: Listing without a carton says so', await t.toast('Please select Carton No.'))
await t.checkbox('Use Scan')
await t.type('Payor from', 'AC')
await t.type('Payor to', 'AC')
await t.click('Search', 1200)
const payorRows = await rowsOf('Claim files in storage')
check(
  'storage: a range search by payor replaces the list with that payor files',
  payorRows.length === payorFiles.rows.length && payorRows.every((r) => r[0].startsWith('AC')),
  `${payorRows.length} vs ${payorFiles.rows.length}`,
)
check('storage: and the counter shows them', (await stat('Records')) === String(payorRows.length))
await t.select('File Status', 'O')
await t.click('Search', 1200)
check(
  'storage: no AC file is out, so the status filter says No record found! and the range search leaves an empty list',
  (await t.toast('No record found!')) && (await rowsOf('Claim files in storage')).length === 0,
)
await t.select('File Status', 'I')
await t.click('Search', 1200)
check('storage: and the files that are in are the ones listed before', (await rowsOf('Claim files in storage')).length === payorFiles.rows.length)

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
await limited.goto(`${BASE}/claim-bordx/storage-enquiry`, { waitUntil: 'networkidle0' })
await limited.waitForSelector('h2')
check('access: without position 15 the page says Access Denied!', (await limited.$eval('h2', (e) => e.textContent)) === 'Access Denied!')
check('access: and the API refuses with 403', (await get('/api/claim-bordx/storage/cartons', mint(access))).status === 403)

console.log(`screenshots: ${t.shots}`)
const ok = t.summary()
await t.browser.close()
process.exit(ok ? 0 : 1)
