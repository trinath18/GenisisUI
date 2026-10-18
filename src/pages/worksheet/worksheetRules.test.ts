import { describe, expect, it } from 'vitest'
import {
  accountsDefaults,
  accountsParams,
  accountsTickProblem,
  accountsUpdateProblem,
  arDefaults,
  arParams,
  isAlreadyListed,
  payorCode,
  trackingDefaults,
  trackingParams,
  trackingSchema,
  trackingTickProblem,
  trackingUpdateProblem,
  worksheetKey,
} from './worksheetRules'

describe('payorCode', () => {
  it('takes the text before the dash, as the desktop did with Mid(CboPayor, 1, InStr - 1)', () => {
    expect(payorCode('AX - AXA AFFIN GENERAL')).toBe('AX')
    expect(payorCode(' AC ')).toBe('AC')
    expect(payorCode('')).toBe('')
  })
})

describe('isAlreadyListed (CaseNoCheck)', () => {
  const rows = [{ caseNo: 'AC00000456' }, { caseNo: 'ZZ1' }]
  it('compares trimmed and upper-cased, like ChkStr', () => {
    expect(isAlreadyListed(rows, ' ac00000456 ')).toBe(true)
    expect(isAlreadyListed(rows, 'AC00000457')).toBe(false)
    expect(isAlreadyListed([], 'AC00000456')).toBe(false)
  })
})

describe('tick guards (ItemCheck)', () => {
  it('refuses a bordxed worksheet in tracking', () => {
    expect(trackingTickProblem({ bordxed: true })).toBe('This claim has been bordxed!')
    expect(trackingTickProblem({ bordxed: false })).toBeNull()
  })
  it('refuses a worksheet already sent to accounts', () => {
    expect(accountsTickProblem({ sent: true })).toBe('Record has been Updated!')
    expect(accountsTickProblem({ sent: false })).toBeNull()
  })
  it('keys a worksheet as case-version', () => expect(worksheetKey({ caseNo: 'AC001', claimVersion: 3 })).toBe('AC001-3'))
})

describe('trackingParams', () => {
  it('leaves blank criteria out and keeps the flags', () => {
    const p = trackingParams({
      ...trackingDefaults,
      wksNoFrom: ' AC001 ',
      payor: 'AX - AXA',
      approvedFrom: '1,000.50',
      dodFrom: '05/07/2021',
      dodEmpty: true,
      versionTo: '3',
    })
    expect(p.wksNoFrom).toBe('AC001')
    expect(p.wksNoTo).toBeUndefined()
    expect(p.payor).toBe('AX')
    expect(p.approvedFrom).toBe(1000.5)
    expect(p.dodFrom).toBe('2021-07-05')
    expect(p.dodEmpty).toBe(true)
    expect(p.versionTo).toBe(3)
    expect(p.versionFrom).toBeUndefined()
    expect(p.icFrom).toBeUndefined()
  })

  it('sends the end of the range in range mode only', () => {
    const range = trackingParams({ ...trackingDefaults, useScan: false, wksNoFrom: 'AC001', wksNoTo: 'AC009' })
    expect(range.wksNoTo).toBe('AC009')
    expect(trackingParams({ ...trackingDefaults, useScan: true, wksNoFrom: 'AC001', wksNoTo: 'AC009' }).wksNoTo).toBeUndefined()
  })
})

describe('trackingSchema', () => {
  it('asks for a worksheet number in scan mode only', async () => {
    await expect(trackingSchema.validate({ ...trackingDefaults, wksNoFrom: '' })).rejects.toThrow('Please Enter Worksheet No')
    await expect(trackingSchema.validate({ ...trackingDefaults, useScan: false })).resolves.toBeTruthy()
  })
  it('rejects a bad date, version and amount with the desktop wording', async () => {
    const base = { ...trackingDefaults, useScan: false }
    await expect(trackingSchema.validate({ ...base, doaFrom: '31/02/2021' })).rejects.toThrow('Invalid Date Format!')
    await expect(trackingSchema.validate({ ...base, versionFrom: 'x' })).rejects.toThrow('Enter a whole number.')
    await expect(trackingSchema.validate({ ...base, approvedTo: '12a' })).rejects.toThrow('Enter a valid amount.')
  })
})

describe('trackingUpdateProblem (CmdUpdate_Click)', () => {
  it('checks the date first, then the pending status', () => {
    expect(trackingUpdateProblem({ updateDate: '', updatePending: '' })).toEqual({ field: 'updateDate', message: 'Please Enter Date' })
    expect(trackingUpdateProblem({ updateDate: '18/10/2026', updatePending: '' })).toEqual({ field: 'updatePending', message: 'Please Enter Pending Status' })
    expect(trackingUpdateProblem({ updateDate: '18/10/2026', updatePending: 'P' })).toBeNull()
  })
})

describe('Send to A/C and Send to A/R', () => {
  it('defaults the token status to "0 - Both" like the desktop', () => {
    expect(accountsDefaults.tokenStatus).toBe('0')
    expect(arDefaults.tokenStatus).toBe('0')
  })
  it('builds the search criteria', () => {
    const a = accountsParams({ ...accountsDefaults, wksNoFrom: 'AC001', payor: 'AC - ACE', dateSentFrom: '01/10/2026', amountTo: '500' })
    expect(a).toMatchObject({ wksNoFrom: 'AC001', payor: 'AC', dateSentFrom: '2026-10-01', amountTo: 500, tokenStatus: '0' })
    expect(arParams({ ...arDefaults, wksNoFrom: ' AC001 ' })).toMatchObject({ wksNoFrom: 'AC001', tokenStatus: '0' })
  })
  it('needs a date before sending to accounts', () => {
    expect(accountsUpdateProblem({ sendDate: '' })).toEqual({ field: 'sendDate', message: 'Please Enter in date' })
    expect(accountsUpdateProblem({ sendDate: '18/10/2026' })).toBeNull()
  })
})
