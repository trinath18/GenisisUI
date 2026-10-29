// Claim Bordx menu: Send to Payor, Returned From Payor, Send to A/C and Bordx Approval (Bor Delivery), Remove Worksheet, the Insert Worksheet entry and the menu around them. Reads the real bordx; the POSTs that would change them are
// intercepted and answered here (the database writes are covered by the API's own rolled-back database tests), so nothing is written.
import { start, sleep, BASE } from './lib.mjs'
import { mint } from './mint.mjs'

const t = await start()
const { page, check } = t

const get = async (path, token = mint()) => fetch(`${BASE}${path}`, { headers: { Authorization: `Bearer ${token}` } })
const json = async (path) => (await get(path)).json()
const stat = (label) =>
  page.evaluate(
    (l) =>
      [...document.querySelectorAll('.stat')].find((s) => s.querySelector('.stat-label')?.textContent === l)?.querySelector('.stat-value')?.textContent ?? null,
    label,
  )
const tick = (no) => page.evaluate((k) => document.querySelector(`input[aria-label="Select ${k}"]`)?.click(), no)
const gridRows = async (caption) => (await t.rows(caption)).filter((r) => r.length > 1)
const headers = (caption) => page.$$eval(`table[aria-label="${caption}"] thead th`, (ths) => ths.map((th) => th.textContent.trim()).filter(Boolean))
const dialogs = () => page.$$eval('[role=dialog]', (d) => d.map((x) => x.textContent.replace(/\s+/g, ' ').trim()))

const posts = []
let fakeReturn = false
let fakeSentOut = false
const fakeRow = (bordxNo, sent) => ({
  payor: 'AB',
  bordxNo,
  bordxDate: '2021-04-01T00:00:00',
  amount: 100,
  bordxStatus: 'C',
  sent,
  sentOn: sent ? '2021-05-01T00:00:00' : null,
  sentBy: null,
  periodMonth: '3',
  periodYear: '2021',
})
await page.setRequestInterception(true)
page.on('request', (req) => {
  if (fakeSentOut && req.method() === 'GET' && /\/api\/claim-bordx\/revise\?/.test(req.url())) {
    const row = {
      caseNo: 'ZZ1',
      claimVersion: 1,
      claimNo: 'ZZ1 - 1',
      claimOpenDate: null,
      mbmNumber: 'M1',
      patientName: 'P',
      dateAdmitted: null,
      dischargeDate: null,
      totalApproved: 5,
      caseStatus: 'O',
    }
    return req.respond({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ bordxNo: 'NZZ1', bordxDate: '2021-08-06T00:00:00', printedDate: null, items: 1, totalApproved: 5, sentOut: true, rows: [row] }),
    })
  }
  if (req.method() === 'POST' && /\/api\/claim-bordx\/revise\/remove$/.test(req.url())) {
    posts.push({ url: new URL(req.url()).pathname, body: JSON.parse(req.postData()) })
    return req.respond({ status: 200, contentType: 'application/json', body: JSON.stringify({ message: 'Record updated...', removed: 1 }) })
  }
  if (fakeReturn && req.method() === 'GET' && /\/api\/claim-bordx\/delivery\/from-payor\/search/.test(req.url())) {
    return req.respond({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ rows: [fakeRow('FAKE0000001', false), fakeRow('FAKE0000002', true)], truncated: false }),
    })
  }
  if (req.method() === 'POST' && /\/api\/claim-bordx\/delivery\/[a-z-]+\/send$/.test(req.url())) {
    posts.push({ url: new URL(req.url()).pathname, body: JSON.parse(req.postData()) })
    return req.respond({ status: 200, contentType: 'application/json', body: JSON.stringify({ message: 'Record updated...', updated: 1 }) })
  }
  req.continue()
})

