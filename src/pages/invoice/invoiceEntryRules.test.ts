import { describe, expect, it } from 'vitest'
import {
  bySection,
  cleanAmount,
  emptyValues,
  firstProblem,
  isEditable,
  messages,
  needsHospitalConfirmation,
  shown,
  taxEra,
  toRequest,
  valuesOf,
} from './invoiceEntryRules'
import type { InvoiceField, InvoiceFormDto, InvoiceValues } from './invoiceEntryRules'

const header = {
  memberName: 'A MEMBER',
  discharged: '2021-01-03T00:00:00',
  hospitalCode: 'PANIN',
  planCode: 'BV18',
  modality: 'N',
  stayType: 'I',
  remarks: 'an existing remark',
}
const valid = (): InvoiceValues => ({
  ...emptyValues(header),
  invoiceNo: 'I1',
  invoiceDate: '04/01/2021',
  payTo: 'H',
  payee: 'PANIN',
  excessAmount: '0',
  initialAmount: '100',
})

describe('firstProblem', () => {
  it('passes a complete invoice', () => expect(firstProblem(valid(), header, 'PANTAI HOSPITAL AMPANG')).toBeNull())

  it.each([
    ['no member', { ...header, memberName: '' }, {}, messages.noCase],
    ['no discharge date', { ...header, discharged: null }, {}, messages.noDischarge],
    ['nobody to pay', header, { payTo: '' }, messages.noPayTo],
    ['no stay type', header, { stayType: ' ' }, messages.noStayType],
    ['no payee', header, { payee: '' }, messages.noPayee],
    ['no invoice number', header, { invoiceNo: '' }, messages.noInvoiceNo],
    ['no invoice date', header, { invoiceDate: '' }, messages.noInvoiceDate],
    ['an impossible invoice date', header, { invoiceDate: '31/02/2021' }, messages.badInvoiceDate],
    ['no excess for a hospital', header, { excessAmount: '' }, messages.noExcess],
    ['no initial amount', header, { initialAmount: '' }, messages.noInitialAmount],
  ])('%s', (_, h, change, message) => expect(firstProblem({ ...valid(), ...change }, h as typeof header, null)).toBe(message))

  it('asks a paid member for a receipt date and then a receipt mode', () => {
    const member = { ...valid(), payTo: 'M', payee: 'THE MEMBER', excessAmount: '' }
    expect(firstProblem(member, header, null)).toBe(messages.noReceiptDate)
    expect(firstProblem({ ...member, receiptDate: '05/01/2021' }, header, null)).toBe(messages.noReceiptMode)
    expect(firstProblem({ ...member, receiptDate: '05/01/2021', receiptMode: 'EF' }, header, null)).toBeNull()
  })

  it('reports problems in the desktop order', () => {
    const everything = { ...emptyValues(header), stayType: '' }
    expect(firstProblem(everything, header, null)).toBe(messages.noPayTo)
    expect(firstProblem({ ...everything, payTo: 'H' }, header, null)).toBe(messages.noStayType)
    expect(firstProblem({ ...everything, payTo: 'H', stayType: 'I' }, header, null)).toBe(messages.noPayee)
  })

  it.each(['dental clinic', 'GENERAL PRACTITIONER', 'Non-Panel Hospital'])('needs the name of the provider typed beside %s', (provider) => {
    expect(firstProblem(valid(), header, provider)).toBe(messages.noProviderName)
    expect(firstProblem({ ...valid(), texts: { INVHospName: 'DR LEE CLINIC' } }, header, provider)).toBeNull()
  })
})

describe('needsHospitalConfirmation', () => {
  it("asks only when a hospital other than the case's is to be paid", () => {
    expect(needsHospitalConfirmation({ payTo: 'H', payee: 'panin' }, header)).toBe(false)
    expect(needsHospitalConfirmation({ payTo: 'H', payee: 'OTHER' }, header)).toBe(true)
    expect(needsHospitalConfirmation({ payTo: 'M', payee: 'OTHER' }, header)).toBe(false)
  })
})

