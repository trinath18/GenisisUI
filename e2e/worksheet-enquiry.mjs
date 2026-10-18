// Worksheet > Worksheet Enquiry: the read-only enquiry on a saved worksheet. Reads the real development data; nothing is written.
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { start, BASE } from './lib.mjs'
import { mint } from './mint.mjs'

const downloads = path.join(os.tmpdir(), 'genisis-e2e-enquiry-downloads')
fs.rmSync(downloads, { recursive: true, force: true })
const t = await start(downloads)
const { page, check } = t

const get = async (p) => (await fetch(`${BASE}${p}`, { headers: { Authorization: `Bearer ${mint()}` } })).json()
const stat = (label) =>
  page.evaluate(
    (l) =>
      [...document.querySelectorAll('.stat')].find((s) => s.querySelector('.stat-label')?.textContent === l)?.querySelector('.stat-value')?.textContent ?? null,
    label,
  )
const shot = (name) => page.screenshot({ path: path.join(t.shots, `enquiry-${name}.png`), fullPage: true })
const options = (label) => t.field(label).then((el) => el.evaluate((s) => [...s.options].map((o) => o.value)))
const gridRows = async (caption) => (await t.rows(caption)).filter((r) => r.length > 1)
const waitLoaded = () => t.waitFor(async () => (await t.readValue('Mem Num')) !== null && (await page.$eval('.tabbed', () => true).catch(() => false)), 15000)

// Data: a case that has several worksheet versions and an approved amount.
const found = await get('/api/worksheet/enquiry/cases?by=number&q=AH0000')
const cas = found.find((c) => c.versions >= 3)?.caseNo
check('data: the search finds a case with several worksheet versions', !!cas, `${found.length} cases`)
const master = await get(`/api/worksheet/enquiry/${cas}?version=Master`)
const v2 = await get(`/api/worksheet/enquiry/${cas}?version=2`)
const v2Cashless = await get(`/api/worksheet/enquiry/${cas}?version=2&claimType=C`)

// ---------------- Before a case is loaded
await t.go('/worksheet/enquiry')
check('enquiry: title', (await page.$eval('h2', (e) => e.textContent)) === 'Worksheet Enquiry')
check(
  'enquiry: version offers 1 and Master before a case is loaded',
  JSON.stringify(await options('Version')) === JSON.stringify(['1', 'M1', 'Master']),
  JSON.stringify(await options('Version')),
)
check('enquiry: Export is disabled until a worksheet is shown', await t.isDisabled('Export'))
check('enquiry: Case Enq is disabled until a case is shown', await t.isDisabled('Case Enq'))
await t.click('Go')
check('enquiry: Go needs a case number', (await t.errors()).includes('Please select a Case Number !'), JSON.stringify(await t.errors()))

await t.type('Case Num', 'LOW003')
await t.click('Go')
check('enquiry: scan code LOW003 opens Worksheet Tracking', await t.waitFor(() => page.url().endsWith('/worksheet/tracking')), page.url())

await t.go('/worksheet/enquiry')
await t.type('Case Num', 'NO SUCH CASE')
await t.click('Go', 600)
check(
  'enquiry: an unknown case is Record not found!',
  await t.waitFor(() => page.$eval('[role=alert]', (e) => e.textContent.includes('Record not found!')).catch(() => false)),
)

// ---------------- Search dialog
await t.click('Search')
await page.waitForSelector('[role=dialog]')
await page.type('input[aria-label="Search text"]', cas.slice(0, 8))
await (
  await page.evaluateHandle(() => [...document.querySelectorAll('[role=dialog] button')].find((b) => b.textContent.trim() === 'Search'))
)
  .asElement()
  .click()
check(
  'search: lists several cases with their worksheet counts',
  await t.waitFor(async () => (await gridRows('Cases')).length > 1),
  String((await gridRows('Cases')).length),
)
await page.evaluate((c) => [...document.querySelectorAll('[role=dialog] table tbody tr')].find((tr) => tr.textContent.includes(c))?.click(), cas)
check('search: picking a case loads its worksheet', await waitLoaded(), cas)
check('search: the case number is filled in', (await t.value('Case Num')) === cas, await t.value('Case Num'))

// ---------------- The loaded worksheet
const head = master.header
check(
  'header: member, hospital and policy are shown',
  (await t.readValue('Mem Name')) === (head.memberName ?? '') && (await t.readValue('Pol Num')) === (head.policyNo ?? ''),
  await t.readValue('Mem Name'),
)
check('header: the case status is in words', ['Open', 'Close', 'Repudiated'].includes(await t.readValue('Case Status')), await t.readValue('Case Status'))
check(
  'header: the six tabs of the desktop form',
  (await page.$$eval('[role=tab]', (els) => els.map((e) => e.textContent.trim()))).join('|') ===
    'Invoices & Diagnosis|Worksheet|Reimbursement Not Cover|Topup|Remarks|LG Listing',
)
check('header: Export and Case Enq are enabled', !(await t.isDisabled('Export')) && !(await t.isDisabled('Case Enq')))
await shot('1-invoices')

