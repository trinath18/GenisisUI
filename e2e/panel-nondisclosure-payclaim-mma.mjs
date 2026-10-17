import path from 'node:path'
import { start, sleep } from './lib.mjs'

const t = await start()
const { page, check } = t
const CASE = 'ZZ00000106'

// ---------------- Panel Hospitals
await t.go('panel-hospitals')
await t.click('Search')
check('panel: empty search -> required error', (await t.errors()).includes('Please Select Hospital Panel Code!'), JSON.stringify(await t.errors()))
const codes = await page.$$eval('datalist option', (o) => o.map((x) => x.value))
check('panel: panel codes loaded from the API', codes.length > 5, String(codes.length))
let panelRows = []
for (const code of codes.slice(0, 12)) {
  await t.type('Hospital Panel Code', code)
  await t.click('Search')
  await sleep(900)
  panelRows = (await t.rowsOf('Panel hospitals')).filter((r) => r.length > 1)
  if (panelRows.length) break
}
check('panel: search lists hospitals', panelRows.length > 0, JSON.stringify(panelRows?.[0]))
check('panel: record counter matches', (await page.$eval('.stat, [class*=stat]', (e) => e.textContent)).includes(String(panelRows.length)), '')
await page.screenshot({ path: path.join(t.shots, 'e2e-panel.png') })
await t.type('Hospital Panel Code', 'NO SUCH PANEL')
await t.click('Search', 800)
check('panel: unknown code -> No Record Found', await t.toast('No Record Found!'))
await t.click('Clear')

// ---------------- Non-Disclosure
await t.go('non-disclosure')
check('nondisc: Update disabled before Load', await t.isDisabled('Update'))
await t.type('Case No', 'NO SUCH CASE')
await t.click('Load', 800)
check('nondisc: unknown case -> No record found', await t.toast('No record found!'))
await t.type('Case No', CASE)
await t.click('Load')
check('nondisc: Update enabled after Load', await t.waitFor(async () => !(await t.isDisabled('Update'))))
check('nondisc: others text disabled until the Others category', await (await t.field('Pre-Existing Others')).evaluate((e) => e.disabled))
await t.select('Category', '4').catch(() => {})
const cats = await page.$$('select')
await cats[0].select('4')
await sleep(200)
check('nondisc: category 4 enables Pre-Existing Others', !(await (await t.field('Pre-Existing Others')).evaluate((e) => e.disabled)))
await t.type('Pre-Existing Others', 'old knee injury')
await page.evaluate(() =>
  [...document.querySelectorAll('fieldset')]
    .find((f) => f.querySelector('legend')?.textContent === 'Pre-Existing Illness')
    .querySelectorAll('input')[0]
    .focus(),
)
await page.keyboard.type('01022020')
await t.click('Update')
await t.yes()
check('nondisc: update saved', await t.toast('Record Updated Successfully'), JSON.stringify(await t.toasts()))
await t.click('Clear')
await t.type('Case No', CASE)
await t.click('Load')
await t.waitFor(async () => !(await t.isDisabled('Update')))
check('nondisc: reload shows the saved values', (await t.value('Pre-Existing Others')) === 'old knee injury', await t.value('Pre-Existing Others'))
const preDate = await page.evaluate(
  () =>
    [...document.querySelectorAll('fieldset')].find((f) => f.querySelector('legend')?.textContent === 'Pre-Existing Illness').querySelectorAll('input')[0]
      .value,
)
check('nondisc: date round-trips as dd/mm/yyyy', preDate === '01/02/2020', preDate)
await page.screenshot({ path: path.join(t.shots, 'e2e-nondisc.png') })

// ---------------- Pay & Claim
await t.go('pay-claim')
await t.type('Case No', 'NO SUCH CASE')
await t.click('Load', 800)
check('payclaim: unknown case -> Record not found', await t.toast('Record not found!'))
await t.type('Case No', CASE)
await t.click('Load', 1000)
const members = await t.rowsOf('Members on the case')
check('payclaim: lists principal + covered persons', members && members.length === 3, JSON.stringify(members?.map((r) => r.slice(0, 3))))
check('payclaim: no record yet -> Add enabled, Edit disabled', !(await t.isDisabled('Add')) && (await t.isDisabled('Edit')))
await t.click('Add')
await t.checkbox('Awaiting lab test result which is pending')
await t.checkbox('Others')
await t.click('Save')
check('payclaim: Others without remarks -> error', (await t.errors()).includes('Please enter Remarks.'), JSON.stringify(await t.errors()))
await t.type('Others remarks', 'waiting for doctor')
await t.click('Save')
await t.yes()
check('payclaim: saved', await t.toast('Record Saved...'), JSON.stringify(await t.toasts()))
await sleep(600)
const hist = await t.rowsOf('Pay and claim history')
check(
  'payclaim: history shows the new record',
  hist && hist.length === 1 && hist[0][2] === 'Y' && hist[0][8] === 'Y' && hist[0][9] === 'waiting for doctor',
  JSON.stringify(hist),
)
check('payclaim: Add now disabled, Edit enabled', (await t.isDisabled('Add')) && !(await t.isDisabled('Edit')))
check(
  'payclaim: header fields filled',
  (await t.readValue('Membership No')) === 'ZZHA0000518*01' && (await t.readValue('Principal Name')) === 'TEMP NAME 1',
  `${await t.readValue('Membership No')}`,
)
await t.click('Edit')
await t.checkbox('Conflicting information provided')
await t.click('Save')
await t.yes()
check('payclaim: edited', await t.toast('Record Updated...'), JSON.stringify(await t.toasts()))
await sleep(600)
const hist2 = await t.rowsOf('Pay and claim history')
check('payclaim: history shows the edit', hist2?.[0]?.[3] === 'Y', JSON.stringify(hist2))
await page.screenshot({ path: path.join(t.shots, 'e2e-payclaim.png') })

