import path from 'node:path'
import { start, sleep, BASE } from './lib.mjs'
import { mint } from './mint.mjs'

/**
 * Case > Registration (/case/registration) against the ZZ test member ZZHA0000518*01: finding the member, what its expired membership does to the
 * Register button, the save messages in the desktop's order, the confirmations, and one real registration whose rows e2e/cleanup.sql removes again
 * (it deletes every case opened by E2E on the ZZ payor and puts the ZZ case counter back).
 */
const t = await start()
const { page, check } = t
const MEMBER = 'ZZHA0000518*01'
const HOSPITAL = 'AL-ISLAM SPECIALIST HOSPITAL'
let validates = 0
let retriedClicks = 0
page.on('request', (r) => r.url().includes('/api/case/registration/validate') && validates++)
const get = async (p) => {
  const r = await fetch(`${BASE}${p}`, { headers: { Authorization: `Bearer ${mint()}` } })
  return { status: r.status, body: await r.json().catch(() => null) }
}
const dialogs = () => page.$$eval('[role=dialog]', (d) => d.map((x) => x.textContent.replace(/\s+/g, ' ').trim()))
const typeIn = async (label, text) => {
  const el = await t.field(label)
  await el.focus()
  await page.keyboard.type(text)
  await page.keyboard.press('Tab')
  await sleep(450)
}
const unitSelect = async () =>
  (
    await page.evaluateHandle(() =>
      [...document.querySelectorAll('label.form-field')]
        .find((x) => x.querySelector('span')?.textContent.replace('*', '').trim() === 'Patient Age')
        ?.querySelector('select'),
    )
  ).asElement()
const open = async () => {
  await page.goto(`${BASE}/case/registration`, { waitUntil: 'networkidle0' })
  await page.waitForSelector('legend')
  await sleep(400)
}
const loadMember = async () => {
  await t.type('Membership No', MEMBER)
  await t.click('Go', 2500)
}
/** The desktop lets an expired membership register only with both date checks switched off. */
const untickDateChecks = async () => {
  await page.evaluate(() => document.querySelectorAll('label.check input').forEach((i) => i.checked && i.click()))
  await sleep(300)
}
/**
 * Clicks Register and makes sure the click did something. The validation toasts used to stack down from the top right over the Register button, so a click soon after a
 * message landed on a toast (the click log showed DIV.toast as the target) and sent nothing. The toasts no longer take clicks (index.css), and the suite checks that no click
 * was ignored; one retry is still allowed so that a stray failure does not hide the checks after it.
 */
const clickRegister = async () => {
  const before = validates
  await t.click('Register', 100)
  if (await t.waitFor(async () => validates > before, 2500)) return
  retriedClicks++
  await t.click('Register', 100)
}
/** Clicks Register and waits for the toast it should show (they time out, and the list is short, so look for the text rather than counting). */
const clickAndExpect = async (message) => {
  await clickRegister()
  return t.toast(message, 6000)
}

// ---------------- the page and the member
const earlier = ((await get('/api/case/ZZ00000106/member-cases')).body ?? []).filter((c) => (c.CaseOpenBy ?? '').trim() === 'E2E')
check('precondition: no case of an earlier run is left (otherwise run e2e/cleanup.sql)', earlier.length === 0, earlier.map((c) => c.CASNumber).join(', '))
await open()
check('registration: the page opens', (await page.$eval('legend', (e) => e.textContent)) === 'Case Registration')
check('registration: Register is disabled before a member is loaded', await t.isDisabled('Register'))
await t.type('Membership No', 'NO SUCH MEMBER')
await t.click('Go', 1200)
check('registration: an unknown member -> No record found!', await t.toast('No record found!'))
await loadMember()
check(
  'registration: the ZZ member loads with the desktop alert for an expired membership',
  await t.toast('Membership has been expired!'),
  JSON.stringify(await t.toasts()),
)
check(
  'registration: the case status is Open and cannot be changed',
  (await t.value('Case Status')) === 'O' && (await (await t.field('Case Status')).evaluate((e) => e.disabled)),
)
check('registration: claimability defaults to AA', (await t.value('Claimability')) === 'AA')
const patients = await (await t.field('Patient')).evaluate((s) => [...s.options].map((o) => o.value))
check('registration: the member has patients 00, 01 and 02', JSON.stringify(patients) === JSON.stringify(['', '00', '01', '02']), JSON.stringify(patients))
check('registration: an expired membership keeps Register disabled while the date checks are on', await t.isDisabled('Register'))
await t.select('Patient', '00')
await sleep(700)
check('registration: choosing the patient fills the IC number', ((await t.readValue('Patient IC')) ?? '').length > 0)
await untickDateChecks()
check('registration: switching the date checks off enables Register (the desktop back-dating route)', !(await t.isDisabled('Register')))

