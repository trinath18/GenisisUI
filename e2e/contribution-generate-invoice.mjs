// Contribution Billing > Generate Invoice (Member MCO Fees). Reads the real MCO fees; Preview and the checks the API makes before it writes are real calls, and the POST that would give out an invoice number
// (Print) is intercepted and answered here (the stamping and the numbering are covered by the API's own rolled-back database tests), so nothing is written.
import { start, sleep, BASE } from './lib.mjs'
import { mint } from './mint.mjs'

const t = await start()
const { page, check } = t

const get = (path, token = mint()) => fetch(`${BASE}${path}`, { headers: { Authorization: `Bearer ${token}` } })
const json = async (path) => (await get(path)).json()
const post = (path, body, token = mint()) =>
  fetch(`${BASE}${path}`, { method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
const rowsOf = () =>
  page.$$eval('table[aria-label="Member MCO Fees"] tbody tr', (trs) =>
    trs.map((tr) => [...tr.querySelectorAll('td')].map((td) => td.textContent.trim())).filter((r) => r.length > 2),
  )
const headers = () => page.$$eval('table[aria-label="Member MCO Fees"] thead th', (ths) => ths.map((th) => th.textContent.trim()).filter(Boolean))
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
const G = '/api/contribution-billing/generate-invoice'
const batch = { criteria: 'batch', payor: 'WK - x', bordxDate: '2021-04-30', batchNo: '2' }

const printed = []
await page.setRequestInterception(true)
page.on('request', (req) => {
  const url = new URL(req.url())
  if (url.pathname !== `${G}/print` || req.method() !== 'POST') return req.continue()
  const body = JSON.parse(req.postData())
  printed.push(body)
  if (!body.allocate) return req.continue()
  const row = {
    payorCode: 'WK',
    memberNo: 'WKHA1*03',
    coverId: '02',
    relation: 'H',
    bordxDate: '2021-04-30T00:00:00',
    policyNo: 'P1',
    healthType: 'N',
    batchNo: 2,
    memberName: 'A MEMBER',
    coveredName: 'A SPOUSE',
    groupCompany: 'ACME',
    department: null,
    invoiceNo: 'S99999',
    invoiceDate: '2026-10-30T00:00:00',
    planCode: 'BA96',
    insCode: 'H',
    effDate: null,
    expDate: null,
    adultChild: 'Child',
    basicMco: 20,
    mcoFee: 20,
    premium: 0,
    icNo: null,
    isPrincipal: false,
  }
  return req.respond({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({
      reportType: body.reportType,
      listingVersion: body.listingVersion,
      allocated: true,
      invoiceNo: 'S99999',
      invoiceDate: '2026-10-30T00:00:00',
      payor: null,
      groupBy: 'payor',
      lines: [],
      rows: [row],
    }),
  })
})

// ---------------- the API
const refused = async (res) => ({ status: res.status, message: (await res.json().catch(() => ({}))).message })
check('api: no criteria is refused with the desktop message', (await refused(await get(G))).message === 'Please Enter MCO Criteria!')
check(
  'api: a batch search needs the payor, then the date, then the batch',
  (await refused(await get(`${G}?criteria=batch`))).message === 'Please Enter Payor!' &&
    (await refused(await get(`${G}?criteria=batch&payor=WK`))).message === 'Please Enter Bordereaux Date!' &&
    (await refused(await get(`${G}?criteria=batch&payor=WK&bordxDate=2021-04-30`))).message === 'Please Enter Batch No!',
)
check(
  'api: a range search needs both dates',
  (await refused(await get(`${G}?criteria=range&payor=WK`))).message === 'Please Enter Bordereaux Date From!' &&
    (await refused(await get(`${G}?criteria=range&payor=WK&bordxFrom=2021-04-01`))).message === 'Please Enter Bordereaux Date To!',
)
check('api: an invoice search needs the invoice number', (await refused(await get(`${G}?criteria=invoice`))).message === 'Please Enter Invoice No!')
check(
  'api: By Group Company needs the group company',
  (await refused(await get(`${G}?criteria=range&payor=WK&bordxFrom=2021-04-01&bordxTo=2021-04-30&groupBy=group`))).message === 'Please Enter Group Company!',
)
const none = await refused(await get(`${G}?${q({ ...batch, bordxDate: '2099-01-01' })}`))
check('api: nothing found is Record not found !', none.status === 404 && none.message === 'Record not found !', JSON.stringify(none))
const found = await json(`${G}?${q(batch)}`)
check(
  'api: a batch lists its unbilled members with the counts',
  found.rows.length >= 10 && found.rows.length === found.principals + found.supplementary && !found.billed && found.invoices.length === 0,
  `${found.rows.length}`,
)
check(
  'api: every line is of that batch and payor',
  found.rows.every((r) => r.payorCode === 'WK' && r.batchNo === 2 && r.bordxDate.startsWith('2021-04-30') && !r.invoiceNo),
)
const range = await json(`${G}?${q({ criteria: 'range', payor: 'WK', bordxFrom: '2021-04-01', bordxTo: '2021-04-30' })}`)
check('api: a range lists at least those members', range.rows.length >= found.rows.length)
const invoiced = await json(`${G}?${q({ criteria: 'invoice', invoiceNo: 'S34161' })}`)
check(
  'api: an invoice lists its members, all billed with that number',
  invoiced.rows.length === 5 && invoiced.billed && invoiced.invoices.join() === 'S34161' && !invoiced.multipleInvoices,
)
const companies = await json(`${G}/group-companies?payor=WK`)
check('api: the group companies of a payor', Array.isArray(companies) && companies.length >= 1)
const noType = await post(`${G}/print`, { ...batch, allocate: false })
check('api: Print and Preview need a report type', noType.status === 400 && (await noType.json()).message === 'Please Select Report Type !')
const preview = await (await post(`${G}/print`, { ...batch, reportType: 'invoice', allocate: false })).json()
check(
  'api: Preview gives the invoice lines and the broker the payor is billed through, and writes nothing',
  preview.allocated === false && preview.invoiceNo === null && preview.lines.length >= 1 && preview.payor?.thirdParty === true && preview.payor?.prefix === 'S',
  JSON.stringify(preview.payor),
)
check('api: the lines add up to the members', preview.lines.reduce((s, l) => s + l.members, 0) === found.rows.length)
const listing = await (await post(`${G}/print`, { ...batch, reportType: 'listing', listingVersion: 'premium', allocate: false })).json()
check('api: the fee listing has the members and no lines', listing.lines.length === 0 && listing.rows.length === found.rows.length)
const billedPrint = await refused(await post(`${G}/print`, { criteria: 'invoice', invoiceNo: 'S34161', reportType: 'invoice', allocate: true }))
check(
  'api: Print for billed members is refused and nothing is saved',
  billedPrint.status === 400 && billedPrint.message === 'These members are billed already. Use Preview to print the invoice again.',
  JSON.stringify(billedPrint),
)
const reprint = await (await post(`${G}/print`, { criteria: 'invoice', invoiceNo: 'S34161', reportType: 'invoice', allocate: false })).json()
check('api: Preview of a billed invoice shows its number', reprint.invoiceNo === 'S34161' && reprint.allocated === false && reprint.lines.length >= 1)
check('api: the batch is still unbilled', !(await json(`${G}?${q(batch)}`)).billed)

// ---------------- the screen
await t.go('/contribution-billing/generate-invoice')
check('screen: title', (await page.$eval('h2', (e) => e.textContent)) === 'Member MCO Fees')
const links = await page.$$eval('.sidebar a', (a) => a.map((x) => x.textContent.trim()))
check('menu: Generate Invoice is a link in the Contribution Billing menu', links.includes('Generate Invoice'), links.join('|'))
check('screen: Preview and Print are off until a search found something', (await t.isDisabled('Preview')) && (await t.isDisabled('Print')))
await t.click('Search', 400)
check('screen: Search without criteria says so', (await t.errors()).includes('Please Enter MCO Criteria!'), JSON.stringify(await t.errors()))
await t.select('MCO Criteria', 'batch')
await t.click('Search', 400)
check('screen: then the payor', (await t.errors()).includes('Please Enter Payor!'), JSON.stringify(await t.errors()))
await t.type('Payor', 'WK')
await t.type('Bordx Date', '30042021')
await t.click('Search', 400)
check('screen: then the batch', (await t.errors()).includes('Please Enter Batch No!'), JSON.stringify(await t.errors()))
await t.type('Batch No', '2')
await t.click('Search', 1500)
const shown = await rowsOf()
check('screen: Search lists the batch', shown.length === found.rows.length, `${shown.length} vs ${found.rows.length}`)
check(
  'screen: the list is headed as the desktop headed it',
  JSON.stringify(await headers()) ===
    JSON.stringify([
      'Payor',
      'Membership No',
      'CovID',
      'Rel',
      'BordxDate',
      'Policy No',
      'Hlt Type',
      'Batch',
      'Name',
      'Group Company',
      'Invoice No',
      'PlnCode',
      'InsType',
      'EffDate',
      'ExpDate',
      'Adult/Child',
      'BMco',
      'Mco',
    ]),
  JSON.stringify(await headers()),
)
check(
  'screen: the counters show the principals and the covered persons',
  (await stat('Total Principal')) === String(found.principals) && (await stat('Total Supp')) === String(found.supplementary),
)
check('screen: Preview and Print are on for unbilled members', !(await t.isDisabled('Preview')) && !(await t.isDisabled('Print')))
await t.click('Print', 400)
check('screen: Print without a report type says so', (await t.errors()).includes('Please Select Report Type !'), JSON.stringify(await t.errors()))
await t.select('Report Type', 'invoice')
await t.click('Preview', 1500)
check(
  'screen: Preview asks the server without giving out a number',
  printed.length === 1 && printed[0].allocate === false && printed[0].reportType === 'invoice' && printed[0].batchNo === '2' && printed[0].criteria === 'batch',
  JSON.stringify(printed),
)
await t.click('Print', 500)
check(
  'screen: Print asks before giving out a number',
  (await dialogs()).some((d) => d.includes('new invoice number')),
  JSON.stringify(await dialogs()),
)
await answer('No')
check('screen: No sends nothing', printed.length === 1)
await t.click('Print', 500)
await answer('Yes')
check('screen: Yes reports the invoice number', await t.toast('Invoice S99999 given to 1 line(s).'))
check('screen: and sends the print with the allocation switch on', printed.length === 2 && printed[1].allocate === true, JSON.stringify(printed[1]))
check('screen: the list shows the invoice number and Print is off for billed members', (await rowsOf())[0][10] === 'S99999' && (await t.isDisabled('Print')))
await t.click('Clear', 300)
check('screen: Clear empties the list', (await rowsOf()).length === 0 && (await stat('Total Principal')) === '0')
await t.select('MCO Criteria', 'invoice')
await t.type('Invoice No', 'S34161')
await t.click('Search', 1500)
check(
  'screen: an invoice search lists billed members and leaves Print off',
  (await rowsOf()).length === 5 && (await t.isDisabled('Print')) && !(await t.isDisabled('Preview')),
)

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
await limited.goto(`${BASE}/contribution-billing/generate-invoice`, { waitUntil: 'networkidle0' })
await limited.waitForSelector('h2')
check('access: without position 8 the page says Access Denied!', (await limited.$eval('h2', (e) => e.textContent)) === 'Access Denied!')
check('access: and the API refuses with 403', (await get(`${G}?${q(batch)}`, mint(access))).status === 403)

console.log(`screenshots: ${t.shots}`)
const ok = t.summary()
await t.browser.close()
process.exit(ok ? 0 : 1)
