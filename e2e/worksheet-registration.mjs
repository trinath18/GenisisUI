// Worksheet > Worksheet Registration. The Recalculate tab: a saved worksheet worked out from its invoices and the plan, beside what was saved. The Register tab: the next worksheet of a case;
// what only reads and the checks that stop a save run against the real API and data, and the POST that would write is intercepted and answered here (the database write is covered by the API's own
// rolled-back database tests), so nothing is written.
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { start, BASE, sleep } from './lib.mjs'
import { mint } from './mint.mjs'

const downloads = path.join(os.tmpdir(), 'genisis-e2e-registration-downloads')
fs.rmSync(downloads, { recursive: true, force: true })
const t = await start(downloads)
const { page, check } = t

const get = async (p, token = mint()) => fetch(`${BASE}${p}`, { headers: { Authorization: `Bearer ${token}` } })
const json = async (p) => (await get(p)).json()
const number = (text) =>
  Number(
    String(text ?? '')
      .replace(/,/g, '')
      .replace(/[()]/g, (c) => (c === '(' ? '-' : '')),
  )
const gridRows = async (caption) => (await t.rows(caption)).filter((r) => r.length > 1)
const waitLoaded = () => t.waitFor(async () => (await gridRows('Worksheet')).length === 29, 20000)

// Data: a case with several worksheet versions and an approved amount.
const found = await json('/api/worksheet/enquiry/cases?by=number&q=AH0000')
const cas = found.find((c) => c.versions >= 2)?.caseNo
check('data: the search finds a case with several worksheet versions', !!cas, `${found.length} cases`)
const latest = await json(`/api/worksheet/calculation/${cas}`)
const first = await json(`/api/worksheet/calculation/${cas}?version=${latest.versions[0]}`)
check(
  'api: 29 rows, a calculated and a saved summary, captions on every row',
  latest.lines.length === 29 && !!latest.calculated && !!latest.saved && latest.lines.every((l) => l.benefit),
  `${latest.lines.length}`,
)
check(
  'api: the latest version is the default and the first can be asked for',
  latest.version === Math.max(...latest.versions) && first.version === latest.versions[0],
)
check('api: an unknown case is Record not found! (404)', (await get('/api/worksheet/calculation/NO%20SUCH%20CASE')).status === 404)

// ---------------- The page
await t.go('/worksheet/registration')
check('registration: title', (await page.$eval('h2', (e) => e.textContent)) === 'Worksheet Registration')
check(
  'registration: the two tabs are Register and Recalculate a saved worksheet, Register first',
  JSON.stringify(await page.$$eval('[role=tab]', (tabs) => tabs.map((x) => [x.textContent.trim(), x.getAttribute('aria-selected')]))) ===
    JSON.stringify([
      ['Register', 'true'],
      ['Recalculate a saved worksheet', 'false'],
    ]),
)
await t.tab('Recalculate a saved worksheet')
check(
  'registration: the recalculate tab says plainly that nothing is written there',
  (await page.$eval('main', (m) => m.textContent ?? '')).includes('and nothing is written here'),
)
await t.click('Calculate')
check('registration: a case number is required', (await t.errors()).includes('Please enter Case Number!'), JSON.stringify(await t.errors()))
await t.type('Case No', 'NO SUCH CASE')
await t.click('Calculate', 800)
check(
  'registration: an unknown case says Record not found!',
  await t.waitFor(async () => (await page.$$eval('p.error', (e) => e.map((x) => x.textContent))).includes('Record not found!'), 10000),
)

await t.type('Case No', cas)
await t.click('Calculate')
check('registration: the grid has the 29 rows', await waitLoaded(), String((await gridRows('Worksheet')).length))
const rows = await gridRows('Worksheet')
check(
  'registration: the first row is Room & Board and the captions match the server',
  rows[0][0].toLowerCase().includes('room') && rows.every((r, i) => r[0] === latest.lines[i].benefit),
  rows[0][0],
)
const summary = await gridRows('Worksheet summary')
const totalRow = summary.find((r) => r[0] === 'Total approved')
check('registration: the summary has the five rows', summary.length === 5, String(summary.length))
check(
  "registration: total approved shown is the server's calculated figure",
  Math.abs(number(totalRow?.[1]) - latest.calculated.totalApproved) < 0.005,
  JSON.stringify(totalRow),
)
check(
  'registration: and the saved figure beside it is the saved one',
  Math.abs(number(totalRow?.[2]) - latest.saved.totalApproved) < 0.005,
  JSON.stringify(totalRow),
)
const versionOptions = await (await t.field('Version')).evaluate((s) => [...s.options].map((o) => o.value))
check(
  "registration: the version list is the case's versions",
  JSON.stringify(versionOptions) === JSON.stringify(latest.versions.map(String)),
  JSON.stringify(versionOptions),
)
check('registration: it shows the days summed over the invoices', (await page.$eval('main', (m) => m.textContent ?? '')).includes('summed over the invoices'))