describe('toRequest and valuesOf', () => {
  it('turns the form into the request: ISO dates, numbers, empty entries as nothing', () => {
    const v = {
      ...valid(),
      receiptDate: '',
      amounts: { CLMServices: '1,200.50', CLMTheatre: '', CLMBoardAmt: '-5' },
      texts: { CLMOther1Desc: 'a note' },
      uhcNo: ' U1 ',
    }
    const r = toRequest(v, 'AB0001', null, true)
    expect(r).toMatchObject({
      caseNo: 'AB0001',
      index: null,
      invoiceDate: '2021-01-04',
      receiptDate: null,
      excessAmount: 0,
      initialAmount: 100,
      uhcNo: 'U1',
      confirmDifferentHospital: true,
    })
    expect(r.amounts).toEqual({ CLMServices: 1200.5, CLMTheatre: null, CLMBoardAmt: -5 })
    expect(r.texts).toEqual({ CLMOther1Desc: 'a note' })
  })

  it('shows the money of a loaded invoice with two decimals when the fields are known', () => {
    const dto = {
      caseNo: 'A',
      index: 1,
      invoiceNo: null,
      invoiceDate: null,
      payTo: null,
      payee: null,
      stayType: null,
      roomType: null,
      receiptMode: null,
      receiptDate: null,
      followUpDate: null,
      excessAmount: null,
      initialAmount: null,
      uhcNo: null,
      amounts: { CLMServices: 40.5, CLMBoardDay: 7.5, CLMTheatre: null },
      texts: {},
      remarks: null,
      confirmDifferentHospital: false,
    }
    const v = valuesOf(dto, [
      { key: 'CLMServices', kind: 'Money' },
      { key: 'CLMBoardDay', kind: 'Number' },
      { key: 'CLMTheatre', kind: 'Money' },
    ])
    expect(v.amounts).toEqual({ CLMServices: '40.50', CLMBoardDay: '7.5', CLMTheatre: '' })
  })

  it('loads a saved invoice back into the form and out again unchanged', () => {
    const dto: InvoiceFormDto = {
      caseNo: 'AB0001',
      index: 7,
      invoiceNo: 'I1',
      invoiceDate: '2021-01-04T00:00:00',
      payTo: 'H',
      payee: 'PANIN',
      stayType: 'I',
      roomType: '',
      receiptMode: '',
      receiptDate: null,
      followUpDate: '2021-02-01T00:00:00',
      excessAmount: 20,
      initialAmount: 100,
      uhcNo: '',
      amounts: { CLMServices: 40.5, CLMTheatre: null },
      texts: { CLMMedRptMBM: 'Y' },
      remarks: 'r',
      confirmDifferentHospital: false,
    }
    const v = valuesOf(dto)
    expect(v).toMatchObject({
      invoiceDate: '04/01/2021',
      followUpDate: '01/02/2021',
      receiptDate: '',
      excessAmount: '20',
      amounts: { CLMServices: '40.5', CLMTheatre: '' },
    })
    expect(toRequest(v, 'AB0001', 7, false)).toMatchObject({
      invoiceDate: '2021-01-04',
      followUpDate: '2021-02-01',
      excessAmount: 20,
      amounts: { CLMServices: 40.5, CLMTheatre: null },
    })
  })
})

describe('which fields can be typed in', () => {
  const field = (over: Partial<InvoiceField>): InvoiceField => ({
    key: 'K',
    label: 'K',
    section: 'S',
    kind: 'Money',
    sumOf: null,
    computed: false,
    frame: null,
    tax: null,
    ...over,
  })
  it('uses the new tax entries for plans 2 to 5 and the old ones for the rest', () => {
    expect([taxEra('2A1'), taxEra('5X'), taxEra('BV18'), taxEra('1X'), taxEra('')]).toEqual(['new', 'new', 'old', 'old', 'old'])
    expect(isEditable(field({ tax: 'new' }), { planCode: '2A1', modality: 'S' }, {})).toBe(true)
    expect(isEditable(field({ tax: 'old' }), { planCode: '2A1', modality: 'S' }, {})).toBe(false)
    expect(isEditable(field({ tax: 'old' }), { planCode: 'BV18', modality: 'S' }, {})).toBe(true)
  })
  it('enables the surgical frame for surgical cases and the non-surgical one for the others', () => {
    expect(isEditable(field({ frame: 'S' }), { planCode: 'BV18', modality: 'N' }, {})).toBe(false)
    expect(isEditable(field({ frame: 'N' }), { planCode: 'BV18', modality: 'N' }, {})).toBe(true)
    expect(isEditable(field({ frame: 'N' }), { planCode: 'BV18', modality: 'S' }, {})).toBe(false)
    expect(isEditable(field({ frame: 'S' }), { planCode: 'BV18', modality: '' }, {})).toBe(true)
  })
  it('does not let a worked-out total be typed, nor a sum while one of its parts has a value', () => {
    expect(isEditable(field({ computed: true }), { planCode: 'BV18', modality: 'S' }, {})).toBe(false)
    const sum = field({ sumOf: ['A', 'B'] })
    expect(isEditable(sum, { planCode: 'BV18', modality: 'S' }, { A: '', B: ' ' })).toBe(true)
    expect(isEditable(sum, { planCode: 'BV18', modality: 'S' }, { A: '', B: '3' })).toBe(false)
  })
})

describe('emptyValues', () => {
  it('starts a new invoice from the stay type and remark of the case so saving does not wipe the remark', () => {
    expect(emptyValues(header)).toMatchObject({ stayType: 'I', remarks: 'an existing remark', payTo: '', invoiceNo: '' })
    expect(emptyValues({ stayType: null, remarks: null })).toMatchObject({ stayType: '', remarks: '' })
  })
})

describe('small helpers', () => {
  it('groups the fields by section in order', () => {
    const f = (key: string, section: string): InvoiceField => ({
      key,
      label: key,
      section,
      kind: 'Money',
      sumOf: null,
      computed: false,
      frame: null,
      tax: null,
    })
    expect(bySection([f('a', 'X'), f('b', 'Y'), f('c', 'X')]).map((g) => [g.section, g.fields.map((x) => x.key)])).toEqual([
      ['X', ['a', 'c']],
      ['Y', ['b']],
    ])
  })
  it('shows money with two decimals and days as they are', () => {
    expect([shown(200, 'Money'), shown(7.5, 'Number'), shown(null, 'Money')]).toEqual(['200.00', '7.5', ''])
  })
  it('keeps digits, one decimal point and a leading minus', () => {
    expect([cleanAmount('12a.5.5'), cleanAmount('-4.2'), cleanAmount('1-2'), cleanAmount('')]).toEqual(['12.55', '-4.2', '12', ''])
  })
})
