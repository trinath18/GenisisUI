import { describe, expect, it } from 'vitest'
import {
  criteriaOptions,
  endorsementCriteriaOptions,
  groupByOptions,
  invoiceColumns,
  invoiceDefaults,
  invoiceParams,
  invoiceRequest,
  invoiceRows,
  listingRows,
  listingVersionOptions,
  needsConfirmation,
  printProblem,
  reportTypeOptions,
  searchProblem,
  versionEnabled,
} from './generateInvoiceRules'
import type { InvoiceDocument, InvoiceRow, InvoiceValues } from './generateInvoiceRules'

const v = (over: Partial<InvoiceValues> = {}): InvoiceValues => ({ ...invoiceDefaults, ...over })
const row = (over: Partial<InvoiceRow> = {}): InvoiceRow =>
  ({
    payorCode: 'WK',
    memberNo: 'WKHA1*03',
    coverId: '02',
    relation: 'H',
    bordxDate: '2021-04-30T00:00:00',
    policyNo: 'P1',
    healthType: 'N',
    batchNo: 2,
    memberName: 'A MEMBER',
    coveredName: 'A SPOUSE',
    groupCompany: 'ACME',
    department: 'D1',
    invoiceNo: null,
    invoiceDate: null,
    planCode: 'BA96',
    insCode: 'H',
    effDate: '2021-05-01T00:00:00',
    expDate: '2022-04-30T00:00:00',
    adultChild: 'Child',
    basicMco: 20,
    mcoFee: 20,
    premium: 5,
    icNo: 'IC1',
    isPrincipal: false,
    ...over,
  }) as InvoiceRow

const doc = (over: Partial<InvoiceDocument> = {}): InvoiceDocument => ({
  reportType: 'invoice',
  listingVersion: 'plain',
  allocated: true,
  invoiceNo: 'S00042',
  invoiceDate: '2026-10-30T00:00:00',
  payor: {
    code: 'WK',
    name: 'A BROKER',
    address1: 'A1',
    address2: 'A2',
    address3: 'A3',
    contact: 'Mr C',
    telephone: '03-1',
    fax: '03-2',
    prefix: 'S',
    thirdParty: true,
  },
  groupBy: 'department',
  lines: [
    { group: 'D1', insCode: 'H', planCode: 'BA96', adultChild: 'Child', principals: 0, members: 2, basicMco: 40, mcoFee: 40 },
    { group: 'D2', insCode: 'F', planCode: 'BA94', adultChild: 'Adult', principals: 1, members: 1, basicMco: 9.5, mcoFee: 10 },
  ],
  rows: [row(), row({ memberNo: 'WKHA2*03', relation: 'P', isPrincipal: true, coverId: '00', mcoFee: 10, basicMco: 9.5, premium: null })],
  ...over,
})

