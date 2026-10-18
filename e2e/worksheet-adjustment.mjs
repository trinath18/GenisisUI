// Worksheet > Worksheet Adjustment: the saved worksheet with the editable payment details and remarks, and the credit / debit note and Excess letter, and Final LG. It reads real data; the
// requests that write (the save, the debit note numbering, the excess letter, which marks the case, and the Final LG, which numbers a letter) are intercepted and answered here, so nothing is written (the database writes are covered by the API's rolled-back database tests).
import { start, BASE } from './lib.mjs'
import { mint } from './mint.mjs'

const t = await start()
const { page, check } = t

const get = async (p) => (await fetch(`${BASE}${p}`, { headers: { Authorization: `Bearer ${mint()}` } })).json()
const options = (label) => t.field(label).then((el) => el.evaluate((s) => [...s.options].map((o) => o.value)))
const loaded = () =>
  t.waitFor(async () => (await t.readValue('Mem Num')) !== null && (await page.$('form[aria-label="Payment details and remarks"]')) !== null, 15000)

const puts = []
const posts = []
const fixture = { note: null, debit: null, excess: null, finalChecks: [], finalLg: null }
const finalPosts = []
const json = (status, body) => ({ status, contentType: 'application/json', body: JSON.stringify(body) })
await page.setRequestInterception(true)
page.on('request', (req) => {
  const path = new URL(req.url()).pathname
  if (req.method() === 'POST' && /\/api\/worksheet\/adjustment\/[^/]+\/\d+\/final-lg(\/check)?$/.test(path)) {
    finalPosts.push({ path, body: JSON.parse(req.postData()) })
    return req.respond(json(200, path.endsWith('/check') ? fixture.finalChecks.shift() : fixture.finalLg))
  }
  if (req.method() === 'GET' && fixture.note && /\/api\/worksheet\/adjustment\/[^/]+\/\d+\/note$/.test(path)) return req.respond(json(200, fixture.note))
  if (req.method() === 'POST' && /\/api\/worksheet\/adjustment\/[^/]+\/\d+\/(debit-note|excess-letter)$/.test(path)) {
    posts.push(path.split('/').pop())
    const answer = path.endsWith('debit-note') ? fixture.debit : fixture.excess
    return req.respond(answer.status ? json(answer.status, answer.body) : json(200, answer))
  }
  if (req.method() === 'PUT' && /\/api\/worksheet\/adjustment\/[^/]+\/\d+\/payment$/.test(req.url())) {
    puts.push({ path: new URL(req.url()).pathname, body: JSON.parse(req.postData()) })
    return req.respond({ status: 200, contentType: 'application/json', body: JSON.stringify({ message: 'Record Save' }) })
  }
  req.continue()
})

// A case with several worksheet versions, and its first version.
const found = await get('/api/worksheet/enquiry/cases?by=number&q=AH0000')
const cas = found.find((c) => c.versions >= 2)?.caseNo
check('data: the search finds a case with several worksheet versions', !!cas)
const v1 = await get(`/api/worksheet/enquiry/${cas}?version=1`)

// ---------------- The screen
await t.go(`/worksheet/adjustment?cas=${cas}`)
check('adjustment: title', (await page.$eval('h2', (e) => e.textContent)) === 'Worksheet Adjustment')
check('adjustment: the worksheet loads from the case number in the address', await loaded())
check(
  'adjustment: the three edit sections and the Update button are there',
  (await page.$$eval('form[aria-label="Payment details and remarks"] legend', (l) => l.map((x) => x.textContent))).join('|') ===
    "Payment details|Member's address|Note and remarks" && !(await t.isDisabled('Update')),
)
check(
  'adjustment: the payment panel of the enquiry is replaced by the editor',
  (await page.$$eval('fieldset legend', (l) => l.map((x) => x.textContent))).filter((x) => x === 'Payment and address').length === 0,
)

const o = v1.others ?? {}
check(
  'fields: they hold the saved values',
  (await t.value('Pay To')) === (v1.header.payTo ?? '').trim() &&
    (await t.value('Add 1')) === (o.address1 ?? '').trim() &&
    (await t.value('Post Code')) === (o.postCode ?? '').trim(),
  `${await t.value('Pay To')} / ${await t.value('Add 1')}`,
)
const banks = await options('Bank')
const states = await options('State')
check('lookups: banks come from the maintenance database', banks.includes('AFFIN BANK') && banks.length >= 20, String(banks.length))
check('lookups: states are listed', states.length >= 10, String(states.length))
check('lookups: payment mode offers BY POST and BANK-IN', JSON.stringify(await options('Pymt Mode')) === JSON.stringify(['', 'BY POST', 'BANK-IN']))
check('fields: Post Code holds six characters at most', (await (await t.field('Post Code')).evaluate((e) => e.maxLength)) === 6)

