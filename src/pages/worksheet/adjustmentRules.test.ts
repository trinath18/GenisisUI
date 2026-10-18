import { describe, expect, it } from 'vitest'
import { isSingleVersion, lastPayTo, paymentProblem, paymentSchema, toUpdateRequest } from './adjustmentRules'
import type { PaymentValues } from './adjustmentRules'

const values = (over: Partial<PaymentValues> = {}): PaymentValues => ({
  lastDocumentDate: '',
  payTo: '',
  gpName: '',
  bank: '',
  accountNo: '',
  paymentMode: '',
  attention: '',
  address1: '',
  address2: '',
  address3: '',
  postCode: '',
  city: '',
  state: '',
  note: '',
  worksheetRemarks: '',
  creditDebitNoteRemarks: '',
  ...over,
})
const complete = values({ bank: 'AFFIN BANK', accountNo: '123', address1: '1 Jalan Satu', postCode: '50000', city: 'KL', state: 'SELANGOR' })

describe('lastPayTo (MBMHosStatus)', () => {
  it('is the pay-to of the invoice with the highest index', () => {
    expect(
      lastPayTo([
        { invIndex: 1, payTo: 'M' },
        { invIndex: 3, payTo: 'H' },
        { invIndex: 2, payTo: 'M' },
      ]),
    ).toBe('H')
  })
  it('is empty without invoices', () => expect(lastPayTo([])).toBe(''))
})

describe('paymentProblem (cmdUpdate_Click)', () => {
  it('asks for nothing when the worksheet is paid to the hospital or has no pay-to', () => {
    expect(paymentProblem('H', values())).toBeNull()
    expect(paymentProblem('', values())).toBeNull()
  })
  it('accepts a member worksheet that has its address and no bank at all', () => {
    expect(paymentProblem('M', { ...complete, bank: '', accountNo: '' })).toBeNull()
    expect(paymentProblem('m', complete)).toBeNull()
  })
  it('pairs the bank and the account number first', () => {
    expect(paymentProblem('M', { ...complete, accountNo: ' ' })).toBe('Please Enter Bank Account Number')
    expect(paymentProblem('M', { ...complete, bank: '' })).toBe('Please Enter Bank Name')
  })
  it('then asks for address, post code, city and state in that order', () => {
    const none = { bank: '', accountNo: '', address1: '', postCode: '', city: '', state: '' }
    expect(paymentProblem('M', none)).toBe("Please Enter Member's Address")
    expect(paymentProblem('M', { ...none, address1: 'x' })).toBe('Please Enter Post Code')
    expect(paymentProblem('M', { ...none, address1: 'x', postCode: '5' })).toBe('Please Enter City')
    expect(paymentProblem('M', { ...none, address1: 'x', postCode: '5', city: 'c' })).toBe('Please Enter State')
  })
})

describe('paymentSchema', () => {
  it('holds text to the column lengths', async () => {
    await expect(paymentSchema.validate(values({ postCode: '1234567' }))).rejects.toThrow('Post Code can have at most 6 characters.')
    await expect(paymentSchema.validate(values({ worksheetRemarks: 'x'.repeat(201) }))).rejects.toThrow('Worksheet remarks can have at most 200 characters.')
  })
  it('allows only the two payment modes', async () => {
    await expect(paymentSchema.validate(values({ paymentMode: 'CASH' }))).rejects.toThrow('Payment Mode must be BY POST or BANK-IN.')
    await expect(paymentSchema.validate(values({ paymentMode: 'BANK-IN' }))).resolves.toBeTruthy()
    await expect(paymentSchema.validate(values())).resolves.toBeTruthy()
  })
  it('checks the last document date format', async () => {
    await expect(paymentSchema.validate(values({ lastDocumentDate: '31/02/2026' }))).rejects.toThrow()
    await expect(paymentSchema.validate(values({ lastDocumentDate: '01/10/2026' }))).resolves.toBeTruthy()
  })
})

describe('toUpdateRequest', () => {
  it('sends the date as an ISO day, or null when it is empty', () => {
    expect(toUpdateRequest(values({ lastDocumentDate: '01/10/2026' })).lastDocumentDate).toBe('2026-10-01')
    expect(toUpdateRequest(values()).lastDocumentDate).toBeNull()
  })
})

describe('isSingleVersion', () => {
  it('is true for a version number only, not for Master or the cumulative views', () => {
    expect(isSingleVersion('2')).toBe(true)
    expect(isSingleVersion('M2')).toBe(false)
    expect(isSingleVersion('Master')).toBe(false)
  })
})
