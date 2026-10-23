// Invoice > Invoice Tracking (legacy FrmInvoiceTracking2): the types of the server's rows, the criteria form, the query parameters, the columns of each of the five
// reports and the counters above the list, as pure rules the page uses.

import * as yup from 'yup'
import type { GridColumn } from '../../components/DataGrid'
import type { Option } from '../../components/Field'
import type { CsvColumn } from '../../lib/exportCsv'
import { formatMoney } from '../../lib/format'
import { amount, dmyDate } from '../../lib/validation'
import { isoDmy, isoToDmy, num } from '../case/caseShared'

export const noReport = 'Please select a Report.'
export const noRecords = 'Report cannot be printed without any record.'

export interface TrackingDetailRow {
  caseNo: string | null
  version: string | null
  bordxNo: string | null
  bordxDate: string | null
  invoiceNo: string | null
  invoiceDate: string | null
  invoiceAmount: number | null
  regDate: string | null
  doa: string | null
  dod: string | null
  payee: string | null
  groupCompany: string | null
  invoiceRegistered: string | null
  enteredBy: string | null
  stayType: string | null
  payType: string | null
}

export interface TrackingSummaryRow {
  hospitalCode: string | null
  hospital: string | null
  invoiceNo: string | null
  invoiceDate: string | null
  invYear: number | null
  invMonth: number | null
  totalCases: number
  payableToHospital: number | null
  payableToMember: number | null
  invoiceAmount: number | null
}

export interface TrackingResult {
  report: string
  detail: TrackingDetailRow[]
  summary: TrackingSummaryRow[]
  truncated: boolean
}

export const reportOptions: Option[] = [
  { value: '0', label: '0 - Invoice Month (All Hospitals)' },
  { value: '1', label: '1 - Invoice Month (By Hospitals)' },
  { value: '2', label: '2 - General Listing' },
  { value: '3', label: '3 - General Listing (Detail)' },
  { value: '4', label: '4 - Summary (By Hospitals)' },
]
export const stayTypeOptions: Option[] = [
  { value: '0', label: '0 - In-Patient' },
  { value: '1', label: '1 - Out-Patient' },
  { value: '2', label: '2 - Follow-up' },
  { value: '3', label: '3 - Pre-Hospitalisation' },
  { value: '4', label: '4 - Follow-up & Pre-Hospitalisation' },
]
export const payTypeOptions: Option[] = [
  { value: 'C', label: 'C - Cashless' },
  { value: 'R', label: 'R - Reimbursement' },
]
export const payToOptions: Option[] = [
  { value: 'H', label: 'H - Hospital' },
  { value: 'M', label: 'M - Member' },
]

/** Every criterion of the form as text (dates as dd/mm/yyyy), the "is empty" ticks as booleans. */
export interface TrackingValues {
  report: string
  payor: string
  payorEmpty: boolean
  hospitalCode: string
  groupCompany: string
  groupCompanyEmpty: boolean
  invoiceNoFrom: string
  invoiceNoTo: string
  invoiceNoEmpty: boolean
  stayType: string
  payType: string
  versionFrom: string
  versionTo: string
  versionEmpty: boolean
  payTo: string
  payToEmpty: boolean
  bordxFrom: string
  bordxTo: string
  bordxEmpty: boolean
  invoiceDateFrom: string
  invoiceDateTo: string
  invoiceDateEmpty: boolean
  registeredFrom: string
  registeredTo: string
  registeredEmpty: boolean
  amountFrom: string
  amountTo: string
  amountEmpty: boolean
  worksheetFrom: string
  worksheetTo: string
  worksheetEmpty: boolean
  doaFrom: string
  doaTo: string
  doaEmpty: boolean
  dodFrom: string
  dodTo: string
  dodEmpty: boolean
  bordxDateFrom: string
  bordxDateTo: string
  bordxDateEmpty: boolean
}

export const trackingDefaults: TrackingValues = {
  report: '',
  payor: '',
  payorEmpty: false,
  hospitalCode: '',
  groupCompany: '',
  groupCompanyEmpty: false,
  invoiceNoFrom: '',
  invoiceNoTo: '',
  invoiceNoEmpty: false,
  stayType: '',
  payType: '',
  versionFrom: '',
  versionTo: '',
  versionEmpty: false,
  payTo: '',
  payToEmpty: false,
  bordxFrom: '',
  bordxTo: '',
  bordxEmpty: false,
  invoiceDateFrom: '',
  invoiceDateTo: '',
  invoiceDateEmpty: false,
  registeredFrom: '',
  registeredTo: '',
  registeredEmpty: false,
  amountFrom: '',
  amountTo: '',
  amountEmpty: false,
  worksheetFrom: '',
  worksheetTo: '',
  worksheetEmpty: false,
  doaFrom: '',
  doaTo: '',
  doaEmpty: false,
  dodFrom: '',
  dodTo: '',
  dodEmpty: false,
  bordxDateFrom: '',
  bordxDateTo: '',
  bordxDateEmpty: false,
}

