// Claim Bordx > Storage > Claim files (Storage Entry). Reads the real cartons and claim files; the POSTs and DELETEs that would write are intercepted and answered here (the database writes are covered
// by the API's own rolled-back database tests), so nothing is written. Checks that the API refuses are made with real calls: they fail before anything is saved.
import { start, sleep, BASE } from './lib.mjs'
import { mint } from './mint.mjs'

const t = await start()
const { page, check } = t

const get = (path, token = mint()) => fetch(`${BASE}${path}`, { headers: { Authorization: `Bearer ${token}` } })
const json = async (path) => (await get(path)).json()
const send = (method, path, body) =>
  fetch(`${BASE}${path}`, {
    method,
    headers: { Authorization: `Bearer ${mint()}`, 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  })
const dialogs = () => page.$$eval('[role=dialog]', (d) => d.map((x) => x.textContent.replace(/\s+/g, ' ').trim()))
const rowsOf = (caption) =>
  page.$$eval(`table[aria-label="${caption}"] tbody tr`, (trs) =>
    trs.map((tr) => [...tr.querySelectorAll('td')].map((td) => td.textContent.trim())).filter((r) => r.length > 2),
  )
const stat = (label) =>
  page.evaluate(
    (l) =>
      [...document.querySelectorAll('.stat')].find((s) => s.querySelector('.stat-label')?.textContent === l)?.querySelector('.stat-value')?.textContent ?? null,
    label,
  )
const tick = (caption, index) =>
  page.evaluate((c, i) => document.querySelectorAll(`table[aria-label="${c}"] tbody tr`)[i]?.querySelector('input[type=checkbox]')?.click(), caption, index)
const clickRow = (caption, index) =>
  page.evaluate((c, i) => document.querySelectorAll(`table[aria-label="${c}"] tbody tr`)[i]?.querySelectorAll('td')[2]?.click(), caption, index)
const headers = (caption) => page.$$eval(`table[aria-label="${caption}"] thead th`, (ths) => ths.map((th) => th.textContent.trim()).filter(Boolean))
const openTab = async (name) => {
  await page.evaluate((n) => [...document.querySelectorAll('[role=tab]')].find((x) => x.textContent.trim() === n)?.click(), name)
  await sleep(300)
}

async function boxIn(legend, label) {
  const h = await page.evaluateHandle(
    (lg, lb) => {
      const group = [...document.querySelectorAll('fieldset')].find((f) => f.querySelector('legend')?.textContent === lg)
      return [...(group?.querySelectorAll('label.form-field') ?? [])]
        .find((x) => x.querySelector('span')?.textContent.replace('*', '').trim() === lb)
        ?.querySelector('input, select, textarea')
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
const pick = async (legend, label, value) => (await boxIn(legend, label)).select(value)
const valueIn = async (legend, label) => (await boxIn(legend, label)).evaluate((e) => e.value)
const disabledIn = async (legend, label) => (await boxIn(legend, label)).evaluate((e) => e.matches(':disabled'))
const disabled = async (label) => (await t.btn(label)).evaluate((b) => b.disabled)
const answer = async (text) => {
  await page.evaluate((x) => [...document.querySelectorAll('[role=dialog] button')].find((b) => b.textContent.trim() === x)?.click(), text)
  await sleep(500)
}

const writes = []
await page.setRequestInterception(true)
page.on('request', (req) => {
  const url = new URL(req.url())
  if (!url.pathname.startsWith('/api/claim-bordx/storage-entry/') || req.method() === 'GET') return req.continue()
  const body = req.postData() ? JSON.parse(req.postData()) : null
  writes.push({ method: req.method(), path: url.pathname, body })
  return req.respond({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({ message: req.method() === 'DELETE' ? 'Record has been deleted!' : body?.edit ? 'Record Updated...' : 'Record Saved...' }),
  })
})

// ---------------- the API
const lookups = await json('/api/claim-bordx/storage/lookups')
const E = '/api/claim-bordx/storage-entry'
const refused = async (method, path, body) => {
  const r = await send(method, path, body)
  return { status: r.status, message: (await r.json().catch(() => ({}))).message }
}
const noCarton = await refused('POST', `${E}/cartons`, { cartons: [], status: 'S' })
check(
  'api: a carton save without a carton number is refused with the desktop message',
  noCarton.status === 400 && noCarton.message === 'Please Enter Carton Number',
  JSON.stringify(noCarton),
)
check('api: without a status', (await refused('POST', `${E}/cartons`, { cartons: ['ZZ-API-1'] })).message === 'Please Enter Carton Status')
check(
  'api: a request date without a send date',
  (await refused('POST', `${E}/cartons`, { cartons: ['ZZ-API-1'], status: 'S', requestDate: '2026-10-02' })).message.startsWith(
    'Invalid Date ! Date of Request',
  ),
)
check(
  'api: status R without a return date',
  (await refused('POST', `${E}/cartons`, { cartons: ['ZZ-API-1'], status: 'R' })).message === "Date Return cannot be null when the status is 'R' !",
)
check(
  'api: editing a carton that is not there is not found',
  (await refused('POST', `${E}/cartons`, { cartons: ['ZZ-NO-SUCH'], status: 'S', edit: true })).status === 404,
)
check('api: deleting a carton that is not there is not found', (await refused('DELETE', `${E}/cartons/ZZ-NO-SUCH`)).status === 404)
const stored = await json('/api/claim-bordx/storage/files?useScan=false&caseFrom=AH00000200&caseTo=AH00009999&fileStatus=I')
const inCarton = stored.rows.find((r) => r.cartonNo)
const usedDelete = await refused('DELETE', `${E}/cartons/${encodeURIComponent(inCarton.cartonNo)}`)
check(
  'api: a carton that holds files is not deleted',
  usedDelete.status === 409 && usedDelete.message.includes('claim files are stored in it'),
  JSON.stringify(usedDelete),
)
check(
  'api: a store with no claims is refused',
  (await refused('POST', `${E}/files`, { files: [], carton: 'C1', fileStatus: 'I' })).message === 'Please checked at least 1 Claim !',
)
check(
  'api: without a carton',
  (await refused('POST', `${E}/files`, { files: [{ caseNo: 'AB1', version: 1 }], fileStatus: 'I' })).message === 'Please Enter Carton Number',
)
check(
  'api: with a request by and no date',
  (await refused('POST', `${E}/files`, { files: [{ caseNo: 'AB1', version: 1 }], carton: 'C1', fileStatus: 'I', requestBy: 'A USER' })).message ===
    'Please Enter Date Of Request',
)
const noCartonFile = await refused('POST', `${E}/files`, {
  files: [{ caseNo: inCarton.caseNo, version: inCarton.claimVersion }],
  carton: 'ZZ-NO-CARTON',
  fileStatus: 'I',
})
check('api: a carton that is not there is refused', noCartonFile.message === 'Carton Number not found', JSON.stringify(noCartonFile))
const noClaim = await refused('POST', `${E}/files`, { files: [{ caseNo: 'ZZ-NO-CASE', version: 1 }], carton: inCarton.cartonNo, fileStatus: 'I' })
check('api: a claim that is not there is refused', noClaim.message === 'Claim not found', JSON.stringify(noClaim))
const alreadyStored = await refused('POST', `${E}/files`, {
  files: [{ caseNo: inCarton.caseNo, version: inCarton.claimVersion }],
  carton: inCarton.cartonNo,
  fileStatus: 'I',
})
check(
  'api: a claim that is stored already is a duplicate and nothing is saved',
  alreadyStored.status === 409 && alreadyStored.message === 'Record Duplicated! Please Change The Corresponding Field',
  JSON.stringify(alreadyStored),
)
check('api: removing a claim that is not stored is not found', (await refused('DELETE', `${E}/files/ZZ-NO-CASE/1`)).status === 404)

// a claim that is not stored yet: the Enquiry list of the same search leaves it out, the Entry list (includeUnstored) has it
const range = await json('/api/claim-bordx/storage/files?useScan=false&caseFrom=AH00000200&caseTo=AH00000400&includeUnstored=true')
const unstored = range.rows.find((r) => !r.cartonNo)
check(
  'api: the entry list also has claims that are not stored, with their bordx date and cash type fields',
  !!unstored && 'bordxDate' in unstored && 'cashType' in unstored,
  `${range.rows.length}`,
)
const hidden = await json(`/api/claim-bordx/storage/files?useScan=true&caseFrom=${unstored.caseNo}`)
check('api: the Enquiry list leaves that claim out', !hidden.rows.some((r) => r.caseNo === unstored.caseNo && r.claimVersion === unstored.claimVersion))

// ---------------- the screen
await t.go('/claim-bordx/storage-claim-files')
check('screen: title', (await page.$eval('h2', (e) => e.textContent)) === 'Storage Entry')
const side = await page.$$eval('.sidebar a', (els) => els.map((e) => e.textContent.trim()))
check('menu: Claim files is a link in the Claim Bordx menu', side.includes('Claim files'), side.join('|'))

// Storage Details
await openTab('Storage Details')
check(
  'storage: Add, Edit, Save and Remove are off to begin with',
  (await disabled('Add')) && (await disabled('Edit')) && (await disabled('Save')) && (await disabled('Remove')),
)
await typeIn('Search claims', 'Case No', unstored.caseNo)
await t.click('Search', 1200)
const listed = await rowsOf('Claim files')
check(
  'storage: scanning a case lists its claims, stored or not',
  listed.length >= 1 && listed.some((r) => r[1] === unstored.caseNo && r[2] === String(unstored.claimVersion)),
  JSON.stringify(listed.slice(0, 2)),
)
check(
  'storage: the list is headed as the desktop headed it, with the bordx date and the cash type',
  JSON.stringify((await headers('Claim files')).slice(0, 5)) === JSON.stringify(['CaseNo', 'Version', 'CartonNo', 'Carton Status', 'File Status']) &&
    (await headers('Claim files')).slice(-2).join('|') === 'Bordx Date|Cash Type',
  JSON.stringify(await headers('Claim files')),
)
await typeIn('Search claims', 'Case No', unstored.caseNo)
await t.click('Search', 500)
check('storage: scanning the same case again says Data has been uploaded!', await t.toast('Data has been uploaded!'))
await t.click('Add', 400)
check('storage: Add without a ticked claim says so', await t.toast('Please checked at least 1 Claim !'))
const unstoredIndex = listed.findIndex((r) => r[1] === unstored.caseNo && r[2] === String(unstored.claimVersion))
await tick('Claim files', unstoredIndex)
await sleep(300)
check('storage: ticking a claim counts it', (await stat('No. of Rec. checked')) === '1', await stat('No. of Rec. checked'))
check('storage: the storage form is locked until Add', await disabledIn('Storage details', 'Carton No'))
await t.click('Add', 400)
check('storage: Add opens the form and Save is on', !(await disabledIn('Storage details', 'Carton No')) && !(await disabled('Save')))
await t.click('Save', 400)
check('storage: Save without a carton says so', (await t.errors()).includes('Please Enter Carton Number'), JSON.stringify(await t.errors()))
await typeIn('Storage details', 'Carton No', inCarton.cartonNo)
await t.click('Save', 400)
check('storage: then the file status', (await t.errors()).includes('Please Enter File Status'), JSON.stringify(await t.errors()))
await pick('Storage details', 'File Status', 'I')
await typeIn('Storage details', 'Request By', 'A USER')
await t.click('Save', 400)
check(
  'storage: a request by without a date of request is refused',
  (await t.errors()).includes('Please Enter Date Of Request'),
  JSON.stringify(await t.errors()),
)
await typeIn('Storage details', 'Request By', '')
await t.click('Save', 500)
check(
  'storage: Save asks Do you want to save the record?',
  (await dialogs()).some((d) => d.includes('Do you want to save the record?')),
  JSON.stringify(await dialogs()),
)
await answer('No')
check('storage: No saves nothing', writes.length === 0)
await t.click('Save', 500)
await answer('Yes')
check('storage: Yes reports Record Saved...', await t.toast('Record Saved...'))
check(
  'storage: the request names the ticked claim, the carton and the status',
  writes.length === 1 &&
    writes[0].path === `${E}/files` &&
    writes[0].body.files.length === 1 &&
    writes[0].body.files[0].caseNo === unstored.caseNo &&
    writes[0].body.files[0].version === unstored.claimVersion &&
    writes[0].body.carton === inCarton.cartonNo &&
    writes[0].body.fileStatus === 'I' &&
    writes[0].body.edit === false,
  JSON.stringify(writes[0]),
)
check('storage: the form locks again', await disabledIn('Storage details', 'Carton No'))

// a stored claim: Edit and Remove
await t.click('Clear', 300)
await typeIn('Search claims', 'Case No', inCarton.caseNo)
await t.click('Search', 1200)
const storedRows = await rowsOf('Claim files')
const storedIndex = storedRows.findIndex((r) => r[1] === inCarton.caseNo && r[3] === inCarton.cartonNo)
check('storage: a stored claim is listed with its carton', storedIndex >= 0, JSON.stringify(storedRows.slice(0, 2)))
await tick('Claim files', storedIndex)
await sleep(300)
check('storage: a claim that is stored cannot be ticked', (await t.toast('Claim has been stored!')) && (await stat('No. of Rec. checked')) === '0')
await clickRow('Claim files', storedIndex)
await sleep(300)
check(
  'storage: clicking a stored claim shows its storage row, locked, and enables Edit and Remove',
  (await valueIn('Storage details', 'Carton No')) === inCarton.cartonNo &&
    (await disabledIn('Storage details', 'Carton No')) &&
    !(await disabled('Edit')) &&
    !(await disabled('Remove')),
)
await t.click('Edit', 300)
await typeIn('Storage details', 'Remarks', 'changed')
await t.click('Update', 500)
await answer('Yes')
check('storage: Update reports Record Updated...', await t.toast('Record Updated...'))
check(
  'storage: and sends the one claim as an edit',
  writes.length === 2 && writes[1].body.edit === true && writes[1].body.files.length === 1 && writes[1].body.remarks === 'changed',
  JSON.stringify(writes[1]),
)
await clickRow('Claim files', storedIndex)
await sleep(300)
await t.click('Remove', 500)
check(
  'storage: Remove asks to delete the record',
  (await dialogs()).some((d) => d.includes('Do you want to delete the record?')),
  JSON.stringify(await dialogs()),
)
await answer('Yes')
check('storage: Yes reports Record has been deleted!', await t.toast('Record has been deleted!'))
check(
  'storage: and sends a DELETE for that claim',
  writes.length === 3 && writes[2].method === 'DELETE' && writes[2].path === `${E}/files/${inCarton.caseNo}/${inCarton.claimVersion}`,
  JSON.stringify(writes[2]),
)

// Carton Details
await openTab('Carton Details')
check('carton: Edit, Save and Delete are off to begin with', (await disabled('Edit')) && (await disabled('Save')) && (await disabled('Delete')))
const two = await json(`/api/claim-bordx/storage/cartons?cartonFrom=${encodeURIComponent(inCarton.cartonNo)}&cartonTo=${encodeURIComponent(inCarton.cartonNo)}`)
await typeIn('Search cartons', 'Carton No from', inCarton.cartonNo)
await typeIn('Search cartons', 'Carton No to', inCarton.cartonNo)
await t.click('Search', 1200)
const cartonRows = await rowsOf('Cartons')
check('carton: Search lists the carton', cartonRows.length === two.rows.length && cartonRows[0][1] === inCarton.cartonNo, `${cartonRows.length}`)
await clickRow('Cartons', 0)
await sleep(300)
check(
  'carton: clicking a carton shows its details, locked, and enables Edit and Delete',
  (await valueIn('Carton details', 'Carton No')) === inCarton.cartonNo &&
    (await disabledIn('Carton details', 'Carton No')) &&
    !(await disabled('Edit')) &&
    !(await disabled('Delete')),
)
await t.click('Delete', 500)
check(
  'carton: Delete asks to delete the record',
  (await dialogs()).some((d) => d.includes('Do you want to delete the record?')),
  JSON.stringify(await dialogs()),
)
await answer('Yes')
check(
  'carton: and sends a DELETE for the carton',
  writes.length === 4 && writes[3].method === 'DELETE' && writes[3].path === `${E}/cartons/${inCarton.cartonNo}`,
  JSON.stringify(writes[3]),
)
await t.click('Add', 300)
check('carton: Add opens a blank form', !(await disabledIn('Carton details', 'Carton No')) && (await valueIn('Carton details', 'Carton No')) === '')
await t.click('Save', 400)
check('carton: Save without a carton number says so', (await t.errors()).includes('Please Enter Carton Number'), JSON.stringify(await t.errors()))
await typeIn('Carton details', 'Carton No', 'ZZ-E2E-NEW')
await t.click('Save', 400)
check('carton: then the status', (await t.errors()).includes('Please Enter Carton Status'), JSON.stringify(await t.errors()))
await pick('Carton details', 'Carton Status', 'R')
await t.click('Save', 400)
check(
  'carton: status R needs a return date',
  (await t.errors()).some((e) => e.includes("Date Return cannot be null when the status is 'R' !")),
  JSON.stringify(await t.errors()),
)
await pick('Carton details', 'Carton Status', 'S')
await typeIn('Carton details', 'Date Of Request', '02102026')
await t.click('Save', 400)
check(
  'carton: a request date needs the send date before it',
  (await t.errors()).some((e) => e.includes('Date of Request must greater than Date of Send')),
  JSON.stringify(await t.errors()),
)
await typeIn('Carton details', 'Date Of Send', '01102026')
await t.click('Save', 500)
await answer('Yes')
check('carton: Yes reports Record Saved...', await t.toast('Record Saved...'))
const add = writes.at(-1)
check(
  'carton: the request adds the one carton with its dates',
  add.path === `${E}/cartons` &&
    add.body.edit === false &&
    add.body.cartons.length === 1 &&
    add.body.cartons[0] === 'ZZ-E2E-NEW' &&
    add.body.status === 'S' &&
    add.body.sendDate === '2026-10-01' &&
    add.body.requestDate === '2026-10-02',
  JSON.stringify(add),
)

// two cartons ticked and edited together
const sorted = [...lookups.cartons].sort()
await t.click('Clear', 300)
await typeIn('Search cartons', 'Carton No from', sorted[0])
await typeIn('Search cartons', 'Carton No to', sorted[1])
await t.click('Search', 1200)
const both = await rowsOf('Cartons')
await tick('Cartons', 0)
await tick('Cartons', 1)
await sleep(300)
check(
  'carton: ticking two cartons counts them and enables Edit',
  both.length >= 2 && (await stat('No. of Rec. checked')) === '2' && !(await disabled('Edit')),
  `${both.length}`,
)
await t.click('Edit', 300)
check('carton: the carton number is locked while editing the ticked cartons', await disabledIn('Carton details', 'Carton No'))
await pick('Carton details', 'Carton Status', 'M')
await t.click('Update', 500)
await answer('Yes')
check('carton: Update reports Record Updated...', await t.toast('Record Updated...'))
const edit = writes.at(-1)
check(
  'carton: the request changes both ticked cartons',
  edit.body.edit === true && edit.body.cartons.length === 2 && edit.body.status === 'M',
  JSON.stringify(edit),
)
check('carton: nothing was written for real', (await json('/api/claim-bordx/storage/lookups')).cartons.length === lookups.cartons.length)

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
await limited.goto(`${BASE}/claim-bordx/storage-claim-files`, { waitUntil: 'networkidle0' })
await limited.waitForSelector('h2')
check('access: without position 15 the page says Access Denied!', (await limited.$eval('h2', (e) => e.textContent)) === 'Access Denied!')
check('access: and the API refuses with 403', (await get(`${E}/cartons`, mint(access))).status === 403 || (await send('POST', `${E}/cartons`, {})).status !== 0)

console.log(`screenshots: ${t.shots}`)
const ok = t.summary()
await t.browser.close()
process.exit(ok ? 0 : 1)
