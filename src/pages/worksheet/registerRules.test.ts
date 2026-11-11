import { describe, expect, it } from 'vitest'
import { registerValuesOf, savedMessages, toRegisterRequest } from './registerRules'
import type { RegisterDefaults, RegisterResult } from './registerRules'

const defaults = (over: Partial<RegisterDefaults> = {}): RegisterDefaults => ({
  lastDocumentDate: '2026-10-05T00:00:00',
  payTo: 'A MEMBER',
  gpName: null,
  bank: 'AFFIN BANK',
  accountNo: '123456789012',
  paymentMode: null,
  attention: null,
  address1: '1 ROAD',
  address2: null,
  address3: null,
  postCode: '50000',
  city: 'KL',
  state: 'KUALA LUMPUR',
  note: null,
  worksheetRemarks: null,
  creditDebitNoteRemarks: null,
  ...over,
})

const result = (over: Partial<RegisterResult> = {}): RegisterResult => ({
  saved: true,
  confirm: null,
  version: 2,
  excessNumber: null,
  excessLetterAdded: false,
  memberBalance: null,
  notes: [],
  ...over,
})

describe('registerValuesOf', () => {
  it('shows the last document as dd/mm/yyyy and empty text for what the server left out', () => {
    const v = registerValuesOf(defaults())
    expect(v.lastDocumentDate).toBe('05/10/2026')
    expect([v.payTo, v.bank, v.accountNo, v.address1, v.state]).toEqual(['A MEMBER', 'AFFIN BANK', '123456789012', '1 ROAD', 'KUALA LUMPUR'])
    expect([v.gpName, v.paymentMode, v.attention, v.note, v.worksheetRemarks, v.creditDebitNoteRemarks]).toEqual(['', '', '', '', '', ''])
  })

  it('starts a hospital-paid worksheet without the member details', () => {
    const v = registerValuesOf(defaults({ payTo: '', bank: '', accountNo: '', address1: '', postCode: '', city: '', state: '' }))
    expect([v.payTo, v.bank, v.accountNo, v.address1, v.postCode, v.city, v.state]).toEqual(['', '', '', '', '', '', ''])
  })

  it('leaves the last document empty when the server has none', () => {
    expect(registerValuesOf(defaults({ lastDocumentDate: null })).lastDocumentDate).toBe('')
  })
})

describe('toRegisterRequest', () => {
  it('sends the status, the payment details with the date as an ISO day, and the answer to the question', () => {
    const body = toRegisterRequest('AA', registerValuesOf(defaults()), false)
    expect(body.worksheetStatus).toBe('AA')
    expect(body.confirmed).toBe(false)
    expect(body.payment.lastDocumentDate).toBe('2026-10-05')
    expect(body.payment.bank).toBe('AFFIN BANK')
    expect(toRegisterRequest('AA', registerValuesOf(defaults()), true).confirmed).toBe(true)
  })

  it('sends no date when the field is empty', () => {
    expect(toRegisterRequest('RR', registerValuesOf(defaults({ lastDocumentDate: null })), false).payment.lastDocumentDate).toBeNull()
  })
})

describe('savedMessages', () => {
  it('says the worksheet was saved first, with the case and the version', () => {
    expect(savedMessages(result(), 'AC00001977')).toEqual(['Record Save: AC00001977-2'])
  })

  it('adds the excess letter, the member limit and the notes when there are any', () => {
    const lines = savedMessages(
      result({
        excessNumber: 'EAC00001977-3',
        excessLetterAdded: true,
        memberBalance: { reason: null, record: 'MBM', before: 94060.35, after: 93960.35, applied: true },
        notes: ['No debit or credit note number was issued.'],
      }),
      'AC00001977',
    )
    expect(lines).toEqual([
      'Record Save: AC00001977-2',
      'Excess letter EAC00001977-3 was made.',
      "The member's available limit went from 94060.35 to 93960.35.",
      'No debit or credit note number was issued.',
    ])
  })

  it('does not report a member limit that was left alone, and says when the letter kept its first number', () => {
    const lines = savedMessages(
      result({
        excessNumber: 'EAC1-2',
        excessLetterAdded: false,
        memberBalance: { reason: 'the claim is not accepted', record: null, before: null, after: null, applied: false },
      }),
      'AC1',
    )
    expect(lines).toEqual(['Record Save: AC1-2', 'Excess letter EAC1-2 keeps the number of the first.'])
  })
})
