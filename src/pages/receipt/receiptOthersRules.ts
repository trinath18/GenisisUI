// Receipt > Others (legacy FrmReceiptHOS, "Receipt (Others)"): receipts from a hospital (or "OTHER") with their cheque, bank charge and accounting period. Search lists them, Save adds one, Edit then a row loads it for
// Update, Delete removes one. The server repeats the checks.

import * as yup from 'yup'
import { amount, dmyDate, optionalText } from '../../lib/validation'
import { formatMoney } from '../../lib/format'
import { isoDmy, num, parseDmy } from '../case/caseShared'

export interface Hospital {
  code: string
  name: string | null
}

export interface ReceiptRow {
  id: number
  hospitalCode: string | null
  hospitalName: string | null
  receiptNo: string | null
  receiptDate: string | null
  amount: number | null
  bankCharge: number | null
  chequeNo: string | null
  remarks: string | null
  accMonth: number | null
  accYear: number | null
  updatedBy: string | null
  updatedOn: string | null
}

export interface SearchResult {
  rows: ReceiptRow[]
  totalAmount: number
  truncated: boolean
}

export interface SearchValues {
  hospital: string
  noFrom: string
  noTo: string
  blankNo: boolean
  dateFrom: string
  dateTo: string
  blankDate: boolean
  monthFrom: string
  monthTo: string
  blankMonth: boolean
  yearFrom: string
  yearTo: string
  blankYear: boolean
}

export const searchDefaults: SearchValues = {
  hospital: '',
  noFrom: '',
  noTo: '',
  blankNo: false,
  dateFrom: '',
  dateTo: '',
  blankDate: false,
  monthFrom: '',
  monthTo: '',
  blankMonth: false,
  yearFrom: '',
  yearTo: '',
  blankYear: false,
}

export const searchSchema: yup.ObjectSchema<SearchValues> = yup.object({
  hospital: optionalText(),
  noFrom: optionalText().max(30, 'Receipt No is too long.'),
  noTo: optionalText().max(30, 'Receipt No is too long.'),
  blankNo: yup.boolean().default(false),
  dateFrom: dmyDate(),
  dateTo: dmyDate(),
  blankDate: yup.boolean().default(false),
  monthFrom: optionalText(),
  monthTo: optionalText(),
  blankMonth: yup.boolean().default(false),
  yearFrom: optionalText(),
  yearTo: optionalText(),
  blankYear: yup.boolean().default(false),
})

/** The A/C period lists of the desktop: months 1-12 and years 1999-3000. */
export const monthOptions = Array.from({ length: 12 }, (_, i) => ({ value: String(i + 1), label: String(i + 1) }))
export const yearOptions = Array.from({ length: 3000 - 1999 + 1 }, (_, i) => ({ value: String(1999 + i), label: String(1999 + i) }))

export interface EntryValues {
  hospital: string
  receiptNo: string
  receiptDate: string
  amount: string
  bankCharge: string
  chequeNo: string
  accMonth: string
  accYear: string
  remarks: string
}

export const entryDefaults: EntryValues = {
  hospital: '',
  receiptNo: '',
  receiptDate: '',
  amount: '',
  bankCharge: '',
  chequeNo: '',
  accMonth: '',
  accYear: '',
  remarks: '',
}

export const entrySchema: yup.ObjectSchema<EntryValues> = yup.object({
  hospital: optionalText(),
  receiptNo: optionalText().max(30, 'Receipt No is too long.'),
  receiptDate: dmyDate(),
  amount: amount('Enter a valid amount.'),
  bankCharge: amount('Enter a valid amount.'),
  chequeNo: optionalText().max(40, 'Cheque No is too long.'),
  accMonth: optionalText(),
  accYear: optionalText(),
  remarks: optionalText().max(100, 'Remarks is too long.'),
})

type Problem = { field: keyof EntryValues; message: string }

const hospitalCode = (v: string) => v.split(' - ')[0].trim()

/** cmdSave_Click: the boxes in the desktop's order, each with its message. */
export function saveProblem(v: EntryValues): Problem | null {
  if (hospitalCode(v.hospital) === '') return { field: 'hospital', message: 'Please Enter Hospital Code' }
  if (v.receiptNo.trim() === '') return { field: 'receiptNo', message: 'Please Enter Receipt No' }
  if (v.receiptDate.trim() === '') return { field: 'receiptDate', message: 'Please Enter Receipt Date' }
  if (v.amount.trim() === '') return { field: 'amount', message: 'Please Enter Receipt Amount' }
  if (v.chequeNo.trim() === '') return { field: 'chequeNo', message: 'Please Enter Cheque No' }
  return null
}

