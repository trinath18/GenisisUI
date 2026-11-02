import { describe, expect, it } from 'vitest'
import {
  criteriaOptions,
  invoiceRows,
  listingRows,
  mcoColumns,
  mcoDefaults,
  mcoParams,
  needsConfirmation,
  printProblem,
  printRequest,
  reportTypeOptions,
  rounded,
  searchProblem,
} from './mcoReinstatementRules'
import type { McoDocument, McoRow, McoValues } from './mcoReinstatementRules'

const v = (over: Partial<McoValues>): McoValues => ({ ...mcoDefaults, ...over })
const row = (over: Partial<McoRow> = {}): McoRow =>
  ({
    memberNo: 'AHHA1*01',
    coverId: '00',
    memberName: 'A MEMBER',
    relation: 'P',
    adultChild: 'Adult',
    bordxDate: '2021-07-26T00:00:00',
    batchNo: '1',
    policyNo: 'P1',
    effDate: '2021-01-01T00:00:00',
    expDate: '2021-12-31T00:00:00',
    invoiceNo: null,
    invoiceDate: null,
    mcoFee: 3.59,
    icNo: 'IC',
    personIc: 'IC1',
    groupCompany: 'ACME',
    daysInsured: 364,
    isCovered: false,
    payorCode: 'AH',
    ...over,
  }) as McoRow

describe('MCO Reinstatement checks', () => {
  it('has the desktop choices', () => {
    expect(criteriaOptions.map((o) => o.value)).toEqual(['batch', 'invoice'])
    expect(reportTypeOptions.map((o) => o.label)).toEqual(['Invoice', 'Listing'])
  })

  it('checks the criteria, the payor, the date, the batch and, for an invoice, the invoice number, in order', () => {
    expect(searchProblem(v({}))?.message).toBe('Please Enter MCO Criteria!')
    expect(searchProblem(v({ criteria: 'batch' }))?.message).toBe('Please Enter Payor!')
    expect(searchProblem(v({ criteria: 'batch', payor: 'AH' }))?.message).toBe('Please Enter Bordereaux Date!')
    expect(searchProblem(v({ criteria: 'batch', payor: 'AH', bordxDate: '26/07/2021' }))?.message).toBe('Please Enter Batch No!')
    expect(searchProblem(v({ criteria: 'batch', payor: 'AH', bordxDate: '26/07/2021', batchNo: '1A' }))?.message).toBe('Batch No must be a number.')
    expect(searchProblem(v({ criteria: 'batch', payor: 'AH', bordxDate: '26/07/2021', batchNo: '1' }))).toBeNull()
    expect(searchProblem(v({ criteria: 'invoice' }))?.message).toBe('Please Enter Invoice No!')
    expect(searchProblem(v({ criteria: 'invoice', invoiceNo: 'S1' }))).toBeNull()
  })

  it('asks for the report type before it checks the search', () => {
    expect(printProblem(v({ criteria: 'invoice', invoiceNo: 'S1' }))?.message).toBe('Please Select Report Type !')
    expect(printProblem(v({ criteria: 'invoice', invoiceNo: 'S1', reportType: 'invoice' }))).toBeNull()
    expect(printProblem(v({ reportType: 'listing' }))?.message).toBe('Please Enter MCO Criteria!')
  })

  it('sends only the criteria of the chosen search, and the allocation flag of Print or Preview', () => {
    expect(mcoParams(v({ criteria: 'batch', payor: ' AH - X ', bordxDate: '26/07/2021', batchNo: ' 1 ', invoiceNo: 'ignored' }))).toEqual({
      criteria: 'batch',
      payor: 'AH - X',
      bordxDate: '2021-07-26',
      batchNo: '1',
      invoiceNo: undefined,
    })
    expect(mcoParams(v({ criteria: 'invoice', invoiceNo: ' S1 ', payor: 'AH' }))).toEqual({
      criteria: 'invoice',
      payor: undefined,
      bordxDate: undefined,
      batchNo: undefined,
      invoiceNo: 'S1',
    })
    expect(printRequest(v({ criteria: 'invoice', invoiceNo: 'S1', reportType: 'invoice' }), true)).toMatchObject({ reportType: 'invoice', allocate: true })
    expect(printRequest(v({ criteria: 'invoice', invoiceNo: 'S1', reportType: 'listing' }), false).allocate).toBe(false)
  })

  it('asks before giving out an invoice number only when no member has one', () => {
    expect(needsConfirmation(null)).toBe(false)
    expect(needsConfirmation({ rows: [], principals: 0, supplementary: 0, invoices: [], truncated: false })).toBe(true)
    expect(needsConfirmation({ rows: [], principals: 0, supplementary: 0, invoices: ['S1'], truncated: false })).toBe(false)
  })
})

