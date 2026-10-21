// Invoice > Invoice Processing, write side: add, change and remove an invoice through the page. It adds one invoice to a real case and removes it again (its number starts with E2E-,
// e2e/cleanup.sql removes any a failed run leaves); the case's remark is loaded with the form and saved back unchanged.
import path from 'node:path'
import os from 'node:os'
import fs from 'node:fs'
import { start, BASE, sleep } from './lib.mjs'
import { mint } from './mint.mjs'

const downloads = path.join(os.tmpdir(), 'genisis-e2e-invoice-entry-downloads')
fs.rmSync(downloads, { recursive: true, force: true })
const t = await start(downloads)
const { page, check } = t

const call = async (method, p, body, token = mint()) =>
  fetch(`${BASE}${p}`, {
    method,
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  })
const json = async (p) => (await call('GET', p)).json()
const number = (text) => Number(String(text ?? '').replace(/,/g, ''))
const gridRows = async (caption) => (await t.rows(caption)).filter((r) => r.length > 1)
const invoiceNo = `E2E-${Date.now().toString().slice(-8)}`

// A real case that has a discharge date and a hospital the form lists, and its remark now.
const lookups = await json('/api/invoice/lookups')
const found = await json('/api/worksheet/enquiry/cases?by=number&q=AH0000')
let cas = null
let loaded = null
for (const c of found) {
  const r = await json(`/api/invoice/${c.caseNo.trim()}`)
  if (r.header?.discharged && r.header.hospitalCode && lookups.hospitals.some((h) => h.code === r.header.hospitalCode.trim())) {
    cas = c.caseNo.trim()
    loaded = r
    break
  }
}
check('data: a case with a discharge date and a listed hospital was found', !!cas, `${found.length} cases searched`)
const hospital = loaded.header.hospitalCode.trim()
const other = lookups.hospitals.find((h) => h.code !== hospital)
const remarkBefore = loaded.header.remarks ?? ''
const countBefore = loaded.invoices.length

// ---------------- API
const fields = await json('/api/invoice/fields')
check('api: the form lists its fields with sections', fields.length > 80 && fields.every((f) => f.key && f.label && f.section))
check(
  'api: the drop-down lists are there',
  lookups.stayTypes.length >= 4 && lookups.receiptModes.length >= 4 && lookups.roomTypes.length >= 1 && lookups.hospitals.length > 100,
)
const calc = await (
  await call('POST', '/api/invoice/calculate', {
    caseNo: cas,
    payTo: 'H',
    excessAmount: 10,
    amounts: { CLMSurgicalFee: 300, CLMSurgicalWard: 50, CLMServices: 40.5 },
  })
).json()
check(
  'api: calculate works the sums and the totals out',
  calc.amounts.CLMSurgicalAmt === 350 && calc.invoiceAmount === 390.5 && calc.payAmount === 380.5,
  JSON.stringify(calc).slice(0, 160),
)
check(
  'api: a field the form does not have is refused (400)',
  (await call('POST', '/api/invoice/calculate', { caseNo: cas, amounts: { NoSuchColumn: 1 } })).status === 400,
)

// ---------------- The page
await t.go('/invoice/processing')
await t.type('Case No', cas)
await t.click('Show')
check(
  'entry: the case loads',
  await t.waitFor(async () => (await gridRows('Invoices')).length === countBefore, 15000),
  String((await gridRows('Invoices')).length),
)
check('entry: Edit and Remove wait for an invoice to be picked', (await t.isDisabled('Edit')) && (await t.isDisabled('Remove')))

await t.click('Add')
check('entry: Add opens the form', await t.waitFor(() => page.$('form[aria-label="New invoice"]').then((f) => !!f)))
check("entry: the case's stay type is there to start from", (await t.value('Stay Type')).trim() === loaded.header.stayType.trim())
await t.click('Update')
check('entry: nothing chosen -> who to be paid', await t.toast('Please select who to be paid (Member / Hospital )!'), JSON.stringify(await t.toasts()))
await t.select('Pay To', 'H')
await t.select('Payee Hospital', hospital)
await t.click('Update')
check('entry: no invoice number', await t.toast('Please key in Invoice No.!'))
await t.type('Invoice No', invoiceNo)
await t.click('Update')
check('entry: no invoice date', await t.toast('Please key in Invoice date!'))
await t.type('Invoice Date', '05012021')
await t.click('Update')
check('entry: no excess amount for a hospital', await t.toast('Please key in Excess Amount!'))
await t.type('Excess Amount', '10')
await t.click('Update')
check('entry: no initial invoice amount', await t.toast('Please key in Initial Invoice Amount!'))
await t.type('Initial Invoice Amount', '500')