// ---------------- Update
await t.type('Note', 'e2e note')
await t.type('Add 2', 'Taman E2E')
await t.select('Pymt Mode', 'BANK-IN')
await t.click('Update')
check('update: it asks Are you sure?', await t.waitFor(() => page.$('[role=dialog]').then((d) => !!d)))
await t.yes()
check(
  'update: the confirmed save sends one PUT for this version',
  puts.length === 1 && puts[0].path === `/api/worksheet/adjustment/${cas}/1/payment`,
  JSON.stringify(puts.map((p) => p.path)),
)
check(
  'update: the request carries what was typed',
  puts[0]?.body.note === 'e2e note' && puts[0]?.body.address2 === 'Taman E2E' && puts[0]?.body.paymentMode === 'BANK-IN',
)
check(
  'update: Record Save is reported',
  (await t.toasts()).some((x) => x.includes('Record Save')),
  JSON.stringify(await t.toasts()),
)

await t.click('Update')
await page.waitForSelector('[role=dialog]')
await (await t.btn('No')).click()
check('update: answering No sends nothing', (await new Promise((r) => setTimeout(() => r(puts.length), 500))) === 1)

// ---------------- Credit / debit notes and the Excess letter
const real = await get(`/api/worksheet/adjustment/${cas}/1/note`)
check(
  'note: the real API answers with a kind, an amount that is not negative and the case',
  ['Credit', 'Debit', 'None'].includes(real.kind) && real.amount >= 0 && real.caseNo === cas && real.version === 1,
  JSON.stringify(real).slice(0, 120),
)
const enabled = async (label) => !(await t.isDisabled(label))
check(
  'buttons: Credit Note and Debit Note follow the real amount due; Exc Letter is always there',
  (await enabled('Credit Note')) === (real.kind === 'Credit') && (await enabled('Debit Note')) === (real.kind === 'Debit') && (await enabled('Exc Letter')),
  real.kind,
)

const baseNote = {
  kind: 'Credit',
  number: 'CAH00012',
  date: '2021-08-06T00:00:00',
  amount: 150,
  caseNo: cas,
  version: 1,
  patientName: 'ALI BIN ABU',
  memberNo: 'AHA0001*01',
  memberName: 'ABU BIN ALI',
  groupCompany: 'ACME BHD',
  companyPlan: false,
  hospital: 'PRINCE COURT MEDICAL CENTRE',
  admitted: '2021-07-17T00:00:00',
  disability: 'FISTULA\nABSCESS',
  address1: '1 Jalan Satu',
  address2: 'Taman Dua',
  address3: '',
  postCode: '50450',
  city: 'KUALA LUMPUR',
  state: 'WILAYAH PERSEKUTUAN',
  remarks: 'PLEASE REFUND',
}
const dialogText = () => page.$$eval('[role=dialog]', (ds) => ds.at(-1).textContent)
const closeDialog = async () => {
  await page.evaluate(() => [...document.querySelectorAll('[role=dialog] button')].find((b) => b.textContent.trim() === 'Close')?.click())
  await t.waitFor(async () => (await page.$('[role=dialog]')) === null)
}

fixture.note = baseNote
await t.go(`/worksheet/adjustment?cas=${cas}`)
await loaded()
check('credit note: only Credit Note is enabled when Medix owes the member', (await enabled('Credit Note')) && !(await enabled('Debit Note')))
await t.click('Credit Note')
let text = await dialogText().catch(() => '')
check(
  'credit note: the sheet shows number, amount, patient, member, hospital, disability and remarks',
  ['CREDIT NOTE', 'CAH00012', 'RM 150.00', 'ALI BIN ABU', 'AHA0001*01', `${cas} - 1`, 'PRINCE COURT', 'FISTULA', 'PLEASE REFUND'].every((x) =>
    text.includes(x),
  ),
  text.slice(0, 160),
)
check(
  'credit note: the address is printed with post code, city and state on one line',
  text.includes('50450 KUALA LUMPUR WILAYAH PERSEKUTUAN') && text.includes('1 Jalan Satu'),
)
check('credit note: it can be printed', (await page.$$eval('[role=dialog] button', (b) => b.map((x) => x.textContent.trim()))).includes('Print'))
await closeDialog()

