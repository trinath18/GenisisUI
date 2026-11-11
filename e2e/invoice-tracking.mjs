// Invoice > Invoice Tracking (/invoice/tracking): the five reports, their headers, the criteria and the file. Read only: every number on the screen is compared with
// the API's own answer, and the summaries are compared with each other.
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { start, sleep, BASE } from './lib.mjs'
import { mint } from './mint.mjs'

const downloads = path.join(os.tmpdir(), 'genisis-e2e-invoice-tracking')
fs.rmSync(downloads, { recursive: true, force: true })
const t = await start(downloads)
const { page, check } = t

const JANUARY = { invoiceDateFrom: '2021-01-01', invoiceDateTo: '2021-01-31' }
const query = (report, extra = {}) => new URLSearchParams({ report, ...extra }).toString()
const api = async (report, extra = {}) =>
  (await fetch(`${BASE}/api/invoice/tracking/search?${query(report, extra)}`, { headers: { Authorization: `Bearer ${mint()}` } })).json()
const money = (n) => (n == null ? '' : n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }))
const stat = (label) =>
  page.evaluate(
    (l) =>
      [...document.querySelectorAll('.stat')].find((s) => s.querySelector('.stat-label')?.textContent === l)?.querySelector('.stat-value')?.textContent ?? null,
    label,
  )
const headers = () => page.$$eval('table[aria-label="Invoice tracking"] thead th', (ths) => ths.map((th) => th.textContent.trim()).filter(Boolean))
const gridRows = async () => (await t.rows('Invoice tracking')).filter((r) => r.length > 1)
const typeDate = async (label, digits) => {
  const el = await t.field(label)
  await el.focus()
  await page.keyboard.type(digits)
  await page.keyboard.press('Tab')
  await sleep(250)
}
const january = async () => {
  await typeDate('Inv Date from', '01012021')
  await typeDate('Inv Date to', '31012021')
}
const run = async (report, wait = 2500) => {
  await t.select('Rpt Selection', report)
  await t.click('Search', wait)
}
const optionsOf = (label) =>
  page.evaluate((l) => {
    const field = [...document.querySelectorAll('label.form-field')].find((x) => x.querySelector('span')?.textContent.replace('*', '').trim() === l)
    return [...(field?.querySelectorAll('option') ?? [])].map((o) => o.getAttribute('value') || o.textContent)
  }, label)

await t.go('/invoice/tracking')
check('page: the screen opens', (await page.$eval('h2', (e) => e.textContent)) === 'Invoice Tracking')
check('page: the five reports are offered', JSON.stringify((await optionsOf('Rpt Selection')).filter(Boolean)) === JSON.stringify(['0', '1', '2', '3', '4']))
check(
  'page: the desktop stay types and pay types are offered',
  (await optionsOf('Stay Type')).filter(Boolean).length === 5 && JSON.stringify((await optionsOf('Pay Type')).filter(Boolean)) === JSON.stringify(['C', 'R']),
)
await t.click('Search', 400)
check('search: no report -> Please select a Report.', await t.toast('Please select a Report.'))
await t.click('Print to File', 300)
check('print: nothing listed -> Report cannot be printed without any record.', await t.toast('Report cannot be printed without any record.'))

// ---------------- the month report
await january()
await run('0')
const month = await api('0', JANUARY)
const monthRows = await gridRows()
check('0: one row for the month, 2021/01', monthRows.length === 1 && monthRows[0][0] === '2021/01', JSON.stringify(monthRows))
check(
  '0: with the desktop headers (Payable2MBM is hidden, as there)',
  JSON.stringify(await headers()) === JSON.stringify(['InvMonth', 'Total Cases', 'Payable2Hosp', 'Inv Amount']),
  JSON.stringify(await headers()),
)
const m = month.summary[0]
check(
  '0: the cells are the API figures',
  monthRows[0][1] === String(m.totalCases) && monthRows[0][2] === money(m.payableToHospital) && monthRows[0][3] === money(m.invoiceAmount),
  JSON.stringify([monthRows[0], m]),
)
check(
  '0: Record(s), of and Total Amt count the worksheets, the rows and the invoice amount',
  (await stat('Record(s)')) === String(m.totalCases) && (await stat('of')) === '1' && (await stat('Total Amt')) === money(m.invoiceAmount),
)
check(
  '0: each invoice is counted once (the desktop counted every worksheet version of the case against each invoice)',
  m.invoiceAmount < 15_000_000,
  String(m.invoiceAmount),
)

