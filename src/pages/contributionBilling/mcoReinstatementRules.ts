// Contribution Billing > MCO Reinstatement (legacy frmMCOInvoiceReinstatement, "MCO Reinstatement Invoice"): the criteria, the checks the desktop made before searching and printing, the query, the
// columns of the list and the files "Print" and "Preview" write (the desktop filled two Excel templates). The server repeats the checks, gives out the invoice number and adds up the counts.

import * as yup from 'yup'
import type { Option } from '../../components/Field'
import type { CsvColumn } from '../../lib/exportCsv'
import { formatMoney } from '../../lib/format'
import { dmyDate, optionalText } from '../../lib/validation'
import { isoDmy, isoToDmy } from '../case/caseShared'

export interface McoRow {
  memberNo: string
  coverId: string | null
  memberName: string | null
  relation: string | null
  adultChild: string | null
  bordxDate: string | null
  batchNo: string | null
  policyNo: string | null
  effDate: string | null
  expDate: string | null
  invoiceNo: string | null
  invoiceDate: string | null
  mcoFee: number | null
  icNo: string | null
  personIc: string | null
  groupCompany: string | null
  daysInsured: number | null
  isCovered: boolean
  payorCode: string | null
}

export interface McoInvoiceLine {
  bordxDate: string | null
  batchNo: number | null
  insCode: string | null
  adultChild: string | null
  principals: number
  coveredPersons: number | null
  mcoFee: number | null
  invoiceNo: string | null
  invoiceDate: string | null
}

export interface McoPayor {
  code: string
  name: string | null
  address1: string | null
  address2: string | null
  address3: string | null
  contact: string | null
  telephone: string | null
  fax: string | null
  prefix: string
}

export interface McoSearchResult {
  rows: McoRow[]
  principals: number
  supplementary: number
  invoices: string[]
  truncated: boolean
}

export interface McoDocument {
  reportType: 'invoice' | 'listing'
  allocated: boolean
  invoiceNo: string | null
  invoiceDate: string | null
  payor: McoPayor | null
  lines: McoInvoiceLine[]
  rows: McoRow[]
}

export interface McoValues {
  criteria: string
  payor: string
  bordxDate: string
  batchNo: string
  invoiceNo: string
  reportType: string
}

/** cboMCOCriteriaSel: the batch of a payor (Bordx Date and Batch No) or an invoice. */
export const criteriaOptions: Option[] = [
  { value: 'batch', label: 'Bordx Date / Batch No' },
  { value: 'invoice', label: 'Invoice No' },
]

/** CboRptType: the invoice (index 0) or the listing of the members. */
export const reportTypeOptions: Option[] = [
  { value: 'invoice', label: 'Invoice' },
  { value: 'listing', label: 'Listing' },
]

export const mcoDefaults: McoValues = { criteria: '', payor: '', bordxDate: '', batchNo: '', invoiceNo: '', reportType: '' }

export const mcoSchema = yup.object({
  criteria: optionalText(),
  payor: optionalText(),
  bordxDate: dmyDate(),
  batchNo: optionalText(),
  invoiceNo: optionalText(),
  reportType: optionalText(),
}) as yup.ObjectSchema<McoValues>

/** cmdMCOSearch_Click's checks, in the desktop's order; null when the search may go ahead. */
export const searchProblem = (v: McoValues) => {
  if (v.criteria.trim() === '') return { field: 'criteria' as const, message: 'Please Enter MCO Criteria!' }
  if (v.criteria === 'batch') {
    if (v.payor.trim() === '') return { field: 'payor' as const, message: 'Please Enter Payor!' }
    if (!isoDmy(v.bordxDate)) return { field: 'bordxDate' as const, message: 'Please Enter Bordereaux Date!' }
    if (v.batchNo.trim() === '') return { field: 'batchNo' as const, message: 'Please Enter Batch No!' }
    if (!/^\d+$/.test(v.batchNo.trim())) return { field: 'batchNo' as const, message: 'Batch No must be a number.' }
  } else if (v.invoiceNo.trim() === '') return { field: 'invoiceNo' as const, message: 'Please Enter Invoice No!' }
  return null
}

/** cmdMCOPrint_Click: a report type, then the search's checks. */
export const printProblem = (v: McoValues) =>
  v.reportType.trim() === '' ? { field: 'reportType' as const, message: 'Please Select Report Type !' } : searchProblem(v)

