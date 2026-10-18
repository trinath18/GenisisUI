import { describe, expect, it } from 'vitest'
import { canMakeNote, excessHeading, noteAddress, noteAddressee, noteTitle, showsTotalExcess } from './documentRules'

const note = {
  kind: 'Debit' as const,
  companyPlan: false,
  groupCompany: 'ACME BHD',
  patientName: 'ALI',
  address1: ' 1 Jalan ',
  address2: '',
  address3: 'Taman',
  postCode: '50000',
  city: 'KL',
  state: '',
}

describe('noteTitle', () => {
  it('names the kind of note', () => {
    expect(noteTitle({ kind: 'Credit' })).toBe('CREDIT NOTE')
    expect(noteTitle({ kind: 'Debit' })).toBe('DEBIT NOTE')
  })
})

describe('noteAddressee', () => {
  it('is the patient, except for the debit note of a plan billed to the company', () => {
    expect(noteAddressee(note)).toBe('ALI')
    expect(noteAddressee({ ...note, companyPlan: true })).toBe('ACME BHD')
    expect(noteAddressee({ ...note, kind: 'Credit', companyPlan: true })).toBe('ALI')
    expect(noteAddressee({ ...note, companyPlan: true, groupCompany: ' ' })).toBe('ALI')
  })
})

describe('noteAddress', () => {
  it('prints the lines that have text and the post code, city and state together', () => {
    expect(noteAddress(note)).toEqual(['1 Jalan', 'Taman', '50000 KL'])
    expect(noteAddress({ ...note, address1: '', address3: '', postCode: '', city: '' })).toEqual([])
  })
})

describe('canMakeNote', () => {
  it('lets the sign of the amount pick the button', () => {
    expect(canMakeNote('Credit', 'Credit')).toBe(true)
    expect(canMakeNote('Credit', 'Debit')).toBe(false)
    expect(canMakeNote('None', 'Debit')).toBe(false)
    expect(canMakeNote(undefined, 'Credit')).toBe(false)
  })
})

describe('excess letter', () => {
  it('shows a total only when it is above zero', () => {
    expect(showsTotalExcess({ totalExcess: 0.01 })).toBe(true)
    expect(showsTotalExcess({ totalExcess: 0 })).toBe(false)
  })
  it('has a heading per template', () => {
    expect(excessHeading('MAS')).toContain('MAS')
    expect(excessHeading('Etiqa')).toContain('ETIQA')
    expect(excessHeading('Medix')).toBe('EXCESS PAYMENT NOTICE')
  })
})
