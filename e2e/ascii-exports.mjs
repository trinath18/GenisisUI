import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { start, sleep } from './lib.mjs'

const downloads = path.join(os.tmpdir(), 'genisis-e2e-downloads')
fs.rmSync(downloads, { recursive: true, force: true })
const t = await start(downloads)
const { page, check } = t

await t.go('claim-ascii')
// ---------------- Claim ASCII
await t.click('Generate')
check('claim ascii: payor + dates required', (await t.errors()).includes('Please enter the Payor code.'), JSON.stringify(await t.errors()))
await t.type('Payor', 'GC')
await t.type('Bordx Date from', '01072021')
await t.type('Bordx Date to', '31082021')
await t.click('Generate')
await t.yes()
check('claim ascii: file generated', await t.toast('File Generated Sucessfully'), JSON.stringify(await t.toasts()))
await sleep(1500)
const claimName = await t.readValue('Export file name')
check('claim ascii: file name shown (GC<yymmdd>(batch))', /^GC\d{6}\(\d{5}\)$/.test(claimName ?? ''), claimName)
const claimFile = `${process.env.E2E_ASCII_DIR}/claim/${claimName}`
const claimText = fs.existsSync(claimFile) ? fs.readFileSync(claimFile, 'latin1') : ''
const claimLines = claimText.split('\r\n')
check(
  'claim ascii: server file has header, 4 records, trailer',
  claimLines[0]?.startsWith('FMX') && claimLines.length === 7 && claimLines[5].startsWith('T4'),
  `${claimLines.length} lines`,
)
check(
  'claim ascii: records are 5000 wide',
  claimLines.slice(1, 5).every((l) => l.length === 5000),
  claimLines
    .slice(1, 5)
    .map((l) => l.length)
    .join(','),
)
await t.waitFor(() => fs.existsSync(`${downloads}/${claimName}`))
check(
  'claim ascii: browser downloaded the same file under the same name',
  fs.existsSync(`${downloads}/${claimName}`) && fs.readFileSync(`${downloads}/${claimName}`, 'latin1') === claimText,
  fs.readdirSync(downloads).join(','),
)
await t.click('Generate')
await t.yes()
check('claim ascii: second run has nothing new', await t.toast('No record found!'))
await t.click('Clear')
await page.evaluate(() =>
  [...document.querySelectorAll('label.radio')]
    .find((x) => x.textContent.includes('Rejected'))
    ?.querySelector('input')
    ?.click(),
)
await sleep(200)
await t.type('Payor', 'AN')
await t.type('Case Reg. Date from', '01072021')
await t.type('Case Reg. Date to', '31082021')
await t.click('Generate')
await t.yes()
check('claim ascii: rejected cases file generated', await t.toast('File Generated Sucessfully'), JSON.stringify(await t.toasts()))
await page.screenshot({ path: path.join(t.shots, 'e2e-claim-ascii.png') })

// ---------------- Case ASCII
await t.go('case-ascii')
await t.type('Payor', 'BI')
await t.type('Case Reg. Date from', '06082021')
await t.type('Case Reg. Date to', '06082021')
await t.click('Generate')
await t.yes()
check('case ascii: file generated', await t.toast('File Generated Sucessfully'), JSON.stringify(await t.toasts()))
await sleep(1200)
const caseName = await t.readValue('Export file name')
const caseFile = `${process.env.E2E_ASCII_DIR}/case/${caseName}`
const caseText = fs.existsSync(caseFile) ? fs.readFileSync(caseFile, 'latin1') : ''
const caseLines = caseText.split('\r\n')
check(
  'case ascii: one 4975-wide record, no header/trailer',
  caseLines.length === 2 && caseLines[0].length === 4975 && caseLines[0].startsWith('NBI'),
  `${caseLines.length} lines, ${caseLines[0]?.length}`,
)
check(
  'case ascii: total cases counter',
  (await page.$$eval('.stat, [class*=stat]', (e) => e.map((x) => x.textContent))).some((x) => x.includes('Total Cases') && x.includes('1')),
)
await page.screenshot({ path: path.join(t.shots, 'e2e-case-ascii.png') })

process.exitCode = t.summary() ? 0 : 1
await t.browser.close()
