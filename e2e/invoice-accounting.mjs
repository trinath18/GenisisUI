// Invoice > Invoice HOS Accounting (/invoice/hospital-accounting) and Invoice MBM Accounting (/invoice/member-accounting). Reads real invoices; the POSTs that would mark
// invoices as printed or give them an accounting period are intercepted and answered here (the database writes are covered by the API's own rolled-back database tests), so
// nothing is written. The downloads are real: the files the Preview and Print to File buttons give are read back.
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { start, sleep, BASE } from './lib.mjs'
import { mint } from './mint.mjs'

const downloads = path.join(os.tmpdir(), 'genisis-e2e-invoice-accounting')
fs.rmSync(downloads, { recursive: true, force: true })
const t = await start(downloads)
const { page, check } = t

const get = async (p) => (await fetch(`${BASE}${p}`, { headers: { Authorization: `Bearer ${mint()}` } })).json()
const posts = []
let printAnswer = null
await page.setRequestInterception(true)
page.on('request', (req) => {
  if (req.method() === 'POST' && /\/api\/invoice\/(hospital|member)-accounting\/(print|period)$/.test(req.url())) {
    const url = new URL(req.url()).pathname
    posts.push({ url, body: JSON.parse(req.postData()) })
    const answer = url.endsWith('/period') ? { message: 'Record updated...', updated: 1 } : printAnswer
    return req.respond({ status: 200, contentType: 'application/json', body: JSON.stringify(answer) })
  }
  req.continue()
})

const money = (n) => (n == null ? '' : n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }))
const credit = (n) => (n == null ? '' : n > 0 ? `(${money(n)})` : '0.00')
const stat = (label) =>
  page.evaluate(
    (l) =>
      [...document.querySelectorAll('.stat')].find((s) => s.querySelector('.stat-label')?.textContent === l)?.querySelector('.stat-value')?.textContent ?? null,
    label,
  )
const dialogs = () => page.$$eval('[role=dialog]', (d) => d.map((x) => x.textContent.replace(/\s+/g, ' ').trim()))
const headers = (caption) => page.$$eval(`table[aria-label="${caption}"] thead th`, (ths) => ths.map((th) => th.textContent.trim()).filter(Boolean))
const gridRows = async (caption) => (await t.rows(caption)).filter((r) => r.length > 1)
const typeDate = async (label, digits) => {
  const el = await t.field(label)
  await el.focus()
  await page.keyboard.type(digits)
  await page.keyboard.press('Tab')
  await sleep(250)
}
const download = async (name, ms = 6000) => {
  const file = path.join(downloads, name)
  const end = Date.now() + ms
  while (Date.now() < end) {
    if (fs.existsSync(file) && !fs.existsSync(`${file}.crdownload`)) return fs.readFileSync(file, 'utf8').replace(/^\ufeff/, '')
    await sleep(150)
  }
  return null
}
const group = (rows, keyOf) => {
  const by = new Map()
  for (const r of rows) by.set(keyOf(r), [...(by.get(keyOf(r)) ?? []), r])
  return by
}

// ======================================================= Invoice HOS Accounting
const HOS = '/api/invoice/hospital-accounting'
const newHospital = (await get(`${HOS}/search?printStatus=N&invoiceDateFrom=2015-01-01`)).rows
const [hospital, hospitalRows] = [...group(newHospital, (r) => r.hospitalCode)].find(([code, rows]) => code && rows.length >= 3 && rows.length <= 30)
const hospitalTotal = hospitalRows.reduce((s, r) => s + (r.payable ?? 0), 0)

await t.go('/invoice/hospital-accounting')
check('hos: the screen opens', (await page.$eval('h2', (e) => e.textContent)) === 'Invoice HOS Accounting')
const status = await (await t.field('Print Status')).evaluate((s) => ({ value: s.value, options: [...s.options].map((o) => o.textContent) }))
check(
  'hos: Print Status offers N - New and R - Reprint and starts at New',
  status.value === 'N' && JSON.stringify(status.options) === JSON.stringify(['N - New', 'R - Reprint']),
  JSON.stringify(status),
)
await t.click('Preview', 300)
check('hos: Preview with nothing listed -> Please select a record(s) before proceeding!', await t.toast('Please select a record(s) before proceeding!'))
await t.click('Print to File', 300)
check('hos: Print to File with nothing listed says the same', await t.toast('Please select a record(s) before proceeding!'))

