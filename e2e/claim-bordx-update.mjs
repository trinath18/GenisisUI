// Claim Bordx > Update Bordx. Reads the real pending worksheets; the POST that would put worksheets into a bordx is intercepted and answered here (the database writes, the totals and the rollback are
// covered by the API's own rolled-back database tests), so nothing is written. The checks the API makes before it writes are made with real calls.
import { start, sleep, BASE } from './lib.mjs'
import { mint } from './mint.mjs'

const t = await start()
const { page, check } = t

const get = (path, token = mint()) => fetch(`${BASE}${path}`, { headers: { Authorization: `Bearer ${token}` } })
const json = async (path) => (await get(path)).json()
const post = (path, body, token = mint()) =>
  fetch(`${BASE}${path}`, { method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
const rowsOf = () =>
  page.$$eval('table[aria-label="Pending worksheets"] tbody tr', (trs) =>
    trs.map((tr) => [...tr.querySelectorAll('td')].map((td) => td.textContent.trim())).filter((r) => r.length > 2),
  )
const headers = () => page.$$eval('table[aria-label="Pending worksheets"] thead th', (ths) => ths.map((th) => th.textContent.trim()).filter(Boolean))
const stat = (label) =>
  page.evaluate(
    (l) =>
      [...document.querySelectorAll('.stat')].find((s) => s.querySelector('.stat-label')?.textContent === l)?.querySelector('.stat-value')?.textContent ?? null,
    label,
  )
const tick = (index) =>
  page.evaluate((i) => document.querySelectorAll('table[aria-label="Pending worksheets"] tbody tr')[i]?.querySelector('input[type=checkbox]')?.click(), index)
const dialogs = () => page.$$eval('[role=dialog]', (d) => d.map((x) => x.textContent.replace(/\s+/g, ' ').trim()))
const answer = async (text) => {
  await page.evaluate((x) => [...document.querySelectorAll('[role=dialog] button')].find((b) => b.textContent.trim() === x)?.click(), text)
  await sleep(500)
}
const money = (n) => n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const q = (o) => new URLSearchParams(Object.entries(o).filter(([, v]) => v !== undefined)).toString()
const U = '/api/claim-bordx/update-bordx'

const posted = []
await page.setRequestInterception(true)
page.on('request', (req) => {
  const url = new URL(req.url())
  if (url.pathname !== U || req.method() !== 'POST') return req.continue()
  const body = JSON.parse(req.postData())
  posted.push(body)
  return req.respond({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({ bordxNo: body.bordxNo, claims: body.claims.length, totalApproved: 0 }),
  })
})

// ---------------- the API
const unbordxed = await json(`${U}?${q({ payor: 'TA - x' })}`)
check(
  'api: the pending worksheets of a payor that are in no bordx',
  unbordxed.rows.length > 100 && unbordxed.rows.every((r) => r.payorCode === 'TA' && !r.bordxNo),
  `${unbordxed.rows.length}`,
)
check('api: the total adds the approved amounts', Math.abs(unbordxed.totalApproved - unbordxed.rows.reduce((s, r) => s + (r.totalApproved ?? 0), 0)) < 0.005)
const everything = await json(`${U}?${q({ payor: 'TA', unbordxedOnly: false })}`)
check(
  'api: without the Search Empty Data box the void worksheets (bordx VOID) are listed too',
  everything.rows.length > unbordxed.rows.length && everything.rows.some((r) => r.bordxNo === 'VOID'),
)
const small = await json(`${U}?${q({ payor: 'TA', amount: 'le' })}`)
const big = await json(`${U}?${q({ payor: 'TA', amount: 'gt' })}`)
check(
  'api: the amount choices split the approved amounts at 2000',
  small.rows.every((r) => r.totalApproved <= 2000) &&
    big.rows.every((r) => r.totalApproved > 2000) &&
    small.rows.length + big.rows.length <= unbordxed.rows.length,
)
check('api: an unknown amount choice is refused', (await get(`${U}?amount=x`)).status === 400)
const one = unbordxed.rows[0]
check(
  'api: a case number range of one case keeps that case',
  (await json(`${U}?${q({ caseFrom: one.caseNo.toLowerCase(), caseTo: one.caseNo })}`)).rows.every((r) => r.caseNo === one.caseNo),
)
check('api: a date admitted after all of them finds nothing', (await json(`${U}?${q({ payor: 'TA', doaFrom: '2099-01-01' })}`)).rows.length === 0)
const refused = async (body) => {
  const r = await post(U, body)
  return { status: r.status, message: (await r.json().catch(() => ({}))).message }
}
const claim = { caseNo: one.caseNo, version: one.claimVersion }
check(
  'api: no worksheet is refused with the desktop message',
  (await refused({ claims: [], bordxNo: 'ZZ-E2E-1', bordxDate: '2026-10-30' })).message === 'Please select at least one record to be updated! ',
)
check('api: then the bordx number', (await refused({ claims: [claim], bordxDate: '2026-10-30' })).message === 'Please Enter Bordx No! ')
check('api: then the bordx date', (await refused({ claims: [claim], bordxNo: 'ZZ-E2E-1' })).message === 'Please Enter Bordx Date! ')
check(
  'api: receipt boxes without the receipt number',
  (await refused({ claims: [claim], bordxNo: 'ZZ-E2E-1', bordxDate: '2026-10-30', chequeAmount: 5 })).message === 'Please Enter Receipt No!',
)
const missing = await refused({ claims: [{ caseNo: 'ZZ-NO-CASE', version: 1 }], bordxNo: 'ZZ-E2E-1', bordxDate: '2026-10-30' })
check(
  'api: a worksheet that is not there is not found and nothing is saved',
  missing.status === 404 && missing.message === 'Worksheet ZZ-NO-CASE-1 not found',
  JSON.stringify(missing),
)
const voided = everything.rows.find((r) => r.bordxNo === 'VOID')
const already = await refused({ claims: [{ caseNo: voided.caseNo, version: voided.claimVersion }], bordxNo: 'ZZ-E2E-1', bordxDate: '2026-10-30' })
check('api: a void worksheet is refused and nothing is saved', already.status === 400 && already.message.endsWith('is void'), JSON.stringify(already))
check('api: nothing was written', (await json(`${U}?${q({ payor: 'TA' })}`)).rows.length === unbordxed.rows.length)

// ---------------- the screen
await t.go('/claim-bordx/update-bordx')
check('screen: title', (await page.$eval('h2', (e) => e.textContent)) === 'Update Bordx')
const side = await page.$$eval('.sidebar a', (els) => els.map((e) => e.textContent.trim()))
check('menu: Update Bordx is a link in the Claim Bordx menu', side.includes('Update Bordx'), side.join('|'))
await t.click('Update', 400)
check('screen: Update with no list says so', await t.toast('Please select a record before proceeding!'))
await t.type('Payor', 'TA')
await t.select('Amount', 'gt')
await t.click('Search', 1500)
const shown = await rowsOf()
check('screen: Search lists the pending worksheets', shown.length === big.rows.length && shown.length > 0, `${shown.length} vs ${big.rows.length}`)
check(
  'screen: the list is headed as the desktop headed it, with the bordx number',
  JSON.stringify(await headers()) ===
    JSON.stringify([
      'Payor',
      'Case No',
      'Claim Version',
      'Wks No',
      'Actual Amt',
      'App Amt',
      'Hosp Amt',
      'Member Amt',
      'DOA',
      'DOD',
      'Patient',
      'Hospital',
      'Grp Company',
      'Plan Code',
      'ICD Code',
      'Bordx No',
    ]),
  JSON.stringify(await headers()),
)
check(
  'screen: the counters show the records and the total amount',
  (await stat('Records')) === String(big.rows.length) && (await stat('Total Amt')) === money(big.totalApproved),
  `${await stat('Total Amt')} vs ${money(big.totalApproved)}`,
)
await t.click('Update', 400)
check('screen: Update with nothing ticked says so', await t.toast('Please select at least one record to be updated! '))
await tick(0)
await tick(1)
await sleep(300)
check(
  'screen: ticking two worksheets totals their amount',
  (await stat('Amt Checked')) === money(big.rows[0].totalApproved + big.rows[1].totalApproved),
  await stat('Amt Checked'),
)
await t.click('Update', 400)
check('screen: Update without a bordx number says so', (await t.errors()).includes('Please Enter Bordx No! '), JSON.stringify(await t.errors()))
await t.type('Bordx No', 'ZZ-E2E-1')
await t.click('Update', 400)
check('screen: then without a bordx date', (await t.errors()).includes('Please Enter Bordx Date! '), JSON.stringify(await t.errors()))
await t.type('Bordx Date', '30102026')
await t.type('Cheque Amt', '5')
await t.click('Update', 400)
check('screen: a cheque amount without a receipt number is refused', (await t.errors()).includes('Please Enter Receipt No!'), JSON.stringify(await t.errors()))
await t.type('Cheque Amt', '')
await t.select('A/C Period Mth', '7')
await t.type('To Payor', '31102026')
await t.click('Update', 500)
check(
  'screen: Update asks Do you want to update the record?',
  (await dialogs()).some((d) => d.includes('Do you want to update the record?')),
  JSON.stringify(await dialogs()),
)
await answer('No')
check('screen: No sends nothing', posted.length === 0)
await t.click('Update', 500)
await answer('Yes')
check('screen: Yes reports Record Saved', await t.toast('Record Saved'))
check(
  'screen: the request names the ticked worksheets, the bordx and the dates',
  posted.length === 1 &&
    posted[0].claims.length === 2 &&
    posted[0].claims[0].caseNo === big.rows[0].caseNo &&
    posted[0].claims[0].version === big.rows[0].claimVersion &&
    posted[0].bordxNo === 'ZZ-E2E-1' &&
    posted[0].bordxDate === '2026-10-30' &&
    posted[0].acMonth === '7' &&
    posted[0].toPayorDate === '2026-10-31' &&
    posted[0].receiptNo === undefined,
  JSON.stringify(posted[0]),
)
check(
  'screen: the list and the counters are cleared after the update',
  (await rowsOf()).length === 0 && (await stat('Records')) === '0' && (await stat('Amt Checked')) === '0.00',
)

// a void worksheet cannot be ticked
await t.click('Clear', 300)
await t.type('Payor', 'TA')
await page.evaluate(() =>
  [...document.querySelectorAll('label')]
    .find((l) => l.textContent.includes('Search Empty Data'))
    ?.querySelector('input')
    ?.click(),
)
await t.click('Search', 2500)
const everyRow = await rowsOf()
const bordxedIndex = everyRow.findIndex((r) => r[16] === 'VOID')
await tick(bordxedIndex)
check('screen: a void worksheet cannot be ticked', (await t.toast('Claim is void!')) && (await stat('Amt Checked')) === '0.00', `${bordxedIndex}`)
check('screen: nothing was written', (await json(`${U}?${q({ payor: 'TA' })}`)).rows.length === unbordxed.rows.length)

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
await limited.goto(`${BASE}/claim-bordx/update-bordx`, { waitUntil: 'networkidle0' })
await limited.waitForSelector('h2')
check('access: without position 15 the page says Access Denied!', (await limited.$eval('h2', (e) => e.textContent)) === 'Access Denied!')
check('access: and the API refuses with 403', (await get(`${U}?payor=TA`, mint(access))).status === 403)

console.log(`screenshots: ${t.shots}`)
const ok = t.summary()
await t.browser.close()
process.exit(ok ? 0 : 1)