await t.type('Hospital supplies and services', '40.5')
await t.type('Surgical fee', '300')
await t.type('Ward', '50')
check(
  'entry: the sum and the totals are worked out as it is typed',
  await t.waitFor(async () => (await t.readValue('Invoice Amount')) === '390.50' && (await t.readValue('Amount to Pay')) === '380.50', 8000),
  `${await t.readValue('Invoice Amount')} / ${await t.readValue('Amount to Pay')}`,
)
check(
  'entry: the surgical sum is shown and cannot be typed',
  (await t.value('Surgical')) === '350.00' && (await (await t.field('Surgical')).evaluate((e) => e.disabled)),
)
await page.screenshot({ path: path.join(t.shots, 'invoice-entry.png'), fullPage: true })
await t.click('Update')
check('entry: Record Save', await t.toast('Record Save'), JSON.stringify(await t.toasts()))
check(
  'entry: the form closes and the invoice is in the list with the worked-out amount',
  await t.waitFor(async () => (await gridRows('Invoices')).some((r) => r[0] === invoiceNo && number(r[4]) === 390.5), 15000),
  JSON.stringify((await gridRows('Invoices')).map((r) => r[0])),
)
const added = (await json(`/api/invoice/${cas}`)).invoices.find((i) => i.invoiceNo.trim() === invoiceNo)
check(
  'api: it is saved, not in a worksheet, to the next version, paid to the hospital less the excess',
  !!added &&
    !added.inWorksheet &&
    added.payAmount === 380.5 &&
    added.excessAmount === 10 &&
    String(added.worksheetVersion).trim() === String(loaded.header.nextWorksheetVersion),
  JSON.stringify(added)?.slice(0, 200),
)
check("api: the case's remark is as it was", ((await json(`/api/invoice/${cas}`)).header.remarks ?? '') === remarkBefore)

// ---------------- Change
await page.evaluate(
  (no) => [...document.querySelectorAll('table[aria-label="Invoices"] tbody tr')].find((tr) => tr.querySelector('td')?.textContent.trim() === no)?.click(),
  invoiceNo,
)
await sleep(500)
await t.click('Edit')
check(
  'entry: Edit opens the invoice as it was saved',
  await t.waitFor(
    async () =>
      (await page.$('form[aria-label="Change invoice"]')) !== null &&
      (await t.value('Invoice No')) === invoiceNo &&
      (await t.value('Hospital supplies and services')) === '40.50',
  ),
)
await t.type('Hospital supplies and services', '60')
check(
  'entry: the totals follow the change',
  await t.waitFor(async () => (await t.readValue('Invoice Amount')) === '410.00', 8000),
  await t.readValue('Invoice Amount'),
)
await t.click('Update')
check('entry: the change is saved', await t.waitFor(async () => (await gridRows('Invoices')).some((r) => r[0] === invoiceNo && number(r[4]) === 410), 15000))

// ---------------- Another hospital is asked about
await t.click('Add')
await t.waitFor(() => page.$('form[aria-label="New invoice"]').then((f) => !!f))
await t.select('Pay To', 'H')
await t.select('Payee Hospital', other.code)
await t.type('Invoice No', `${invoiceNo}B`)
await t.type('Invoice Date', '06012021')
await t.type('Excess Amount', '0')
await t.type('Initial Invoice Amount', '1')
await t.click('Update', 500)
check(
  "entry: another hospital than the case's asks Different Hospital",
  await t.waitFor(
    () => page.$('[role=dialog]').then(async (d) => !!d && (await page.$eval('[role=dialog]', (x) => x.textContent)).includes('Different Hospital')),
    8000,
  ),
)
await (await t.btn('No')).click()
await sleep(400)
check(
  'entry: answering No saves nothing',
  (await json(`/api/invoice/${cas}`)).invoices.every((i) => i.invoiceNo.trim() !== `${invoiceNo}B`),
)
await t.click('Clear')

// ---------------- Remove
await page.evaluate(
  (no) => [...document.querySelectorAll('table[aria-label="Invoices"] tbody tr')].find((tr) => tr.querySelector('td')?.textContent.trim() === no)?.click(),
  invoiceNo,
)
await sleep(500)
await t.click('Remove')
check('entry: Remove asks Are you sure?', await t.waitFor(() => page.$('[role=dialog]').then((d) => !!d)))
await t.yes()
check(
  'entry: the invoice is gone',
  await t.waitFor(async () => (await gridRows('Invoices')).every((r) => r[0] !== invoiceNo) && (await gridRows('Invoices')).length === countBefore, 15000),
  String((await gridRows('Invoices')).length),
)
check('api: and removed from the case', (await json(`/api/invoice/${cas}`)).invoices.length === countBefore)

// ---------------- An invoice a worksheet has used
const usedCase = await (async () => {
  for (const c of found) {
    const r = await json(`/api/invoice/${c.caseNo.trim()}`)
    if (r.invoices?.some((i) => i.inWorksheet && !i.bordxNo)) return { cas: c.caseNo.trim(), invoices: r.invoices }
  }
  return null
})()
if (usedCase) {
  await t.go('/invoice/processing')
  await t.type('Case No', usedCase.cas)
  await t.click('Show')
  await t.waitFor(async () => (await gridRows('Invoices')).length === usedCase.invoices.length, 15000)
  const used = usedCase.invoices.findIndex((i) => i.inWorksheet && !i.bordxNo)
  await page.evaluate((i) => document.querySelectorAll('table[aria-label="Invoices"] tbody tr')[i]?.click(), used)
  await sleep(500)
  await t.click('Remove')
  check('used: Remove says it has been used in Worksheet', await t.toast('It has been used in Worksheet!'), JSON.stringify(await t.toasts()))
  await t.click('Edit')
  check('used: Edit says changing is not available yet', await t.toast('has been used in a worksheet'), JSON.stringify(await t.toasts()))
} else check('used: a case with a used invoice was found', false)

// ---------------- Access: position 22 withheld
const access = '1'.repeat(21) + '0' + '1'.repeat(8)
check('access: without position 22 the save is refused with 403', (await call('POST', '/api/invoice', { caseNo: cas }, mint(access))).status === 403)
check('access: and so is the remove', (await call('DELETE', `/api/invoice/${cas}/1`, undefined, mint(access))).status === 403)

console.log(`screenshots: ${t.shots}`)
const ok = t.summary()
await t.browser.close()
process.exit(ok ? 0 : 1)