/** The criteria of the search, as the query. */
export const mcoParams = (v: McoValues) => ({
  criteria: v.criteria,
  payor: v.criteria === 'batch' ? v.payor.trim() : undefined,
  bordxDate: v.criteria === 'batch' ? (isoDmy(v.bordxDate) ?? undefined) : undefined,
  batchNo: v.criteria === 'batch' ? v.batchNo.trim() : undefined,
  invoiceNo: v.criteria === 'invoice' ? v.invoiceNo.trim() : undefined,
})

/** The request of Print and Preview. */
export const printRequest = (v: McoValues, allocate: boolean) => ({ ...mcoParams(v), reportType: v.reportType, allocate })

/** Print on a batch that has no invoice yet gives its members a new invoice number: the screen asks first (the desktop did not). */
export const needsConfirmation = (result: McoSearchResult | null) => result !== null && result.invoices.length === 0

/** The fee as the desktop wrote it: rounded to a whole number. */
export const rounded = (fee: number | null) => Math.round(fee ?? 0)

const d = (value: string | null) => isoToDmy(value)

/** The columns of the list, headed as the desktop headed them. */
export const mcoColumns: CsvColumn<McoRow>[] = [
  { label: 'Member No', value: (r) => r.memberNo },
  { label: 'Cover ID', value: (r) => r.coverId ?? '' },
  { label: 'Member Name', value: (r) => r.memberName ?? '' },
  { label: 'Rel', value: (r) => r.relation ?? '' },
  { label: 'BordxDate', value: (r) => d(r.bordxDate) },
  { label: 'Batch No', value: (r) => r.batchNo ?? '' },
  { label: 'Pol No', value: (r) => r.policyNo ?? '' },
  { label: 'Eff Date', value: (r) => d(r.effDate) },
  { label: 'Exp Date', value: (r) => d(r.expDate) },
  { label: 'Adult/Child', value: (r) => r.adultChild ?? '' },
  { label: 'Invoice No', value: (r) => r.invoiceNo ?? '' },
  { label: 'Invoice Date', value: (r) => d(r.invoiceDate) },
  { label: 'MCOFee', value: (r) => String(rounded(r.mcoFee)) },
]

/** The invoice: the payor and the invoice number and date at the top, one line per bordx batch, insurance code and adult / child, and the total. */
export function invoiceRows(doc: McoDocument): string[][] {
  const p = doc.payor
  const total = doc.lines.reduce((sum, l) => sum + rounded(l.mcoFee), 0)
  return [
    [p?.name ?? ''],
    [p?.address1 ?? ''],
    [p?.address2 ?? ''],
    [p?.address3 ?? ''],
    ['Contact', p?.contact ?? '', 'Tel', p?.telephone ?? '', 'Fax', p?.fax ?? ''],
    ['Invoice No', doc.invoiceNo ?? '', 'Invoice Date', d(doc.invoiceDate)],
    [],
    ['No', 'Bordx Date', 'Batch', 'INS Code', 'Adult/Child', 'Total Principal', 'Total Covered Persons', 'MCO Fee'],
    ...doc.lines.map((l, i) => [
      String(i + 1),
      d(l.bordxDate),
      String(l.batchNo ?? ''),
      l.insCode ?? '',
      l.adultChild ?? '',
      String(l.principals),
      String(l.coveredPersons ?? ''),
      String(rounded(l.mcoFee)),
    ]),
    [],
    ['', '', '', '', '', '', 'Total', String(total)],
  ]
}

/** The listing of the members: the batch and invoice at the top, one line per member and the total of the fees. */
export function listingRows(doc: McoDocument): string[][] {
  const first = doc.rows[0]
  const total = doc.rows.reduce((sum, r) => sum + rounded(r.mcoFee), 0)
  return [
    ['Payor', first?.payorCode ?? '', 'Invoice No', doc.invoiceNo ?? '', 'Invoice Date', d(doc.invoiceDate)],
    ['Bordx Date', d(first?.bordxDate ?? null), 'Batch No', first?.batchNo ?? ''],
    [],
    ['No', 'Member No', 'Policy No', 'Member Name', 'Relation', 'IC No', 'Group Company', 'Days Insured', 'MCO Fee'],
    ...doc.rows.map((r, i) => [
      String(i + 1),
      r.memberNo,
      r.policyNo ?? '',
      r.memberName ?? '',
      r.relation ?? '',
      r.personIc ?? '',
      r.groupCompany ?? '',
      String(r.daysInsured ?? ''),
      String(rounded(r.mcoFee)),
    ]),
    [],
    ['', '', '', '', '', '', '', 'Total', String(total)],
  ]
}

/** The total of the fees of the lines, for the counters. */
export const totalFees = (rows: readonly McoRow[]) => formatMoney(rows.reduce((sum, r) => sum + rounded(r.mcoFee), 0))
