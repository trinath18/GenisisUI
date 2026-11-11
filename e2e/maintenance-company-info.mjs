// Maintenance > Company Info (Company Information). dbo.Company is not in the development databases, so the real calls show what the screen says without it; the row that would be read and the PUT that would
// change it are answered here (the database write is covered by the API's own rolled-back tests on a copy of the table), so nothing is written.
import { start, sleep, BASE } from './lib.mjs'
import { mint } from './mint.mjs'

const t = await start()
const { page, check } = t

const put = (body, token = mint()) =>
  fetch(`${BASE}/api/maintenance/company-info`, {
    method: 'PUT',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
const dialogs = () => page.$$eval('[role=dialog]', (d) => d.map((x) => x.textContent.replace(/\s+/g, ' ').trim()))

let mode = 'real'
const puts = []
await page.setRequestInterception(true)
page.on('request', (req) => {
  if (!/\/api\/maintenance\/company-info$/.test(req.url())) return req.continue()
  if (req.method() === 'PUT' && mode !== 'real') {
    puts.push(JSON.parse(req.postData()))
    return req.respond({ status: 200, contentType: 'application/json', body: JSON.stringify({ message: 'Record Saved...' }) })
  }
  if (req.method() === 'GET' && mode === 'row')
    return req.respond({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        tableExists: true,
        found: true,
        code: 'MX',
        name: 'MediExpress (M) Sdn Bhd',
        address: '1 Jalan Satu',
        phone: '03-1234.5678',
        fax: '',
        email: 'a@b.my',
        homepage: 'www.b.my',
        currentYear: '2026',
      }),
    })
  if (req.method() === 'GET' && mode === 'empty')
    return req.respond({ status: 200, contentType: 'application/json', body: JSON.stringify({ tableExists: true, found: false }) })
  return req.continue()
})

// ---------------- the API
const row = await (await fetch(`${BASE}/api/maintenance/company-info`, { headers: { Authorization: `Bearer ${mint()}` } })).json()
check('api: the row says whether dbo.Company is in this database', typeof row.tableExists === 'boolean' && typeof row.found === 'boolean', JSON.stringify(row))
const message = async (body) => (await (await put(body)).json()).message
check('api: the code is asked for first', (await message({})) === 'Please Enter Company Code')
check('api: then the name', (await message({ code: 'MX' })) === 'Please Enter Company Name')
check('api: then the current year', (await message({ code: 'MX', name: 'N' })) === 'Please Enter Company Current Year')
check('api: the year is four digits', (await message({ code: 'MX', name: 'N', currentYear: 'abcd' })) === 'Company Current Year must be a year of four digits.')
check(
  'api: the phone takes what the number box took',
  (await message({ code: 'MX', name: 'N', currentYear: '2026', phone: '03 12' })) === 'Phone No must be a number.',
)
if (!row.tableExists) {
  const res = await put({ code: 'MX', name: 'MediExpress', currentYear: '2026' })
  check(
    'api: without the table a save says so and writes nothing',
    res.status >= 400 && (await res.json()).message === 'The Company table is not in this database.',
  )
}

// ---------------- the screen
await t.go('/maintenance/company-info')
check('screen: title', (await page.$eval('h2', (e) => e.textContent)) === 'Company Information')
const menu = await page.$$eval('.sidebar a', (a) => a.map((x) => x.textContent.trim()))
check('menu: Maintenance lists Company Info', menu.includes('Company Info'), menu.join('|'))
if (!row.tableExists) check('screen: without the table it says so', await t.toast('The Company table is not in this database.'))

mode = 'empty'
await t.go('/maintenance/company-info')
check('screen: an empty table says Record not found', await t.toast('Record not found'))
check('screen: and the boxes are empty', (await t.value('Company Code')) === '' && (await t.value('Current Year')) === '')

mode = 'row'
await t.go('/maintenance/company-info')
await page.waitForFunction(() => document.querySelector('input[name=code]')?.value === 'MX')
check(
  'screen: the saved details are shown',
  (await t.value('Company Name')) === 'MediExpress (M) Sdn Bhd' &&
    (await t.value('Address')) === '1 Jalan Satu' &&
    (await t.value('Phone No')) === '03-1234.5678' &&
    (await t.value('Email')) === 'a@b.my' &&
    (await t.value('Current Year')) === '2026',
)
await t.type('Company Code', '')
await t.click('Update', 500)
check('screen: Update asks for the code first', (await t.errors()).includes('Please Enter Company Code'))
await t.type('Company Code', 'MX')
await t.type('Company Name', '')
await t.click('Update', 500)
check('screen: then the name', (await t.errors()).includes('Please Enter Company Name'))
await t.type('Company Name', 'MediExpress')
await t.type('Current Year', '')
await t.click('Update', 500)
check('screen: then the current year', (await t.errors()).includes('Please Enter Company Current Year'))
await t.type('Current Year', '2027')
await t.type('Phone No', '03 12')
await t.click('Update', 500)
check('screen: a phone with a space is refused', (await t.errors()).includes('Phone No must be a number.'))
await t.type('Phone No', '03-5555.1234')
await t.click('Update', 500)
check(
  'screen: Update asks first',
  (await dialogs()).some((d) => d.includes('Do you want to save the record?')),
)
await (await t.btn('No')).click()
await sleep(400)
check('screen: No writes nothing', puts.length === 0)
await t.click('Update', 500)
await t.yes()
check('screen: Yes saves and says so', await t.toast('Record Saved...'))
check(
  'screen: the PUT carries every box',
  puts.length === 1 &&
    JSON.stringify(puts[0]) ===
      JSON.stringify({
        code: 'MX',
        name: 'MediExpress',
        address: '1 Jalan Satu',
        phone: '03-5555.1234',
        fax: '',
        email: 'a@b.my',
        homepage: 'www.b.my',
        currentYear: '2027',
      }),
  JSON.stringify(puts[0]),
)

console.log(`screenshots: ${t.shots}`)
const ok = t.summary()
await t.browser.close()
process.exit(ok ? 0 : 1)
