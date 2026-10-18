// Worksheet menu: Tracking, Send to A/C and Send to A/R (and the menu around them). Reads the real development data; the POSTs that
// would change it are intercepted and answered here (the database writes are covered by the API's own rolled-back database tests).
import { start, sleep, BASE } from './lib.mjs'
import { mint } from './mint.mjs'

const t = await start()
const { page, check } = t

const get = async (path) => (await fetch(`${BASE}${path}`, { headers: { Authorization: `Bearer ${mint()}` } })).json()
const stat = (label) =>
  page.evaluate(
    (l) =>
      [...document.querySelectorAll('.stat')].find((s) => s.querySelector('.stat-label')?.textContent === l)?.querySelector('.stat-value')?.textContent ?? null,
    label,
  )
const tick = (wksNo) => page.evaluate((k) => document.querySelector(`input[aria-label="Select ${k}"]`)?.click(), wksNo)
const isTicked = (wksNo) => page.evaluate((k) => document.querySelector(`input[aria-label="Select ${k}"]`)?.checked ?? null, wksNo)
const gridRows = async (caption) => (await t.rows(caption)).filter((r) => r.length > 1)

/** A drop-down inside a named group (the Tracking page has two "Pending Status" lists). */
async function selectIn(legend, label, value) {
  const h = await page.evaluateHandle(
    (lg, lb) => {
      const group = [...document.querySelectorAll('fieldset')].find((f) => f.querySelector('legend')?.textContent === lg)
      return [...(group?.querySelectorAll('label.form-field') ?? [])]
        .find((x) => x.querySelector('span')?.textContent.replace('*', '').trim() === lb)
        ?.querySelector('select')
    },
    legend,
    label,
  )
  await h.asElement().select(value)
  await sleep(150)
}

const posts = []
await page.setRequestInterception(true)
page.on('request', (req) => {
  if (req.method() === 'POST' && /\/api\/worksheet\/(tracking\/update|send-to-accounts\/send|send-to-ar\/send)$/.test(req.url())) {
    posts.push({ url: new URL(req.url()).pathname, body: JSON.parse(req.postData()) })
    return req.respond({ status: 200, contentType: 'application/json', body: JSON.stringify({ message: 'Record updated...', updated: 1 }) })
  }
  req.continue()
})

// ---------------- Menu
await t.go('/worksheet/tracking')
const side = await page.$$eval('.sidebar a, .sidebar span', (els) => els.map((e) => e.textContent.trim()))
check(
  'menu: the Worksheet section lists the six desktop items',
  ['Registration', 'Adjustment', 'Enquiry', 'Send to A/C', 'Send to A/R', 'Tracking'].every((x) => side.includes(x)),
  side.join('|'),
)
await t.go('/worksheet/registration')
check('menu: Worksheet Registration is a placeholder until migrated', (await page.$eval('h2', (e) => e.textContent)) === 'Worksheet Registration')

// ---------------- Worksheet Tracking
const xi = (await get('/api/worksheet/tracking/search?useScan=false&payor=XI')).rows
const bordxed = xi.find((r) => r.bordxed)
const fresh = xi.find((r) => !r.bordxed)
check('tracking: test data has a bordxed and a not bordxed worksheet', !!bordxed && !!fresh, `${xi.length} rows`)

await t.go('/worksheet/tracking')
check('tracking: title', (await page.$eval('h2', (e) => e.textContent)) === 'Worksheet Tracking')
await t.click('Search')
check('tracking: scan mode needs a worksheet number', (await t.errors()).includes('Please Enter Worksheet No'), JSON.stringify(await t.errors()))

await t.type('Wks No', 'LOP001')
await t.click('Search')
check(
  'tracking: a scan code of an unmigrated screen is named',
  await t.toast('Payment to Hospital has not been migrated yet.'),
  JSON.stringify(await t.toasts()),
)
await t.type('Wks No', 'NO SUCH WORKSHEET')
await t.click('Search')
check('tracking: unknown worksheet -> No record found!', await t.toast('No record found!'))

await t.type('Wks No', 'LOC001')
await t.click('Search')
check('tracking: scan code LOC001 opens Case Registration', await t.waitFor(() => page.url().endsWith('/case/registration')), page.url())
await t.go('/worksheet/tracking')

await t.checkbox('Use Scan')
await t.type('Payor', 'XI')
await t.click('Search', 800)
check(
  'tracking: range search lists the payor worksheets',
  (await gridRows('Worksheets')).length === xi.length,
  `${(await gridRows('Worksheets')).length} vs ${xi.length}`,
)
check('tracking: Records counter matches', (await stat('Records')) === String(xi.length), await stat('Records'))
check(
  'tracking: Wks No column shows case-version',
  (await gridRows('Worksheets')).some((r) => r.includes(`${fresh.caseNo}-${fresh.claimVersion}`)),
)

await tick(`${bordxed.caseNo}-${bordxed.claimVersion}`)
check(
  'tracking: a bordxed worksheet cannot be ticked',
  (await t.toast('This claim has been bordxed!')) && (await isTicked(`${bordxed.caseNo}-${bordxed.claimVersion}`)) === false,
)
await tick(`${fresh.caseNo}-${fresh.claimVersion}`)
check(
  'tracking: a free worksheet can be ticked',
  (await t.waitFor(async () => (await stat('Selected')) === '1')) && (await isTicked(`${fresh.caseNo}-${fresh.claimVersion}`)) === true,
  await stat('Selected'),
)

