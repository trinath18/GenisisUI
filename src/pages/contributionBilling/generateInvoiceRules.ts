// Contribution Billing > Generate Invoice (legacy frmMCOFeesListingNew, "Member MCO Fees"): the criteria, the checks the desktop made before searching and printing, the queries, the columns of the list and the
// files "Print" and "Preview" write (the desktop printed Crystal reports). The server repeats the checks, gives out the invoice number and works out the lines.

import * as yup from 'yup'
import type { Option } from '../../components/Field'
import type { CsvColumn } from '../../lib/exportCsv'
import { formatMoney } from '../../lib/format'
import { dmyDate, optionalText } from '../../lib/validation'
import { isoDmy, isoToDmy } from '../case/caseShared'

export interface InvoiceRow {
  payorCode: string | null
  memberNo: string
  coverId: string | null
  relation: string | null
  bordxDate: string | null
  policyNo: string | null
  healthType: string | null
  batchNo: number | null
  memberName: string | null
  coveredName: string | null
  groupCompany: string | null
  department: string | null
  invoiceNo: string | null
  invoiceDate: string | null
  planCode: string | null
  insCode: string | null
  effDate: string | null
  expDate: string | null
  adultChild: string | null
  basicMco: number | null
  mcoFee: number | null
  premium: number | null
  icNo: string | null
  isPrincipal: boolean
}

export interface InvoiceSearchResult {
  rows: InvoiceRow[]
  principals: number
  supplementary: number
  invoices: string[]
  billed: boolean
  multipleInvoices: boolean
  feeEmpty: boolean
  truncated: boolean
}

export interface InvoicePayor {
  code: string
  name: string | null
  address1: string | null
  address2: string | null
  address3: string | null
  contact: string | null
  telephone: string | null
  fax: string | null
  prefix: string
  thirdParty: boolean
}

export interface InvoiceLine {
  group: string | null
  insCode: string | null
  planCode: string | null
  adultChild: string | null
  principals: number
  members: number
  basicMco: number
  mcoFee: number
}

export interface InvoiceDocument {
  reportType: 'invoice' | 'listing'
  listingVersion: 'plain' | 'premium'
  allocated: boolean
  invoiceNo: string | null
  invoiceDate: string | null
  payor: InvoicePayor | null
  groupBy: string
  lines: InvoiceLine[]
  rows: InvoiceRow[]
}

export interface InvoiceValues {
  criteria: string
  payor: string
  bordxDate: string
  batchNo: string
  bordxFrom: string
  bordxTo: string
  invoiceNo: string
  groupBy: string
  groupCompany: string
  principalsOnly: boolean
  reportType: string
  listingVersion: string
}

/** cboMCOCriteriaSel: Bordereaux Batch, Bordereaux Range, Invoice Number (the "- Principal" entries are the box below). */
export const criteriaOptions: Option[] = [
  { value: 'batch', label: 'Bordereaux Batch' },
  { value: 'range', label: 'Bordereaux Range' },
  { value: 'invoice', label: 'Invoice Number' },
]

/** OptPayor, OptByDept, OptGrpCom. */
export const groupByOptions: Option[] = [
  { value: 'payor', label: 'By Payor' },
  { value: 'department', label: 'By Department' },
  { value: 'group', label: 'By Group Company' },
]

/** CboRptType: Invoice, Fee Listing. */
export const reportTypeOptions: Option[] = [
  { value: 'invoice', label: 'Invoice' },
  { value: 'listing', label: 'Fee Listing' },
]

/** cboMCOListingVer: MCO Listing, MCO Listing With Premium. */
export const listingVersionOptions: Option[] = [
  { value: 'plain', label: 'MCO Listing' },
  { value: 'premium', label: 'MCO Listing With Premium' },
]

export const invoiceDefaults: InvoiceValues = {
  criteria: '',
  payor: '',
  bordxDate: '',
  batchNo: '',
  bordxFrom: '',
  bordxTo: '',
  invoiceNo: '',
  groupBy: 'payor',
  groupCompany: '',
  principalsOnly: false,
  reportType: '',
  listingVersion: 'plain',
}

export const invoiceSchema = yup.object({
  criteria: optionalText(),
  payor: optionalText(),
  bordxDate: dmyDate(),
  batchNo: optionalText(),
  bordxFrom: dmyDate(),
  bordxTo: dmyDate(),
  invoiceNo: optionalText(),
  groupBy: optionalText(),
  groupCompany: optionalText(),
  principalsOnly: yup.boolean().default(false),
  reportType: optionalText(),
  listingVersion: optionalText(),
}) as yup.ObjectSchema<InvoiceValues>