const text = () => yup.string().trim().default('')
const flag = () => yup.boolean().default(false)
const whole = yup
  .string()
  .default('')
  .test('whole', 'Enter a whole number.', (v) => !v || /^\d+$/.test(v.trim()))

export const trackingSchema: yup.ObjectSchema<TrackingValues> = yup.object({
  report: yup.string().default('').required(noReport),
  payor: text(),
  payorEmpty: flag(),
  hospitalCode: text(),
  groupCompany: text(),
  groupCompanyEmpty: flag(),
  invoiceNoFrom: text(),
  invoiceNoTo: text(),
  invoiceNoEmpty: flag(),
  stayType: text(),
  payType: text(),
  versionFrom: whole,
  versionTo: whole,
  versionEmpty: flag(),
  payTo: text(),
  payToEmpty: flag(),
  bordxFrom: text(),
  bordxTo: text(),
  bordxEmpty: flag(),
  invoiceDateFrom: dmyDate(),
  invoiceDateTo: dmyDate(),
  invoiceDateEmpty: flag(),
  registeredFrom: dmyDate(),
  registeredTo: dmyDate(),
  registeredEmpty: flag(),
  amountFrom: amount(),
  amountTo: amount(),
  amountEmpty: flag(),
  worksheetFrom: text(),
  worksheetTo: text(),
  worksheetEmpty: flag(),
  doaFrom: dmyDate(),
  doaTo: dmyDate(),
  doaEmpty: flag(),
  dodFrom: dmyDate(),
  dodTo: dmyDate(),
  dodEmpty: flag(),
  bordxDateFrom: dmyDate(),
  bordxDateTo: dmyDate(),
  bordxDateEmpty: flag(),
})

/** The payor is the text before the dash of a "CODE - Name" entry. */
export const payorOf = (value: string): string => {
  const t = value.trim()
  const dash = t.indexOf(' - ')
  return (dash < 0 ? t : t.slice(0, dash)).trim()
}

const text1 = (v: string) => v.trim() || undefined
const date = (v: string) => isoDmy(v) ?? undefined
const when = (v: boolean) => (v ? true : undefined)

/** The query of a search: empty criteria and unticked boxes are left out. */
export const trackingParams = (v: TrackingValues) => ({
  report: v.report.trim(),
  payor: text1(payorOf(v.payor)),
  payorEmpty: when(v.payorEmpty),
  hospitalCode: text1(v.hospitalCode),
  groupCompany: text1(v.groupCompany),
  groupCompanyEmpty: when(v.groupCompanyEmpty),
  invoiceNoFrom: text1(v.invoiceNoFrom),
  invoiceNoTo: text1(v.invoiceNoTo),
  invoiceNoEmpty: when(v.invoiceNoEmpty),
  stayType: text1(v.stayType),
  payType: text1(v.payType),
  versionFrom: text1(v.versionFrom),
  versionTo: text1(v.versionTo),
  versionEmpty: when(v.versionEmpty),
  payTo: text1(v.payTo),
  payToEmpty: when(v.payToEmpty),
  bordxFrom: text1(v.bordxFrom),
  bordxTo: text1(v.bordxTo),
  bordxEmpty: when(v.bordxEmpty),
  invoiceDateFrom: date(v.invoiceDateFrom),
  invoiceDateTo: date(v.invoiceDateTo),
  invoiceDateEmpty: when(v.invoiceDateEmpty),
  registeredFrom: date(v.registeredFrom),
  registeredTo: date(v.registeredTo),
  registeredEmpty: when(v.registeredEmpty),
  amountFrom: num(v.amountFrom) ?? undefined,
  amountTo: num(v.amountTo) ?? undefined,
  amountEmpty: when(v.amountEmpty),
  worksheetFrom: text1(v.worksheetFrom),
  worksheetTo: text1(v.worksheetTo),
  worksheetEmpty: when(v.worksheetEmpty),
  doaFrom: date(v.doaFrom),
  doaTo: date(v.doaTo),
  doaEmpty: when(v.doaEmpty),
  dodFrom: date(v.dodFrom),
  dodTo: date(v.dodTo),
  dodEmpty: when(v.dodEmpty),
  bordxDateFrom: date(v.bordxDateFrom),
  bordxDateTo: date(v.bordxDateTo),
  bordxDateEmpty: when(v.bordxDateEmpty),
})

/** "2021/01": the invoice year and month as the month reports list them. */
export const monthLabel = (year: number | null, month: number | null): string =>
  year == null || month == null ? '' : `${year}/${String(month).padStart(2, '0')}`

const money = (n: number | null) => (n == null ? '' : formatMoney(n))
const day = (v: string | null) => isoToDmy(v)

type Column = GridColumn<TrackingDetailRow & TrackingSummaryRow>