fixture.note = { ...baseNote, kind: 'Debit', number: '', amount: 333.2 }
fixture.debit = { ...fixture.note, number: 'DAH00007', date: '2026-10-18T00:00:00' }
await t.go(`/worksheet/adjustment?cas=${cas}`)
await loaded()
check('debit note: only Debit Note is enabled when the member owes Medix', !(await enabled('Credit Note')) && (await enabled('Debit Note')))
await t.click('Debit Note', 800)
text = await dialogText().catch(() => '')
check(
  'debit note: making it asks the server once and shows the number it gave',
  posts.filter((x) => x === 'debit-note').length === 1 &&
    text.includes('DEBIT NOTE') &&
    text.includes('DAH00007') &&
    text.includes('RM 333.20') &&
    text.includes('AMOUNT DUE FROM YOU'),
  text.slice(0, 160),
)
await closeDialog()

fixture.note = { ...baseNote, kind: 'None', amount: 0 }
await t.go(`/worksheet/adjustment?cas=${cas}`)
await loaded()
check('no note: neither note button is enabled when nothing is due', !(await enabled('Credit Note')) && !(await enabled('Debit Note')))

fixture.excess = {
  template: 'MAS',
  excessNo: 'EAH00000782-1',
  excessDate: '2021-08-06T00:00:00',
  invoiceNo: 'A210028679',
  invoiceAmount: 3997.68,
  caseNo: cas,
  principalName: 'ABU BIN ALI',
  patientName: 'ALI BIN ABU',
  patientIc: '890705086092',
  planCode: 'BO48',
  staffNo: 'S123',
  costCenter: 'CC9',
  department: 'FINANCE',
  bordxNo: 'B77',
  admitted: '2021-07-17T00:00:00',
  discharged: '2021-07-18T00:00:00',
  hospital: 'PRINCE COURT MEDICAL CENTRE',
  hospitalContact: 'MS RANI',
  hospitalFax: '03-74911222',
  items: [
    { label: 'Room & Board', amount: 100 },
    { label: 'CERADAN CREAM (RM46.08)', amount: 77.5 },
  ],
  limitExceeded: 10,
  coPayment: 0,
  undertakenExcess: 0,
  totalExcess: 187.5,
  othersDescription: 'CERADAN CREAM (RM46.08)',
  issuedOn: '2026-10-18T00:00:00',
}
await t.click('Exc Letter', 800)
text = await dialogText().catch(() => '')
check(
  'excess letter: it asks the server once and shows the number, hospital contact and the amounts',
  posts.filter((x) => x === 'excess-letter').length === 1 &&
    ['EAH00000782-1', 'EXCESS PAYMENT NOTICE (MAS)', 'MS RANI', '03-74911222', 'Room & Board', '100.00', '77.50'].every((x) => text.includes(x)),
  text.slice(0, 160),
)
check(
  'excess letter: the limit exceeded and the total are listed; the MAS template adds staff number, cost center and department',
  ['Limit Exceeded', '10.00', 'Total Excess', '187.50', 'S123', 'CC9', 'FINANCE'].every((x) => text.includes(x)),
)
await closeDialog()

fixture.excess = { status: 404, body: { message: 'There is no excess record for this case.' } }
await t.click('Exc Letter', 800)
check(
  'excess letter: a case without an excess record says so and shows no letter',
  (await t.toast('There is no excess record for this case.')) && (await page.$('[role=dialog]')) === null,
  JSON.stringify(await t.toasts()),
)
fixture.note = null

// ---------------- Final LG
const finalTotal = Number(v1.summary.payableToHospital)
fixture.note = null
await t.go(`/worksheet/adjustment?cas=${cas}`)
await loaded()
await t.click('Final LG', 800)
text = await dialogText().catch(() => '')
check(
  'final LG: the guarantee letter dialog opens for this case',
  text.includes(`Final Guarantee Letter — ${cas}`) && text.includes('Issue Final LG'),
  text.slice(0, 120),
)
const purposes = await options('Purpose')
const modes = await options('Request Mode')
check(
  'final LG: the drop-down lists come from the Adjustment endpoints',
  purposes.includes('Discharge') && purposes.includes('Follow-up') && modes.includes('Email'),
  JSON.stringify(purposes),
)
check(
  'final LG: the GL amount starts as the worksheet final total payable to the hospital',
  (await t.value('GL Amount')) === finalTotal.toFixed(2),
  `${await t.value('GL Amount')} vs ${finalTotal.toFixed(2)}`,
)

await t.select('Purpose', 'Follow-up')
await t.select('Request Mode', 'Email')
await t.select('Request By', 'Hospital')
await t.type('Remarks', 'E2E FINAL LG')
const finalLetter = {
  lgNumber: 'LZN00007106-4',
  letter: {
    letter: 'L',
    title: 'Letter of Guarantee — Follow-up',
    fields: { caseNo: cas, lgNo: 'LZN00007106-4', patient: 'ALI BIN ABU', hospital: 'PRINCE COURT MEDICAL CENTRE', lgAmount: '123.45', remark: 'E2E FINAL LG' },
  },
}
fixture.finalLg = finalLetter

