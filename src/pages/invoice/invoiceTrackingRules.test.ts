import { describe, expect, it } from 'vitest'
import { toCsv } from '../../lib/exportCsv'
import {
  counters,
  csvColumnsOf,
  monthLabel,
  payorOf,
  reportColumns,
  reportOptions,
  rowsOf,
  trackingDefaults,
  trackingParams,
  trackingSchema,
} from './invoiceTrackingRules'
import type { TrackingDetailRow, TrackingResult, TrackingSummaryRow, TrackingValues } from './invoiceTrackingRules'

const values = (over: Partial<TrackingValues> = {}): TrackingValues => ({ ...trackingDefaults, report: '3', ...over })

const summaryRow = (over: Partial<TrackingSummaryRow> = {}): TrackingSummaryRow => ({
  hospitalCode: 'KBARU',
  hospital: 'AL-ISLAM SPECIALIST HOSPITAL',
  invoiceNo: null,
  invoiceDate: null,
  invYear: 2021,
  invMonth: 1,
  totalCases: 3,
  payableToHospital: 1000,
  payableToMember: 250.5,
  invoiceAmount: 2000,
  ...over,
})

const detailRow = (over: Partial<TrackingDetailRow> = {}): TrackingDetailRow => ({
  caseNo: 'XI00002412',
  version: '2',
  bordxNo: 'NXI0000785',
  bordxDate: '2021-03-17T00:00:00',
  invoiceNo: 'CN-1',
  invoiceDate: '2021-01-01T00:00:00',
  invoiceAmount: 250.5,
  regDate: '2021-03-16T18:00:56',
  doa: '2020-12-30T00:00:00',
  dod: '2021-01-01T00:00:00',
  payee: 'MEMBER',
  groupCompany: 'AXALIFE',
  invoiceRegistered: '2021-03-17T00:00:00',
  enteredBy: 'EUMI',
  stayType: 'I',
  payType: 'R',
  ...over,
})

describe('the criteria form', () => {
  it('needs a report, with the desktop message', () => {
    expect(() => trackingSchema.validateSync(trackingDefaults)).toThrow('Please select a Report.')
    expect(trackingSchema.isValidSync(values())).toBe(true)
  })

  it('checks dates, amounts and versions', () => {
    expect(trackingSchema.isValidSync(values({ invoiceDateFrom: '31/02/2021' }))).toBe(false)
    expect(trackingSchema.isValidSync(values({ amountTo: 'abc' }))).toBe(false)
    expect(trackingSchema.isValidSync(values({ versionFrom: '1.5' }))).toBe(false)
    expect(trackingSchema.isValidSync(values({ versionFrom: '2', versionTo: '5', amountFrom: '100.50', doaFrom: '01/01/2021' }))).toBe(true)
  })

  it('sends only the criteria that were given', () => {
    expect(trackingParams(values())).toEqual(expect.objectContaining({ report: '3' }))
    const params = trackingParams(
      values({
        payor: 'XI - XYZ',
        invoiceDateFrom: '01/01/2021',
        amountFrom: '1,000.50',
        stayType: '4',
        versionTo: '3',
        invoiceNoEmpty: true,
        bordxEmpty: false,
      }),
    )
    expect(params).toMatchObject({ payor: 'XI', invoiceDateFrom: '2021-01-01', amountFrom: 1000.5, stayType: '4', versionTo: '3', invoiceNoEmpty: true })
    expect(params.bordxEmpty).toBeUndefined()
    expect(params.hospitalCode).toBeUndefined()
  })

  it('takes the payor from the text before the dash', () => {
    expect(payorOf('AY - AXA LIFE')).toBe('AY')
    expect(payorOf('AY')).toBe('AY')
  })
})

