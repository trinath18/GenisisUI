// Claim Bordx > Monitoring > Outstanding Bordx. Read only. Nothing in the development data has been sent, so the real searches find nothing; the lists are exercised with answers served by this script
// (the API's own database tests make bordx outstanding inside a rolled-back session and check the lists against the view). Nothing is written.
import { start, BASE } from './lib.mjs'
import { mint } from './mint.mjs'

const t = await start()
const { page, check } = t

const get = (path, token = mint()) => fetch(`${BASE}${path}`, { headers: { Authorization: `Bearer ${token}` } })
const json = async (path) => (await get(path)).json()
const sectionRows = (title) =>
  page.$$eval(`table[aria-label="${title}"] tbody tr`, (trs) =>
    trs.map((tr) => [...tr.querySelectorAll('td')].map((td) => td.textContent.trim())).filter((r) => r.length > 2),
  )
const headers = (title) => page.$$eval(`table[aria-label="${title}"] thead th`, (ths) => ths.map((th) => th.textContent.trim()).filter(Boolean))
const stat = (label) =>
  page.evaluate(
    (l) =>
      [...document.querySelectorAll('.stat')].find((s) => s.querySelector('.stat-label')?.textContent === l)?.querySelector('.stat-value')?.textContent ?? null,
    label,
  )

let fake = null
const queries = []
await page.setRequestInterception(true)
page.on('request', (req) => {
  const url = new URL(req.url())
  if (url.pathname !== '/api/claim-bordx/outstanding') return req.continue()
  queries.push(Object.fromEntries(url.searchParams))
  if (fake) return req.respond({ status: 200, contentType: 'application/json', body: JSON.stringify(fake) })
  return req.continue()
})

// ---------------- the API
const payors = await json('/api/claim-bordx/outstanding/payors')
const payor = payors.find((p) => p.healthCode === 'N')
check('api: the payors come with their health code', payors.length > 1 && !!payor)
const missing = await get('/api/claim-bordx/outstanding')
check(
  'api: a detail listing without a payor is refused with the desktop message',
  missing.status === 400 && (await missing.json()).message === 'Please Enter Payor Code.',
)
check('api: an unknown payor is not found', (await get('/api/claim-bordx/outstanding?payor=QQ')).status === 404)
check('api: an unknown view is refused', (await get('/api/claim-bordx/outstanding?mode=weekly')).status === 400)
const none = await json(`/api/claim-bordx/outstanding?payor=${payor.code}&asAt=2026-10-30`)
check(
  'api: nothing has been sent, so a non-Sihat payor has one empty list and no total due',
  none.kind === 'N' && none.sections.length === 1 && none.sections[0].key === 'nonSihat' && none.sections[0].rows.length === 0 && none.totalDue === null,
)
const sihat = await json('/api/claim-bordx/outstanding?scope=allSihat')
check(
  'api: All Sihat has the two Sihat lists, empty, and a total due of 0',
  sihat.kind === 'S' && sihat.sections.map((s) => s.key).join() === 'payor,mnrb' && sihat.totalDue === 0,
)
const summary = await json('/api/claim-bordx/outstanding?mode=summaryN')
check('api: the general summary (N) has the one list', summary.kind === 'N' && summary.sections.length === 1)

// ---------------- the screen
await t.go('/claim-bordx/outstanding-bordx')
check('screen: title', (await page.$eval('h2', (e) => e.textContent)) === 'Outstanding Bordx')
const side = await page.$$eval('.sidebar a', (els) => els.map((e) => e.textContent.trim()))
check('menu: Outstanding Bordx is a link in the Claim Bordx menu', side.includes('Outstanding Bordx'), side.join('|'))
const today = new Date()
const dmy = `${String(today.getDate()).padStart(2, '0')}/${String(today.getMonth() + 1).padStart(2, '0')}/${today.getFullYear()}`
check('screen: the as at date starts on today', (await t.value('Outstanding Bordereaux As At')) === dmy, await t.value('Outstanding Bordereaux As At'))
await t.click('Search', 400)
check('screen: a detail listing without a payor says so', (await t.errors()).includes('Please Enter Payor Code.'), JSON.stringify(await t.errors()))
await t.type('Payor', `${payor.code} - ${payor.name ?? ''}`.trim())
await t.click('Search', 900)
check('screen: a payor with nothing outstanding says No record found for Payor!', await t.toast('No record found for Payor!'))
await t.type('Payor', 'All Sihat')
await t.click('Search', 900)
check(
  'screen: All Sihat shows the two lists, empty',
  (await headers('Bordx with Payor')).includes('DTP') && (await headers('Not Paid by MNRB')).includes('DTMNRB'),
)

