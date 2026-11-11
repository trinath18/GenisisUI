// Claim Bordx > Monitoring > Bordx Control. Read only, against the real bordereaux; nothing is written. The data has only non-Sihat payors, so the Sihat layout shows no rows.
import { start, sleep, BASE } from './lib.mjs'
import { mint } from './mint.mjs'

const t = await start()
const { page, check } = t

const get = (path, token = mint()) => fetch(`${BASE}${path}`, { headers: { Authorization: `Bearer ${token}` } })
const json = async (path) => (await get(path)).json()
const rowsOf = () =>
  page.$$eval('table[aria-label="Bordereaux"] tbody tr', (trs) =>
    trs.map((tr) => [...tr.querySelectorAll('td')].map((td) => td.textContent.trim())).filter((r) => r.length > 2),
  )
const headers = () => page.$$eval('table[aria-label="Bordereaux"] thead th', (ths) => ths.map((th) => th.textContent.trim()).filter(Boolean))
const stat = (label) =>
  page.evaluate(
    (l) =>
      [...document.querySelectorAll('.stat')].find((s) => s.querySelector('.stat-label')?.textContent === l)?.querySelector('.stat-value')?.textContent ?? null,
    label,
  )
const hasField = (label) =>
  page.evaluate((l) => [...document.querySelectorAll('label.form-field span')].some((s) => s.textContent.replace('*', '').trim() === l), label)
const money = (n) => n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const q = (o) => new URLSearchParams(Object.entries(o).filter(([, v]) => v !== undefined)).toString()

// ---------------- the API
const payors = await json('/api/claim-bordx/control/payors')
check('api: the payors come with their health code', payors.length > 1 && payors.some((p) => p.healthCode === 'N'), `${payors.length}`)
const missing = await get('/api/claim-bordx/control')
check(
  'api: a search without a payor is refused with the desktop message',
  missing.status === 400 && (await missing.json()).message === 'Please Enter Payor Code.',
)
check('api: an unknown payor is not found', (await get('/api/claim-bordx/control?payor=QQ')).status === 404)
check('api: an unknown status is refused', (await get('/api/claim-bordx/control?scope=allNonSihat&payFr=X')).status === 400)
const all = await json('/api/claim-bordx/control?scope=allNonSihat')
check(
  'api: all the non-Sihat bordx are more than a page, so the list is cut at 5,000 and says so',
  all.kind === 'N' && all.truncated === true && all.rows.length === 5000,
)
const sihat = await json('/api/claim-bordx/control?scope=allSihat')
check('api: there are no Sihat payors in this data, so that layout is empty', sihat.kind === 'S' && sihat.rows.length === 0 && sihat.totalAmount === 0)

let small = null
for (const p of payors.filter((x) => x.healthCode === 'N').slice(0, 40)) {
  const r = await json(`/api/claim-bordx/control?${q({ payor: p.code })}`)
  if (r.rows.length > 2 && (small === null || r.rows.length < small.result.rows.length)) small = { payor: p, result: r }
}
const { payor, result } = small
check(
  'api: one payor gives its rows in that payor layout with the total of the amounts',
  result.kind === 'N' &&
    result.rows.every((r) => r.payorCode === payor.code) &&
    Math.abs(result.totalAmount - result.rows.reduce((s, r) => s + (r.amount ?? 0), 0)) < 0.005,
  `${payor.code} ${result.rows.length}`,
)
check(
  'api: a same-day count is shown as 1 day and a missing date leaves the count empty',
  result.rows.every((r) => (r.sentToPayor && r.docReceived ? r.days >= 1 : r.days === null)),
)
const paid = await json(`/api/claim-bordx/control?${q({ payor: payor.code, payFr: 'F' })}`)
const unpaid = await json(`/api/claim-bordx/control?${q({ payor: payor.code, payFr: 'U' })}`)
const partial = await json(`/api/claim-bordx/control?${q({ payor: payor.code, payFr: 'P' })}`)
check(
  'api: paid, partial paid and unpaid together are all the rows of the payor',
  paid.rows.length + unpaid.rows.length + partial.rows.length === result.rows.length,
  `${paid.rows.length}+${partial.rows.length}+${unpaid.rows.length} vs ${result.rows.length}`,
)
check('api: nothing of this payor has been sent', (await json(`/api/claim-bordx/control?${q({ payor: payor.code, payTo: '1' })}`)).rows.length === 0)