const col = (key: string, label: string, value?: Column['value'], align?: Column['align'], sortBy?: Column['sortBy']): Column => ({
  key,
  label,
  value,
  align,
  sortBy,
})
const amountCol = (key: 'payableToHospital' | 'payableToMember' | 'invoiceAmount', label: string): Column =>
  col(
    key,
    label,
    (r) => money(r[key]),
    'right',
    (r) => r[key] ?? 0,
  )
const dateCol = (key: 'invoiceDate' | 'bordxDate' | 'regDate' | 'doa' | 'dod' | 'invoiceRegistered', label: string): Column =>
  col(
    key,
    label,
    (r) => day(r[key]),
    undefined,
    (r) => r[key] ?? '',
  )

/**
 * The columns of a report as the desktop's list headers had them. Payable2MBM is there with a width of 0 in the desktop (the list never showed it), so it is left out of
 * the grid and kept in the file the list is downloaded as.
 */
export function reportColumns(report: string): { grid: Column[]; file: Column[] } {
  const hosp = [col('hospitalCode', 'Hosp Code'), col('hospital', 'Hospital')]
  const toMember = amountCol('payableToMember', 'Payable2MBM')
  const cases = col(
    'totalCases',
    'Total Cases',
    (r) => r.totalCases,
    'right',
    (r) => r.totalCases,
  )
  const month = col(
    'month',
    'InvMonth',
    (r) => monthLabel(r.invYear, r.invMonth),
    undefined,
    (r) => monthLabel(r.invYear, r.invMonth),
  )
  switch (report) {
    case '0': {
      const grid = [month, cases, amountCol('payableToHospital', 'Payable2Hosp'), amountCol('invoiceAmount', 'Inv Amount')]
      return { grid, file: [month, cases, amountCol('payableToHospital', 'Payable2Hosp'), toMember, amountCol('invoiceAmount', 'Inv Amount')] }
    }
    case '1': {
      const grid = [...hosp, month, cases, amountCol('payableToHospital', 'Payable2Hosp'), amountCol('invoiceAmount', 'Inv Amount')]
      return { grid, file: [...hosp, month, cases, amountCol('payableToHospital', 'Payable2Hosp'), toMember, amountCol('invoiceAmount', 'Inv Amount')] }
    }
    case '2': {
      const head = [...hosp, col('invoiceNo', 'Inv. No'), dateCol('invoiceDate', 'Inv. Date')]
      return {
        grid: [...head, amountCol('payableToHospital', 'Payable2Hosp'), amountCol('invoiceAmount', 'Inv Amount')],
        file: [...head, amountCol('payableToHospital', 'Payable2Hosp'), toMember, amountCol('invoiceAmount', 'Inv Amount')],
      }
    }
    case '4': {
      const grid = [...hosp, cases, amountCol('payableToHospital', 'Payable2Hosp'), amountCol('invoiceAmount', 'Inv Amount')]
      return { grid, file: [...hosp, cases, amountCol('payableToHospital', 'Payable2Hosp'), toMember, amountCol('invoiceAmount', 'Inv Amount')] }
    }
    default: {
      const grid = [
        col('wksNo', 'Worksheet No', (r) => (r.caseNo ? `${r.caseNo}-${r.version ?? ''}` : '')),
        col('bordxNo', 'Bordx No'),
        dateCol('bordxDate', 'Bordx Date'),
        col('invoiceNo', 'Inv. No'),
        dateCol('invoiceDate', 'Inv. Date'),
        amountCol('invoiceAmount', 'Inv Amt'),
        dateCol('regDate', 'DOR'),
        dateCol('doa', 'DOA'),
        dateCol('dod', 'DOD'),
        col('payee', 'Payee'),
        col('groupCompany', 'Group Company'),
        dateCol('invoiceRegistered', 'Inv. Reg'),
        col('enteredBy', 'Inv. Entry By'),
        col('stayType', 'Stay Type'),
        col('payType', 'Pay Type'),
      ]
      return { grid, file: grid }
    }
  }
}

/** The rows of the result in the order of its report. */
export const rowsOf = (result: TrackingResult | null): (TrackingDetailRow & TrackingSummaryRow)[] =>
  ((result?.report === '3' ? result.detail : result?.summary) ?? []) as (TrackingDetailRow & TrackingSummaryRow)[]

/** The counters above the list: rows listed, the cases they stand for (a month or hospital row stands for all of its worksheets) and the invoice amount. */
export function counters(result: TrackingResult | null): { rows: number; cases: number; amount: number } {
  const rows = rowsOf(result)
  const cases = result?.report === '3' ? rows.length : rows.reduce((sum, r) => sum + (r.totalCases ?? 0), 0)
  return { rows: rows.length, cases, amount: rows.reduce((sum, r) => sum + (r.invoiceAmount ?? 0), 0) }
}

export const csvColumnsOf = (report: string): CsvColumn<TrackingDetailRow & TrackingSummaryRow>[] =>
  reportColumns(report).file.map((c) => ({
    label: c.label,
    value: (r) => (c.value ? c.value(r) : (r as unknown as Record<string, string | number | null>)[c.key]),
  }))
