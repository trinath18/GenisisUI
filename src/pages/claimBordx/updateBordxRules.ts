// Claim Bordx > Update Bordx (legacy frmUpdateWS2Bordx, "Update Bordx"): the criteria, the checks the desktop made before updating, the requests and the columns of the list. The server repeats the
// checks, works out the bordx's totals and puts the worksheets into the bordx in one transaction.

import * as yup from 'yup'
import type { Option } from '../../components/Field'
import type { CsvColumn } from '../../lib/exportCsv'
import { formatMoney } from '../../lib/format'
import { dmyDate, optionalText } from '../../lib/validation'
import { isoDmy, isoToDmy } from '../case/caseShared'

export interface UpdateRow {
  payorCode: string | null
  caseNo: string
  claimVersion: number
  totalActual: number | null
  totalApproved: number | null
  payableToHospital: number | null
  payableToMember: number | null
  dateAdmitted: string | null
  dateDischarged: string | null
  patientName: string | null
  hospital: string | null
  groupCompany: string | null
  planCode: string | null
  icdCode: string | null
  claimStatus: string | null
  bordxNo: string | null
}

export interface UpdateSearchResult {
  rows: UpdateRow[]
  totalApproved: number
  truncated: boolean
}

export interface SearchValues {
  payor: string
  amount: string
  unbordxedOnly: boolean
  doaFrom: string
  doaTo: string
  dodFrom: string
  dodTo: string
  caseFrom: string
  caseTo: string
  bordxFrom: string
  bordxTo: string
}

export interface UpdateValues {
  bordxNo: string
  bordxDate: string
  acMonth: string
  acYear: string
  toPayorDate: string
  fromPayorDate: string
  toMnrbDate: string
  fromMnrbDate: string
  receiptNo: string
  receiptDate: string
  chequeAmount: string
  chequeNo: string
}

/** CboAmt: approved amount up to 2000, or above it (the list has no entry for "any": leave it blank). */
export const amountOptions: Option[] = [
  { value: 'le', label: '<= 2000' },
  { value: 'gt', label: '> 2000' },
]

export const searchDefaults: SearchValues = {
  payor: '',
  amount: '',
  unbordxedOnly: true,
  doaFrom: '',
  doaTo: '',
  dodFrom: '',
  dodTo: '',
  caseFrom: '',
  caseTo: '',
  bordxFrom: '',
  bordxTo: '',
}

export const updateDefaults: UpdateValues = {
  bordxNo: '',
  bordxDate: '',
  acMonth: '',
  acYear: '',
  toPayorDate: '',
  fromPayorDate: '',
  toMnrbDate: '',
  fromMnrbDate: '',
  receiptNo: '',
  receiptDate: '',
  chequeAmount: '',
  chequeNo: '',
}

const dates = (...keys: string[]) => Object.fromEntries(keys.map((k) => [k, dmyDate()]))

export const searchSchema = yup.object({
  payor: optionalText(),
  amount: optionalText(),
  unbordxedOnly: yup.boolean().default(true),
  ...dates('doaFrom', 'doaTo', 'dodFrom', 'dodTo'),
  caseFrom: optionalText(),
  caseTo: optionalText(),
  bordxFrom: optionalText(),
  bordxTo: optionalText(),
}) as yup.ObjectSchema<SearchValues>

export const updateSchema = yup.object({
  bordxNo: optionalText(),
  bordxDate: dmyDate(),
  acMonth: optionalText(),
  acYear: optionalText(),
  ...dates('toPayorDate', 'fromPayorDate', 'toMnrbDate', 'fromMnrbDate'),
  receiptNo: optionalText(),
  receiptDate: dmyDate(),
  chequeAmount: optionalText().test('number', 'Cheque Amt is not a number', (v) => !v || !Number.isNaN(Number(v.replace(/,/g, '')))),
  chequeNo: optionalText(),
}) as yup.ObjectSchema<UpdateValues>

const text = (v: string) => v.trim() || undefined
const day = (v: string) => isoDmy(v) ?? undefined

/** The query of the search. */
export const searchParams = (v: SearchValues) => ({
  payor: text(v.payor),
  amount: text(v.amount),
  unbordxedOnly: v.unbordxedOnly,
  doaFrom: day(v.doaFrom),
  doaTo: day(v.doaTo),
  dodFrom: day(v.dodFrom),
  dodTo: day(v.dodTo),
  caseFrom: text(v.caseFrom),
  caseTo: text(v.caseTo),
  bordxFrom: text(v.bordxFrom),
  bordxTo: text(v.bordxTo),
})