// the data: a payor with a handful of bordx
let payor = ''
let rows = []
for (const candidate of ['AN', 'ST', 'WK', 'AC', 'AH', 'XI', 'IB', 'GC']) {
  const found = (await json(`/api/claim-bordx/delivery/to-payor/search?useScan=false&payor=${candidate}`)).rows
  if (found.length >= 3 && found.length <= 800) {
    payor = candidate
    rows = found
    break
  }
}
check('data: a payor with some bordx is found', rows.length >= 3, `${payor} ${rows.length}`)

// ---------------- the API
const toPayor = await json(`/api/claim-bordx/delivery/to-payor/search?useScan=false&payor=${payor}`)
const toAccounts = await json(`/api/claim-bordx/delivery/to-accounts/search?useScan=false&payor=${payor}`)
check(
  'api: both screens list the payor bordx, unsent and in bordx number order',
  toPayor.rows.length === rows.length && toAccounts.rows.length === rows.length && toPayor.rows.every((r) => !r.sent),
)
check(
  'api: the list is in bordx number order',
  toPayor.rows.every((r, i) => i === 0 || toPayor.rows[i - 1].bordxNo <= r.bordxNo),
)
check(
  'api: status 1 (sent) lists none, status 2 (both) lists all',
  (await json(`/api/claim-bordx/delivery/to-payor/search?useScan=false&payor=${payor}&status=1`)).rows.length === 0 &&
    (await json(`/api/claim-bordx/delivery/to-payor/search?useScan=false&payor=${payor}&status=2`)).rows.length === rows.length,
)
check(
  'api: an unknown step is not an API route (no JSON answer)',
  !((await get('/api/claim-bordx/delivery/to-moon/search')).headers.get('content-type') ?? '').includes('json'),
)
const refused = await fetch(`${BASE}/api/claim-bordx/delivery/to-payor/send`, {
  method: 'POST',
  headers: { Authorization: `Bearer ${mint()}`, 'Content-Type': 'application/json' },
  body: JSON.stringify({ bordxNos: [], date: '2026-10-05' }),
})
check(
  'api: an update with nothing ticked is refused with the desktop message',
  refused.status === 400 && (await refused.json()).message === 'Please select at least one record to be updated!',
)

// ---------------- the menu
await t.go('/claim-bordx/send-to-payor')
const links = await page.$$eval('.sidebar a', (els) => els.map((e) => e.textContent.trim()))
const disabled = await page.$$eval('.sidebar span.disabled', (els) => els.map((e) => e.textContent.trim()))
check(
  'menu: Insert Worksheet, Send to Payor and Send to A/C are links',
  ['Insert Worksheet', 'Remove Worksheet', 'Send to Payor', 'Returned From Payor', 'Bordx Approval', 'Send to A/C'].every((x) => links.includes(x)),
  links.join('|'),
)
check(
  'menu: the items of the desktop menu that are not migrated yet are listed and disabled',
  ['Print Bordx', 'Print Recovery', 'Update Bordx', 'Bordx Control', 'Outstanding Bordx'].every((x) => disabled.includes(x)),
  disabled.join('|'),
)

// ---------------- Send to Payor
check('payor: title', (await page.$eval('h2', (e) => e.textContent)) === 'Send to Payor')
check(
  'payor: the status starts on Not Sent and the scan is on',
  (await t.value('Status')) === '0' && (await page.$eval('input[type=checkbox]', (e) => e.checked)),
)
await t.click('Search', 500)
check('payor: a scan needs a payor', (await t.errors()).includes('Please select a Payor'), JSON.stringify(await t.errors()))
await t.type('Payor', payor)
await t.click('Search', 500)
check('payor: and then a bordx number', (await t.errors()).includes('Please Enter Bordx No'), JSON.stringify(await t.errors()))
await t.type('Bordx No', rows[0].bordxNo)
await t.click('Search', 900)
check(
  'payor: a scan lists the bordx',
  (await gridRows('Bordx to send to the payor')).length === 1 && (await stat('Records')) === '1',
  String((await gridRows('Bordx to send to the payor')).length),
)
await t.type('Bordx No', rows[0].bordxNo)
await t.click('Search', 700)
check(
  'payor: scanning it again says so and adds nothing',
  (await t.toast('Data has been uploaded!')) && (await gridRows('Bordx to send to the payor')).length === 1,
)
await t.type('Bordx No', rows[1].bordxNo)
await t.click('Search', 900)
check('payor: another scan adds a second row', (await gridRows('Bordx to send to the payor')).length === 2)
await t.type('Bordx No', 'NO SUCH BORDX')
await t.click('Search', 900)
check('payor: an unknown bordx says No record found!', await t.toast('No record found!'))