describe('reportColumns', () => {
  const labels = (report: string) => reportColumns(report).grid.map((c) => c.label)

  it('has the desktop headers of each report', () => {
    expect(labels('0')).toEqual(['InvMonth', 'Total Cases', 'Payable2Hosp', 'Inv Amount'])
    expect(labels('1')).toEqual(['Hosp Code', 'Hospital', 'InvMonth', 'Total Cases', 'Payable2Hosp', 'Inv Amount'])
    expect(labels('2')).toEqual(['Hosp Code', 'Hospital', 'Inv. No', 'Inv. Date', 'Payable2Hosp', 'Inv Amount'])
    expect(labels('4')).toEqual(['Hosp Code', 'Hospital', 'Total Cases', 'Payable2Hosp', 'Inv Amount'])
    expect(labels('3')).toEqual([
      'Worksheet No',
      'Bordx No',
      'Bordx Date',
      'Inv. No',
      'Inv. Date',
      'Inv Amt',
      'DOR',
      'DOA',
      'DOD',
      'Payee',
      'Group Company',
      'Inv. Reg',
      'Inv. Entry By',
      'Stay Type',
      'Pay Type',
    ])
  })

  it('keeps Payable2MBM, which the desktop hid, in the file and out of the grid', () => {
    for (const report of ['0', '1', '2', '4']) {
      expect(reportColumns(report).grid.map((c) => c.label)).not.toContain('Payable2MBM')
      expect(reportColumns(report).file.map((c) => c.label)).toContain('Payable2MBM')
    }
    expect(reportColumns('3').file).toHaveLength(15)
  })

  it('offers the five reports', () => expect(reportOptions.map((o) => o.value)).toEqual(['0', '1', '2', '3', '4']))
})

describe('the rows as the list shows them', () => {
  it('writes the month as year/month', () => {
    expect(monthLabel(2021, 1)).toBe('2021/01')
    expect(monthLabel(2021, 12)).toBe('2021/12')
    expect(monthLabel(null, 3)).toBe('')
  })

  it('formats a month row and a detail row', () => {
    const row = summaryRow()
    const cells = reportColumns('1').grid.map((c) => (c.value ? c.value(row as TrackingDetailRow & TrackingSummaryRow) : ''))
    expect(cells.slice(2)).toEqual(['2021/01', 3, '1,000.00', '2,000.00'])
    const detail = detailRow() as TrackingDetailRow & TrackingSummaryRow
    const text = reportColumns('3').grid.map((c) => String(c.value ? c.value(detail) : ((detail as unknown as Record<string, unknown>)[c.key] ?? '')))
    expect(text.slice(0, 6)).toEqual(['XI00002412-2', 'NXI0000785', '17/03/2021', 'CN-1', '01/01/2021', '250.50'])
  })

  it('shows no worksheet number for a case row without one', () => {
    const cell = reportColumns('3').grid[0].value!({ ...detailRow({ caseNo: null }) } as TrackingDetailRow & TrackingSummaryRow)
    expect(cell).toBe('')
  })

  it('exports every column including Payable2MBM', () => {
    const csv = toCsv(csvColumnsOf('0'), [summaryRow() as TrackingDetailRow & TrackingSummaryRow])
    expect(csv.split('\r\n')).toEqual(['InvMonth,Total Cases,Payable2Hosp,Payable2MBM,Inv Amount', '2021/01,3,"1,000.00",250.50,"2,000.00"'])
  })
})

describe('counters and rowsOf', () => {
  const summary: TrackingResult = {
    report: '0',
    detail: [],
    summary: [summaryRow({ totalCases: 3, invoiceAmount: 100 }), summaryRow({ totalCases: 4, invoiceAmount: 50.5 })],
    truncated: false,
  }
  const detail: TrackingResult = { report: '3', detail: [detailRow(), detailRow({ invoiceAmount: null })], summary: [], truncated: false }

  it('count the cases a month or hospital row stands for, and the rows of the detail', () => {
    expect(counters(summary)).toEqual({ rows: 2, cases: 7, amount: 150.5 })
    expect(counters(detail)).toEqual({ rows: 2, cases: 2, amount: 250.5 })
    expect(counters(null)).toEqual({ rows: 0, cases: 0, amount: 0 })
  })

  it('take the rows of the report that was run', () => {
    expect(rowsOf(summary)).toHaveLength(2)
    expect(rowsOf(detail)).toHaveLength(2)
    expect(rowsOf(null)).toEqual([])
  })
})
