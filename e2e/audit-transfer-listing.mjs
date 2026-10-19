import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { start, sleep } from './lib.mjs'

const downloads = path.join(os.tmpdir(), 'genisis-e2e-downloads')
fs.rmSync(downloads, { recursive: true, force: true })
const t = await start(downloads)
const { page, check } = t
const CASE = 'ZZ00000106'
const AUDIT_CASE = 'XI00002733'

// ---------------- Case Audit Review
await t.go('audit-review')
check('audit: Update disabled before Load', await t.isDisabled('Update'))
await t.type('Case No', 'NO SUCH CASE')
await t.click('Load')
check('audit: unknown case -> No record found', await t.toast('No record found!'))
await t.type('Case No', AUDIT_CASE)
await t.click('Load')
check('audit: Update enabled after Load', await t.waitFor(async () => !(await t.isDisabled('Update'))))
check('audit: member number shown', (await t.readValue('Member No')) === 'XIGA6512412*01', await t.readValue('Member No'))
check(
  'audit: case status + policy status shown',
  (await t.readValue('Case Status')) === 'O' && (await t.readValue('Policy Status')) === 'A',
  `${await t.readValue('Case Status')}/${await t.readValue('Policy Status')}`,
)
await t.click('Update')
check('audit: discount type required', (await t.errors()).includes('Please Enter Discount Type!'), JSON.stringify(await t.errors()))
await t.select('Discount Type', 'A')
await t.select('Audit Review Status', 'O')
await t.type('Invoice Number', 'E2E-INV-1')
await t.type('Invoice Amount', '123.45')
await t.type('Query', 'E2E query')
await t.type('Officer-in-Charge', 'E2E Officer')
await t.type('Time', '1430')
await page.evaluate(() =>
  [...document.querySelectorAll('fieldset')]
    .find((f) => f.querySelector('legend')?.textContent === 'Invoice')
    .querySelectorAll('input')[1]
    .focus(),
)
await page.keyboard.type('01102026')
await t.click('Update')
await t.yes()
check('audit: updated', await t.toast('Record Updated Sucessfully'), JSON.stringify(await t.toasts()))
await sleep(800)
check(
  'audit: reload shows the saved invoice',
  (await t.value('Invoice Number')) === 'E2E-INV-1' && (await t.value('Invoice Amount')) === '123.45',
  `${await t.value('Invoice Number')}/${await t.value('Invoice Amount')}`,
)
check(
  'audit: visit time + officer persisted',
  (await t.value('Time')) === '14:30' && (await t.value('Officer-in-Charge')) === 'E2E Officer',
  `${await t.value('Time')}`,
)
await t.tab('General Info')
const covered = await t.rowsOf('Covered members')
check('audit: General Info lists the covered members', covered && covered.length >= 1, JSON.stringify(covered))
check(
  'audit: member address/limit fields',
  !!(await t.readValue('Address 1')) && !!(await t.readValue('Available Limit')),
  `${await t.readValue('Address 1')} / ${await t.readValue('Available Limit')}`,
)
await page.screenshot({ path: path.join(t.shots, 'e2e-audit-general.png') })
await t.tab('Case Details')
check('audit: Case Details shows the hospital', (await t.readValue('Hospital')).includes('UNIVERSITY MALAYA'), await t.readValue('Hospital'))
await page.screenshot({ path: path.join(t.shots, 'e2e-audit-details.png') })
await t.tab('Audit Review')
check('audit: payment record read-only fields present', (await t.readValue('PV Number')) !== null)

