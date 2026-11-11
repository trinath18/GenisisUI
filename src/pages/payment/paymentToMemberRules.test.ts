import { describe, expect, it } from 'vitest'
import { claimColumns, confirmText, generateProblem, payProblem, payeeOf, pvBody, searchDefaults, searchParams, voidBody } from './paymentToMemberRules'
import type { MemberClaim, Payee } from './paymentToMemberRules'

const claim = (caseNo: string, amount: number, extra: Partial<MemberClaim> = {}): MemberClaim => ({
  caseNo,
  claimVersion: '1',
  memberNo: null,
  memberName: 'MEMBER',
  patientName: null,
  payorCode: caseNo.slice(0, 2),
  pvInd: 'CC',
  debitNoteNo: null,
  amount,
  payTo: 'MEMBER',
  bank: 'MBB',
  account: '1234',
  payMode: null,
  receiptNo: null,
  receiptDate: null,
  payPending: null,
  bordxNo: null,
  closeDate: null,
  pvNo: null,
  ...extra,
})

const none = new Map<string, Payee>()

describe('payment to member rules', () => {
  it('pays only a claim with an amount, not held, with a prefix and a payee', () => {
    expect(payProblem(claim('PM1', 10))).toBeNull()
    expect(payProblem(claim('PM1', 0))).toBe('Claim PM1-1 has nothing payable to the member: void it instead.')
    expect(payProblem(claim('PM1', 10, { payPending: 'Y' }))).toBe('The payment of claim PM1-1 is pending.')
    expect(payProblem(claim('ZZ1', 10, { pvInd: null }))).toBe('Payor ZZ of claim ZZ1-1 has no PV prefix.')
    expect(payProblem(claim('PM1', 10, { payTo: ' ' }))).toBe('Please enter the payee of claim PM1-1.')
    expect(payProblem(claim('PM1', 10, { payTo: null }), { payTo: 'X', bank: '', account: '' })).toBeNull()
    expect(generateProblem([], none)).toBe('Please select the claims to pay.')
    expect(generateProblem([claim('PM1', 10), claim('PM2', -1)], none)).toMatch(/PM2-1/)
  })

  it('sends a changed payee only for the claims it was changed for', () => {
    const payees = new Map<string, Payee>([['PM2|1', { payTo: ' NEW PAYEE ', bank: '', account: '999' }]])
    const body = pvBody('auto', { pvDate: '06/08/2021', paymentMode: 'ONLINE', chequeNo: 'X', remark: 'TT' }, [claim('PM1', 10), claim('PM2', 5)], payees)
    expect(body).toEqual({
      source: 'auto',
      pvDate: '2021-08-06',
      paymentMode: 'ONLINE',
      chequeNo: undefined,
      remark: 'TT',
      claims: [
        { caseNo: 'PM1', claimVersion: '1', payTo: undefined, bank: undefined, account: undefined },
        { caseNo: 'PM2', claimVersion: '1', payTo: 'NEW PAYEE', bank: undefined, account: '999' },
      ],
    })
    expect(payeeOf(claim('PM2', 5), payees).account).toBe('999')
    expect(payeeOf(claim('PM1', 5), payees)).toEqual({ payTo: 'MEMBER', bank: 'MBB', account: '1234' })
    expect(voidBody('dn', { pvDate: '06/08/2021', paymentMode: 'ONLINE', chequeNo: '', remark: '' }, [claim('PM1', 0)])).toEqual({
      source: 'dn',
      voidDate: '2021-08-06',
      remark: undefined,
      claims: [{ caseNo: 'PM1', claimVersion: '1' }],
    })
  })

  it('shows the payor receipt and pay mode only on the auto list', () => {
    expect(claimColumns('auto', none).map((c) => c.label)).toContain('Payor Receipt')
    expect(claimColumns('dn', none).map((c) => c.label)).not.toContain('Payor Receipt')
    expect(confirmText([claim('PM1', 10), claim('PM2', 5.5)], { pvDate: '06/08/2021', paymentMode: 'CHEQUE', chequeNo: 'A1', remark: '' })).toBe(
      'Generate 2 PV(s), 15.50 in all, dated 06/08/2021, paid by CHEQUE?',
    )
    expect(searchParams('dn', { ...searchDefaults, noteFrom: ' DAH ' })).toMatchObject({ source: 'dn', noteFrom: 'DAH', payor: undefined })
  })
})
