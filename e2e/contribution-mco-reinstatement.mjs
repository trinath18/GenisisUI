// Contribution Billing > MCO Reinstatement (MCO Reinstatement Invoice). Reads the real reinstated members; Preview is a real call that writes nothing, and the POST that would give out an invoice number
// (Print) is intercepted and answered here (the database writes and the numbering are covered by the API's own rolled-back database tests), so nothing is written.
import { start, sleep, BASE } from './lib.mjs'
import { mint } from './mint.mjs'

const t = await start()
const { page, check } = t

const get = (path, token = mint()) => fetch(`${BASE}${path}`, { headers: { Authorization: `Bearer ${token}` } })
const json = async (path) => (await get(path)).json()
const post = (path, body, token = mint()) =>
  fetch(`${BASE}${path}`, { method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
const rowsOf = () =>
  page.$$eval('table[aria-label="Reinstatement MCO Fees"] tbody tr', (trs) =>
    trs.map((tr) => [...tr.querySelectorAll('td')].map((td) => td.textContent.trim())).filter((r) => r.length > 2),
  )
const headers = () => page.$$eval('table[aria-label="Reinstatement MCO Fees"] thead th', (ths) => ths.map((th) => th.textContent.trim()).filter(Boolean))
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
const M = '/api/contribution-billing/mco-reinstatement'
const batch = { criteria: 'batch', payor: 'AH - x', bordxDate: '2021-07-26', batchNo: '1' }

const printed = []
await page.setRequestInterception(true)
page.on('request', (req) => {
  const url = new URL(req.url())
  if (url.pathname !== `${M}/print` || req.method() !== 'POST') return req.continue()
  const body = JSON.parse(req.postData())
  printed.push(body)
  if (!body.allocate) return req.continue()
  return req.respond({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({
      reportType: body.reportType,
      allocated: true,
      invoiceNo: 'S99999',
      invoiceDate: '2026-10-30T00:00:00',
      payor: null,
      lines: [],
      rows: [
        {
          memberNo: 'AHHA1*01',
          coverId: '00',
          memberName: 'A MEMBER',
          relation: 'P',
          adultChild: 'Adult',
          bordxDate: '2021-07-26T00:00:00',
          batchNo: '1',
          policyNo: 'P1',
          effDate: null,
          expDate: null,
          invoiceNo: 'S99999',
          invoiceDate: '2026-10-30T00:00:00',
          mcoFee: 3.59,
          icNo: null,
          personIc: null,
          groupCompany: null,
          daysInsured: 364,
          isCovered: false,
          payorCode: 'AH',
        },
      ],
    }),
  })
})

// ---------------- the API
const refused = async (path) => {
  const r = await get(path)
  return { status: r.status, message: (await r.json().catch(() => ({}))).message }
}
check('api: no criteria is refused with the desktop message', (await refused(M)).message === 'Please Enter MCO Criteria!')
check(
  'api: a batch search needs the payor, then the date, then the batch',
  (await refused(`${M}?criteria=batch`)).message === 'Please Enter Payor!' &&
    (await refused(`${M}?criteria=batch&payor=AH`)).message === 'Please Enter Bordereaux Date!' &&
    (await refused(`${M}?criteria=batch&payor=AH&bordxDate=2021-07-26`)).message === 'Please Enter Batch No!',
)
check('api: an invoice search needs the invoice number', (await refused(`${M}?criteria=invoice`)).message === 'Please Enter Invoice No!')
const none = await refused(`${M}?${q({ ...batch, batchNo: '99999' })}`)
check('api: nothing found is Record not found !', none.status === 404 && none.message === 'Record not found !', JSON.stringify(none))
const found = await json(`${M}?${q(batch)}`)
check(
  'api: a batch lists its principals and covered persons',
  found.rows.length === found.principals + found.supplementary && found.principals >= 1 && found.supplementary >= 1,
  `${found.principals}+${found.supplementary}`,
)
check(
  'api: every line is of that batch and payor, with the principal as P and the fee',
  found.rows.every((r) => r.batchNo === '1' && r.bordxDate.startsWith('2021-07-26') && r.payorCode === 'AH') &&
    found.rows.some((r) => r.relation === 'P' && r.mcoFee > 0),
)
check('api: the batch has no invoice yet', found.invoices.length === 0)
const invoiced = await json(`${M}?${q({ criteria: 'invoice', invoiceNo: 'S33290' })}`)
check(
  'api: an invoice lists its members, all with that invoice number',
  invoiced.rows.length > 5 && invoiced.rows.every((r) => r.invoiceNo === 'S33290') && invoiced.invoices.join() === 'S33290',
  `${invoiced.rows.length}`,
)
const noType = await post(`${M}/print`, { ...batch, allocate: false })
check('api: Print and Preview need a report type', noType.status === 400 && (await noType.json()).message === 'Please Select Report Type !')
const preview = await (await post(`${M}/print`, { ...batch, reportType: 'invoice', allocate: false })).json()
check(
  'api: Preview gives the invoice lines and writes nothing',
  preview.allocated === false && preview.invoiceNo === null && preview.lines.length >= 1 && preview.payor?.code === 'AH' && preview.payor?.prefix === 'S',
  JSON.stringify(preview.payor),
)
check(
  'api: the lines add up to the members',
  preview.lines.reduce((s, l) => s + l.principals, 0) === found.principals && preview.rows.length === found.rows.length,
)
check('api: the batch still has no invoice after the preview', (await json(`${M}?${q(batch)}`)).invoices.length === 0)
const reprint = await (await post(`${M}/print`, { criteria: 'invoice', invoiceNo: 'S33290', reportType: 'listing', allocate: true })).json()
check(
  'api: a batch that has its invoice is reprinted: no new number',
  reprint.allocated === false && reprint.invoiceNo === 'S33290' && reprint.rows.length === invoiced.rows.length,
  JSON.stringify({ a: reprint.allocated, n: reprint.invoiceNo }),
)

// ---------------- the screen
await t.go('/contribution-billing/mco-reinstatement')
check('screen: title', (await page.$eval('h2', (e) => e.textContent)) === 'MCO Reinstatement Invoice')
const side = await page.$$eval('.sidebar a', (els) => els.map((e) => e.textContent.trim()))
check('menu: MCO Reinstatement is a link in the Contribution Billing menu', side.includes('MCO Reinstatement'), side.join('|'))
check('screen: Preview and Print are off until a search found something', (await t.isDisabled('Preview')) && (await t.isDisabled('Print')))
await t.click('Search', 400)
check('screen: Search without criteria says so', (await t.errors()).includes('Please Enter MCO Criteria!'), JSON.stringify(await t.errors()))
await t.select('MCO Criteria', 'batch')
await t.click('Search', 400)
check('screen: then the payor', (await t.errors()).includes('Please Enter Payor!'), JSON.stringify(await t.errors()))
await t.type('Payor', 'AH')
await t.click('Search', 400)
check('screen: then the date', (await t.errors()).includes('Please Enter Bordereaux Date!'), JSON.stringify(await t.errors()))
await t.type('Bordx Date', '26072021')
await t.click('Search', 400)
check('screen: then the batch', (await t.errors()).includes('Please Enter Batch No!'), JSON.stringify(await t.errors()))
await t.type('Batch No', '99999')
await t.click('Search', 900)
check('screen: a batch with nothing in it says Record not found !', await t.toast('Record not found !'))
await t.type('Batch No', '1')
await t.click('Search', 1200)
const shown = await rowsOf()
check('screen: Search lists the batch', shown.length === found.rows.length, `${shown.length} vs ${found.rows.length}`)
check(
  'screen: the list is headed as the desktop headed it',
  JSON.stringify(await headers()) ===
    JSON.stringify([
      'Member No',
      'Cover ID',
      'Member Name',
      'Rel',
      'BordxDate',
      'Batch No',
      'Pol No',
      'Eff Date',
      'Exp Date',
      'Adult/Child',
      'Invoice No',
      'Invoice Date',
      'MCOFee',
    ]),
  JSON.stringify(await headers()),
)
check(
  'screen: the counters show the principals and the covered persons',
  (await stat('Total Principal')) === String(found.principals) && (await stat('Total Supp')) === String(found.supplementary),
)
check('screen: Preview and Print are on once there are lines', !(await t.isDisabled('Preview')) && !(await t.isDisabled('Print')))
await t.click('Print', 400)
check('screen: Print without a report type says so', (await t.errors()).includes('Please Select Report Type !'), JSON.stringify(await t.errors()))
await t.select('Report Type', 'invoice')
await t.click('Preview', 1200)
check(
  'screen: Preview asks the server without giving out a number',
  printed.length === 1 && printed[0].allocate === false && printed[0].reportType === 'invoice' && printed[0].batchNo === '1' && printed[0].criteria === 'batch',
  JSON.stringify(printed),
)
await t.click('Print', 500)
check(
  'screen: Print on a batch with no invoice asks before giving out a number',
  (await dialogs()).some((d) => d.includes('new invoice number')),
  JSON.stringify(await dialogs()),
)
await answer('No')
check('screen: No sends nothing', printed.length === 1)
await t.click('Print', 500)
await answer('Yes')
check('screen: Yes reports the invoice number', await t.toast('Invoice S99999 given to 1 line(s).'))
check(
  'screen: and sends the print with the allocation switch on',
  printed.length === 2 && printed[1].allocate === true && printed[1].reportType === 'invoice',
  JSON.stringify(printed[1]),
)
check(
  'screen: the list shows the invoice number the server gave',
  (await rowsOf()).length === 1 && (await rowsOf())[0][10] === 'S99999',
  JSON.stringify(await rowsOf()),
)
await t.click('Print', 600)
check(
  'screen: a list that has its invoice is printed again without asking',
  !(await dialogs()).some((d) => d.includes('new invoice number')) && printed.length === 3 && printed[2].allocate === true,
  `${printed.length}`,
)
await t.click('Clear', 300)
check('screen: Clear empties the list', (await rowsOf()).length === 0 && (await stat('Total Principal')) === '0')

// ---------------- access: position 8 withheld
const access = '1'.repeat(7) + '0' + '1'.repeat(22)
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
await limited.goto(`${BASE}/contribution-billing/mco-reinstatement`, { waitUntil: 'networkidle0' })
await limited.waitForSelector('h2')
check('access: without position 8 the page says Access Denied!', (await limited.$eval('h2', (e) => e.textContent)) === 'Access Denied!')
check('access: and the API refuses with 403', (await get(`${M}?${q(batch)}`, mint(access))).status === 403)

console.log(`screenshots: ${t.shots}`)
const ok = t.summary()
await t.browser.close()
process.exit(ok ? 0 : 1)
