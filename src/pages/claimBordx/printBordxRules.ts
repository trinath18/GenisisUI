// Claim Bordx > Print Bordx (legacy FrmPrintBordx, "Print Bordx"): the criteria, the checks, the requests, the columns of the list and the files the reports are written to (the desktop printed a dozen Crystal
// reports through the printer; the web writes the same claims and totals to CSV files). The server repeats the checks, marks the bordx as printed and adds up the summary.

import * as yup from 'yup'
import type { Option } from '../../components/Field'
import type { CsvColumn } from '../../lib/exportCsv'
import { formatMoney } from '../../lib/format'
import { optionalText } from '../../lib/validation'
import { isoToDmy } from '../case/caseShared'

export interface PrintRow {
  planCode: string | null
  insCode: string | null
  caseNo: string
  claimVersion: number
  patientName: string | null
  memberNo: string | null
  hospital: string | null
  payableToHospital: number | null
  totalActual: number | null
  totalApproved: number | null
  payableToMember: number | null
  debitCreditRefNo: string | null
  bordxNo: string | null
  printed: boolean
  healthType: string | null
  payorCode: string | null
  btbg: string | null
  payTo: string | null
  caseMgmtFees: number | null
  totalMgmtFee: number | null
  bordxDate: string | null
  bordxAmount: number | null
}

export interface PrintSearchResult {
  rows: PrintRow[]
  totalAmount: number
  printed: number
  notPrinted: number
  printOption: 'new' | 'reprint'
  truncated: boolean
}

export interface ReportRow {
  bordxNo: string | null
  bordxDate: string | null
  caseNo: string
  claimVersion: number
  patientName: string | null
  memberNo: string | null
  policyNo: string | null
  memberIc: string | null
  patientIc: string | null
  hospital: string | null
  planCode: string | null
  insCode: string | null
  healthType: string | null
  payorCode: string | null
  groupCompany: string | null
  department: string | null
  employeeNo: string | null
  costCenter: string | null
  dateAdmitted: string | null
  dateDischarged: string | null
  icdCode1: string | null
  icdDesc1: string | null
  icdCode2: string | null
  icdDesc2: string | null
  icdCode3: string | null
  icdDesc3: string | null
  totalActual: number | null
  totalApproved: number | null
  payableToHospital: number | null
  payableToMember: number | null
  caseMgmtFees: number | null
  totalMgmtFee: number | null
  bordxAmount: number | null
  debitCreditRefNo: string | null
  payTo: string | null
  btbg: string | null
  printed: boolean
  remarks: string | null
}

export interface SummaryLine {
  bordxNo: string | null
  bordxDate: string | null
  claims: number
  totalActual: number
  totalApproved: number
  payableToHospital: number
  payableToMember: number
  mgmtFee: number
  bordxAmount: number
}

export interface PrintPayor {
  code: string
  name: string | null
  address1: string | null
  address2: string | null
  address3: string | null
  product: string | null
}

export interface PrintDocument {
  kind: 'detail' | 'summary'
  reportType: 'single' | 'multiple'
  btbg: 'N' | 'Y'
  printedDate: string
  bordxFrom: string
  bordxTo: string
  payor: PrintPayor | null
  rows: ReportRow[]
  summary: SummaryLine[]
  marked: boolean
}

export interface PrintValues {
  bordxFrom: string
  bordxTo: string
  reportType: string
  btbg: string
  printOption: string
}

/** CboReportType: one claim to a page, or many. */
export const reportTypeOptions: Option[] = [
  { value: 'single', label: 'Single Claim' },
  { value: 'multiple', label: 'Multiple Claims' },
]

/** cboBTBG: N, Y. */
export const btbgOptions: Option[] = [
  { value: 'N', label: 'N - No' },
  { value: 'Y', label: 'Y - Yes' },
]

/** cboPrintOpt: print the bordx for the first time, or again. */
export const printOptionOptions: Option[] = [
  { value: 'new', label: 'Print New' },
  { value: 'reprint', label: 'Reprint' },
]

export const printDefaults: PrintValues = { bordxFrom: '', bordxTo: '', reportType: 'single', btbg: 'N', printOption: 'new' }

export const printSchema = yup.object({
  bordxFrom: optionalText(),
  bordxTo: optionalText(),
  reportType: optionalText(),
  btbg: optionalText(),
  printOption: optionalText(),
}) as yup.ObjectSchema<PrintValues>

/** CmdSearch_Click's check: both ends of the range. */
export const searchProblem = (v: PrintValues) =>
  v.bordxFrom.trim() === '' || v.bordxTo.trim() === ''
    ? { field: (v.bordxFrom.trim() === '' ? 'bordxFrom' : 'bordxTo') as 'bordxFrom' | 'bordxTo', message: 'Please enter Bordx Reference No' }
    : null

/** The query of the search. */
export const searchParams = (v: PrintValues) => ({ bordxFrom: v.bordxFrom.trim(), bordxTo: v.bordxTo.trim() })

/** The request of a report: detail or summary, and whether it is printed (the detail report then marks the bordx as printed) or only previewed. */
export const printRequest = (v: PrintValues, kind: 'detail' | 'summary', print: boolean) => ({
  ...searchParams(v),
  kind,
  reportType: v.reportType,
  btbg: v.btbg,
  printOption: v.printOption,
  print,
})

const d = (value: string | null) => isoToDmy(value)
const m = (value: number | null) => (value == null ? '' : formatMoney(value))
const status = (r: PrintRow) => (r.printed ? 'YES' : 'NO')