/** cmdUpdate_Click: its own messages; an invalid date is "Invalid Receipt Date!" and the cheque number is asked for before the amount. */
export function updateProblem(v: EntryValues, selected: ReceiptRow | null): Problem | null {
  if (!selected) return { field: 'hospital', message: 'Please select the record' }
  if (hospitalCode(v.hospital) === '') return { field: 'hospital', message: 'Please Enter Hospital Name!' }
  if (v.receiptNo.trim() === '') return { field: 'receiptNo', message: 'Please Enter Receipt No!' }
  if (v.receiptDate.trim() !== '' && parseDmy(v.receiptDate) === null) return { field: 'receiptDate', message: 'Invalid Receipt Date!' }
  if (v.receiptDate.trim() === '') return { field: 'receiptDate', message: 'Please Enter Receipt Date' }
  if (v.chequeNo.trim() === '') return { field: 'chequeNo', message: 'Please Enter Cheque No!' }
  if (v.amount.trim() === '') return { field: 'amount', message: 'Please Enter Cheque Amt!' }
  return null
}

/** txtReceiptDate_LostFocus: the A/C period follows a valid receipt date. */
export function periodOf(receiptDate: string): { accMonth: string; accYear: string } | null {
  const d = parseDmy(receiptDate)
  return d ? { accMonth: String(d.getMonth() + 1), accYear: String(d.getFullYear()) } : null
}

const t = (v: string) => v.trim() || undefined
const n = (v: string) => (v.trim() === '' ? undefined : Number(v))

/** The query of Search. */
export function searchParams(v: SearchValues) {
  return {
    hospital: t(hospitalCode(v.hospital)),
    noFrom: t(v.noFrom),
    noTo: t(v.noTo),
    blankNo: v.blankNo,
    dateFrom: isoDmy(v.dateFrom) ?? undefined,
    dateTo: isoDmy(v.dateTo) ?? undefined,
    blankDate: v.blankDate,
    monthFrom: n(v.monthFrom),
    monthTo: n(v.monthTo),
    blankMonth: v.blankMonth,
    yearFrom: n(v.yearFrom),
    yearTo: n(v.yearTo),
    blankYear: v.blankYear,
  }
}

/** The body of Save and Update. */
export function entryRequest(v: EntryValues) {
  return {
    hospital: hospitalCode(v.hospital),
    receiptNo: v.receiptNo.trim(),
    receiptDate: isoDmy(v.receiptDate) ?? undefined,
    amount: num(v.amount) ?? undefined,
    bankCharge: num(v.bankCharge) ?? undefined,
    chequeNo: v.chequeNo.trim(),
    accMonth: n(v.accMonth),
    accYear: n(v.accYear),
    remarks: v.remarks.trim(),
  }
}

/** lstReceiptHOS_Click in Edit: the receipt as the boxes show it; a hospital that is not in the list ("OTHER") shows as its code. */
export function entryFromRow(row: ReceiptRow, hospitals: Hospital[]): EntryValues {
  const code = (row.hospitalCode ?? '').trim()
  const known = hospitals.find((h) => h.code === code)
  return {
    hospital: known ? `${known.code} - ${known.name ?? ''}` : code,
    receiptNo: row.receiptNo ?? '',
    receiptDate: row.receiptDate ? row.receiptDate.slice(0, 10).split('-').reverse().join('/') : '',
    amount: row.amount == null ? '' : String(row.amount),
    bankCharge: row.bankCharge == null ? '' : String(row.bankCharge),
    chequeNo: row.chequeNo ?? '',
    accMonth: row.accMonth == null ? '' : String(row.accMonth),
    accYear: row.accYear == null ? '' : String(row.accYear),
    remarks: row.remarks ?? '',
  }
}

export const hospitalOptions = (hospitals: Hospital[]) => hospitals.map((h) => ({ value: `${h.code} - ${h.name ?? ''}`, label: `${h.code} - ${h.name ?? ''}` }))

/** The list as the desktop showed it: an unknown hospital is "Empty", the period is month/year. */
export const receiptColumns: { label: string; right?: boolean; value: (r: ReceiptRow) => string }[] = [
  { label: 'Hospital Name', value: (r) => (r.hospitalName ?? '').trim() || 'Empty' },
  { label: 'Receipt No', value: (r) => r.receiptNo ?? '' },
  { label: 'Receipt Date', value: (r) => (r.receiptDate ? r.receiptDate.slice(0, 10).split('-').reverse().join('/') : '') },
  { label: 'Receipt Amt', right: true, value: (r) => (r.amount == null ? '' : formatMoney(r.amount)) },
  { label: 'Bank Charge', right: true, value: (r) => (r.bankCharge == null ? '' : formatMoney(r.bankCharge)) },
  { label: 'Cheque No', value: (r) => r.chequeNo ?? '' },
  { label: 'A/C Period', value: (r) => (r.accMonth != null || r.accYear != null ? `${r.accMonth ?? ''}/${r.accYear ?? ''}` : '') },
]

export const rowKey = (r: ReceiptRow) => String(r.id)