await t.click('Clear', 300)
await t.checkbox('Use Scan')
await t.type('Payor', payor)
await t.click('Search', 1200)
const listed = await gridRows('Bordx to send to the payor')
check('payor: a range search lists every unsent bordx of the payor', listed.length === rows.length, `${listed.length} vs ${rows.length}`)
check(
  'payor: the headings are the desktop list headings',
  JSON.stringify(await headers('Bordx to send to the payor')) ===
    JSON.stringify(['Payor', 'Bordx No', 'Bordx Date', 'Bordx Amount', 'Bordx Status', 'Sent to Payor Status', 'To Payor', 'Sent By', 'A/C Period']),
  JSON.stringify(await headers('Bordx to send to the payor')),
)
check('payor: the first row is the first bordx and shows Not Sent', listed[0][2] === rows[0].bordxNo && listed[0][6] === 'Not Sent', JSON.stringify(listed[0]))
const total = rows.reduce((sum, r) => sum + (r.amount ?? 0), 0)
check(
  'payor: the counters are the records, none selected and the total amount',
  (await stat('Records')) === String(rows.length) &&
    (await stat('Selected')) === '0' &&
    Math.abs(Number((await stat('Total Amt')).replace(/,/g, '')) - total) < 0.01,
  `${await stat('Total Amt')} vs ${total}`,
)

await t.click('Update', 500)
check('payor: update with nothing ticked says so', await t.toast('Please select at least one record to be updated!'))
await tick(rows[0].bordxNo)
await tick(rows[2].bordxNo)
check('payor: two bordx are ticked', await t.waitFor(async () => (await stat('Selected')) === '2'), String(await stat('Selected')))
await t.click('Update', 500)
check('payor: update needs a date', (await t.errors()).includes('Please Enter in date'), JSON.stringify(await t.errors()))
await t.type('Date', '05102026')
await t.click('Update', 600)
check(
  'payor: update asks Do you want to update the record?',
  (await dialogs()).some((d) => d.includes('Do you want to update the record?')),
  JSON.stringify(await dialogs()),
)
await (await t.btn('No')).click()
await sleep(400)
check('payor: No sends nothing', posts.length === 0)
await t.click('Update', 600)
await t.yes()
check('payor: Yes reports success', await t.toast('Record updated...'))
const sent = posts.at(-1)
check(
  'payor: and sends the date as an ISO day and the two ticked bordx numbers',
  posts.length === 1 &&
    sent.url.endsWith('/to-payor/send') &&
    sent.body.date === '2026-10-05' &&
    JSON.stringify(sent.body.bordxNos) === JSON.stringify([rows[0].bordxNo, rows[2].bordxNo]),
  JSON.stringify(sent),
)

