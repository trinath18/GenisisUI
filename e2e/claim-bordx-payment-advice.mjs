// Claim Bordx > Payment Advice > Generate Bordx No. The list the screen reads (View_MAS_PaymentAdvice: MH worksheets flagged for a payment advice) is empty in the development data, so the search, the document
// check and the POST that generates the bordx are intercepted and answered here with worksheets of every kind; the API's refusals are real calls (they fail before anything is written), and the database
// writes are covered by the API's own rolled-back database tests.
import { start, sleep, BASE } from './lib.mjs'
import { mint } from './mint.mjs'

const t = await start()
const { page, check } = t

const get = (path, token = mint()) => fetch(`${BASE}${path}`, { headers: { Authorization: `Bearer ${token}` } })
const post = (path, body, token = mint()) =>
  fetch(`${BASE}${path}`, { method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
const rowsOf = (caption) =>
  page.$$eval(`table[aria-label="${caption}"] tbody tr`, (trs) =>
    trs.map((tr) => [...tr.querySelectorAll('td')].map((td) => td.textContent.trim())).filter((r) => r.length > 2),
  )
const headers = () => page.$$eval('table[aria-label="Worksheets"] thead th', (ths) => ths.map((th) => th.textContent.trim()).filter(Boolean))
const stat = (label) =>
  page.evaluate(
    (l) =>
      [...document.querySelectorAll('.stat')].find((s) => s.querySelector('.stat-label')?.textContent === l)?.querySelector('.stat-value')?.textContent ?? null,
    label,
  )
const tick = (index) =>
  page.evaluate((i) => document.querySelectorAll('table[aria-label="Worksheets"] tbody tr')[i]?.querySelector('input[type=checkbox]')?.click(), index)
const dialogs = () => page.$$eval('[role=dialog]', (d) => d.map((x) => x.textContent.replace(/\s+/g, ' ').trim()))
const answer = async (text) => {
  await page.evaluate((x) => [...document.querySelectorAll('[role=dialog] button')].find((b) => b.textContent.trim() === x)?.click(), text)
  await sleep(500)
}
const P = '/api/claim-bordx/payment-advice-bordx'

const sheet = (caseNo, version, over = {}) => ({
  caseNo,
  claimVersion: version,
  payor: 'MH',
  appAmt: 100.5,
  doa: '2026-09-29T00:00:00',
  dod: '2026-10-01T00:00:00',
  cashType: 'H',
  coverId: '00',
  coveredName: null,
  hospital: 'A HOSPITAL',
  hosAmt: 90,
  memberName: 'A MEMBER',
  groupCompany: 'ACME',
  planCode: 'P1',
  icdCode: 'A09',
  btbg: null,
  insuredType: 'I',
  claimability: 'Y',
  costCenter: 'CC1',
  groupCategory: 'GC1',
  hospitalState: 'SEL',
  wksNo: `${caseNo}-${version}`,
  patient: 'A MEMBER',
  ...over,
})
const fake = [
  sheet('MH1', 1),
  sheet('MH2', 1, { icdCode: '' }),
  sheet('MH3', 1),
  sheet('MH4', 1, { insuredType: 'G', groupCompany: '' }),
  sheet('MH5', 2, { cashType: 'M', appAmt: 50 }),
]
const searches = []
const posted = []
await page.setRequestInterception(true)
page.on('request', (req) => {
  const url = new URL(req.url())
  if (url.pathname === `${P}/search`) {
    searches.push(Object.fromEntries(url.searchParams))
    return req.respond({ status: 200, contentType: 'application/json', body: JSON.stringify(fake) })
  }
  if (url.pathname === `${P}/documents` && req.method() === 'POST') {
    const cases = JSON.parse(req.postData()).cases
    return req.respond({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ available: true, cases: Object.fromEntries(cases.map((c) => [c, c !== 'MH3'])) }),
    })
  }
  if (url.pathname === `${P}/bordx` && req.method() === 'POST') {
    const body = JSON.parse(req.postData())
    posted.push(body)
    const lines = body.items.map((i) => ({
      claimNo: `${i.caseNo}-${i.claimVersion}`,
      bordxNo: 'NMH0000001',
      bordxDate: '2026-10-30T00:00:00',
      bordxAmount: 100.5,
    }))
    return req.respond({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ bordxNo: 'NMH0000001', bordxDate: '2026-10-30T00:00:00', bordxAmount: 151, claims: lines.length, lines }),
    })
  }
  return req.continue()
})

// ---------------- the API: the refusals are real calls that write nothing
const refused = async (res) => ({ status: res.status, message: (await res.json().catch(() => ({}))).message })
check(
  'api: a scan search without the worksheet number is refused with the desktop message',
  (await refused(await get(`${P}/search`))).message === 'Please Enter Worksheet No',
)
check('api: a bad cash type is refused', (await get(`${P}/search?wksNoFrom=MH1&cashType=X`)).status === 400)
check(
  'api: generating with no worksheet is refused',
  (await refused(await post(`${P}/bordx`, { items: [] }))).message === 'Please select at least one record to be updated! ',
)
const gone = await refused(await post(`${P}/bordx`, { items: [{ caseNo: 'MH-NO-CASE', claimVersion: 1 }] }))
check(
  'api: a worksheet that is not in the list is refused and nothing is saved',
  gone.status === 400 && gone.message === 'Worksheet MH-NO-CASE-1 is no longer waiting for a payment advice bordx. Search again.',
  JSON.stringify(gone),
)
check(
  'api: the document check says whether the store is there and which cases have documents',
  (await (await post(`${P}/documents`, { cases: ['MH1'] })).json()).cases?.MH1 !== undefined,
)

