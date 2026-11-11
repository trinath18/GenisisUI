import { describe, expect, it } from 'vitest'
import { dateByOptions, dateLabel, printedOptions, refundColumns, refundDefaults, refundParams, refundProblem, shownName } from './refundListingRules'
import type { RefundRow } from './refundListingRules'

const row = (over: Partial<RefundRow> = {}): RefundRow =>
  ({
    kind: 'principal',
    memberNo: 'AB1*01',
    coverId: '00',
    policyNo: 'P1',
    memberName: ' A MEMBER ',
    status: 'C',
    icNo: '800101-01-1234',
    bordxDate: '2021-07-01T00:00:00',
    payorEffDate: '2021-01-01T00:00:00',
    payorExpDate: '2021-12-31T00:00:00',
    daysInsured: 364,
    endtEffDate: '2021-08-01T00:00:00',
    endtBordxDate: '2021-08-05T00:00:00',
    daysUtilised: 212,
    monthsUtilised: 7,
    mcoFee: 100,
    mcoUtilised: 20,
    mcoRefund: 1234.5,
    mcoRefundMin: 50,
    invoiceNo: 'INV1',
    invoiceDate: '2021-01-05T00:00:00',
    remarks: 'This member had 2 Case(s)',
    creditNote: null,
    creditDate: null,
    ...over,
  }) as RefundRow

describe('Refund Listing criteria', () => {
  it('opens on no date selection and print status No', () => {
    expect(refundDefaults).toEqual({ dateBy: '', payor: '', dateFrom: '', dateTo: '', printed: 'N' })
    expect(dateByOptions.map((o) => o.label)).toEqual(['Endt. Eff Date', 'Endt. Bordx Date'])
    expect(printedOptions.map((o) => o.label)).toEqual(['N - No', 'Y - Yes'])
  })

  it('checks the date selection before the payor', () => {
    expect(refundProblem(refundDefaults)).toEqual({ field: 'dateBy', message: 'Please Select Date Selection!' })
    expect(refundProblem({ ...refundDefaults, dateBy: 'bordx' })).toEqual({ field: 'payor', message: 'Please Select Payor!' })
    expect(refundProblem({ ...refundDefaults, dateBy: 'bordx', payor: 'AB - A PAYOR' })).toBeNull()
  })

  it('labels the dates after the selection and sends them as ISO days', () => {
    expect([dateLabel('effective'), dateLabel('bordx'), dateLabel('')]).toEqual(['Endt. Eff Date', 'Endt. Bordx Date', 'Endt. Eff Date'])
    expect(refundParams({ dateBy: 'effective', payor: ' AB - A PAYOR ', dateFrom: '01/07/2021', dateTo: '', printed: 'Y' })).toEqual({
      dateBy: 'effective',
      payor: 'AB - A PAYOR',
      dateFrom: '2021-07-01',
      dateTo: undefined,
      printed: 'Y',
    })
  })
})

describe('Refund Listing list', () => {
  it('shows the status after the name and heads the columns as the desktop did', () => {
    expect([shownName(row()), shownName(row({ status: 'P' })), shownName(row({ status: 'A' }))]).toEqual([
      'A MEMBER (Cancelled)',
      'A MEMBER (Pending)',
      'A MEMBER',
    ])
    expect(refundColumns.map((c) => c.label)).toEqual([
      'Member No',
      'Cover ID',
      'Policy No',
      'Member Name',
      'I/C No',
      'Bordx Date',
      'Eff. Date',
      'Exp. Date',
      'Days Insured',
      'Cancellation Date',
      'Endt. Bordx Date',
      'Days Utilised',
      'Month Utilised',
      'MCO fees Charged',
      'MCO fees Utilised',
      'MCO fees Refund',
      'MCO fees Refund (Min.)',
      'Invoice No',
      'Invoice Date',
      'Remarks',
      'Credit Note',
      'Credit Date',
      'Type',
    ])
  })

  it('formats a line', () => {
    expect(refundColumns.map((c) => c.value(row()))).toEqual([
      'AB1*01',
      '00',
      'P1',
      'A MEMBER (Cancelled)',
      '800101-01-1234',
      '01/07/2021',
      '01/01/2021',
      '31/12/2021',
      '364',
      '01/08/2021',
      '05/08/2021',
      '212',
      '7',
      '100.00',
      '20.00',
      '1,234.50',
      '50.00',
      'INV1',
      '05/01/2021',
      'This member had 2 Case(s)',
      '',
      '',
      'Principal',
    ])
    expect(refundColumns[15].value(row({ mcoRefund: null }))).toBe('0.00')
    expect(refundColumns.at(-1)!.value(row({ kind: 'supplementary' }))).toBe('Supplementary')
  })
})
