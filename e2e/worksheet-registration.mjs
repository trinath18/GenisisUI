// Worksheet > Worksheet Registration, calculation step: a saved worksheet worked out from its invoices and the plan, beside what was saved. Reads the real development data;
// nothing is written (the page has no write endpoint).
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { start, BASE } from './lib.mjs'
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
  'registration: says plainly that nothing is saved and a new worksheet cannot be entered yet',
  (await page.$eval('main', (m) => m.textContent ?? '')).includes('are not available yet'),
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