describe('MCO Reinstatement documents', () => {
  it('rounds the fee to a whole number and lists a line', () => {
    expect([rounded(3.59), rounded(10.5), rounded(null)]).toEqual([4, 11, 0])
    expect(mcoColumns.map((c) => c.label)).toEqual([
      'Member No',
      'Cover ID',
      'Member Name',
      'Rel',
      'BordxDate',
      'Batch No',
      'Pol No',
      'Eff Date',
      'Exp Date',
      'Adult/Child',
      'Invoice No',
      'Invoice Date',
      'MCOFee',
    ])
    expect(mcoColumns.map((c) => c.value(row()))).toEqual([
      'AHHA1*01',
      '00',
      'A MEMBER',
      'P',
      '26/07/2021',
      '1',
      'P1',
      '01/01/2021',
      '31/12/2021',
      'Adult',
      '',
      '',
      '4',
    ])
  })

  it('writes the invoice with its payor, lines and total, and the listing with its members and total', () => {
    const doc: McoDocument = {
      reportType: 'invoice',
      allocated: true,
      invoiceNo: 'S00042',
      invoiceDate: '2026-10-30T00:00:00',
      payor: { code: 'AH', name: 'A PAYOR', address1: 'A1', address2: 'A2', address3: 'A3', contact: 'Ms C', telephone: '03-1', fax: '03-2', prefix: 'S' },
      lines: [
        {
          bordxDate: '2021-07-26T00:00:00',
          batchNo: 1,
          insCode: 'H',
          adultChild: 'A',
          principals: 2,
          coveredPersons: 3,
          mcoFee: 10.5,
          invoiceNo: 'S00042',
          invoiceDate: '2026-10-30T00:00:00',
        },
        {
          bordxDate: '2021-07-26T00:00:00',
          batchNo: 1,
          insCode: 'H',
          adultChild: 'C',
          principals: 1,
          coveredPersons: 1,
          mcoFee: 2.2,
          invoiceNo: 'S00042',
          invoiceDate: '2026-10-30T00:00:00',
        },
      ],
      rows: [row(), row({ memberNo: 'AHHA2*01', mcoFee: 1.2 })],
    }
    const invoice = invoiceRows(doc)
    expect(invoice.slice(0, 6)).toEqual([
      ['A PAYOR'],
      ['A1'],
      ['A2'],
      ['A3'],
      ['Contact', 'Ms C', 'Tel', '03-1', 'Fax', '03-2'],
      ['Invoice No', 'S00042', 'Invoice Date', '30/10/2026'],
    ])
    expect(invoice[8]).toEqual(['1', '26/07/2021', '1', 'H', 'A', '2', '3', '11'])
    expect(invoice.at(-1)).toEqual(['', '', '', '', '', '', 'Total', '13'])
    const listing = listingRows(doc)
    expect(listing[0]).toEqual(['Payor', 'AH', 'Invoice No', 'S00042', 'Invoice Date', '30/10/2026'])
    expect(listing[4]).toEqual(['1', 'AHHA1*01', 'P1', 'A MEMBER', 'P', 'IC1', 'ACME', '364', '4'])
    expect(listing.at(-1)).toEqual(['', '', '', '', '', '', '', 'Total', '5'])
  })
})
