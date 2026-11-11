import { describe, expect, it } from 'vitest'
import { confirmText, generateProblem, pvBody, pvSchema, preview, searchParams, searchDefaults, tickProblem, tickableKeys } from './paymentToHospitalRules'
import type { HospitalClaim } from './paymentToHospitalRules'

const claim = (caseNo: string, hospitalCode: string, amount: number, extra: Partial<HospitalClaim> = {}): HospitalClaim => ({
  caseNo,
  claimVersion: '1',
  memberNo: null,
  hospitalCode,
  hospitalName: `${hospitalCode} HOSPITAL`,
  payee: null,
  bordxNo: null,
  bordxDate: null,
  payorCode: caseNo.slice(0, 2),
  pvInd: 'CB',
  amount,
  invoices: 1,
  invDate: null,
  payPending: null,
  pendingRemark: null,
  pvNo: null,
  ...extra,
})

describe('payment to hospital rules', () => {
  it('refuses to tick a held claim, a payor with no PV prefix or nothing payable', () => {
    expect(tickProblem(claim('ST1', 'A', 10))).toBeNull()
    expect(tickProblem(claim('ST1', 'A', 10, { payPending: 'Y', pendingRemark: 'GL' }))).toBe('The payment of claim ST1-1 is pending: GL.')
    expect(tickProblem(claim('ZZ1', 'A', 10, { pvInd: null }))).toBe('Payor ZZ has no PV prefix.')
    expect(tickProblem(claim('ST1', 'A', 0))).toMatch(/nothing payable/)
    expect(tickableKeys([claim('ST1', 'A', 10), claim('ST2', 'A', 10, { payPending: 'Y' })])).toEqual(['ST1|1'])
  })

  it('previews one PV per hospital and prefix', () => {
    const groups = preview([claim('ST1', 'B', 10.1), claim('ST2', 'A', 5), claim('ST3', 'B', 0.2), claim('PM4', 'B', 1, { pvInd: 'CC' })])
    expect(groups).toEqual([
      { hospitalName: 'A HOSPITAL', pvInd: 'CB', claims: 1, amount: 5 },
      { hospitalName: 'B HOSPITAL', pvInd: 'CB', claims: 2, amount: 10.3 },
      { hospitalName: 'B HOSPITAL', pvInd: 'CC', claims: 1, amount: 1 },
    ])
    expect(confirmText([claim('ST1', 'B', 10), claim('ST2', 'A', 5)], { pvDate: '06/08/2021', paymentMode: 'ONLINE', chequeNo: '', remark: '' })).toBe(
      'Generate 2 PV(s) for 2 claim(s), 15.00 in all, dated 06/08/2021, paid by ONLINE?',
    )
  })

  it('needs a claim and a PV that adds up to more than 0', () => {
    expect(generateProblem([])).toBe('Please select the claims to pay.')
    expect(generateProblem([claim('ST1', 'A', 10), claim('ST2', 'A', -10)])).toMatch(/A HOSPITAL adds up to/)
    expect(generateProblem([claim('ST1', 'A', 10)])).toBeNull()
  })

  it('asks for a cheque number ending with a number only for cheques', () => {
    expect(pvSchema.isValidSync({ pvDate: '06/08/2021', paymentMode: 'ONLINE', chequeNo: '', remark: '' })).toBe(true)
    expect(pvSchema.isValidSync({ pvDate: '06/08/2021', paymentMode: 'CHEQUE', chequeNo: '', remark: '' })).toBe(false)
    expect(pvSchema.isValidSync({ pvDate: '06/08/2021', paymentMode: 'CHEQUE', chequeNo: 'MBB', remark: '' })).toBe(false)
    expect(pvSchema.isValidSync({ pvDate: '06/08/2021', paymentMode: 'CHEQUE', chequeNo: 'MBB026496', remark: '' })).toBe(true)
    expect(pvSchema.isValidSync({ pvDate: '', paymentMode: 'ONLINE', chequeNo: '', remark: '' })).toBe(false)
  })

  it('sends the claims ticked and the cheque only for cheques', () => {
    const body = pvBody({ pvDate: '06/08/2021', paymentMode: 'ONLINE', chequeNo: 'X1', remark: ' ' }, [claim('ST1', 'A', 10)])
    expect(body).toEqual({
      pvDate: '2021-08-06',
      paymentMode: 'ONLINE',
      chequeNo: undefined,
      remark: undefined,
      claims: [{ caseNo: 'ST1', claimVersion: '1' }],
    })
    expect(searchParams({ ...searchDefaults, payor: ' ST ', bordxDateFrom: '01/07/2021' })).toMatchObject({
      payor: 'ST',
      bordxDateFrom: '2021-07-01',
      hospital: undefined,
    })
  })
})