await t.select('Version', String(first.version))
check(
  'registration: choosing another version calculates that version',
  await t.waitFor(async () => {
    const r = (await gridRows('Worksheet summary')).find((x) => x[0] === 'Total approved')
    return (
      !!r &&
      Math.abs(number(r[1]) - first.calculated.totalApproved) < 0.005 &&
      (await (await t.field('Version')).evaluate((s) => s.value)) === String(first.version)
    )
  }, 15000),
)
await page.screenshot({ path: path.join(t.shots, 'registration.png'), fullPage: true })

// ---------------- The Register tab
const registerUrl = (c) => `/api/worksheet/registration/${encodeURIComponent(c)}`
let regCas = cas
let form = await json(registerUrl(cas))
for (const c of found) {
  if (form.blocked === null) break
  regCas = c.caseNo
  form = await json(registerUrl(regCas))
}
check('register data: a case the save can do is found', form.blocked === null, `${regCas}: ${form.blocked}`)
check(
  'register api: the form of the next worksheet: a version number, 29 rows, the 12 statuses, no invoice yet',
  form.version >= 1 && form.lines.length === 29 && form.statuses.length === 12 && form.invoices.length === 0 && form.case.caseNo === regCas,
  `v${form.version} ${form.lines.length} ${form.statuses.length} ${form.invoices.length}`,
)
check('register api: an unknown case is Record not found! (404)', (await get(registerUrl('NO SUCH CASE'))).status === 404)
const post = (body, token = mint()) =>
  fetch(`${BASE}${registerUrl(regCas)}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
const noInvoice = await post({ worksheetStatus: 'AA', payment: {}, confirmed: true })
check(
  'register api: a worksheet without an invoice is refused with the desktop message and nothing is written, even when confirmed',
  noInvoice.status === 400 && (await noInvoice.json()).message === 'Worksheet cannot be saved without any invoice!',
)

let mock = null
const posts = []
await page.setRequestInterception(true)
page.on('request', (req) => {
  const url = req.url()
  if (mock && /\/api\/worksheet\/registration\//.test(url)) {
    if (req.method() === 'GET') return req.respond({ status: 200, contentType: 'application/json', body: JSON.stringify(mock.form) })
    if (req.method() === 'POST') {
      const body = JSON.parse(req.postData())
      posts.push(body)
      return req.respond({ status: 200, contentType: 'application/json', body: JSON.stringify(body.confirmed ? mock.saved : mock.asked) })
    }
  }
  req.continue()
})
// the Register tab and the Register button have the same text: the button is the submit one
const registerButton = () => page.evaluateHandle(() => [...document.querySelectorAll('button[type=submit]')].find((b) => b.textContent.trim() === 'Register'))
const clickRegister = async (ms = 600) => {
  await (await registerButton()).asElement().click()
  await sleep(ms)
}
const dialogs = () => page.$$eval('[role=dialog]', (d) => d.map((x) => x.textContent.replace(/\s+/g, ' ').trim()))
const show = async (c) => {
  await t.type('Case No', c)
  await t.click('Show', 700)
}

await t.go('/worksheet/registration')
check('register: the Register tab is open and asks for a case', (await t.field('Case No')) !== null && (await t.isDisabled('Show')) === false)
await t.click('Show', 400)
check('register: a case number is required', (await t.errors()).includes('Please enter Case Number!'), JSON.stringify(await t.errors()))
await show('NO SUCH CASE')
check(
  'register: an unknown case says Record not found!',
  await t.waitFor(async () => (await page.$$eval('p.error', (e) => e.map((x) => x.textContent))).includes('Record not found!'), 10000),
)

await show(regCas)
check(
  'register: the real case shows its worksheet number and says no invoice has been entered',
  (await t.waitFor(async () => (await t.readValue('Worksheet')) === String(form.version), 10000)) &&
    (await page.$eval('main', (m) => m.textContent ?? '')).includes('No invoice has been entered'),
  String(await t.readValue('Worksheet')),
)
check(
  'register: the real grid has the 29 rows beside the invoices table and the status starts from the case',
  (await gridRows('Worksheet')).length === 29 && (await t.value('Worksheet Status')) === form.defaultStatus,
)
await clickRegister(800)
check(
  'register: with no invoice the server refuses (nothing to confirm)',
  (await t.toast('Worksheet cannot be saved without any invoice!')) && (await dialogs()).length === 0,
  JSON.stringify(await t.toasts()),
)

// what the case would look like with an invoice: the server's form with one invoice; the POST is answered here
const invoice = { index: 1, invoiceNo: 'E2E-1', invoiceDate: '2026-10-05T00:00:00', amount: 100, payAmount: 100, payTo: 'H', stayType: 'I', used: false }
mock = {
  form: {
    ...form,
    invoices: [invoice],
    payTo: 'H',
    blocked: null,
    defaultStatus: 'AA',
    defaults: { ...form.defaults, lastDocumentDate: '2026-10-05T00:00:00', payTo: '' },
  },
  asked: { saved: false, confirm: 'Are you sure?', version: null, excessNumber: null, excessLetterAdded: false, memberBalance: null, notes: [] },
  saved: {
    saved: true,
    confirm: null,
    version: form.version,
    excessNumber: null,
    excessLetterAdded: false,
    memberBalance: { reason: null, record: 'MBM', before: 1000, after: 900, applied: true },
    notes: ['No debit or credit note number was issued: the web does not number those notes yet.'],
  },
}
await show(regCas)
check(
  'register: the invoice is listed',
  await t.waitFor(async () => (await gridRows('Invoices')).some((r) => r[0] === 'E2E-1'), 10000),
  JSON.stringify(await gridRows('Invoices')),
)
check(
  'register: its pay-to is shown as Hospital',
  (await gridRows('Invoices')).some((r) => r[4] === 'Hospital'),
)
check('register: the last document starts as the latest invoice date', (await t.value('Last Doc.')) === '05/10/2026', await t.value('Last Doc.'))
await t.select('Worksheet Status', 'PA')
await t.type('GP', 'DR E2E')
await t.type('Worksheet remarks', 'e2e remark')
await clickRegister(700)
check(
  'register: Register asks Are you sure?',
  (await dialogs()).some((d) => d.includes('Are you sure?')),
  JSON.stringify(await dialogs()),
)
await (await t.btn('No')).click()
await sleep(400)
check(
  'register: No writes nothing (only the unconfirmed question was sent)',
  posts.length === 1 && posts[0].confirmed === false,
  JSON.stringify(posts.map((x) => x.confirmed)),
)

await clickRegister(700)
await t.yes()
check(
  'register: Yes saves and shows the desktop message with the worksheet',
  await t.toast(`Record Save: ${regCas}-${form.version}`, 6000),
  JSON.stringify(await t.toasts()),
)
check(
  "register: and tells what the save did to the member's limit and what it did not do",
  (await t.toast('went from 1000.00 to 900.00')) && (await t.toast('No debit or credit note number was issued')),
)
const sent = posts.at(-1)
check(
  'register: the confirmed request carries the status, the payment details and the date as an ISO day',
  posts.length === 3 &&
    sent.confirmed === true &&
    sent.worksheetStatus === 'PA' &&
    sent.payment.gpName === 'DR E2E' &&
    sent.payment.worksheetRemarks === 'e2e remark' &&
    sent.payment.lastDocumentDate === '2026-10-05',
  JSON.stringify(sent),
)
check(
  'register: afterwards the page says the worksheet was registered',
  (await page.$eval('main', (m) => m.textContent ?? '')).includes(`${regCas}-${form.version} was registered`),
)

// a kind of worksheet the save does not do yet: shown, and the button is disabled
mock = { ...mock, form: { ...mock.form, blocked: 'This worksheet cannot be registered here yet: a lifetime plan is not supported.' } }
await show(regCas)
check(
  'register: a worksheet the save cannot do says why and the Register button is disabled',
  (await t.waitFor(
    async () => (await page.$$eval('p.error', (e) => e.map((x) => x.textContent))).some((x) => x.includes('a lifetime plan is not supported')),
    10000,
  )) && (await (await registerButton()).asElement().evaluate((b) => b.disabled)),
)
await page.screenshot({ path: path.join(t.shots, 'registration-register.png'), fullPage: true })
page.removeAllListeners('request')
await page.setRequestInterception(false)

// ---------------- Access: positions 22 and 23 withheld
const access = '1'.repeat(21) + '00' + '1'.repeat(7)
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
await limited.goto(`${BASE}/worksheet/registration`, { waitUntil: 'networkidle0' })
await limited.waitForSelector('h2')
check('access: without positions 22 and 23 the page says Access Denied!', (await limited.$eval('h2', (e) => e.textContent)) === 'Access Denied!')
check('access: and the API refuses with 403', (await get(`/api/worksheet/calculation/${cas}`, mint(access))).status === 403)

console.log(`screenshots: ${t.shots}`)
const ok = t.summary()
await t.browser.close()
process.exit(ok ? 0 : 1)