// ---------------- Send to A/C
await t.go('/claim-bordx/send-to-accounts')
check('accounts: title', (await page.$eval('h2', (e) => e.textContent)) === 'Send to A/C')
await t.checkbox('Use Scan')
await t.type('Payor', payor)
await t.click('Search', 1200)
check(
  'accounts: the headings are the desktop list headings',
  JSON.stringify(await headers('Bordx to send to accounts')) ===
    JSON.stringify([
      'Payor',
      'Bordx No',
      'Bordx Date',
      'Bordx Amount',
      'Bordx Status',
      'To Payor',
      'Fr Payor',
      'To MNRB',
      'Fr MNRB',
      'To A/C',
      'Sent to AC Status',
      'Sent By',
      'A/C Period',
    ]),
  JSON.stringify(await headers('Bordx to send to accounts')),
)
check('accounts: the range search lists the payor bordx', (await gridRows('Bordx to send to accounts')).length === rows.length)
check(
  'accounts: its criteria are the date sent, not the A/C period',
  (await page.$$eval('label.form-field span', (s) => s.map((x) => x.textContent))).some((x) => x.includes('Date Sent from')) &&
    !(await page.$$eval('label.form-field span', (s) => s.map((x) => x.textContent))).some((x) => x.includes('A/C Month')),
)
await tick(rows[1].bordxNo)
await t.type('Date', '06102026')
await t.click('Update', 600)
await t.yes()
const sentAc = posts.at(-1)
check(
  'accounts: update sends the date and the ticked bordx to the accounts route',
  posts.length === 2 &&
    sentAc.url.endsWith('/to-accounts/send') &&
    sentAc.body.date === '2026-10-06' &&
    JSON.stringify(sentAc.body.bordxNos) === JSON.stringify([rows[1].bordxNo]),
  JSON.stringify(sentAc),
)
await page.screenshot({ path: `${t.shots}/claim-bordx-accounts.png`, fullPage: true })

// ---------------- Returned From Payor
check(
  'returned: nothing in the data has been sent to accounts yet, so the list is empty',
  (await json('/api/claim-bordx/delivery/from-payor/search?useScan=false')).rows.length === 0,
)
await t.go('/claim-bordx/returned-from-payor')
check('returned: title', (await page.$eval('h2', (e) => e.textContent)) === 'Returned From Payor')
check(
  'returned: the status starts on Not Returned',
  (await t.value('Status')) === '0' && (await page.$$eval('select option', (o) => o.map((x) => x.textContent))).join('|') === 'Not Returned|Returned|Both',
)
await t.checkbox('Use Scan')
await t.type('Payor', payor)
await t.click('Search', 900)
check('returned: a search with nothing sent to accounts says No record found!', await t.toast('No record found!'))
fakeReturn = true
await t.click('Search', 900)
check(
  'returned: the headings are the desktop list headings',
  JSON.stringify(await headers('Bordx returned from the payor')) ===
    JSON.stringify(['Payor', 'Bordx No', 'Bordx Date', 'Bordx Amount', 'Bordx Status', 'Returned Fr Payor Status', 'Fr Payor', 'A/C Period']),
  JSON.stringify(await headers('Bordx returned from the payor')),
)
const returned = await gridRows('Bordx returned from the payor')
check(
  'returned: the list shows Not Returned and Returned with the A/C period',
  returned.length === 2 && returned[0][6] === 'Not Returned' && returned[1][6] === 'Returned' && returned[0][8] === '3/2021',
  JSON.stringify(returned),
)
await tick('FAKE0000002')
check('returned: a bordx already returned cannot be ticked', (await t.toast('Record has been Updated!')) && (await stat('Selected')) === '0')
await tick('FAKE0000001')
await t.type('Date', '07102026')
await t.click('Update', 600)
await t.yes()
const back = posts.at(-1)
check(
  'returned: update sends the date and the ticked bordx to the from-payor route',
  back.url.endsWith('/from-payor/send') && back.body.date === '2026-10-07' && JSON.stringify(back.body.bordxNos) === JSON.stringify(['FAKE0000001']),
  JSON.stringify(back),
)
fakeReturn = false