// ---------------- the screen
await t.go('/claim-bordx/bordx-control')
check('screen: title', (await page.$eval('h2', (e) => e.textContent)) === 'Bordx Control')
const side = await page.$$eval('.sidebar a', (els) => els.map((e) => e.textContent.trim()))
check('menu: Bordx Control is a link in the Claim Bordx menu', side.includes('Bordx Control'), side.join('|'))
await t.click('Search', 400)
check('screen: Search without a payor says so', (await t.errors()).includes('Please Enter Payor Code.'), JSON.stringify(await t.errors()))
await t.type('Payor', `${payor.code} - ${payor.name ?? ''}`.trim())
await page.keyboard.press('Tab')
await sleep(300)
check(
  'screen: a non-Sihat payor shows From Payor (Money) and no MNRB boxes',
  (await hasField('From Payor (Money)')) && !(await hasField('To MNRB')) && !(await hasField('From MNRB (Money)')),
)
await t.click('Search', 1200)
const shown = await rowsOf()
check(
  'screen: Search lists the payor bordx',
  shown.length === result.rows.length && shown[0][0] === result.rows[0].bordxNo,
  `${shown.length} vs ${result.rows.length}`,
)
check(
  'screen: the headings are the desktop headings of the non-Sihat layout',
  JSON.stringify(await headers()) ===
    JSON.stringify([
      'Bordx No',
      'Bordx Date',
      'No of Claims',
      'Bordx Amt',
      'Bordx Status',
      'DTP',
      'DRP (Doc)',
      'No of Days (DRP - DTP)',
      'DFPayor (Money)',
      'No of Days (DTP - DPayment)',
    ]),
  JSON.stringify(await headers()),
)
check(
  'screen: the counters show the rows and the total of the amounts',
  (await stat('Records')) === String(shown.length) && (await stat('Total Amt')) === money(result.totalAmount),
  `${await stat('Total Amt')} vs ${money(result.totalAmount)}`,
)
await t.select('From Payor (Money)', 'F')
await t.click('Search', 1200)
check('screen: From Payor (Money) = Paid narrows the list', (await rowsOf()).length === paid.rows.length, `${(await rowsOf()).length} vs ${paid.rows.length}`)
await t.select('To Payor', '1')
await t.click('Search', 900)
check('screen: To Payor = Sent finds none and says No record found!', (await t.toast('No record found!')) && (await rowsOf()).length === 0)

await t.click('Clear', 300)
await t.type('Payor', 'All Sihat')
await page.keyboard.press('Tab')
await sleep(300)
check(
  'screen: All Sihat shows the MNRB boxes and no From Payor (Money)',
  (await hasField('To MNRB')) && (await hasField('From MNRB (Money)')) && !(await hasField('From Payor (Money)')),
)
await t.click('Search', 900)
check('screen: and, with no Sihat payors in the data, No record found!', await t.toast('No record found!'))
await t.type('Payor', 'All Non-Sihat')
await page.keyboard.press('Tab')
await t.click('Search', 1500)
const allRows = await rowsOf()
check(
  'screen: All Non-Sihat lists several payors with a Payor column first',
  allRows.length > 100 && (await headers())[0] === 'Payor' && new Set(allRows.map((r) => r[0])).size > 1,
  `${allRows.length}`,
)

// ---------------- access: position 15 withheld
const access = '1'.repeat(14) + '0' + '1'.repeat(15)
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
await limited.goto(`${BASE}/claim-bordx/bordx-control`, { waitUntil: 'networkidle0' })
await limited.waitForSelector('h2')
check('access: without position 15 the page says Access Denied!', (await limited.$eval('h2', (e) => e.textContent)) === 'Access Denied!')
check('access: and the API refuses with 403', (await get('/api/claim-bordx/control/payors', mint(access))).status === 403)

console.log(`screenshots: ${t.shots}`)
const ok = t.summary()
await t.browser.close()
process.exit(ok ? 0 : 1)
