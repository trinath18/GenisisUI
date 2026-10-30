// Receipt > Receipt Tracking. Read only, against the real receipts from members, payors and MNRB; nothing is written.
import { start, BASE } from './lib.mjs'
import { mint } from './mint.mjs'

const t = await start()
const { page, check } = t

const get = (path, token = mint()) => fetch(`${BASE}${path}`, { headers: { Authorization: `Bearer ${token}` } })
const json = async (path) => (await get(path)).json()
const rowsOf = () =>
  page.$$eval('table[aria-label="Receipts"] tbody tr', (trs) =>
    trs.map((tr) => [...tr.querySelectorAll('td')].map((td) => td.textContent.trim())).filter((r) => r.length > 2),
  )
const headers = () => page.$$eval('table[aria-label="Receipts"] thead th', (ths) => ths.map((th) => th.textContent.trim()).filter(Boolean))
const stat = (label) =>
  page.evaluate(
    (l) =>
      [...document.querySelectorAll('.stat')].find((s) => s.querySelector('.stat-label')?.textContent === l)?.querySelector('.stat-value')?.textContent ?? null,
    label,
  )
const money = (n) => n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const q = (o) => new URLSearchParams(Object.entries(o).filter(([, v]) => v !== undefined)).toString()
const T = '/api/receipt/tracking'

// ---------------- the API
check('api: an unknown kind of receipt is refused', (await get(`${T}?source=supplier`)).status === 400)
check('api: an unknown layout is refused', (await get(`${T}?mode=weekly`)).status === 400)
const member = await json(`${T}?source=member`)
check(
  'api: all the member receipts are more than a page, so the list is cut at 5,000 and says so',
  member.mode === 'claim' && member.truncated === true && member.detail.length === 5000 && member.summary.length === 0,
)
const pick = member.detail.find((r) => r.payorCode && r.receiptDate && r.receiptNo)
const day = pick.receiptDate.slice(0, 10)
const narrow = await json(`${T}?${q({ source: 'member', payor: pick.payorCode, dateFrom: day, dateTo: day })}`)
check(
  'api: a payor and a day narrow the receipts, each of that payor and day',
  narrow.detail.length >= 1 && narrow.detail.length < 5000 && narrow.detail.every((r) => r.payorCode === pick.payorCode && r.receiptDate.startsWith(day)),
  `${narrow.detail.length}`,
)
check(
  'api: the count and the total add up the lines',
  narrow.count === narrow.detail.length && Math.abs(narrow.totalAmount - narrow.detail.reduce((s, r) => s + (r.amount ?? 0), 0)) < 0.005,
)
const mnrb = await json(`${T}?source=mnrb`)
check('api: the MNRB receipts are few', mnrb.detail.length > 0 && mnrb.detail.length < 100, `${mnrb.detail.length}`)
const byPayor = await json(`${T}?${q({ source: 'member', mode: 'payor' })}`)
check(
  'api: by payor gives one line per payor with the receipts and the amount',
  byPayor.mode === 'payor' && byPayor.summary.length > 5 && byPayor.summary.every((r) => r.cases >= 0) && byPayor.detail.length === 0,
  `${byPayor.summary.length}`,
)
const byBordx = await json(`${T}?${q({ source: 'payor', mode: 'bordx', payor: pick.payorCode })}`)
check(
  'api: by bordx gives a bordx, its date, the cases and the amount',
  byBordx.summary.length === 0 || (byBordx.summary[0].key1 && byBordx.summary[0].cases >= 1),
  `${byBordx.summary.length}`,
)
const byReceipt = await json(`${T}?${q({ source: 'member', mode: 'receipt', receiptFrom: pick.receiptNo.toLowerCase(), receiptTo: pick.receiptNo })}`)
check(
  'api: by receipt number for one receipt gives that receipt',
  byReceipt.summary.length >= 1 && byReceipt.summary.every((r) => r.key1 === pick.receiptNo),
  JSON.stringify(byReceipt.summary.slice(0, 2)),
)