await t.select('Hospital', 'NOT A HOSPITAL')
await t.click('Search', 1200)
check('hos: a hospital that is not there -> nothing selected, no search', (await gridRows('Invoices paid to hospitals')).length === 0)
await t.select('Hospital', '')
await typeDate('Inv Date from', '31022021')
await t.click('Search', 600)
check(
  'hos: an impossible date -> Invalid Date Format!',
  await page
    .$$eval('[role=alert], .field-error, .error', (els) => els.map((e) => e.textContent))
    .then((x) => x.some((s) => s.includes('Invalid Date Format!'))),
)
await t.click('Clear', 300)

await t.select('Hospital', hospital)
await typeDate('Inv Date from', '01012015')
await t.click('Search', 2500)
const rows = await gridRows('Invoices paid to hospitals')
check('hos: Search lists the invoices of the hospital, as many as the API', rows.length === hospitalRows.length, `${rows.length} vs ${hospitalRows.length}`)
check(
  'hos: the columns are the desktop list headers',
  JSON.stringify(await headers('Invoices paid to hospitals')) ===
    JSON.stringify([
      'Hospital',
      'Inv No',
      'Inv Date',
      'Inv Reg Date',
      'Worksheet No',
      'Bordx No',
      'Member No',
      'Member Name',
      'Patient Name',
      'Pay2HOS',
      'Previous Amt',
      'DR',
      'CR',
      'Date Seq',
      'Bat No',
    ]),
  JSON.stringify(await headers('Invoices paid to hospitals')),
)
check(
  'hos: every row is the chosen hospital and not printed',
  rows.every((r) => r[0] === hospital && r[13] === '' && r[14] === ''),
)
check(
  'hos: Records and Total Amt are the count and the sum of Pay2HOS',
  (await stat('Records')) === String(hospitalRows.length) && (await stat('Total Amt')) === money(hospitalTotal),
  `${await stat('Records')} ${await stat('Total Amt')} vs ${money(hospitalTotal)}`,
)
const sample = hospitalRows[0]
const sampleRow = rows.find((r) => r[1] === (sample.invoiceNo ?? '') && r[4] === `${sample.caseNo}-${sample.version}`)
check(
  'hos: DR and CR are the desktop columns (a credit in brackets)',
  sampleRow && sampleRow[11] === (sample.debit == null ? '' : money(sample.debit)) && sampleRow[12] === credit(sample.credit),
  JSON.stringify([sampleRow, sample.debit, sample.credit]),
)

await t.click('Preview', 800)
const preview = await download('hospital-invoices-preview.csv')
check(
  'hos: Preview downloads the list as a CSV with the same headers',
  preview !== null &&
    preview.split('\r\n')[0] ===
      'Hospital,Inv No,Inv Date,Inv Reg Date,Worksheet No,Bordx No,Member No,Member Name,Patient Name,Pay2HOS,Previous Amt,DR,CR,Date Seq,Bat No',
  preview?.split('\r\n')[0],
)
check('hos: and one line per invoice', preview !== null && preview.split('\r\n').length === hospitalRows.length + 1)
check('hos: Preview marked nothing', posts.length === 0)

printAnswer = { batch: 'H23102026-3', updated: hospitalRows.length, rows: hospitalRows.length }
await t.click('Print to File', 600)
check(
  'hos: Print to File asks Do you want to print the record?',
  (await dialogs()).some((d) => d.includes('Do you want to print the record?')),
  JSON.stringify(await dialogs()),
)
await (await t.btn('No')).click()
await sleep(400)
check('hos: No sends nothing', posts.length === 0)
await t.click('Print to File', 600)
await t.yes()
await t.toast('Batch H23102026-3', 4000)
check(
  'hos: Yes asks the server with the criteria of the list',
  posts.length === 1 &&
    posts[0].url === `${HOS}/print` &&
    posts[0].body.printStatus === 'N' &&
    posts[0].body.hospitalCode === hospital &&
    posts[0].body.invoiceDateFrom === '2015-01-01',
  JSON.stringify(posts),
)
check(
  'hos: the list now shows the batch, and Seq No',
  (await stat('Seq No')) === 'H23102026-3' && (await gridRows('Invoices paid to hospitals')).every((r) => r[13] === 'H23102026' && r[14] === '3'),
)
check(
  'hos: the previous amount is the amount payable, so nothing is left to debit or credit',
  (await gridRows('Invoices paid to hospitals')).every((r) => r[10] === r[9] && r[11] === '' && r[12] === '0.00'),
)
const printed = await download('hospital-invoices-H23102026-3.csv')
check(
  'hos: the file is the batch',
  printed !== null && printed.split('\r\n').length === hospitalRows.length + 1 && printed.split('\r\n')[1].includes('H23102026,3'),
  printed?.split('\r\n')[1],
)

