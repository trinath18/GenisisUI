// Invoice > Original Invoice Update (/invoice/original-update). Reads real invoices; the PUT that would change one is intercepted and answered here (the database write is
// covered by the API's own rolled-back database test), so nothing is written.
import { start, sleep } from './lib.mjs'

const t = await start()
const { page, check } = t
const CASE = 'XI00002412'
const VERSION = '2'
const MULTI = { cas: 'XI02969', ver: '4' }

const puts = []
await page.setRequestInterception(true)
page.on('request', (req) => {
  if (req.method() === 'PUT' && /\/api\/invoice\/original\/\d+$/.test(req.url())) {
    puts.push({ url: new URL(req.url()).pathname, body: JSON.parse(req.postData()) })
    return req.respond({ status: 200, contentType: 'application/json', body: JSON.stringify({ message: 'Record Updated Sucessfully' }) })
  }
  req.continue()
})
const dialogs = () => page.$$eval('[role=dialog]', (d) => d.map((x) => x.textContent.replace(/\s+/g, ' ').trim()))
const disabled = async (label) => (await t.field(label)).evaluate((e) => e.disabled)
const dateValue = async (label) => (await t.field(label)).evaluate((e) => e.value)
const go = async (cas, ver) => {
  await t.type('Case Number', cas)
  await t.type('Ver', ver)
  await t.click('Go', 900)
}

// ---------------- the page and the menu
await t.go('/invoice/original-update')
check('page: the screen opens', (await page.$eval('h2', (e) => e.textContent)) === 'Original Invoice Update')
const side = await page.$$eval('.sidebar a, .sidebar span', (els) => els.map((e) => e.textContent.trim()))
check(
  'menu: the Invoice section lists the five desktop items',
  ['Invoice Processing', 'Original Invoice Update', 'Invoice MBM Accounting', 'Invoice HOS Accounting', 'Invoice Tracking'].every((x) => side.includes(x)),
  side.join('|'),
)
check(
  'page: nothing can be edited or updated before an invoice is found',
  (await t.isDisabled('Update')) && (await disabled('Invoice Number')) && (await disabled('OIR Date')) && (await disabled('Hospital Name')),
)

// ---------------- Go
await t.click('Go', 400)
check('go: no case -> Please Enter Case No', await t.toast('Please Enter Case No'))
await t.type('Case Number', CASE)
await t.click('Go', 400)
check('go: no version -> Please Enter Case Version', await t.toast('Please Enter Case Version'))
await go('NO SUCH CASE', '1')
check('go: an unknown case -> No record found!', await t.toast('No record found!'))
check('go: and nothing is locked or filled', !(await disabled('Case Number')) && (await t.value('Invoice Number')) === '')

await t.click('Clear', 300)
await go(CASE, VERSION)
check('go: the invoice is shown', (await t.value('Invoice Number')) === 'CN-2100001755', await t.value('Invoice Number'))
check(
  'go: with its OIR date and invoice date as dd/mm/yyyy',
  (await dateValue('OIR Date')) === '06/08/2021' && (await dateValue('Invoice Date')) === '07/12/2020',
  `${await dateValue('OIR Date')} ${await dateValue('Invoice Date')}`,
)
check('go: and its hospital', (await t.value('Hospital Name')) === 'ASSUN')
check('go: the case and version are locked until Clear', (await disabled('Case Number')) && (await disabled('Ver')))
check('go: and the invoice can be edited and updated', !(await disabled('Invoice Number')) && !(await t.isDisabled('Update')) && (await t.isDisabled('Go')))

// ---------------- Update
await t.type('Invoice Number', '')
await t.click('Update', 400)
check('update: no invoice number -> Please Enter Invoice No!', await t.toast('Please Enter Invoice No!'))
await t.type('Invoice Number', 'CN-TEST')
await t.type('OIR Date', '')
await t.click('Update', 400)
check('update: no OIR date -> Please Enter Invoice Date!', await t.toast('Please Enter Invoice Date!'))
check('update: nothing was sent', puts.length === 0)

await t.type('OIR Date', '10082021')
await t.type('Invoice Date', '')
await t.click('Update', 500)
check(
  'update: a good form asks Are you sure?',
  (await dialogs()).some((d) => d.includes('Are you sure?')),
  JSON.stringify(await dialogs()),
)
await (await t.btn('No')).click()
await sleep(400)
check('update: No sends nothing', puts.length === 0)

await t.click('Update', 500)
await t.yes()
await t.toast('Record Updated Sucessfully', 4000)
check(
  'update: Yes sends the invoice number, the OIR date, an empty invoice date and the hospital',
  puts.length === 1 &&
    puts[0].body.invoiceNo === 'CN-TEST' &&
    puts[0].body.originalReceivedDate === '2021-08-10' &&
    puts[0].body.invoiceDate === null &&
    puts[0].body.hospitalCode === 'ASSUN',
  JSON.stringify(puts),
)
check('update: and shows the desktop message', await t.toast('Record Updated Sucessfully'))

// ---------------- Clear, and a version with several invoices
await t.click('Clear', 400)
check(
  'clear: the form is empty and unlocked again',
  !(await disabled('Case Number')) && (await t.value('Case Number')) === '' && (await t.isDisabled('Update')),
)
await go(MULTI.cas, MULTI.ver)
const picker = await page.evaluate(() => {
  const label = [...document.querySelectorAll('label.form-field')].find((x) => x.querySelector('span')?.textContent.trim() === 'Invoice')
  const select = label?.querySelector('select')
  return select ? { options: [...select.options].map((o) => o.textContent), hint: label.textContent } : null
})
check(
  'several invoices: a picker lists the three invoices of the version',
  picker?.options.length === 3 && /^1\. /.test(picker.options[0]),
  JSON.stringify(picker),
)
const first = await t.value('Invoice Number')
await t.select('Invoice', '1')
check('several invoices: choosing another shows its own number', (await t.value('Invoice Number')) !== first && (await t.value('Invoice Number')) !== '')
await page.screenshot({ path: `${t.shots}/e2e-invoice-original-update.png`, fullPage: true })

check('nothing was written: no request changed data except the intercepted PUT', puts.length === 1)
const ok = t.summary()
await t.browser.close()
process.exit(ok ? 0 : 1)