/** cmdMCOSearch_Click's checks, in the desktop's order; null when the search may go ahead. */
export const searchProblem = (v: InvoiceValues) => {
  if (v.criteria.trim() === '') return { field: 'criteria' as const, message: 'Please Enter MCO Criteria!' }
  if (v.listingVersion.trim() === '') return { field: 'listingVersion' as const, message: 'Please Enter Leaflet Version !' }
  if (v.criteria === 'batch') {
    if (v.payor.trim() === '') return { field: 'payor' as const, message: 'Please Enter Payor!' }
    if (!isoDmy(v.bordxDate)) return { field: 'bordxDate' as const, message: 'Please Enter Bordereaux Date!' }
    if (v.batchNo.trim() === '') return { field: 'batchNo' as const, message: 'Please Enter Batch No!' }
    if (!/^\d+$/.test(v.batchNo.trim())) return { field: 'batchNo' as const, message: 'Batch No must be a number.' }
  } else if (v.criteria === 'range') {
    if (v.payor.trim() === '') return { field: 'payor' as const, message: 'Please Enter Payor!' }
    if (!isoDmy(v.bordxFrom)) return { field: 'bordxFrom' as const, message: 'Please Enter Bordereaux Date From!' }
    if (!isoDmy(v.bordxTo)) return { field: 'bordxTo' as const, message: 'Please Enter Bordereaux Date To!' }
  } else if (v.invoiceNo.trim() === '') return { field: 'invoiceNo' as const, message: 'Please Enter Invoice No!' }
  if (v.groupBy === 'group' && v.criteria !== 'invoice' && v.groupCompany.trim() === '')
    return { field: 'groupCompany' as const, message: 'Please Enter Group Company!' }
  return null
}

/** cmdMCOPrint_Click: a report type, then the search's checks. */
export const printProblem = (v: InvoiceValues) =>
  v.reportType.trim() === '' ? { field: 'reportType' as const, message: 'Please Select Report Type !' } : searchProblem(v)

const text = (value: string) => value.trim() || undefined

/** The query of the search. */
export const invoiceParams = (v: InvoiceValues) => ({
  criteria: v.criteria,
  payor: v.criteria === 'invoice' ? undefined : text(v.payor),
  bordxDate: v.criteria === 'batch' ? (isoDmy(v.bordxDate) ?? undefined) : undefined,
  batchNo: v.criteria === 'batch' ? text(v.batchNo) : undefined,
  bordxFrom: v.criteria === 'range' ? (isoDmy(v.bordxFrom) ?? undefined) : undefined,
  bordxTo: v.criteria === 'range' ? (isoDmy(v.bordxTo) ?? undefined) : undefined,
  invoiceNo: v.criteria === 'invoice' ? text(v.invoiceNo) : undefined,
  groupBy: v.groupBy,
  groupCompany: v.groupBy === 'group' && v.criteria !== 'invoice' ? text(v.groupCompany) : undefined,
  principalsOnly: v.principalsOnly,
})

/** The request of Print and Preview. */
export const invoiceRequest = (v: InvoiceValues, allocate: boolean) => ({
  ...invoiceParams(v),
  reportType: v.reportType,
  listingVersion: v.listingVersion,
  allocate,
})

/** Print on members with no invoice gives them a new invoice number: the screen asks first (the desktop did not). */
export const needsConfirmation = (result: InvoiceSearchResult | null) => result !== null && !result.billed

/** The Fee Listing report type is the one that offers the listing versions (CboRptType_Click). */
export const versionEnabled = (reportType: string) => reportType === 'listing'

const d = (value: string | null) => isoToDmy(value)
const m = (value: number | null) => (value == null ? '' : formatMoney(value))