describe('Generate Invoice checks', () => {
  it('has the desktop choices', () => {
    expect(criteriaOptions.map((o) => o.label)).toEqual(['Bordereaux Batch', 'Bordereaux Range', 'Invoice Number'])
    expect(groupByOptions.map((o) => o.label)).toEqual(['By Payor', 'By Department', 'By Group Company'])
    expect(reportTypeOptions.map((o) => o.label)).toEqual(['Invoice', 'Fee Listing'])
    expect(listingVersionOptions.map((o) => o.label)).toEqual(['MCO Listing', 'MCO Listing With Premium'])
    expect([versionEnabled('listing'), versionEnabled('invoice')]).toEqual([true, false])
  })

  it('checks the criteria, the version, the payor, the dates, the batch, the invoice and the group company in order', () => {
    expect(searchProblem(v())?.message).toBe('Please Enter MCO Criteria!')
    expect(searchProblem(v({ criteria: 'batch', listingVersion: '' }))?.message).toBe('Please Enter Leaflet Version !')
    expect(searchProblem(v({ criteria: 'batch' }))?.message).toBe('Please Enter Payor!')
    expect(searchProblem(v({ criteria: 'batch', payor: 'WK' }))?.message).toBe('Please Enter Bordereaux Date!')
    expect(searchProblem(v({ criteria: 'batch', payor: 'WK', bordxDate: '30/04/2021' }))?.message).toBe('Please Enter Batch No!')
    expect(searchProblem(v({ criteria: 'batch', payor: 'WK', bordxDate: '30/04/2021', batchNo: 'x' }))?.message).toBe('Batch No must be a number.')
    expect(searchProblem(v({ criteria: 'batch', payor: 'WK', bordxDate: '30/04/2021', batchNo: '2' }))).toBeNull()
    expect(searchProblem(v({ criteria: 'range', payor: 'WK' }))?.message).toBe('Please Enter Bordereaux Date From!')
    expect(searchProblem(v({ criteria: 'range', payor: 'WK', bordxFrom: '01/04/2021' }))?.message).toBe('Please Enter Bordereaux Date To!')
    expect(searchProblem(v({ criteria: 'invoice' }))?.message).toBe('Please Enter Invoice No!')
    expect(searchProblem(v({ criteria: 'range', payor: 'WK', bordxFrom: '01/04/2021', bordxTo: '30/04/2021', groupBy: 'group' }))?.message).toBe(
      'Please Enter Group Company!',
    )
    expect(searchProblem(v({ criteria: 'invoice', invoiceNo: 'S1', groupBy: 'group' }))).toBeNull()
  })

  it('picks the endorsed members by a range of endorsement bordx dates (Generate Invoice (Endorsement))', () => {
    expect(endorsementCriteriaOptions.map((o) => o.label)).toEqual(['Endorsement Range', 'Invoice Number'])
    expect(searchProblem(v({ criteria: 'endorsement' }))?.message).toBe('Please Enter Payor!')
    expect(searchProblem(v({ criteria: 'endorsement', payor: 'BS' }))?.message).toBe('Please Enter Endorsement Date From!')
    expect(searchProblem(v({ criteria: 'endorsement', payor: 'BS', bordxFrom: '05/08/2021' }))?.message).toBe('Please Enter Endorsement Date To!')
    expect(searchProblem(v({ criteria: 'endorsement', payor: 'BS', bordxFrom: '05/08/2021', bordxTo: '05/08/2021' }))).toBeNull()
    expect(invoiceParams(v({ criteria: 'endorsement', payor: 'BS', bordxFrom: '05/08/2021', bordxTo: '06/08/2021', bordxDate: '01/01/2021' }))).toMatchObject({
      criteria: 'endorsement',
      payor: 'BS',
      bordxFrom: '2021-08-05',
      bordxTo: '2021-08-06',
      bordxDate: undefined,
    })
  })

  it('asks for the report type before it checks the search', () => {
    expect(printProblem(v({ criteria: 'invoice', invoiceNo: 'S1' }))?.message).toBe('Please Select Report Type !')
    expect(printProblem(v({ criteria: 'invoice', invoiceNo: 'S1', reportType: 'invoice' }))).toBeNull()
    expect(printProblem(v({ reportType: 'listing' }))?.message).toBe('Please Enter MCO Criteria!')
  })

  it('sends only the criteria of the chosen search and the allocation switch', () => {
    expect(
      invoiceParams(v({ criteria: 'batch', payor: ' WK - x ', bordxDate: '30/04/2021', batchNo: ' 2 ', invoiceNo: 'ignored', bordxFrom: '01/01/2021' })),
    ).toEqual({
      criteria: 'batch',
      payor: 'WK - x',
      bordxDate: '2021-04-30',
      batchNo: '2',
      bordxFrom: undefined,
      bordxTo: undefined,
      invoiceNo: undefined,
      groupBy: 'payor',
      groupCompany: undefined,
      principalsOnly: false,
    })
    expect(invoiceParams(v({ criteria: 'invoice', invoiceNo: ' S1 ', payor: 'WK', groupBy: 'group', groupCompany: 'ACME' }))).toMatchObject({
      payor: undefined,
      invoiceNo: 'S1',
      groupCompany: undefined,
    })
    expect(
      invoiceParams(
        v({ criteria: 'range', payor: 'WK', bordxFrom: '01/04/2021', bordxTo: '30/04/2021', groupBy: 'group', groupCompany: ' ACME ', principalsOnly: true }),
      ),
    ).toMatchObject({ bordxFrom: '2021-04-01', bordxTo: '2021-04-30', groupCompany: 'ACME', principalsOnly: true })
    expect(invoiceRequest(v({ criteria: 'invoice', invoiceNo: 'S1', reportType: 'listing', listingVersion: 'premium' }), true)).toMatchObject({
      reportType: 'listing',
      listingVersion: 'premium',
      allocate: true,
    })
  })

  it('asks before giving out an invoice number only for members that are not billed', () => {
    const result = (billed: boolean) => ({
      rows: [],
      principals: 0,
      supplementary: 0,
      invoices: [],
      billed,
      multipleInvoices: false,
      feeEmpty: false,
      truncated: false,
    })
    expect([needsConfirmation(null), needsConfirmation(result(false)), needsConfirmation(result(true))]).toEqual([false, true, false])
  })
})