// the amount does not match the worksheet: the desktop warns and lets the user go on
fixture.finalChecks = [{ withinLimit: false, matchesWorksheet: false, finalTotal, prompt: 'Please check LG Amount, do you want to continue?' }]
await t.click('Issue Final LG', 600)
text = await dialogText().catch(() => '')
check(
  'final LG: a mismatch asks "Please check LG Amount, do you want to continue?" and nothing is issued yet',
  text.includes('Please check LG Amount, do you want to continue?') && finalPosts.length === 1 && finalPosts[0].path.endsWith('/final-lg/check'),
  JSON.stringify(finalPosts.map((x) => x.path)),
)
await page.evaluate(() => [...document.querySelectorAll('[role=dialog] button')].find((b) => b.textContent.trim() === 'No')?.click())
await new Promise((r) => setTimeout(r, 500))
check('final LG: answering No issues nothing', finalPosts.length === 1 && (await dialogText().catch(() => '')).includes('Issue Final LG'))

// the user goes on: payor AX asks the take-over clause first, then "Are you sure?"
fixture.finalChecks = [
  { takeOverCheck: true, withinLimit: false, matchesWorksheet: true, finalTotal, prompt: 'Have you checked Take Over clause?' },
  { withinLimit: true, matchesWorksheet: true, finalTotal, prompt: 'Are you sure?' },
]
await t.click('Issue Final LG', 600)
text = await dialogText().catch(() => '')
check('final LG: the take-over clause is asked first', text.includes('Have you checked Take Over clause?'))
await t.yes()
text = await dialogText().catch(() => '')
check(
  'final LG: after Yes the check is made again with the take-over answer and "Are you sure?" follows',
  finalPosts.length === 3 && finalPosts[2].body.takeOverChecked === true && text.includes('Are you sure?'),
  JSON.stringify(finalPosts.map((x) => x.body.takeOverChecked)),
)
await t.yes()
await t.waitFor(async () => (await dialogText().catch(() => '')).includes('LZN00007106-4'))
text = await dialogText().catch(() => '')
check(
  'final LG: the confirmed issue sends one request for this version with what was typed',
  finalPosts.length === 4 &&
    finalPosts[3].path === `/api/worksheet/adjustment/${cas}/1/final-lg` &&
    finalPosts[3].body.purpose === 'Follow-up' &&
    finalPosts[3].body.remarks === 'E2E FINAL LG' &&
    Math.abs(finalPosts[3].body.lgAmount - finalTotal) < 0.005,
  JSON.stringify(finalPosts.at(-1)),
)
check(
  'final LG: the letter opens with the LG number it was given',
  text.includes('LZN00007106-4') && (await t.toasts()).some((x) => x.includes('Final LG LZN00007106-4 issued')),
  text.slice(0, 120),
)
await closeDialog()
check('final LG: the dialog is closed after the letter', (await page.$('[role=dialog]')) === null)

// ---------------- Master and the cumulative views are not versions
await t.select('Version', 'Master')
check(
  'master: the editor gives way to a hint and the Update button is gone',
  await t.waitFor(
    async () =>
      (await page.evaluate(() => document.body.textContent.includes('Choose one worksheet version'))) &&
      (await page.$('form[aria-label="Payment details and remarks"]')) === null,
  ),
)

// ---------------- Menu and access
const nav = await page.$$eval('.sidebar a', (els) => els.map((e) => e.textContent.trim()))
check('menu: Adjustment is a live item of the Worksheet section', nav.includes('Adjustment'))

const access = '1'.repeat(22) + '0' + '1'.repeat(7)
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
await limited.goto(`${BASE}/worksheet/adjustment`, { waitUntil: 'networkidle0' })
await limited.waitForSelector('h2')
check('access: without position 23 the page says Access Denied!', (await limited.$eval('h2', (e) => e.textContent)) === 'Access Denied!')
const put = await fetch(`${BASE}/api/worksheet/adjustment/${cas}/1/payment`, {
  method: 'PUT',
  headers: { Authorization: `Bearer ${mint(access)}`, 'Content-Type': 'application/json' },
  body: '{}',
})
check('access: and the API refuses the save with 403', put.status === 403, String(put.status))
const read = await fetch(`${BASE}/api/worksheet/enquiry/${cas}`, { headers: { Authorization: `Bearer ${mint('1'.repeat(12) + '0' + '1'.repeat(17))}` } })
check('access: a user with Adjustment but not Enquiry can still read the worksheet', read.status === 200, String(read.status))

const ok = t.summary()
await t.browser.close()
process.exit(ok ? 0 : 1)