// ---------------- the screen
await t.go('/claim-bordx/payment-advice-bordx')
check('screen: title', (await page.$eval('h2', (e) => e.textContent)) === 'Payment Advice - Generate Bordx')
const side = await page.$$eval('.sidebar a', (els) => els.map((e) => e.textContent.trim()))
check('menu: Generate Bordx No is a link in the Claim Bordx menu', side.includes('Generate Bordx No'), side.join('|'))
await t.click('Bordx', 400)
check('screen: Bordx with an empty list says so', await t.toast('Please select a record before proceeding!'))
await t.click('Search', 400)
check(
  'screen: Search in scan mode without a worksheet number says so',
  (await t.errors()).includes('Please Enter Worksheet No'),
  JSON.stringify(await t.errors()),
)
await page.evaluate(() =>
  [...document.querySelectorAll('label')]
    .find((l) => l.textContent.includes('Use Scan'))
    ?.querySelector('input')
    ?.click(),
)
await t.type('Wks No from', 'MH1')
await t.type('Wks No to', 'MH9')
await t.select('Cash Type', 'H')
await t.click('Search', 900)
check(
  'screen: a range search sends the range, the cash type and no scan',
  searches.length === 1 && searches[0].useScan === 'false' && searches[0].wksNoFrom === 'MH1' && searches[0].wksNoTo === 'MH9' && searches[0].cashType === 'H',
  JSON.stringify(searches[0]),
)
const shown = await rowsOf('Worksheets')
check('screen: the worksheets are listed', shown.length === 5, `${shown.length}`)
check(
  'screen: the list is headed as the desktop headed it',
  JSON.stringify(await headers()) ===
    JSON.stringify([
      'Payor',
      'Case No',
      'Claim Version',
      'Wks No',
      'Cash Type',
      'Hos Amt',
      'App Amt',
      'DOA',
      'DOD',
      'Patient',
      'Hospital',
      'Grp Company',
      'Plan Code',
      'ICD Code',
      'BTBG',
      'Insured Type',
      'Claimability',
      'Cost Centre',
      'Group Category',
      'Hosp State',
    ]),
  JSON.stringify(await headers()),
)
check(
  'screen: the counters show the records and the total amount',
  (await stat('Records')) === '5' && (await stat('Total Amt')) === '452.00',
  `${await stat('Records')} ${await stat('Total Amt')}`,
)
await t.click('Bordx', 400)
check('screen: Bordx with nothing ticked says so', await t.toast('Please select at least one record to be updated! '))
await tick(1)
check('screen: a worksheet without a final ICD code cannot be ticked', (await t.toast('Final ICD Code cannot be empty!')) && (await stat('Selected')) === '0')
await tick(2)
check(
  'screen: a worksheet without scanned documents cannot be ticked',
  (await t.toast('Please ensure scanned documents are in system!')) && (await stat('Selected')) === '0',
)
await tick(3)
check(
  'screen: a group worksheet without a group company cannot be ticked',
  (await t.toast('Group Company cannot be empty!')) && (await stat('Selected')) === '0',
)
await tick(0)
await tick(4)
await sleep(500)
check('screen: the good worksheets can be ticked', (await stat('Selected')) === '2')
await t.click('Bordx', 500)
check(
  'screen: Bordx asks Do you want to update the record?',
  (await dialogs()).some((d) => d.includes('Do you want to update the record?')),
  JSON.stringify(await dialogs()),
)
await answer('No')
check('screen: No sends nothing', posted.length === 0)
await t.click('Bordx', 500)
await answer('Yes')
check('screen: Yes reports Record Saved!', await t.toast('Record Saved!'))
check(
  'screen: the request names the ticked worksheets',
  posted.length === 1 &&
    JSON.stringify(posted[0].items) ===
      JSON.stringify([
        { caseNo: 'MH1', claimVersion: 1 },
        { caseNo: 'MH5', claimVersion: 2 },
      ]),
  JSON.stringify(posted[0]),
)
const generated = await rowsOf('Generated bordx')
check(
  'screen: the generated bordx is listed with its number',
  generated.length === 2 && generated.every((r) => r[1] === 'NMH0000001') && (await stat('Bordx No')) === 'NMH0000001',
  JSON.stringify(generated),
)
check('screen: the worksheets that went into the bordx leave the list', (await stat('Records')) === '3' && (await stat('Selected')) === '0')
await t.click('Clear', 300)
check('screen: Clear empties the lists', (await stat('Records')) === '0')

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
await limited.goto(`${BASE}/claim-bordx/payment-advice-bordx`, { waitUntil: 'networkidle0' })
await limited.waitForSelector('h2')
check('access: without position 15 the page says Access Denied!', (await limited.$eval('h2', (e) => e.textContent)) === 'Access Denied!')
check('access: and the API refuses with 403', (await get(`${P}/search?wksNoFrom=MH1`, mint(access))).status === 403)

console.log(`screenshots: ${t.shots}`)
const ok = t.summary()
await t.browser.close()
process.exit(ok ? 0 : 1)