/** The key of a worksheet of the list. */
export const rowKey = (r: UpdateRow) => `${r.caseNo}-${r.claimVersion}`

/** lstWorksheetTrackList_ItemCheck: a worksheet that is in a bordx already cannot be ticked (the desktop moved it, leaving the old bordx's totals as they were). */
export const tickProblem = (r: UpdateRow) => (r.bordxNo ? 'Claim has been bordxed!' : null)

/** cmdBordx_Click's checks in the desktop's order; null when the update may go ahead. */
export const updateProblem = (rows: number, ticked: number, v: UpdateValues) => {
  if (rows === 0) return { field: null, message: 'Please select a record before proceeding!' }
  if (ticked === 0) return { field: null, message: 'Please select at least one record to be updated! ' }
  if (v.bordxNo.trim() === '') return { field: 'bordxNo' as const, message: 'Please Enter Bordx No! ' }
  if (!isoDmy(v.bordxDate)) return { field: 'bordxDate' as const, message: 'Please Enter Bordx Date! ' }
  if (v.receiptNo.trim() === '' && (v.receiptDate.trim() !== '' || v.chequeAmount.trim() !== '' || v.chequeNo.trim() !== ''))
    return { field: 'receiptNo' as const, message: 'Please Enter Receipt No!' }
  return null
}

/** The request of the update. */
export const updateRequest = (rows: readonly UpdateRow[], v: UpdateValues) => ({
  claims: rows.map((r) => ({ caseNo: r.caseNo, version: r.claimVersion })),
  bordxNo: v.bordxNo.trim(),
  bordxDate: isoDmy(v.bordxDate),
  acMonth: text(v.acMonth),
  acYear: text(v.acYear),
  toPayorDate: day(v.toPayorDate),
  fromPayorDate: day(v.fromPayorDate),
  toMnrbDate: day(v.toMnrbDate),
  fromMnrbDate: day(v.fromMnrbDate),
  receiptNo: text(v.receiptNo),
  receiptDate: day(v.receiptDate),
  chequeAmount: v.chequeAmount.trim() === '' ? undefined : Number(v.chequeAmount.replace(/,/g, '')),
  chequeNo: text(v.chequeNo),
})

/** The total of the approved amounts of the worksheets. */
export const totalApproved = (rows: readonly UpdateRow[]) => rows.reduce((sum, r) => sum + (r.totalApproved ?? 0), 0)

/** The A/C period boxes: months 1 to 12 and the years around today. */
export const monthOptions: Option[] = Array.from({ length: 12 }, (_, i) => ({ value: String(i + 1), label: String(i + 1) }))
export const yearOptions = (today: Date): Option[] =>
  Array.from({ length: 8 }, (_, i) => String(today.getFullYear() - 5 + i)).map((y) => ({ value: y, label: y }))

const d = (value: string | null) => isoToDmy(value)
const m = (value: number | null) => (value == null ? '' : formatMoney(value))

/** The columns of the list, headed as the desktop headed them. */
export const updateColumns: CsvColumn<UpdateRow>[] = [
  { label: 'Payor', value: (r) => r.payorCode ?? '' },
  { label: 'Case No', value: (r) => r.caseNo },
  { label: 'Claim Version', value: (r) => String(r.claimVersion) },
  { label: 'Wks No', value: rowKey },
  { label: 'Actual Amt', value: (r) => m(r.totalActual) },
  { label: 'App Amt', value: (r) => m(r.totalApproved) },
  { label: 'Hosp Amt', value: (r) => m(r.payableToHospital) },
  { label: 'Member Amt', value: (r) => m(r.payableToMember) },
  { label: 'DOA', value: (r) => d(r.dateAdmitted) },
  { label: 'DOD', value: (r) => d(r.dateDischarged) },
  { label: 'Patient', value: (r) => r.patientName ?? '' },
  { label: 'Hospital', value: (r) => r.hospital ?? '' },
  { label: 'Grp Company', value: (r) => r.groupCompany ?? '' },
  { label: 'Plan Code', value: (r) => r.planCode ?? '' },
  { label: 'ICD Code', value: (r) => r.icdCode ?? '' },
  { label: 'Bordx No', value: (r) => r.bordxNo ?? '' },
]