// ---------------- MMA / CPT
await t.go('mma-cpt')
await t.type('Main Body Part', 'Conj')
await t.click('Search', 1200)
const procs = await t.rowsOf('MMA procedures')
check(
  'mma: procedure search by main body part',
  procs && procs.length >= 3 && procs.every((r) => r[1].toLowerCase().includes('conj')),
  JSON.stringify(procs?.slice(0, 2)),
)
await t.click('Add')
await t.type('Main Body Part', 'E2E Test BP')
await t.type('OPCS Code', 'E2E01')
await t.click('Save')
check(
  'mma: mandatory narrative + page no',
  (await t.errors()).includes('Please Enter OPCS Narrative') && (await t.errors()).includes('Please Enter Page No'),
  JSON.stringify(await t.errors()),
)
await t.type('OPCS Narrative', 'E2E narrative')
await t.type('Page No', '99')
await t.select('Part', 'B')
await t.click('Save')
await t.yes()
check('mma: procedure saved', await t.toast('Record Saved...'), JSON.stringify(await t.toasts()))
await sleep(1500)
await t.type('Main Body Part', 'E2E Test')
await t.click('Search', 1200)
let found = await t.rowsOf('MMA procedures')
check('mma: new procedure found by search', found && found.length === 1 && found[0][3] === 'E2E narrative' && found[0][6] === 'B', JSON.stringify(found))
await page.evaluate(() =>
  [...document.querySelectorAll('table[aria-label="MMA procedures"] tbody tr')].find((tr) => tr.textContent.includes('E2E Test BP'))?.click(),
)
await sleep(300)
await t.click('Edit')
await t.type('OPCS Narrative', 'E2E narrative edited')
await t.click('Save')
await t.yes()
check('mma: procedure updated', await t.toast('Record Updated...'), JSON.stringify(await t.toasts()))
await sleep(1500)
await t.type('Main Body Part', 'E2E Test')
await t.click('Search', 1200)
found = await t.rowsOf('MMA procedures')
check('mma: edit visible in the list', found?.[0]?.[3] === 'E2E narrative edited', JSON.stringify(found))
await page.evaluate(() =>
  [...document.querySelectorAll('table[aria-label="MMA procedures"] tbody tr')].find((tr) => tr.textContent.includes('E2E Test BP'))?.click(),
)
await sleep(300)
await t.click('Delete')
await t.yes()
check('mma: procedure deleted', await t.toast('Record Deleted...'), JSON.stringify(await t.toasts()))
await sleep(1500)
await t.type('Main Body Part', 'E2E Test')
await t.click('Search', 1200)
check('mma: deleted procedure no longer found', await t.toast('Record not found'), JSON.stringify(await t.toasts()))

// fees
await t.tab('Look Up Table')
await t.click('Search', 1200)
const fees = await t.rowsOf('MMA look-up fees')
check('mma: look-up table lists the fee schedule', fees && fees.length >= 20, String(fees?.length))
await t.click('Add')
await t.type("Surgeon's Category", 'SE2E')
await t.type("Surgeon's Fees", '123.5')
await t.type("Anaesthetist's Category", 'AE2E')
await t.type("Anaesthetist's Fees", '45')
await t.click('Save')
await t.yes()
check('mma: fee saved', await t.toast('Record Saved...'), JSON.stringify(await t.toasts()))
await sleep(1500)
await t.type("Surgeon's Category", 'SE2E')
await t.click('Search', 1200)
const fee = await t.rowsOf('MMA look-up fees')
check('mma: new fee row (123.50 / 45.00)', fee && fee.length === 1 && fee[0][2] === '123.50' && fee[0][4] === '45.00', JSON.stringify(fee))
await page.evaluate(() =>
  [...document.querySelectorAll('table[aria-label="MMA look-up fees"] tbody tr')].find((tr) => tr.textContent.includes('SE2E'))?.click(),
)
await sleep(300)
await t.click('Delete')
await t.yes()
check('mma: fee deleted', await t.toast('Record Deleted...'), JSON.stringify(await t.toasts()))
await page.screenshot({ path: path.join(t.shots, 'e2e-mma.png') })

process.exitCode = t.summary() ? 0 : 1
await t.browser.close()