// ---------------- Case Transfer
await t.go('transfer')
check('transfer: Transfer disabled before Load', await t.isDisabled('Transfer'))
await t.type('Case No', CASE)
await t.click('Load')
check('transfer: Transfer enabled after Load', await t.waitFor(async () => !(await t.isDisabled('Transfer'))))
check(
  'transfer: current member shown',
  (await t.readValue('Member No')) === 'ZZHA0000518*01' && (await t.readValue('Cover ID')) === '00',
  await t.readValue('Member No'),
)
const setTarget = async (member, cover) => {
  await page.evaluate(() =>
    [...document.querySelectorAll('fieldset')]
      .find((f) => f.querySelector('legend')?.textContent === 'Transfer To')
      .querySelectorAll('input:not([readonly])')[0]
      .focus(),
  )
  await page.keyboard.down('Control')
  await page.keyboard.press('KeyA')
  await page.keyboard.up('Control')
  await page.keyboard.press('Backspace')
  await page.keyboard.type(member)
  await page.keyboard.press('Tab')
  await page.keyboard.down('Control')
  await page.keyboard.press('KeyA')
  await page.keyboard.up('Control')
  await page.keyboard.press('Backspace')
  await page.keyboard.type(cover)
  await page.keyboard.press('Tab')
  await sleep(900)
}
await setTarget('NO SUCH MEMBER', '00')
check('transfer: unknown member -> Member not found', await t.toast('Member not found.'))
await setTarget('ZZHA0000316*01', '77')
check('transfer: invalid cover id -> message', await t.toast('Invalid Cover ID. Please try again.'))
await setTarget('ZZHA0000316*01', '00')
const tp = await page.evaluate(() =>
  [...[...document.querySelectorAll('fieldset')].find((f) => f.querySelector('legend')?.textContent === 'Transfer To').querySelectorAll('input')]
    .map((i) => i.value)
    .join('|'),
)
check('transfer: target member details shown', tp.includes('TEMP NAME') && tp.includes('TEST COMP1'), tp)
await page.screenshot({ path: path.join(t.shots, 'e2e-transfer.png') })
await t.click('Transfer')
await t.yes()
check('transfer: transferred', await t.toast('Transferred successfully.'), JSON.stringify(await t.toasts()))
check(
  'transfer: current member is now the target',
  await t.waitFor(async () => (await t.readValue('Member No')) === 'ZZHA0000316*01'),
  await t.readValue('Member No'),
)
await setTarget('ZZHA0000316*01', '00')
await t.click('Transfer')
await t.yes()
check('transfer: same member refused', await t.toast('The case is already on this member and cover.'), JSON.stringify(await t.toasts()))
await setTarget('ZZHA0000518*01', '00')
await t.click('Transfer')
await t.yes()
check('transfer: transferred back', await t.waitFor(async () => (await t.readValue('Member No')) === 'ZZHA0000518*01'), await t.readValue('Member No'))