// ---------------- the save messages, in the desktop's order
check('messages: nothing else filled -> Please Enter Hospital Information', await clickAndExpect('Please Enter Hospital Information'))
await typeIn('Hospital', HOSPITAL)
await sleep(1200)
check('messages: hospital set -> Please Enter Admission Date', await clickAndExpect('Please Enter Admission Date'))
await typeIn('D.O.A', '02082021')
await typeIn('D.O.D', '03082021')
check('messages: dates set, cashless -> Please Enter ICD Code', await clickAndExpect('Please Enter ICD Code'))
await t.select('Cash Type', 'R')
check("messages: reimbursement -> Please Enter Patient's Age", await clickAndExpect("Please Enter Patient's Age"))
await typeIn('Patient Age', '30')
check('messages: age without a unit -> Please Select Week/Month/Year', await clickAndExpect('Please Select Week/Month/Year'))

// ---------------- the confirmations and the registration
await (await unitSelect()).select('Y')
await sleep(300)
await clickRegister()
check(
  'save: a complete form asks Are you sure',
  await t.waitFor(async () => (await dialogs()).some((d) => d.includes('Are you sure')), 8000),
  JSON.stringify(await dialogs()),
)
await (await t.btn('No')).click()
await sleep(500)
check('save: answering No registers nothing', (await page.$$('.case-no')).length === 0 && !(await t.toasts()).some((x) => x.startsWith('Record Saved')))
check('save: and Register is enabled again', !(await t.isDisabled('Register')))
await clickRegister()
await t.waitFor(async () => (await dialogs()).some((d) => d.includes('Are you sure')), 8000)
await t.yes()
const saved = await t.waitFor(async () => (await t.toasts()).some((x) => x.startsWith('Record Saved, Your Case No is : ')), 15000)
check('save: Yes registers the case', saved, JSON.stringify(await t.toasts()))
const caseNo = ((await page.$$eval('.case-no', (e) => e.map((x) => x.textContent)))[0] ?? '').trim()
check('save: the case number is a ZZ number and is shown', /^ZZ\d{8}$/.test(caseNo), caseNo)
check('save: Register is disabled for the registered case', await t.isDisabled('Register'))
check(
  'save: the expired membership letter is shown for the new case',
  await t.waitFor(async () => (await dialogs()).some((d) => d.includes('Membership Expired') && d.includes(caseNo)), 8000),
  JSON.stringify(await dialogs()),
)
await page.keyboard.press('Escape')
await sleep(400)
await page.screenshot({ path: path.join(t.shots, 'e2e-case-registration.png'), fullPage: true })

// ---------------- what was saved
const saved1 = await get(`/api/case/${caseNo}`)
check('saved: the case can be read back', saved1.status === 200 && saved1.body?.CASNumber === caseNo, String(saved1.status))
check(
  'saved: it belongs to the member and patient 00, open, accepted',
  saved1.body?.MBMNumber === MEMBER && saved1.body?.MBMPatientCovID === '00' && saved1.body?.CASStatus === 'O' && saved1.body?.CASClaimability === 'AA',
  JSON.stringify(saved1.body),
)
check(
  'saved: with the admission date, stay type and reimbursement as entered',
  String(saved1.body?.CASDateAdmitted).startsWith('2021-08-02') && saved1.body?.CASStayType === 'I' && saved1.body?.CASPAYType === 'R',
  `${saved1.body?.CASDateAdmitted} ${saved1.body?.CASStayType} ${saved1.body?.CASPAYType}`,
)
check(
  'saved: the hospital is the one chosen',
  typeof saved1.body?.CASHOSCode === 'string' && saved1.body.CASHOSCode.trim().length > 0,
  String(saved1.body?.CASHOSCode),
)

// ---------------- the same patient and admission date again
await t.click('Clear', 500)
check('clear: the registered case disappears and Register is disabled', (await page.$$('.case-no')).length === 0 && (await t.isDisabled('Register')))
check('clear: the membership number is empty', (await t.value('Membership No')) === '')
await loadMember()
await t.select('Patient', '00')
await sleep(700)
await untickDateChecks()
await typeIn('Hospital', HOSPITAL)
await sleep(1200)
await typeIn('D.O.A', '02082021')
await typeIn('D.O.D', '03082021')
await t.select('Cash Type', 'R')
await typeIn('Patient Age', '30')
await (await unitSelect()).select('Y')
await sleep(300)
await clickRegister()
check(
  'again: the same patient and admission date asks whether to continue (not discharged)',
  await t.waitFor(async () => (await dialogs()).some((d) => d.includes('Patient has not been discharged, do you want to continue')), 8000),
  JSON.stringify(await dialogs()),
)
await (await t.btn('No')).click()
await sleep(500)
check('again: answering No registers nothing more', (await page.$$('.case-no')).length === 0)

check('clicks: no Register click was ignored by the page (the messages do not catch clicks)', retriedClicks === 0, `${retriedClicks} repeated`)
console.log(`screenshots: ${t.shots}`)
console.log(`registered ${caseNo}: run  sqlcmd -S MYDELL -d HISDB -E -C -b -i e2e/cleanup.sql  to remove it`)
const ok = t.summary()
await t.browser.close()
process.exit(ok ? 0 : 1)