// ---------------- the other summaries add up to it
for (const [report, label, expected] of [
  ['1', 'by hospital and month', ['Hosp Code', 'Hospital', 'InvMonth', 'Total Cases', 'Payable2Hosp', 'Inv Amount']],
  ['2', 'general listing', ['Hosp Code', 'Hospital', 'Inv. No', 'Inv. Date', 'Payable2Hosp', 'Inv Amount']],
  ['4', 'summary by hospital', ['Hosp Code', 'Hospital', 'Total Cases', 'Payable2Hosp', 'Inv Amount']],
]) {
  await run(report)
  const answer = await api(report, JANUARY)
  const rows = await gridRows()
  check(`${report}: ${label} has the desktop headers`, JSON.stringify(await headers()) === JSON.stringify(expected), JSON.stringify(await headers()))
  check(`${report}: and as many rows as the API`, rows.length === answer.summary.length && rows.length > 1, `${rows.length} vs ${answer.summary.length}`)
  check(
    `${report}: the invoice amounts add up to the month's`,
    Math.abs(answer.summary.reduce((s, r) => s + r.invoiceAmount, 0) - m.invoiceAmount) < 0.005 && (await stat('Total Amt')) === money(m.invoiceAmount),
    `${await stat('Total Amt')} vs ${money(m.invoiceAmount)}`,
  )
}
check(
  '4: Inv Amount is the last column and is a figure',
  (await gridRows())[0].at(-1).replace(/,/g, '') !== '' && !Number.isNaN(Number((await gridRows())[0].at(-1).replace(/,/g, ''))),
)
await t.select('Rpt Selection', '0')
check('a different report clears the list', (await gridRows()).length === 0)

// ---------------- the detail report and the criteria
await t.click('Clear', 300)
await typeDate('Inv Date from', '01012021')
await typeDate('Inv Date to', '01012021')
await run('3')
const day = await api('3', { invoiceDateFrom: '2021-01-01', invoiceDateTo: '2021-01-01' })
const detail = await gridRows()
check(
  '3: the detail lists the invoices of the day, as many as the API',
  detail.length === day.detail.length && detail.length > 5,
  `${detail.length} vs ${day.detail.length}`,
)
check(
  '3: with the desktop headers',
  JSON.stringify(await headers()) ===
    JSON.stringify([
      'Worksheet No',
      'Bordx No',
      'Bordx Date',
      'Inv. No',
      'Inv. Date',
      'Inv Amt',
      'DOR',
      'DOA',
      'DOD',
      'Payee',
      'Group Company',
      'Inv. Reg',
      'Inv. Entry By',
      'Stay Type',
      'Pay Type',
    ]),
  JSON.stringify(await headers()),
)
check(
  '3: every row has the day as its invoice date',
  detail.every((r) => r[4] === '01/01/2021'),
)
check(
  "3: and the first row is the API's first",
  detail[0][0] === `${day.detail[0].caseNo}-${day.detail[0].version}` && detail[0][3] === (day.detail[0].invoiceNo ?? ''),
  JSON.stringify(detail[0]),
)
check('3: Record(s) and of are both the number of rows', (await stat('Record(s)')) === String(detail.length) && (await stat('of')) === String(detail.length))