await t.click('Update')
check('tracking: update needs a date', (await t.errors()).includes('Please Enter Date'), JSON.stringify(await t.errors()))
await t.type('Date Update', '18102026')
await t.click('Update')
check('tracking: update needs a pending status', (await t.errors()).includes('Please Enter Pending Status'), JSON.stringify(await t.errors()))
await selectIn('Update pending status', 'Pending Status', 'P')
await t.click('Update')
await t.yes()
check('tracking: update reports success', await t.toast('Record updated...'), JSON.stringify(await t.toasts()))
const update = posts.find((p) => p.url.endsWith('/tracking/update'))
check(
  'tracking: update sends the date, status and ticked worksheet',
  update?.body.date === '2026-10-18' && update.body.status === 'P' && update.body.items.length === 1 && update.body.items[0].caseNo === fresh.caseNo,
  JSON.stringify(update?.body),
)
check('tracking: after an update a range search lists again', (await gridRows('Worksheets')).length === xi.length)

await t.checkbox('Use Scan')
check('tracking: switching to scan mode empties the list', (await gridRows('Worksheets')).length === 0)
await t.type('Wks No', fresh.caseNo)
await t.click('Search', 600)
check('tracking: a scan adds the worksheets of the case', (await gridRows('Worksheets')).length >= 1)
await t.type('Wks No', fresh.caseNo)
await t.click('Search', 400)
check('tracking: scanning the same case again is refused', await t.toast('This case is already in the list.'))
await t.click('Clear')
check('tracking: Clear empties the list', (await gridRows('Worksheets')).length === 0)

// ---------------- Worksheet Send to A/C
const ac = (await get('/api/worksheet/send-to-accounts/search?useScan=false&payor=AC&tokenStatus=0')).rows
await t.go('/worksheet/send-to-accounts')
check('accounts: title', (await page.$eval('h2', (e) => e.textContent)) === 'Worksheet Send to A/C')
check('accounts: token status defaults to Both', (await t.value('Token Status')) === '0')
await t.click('Search')
check('accounts: scan mode needs a worksheet number', (await t.errors()).includes('Please Enter Worksheet No'))
await t.checkbox('Use Scan')
await t.type('Payor', 'AC')
await t.click('Search', 800)
check(
  'accounts: range search lists the payor worksheets',
  (await gridRows('Worksheets to send to accounts')).length === ac.length && ac.length > 0,
  `${(await gridRows('Worksheets to send to accounts')).length} vs ${ac.length}`,
)
await t.click('Update')
check('accounts: update needs a date', (await t.errors()).includes('Please Enter in date'), JSON.stringify(await t.errors()))
await t.type('Date Sent', '18102026')
await t.click('Update')
check('accounts: update needs a ticked worksheet', await t.toast('Please select at least one record to be updated!'))
await page.evaluate(() => document.querySelector('input[aria-label="Select all rows"]')?.click())
check(
  'accounts: select all ticks every row',
  await t.waitFor(async () => (await stat('Selected')) === String(ac.length)),
  `${await stat('Selected')} of ${ac.length}`,
)
await t.click('Update')
await t.yes()
const send = posts.find((p) => p.url.endsWith('/send-to-accounts/send'))
check(
  'accounts: update sends the date and every ticked worksheet',
  send?.body.date === '2026-10-18' && send.body.items.length === ac.length,
  JSON.stringify(send?.body).slice(0, 160),
)
check('accounts: update reports success', await t.toast('Record updated...'))

// ---------------- Worksheet Send to A/R
await t.go('/worksheet/send-to-ar')
check('ar: title', (await page.$eval('h2', (e) => e.textContent)) === 'Worksheet Send to A/R')
await t.click('Search')
check('ar: scan mode needs a case number', (await t.errors()).includes('Please Enter Case No'), JSON.stringify(await t.errors()))
await t.click('Update')
check('ar: update with an empty list is refused', await t.toast('Please select a record before proceeding!'))
await t.checkbox('Use Scan')
await t.type('Case No from', 'ZZ')
await t.type('Case No to', 'ZZ99999999')
await t.click('Search', 800)
const arRows = await gridRows('Cases to send to audit review')
check('ar: range search lists the cases', arRows.length > 0, String(arRows.length))
await t.click('Update')
check('ar: update needs a ticked case', await t.toast('Please select at least one record to be updated!'))
const arCase = arRows[0][1]
await tick(arCase)
await t.click('Update')
await t.yes()
const ar = posts.find((p) => p.url.endsWith('/send-to-ar/send'))
check('ar: update sends the ticked case', ar?.body.cases?.length === 1 && ar.body.cases[0] === arCase, JSON.stringify(ar?.body))

// ---------------- Access: position 24 withheld
const access = '1'.repeat(23) + '0' + '1'.repeat(6)
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
await limited.goto(`${BASE}/worksheet/tracking`, { waitUntil: 'networkidle0' })
await limited.waitForSelector('h2')
check('access: without position 24 the tracking screen says Access Denied!', (await limited.$eval('h2', (e) => e.textContent)) === 'Access Denied!')
check('access: and its menu item is disabled', await limited.$$eval('.sidebar span.disabled', (els) => els.some((e) => e.textContent.trim() === 'Tracking')))
const denied = await fetch(`${BASE}/api/worksheet/tracking/search?useScan=false`, { headers: { Authorization: `Bearer ${mint(access)}` } })
check('access: and the API refuses the search with 403', denied.status === 403, String(denied.status))

const ok = t.summary()
await t.browser.close()
process.exit(ok ? 0 : 1)
