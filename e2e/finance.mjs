// Finance screens in the browser: searches, validation messages, selection rules, detail panels and file downloads on all eight
// Finance menu items. Read only: no save / post / reverse / stop is confirmed, so the suite leaves the data as it found it.
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { BASE, start, sleep } from './lib.mjs'

const downloads = path.join(os.tmpdir(), 'genisis-e2e-finance-downloads')
fs.rmSync(downloads, { recursive: true, force: true })
const t = await start(downloads)
const { page, check } = t

async function open(route) {
  await page.goto(`${BASE}/finance/${route}`, { waitUntil: 'domcontentloaded', timeout: 60000 })
  await page.waitForSelector('h2', { timeout: 60000 })
  await page.waitForNetworkIdle({ idleTime: 500, timeout: 60000 })
}
const tick = (caption, row) => page.click(`table[aria-label="${caption}"] tbody tr:nth-child(${row}) input[type=checkbox]`)
const clickRow = async (caption, row) => {
  await page.click(`table[aria-label="${caption}"] tbody tr:nth-child(${row}) td:last-child`)
  await sleep(800)
}
/** Waits until the grid shows data rows (not its empty message). */
const waitRows = (caption) => t.waitFor(async () => (await t.rows(caption)).some((r) => r.length > 1), 120000)
const buttonStartingWith = (prefix) =>
  page.evaluate((p) => [...document.querySelectorAll('button')].find((b) => b.textContent.trim().startsWith(p))?.textContent.trim(), prefix)
const downloaded = (pattern) =>
  t.waitFor(() => fs.existsSync(downloads) && fs.readdirSync(downloads).some((f) => pattern.test(f) && !f.endsWith('.crdownload')))

// ---------------- SUN Posting
await open('sun-posting')
await t.type('Payor', 'ST')
await t.type('Claim Reg Date from', '01072021')
await t.type('Claim Reg Date to', '31082021')
await t.click('Search', 300)
await t.waitFor(async () => ((await t.rows('Member invoice journal')).length ?? 0) > 1, 120000)
const journal = await t.rows('Member invoice journal')
check('sun posting: two journal lines per invoice', journal.length > 0 && journal.length % 2 === 0, `${journal.length} lines`)
check(
  'sun posting: line 1 credit 8200, line 2 debit 6000 (MJC)',
  journal[0]?.includes('8200ST') && journal[0]?.includes('C') && journal[1]?.includes('6000ST') && journal[1]?.includes('D'),
)
await tick('Member invoice journal', 2)
await sleep(300)
check(
  'sun posting: ticking one line ticks its pair (Post counts invoices)',
  (await buttonStartingWith('Post (')) === 'Post (1)',
  await buttonStartingWith('Post ('),
)
await t.click('Post (1)')
check('sun posting: post without an accounting period is refused', await t.toast('Please Keyin for Accounting Period'), JSON.stringify(await t.toasts()))
await t.click('Print to File', 800)
check('sun posting: journal list downloads as CSV', await downloaded(/^sun-posting-member-invoices\.csv$/))
await t.click('Search CR', 300)
await t.waitFor(async () => (await t.rows('Credit lines')).some((r) => r.includes('C')), 120000)
const credit = await t.rows('Credit lines')
check(
  'sun posting: credit list has one C line on 8200 per invoice (positive and negative)',
  credit.length >= journal.length / 2 && credit.every((r) => r.includes('C') && r.includes('8200ST')),
  `${credit.length} lines`,
)
await page.screenshot({ path: path.join(t.shots, 'e2e-finance-sun-posting.png') })

// ---------------- Receipt Enquiry
await open('receipt-enquiry')
await t.click('Search', 800)
check('receipt enquiry: a search needs a criterion', await t.toast('Please enter at least one search criterion.'), JSON.stringify(await t.toasts()))
await t.type('Receipt No from', 'RB55092')
await t.type('Receipt No to', 'RB55092')
await t.click('Search', 300)
await waitRows('Receipts')
const receipts = await t.rows('Receipts')
check('receipt enquiry: finds the receipt', receipts.length === 1 && receipts[0][0] === 'RB55092', JSON.stringify(receipts))
await clickRow('Receipts', 1)
check(
  'receipt enquiry: the receipt opens with its claim lines',
  await t.waitFor(() =>
    page.evaluate(() =>
      [...document.querySelectorAll('[role=tab]')].some((x) => /^Claim Lines \(\d+\)$/.test(x.textContent.trim()) && !x.textContent.includes('(0)')),
    ),
  ),
)
await page.screenshot({ path: path.join(t.shots, 'e2e-finance-receipt-enquiry.png') })