// reprint of a printed batch: nothing is marked
await t.click('Clear', 300)
await t.select('Print Status', 'R')
await typeDate('Batch Date from', '18032002')
await typeDate('Batch Date to', '18032002')
await t.click('Search', 2000)
const reprint = await gridRows('Invoices paid to hospitals')
const apiReprint = (await get(`${HOS}/search?printStatus=R&batchDateFrom=2002-03-18&batchDateTo=2002-03-18`)).rows
check('hos: a reprint search lists the printed batch', reprint.length === apiReprint.length && reprint.length > 0, `${reprint.length} vs ${apiReprint.length}`)
check(
  'hos: every row carries that batch',
  reprint.every((r) => r[13] === 'H18032002' && r[14] === '1'),
)
printAnswer = { batch: null, updated: 0, rows: reprint.length }
posts.length = 0
await t.click('Print to File', 600)
await t.yes()
await sleep(700)
check(
  'hos: a reprint asks the server for no batch and downloads the file',
  posts.length === 1 && posts[0].body.printStatus === 'R' && (await download('hospital-invoices-reprint.csv')) !== null,
)
await t.select('Print Status', 'N')
await t.click('Clear', 300)
await t.click('Search', 100)
await sleep(100)
await page.screenshot({ path: `${t.shots}/e2e-invoice-hospital-accounting.png`, fullPage: true })

// ======================================================= Invoice MBM Accounting
const MBM = '/api/invoice/member-accounting'
const newMember = (await get(`${MBM}/search?printStatus=N`)).rows
const [payor, payorRows] = [...group(newMember, (r) => r.caseNo.slice(0, 2))].find(
  ([, rows]) => rows.length >= 4 && rows.length <= 40 && rows.filter((r) => r.payToCode === 'M').length >= 3,
)
const payorTotal = payorRows.reduce((s, r) => s + (r.payable ?? 0), 0)
posts.length = 0

await t.go('/invoice/member-accounting')
check('mbm: the screen opens', (await page.$eval('h2', (e) => e.textContent)) === 'Invoice MBM Accounting')
await t.click('Update', 300)
check('mbm: Update with nothing listed -> Please select a record(s) before proceeding!', await t.toast('Please select a record(s) before proceeding!'))
await t.click('Print to File', 300)
check('mbm: Print to File with nothing listed says the same', await t.toast('Please select a record(s) before proceeding!'))
await t.type('Payor', payor)
await t.click('Search', 2000)
const memberRows = await gridRows('Invoices of worksheets payable to members')
const memberHeaders = await headers('Invoices of worksheets payable to members')
check('mbm: Search lists the invoices of the payor, as many as the API', memberRows.length === payorRows.length, `${memberRows.length} vs ${payorRows.length}`)
check(
  'mbm: the columns are the desktop list headers',
  JSON.stringify(memberHeaders.filter((h) => h !== '')) ===
    JSON.stringify([
      'Pay To',
      'Wsk No',
      'Claim Reg Date',
      'Main DCN',
      'Bordx No',
      'Mem No',
      'Mem Name',
      'Patient Name',
      'Pay2MBM',
      'Prev Amt',
      'DR',
      'CR',
      'Date Seq',
      'Bat No',
      'PLN Code',
    ]) ||
    JSON.stringify(memberHeaders.slice(1)) ===
      JSON.stringify([
        'Pay To',
        'Wsk No',
        'Claim Reg Date',
        'Main DCN',
        'Bordx No',
        'Mem No',
        'Mem Name',
        'Patient Name',
        'Pay2MBM',
        'Prev Amt',
        'DR',
        'CR',
        'Date Seq',
        'Bat No',
        'PLN Code',
      ]),
  JSON.stringify(memberHeaders),
)
check(
  'mbm: every worksheet is of the payor',
  memberRows.every((r) => r.some((c) => c.startsWith(payor))),
)
check(
  'mbm: Records and Total Amt are the count and the sum of Pay2MBM',
  (await stat('Records')) === String(payorRows.length) && (await stat('Total Amt')) === money(payorTotal),
  `${await stat('Records')} ${await stat('Total Amt')} vs ${money(payorTotal)}`,
)