// ---------------- Inpatient Case Listing
const bordxCalls = []
let bordxMode = 'ok'
await page.setRequestInterception(true)
// A complete database has no group worksheet without a group company, which is the case the group-company rule is for; the search result is therefore
// patched so that ZN00007106 has none (the rest of the row is the real one).
const GROUP_RULE_CASE = 'ZN00007106'
page.on('request', async (req) => {
  if (req.method() === 'GET' && req.url().includes('/api/case/listing/search')) {
    try {
      const res = await fetch(req.url(), { headers: req.headers() })
      const rows = await res.json()
      const patched = Array.isArray(rows) ? rows.map((r) => (r.caseNo?.trim() === GROUP_RULE_CASE ? { ...r, groupCompany: '' } : r)) : rows
      await req.respond({ status: res.status, contentType: 'application/json', body: JSON.stringify(patched) })
    } catch {
      await req.continue()
    }
    return
  }
  if (req.method() === 'POST' && req.url().endsWith('/api/case/listing/bordx')) {
    bordxCalls.push(JSON.parse(req.postData()))
    if (bordxMode === 'ok')
      req.respond({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          message: 'Record Saved!',
          lines: bordxCalls.at(-1).items.map((i, n) => ({
            claimNo: `${i.caseNo}-${i.claimVersion}`,
            bordxNo: `NAH000000${n + 1}`,
            bordxDate: '2026-10-17T00:00:00',
            bordxAmount: 91,
          })),
        }),
      })
    else req.respond({ status: 400, contentType: 'application/json', body: JSON.stringify({ message: 'AH00001126-1: Hospital cannot be empty!' }) })
  } else req.continue()
})
await t.go('listing')
await t.click('Search')
check('listing: scan mode needs a worksheet no', (await t.errors()).includes('Please Enter Worksheet No'), JSON.stringify(await t.errors()))
await t.type('Wks No', 'NO SUCH WORKSHEET')
await t.click('Search')
check('listing: unknown worksheet -> No record found', await t.toast('No record found!'))
await t.type('Wks No', 'AH00001126')
await t.type('Version', '1')
await t.click('Search')
await t.waitFor(async () => (await t.rowsOf('Worksheets'))?.some((r) => r.length > 2))
let wk = (await t.rowsOf('Worksheets')).filter((r) => r.length > 2)
check('listing: scanned worksheet added to the list', wk.length === 1 && wk[0].includes('AH00001126-1'), JSON.stringify(wk))
await t.type('Wks No', 'AH00001126')
await t.type('Version', '1')
await t.click('Search')
check(
  'listing: scanning it again does not duplicate it',
  (await t.toast('already in the list')) && (await t.rowsOf('Worksheets')).filter((r) => r.length > 2).length === 1,
)
// a worksheet with no group company, one that needs scanned documents
for (const [no, v] of [
  ['ZN00007106', '1'],
  ['TA00035206', '1'],
]) {
  await t.type('Wks No', no)
  await t.type('Version', v)
  await t.click('Search')
  await sleep(700)
}
wk = (await t.rowsOf('Worksheets')).filter((r) => r.length > 2)
check('listing: three worksheets in the list', wk.length === 3, String(wk.length))
const tick = async (wks) => page.evaluate((k) => document.querySelector(`input[aria-label="Select ${k}"]`)?.click(), wks)
await tick('ZN00007106-1')
check('listing: group company rule blocks the tick', await t.toast('Group Company cannot be empty!'))
await tick('TA00035206-1')
check('listing: scanned-document rule blocks the tick', await t.toast('Please ensure scanned documents are in system!'), JSON.stringify(await t.toasts()))
await tick('AH00001126-1')
await sleep(900)
check('listing: valid worksheet gets ticked', await page.$eval('input[aria-label="Select AH00001126-1"]', (e) => e.checked))
check('listing: only the valid worksheet is selected', (await page.$$eval('tbody input[type=checkbox]:checked', (e) => e.length)) === 1)
await t.click('Generate Bordx')
check(
  'listing: bordx option required',
  (await t.errors()).includes('Please select Bordx option') || (await t.toasts()).some((x) => x.includes('Bordx option')),
  JSON.stringify(await t.errors()),
)
await t.select('Bordx Option', 'Multiple Claims')
bordxMode = 'error'
await t.click('Generate Bordx')
await t.yes()
check('listing: server rejection is shown', await t.toast('Hospital cannot be empty!'))
bordxMode = 'ok'
await t.click('Generate Bordx')
await t.yes()
check(
  'listing: bordx request carries option + ticked worksheet',
  bordxCalls.length === 2 &&
    bordxCalls[1].option === 'Multiple Claims' &&
    JSON.stringify(bordxCalls[1].items) === JSON.stringify([{ caseNo: 'AH00001126', claimVersion: 1 }]),
  JSON.stringify(bordxCalls),
)
check(
  'listing: success shows the generated bordx tab',
  await t.waitFor(async () => (await t.rowsOf('Generated bordx'))?.[0]?.[1] === 'NAH0000001'),
  JSON.stringify(await t.rowsOf('Generated bordx')),
)
wk = (await t.rowsOf('Worksheets'))?.filter((r) => r.length > 2) ?? []
check('listing: bordxed worksheet leaves the list', !wk.some((r) => r.includes('AH00001126-1')))
await page.screenshot({ path: path.join(t.shots, 'e2e-listing.png') })
// range search
await t.click('Clear')
await t.click('Use Scan').catch(() => {})
await page.evaluate(() =>
  [...document.querySelectorAll('label.check-field')]
    .find((x) => x.textContent.trim() === 'Use Scan')
    ?.querySelector('input')
    ?.click(),
)
await sleep(200)
await t.type('Wks No from', 'ZN00007100')
await t.type('Wks No to', 'ZN00007200')
await t.click('Search')
await t.waitFor(async () => ((await t.rowsOf('Worksheets')) ?? []).filter((r) => r.length > 2).length >= 2)
const range = (await t.rowsOf('Worksheets')).filter((r) => r.length > 2)
check('listing: range search returns the worksheets in range', range.length >= 2 && range.every((r) => r[2].startsWith('ZN')), String(range.length))

process.exitCode = t.summary() ? 0 : 1
await t.browser.close()