// ---------------- Invoice Receipt (Outstanding)
await open('invoice-receipt')
await t.type('Invoice No from', 'S34041')
await t.type('Invoice No to', 'S34041')
await t.click('Search', 300)
await waitRows('Member MCO invoices')
const invoices = await t.rows('Member MCO invoices')
check('invoice receipt: one invoice shown whatever its balance', invoices.length === 1 && invoices[0][0] === 'S34041', JSON.stringify(invoices))
await clickRow('Member MCO invoices', 1)
check(
  'invoice receipt: the form offers the outstanding balance',
  (await t.value('Receipt Amount')) !== '' && (await t.value('Description')) === 'S34041',
  await t.value('Receipt Amount'),
)
await t.type('Receipt Amount', '')
await t.click('Save')
check('invoice receipt: save without an amount is refused', await t.toast('Please Enter Receipt Amount'), JSON.stringify(await t.toasts()))

// ---------------- Short Payment Receipt
await open('short-payment')
await t.type('Invoice Date from', '01012021')
await t.click('Search', 300)
await waitRows('Member MCO invoices')
const shortRows = await t.rows('Member MCO invoices')
check(
  'short payment: only part-paid invoices with a balance',
  shortRows.length > 0 && shortRows.every((r) => Number(r[5]) > 0 && Number(r[7].replace(/,/g, '')) > 0),
  JSON.stringify(shortRows.slice(0, 3)),
)

// ---------------- Notification / Suspension (manual receipt number)
await open('receipt-manual')
await t.type('Invoice No from', 'S34041')
await t.type('Invoice No to', 'S34041')
await t.click('Search', 300)
await waitRows('Member MCO invoices')
await clickRow('Member MCO invoices', 1)
await t.click('Save')
check('manual receipt: the receipt number is asked first', await t.toast('Please Enter Receipt No'), JSON.stringify(await t.toasts()))

// ---------------- Reverse Receipt
await open('reverse-receipt')
await t.type('Receipt No from', 'RB55092')
await t.type('Receipt No to', 'RB55092')
await t.click('Search', 300)
await waitRows('Receipts')
await clickRow('Receipts', 1)
const reversed = (await t.rows('Receipts'))[0]?.[8]
if (reversed) check('reverse receipt: an already reversed receipt cannot be reversed again', await t.isDisabled('Reverse'))
else {
  await t.type('A/C Period (MM/YYYY)', '')
  await t.click('Reverse')
  check('reverse receipt: a reversal needs the accounting period', await t.toast('Please Keyin for Accounting Period'), JSON.stringify(await t.toasts()))
}

// ---------------- Suspend / Active
await open('suspend-active')
await t.type('Case No', 'ST00073162')
await t.click('Search', 300)
await waitRows('Member payment vouchers')
const vouchers = await t.rows('Member payment vouchers')
check('suspend/active: original, stop and re-issue rows', vouchers.length === 3, JSON.stringify(vouchers.map((r) => r.slice(0, 3))))
const original = vouchers.findIndex((r) => r[2].startsWith('A'))
check('suspend/active: the original shows the stop and the re-issue', original >= 0 && vouchers[original][12].startsWith('C') && vouchers[original][13] !== '')
await clickRow('Member payment vouchers', original + 1)
check(
  'suspend/active: a stopped and re-issued payment cannot be stopped or re-issued again',
  (await t.isDisabled('Stop Payment')) && (await t.isDisabled('Re-issue')),
)

// ---------------- Electronic Banking
await open('electronic-banking')
await t.type('Credit Ref (ddmmyyyy)', '06082021')
await t.click('Search', 300)
await waitRows('ONLINE payments')
const payments = await t.rows('ONLINE payments')
check('electronic banking: lists the ONLINE payments', payments.length > 0, `${payments.length}`)
check(
  'electronic banking: accounts are masked on screen',
  payments.every((r) => r[7] === '' || r[7].startsWith('****') || r[7].length <= 4),
)
const readyRow = payments.findIndex((r) => r[10] === '')
check('electronic banking: at least one payment is ready for the file', readyRow >= 0)
await tick('ONLINE payments', readyRow + 1)
await sleep(300)
await t.click('Create Bank File (1)')
await t.yes()
check(
  'electronic banking: the bank file downloads',
  await downloaded(/^ONLINE-PAYMENTS-.*\.csv$/),
  fs.existsSync(downloads) ? fs.readdirSync(downloads).join(',') : '',
)
const bankFile = fs.readdirSync(downloads).find((f) => f.startsWith('ONLINE-PAYMENTS-'))
const bankLines = bankFile ? fs.readFileSync(path.join(downloads, bankFile), 'utf8').trim().split(/\r?\n/) : []
check('electronic banking: header + the ticked payment', bankLines.length === 2 && bankLines[0].startsWith('CreditDate,PvNo'), `${bankLines.length} lines`)
const problemRow = payments.findIndex((r) => r[10] !== '')
if (problemRow >= 0) {
  await tick('ONLINE payments', problemRow + 1)
  check('electronic banking: a payment without a bank account cannot be ticked', await t.toast('cannot be selected'), JSON.stringify(await t.toasts()))
}
await page.screenshot({ path: path.join(t.shots, 'e2e-finance-electronic-banking.png') })

process.exitCode = t.summary() ? 0 : 1
await t.browser.close()