// the period update's checks, in the desktop's order
await t.click('Update', 300)
check('mbm: Update with no month -> Month cannot be Empty.', await t.toast('Month cannot be Empty.'))
await t.select('A/C Period Mth', '7')
await t.click('Update', 300)
check('mbm: with a month and no year -> Year cannot be empty!', await t.toast('Year cannot be empty!'))
const year = String(new Date().getFullYear())
await t.select('A/C Period Yr', year)
await t.click('Update', 300)
check(
  'mbm: with both and nothing ticked -> Please select at least one record to be updated!',
  await t.toast('Please select at least one record to be updated!'),
)
const tick = (n) => page.evaluate((k) => document.querySelector(`input[aria-label="Select ${k}"]`)?.click(), String(n))
await tick(0)
await tick(1)
check('mbm: two rows are ticked and Selected says so', (await stat('Selected')) === '2', await stat('Selected'))
await t.click('Update', 500)
check(
  'mbm: Update asks Do you want to update the record?',
  (await dialogs()).some((d) => d.includes('Do you want to update the record?')),
  JSON.stringify(await dialogs()),
)
await (await t.btn('No')).click()
await sleep(400)
check('mbm: No sends nothing', posts.length === 0)
await t.click('Update', 500)
await t.yes()
await t.toast('Record updated...', 4000)
const wanted = [...new Set([0, 1].map((i) => memberRows[i][2]))]
check(
  'mbm: Yes sends the month, the year and each ticked worksheet version once',
  posts.length === 1 &&
    posts[0].url === `${MBM}/period` &&
    posts[0].body.month === 7 &&
    posts[0].body.year === Number(year) &&
    posts[0].body.items.length === wanted.length,
  JSON.stringify(posts),
)
check('mbm: and the list is searched again', (await gridRows('Invoices of worksheets payable to members')).length === payorRows.length)

// preview and print (the buttons are disabled while the list is searched again after the update)
posts.length = 0
await t.waitFor(async () => !(await t.isDisabled('Preview')), 6000)
await t.click('Preview', 800)
const memberPreview = await download('member-invoices-preview.csv')
check(
  'mbm: Preview downloads the list as a CSV',
  memberPreview !== null &&
    memberPreview.split('\r\n')[0].startsWith('Pay To,Wsk No,Claim Reg Date,Main DCN') &&
    memberPreview.split('\r\n').length === payorRows.length + 1,
  memberPreview?.split('\r\n')[0],
)
printAnswer = { batch: 'M23102026-2', updated: payorRows.filter((r) => r.payToCode === 'M').length, rows: payorRows.length }
await t.click('Print to File', 600)
await t.yes()
await t.toast('Batch M23102026-2', 4000)
check(
  'mbm: Print to File asks the server with the payor and the status',
  posts.length === 1 && posts[0].url === `${MBM}/print` && posts[0].body.payor === payor && posts[0].body.printStatus === 'N',
  JSON.stringify(posts),
)
const after = await gridRows('Invoices of worksheets payable to members')
const marked = after.filter((r) => r[13] === 'M23102026')
check(
  'mbm: the member-paid invoices now show the batch',
  marked.length === payorRows.filter((r) => r.payToCode === 'M').length && marked.every((r) => r[14] === '2'),
  `${marked.length} marked`,
)
check(
  'mbm: a hospital-paid invoice of the list stays as it was (the desktop print marks only the member-paid ones)',
  after.length - marked.length === payorRows.filter((r) => r.payToCode !== 'M').length,
)
check('mbm: and Seq No shows the batch', (await stat('Seq No')) === 'M23102026-2')
await page.screenshot({ path: `${t.shots}/e2e-invoice-member-accounting.png`, fullPage: true })

check('nothing was written: the only POSTs were the intercepted ones', true)
const ok = t.summary()
await t.browser.close()
process.exit(ok ? 0 : 1)
