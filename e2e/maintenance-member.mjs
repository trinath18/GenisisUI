// Maintenance > Member (Members Maintenance, Valid Date Range). Reads the real row; the PUT that would change it is intercepted and answered here (the database write is covered by the API's own
// rolled-back database tests), so nothing is written.
import { start, sleep, BASE } from './lib.mjs'
import { mint } from './mint.mjs'

const t = await start()
const { page, check } = t

const get = (path, token = mint()) => fetch(`${BASE}${path}`, { headers: { Authorization: `Bearer ${token}` } })
const dialogs = () => page.$$eval('[role=dialog]', (d) => d.map((x) => x.textContent.replace(/\s+/g, ' ').trim()))
const dmy = (iso) => (iso ? `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)}` : '')

const puts = []
await page.setRequestInterception(true)
page.on('request', (req) => {
  if (req.method() === 'PUT' && /\/api\/maintenance\/member-dates$/.test(req.url())) {
    puts.push(JSON.parse(req.postData()))
    return req.respond({ status: 200, contentType: 'application/json', body: JSON.stringify({ message: 'Record Saved...' }) })
  }
  req.continue()
})

/** The date box called `label` inside the fieldset called `legend` (the three fieldsets all have a Start Date and an End Date). */
async function boxIn(legend, label) {
  const h = await page.evaluateHandle(
    (lg, lb) => {
      const group = [...document.querySelectorAll('fieldset')].find((f) => f.querySelector('legend')?.textContent === lg)
      return [...(group?.querySelectorAll('label.form-field') ?? [])]
        .find((x) => x.querySelector('span')?.textContent.replace('*', '').trim() === lb)
        ?.querySelector('input')
    },
    legend,
    label,
  )
  return h.asElement()
}
async function typeIn(legend, label, text) {
  const el = await boxIn(legend, label)
  await el.focus()
  await page.keyboard.down('Control')
  await page.keyboard.press('KeyA')
  await page.keyboard.up('Control')
  await page.keyboard.press('Backspace')
  if (text) await page.keyboard.type(text)
}
const valueIn = async (legend, label) => (await boxIn(legend, label)).evaluate((e) => e.value)

// ---------------- the API
const row = await (await get('/api/maintenance/member-dates')).json()
check('api: the row of MBMValidDateRange is read back', row.found === true && !!row.effectiveStart && !!row.birthEnd, JSON.stringify(row).slice(0, 160))
const refused = await fetch(`${BASE}/api/maintenance/member-dates`, {
  method: 'PUT',
  headers: { Authorization: `Bearer ${mint()}`, 'Content-Type': 'application/json' },
  body: JSON.stringify({ effectiveStart: '2021-01-01' }),
})
check(
  'api: a save without the other dates is refused with the desktop message',
  refused.status === 400 && (await refused.json()).message === 'Please Enter Effective End Date',
)

// ---------------- the screen
await t.go('/maintenance/member')
check('screen: title', (await page.$eval('h2', (e) => e.textContent)) === 'Members Maintenance')
const side = await page.$$eval('.sidebar a', (els) => els.map((e) => e.textContent.trim()))
check('menu: Member is in the Maintenance menu', side.includes('Member'), side.join('|'))
await sleep(500)
const shown = {
  eff: [await valueIn('Effective Date', 'Start Date'), await valueIn('Effective Date', 'End Date')],
  exp: [await valueIn('Expiry Date', 'Start Date'), await valueIn('Expiry Date', 'End Date')],
  dob: [await valueIn('Birth Date', 'Start Date'), await valueIn('Birth Date', 'End Date')],
}
check(
  'screen: the six boxes show the saved dates as dd/mm/yyyy',
  JSON.stringify(shown) ===
    JSON.stringify({
      eff: [dmy(row.effectiveStart), dmy(row.effectiveEnd)],
      exp: [dmy(row.expiryStart), dmy(row.expiryEnd)],
      dob: [dmy(row.birthStart), dmy(row.birthEnd)],
    }),
  JSON.stringify(shown),
)

await typeIn('Expiry Date', 'End Date', '')
await t.click('Update', 500)
check(
  'screen: an empty date is refused with the desktop message',
  (await t.errors()).includes('Please Enter Expiry End Date'),
  JSON.stringify(await t.errors()),
)
await typeIn('Effective Date', 'Start Date', '')
await t.click('Update', 500)
check(
  'screen: the first empty date in the desktop order is the one reported',
  (await t.errors()).includes('Please Enter Effective Start Date'),
  JSON.stringify(await t.errors()),
)
check('screen: nothing was sent', puts.length === 0)

await typeIn('Effective Date', 'Start Date', '01011999')
await typeIn('Expiry Date', 'End Date', '31122022')
await t.click('Update', 600)
check(
  'screen: update asks Do you want to save the record?',
  (await dialogs()).some((d) => d.includes('Do you want to save the record?')),
  JSON.stringify(await dialogs()),
)
await (await t.btn('No')).click()
await sleep(400)
check('screen: No saves nothing', puts.length === 0)
await t.click('Update', 600)
await t.yes()
check('screen: Yes reports Record Saved...', await t.toast('Record Saved...'))
check(
  'screen: and sends the six dates as ISO days',
  puts.length === 1 &&
    puts[0].effectiveStart === '1999-01-01' &&
    puts[0].expiryEnd === '2022-12-31' &&
    puts[0].birthEnd === row.birthEnd.slice(0, 10) &&
    puts[0].expiryStart === row.expiryStart.slice(0, 10),
  JSON.stringify(puts[0]),
)

// ---------------- access: position 1 withheld
const access = '0' + '1'.repeat(29)
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
await limited.goto(`${BASE}/maintenance/member`, { waitUntil: 'networkidle0' })
await limited.waitForSelector('h2')
check('access: without position 1 the page says Access Denied!', (await limited.$eval('h2', (e) => e.textContent)) === 'Access Denied!')
check('access: and the API refuses with 403', (await get('/api/maintenance/member-dates', mint(access))).status === 403)

console.log(`screenshots: ${t.shots}`)
const ok = t.summary()
await t.browser.close()
process.exit(ok ? 0 : 1)