// ---------------- Bordx Approval
const approvalApi = await json(`/api/claim-bordx/delivery/approval/search?useScan=false&payor=${payor}`)
check('approval: the API lists the payor bordx, none approved yet', approvalApi.rows.length === rows.length && approvalApi.rows.every((r) => !r.sent))
await t.go('/claim-bordx/approval')
check('approval: title', (await page.$eval('h2', (e) => e.textContent)) === 'Bordx Approval')
check(
  'approval: the status starts on Not Approved',
  (await t.value('Status')) === '0' && (await page.$$eval('select option', (o) => o.map((x) => x.textContent))).join('|') === 'Not Approved|Approved|Both',
)
const approvalLabels = await page.$$eval('label.form-field span', (x) => x.map((e) => e.textContent))
check(
  'approval: it asks for no date and has no A/C period or date sent criteria',
  !approvalLabels.includes('Date') && !approvalLabels.some((l) => l.includes('A/C Month') || l.includes('Date Sent')),
  approvalLabels.join('|'),
)
await t.checkbox('Use Scan')
await t.type('Payor', payor)
await t.click('Search', 1200)
check(
  'approval: the headings are the desktop list headings',
  JSON.stringify(await headers('Bordx to approve')) ===
    JSON.stringify(['Payor', 'Bordx No', 'Bordx Date', 'Bordx Amount', 'Bordx Status', 'Approved Status', 'Approved By', 'Approved Date']),
  JSON.stringify(await headers('Bordx to approve')),
)
check(
  'approval: the range search lists the payor bordx as Not Approved',
  (await gridRows('Bordx to approve')).length === rows.length && (await gridRows('Bordx to approve'))[0][6] === 'Not Approved',
)
await t.click('Update', 500)
check('approval: update with nothing ticked says so', await t.toast('Please select at least one record to be updated!'))
await tick(rows[0].bordxNo)
await t.click('Update', 600)
check(
  'approval: with something ticked it asks to confirm and needs no date',
  (await dialogs()).some((d) => d.includes('Do you want to update the record?')),
  JSON.stringify(await dialogs()),
)
await t.yes()
const approved = posts.at(-1)
const now = new Date()
const today = [now.getFullYear(), String(now.getMonth() + 1).padStart(2, '0'), String(now.getDate()).padStart(2, '0')].join('-')
check(
  'approval: update sends today and the ticked bordx to the approval route',
  approved.url.endsWith('/approval/send') && approved.body.date === today && JSON.stringify(approved.body.bordxNos) === JSON.stringify([rows[0].bordxNo]),
  JSON.stringify(approved),
)

// ---------------- Remove Worksheet (Bordereaux Revise)
let revise = null
for (const row of rows) {
  const found = await json(`/api/claim-bordx/revise?bordxNo=${row.bordxNo}`)
  if (found.items >= 3 && !found.sentOut) {
    revise = found
    break
  }
}
if (!revise)
  for (const candidate of ['UB', 'UT', 'UC', 'ST', 'AC', 'AN']) {
    const list = (
      await json(`/api/claim-bordx/delivery/to-payor/search?useScan=false&payor=${candidate}&bordxFrom=N${candidate}0&bordxTo=N${candidate}9`)
    ).rows.slice(-6)
    for (const row of list) {
      const found = await json(`/api/claim-bordx/revise?bordxNo=${row.bordxNo}`)
      if (found.items >= 3 && !found.sentOut) {
        revise = found
        break
      }
    }
    if (revise) break
  }
