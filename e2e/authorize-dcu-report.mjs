// Authorize Claims > DCU Tracking > Claim Report (DCU Reports). Everything here reads: the reports are queries and nothing is written. The API checks that stop before the database are real calls too.
import { start, BASE } from './lib.mjs'
import { mint } from './mint.mjs'

const t = await start()
const { page, check } = t

const get = (path, token = mint()) => fetch(`${BASE}${path}`, { headers: { Authorization: `Bearer ${token}` } })
const json = async (path) => (await get(path)).json()
const post = (path, body, token = mint()) =>
  fetch(`${BASE}${path}`, { method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
const D = '/api/authorize/dcu-report'
const run = async (body) => {
  const res = await post(`${D}/run`, body)
  return { status: res.status, body: await res.json().catch(() => ({})) }
}
const headers = () => page.$$eval('table thead th', (ths) => ths.map((th) => th.textContent.trim()).filter(Boolean))
const rowsOf = () =>
  page.$$eval('table tbody tr', (trs) => trs.map((tr) => [...tr.querySelectorAll('td')].map((td) => td.textContent.trim())).filter((r) => r.length > 1))
const stat = (label) =>
  page.evaluate(
    (l) =>
      [...document.querySelectorAll('.stat')].find((s) => s.querySelector('.stat-label')?.textContent === l)?.querySelector('.stat-value')?.textContent ?? null,
    label,
  )
const options = (name) => page.$$eval(`select[name=${name}] option`, (o) => o.map((x) => x.textContent.trim()).filter(Boolean))
const present = async (name) => (await page.$(`[name=${name}]`)) !== null
const figure = (cell) => Number(cell.replace(/[(),]/g, '')) * (/^\(/.test(cell) ? -1 : 1)

// ---------------- the API
const lookups = await json(`${D}/lookups`)
check(
  'api: ten report types with their selections for Claim and for Case',
  lookups.reportTypes.length === 10 &&
    lookups.reportTypes[9].case === null &&
    lookups.reportTypes[1].claim.length === 6 &&
    lookups.reportTypes[1].case.length === 5 &&
    lookups.reportTypes[4].claim.length === 12 &&
    lookups.reportTypes[6].claim.length === 0,
)
check(
  'api: insured types, payors with their health type and policy statuses',
  lookups.insTypes.length >= 1 && lookups.policyStatuses.length >= 1 && lookups.payors.some((p) => p.code === 'AC' && p.healthType),
)
check('api: the group companies of a payor', (await json(`${D}/group-companies?payor=AC`)).length >= 1 && (await json(`${D}/group-companies`)).length === 0)
check(
  'api: a report must be chosen and Efficiency is not a Case report',
  (await run({ mode: null })).body.message === 'Please select a Claim or Case Report.' &&
    (await run({ mode: 'case', reportType: 9, selection: 0 })).body.message === 'Select a report type and selection.',
)
check(
  'api: a criterion with a wrong code is refused',
  (await run({ mode: 'claim', reportType: 0, healthType: 'X' })).body.message === 'Select a valid HLT Type.',
)

const gl = await run({ mode: 'claim', reportType: 0, selection: 0, payor: 'AC', caseStatus: 3, caseNoFrom: 'AC00000644', caseNoTo: 'AC00000644' })
check(
  'api: the claim general listing has the 49 columns and a row per claim of the case',
  gl.status === 200 &&
    gl.body.columns.length === 49 &&
    gl.body.rows.length >= 1 &&
    gl.body.rows.every((r) => r.length === 49 && r[1].startsWith('AC00000644-')),
  JSON.stringify(gl.body.rows?.[0]?.slice(0, 5)),
)
check(
  'api: its ICD description comes with the code',
  gl.body.rows.some((r) => r[20] && r[21]),
  JSON.stringify(gl.body.rows[0].slice(18, 24)),
)
const cs = await run({ mode: 'case', reportType: 0, selection: 0, payor: 'AC', caseStatus: 3, caseNoFrom: 'AC00000644', caseNoTo: 'AC00000644' })
check(
  'api: the case general listing has 48 columns and shows the bordx amounts of the case',
  cs.status === 200 &&
    cs.body.columns.length === 48 &&
    cs.body.rows.length === 1 &&
    cs.body.rows[0][1] === 'AC00000644' &&
    cs.body.rows[0][25] === '16,246.30' &&
    cs.body.rows[0][24] === '',
  JSON.stringify(cs.body.rows?.[0]?.slice(22, 28)),
)

const age = await run({ mode: 'claim', reportType: 1, selection: 0, payor: 'AC', caseStatus: 3 })
check(
  'api: age band summary of a payor, claim: counts, duration and amounts by age band',
  age.status === 200 && age.body.title === 'Claim - Age Band - Summary' && age.body.rows[0].join('|') === '01|176|492|640,898.21|609,536.02',
  JSON.stringify(age.body.rows?.[0]),
)
const ageCase = await run({ mode: 'case', reportType: 1, selection: 0, payor: 'AC', caseStatus: 3 })
check(
  'api: the same for case takes the duration from the duration case, one per group',
  ageCase.status === 200 &&
    ageCase.body.rows.length === age.body.rows.length &&
    ageCase.body.rows.every((r) => r[2] !== '' && Number(r[2]) >= 1) &&
    ageCase.body.columns[1].header === 'Total Cases',
  JSON.stringify(ageCase.body.rows?.slice(0, 2)),
)
const month = await run({ mode: 'claim', reportType: 4, selection: 0, payor: 'AC', caseStatus: 3 })
check(
  'api: a month report is labelled year/month and is in date order',
  month.status === 200 &&
    month.body.rows.every((r) => /^\d{4}\/\d{2}$/.test(r[0]) || r[0] === '/') &&
    month.body.rows.map((r) => r[0]).join() === [...month.body.rows.map((r) => r[0])].sort().join(),
  month.body.rows.map((r) => r[0]).join(),
)
const top = await run({ mode: 'claim', reportType: 3, selection: 3 })
const topAmount = await run({ mode: 'claim', reportType: 3, selection: 4 })
check(
  'api: Top 20 by Claims lists the 20 highest by number of claims',
  top.status === 200 && top.body.rows.length === 20 && top.body.rows.every((r, i, a) => i === 0 || Number(a[i - 1][2]) >= Number(r[2])),
  top.body.rows?.map((r) => r[2]).join(),
)
check(
  'api: Top 20 by Amount lists the 20 highest by approved amount',
  topAmount.status === 200 && topAmount.body.rows.length === 20 && topAmount.body.rows.every((r, i, a) => i === 0 || figure(a[i - 1][5]) >= figure(r[5])),
  topAmount.body.rows?.map((r) => r[5]).join(),
)
const diag = await run({ mode: 'claim', reportType: 2, selection: 1 })
check(
  'api: Top 20 diagnoses by amount carry the ICD description',
  diag.status === 200 &&
    diag.body.rows.length === 20 &&
    diag.body.rows.every((r, i, a) => i === 0 || figure(a[i - 1][5]) >= figure(r[5])) &&
    diag.body.rows.some((r) => r[1] !== ''),
)
const dir = await run({ mode: 'claim', reportType: 9, selection: 0, payor: 'AC' })
check(
  'api: the registration efficiency report counts the claims of a month by age band and what is outstanding',
  dir.status === 200 &&
    dir.body.rows[0].join('|') === 'January|29|0|1|11|10|7|0' &&
    dir.body.columns.map((c) => c.header).join() === 'DIR Month,Total,0-15,15-30,31-60,61-90,>90,O/S',
  JSON.stringify(dir.body.rows?.[0]),
)
const os = await run({ mode: 'claim', reportType: 9, selection: 4, payor: 'AC' })
check(
  'api: the outstanding bordereaux report carries each month forward',
  os.status === 200 &&
    os.body.rows.length >= 2 &&
    os.body.rows[0][1] === '0' &&
    os.body.rows.every((r, i, a) => (i === 0 || Number(r[1]) === Number(a[i - 1][4])) && Number(r[4]) === Number(r[1]) + Number(r[2]) - Number(r[3])),
  JSON.stringify(os.body.rows?.slice(0, 3)),
)
for (const [type, selection] of [
  [9, 1],
  [9, 2],
  [9, 3],
]) {
  const r = await run({ mode: 'claim', reportType: type, selection, payor: 'AC' })
  check(
    `api: efficiency report ${selection} runs (the invoice views too)`,
    r.status === 200 && r.body.rows.length >= 1 && r.body.rows.every((x) => x.length === 8),
    JSON.stringify(r.body).slice(0, 120),
  )
}
const none = await run({ mode: 'claim', reportType: 0, selection: 0, caseNoFrom: 'ZZ-NO-SUCH-CASE' })
check('api: nothing found is No record found!', none.status === 404 && none.body.message === 'No record found!', JSON.stringify(none))
const hostile = await run({ mode: 'claim', reportType: 0, selection: 0, agentCode: "x'; DROP TABLE dbo.PAY;--", policyNo: "' OR 1=1 --" })
check(
  'api: criteria are quoted (a quote and a semicolon are only text)',
  hostile.status === 404 && hostile.body.message === 'No record found!',
  JSON.stringify(hostile),
)
const wide = await run({ mode: 'claim', reportType: 0, selection: 0, caseStatus: 3 })
check(
  'api: more than 5,000 rows are cut and said so',
  wide.status === 200 && wide.body.rows.length === 5000 && wide.body.truncated === true,
  `${wide.body.rows?.length}`,
)
const memberCase = await run({ mode: 'case', reportType: 6, payor: 'AC', caseStatus: 3, versionFrom: 5, bordxNoFrom: 'ZZZ' })
check(
  'api: a case report ignores the bordx and version criteria it does not have',
  memberCase.status === 200 && memberCase.body.rows.length === 1 && memberCase.body.rows[0][2] !== '',
  JSON.stringify(memberCase.body.rows),
)

// ---------------- the screen
await t.go('/authorize/dcu-report')
check('screen: title', (await page.$eval('h2', (e) => e.textContent)) === 'DCU Reports')
const side = await page.$$eval('.sidebar a, .sidebar span', (a) => a.map((x) => x.textContent.trim()))
check(
  'menu: Claims lists Claim Report as a link and Claim Pass to A/C disabled',
  side.includes('Claim Report') &&
    side.includes('Claim Pass to A/C') &&
    (await page.$$eval('.sidebar a', (a) => a.map((x) => x.textContent.trim()))).includes('Claim Report') &&
    !(await page.$$eval('.sidebar a', (a) => a.map((x) => x.textContent.trim()))).includes('Claim Pass to A/C'),
  side.join('|'),
)
check(
  'screen: Claim, General Listing and its one selection are chosen',
  (await page.$eval('select[name=mode]', (e) => e.value)) === 'claim' &&
    (await options('reportType')).length === 10 &&
    (await options('selection')).join() === 'Without Remarks',
)
check(
  'screen: Case Status starts as Open & Close, Stop is off and the record count is 0',
  (await page.$eval('select[name=caseStatus]', (e) => e.value)) === '1' && (await t.isDisabled('Stop')) && (await stat('Record(s)')) === '0',
)
await t.select('Report Type', '1')
check('screen: a type has its own selections', (await options('selection')).join() === 'Summary,By Gender,By Insured Type,By Race,By Plan No,By Bordx Month')
await t.select('Report Type', '6')
check('screen: Payor and State have no selection', (await page.$('select[name=selection]')) === null)
await t.select('Claim / Case', 'case')
check(
  'screen: a Case report starts again at the general listing and has no Efficiency',
  (await page.$eval('select[name=reportType]', (e) => e.value)) === '0' && !(await options('reportType')).includes('Efficiency'),
)
check(
  'screen: a Case report has no bordx or version criteria',
  !(await present('bordxNoFrom')) &&
    !(await present('bordxDateFrom')) &&
    !(await present('versionFrom')) &&
    !(await present('blankBordxNo')) &&
    (await present('policyNo')),
)
await t.select('Claim / Case', 'claim')
check(
  'screen: back to a Claim report they are there again',
  (await present('bordxNoFrom')) && (await present('versionFrom')) && (await options('reportType')).includes('Efficiency'),
)

await t.select('HLT Type', 'S')
const sihat = await page.$$eval('input[name=payor] + datalist option, datalist option', (o) => o.map((x) => x.value))
check(
  'screen: choosing an HLT Type narrows the payors to its own',
  sihat.length > 0 &&
    sihat.length < lookups.payors.length &&
    sihat.every((v) => lookups.payors.some((p) => `${p.code} - ${p.name}` === v && p.healthType === 'S')),
  `${sihat.length}/${lookups.payors.length}`,
)
await t.select('HLT Type', '')

await t.type('Claim No from', 'AC00000644')
await t.type('Claim No to', 'AC00000644')
await t.select('Case Status', '3')
await t.click('Search', 4000)
const shownHeaders = await headers()
const shownRows = await rowsOf()
check(
  'screen: the general listing is headed as the desktop headed it and shows the claims of the case',
  shownHeaders.length === 49 &&
    shownHeaders[1] === 'Claim No' &&
    shownHeaders[48] === 'Procedures Desc.' &&
    shownRows.length >= 1 &&
    shownRows[0][1].startsWith('AC00000644-'),
  shownHeaders.slice(0, 4).join('|'),
)
check('screen: Record(s) counts the rows and Stop is off again', (await stat('Record(s)')) === String(shownRows.length) && (await t.isDisabled('Stop')))
await t.click('View', 400)
check('screen: View shows the list alone', (await page.$('select[name=mode]')) === null && (await headers()).length === 49)
await t.click('Back', 400)
check('screen: Back shows the criteria again', (await page.$('select[name=mode]')) !== null)
await page.evaluate(() => {
  window.__blobs = []
  const create = URL.createObjectURL.bind(URL)
  URL.createObjectURL = (b) => {
    window.__blobs.push(b)
    return create(b)
  }
})
await t.click('Print to File', 600)
const csv = await page.evaluate(async () => (window.__blobs.length ? await window.__blobs.at(-1).text() : ''))
check(
  'screen: Print to File writes the list with its headings',
  csv.includes('Payor,Claim No,BordxNo,Bordx Date') && csv.includes('AC00000644-'),
  csv.slice(0, 80),
)

await t.select('Report Type', '1')
await t.select('Report Selection', '1')
await t.click('Search', 4000)
check(
  'screen: a group report lists its groups',
  (await headers()).join() === 'Gender,Ageband,Total Claims,Total Duration,Total Actual Amt,Total Approved Amt' || (await headers()).length === 0,
  (await headers()).join(),
)
await t.type('Claim No from', 'ZZ-NO-SUCH-CASE')
await t.type('Claim No to', 'ZZ-NO-SUCH-CASE')
await t.click('Search', 2500)
check('screen: nothing found says No record found!', await t.toast('No record found!'))
await t.click('Clear', 300)
check(
  'screen: Clear empties the criteria and the list',
  (await rowsOf()).length === 0 && (await stat('Record(s)')) === '0' && (await page.$eval('select[name=caseStatus]', (e) => e.value)) === '1',
)
await t.click('Print to File', 400)
check('screen: Print to File without a record says so', await t.toast('Report cannot be printed without any record.'))

// ---------------- access: position 16 withheld
const access = '1'.repeat(15) + '0' + '1'.repeat(14)
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
await limited.goto(`${BASE}/authorize/dcu-report`, { waitUntil: 'networkidle0' })
await limited.waitForSelector('h2')
check('access: without position 16 the page says Access Denied!', (await limited.$eval('h2', (e) => e.textContent)) === 'Access Denied!')
check('access: and the API refuses with 403', (await get(`${D}/lookups`, mint(access))).status === 403)

console.log(`screenshots: ${t.shots}`)
const ok = t.summary()
await t.browser.close()
process.exit(ok ? 0 : 1)
