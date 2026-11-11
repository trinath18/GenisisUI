// Posting > Invoice > Hospital (Posting - HospInv). Reads the real hospital invoices; the POST that would post invoices to SUN is intercepted and answered here (the posting itself is covered by the API's rolled-back
// database tests), so nothing is posted and no batch number is taken. The API checks that stop before the database are real calls.
import { start, sleep, BASE } from './lib.mjs'
import { mint } from './mint.mjs'

const t = await start()
const { page, check } = t

const get = (path, token = mint()) => fetch(`${BASE}${path}`, { headers: { Authorization: `Bearer ${token}` } })
const json = async (path) => (await get(path)).json()
const post = (path, body, token = mint()) =>
  fetch(`${BASE}${path}`, { method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
const grid = 'table'
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
const q = (o) => new URLSearchParams(Object.entries(o).filter(([, v]) => v !== undefined)).toString()
const P = '/api/posting/invoice-hospital'

const posts = []
await page.setRequestInterception(true)
page.on('request', (req) => {
  const url = new URL(req.url())
  if (url.pathname === `${P}/journal` && url.searchParams.get('batchNo') === '9999')
    return req.respond({
      status: 200,
      contentType: 'text/csv',
      headers: { 'content-disposition': 'attachment; filename="9999 RC-HospInv 20261030.csv"' },
      body: 'Chk,J/T',
    })
  if (url.pathname !== `${P}/post` || req.method() !== 'POST') return req.continue()
  posts.push(JSON.parse(req.postData()))
  const line = {
    status: 'Post',
    journalType: 'RC',
    journalSource: '',
    database: 'MED',
    transRef: 'I1',
    accPeriod: '10/2026',
    transDate: '2026-10-30T00:00:00',
    description: 'X',
    accCode: '6000AC',
    amount: 50,
    debitCredit: 'D',
    hospital: '',
    groupCompany: '',
    payor: 'AC',
    caseNo: '1-1',
    productCategory: 'NS',
    bordxRef: '1',
    batchNo: '9999',
    index: null,
    invoiceCaseNo: '3893154',
    invoiceVersion: '',
  }
  return req.respond({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({
      batchNo: '9999',
      posted: 1,
      message: 'Record(s) Posted Sucessfully... ! ',
      journal: {
        lines: [line, { ...line, debitCredit: 'C', accCode: '83G004', index: '3893154' }],
        invoices: 1,
        debitTotal: 50,
        creditTotal: 50,
        posted: true,
        truncated: false,
      },
    }),
  })
})

// ---------------- the API
const refused = async (res) => ({ status: res.status, message: (await res.json().catch(() => ({}))).message })
const lookups = await json(`${P}/lookups`)
check(
  'api: the lists are filled and the payors carry their health type',
  lookups.healthTypes.length >= 1 &&
    lookups.payors.some((p) => p.code === 'AC' && p.healthType) &&
    lookups.hospitals.length >= 1 &&
    lookups.accountingPeriods.length >= 1,
  JSON.stringify(Object.keys(lookups)),
)
const open = !lookups.postingClosedMessage
const unposted = await json(`${P}/search?${q({ payor: 'AC' })}`)
check(
  'api: the unposted invoices of a payor are two lines each (debit to the payor, credit to the hospital)',
  unposted.invoices === 7 &&
    unposted.lines.length === 14 &&
    unposted.lines[0].debitCredit === 'D' &&
    unposted.lines[1].debitCredit === 'C' &&
    unposted.lines[0].accCode === '6000AC' &&
    !unposted.posted,
  `${unposted.invoices}/${unposted.lines.length}`,
)
check(
  'api: the credit line carries the invoice index and the hospital account code, the totals are equal',
  unposted.lines[1].index === unposted.lines[1].invoiceCaseNo &&
    unposted.lines[1].accCode.length > 0 &&
    unposted.debitTotal === unposted.creditTotal &&
    unposted.lines.every((l) => l.journalType === 'RC' && l.database === 'MED'),
  JSON.stringify(unposted.lines[1]),
)
const credit = await json(`${P}/search?${q({ payor: 'AC', mode: 'credit' })}`)
const debit = await json(`${P}/search?${q({ payor: 'AC', mode: 'debit' })}`)
check(
  'api: the credit list and the debit list are one line per invoice with the case number alone',
  credit.lines.length === 7 &&
    debit.lines.length === 7 &&
    credit.lines.every((l) => l.debitCredit === 'C' && !l.caseNo.includes('-')) &&
    debit.lines.every((l) => l.debitCredit === 'D'),
)
const batch = await json(`${P}/search?${q({ batchNoFrom: '4949', batchNoTo: '4949', postStatus: '', bordxStatus: '' })}`)
check(
  'api: a posted batch lists its invoices as posted with their accounting period',
  batch.invoices === 1870 && batch.posted && batch.lines[0].status === 'Post' && batch.lines[0].accPeriod === '02/2021' && batch.lines[0].batchNo === '4949',
  `${batch.invoices}`,
)
check(
  'api: Post checks in the desktop order',
  (await refused(await post(`${P}/post`, {}))).message === 'Please select the record' &&
    (await refused(await post(`${P}/post`, { invoiceIndexes: ['1'] }))).message === 'Please Enter Invoice Date(To)' &&
    (await refused(await post(`${P}/post`, { invoiceIndexes: ['1'], invoiceDateTo: '2026-10-30', bordxStatus: '0' }))).message ===
      'Please Change Bordx Status' &&
    (await refused(await post(`${P}/post`, { invoiceIndexes: ['1'], invoiceDateTo: '2026-10-30', bordxStatus: '1' }))).message ===
      'Please Keyin for Accounting Period ! ',
)
const already = await refused(await post(`${P}/post`, { invoiceIndexes: ['3750287'], invoiceDateTo: '2026-10-30', bordxStatus: '1', accPeriod: '10/2026' }))
check(
  'api: an invoice that is posted already is refused and nothing is saved (or the window is closed)',
  already.status === 400 && (already.message === '3750287: Record(s) has been posted ! ' || already.message.startsWith('Posting is ended at')),
  JSON.stringify(already),
)
check(
  'api: the journal file of a posted batch is a CSV named for the batch',
  await (async () => {
    const res = await get(`${P}/journal?${q({ batchNo: '4949', fileDate: '2026-10-30' })}`)
    const text = await res.text()
    return (
      res.status === 200 &&
      /4949 RC-HospInv 20261030\.csv/.test(res.headers.get('content-disposition') ?? '') &&
      text.includes('Chk,J/T,J/S,DB,Trans.Ref.') &&
      text.includes(',RC,,MED,')
    )
  })(),
)
const noJournal = await refused(await get(`${P}/journal?batchNo=ZZZZZ`))
check(
  'api: a batch with nothing to print is not found',
  noJournal.status === 404 && noJournal.message === 'Report cannot be printed without any record.',
  JSON.stringify(noJournal),
)

// ---------------- the screen
await t.go('/posting/invoice-hospital')
check('screen: title', (await page.$eval('h2', (e) => e.textContent)) === 'Posting - HospInv')
const side = await page.$$eval('.sidebar a', (a) => a.map((x) => x.textContent.trim()))
check('menu: Posting lists Hospital and Member as links', side.includes('Hospital') && side.includes('Member'), side.join('|'))
await t.type('Payor', 'AC')
await t.click('Search', 1500)
const shown = await rowsOf()
check('screen: Search lists two lines for each unposted invoice', shown.length === 14 && (await stat('Record(s)')) === '7', `${shown.length}`)
check(
  'screen: the list is headed as the desktop headed it',
  JSON.stringify(await headers()) ===
    JSON.stringify([
      'Chk',
      'J/T',
      'DB',
      'Trans.Ref.',
      'AccPeriod',
      'Trans.Date',
      'Description',
      'AccCode',
      'Amt',
      'D/C',
      'Hospital',
      'Payor',
      'Case No',
      'Product Cat.',
      'Bordx Ref',
      'BatchNo',
    ]),
  JSON.stringify(await headers()),
)
check('screen: DR Amt equals CR Amt and Posted is No', (await stat('DR Amt')) === (await stat('CR Amt')) && (await stat('Posted')) === 'No')
check(
  'screen: the debit line is to the payor and the credit line to the hospital',
  shown[0].includes('D') && shown[0].includes('6000AC') && shown[1].includes('C'),
  JSON.stringify(shown.slice(0, 2)),
)
await t.click('Post (0)', 400)
check('screen: Post with nothing ticked says so', await t.toast('Please select the record'))
await page.click(`${grid} tbody tr:nth-child(2) input[type=checkbox]`)
await sleep(300)
const ticked = await page.$$eval(`${grid} tbody tr input[type=checkbox]`, (boxes) => boxes.map((b) => b.checked))
check('screen: ticking one line of an invoice ticks the other', ticked[0] && ticked[1] && !ticked[2] && !ticked[3], JSON.stringify(ticked.slice(0, 4)))
await t.click('Post (1)', 400)
check('screen: Post without the invoice date to says so', await t.toast('Please Enter Invoice Date(To)'))
await t.type('Invoice Date to', '30102026')
await t.select('Bordx Status', '0')
await t.click('Post (1)', 400)
check('screen: Bordx Status No says to change it', await t.toast('Please Change Bordx Status'))
await t.select('Bordx Status', '1')
await t.click('Post (1)', 400)
check('screen: then the accounting period', await t.toast('Please Keyin for Accounting Period !'))
if (open) {
  const period = await page.$eval('select[name=accPeriod]', (e) => e.options[1].value)
  await t.select('A/C Period', period)
  await t.click('Post (1)', 500)
  check(
    'screen: Post asks Do you want to Post record(s) ?',
    (await dialogs()).some((d) => d.includes('Do you want to Post record(s) ?')),
    JSON.stringify(await dialogs()),
  )
  await answer('No')
  check('screen: No posts nothing', posts.length === 0)
  await t.click('Post (1)', 500)
  await answer('Yes')
  check('screen: Yes posts and says so with the batch number', await t.toast('Record(s) Posted Sucessfully... ! Batch No 9999'))
  check(
    'screen: the post carries the invoice index, the period and the search status',
    posts.length === 1 &&
      posts[0].invoiceIndexes.length === 1 &&
      posts[0].accPeriod === period &&
      posts[0].bordxStatus === '1' &&
      posts[0].invoiceDateTo === '2026-10-30',
    JSON.stringify(posts),
  )
  check('screen: the batch journal is listed as posted and its Batch No is shown', (await stat('Posted')) === 'Yes' && (await stat('Batch No')) === '9999')
  await t.click('Search', 1200)
}
await t.click('Search CR', 1500)
check(
  'screen: Search CR lists the credit lines alone',
  (await rowsOf()).length === 7 && (await stat('Record(s)')) === '7',
  `${(await rowsOf()).length} ${await stat('Record(s)')}`,
)
await t.click('Search DN', 1500)
check('screen: Search DN lists the debit lines alone', (await rowsOf()).length === 7 && (await rowsOf())[0].includes('D'))
await t.click('Clear', 300)
check('screen: Clear empties the list', (await rowsOf()).length === 0 && (await stat('Record(s)')) === '0')
await t.click('Print to File', 400)
check('screen: Print to File without a record says so', await t.toast('Report cannot be printed without any record.'))

// ---------------- access: position 13 withheld
const access = '1'.repeat(12) + '0' + '1'.repeat(17)
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
await limited.goto(`${BASE}/posting/invoice-hospital`, { waitUntil: 'networkidle0' })
await limited.waitForSelector('h2')
check('access: without position 13 the page says Access Denied!', (await limited.$eval('h2', (e) => e.textContent)) === 'Access Denied!')
check('access: and the API refuses with 403', (await get(`${P}/search?payor=AC`, mint(access))).status === 403)

console.log(`screenshots: ${t.shots}`)
const ok = t.summary()
await t.browser.close()
process.exit(ok ? 0 : 1)