check('revise: a bordx with several worksheets is found', !!revise, revise?.bordxNo)
check(
  'revise: the API answers the worksheets with patient and member',
  revise.rows.length === revise.items && revise.rows.every((r) => r.patientName && r.mbmNumber),
)
check('revise: an unknown bordx has no worksheets', (await json('/api/claim-bordx/revise?bordxNo=NO%20SUCH%20BORDX')).items === 0)
check(
  'revise: a lookup without a number is refused with the desktop message',
  (await (await get('/api/claim-bordx/revise?bordxNo=')).json()).message === 'Please select a Bordx No',
)
await t.go('/claim-bordx/remove-worksheet')
check('revise: title', (await page.$eval('h2', (e) => e.textContent)) === 'Bordereaux Revise')
await t.click('Go', 500)
check('revise: Go needs a bordx number', (await t.errors()).includes('Please select a Bordx No'), JSON.stringify(await t.errors()))
await t.type('Bordx No', 'NO SUCH BORDX')
await t.click('Go', 800)
check('revise: an unknown bordx says No record found!', await t.toast('No record found!'))
await t.type('Bordx No', revise.bordxNo)
await t.click('Go', 1000)
const revRows = await gridRows('Worksheets of the bordx')
check('revise: the list has every worksheet of the bordx', revRows.length === revise.items, `${revRows.length} vs ${revise.items}`)
check(
  'revise: the headings are the desktop list headings',
  JSON.stringify(await headers('Worksheets of the bordx')) ===
    JSON.stringify(['Claim No', 'Claim Reg Date', 'Mem No', 'Patient', 'DOA', 'DOD', 'Approved Amt', 'Case Status']),
  JSON.stringify(await headers('Worksheets of the bordx')),
)
check(
  'revise: the counters are the items and the approved amount',
  (await stat('Items')) === String(revise.items) && Math.abs(Number((await stat('Approved Amount')).replace(/,/g, '')) - revise.totalApproved) < 0.01,
  `${await stat('Items')} ${await stat('Approved Amount')}`,
)
check(
  'revise: the bordx date is shown',
  (await page.$$eval('dl.fields dd', (d) => d.map((x) => x.textContent))).some((x) => /^\d\d\/\d\d\/\d{4}$/.test(x)),
)
await t.click('Remove', 500)
check('revise: removing with nothing ticked says so', await t.toast('Please select at least one record to be removed!'))
const first = revise.rows[0]
await tick(`${first.caseNo.trim()}-${first.claimVersion}`)
await t.click('Remove', 600)
check(
  'revise: removing asks the desktop question',
  (await dialogs()).some((d) => d.includes('You are going to remove a worksheet from current Bordereaux.') && d.includes('Are you sure?')),
  JSON.stringify(await dialogs()),
)
const before = posts.length
await (await t.btn('No')).click()
await sleep(400)
check('revise: No removes nothing', posts.length === before)
await t.click('Remove', 600)
await t.yes()
const removal = posts.at(-1)
check(
  'revise: Yes sends the bordx and the ticked worksheet',
  removal.url.endsWith('/revise/remove') &&
    removal.body.bordxNo === revise.bordxNo &&
    JSON.stringify(removal.body.items) === JSON.stringify([{ caseNo: first.caseNo, claimVersion: first.claimVersion }]),
  JSON.stringify(removal),
)
check(
  'revise: and clears the form and reports success',
  (await t.toast('Record updated...')) && (await gridRows('Worksheets of the bordx')).length === 0 && (await t.value('Bordx No')) === '',
)
fakeSentOut = true
await t.type('Bordx No', 'NZZ1')
await t.click('Go', 900)
check(
  'revise: a bordx that has been sent out says so and cannot be revised',
  (await t.toast('This Bordx has been sent out.')) && (await (await t.btn('Remove')).evaluate((b) => b.disabled)),
)
fakeSentOut = false
await t.type('Bordx No', 'LOB001')
await t.click('Go', 900)
check('revise: a scan code opens another screen', (await page.$eval('h2', (e) => e.textContent)) === 'Inpatient Case Listing')

// ---------------- Insert Worksheet is the Inpatient Case Listing form
await t.go('/claim-bordx/insert-worksheet')
check('insert worksheet: opens the Inpatient Case Listing (FrmWksBordx)', (await page.$eval('h2', (e) => e.textContent)) === 'Inpatient Case Listing')

// ---------------- Access: position 15 withheld
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
for (const path of [
  '/claim-bordx/send-to-payor',
  '/claim-bordx/returned-from-payor',
  '/claim-bordx/approval',
  '/claim-bordx/remove-worksheet',
  '/claim-bordx/send-to-accounts',
  '/claim-bordx/insert-worksheet',
]) {
  await limited.goto(`${BASE}${path}`, { waitUntil: 'networkidle0' })
  await limited.waitForSelector('h2')
  check(`access: without position 15 ${path} says Access Denied!`, (await limited.$eval('h2', (e) => e.textContent)) === 'Access Denied!')
}
check('access: and the API refuses with 403', (await get('/api/claim-bordx/delivery/to-payor/search', mint(access))).status === 403)

console.log(`screenshots: ${t.shots}`)
const ok = t.summary()
await t.browser.close()
process.exit(ok ? 0 : 1)