// ---------------- the screen
await t.go('/receipt/tracking')
check('screen: title', (await page.$eval('h2', (e) => e.textContent)) === 'Receipt Tracking')
check(
  'menu: the Receipt module is in the rail',
  (await page.$$eval('.rail [aria-label]', (els) => els.map((e) => e.getAttribute('aria-label')))).includes('Receipt'),
)
const side = await page.$$eval('.sidebar > *', (els) => els.map((e) => e.textContent.trim()))
check(
  'menu: the Receipt menu lists the entry forms still to migrate disabled and Receipt Tracking as a link',
  ['From Member', 'Others', 'Payor'].every((x) => side.includes(x)) &&
    (await page.$$eval('.sidebar a', (a) => a.map((x) => x.textContent.trim()))).join() === 'Receipt Tracking',
  side.join('|'),
)
await t.type('Payor', pick.payorCode)
await t.type('Receipt Date from', day.slice(8, 10) + day.slice(5, 7) + day.slice(0, 4))
await t.type('Receipt Date to', day.slice(8, 10) + day.slice(5, 7) + day.slice(0, 4))
await t.click('Search', 1500)
const shown = await rowsOf()
check(
  'screen: Search lists the member receipts of that payor and day',
  shown.length === narrow.detail.length && shown[0][0] === narrow.detail[0].receiptNo,
  `${shown.length} vs ${narrow.detail.length}`,
)
check(
  'screen: the headings are the desktop headings of the member list',
  JSON.stringify(await headers()) ===
    JSON.stringify(['Receipt No', 'Receipt Date', 'Amount', 'Payor', 'Member No', 'Member Name', 'Claim No', 'D/N No', 'Remarks', 'A/C Period']),
  JSON.stringify(await headers()),
)
check(
  'screen: the counters show the lines and the total',
  (await stat('Records')) === String(narrow.count) && (await stat('Total Amt')) === money(narrow.totalAmount),
  `${await stat('Total Amt')} vs ${money(narrow.totalAmount)}`,
)
await t.select('Receipts from', 'payor')
await t.click('Search', 1500)
check(
  "screen: the payor list has the payor and MNRB headings (Rec't Amt, Bordx No, WKS No)",
  JSON.stringify(await headers()) ===
    JSON.stringify(['Receipt No', 'Receipt Date', "Rec't Amt", 'Member No', 'Member Name', 'Bordx No', 'WKS No', 'D/N No', 'Remarks', 'A/C Period']),
  JSON.stringify(await headers()),
)
await t.select('Reports Type', 'bordx')
check(
  'screen: By Bordx hides the claim-only boxes',
  !(await page.evaluate(() =>
    [...document.querySelectorAll('label.form-field span')].some((s) => ['Mem No', 'Mem Name', 'Amount from'].includes(s.textContent.replace('*', '').trim())),
  )),
)
await t.click('Search', 1500)
check(
  'screen: By Bordx is headed Bordx No, Bordx Date, No of Case, Amt Receipt Fr Payor',
  JSON.stringify(await headers()) === JSON.stringify(['Bordx No', 'Bordx Date', 'No of Case', 'Amt Receipt Fr Payor']),
  JSON.stringify(await headers()),
)
await t.type('Payor', '')
await t.type('Receipt Date from', '')
await t.type('Receipt Date to', '')
await t.select('Receipts from', 'member')
await t.select('Reports Type', 'payor')
await t.click('Search', 2000)
const payors = await rowsOf()
check(
  'screen: By Payor lists every payor with the number of receipts and the amount',
  payors.length === byPayor.summary.length && (await headers()).join('|') === 'Payor|No of Receipt|Amt Receipt Fr MBM',
  `${payors.length} vs ${byPayor.summary.length}`,
)
await t.select('Receipts from', 'mnrb')
await t.select('Reports Type', 'claim')
await t.click('Search', 1500)
check('screen: the MNRB receipts are listed', (await rowsOf()).length === mnrb.detail.length, `${(await rowsOf()).length} vs ${mnrb.detail.length}`)
await t.type('Receipt No from', 'ZZZZZZ')
await t.click('Search', 1200)
check('screen: a search that matches nothing says No record found!', await t.toast('No record found!'))
await t.click('Clear', 300)
check('screen: Clear empties the list', (await rowsOf()).length === 0 && (await stat('Records')) === '0')

// ---------------- access: position 9 withheld
const access = '1'.repeat(8) + '0' + '1'.repeat(21)
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
await limited.goto(`${BASE}/receipt/tracking`, { waitUntil: 'networkidle0' })
await limited.waitForSelector('h2')
check('access: without position 9 the page says Access Denied!', (await limited.$eval('h2', (e) => e.textContent)) === 'Access Denied!')
check('access: and the API refuses with 403', (await get(T, mint(access))).status === 403)

console.log(`screenshots: ${t.shots}`)
const ok = t.summary()
await t.browser.close()
process.exit(ok ? 0 : 1)