// ---------------- Versions
const versionValues = await options('Version')
check(
  'version: lists n and Mn for each version, then Master',
  versionValues.at(-1) === 'Master' && versionValues.includes('M2') && versionValues.length === master.versions.length * 2 + 1,
  versionValues.join(','),
)
check('version: the Versions counter matches', (await stat('Versions')) === String(master.versions.length), await stat('Versions'))

await t.select('Version', 'Master')
check(
  'master: Clm Type is disabled and Export is off, as in the desktop',
  await t.waitFor(async () => (await t.isDisabled('Export')) && (await (await t.field('Clm Type')).evaluate((s) => s.disabled))),
)
await t.tab('Worksheet')
check(
  'worksheet: 29 rows (25 benefits, no co-pay and three service taxes)',
  await t.waitFor(async () => (await gridRows('Worksheet')).length === 29),
  String((await gridRows('Worksheet')).length),
)
const room = (await gridRows('Worksheet')).find((r) => r.includes('Room & Board'))
check(
  'worksheet: Master adds every version (Room & Board actual)',
  !!room && room.some((c) => c === (master.benefits[0].actual ? master.benefits[0].actual.toLocaleString('en-US', { minimumFractionDigits: 2 }) : '-')),
  JSON.stringify(room),
)
const totalText = await stat('Total Actual')
check(
  'worksheet: Total Actual is the sum of the rows',
  totalText === master.totals.actual.toLocaleString('en-US', { minimumFractionDigits: 2 }),
  `${totalText} vs ${master.totals.actual}`,
)
check('worksheet: the saved summary is listed', (await t.readValue('Bordereaux Amount')) !== null && (await t.readValue('Excess Collected By')) !== null)
await shot('2-worksheet-master')

await t.select('Version', '2')
check('version 2: Clm Type is enabled again', await t.waitFor(async () => !(await (await t.field('Clm Type')).evaluate((s) => s.disabled))))
await t.tab('Invoices & Diagnosis')
check(
  'version 2: the invoices are those of version 2',
  await t.waitFor(async () => (await gridRows('Invoices')).length === v2.invoices.length),
  `${(await gridRows('Invoices')).length} vs ${v2.invoices.length}`,
)
await t.select('Clm Type', 'C')
check(
  'claim type: Cashless lists only pay-to-hospital invoices',
  await t.waitFor(async () => (await gridRows('Invoices')).length === v2Cashless.invoices.length),
  `${(await gridRows('Invoices')).length} vs ${v2Cashless.invoices.length}`,
)
await t.select('Clm Type', 'B')

// ---------------- The other tabs
await t.tab('Reimbursement Not Cover')
check("not covered: the desktop's eight items", await t.waitFor(async () => (await gridRows('Reimbursement not covered')).length === 8))
await t.tab('Topup')
check(
  'topup: a grid or the no-top-up message',
  (await page.$('table[aria-label="Topup"]')) !== null || (await page.evaluate(() => document.body.textContent.includes('No top-up amount was approved'))),
)
await t.tab('Remarks')
check('remarks: the two remark boxes are read-only', (await page.$$eval('textarea[readonly]', (els) => els.length)) === 2)
await t.tab('LG Listing')
check(
  'LG listing: rows or the empty message',
  (await gridRows('Guarantee letters')).length > 0 || (await page.evaluate(() => document.body.textContent.includes('No guarantee letters.'))),
)
check(
  'payment panel: pay to, bank and address fields are there',
  (await t.readValue('Pay To')) !== null && (await t.readValue('Add 1')) !== null && (await t.readValue('Pymt Mode')) !== null,
)
await shot('3-payment')

// ---------------- Export and navigation
await t.click('Export', 800)
const files = fs.existsSync(downloads) ? fs.readdirSync(downloads) : []
check(
  'export: a CSV of the worksheet is downloaded',
  files.some((f) => f.startsWith(`worksheet-${cas}-2`) && f.endsWith('.csv')),
  files.join(','),
)
if (files[0]) {
  const csv = fs.readFileSync(path.join(downloads, files[0]), 'utf8')
  check('export: it has the grid header, a Total row and the summary', csv.includes('Benefits') && csv.includes('Total') && csv.includes('Bordereaux Amount'))
}
await t.click('Case Enq', 500)
check('Case Enq opens the case enquiry for the case', await t.waitFor(() => page.url().includes(`/case/enquiry?cas=${cas}`)), page.url())
await t.go(`/worksheet/enquiry?cas=${cas}`)
check('deep link: ?cas= loads the worksheet by itself', await waitLoaded())
await t.click('MBM Enq', 500)
check('MBM Enq opens the membership enquiry for the member', await t.waitFor(() => page.url().includes('/membership/enquiry?mbm=')), page.url())

// ---------------- Access: position 13 withheld
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
await limited.goto(`${BASE}/worksheet/enquiry`, { waitUntil: 'networkidle0' })
await limited.waitForSelector('h2')
check('access: without position 13 the enquiry says Access Denied!', (await limited.$eval('h2', (e) => e.textContent)) === 'Access Denied!')
const denied = await fetch(`${BASE}/api/worksheet/enquiry/${cas}`, { headers: { Authorization: `Bearer ${mint(access)}` } })
check('access: and the API refuses with 403', denied.status === 403, String(denied.status))

console.log(`screenshots: ${t.shots}`)
const ok = t.summary()
await t.browser.close()
process.exit(ok ? 0 : 1)