await t.select('Pay To', 'M')
await t.click('Search', 1500)
const member = await gridRows()
const apiMember = await api('3', { invoiceDateFrom: '2021-01-01', invoiceDateTo: '2021-01-01', payTo: 'M' })
check(
  'criteria: Pay To M narrows the list, as the API does',
  member.length === apiMember.detail.length && member.length < detail.length && member.every((r) => r[9] === 'MEMBER' || r[9] === ''),
  `${member.length} vs ${apiMember.detail.length}`,
)
await t.select('Pay To', '')
await t.select('Stay Type', '4')
await t.click('Search', 1500)
check(
  'criteria: Stay Type 4 (follow-up and pre-hospitalisation) works and lists only those stays',
  (await gridRows()).every((r) => r[13] === 'P' || r[13] === 'F'),
)
await t.select('Stay Type', '0')
await t.select('Pay Type', 'C')
await t.click('Search', 1500)
const cashless = await gridRows()
check(
  'criteria: In-Patient and Cashless list only those',
  cashless.every((r) => r[13] === 'I' && r[14] === 'C'),
)
await t.click('Clear', 300)
await t.select('Rpt Selection', '3')
await page.evaluate(() =>
  [...document.querySelectorAll('label.check-field')]
    .find((x) => x.textContent.trim() === 'Inv No is empty')
    ?.querySelector('input')
    ?.click(),
)
await t.click('Search', 2500)
const noInvoice = await gridRows()
const apiNoInvoice = await api('3', { invoiceNoEmpty: 'true' })
check(
  'criteria: Inv No is empty lists the cases without an invoice too, as many as the API',
  noInvoice.length === apiNoInvoice.detail.length && noInvoice.length > 0,
  `${noInvoice.length} vs ${apiNoInvoice.detail.length}`,
)
check(
  'criteria: and none of them has an invoice number',
  noInvoice.every((r) => r[3] === ''),
)

// ---------------- payor, group company, hospital and validation
await t.click('Clear', 300)
await t.type('Payor', 'AY')
await sleep(900)
const groups = await page.evaluate(() => {
  const field = [...document.querySelectorAll('label.form-field')].find((x) => x.querySelector('span')?.textContent.trim() === 'Grp Company')
  return [...(field?.querySelectorAll('datalist option') ?? [])].map((o) => o.getAttribute('value'))
})
check('payor: choosing a payor lists its group companies', groups.length > 0 && groups.includes('AXALIFE'), JSON.stringify(groups.slice(0, 5)))
check('hospital: the hospital drop-down lists the hospitals', (await optionsOf('Hospital')).length > 100)
await typeDate('Inv Date from', '31022021')
await t.select('Rpt Selection', '3')
await t.click('Search', 600)
check(
  'validation: an impossible date -> Invalid Date Format!',
  await page
    .$$eval('[role=alert], .field-error, .error', (els) => els.map((e) => e.textContent))
    .then((x) => x.some((s) => s.includes('Invalid Date Format!'))),
)
await t.click('Clear', 300)

// ---------------- the file
await january()
await run('0')
await t.click('Print to File', 800)
const csvPath = path.join(downloads, 'invoice-tracking-0.csv')
for (let i = 0; i < 40 && !fs.existsSync(csvPath); i++) await sleep(150)
const csv = fs.existsSync(csvPath)
  ? fs
      .readFileSync(csvPath, 'utf8')
      .replace(/^\ufeff/, '')
      .split('\r\n')
  : []
check(
  'file: Print to File downloads the report as a CSV, Payable2MBM included',
  csv[0] === 'InvMonth,Total Cases,Payable2Hosp,Payable2MBM,Inv Amount' && csv.length === 2 && csv[1].startsWith('2021/01,'),
  csv.join(' | '),
)

await page.screenshot({ path: `${t.shots}/e2e-invoice-tracking.png`, fullPage: true })
const ok = t.summary()
await t.browser.close()
process.exit(ok ? 0 : 1)