fake = {
  kind: 'S',
  mode: 'detail',
  asAt: '2021-06-01T00:00:00',
  truncated: false,
  totalDue: 350,
  sections: [
    {
      key: 'payor',
      title: 'Bordx with Payor',
      subTotal: 175,
      within14: 75,
      over14: 100,
      rows: [
        { item: 1, bordxNo: 'B1', payorCode: 'SH', claims: null, amount: 100, sentDate: '2021-05-01T00:00:00', days: 32, within14: null, over14: 100 },
        { item: 2, bordxNo: 'B2', payorCode: 'SH', claims: null, amount: 50, sentDate: '2021-05-20T00:00:00', days: 13, within14: 50, over14: null },
        { item: 3, bordxNo: 'B3', payorCode: 'SH', claims: null, amount: 25, sentDate: '2021-06-01T00:00:00', days: 1, within14: 25, over14: null },
      ],
    },
    {
      key: 'mnrb',
      title: 'Not Paid by MNRB',
      subTotal: 175,
      within14: 175,
      over14: 0,
      rows: [{ item: 1, bordxNo: 'B9', payorCode: 'SH', claims: null, amount: 175, sentDate: '2021-05-30T00:00:00', days: 3, within14: 175, over14: null }],
    },
  ],
}
await t.type('Outstanding Bordereaux As At', '01062021')
await t.type('Payor', 'SH - SIHAT')
await t.click('Search', 900)
const rows = await sectionRows('Bordx with Payor')
check(
  'screen: the Bordx with Payor list shows each bordx with its days and the 14-day column it falls in',
  rows.length === 3 && rows[0].join('|') === '1|B1|SH|100.00|01/05/2021|32||100.00' && rows[1].join('|') === '2|B2|SH|50.00|20/05/2021|13|50.00|',
  JSON.stringify(rows),
)
check(
  'screen: the list is headed as the desktop headed it',
  JSON.stringify(await headers('Bordx with Payor')) ===
    JSON.stringify(['Item No', 'Bordx No', 'Payor', 'Amount', 'DTP', 'O/S Days', 'Bordx <14 days', 'Bordx >14 days']),
  JSON.stringify(await headers('Bordx with Payor')),
)
check('screen: the Not Paid by MNRB list shows its bordx', (await sectionRows('Not Paid by MNRB')).length === 1)
check(
  'screen: the totals of each list and the total due are shown',
  (await stat('Sub-Total (Bordx with Payor)')) === '175.00' &&
    (await stat('Bordx <14 days (Bordx with Payor)')) === '75.00' &&
    (await stat('Bordx >14 days (Bordx with Payor)')) === '100.00' &&
    (await stat('Total Due')) === '350.00',
  `${await stat('Total Due')}`,
)
const last = queries.at(-1)
check(
  'screen: the search sent the mode, the payor code and the as at day as an ISO day',
  last.mode === 'detail' && last.scope === 'payor' && last.payor === 'SH' && last.asAt === '2021-06-01',
  JSON.stringify(last),
)

await t.select('View', 'summaryS')
await t.click('Search', 700)
check('screen: a summary keeps the payor as its filter', queries.at(-1).mode === 'summaryS' && queries.at(-1).payor === 'SH', JSON.stringify(queries.at(-1)))
await t.type('Payor', '')
await t.click('Search', 700)
check(
  'screen: and needs no payor when it is empty',
  queries.at(-1).mode === 'summaryS' && queries.at(-1).payor === undefined && queries.at(-1).scope === 'payor',
  JSON.stringify(queries.at(-1)),
)
fake = null
await t.type('Outstanding Bordereaux As At', '31022021')
await t.click('Search', 500)
check(
  'screen: an impossible as at date says Invalid Date Format!',
  (await t.errors()).some((e) => e.includes('Invalid Date Format')),
  JSON.stringify(await t.errors()),
)
await t.click('Clear', 300)
check(
  'screen: Clear empties the lists and puts back today and a detail listing',
  (await t.value('Outstanding Bordereaux As At')) === dmy && (await sectionRows('Bordx with Payor')).length === 0,
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
await limited.goto(`${BASE}/claim-bordx/outstanding-bordx`, { waitUntil: 'networkidle0' })
await limited.waitForSelector('h2')
check('access: without position 15 the page says Access Denied!', (await limited.$eval('h2', (e) => e.textContent)) === 'Access Denied!')
check('access: and the API refuses with 403', (await get('/api/claim-bordx/outstanding/payors', mint(access))).status === 403)

console.log(`screenshots: ${t.shots}`)
const ok = t.summary()
await t.browser.close()
process.exit(ok ? 0 : 1)