/** The columns of the list, headed as the desktop headed them. */
export const invoiceColumns: CsvColumn<InvoiceRow>[] = [
  { label: 'Payor', value: (r) => r.payorCode ?? '' },
  { label: 'Membership No', value: (r) => r.memberNo },
  { label: 'CovID', value: (r) => r.coverId ?? '' },
  { label: 'Rel', value: (r) => r.relation ?? '' },
  { label: 'BordxDate', value: (r) => d(r.bordxDate) },
  { label: 'Policy No', value: (r) => r.policyNo ?? '' },
  { label: 'Hlt Type', value: (r) => r.healthType ?? '' },
  { label: 'Batch', value: (r) => (r.batchNo == null ? '' : String(r.batchNo)) },
  { label: 'Name', value: (r) => r.memberName ?? '' },
  { label: 'Group Company', value: (r) => r.groupCompany ?? '' },
  { label: 'Invoice No', value: (r) => r.invoiceNo ?? '' },
  { label: 'PlnCode', value: (r) => r.planCode ?? '' },
  { label: 'InsType', value: (r) => r.insCode ?? '' },
  { label: 'EffDate', value: (r) => d(r.effDate) },
  { label: 'ExpDate', value: (r) => d(r.expDate) },
  { label: 'Adult/Child', value: (r) => r.adultChild ?? '' },
  { label: 'BMco', value: (r) => m(r.basicMco) },
  { label: 'Mco', value: (r) => m(r.mcoFee) },
]

const top = (doc: InvoiceDocument, title: string): string[][] => {
  const p = doc.payor
  return [
    [title],
    [p?.name ?? ''],
    [p?.address1 ?? ''],
    [p?.address2 ?? ''],
    [p?.address3 ?? ''],
    ['Contact', p?.contact ?? '', 'Tel', p?.telephone ?? '', 'Fax', p?.fax ?? ''],
    ['Invoice No', doc.invoiceNo ?? '', 'Invoice Date', d(doc.invoiceDate)],
    [],
  ]
}

/** The invoice: the payor (or its broker) and the invoice number and date at the top, one line per group, insurance code, plan and adult / child, and the totals. */
export function invoiceRows(doc: InvoiceDocument): string[][] {
  const sum = (pick: (l: InvoiceLine) => number) => doc.lines.reduce((s, l) => s + pick(l), 0)
  return [
    ...top(doc, doc.payor?.thirdParty ? 'MCO Invoice (billed through the broker)' : 'MCO Invoice'),
    [
      doc.groupBy === 'department' ? 'Department' : doc.groupBy === 'group' ? 'Group Company' : 'Payor',
      'Ins Code',
      'Plan',
      'Adult/Child',
      'Principals',
      'Members',
      'Basic MCO',
      'MCO Fee',
    ],
    ...doc.lines.map((l) => [
      l.group ?? doc.payor?.name ?? '',
      l.insCode ?? '',
      l.planCode ?? '',
      l.adultChild ?? '',
      String(l.principals),
      String(l.members),
      m(l.basicMco),
      m(l.mcoFee),
    ]),
    [],
    ['Total', '', '', '', String(sum((l) => l.principals)), String(sum((l) => l.members)), m(sum((l) => l.basicMco)), m(sum((l) => l.mcoFee))],
  ]
}

/** The fee listing: the payor and the invoice at the top, one line per member and covered person (with the premium for the "With Premium" version), and the totals. */
export function listingRows(doc: InvoiceDocument): string[][] {
  const premium = doc.listingVersion === 'premium'
  const fee = doc.rows.reduce((s, r) => s + (r.mcoFee ?? 0), 0)
  return [
    ...top(doc, premium ? 'MCO Listing With Premium' : 'MCO Listing'),
    [
      'No',
      'Membership No',
      'CovID',
      'Rel',
      'Name',
      'Covered Person',
      'IC No',
      'Policy No',
      'Group Company',
      'Department',
      'Ins Code',
      'Plan',
      'Eff Date',
      'Exp Date',
      'Adult/Child',
      'Basic MCO',
      'MCO Fee',
      ...(premium ? ['Premium'] : []),
    ],
    ...doc.rows.map((r, i) => [
      String(i + 1),
      r.memberNo,
      r.coverId ?? '',
      r.relation ?? '',
      r.memberName ?? '',
      r.isPrincipal ? '' : (r.coveredName ?? ''),
      r.icNo ?? '',
      r.policyNo ?? '',
      r.groupCompany ?? '',
      r.department ?? '',
      r.insCode ?? '',
      r.planCode ?? '',
      d(r.effDate),
      d(r.expDate),
      r.adultChild ?? '',
      m(r.basicMco),
      m(r.mcoFee),
      ...(premium ? [m(r.premium)] : []),
    ]),
    [],
    [
      'Total',
      String(doc.rows.length),
      ...Array(14).fill(''),
      m(doc.rows.reduce((s, r) => s + (r.basicMco ?? 0), 0)),
      m(fee),
      ...(premium ? [m(doc.rows.reduce((s, r) => s + (r.premium ?? 0), 0))] : []),
    ],
  ]
}
