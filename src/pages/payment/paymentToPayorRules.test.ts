import { describe, expect, it } from 'vitest'
import { confirmText, pvBody, pvSchema, preview, tickProblem, tickableKeys } from './paymentToPayorRules'
import type { PayorClaim } from './paymentToPayorRules'

const claim = (caseNo: string, amount: number, extra: Partial<PayorClaim> = {}): PayorClaim => ({
  caseNo,
  claimVersion: '2',
  memberNo: null,
  memberName: null,
  payorCode: caseNo.slice(0, 2),
  payorName: null,
  pvInd: 'CB',
  bordxNo: null,
  closeDate: null,
  amount,
  pvNo: null,
  ...extra,
})

describe('payment to payor rules', () => {
  it('ticks only claims with something to pay back and a PV prefix', () => {
    expect(tickProblem(claim('WT1', 27.3))).toBeNull()
    expect(tickProblem(claim('ZZ1', 5, { pvInd: null }))).toBe('Payor ZZ has no PV prefix.')
    expect(tickProblem(claim('WT2', 0))).toBe('Claim WT2-2 has nothing to pay back.')
    expect(tickableKeys([claim('WT1', 1), claim('WT2', 0)])).toEqual(['WT1|2'])
  })

  it('previews one PV per payor', () => {
    expect(preview([claim('XI1', 10), claim('WT1', 27.3), claim('WT2', 27.3)])).toEqual([
      { payorCode: 'WT', claims: 2, amount: 54.6 },
      { payorCode: 'XI', claims: 1, amount: 10 },
    ])
    expect(confirmText([claim('WT1', 27.3)], { pvDate: '08/12/2009', chequeNo: ' CB002704 ', remark: '' })).toBe(
      'Generate 1 PV(s) for 1 claim(s), 27.30 in all, dated 08/12/2009, cheques from CB002704?',
    )
  })

  it('needs a PV date and a cheque number ending with a number', () => {
    expect(pvSchema.isValidSync({ pvDate: '08/12/2009', chequeNo: 'CB002704', remark: '' })).toBe(true)
    expect(pvSchema.isValidSync({ pvDate: '08/12/2009', chequeNo: '', remark: '' })).toBe(false)
    expect(pvSchema.isValidSync({ pvDate: '08/12/2009', chequeNo: 'CB', remark: '' })).toBe(false)
    expect(pvSchema.isValidSync({ pvDate: '', chequeNo: 'CB1', remark: '' })).toBe(false)
    expect(pvBody({ pvDate: '08/12/2009', chequeNo: ' CB1 ', remark: '' }, [claim('WT1', 1)])).toEqual({
      pvDate: '2009-12-08',
      chequeNo: 'CB1',
      remark: undefined,
      claims: [{ caseNo: 'WT1', claimVersion: '2' }],
    })
  })
})
