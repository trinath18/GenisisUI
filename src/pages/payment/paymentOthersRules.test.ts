import { describe, expect, it } from 'vitest'
import { confirmText, searchDefaults, searchParams, voucherBody, voucherDefaults, voucherSchema } from './paymentOthersRules'

const valid = { ...voucherDefaults(), pvDate: '06/08/2021', payTo: ' LHDN ', amount: '120.50', chequeNo: 'MBB026500' }

describe('payment others rules', () => {
  it('needs a date, a payee, an amount above 0 and a cheque', () => {
    expect(voucherSchema.isValidSync(valid)).toBe(true)
    expect(voucherSchema.isValidSync({ ...valid, payTo: '' })).toBe(false)
    expect(voucherSchema.isValidSync({ ...valid, amount: '0' })).toBe(false)
    expect(voucherSchema.isValidSync({ ...valid, amount: 'abc' })).toBe(false)
    expect(voucherSchema.isValidSync({ ...valid, chequeNo: '' })).toBe(false)
    expect(voucherSchema.isValidSync({ ...valid, pvDate: '' })).toBe(false)
    expect(voucherSchema.isValidSync({ ...valid, bankCharges: '-1' })).toBe(false)
  })

  it('sends numbers and leaves the empty boxes out', () => {
    expect(voucherBody({ ...valid, bankCharges: '1.5', chequeDate: '07/08/2021' })).toEqual({
      prefix: 'CB',
      pvDate: '2021-08-06',
      payTo: 'LHDN',
      amount: 120.5,
      chequeNo: 'MBB026500',
      chequeDate: '2021-08-07',
      payeeBank: undefined,
      payeeAccount: undefined,
      caseNo: undefined,
      bankCharges: 1.5,
      remark: undefined,
    })
    expect(confirmText(valid)).toBe('Save a CB PV of 120.50 to LHDN, cheque MBB026500?')
    expect(searchParams({ ...searchDefaults, payTo: ' x ', dateTo: '31/08/2021' })).toMatchObject({ payTo: 'x', dateTo: '2021-08-31', pvFrom: undefined })
  })
})