describe('Generate Invoice files', () => {
  it('lists the columns as the desktop did', () => {
    expect(invoiceColumns.map((c) => c.label)).toEqual([
      'Payor',
      'Membership No',
      'CovID',
      'Rel',
      'BordxDate',
      'Policy No',
      'Hlt Type',
      'Batch',
      'Name',
      'Group Company',
      'Invoice No',
      'PlnCode',
      'InsType',
      'EffDate',
      'ExpDate',
      'Adult/Child',
      'BMco',
      'Mco',
    ])
    expect(invoiceColumns.map((c) => c.value(row()))).toEqual([
      'WK',
      'WKHA1*03',
      '02',
      'H',
      '30/04/2021',
      'P1',
      'N',
      '2',
      'A MEMBER',
      'ACME',
      '',
      'BA96',
      'H',
      '01/05/2021',
      '30/04/2022',
      'Child',
      '20.00',
      '20.00',
    ])
  })

  it('writes the invoice with its payor, lines and totals', () => {
    const rows = invoiceRows(doc())
    expect(rows.slice(0, 7)).toEqual([
      ['MCO Invoice (billed through the broker)'],
      ['A BROKER'],
      ['A1'],
      ['A2'],
      ['A3'],
      ['Contact', 'Mr C', 'Tel', '03-1', 'Fax', '03-2'],
      ['Invoice No', 'S00042', 'Invoice Date', '30/10/2026'],
    ])
    expect(rows[8]).toEqual(['Department', 'Ins Code', 'Plan', 'Adult/Child', 'Principals', 'Members', 'Basic MCO', 'MCO Fee'])
    expect(rows[9]).toEqual(['D1', 'H', 'BA96', 'Child', '0', '2', '40.00', '40.00'])
    expect(rows.at(-1)).toEqual(['Total', '', '', '', '1', '3', '49.50', '50.00'])
  })

  it('writes the fee listing with the premium only in the premium version', () => {
    const plain = listingRows(doc({ reportType: 'listing' }))
    expect(plain[8]).toHaveLength(17)
    expect(plain[9]).toEqual([
      '1',
      'WKHA1*03',
      '02',
      'H',
      'A MEMBER',
      'A SPOUSE',
      'IC1',
      'P1',
      'ACME',
      'D1',
      'H',
      'BA96',
      '01/05/2021',
      '30/04/2022',
      'Child',
      '20.00',
      '20.00',
    ])
    expect(plain[10][5]).toBe('')
    expect(plain.at(-1)).toEqual(['Total', '2', ...Array(14).fill(''), '29.50', '30.00'])
    const premium = listingRows(doc({ reportType: 'listing', listingVersion: 'premium' }))
    expect(premium[8].at(-1)).toBe('Premium')
    expect(premium[9].at(-1)).toBe('5.00')
    expect(premium.at(-1)!.at(-1)).toBe('5.00')
  })
})
