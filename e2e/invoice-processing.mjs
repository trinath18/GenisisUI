// Invoice > Invoice Processing, read side: a case's invoices and one invoice's amounts by worksheet row. Reads the real development data; nothing is written (invoice-entry.mjs is the write side).
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { start, BASE } from './lib.mjs'
import { mint } from './mint.mjs'

const downloads = path.join(os.tmpdir(), 'genisis-e2e-invoice-downloads')
fs.rmSync(downloads, { recursive: true, force: true })
const t = await start(downloads)
const { page, check } = t

const get = async (p, token = mint()) => fetch(`${BASE}${p}`, { headers: { Authorization: `Bearer ${token}` } })
const json = async (p) => (await get(p)).json()
const number = (text) => Number(String(text ?? '').replace(/,/g, ''))
const gridRows = async (caption) => (await t.rows(caption)).filter((r) => r.length > 1)

// Data: a case with several invoices.
const found = await json('/api/worksheet/enquiry/cases?by=number&q=AH0000')
let cas = null
let loaded = null
for (const c of found) {
  const r = await json(`/api/invoice/${c.caseNo.trim()}`)
  if (r.invoices?.length >= 2) {
    cas = c.caseNo.trim()
    loaded = r
    break
  }
}
check('data: a case with at least two invoices was found', !!cas, `${found.length} cases searched`)
const first = loaded.invoices[0]
const apiDetail = await json(`/api/invoice/${cas}/${first.index}`)
check(
  'api: 29 rows with captions that add up to RowsTotal',
  apiDetail.rows.length === 29 &&
    apiDetail.rows.every((r) => r.benefit) &&
    Math.abs(apiDetail.rows.reduce((s, r) => s + r.amount, 0) - apiDetail.rowsTotal) < 0.005,
)
check('api: an unknown case is Record not found! (404)', (await get('/api/invoice/NO%20SUCH%20CASE')).status === 404)
check('api: an invoice of another case is Record not found! (404)', (await get(`/api/invoice/${cas}/-5`)).status === 404)

// ---------------- The page
await t.go('/invoice/processing')
check('invoice: title', (await page.$eval('h2', (e) => e.textContent)) === 'Invoice Processing')
check(
  'invoice: says plainly that an invoice a worksheet has used cannot be changed or removed here yet',
  (await page.$eval('main', (m) => m.textContent ?? '')).includes('cannot be changed or removed here yet'),
)
await t.click('Show')
check('invoice: a case number is required', (await t.errors()).includes('Please enter Case Number!'), JSON.stringify(await t.errors()))
await t.type('Case No', 'NO SUCH CASE')
await t.click('Show', 800)
check(
  'invoice: an unknown case says Record not found!',
  await t.waitFor(async () => (await page.$$eval('p.error', (e) => e.map((x) => x.textContent))).includes('Record not found!'), 10000),
)

await t.type('Case No', cas)
await t.click('Show')
check(
  "invoice: the invoice list has the case's invoices",
  await t.waitFor(async () => (await gridRows('Invoices')).length === loaded.invoices.length, 15000),
  String((await gridRows('Invoices')).length),
)
const rows = await gridRows('Invoices')
check(
  "invoice: the invoice numbers and amounts are the server's",
  rows.every((r, i) => r[0] === loaded.invoices[i].invoiceNo.trim() && Math.abs(number(r[4]) - (loaded.invoices[i].amount ?? 0)) < 0.005),
  JSON.stringify(rows[0]),
)
check(
  'invoice: the worksheet column says which invoices a worksheet has used',
  rows.every((r, i) => (loaded.invoices[i].inWorksheet ? r[5].startsWith('Yes') : r[5] === 'No')),
)

await page.evaluate(() => document.querySelector('table[aria-label="Invoices"] tbody tr')?.click())
check(
  'invoice: choosing an invoice shows its 29 rows',
  await t.waitFor(async () => (await gridRows('Invoice amounts')).length === 29, 15000),
  String((await gridRows('Invoice amounts')).length),
)
const amountRows = await gridRows('Invoice amounts')
check(
  "invoice: the rows are the server's captions and amounts",
  amountRows.every(
    (r, i) => r[0] === apiDetail.rows[i].benefit && (apiDetail.rows[i].amount === 0 ? r[1] === '-' : Math.abs(number(r[1]) - apiDetail.rows[i].amount) < 0.005),
  ),
  JSON.stringify(amountRows[0]),
)
await page.screenshot({ path: path.join(t.shots, 'invoice-processing.png'), fullPage: true })

// ---------------- Access: position 22 withheld
const access = '1'.repeat(21) + '0' + '1'.repeat(8)
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
await limited.goto(`${BASE}/invoice/processing`, { waitUntil: 'networkidle0' })
await limited.waitForSelector('h2')
check('access: without position 22 the page says Access Denied!', (await limited.$eval('h2', (e) => e.textContent)) === 'Access Denied!')
check('access: and the API refuses with 403', (await get(`/api/invoice/${cas}`, mint(access))).status === 403)

console.log(`screenshots: ${t.shots}`)
const ok = t.summary()
await t.browser.close()
process.exit(ok ? 0 : 1)