/** The columns of the list, headed as the desktop headed them. */
export const printColumns: CsvColumn<PrintRow>[] = [
  { label: 'Plan Code', value: (r) => r.planCode ?? '' },
  { label: 'Claim No', value: (r) => `${r.caseNo}-${r.claimVersion}` },
  { label: 'Patient Name', value: (r) => r.patientName ?? '' },
  { label: 'Member No', value: (r) => r.memberNo ?? '' },
  { label: 'Hospital', value: (r) => r.hospital ?? '' },
  { label: 'Bordx Amt', value: (r) => m(r.bordxAmount) },
  { label: 'Bill Amt', value: (r) => m(r.totalActual) },
  { label: 'Approve Amt', value: (r) => m(r.totalApproved) },
  { label: 'Recovery Amt', value: (r) => m(r.payableToMember) },
  { label: 'Case Mgmt Fee', value: (r) => m(r.caseMgmtFees) },
  { label: 'Debit Credit Ref No', value: (r) => r.debitCreditRefNo ?? '' },
  { label: 'Bordx No', value: (r) => r.bordxNo ?? '' },
  { label: 'Print Status', value: status },
  { label: 'HLT Code', value: (r) => r.healthType ?? '' },
  { label: 'Payor', value: (r) => r.payorCode ?? '' },
  { label: 'BTBG', value: (r) => (r.btbg === 'Y' ? 'Y' : 'N') },
]

const top = (doc: PrintDocument, title: string): string[][] => [
  [title],
  ['Payor', doc.payor ? `${doc.payor.code} - ${doc.payor.name ?? ''}` : ''],
  [doc.payor?.address1 ?? ''],
  [doc.payor?.address2 ?? ''],
  [doc.payor?.address3 ?? ''],
  ['Product', doc.payor?.product ?? ''],
  [
    'Bordx',
    `${doc.bordxFrom} to ${doc.bordxTo}`,
    'BTBG',
    doc.btbg,
    'Report',
    doc.reportType === 'single' ? 'Single Claim' : 'Multiple Claims',
    'Date',
    d(doc.printedDate),
  ],
  [],
]

/** The detail report: the payor and the range at the top, one line per claim with its member, plan, hospital, diagnoses and amounts, and the totals. */
export function detailRows(doc: PrintDocument): string[][] {
  const sum = (pick: (r: ReportRow) => number | null) => formatMoney(doc.rows.reduce((s, r) => s + (pick(r) ?? 0), 0))
  return [
    ...top(doc, 'Claim Bordx - Detail'),
    [
      'Bordx No',
      'Bordx Date',
      'Claim No',
      'Patient',
      'Patient IC',
      'Member No',
      'Policy No',
      'Group Company',
      'Department',
      'Hospital',
      'Plan',
      'DOA',
      'DOD',
      'ICD',
      'Diagnosis',
      'Actual Amt',
      'Approved Amt',
      'Hosp Amt',
      'Member Amt',
      'Mgmt Fee',
      'Bordx Amt',
      'Debit Credit Ref No',
      'Remarks',
    ],
    ...doc.rows.map((r) => [
      r.bordxNo ?? '',
      d(r.bordxDate),
      `${r.caseNo}-${r.claimVersion}`,
      r.patientName ?? '',
      r.patientIc ?? '',
      r.memberNo ?? '',
      r.policyNo ?? '',
      r.groupCompany ?? '',
      r.department ?? '',
      r.hospital ?? '',
      r.planCode ?? '',
      d(r.dateAdmitted),
      d(r.dateDischarged),
      [r.icdCode1, r.icdCode2, r.icdCode3].filter(Boolean).join('; '),
      [r.icdDesc1, r.icdDesc2, r.icdDesc3].filter(Boolean).join('; '),
      m(r.totalActual),
      m(r.totalApproved),
      m(r.payableToHospital),
      m(r.payableToMember),
      m(r.totalMgmtFee),
      m(r.bordxAmount),
      r.debitCreditRefNo ?? '',
      r.remarks ?? '',
    ]),
    [],
    [
      'Total',
      '',
      String(doc.rows.length),
      '',
      '',
      '',
      '',
      '',
      '',
      '',
      '',
      '',
      '',
      '',
      '',
      sum((r) => r.totalActual),
      sum((r) => r.totalApproved),
      sum((r) => r.payableToHospital),
      sum((r) => r.payableToMember),
      sum((r) => r.totalMgmtFee),
      sum((r) => r.bordxAmount),
    ],
  ]
}

/** The summary report: one line per bordx with its number of claims and amounts, and the totals. */
export function summaryRows(doc: PrintDocument): string[][] {
  const sum = (pick: (s: SummaryLine) => number) => formatMoney(doc.summary.reduce((s, l) => s + pick(l), 0))
  return [
    ...top(doc, 'Claim Bordx - Summary'),
    ['Bordx No', 'Bordx Date', 'Claims', 'Actual Amt', 'Approved Amt', 'Hosp Amt', 'Member Amt', 'Mgmt Fee', 'Bordx Amt'],
    ...doc.summary.map((l) => [
      l.bordxNo ?? '',
      d(l.bordxDate),
      String(l.claims),
      m(l.totalActual),
      m(l.totalApproved),
      m(l.payableToHospital),
      m(l.payableToMember),
      m(l.mgmtFee),
      m(l.bordxAmount),
    ]),
    [],
    [
      'Total',
      '',
      String(doc.summary.reduce((s, l) => s + l.claims, 0)),
      sum((l) => l.totalActual),
      sum((l) => l.totalApproved),
      sum((l) => l.payableToHospital),
      sum((l) => l.payableToMember),
      sum((l) => l.mgmtFee),
      sum((l) => l.bordxAmount),
    ],
  ]
}
