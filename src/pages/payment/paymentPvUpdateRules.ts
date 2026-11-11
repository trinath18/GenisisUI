// Payment > PV Update (Manual) (legacy FrmPaymentManual; rebuilt, its source is missing): find a PV written to a hospital or a member and correct its cheque number and date, payment mode, the
// payee's bank and account (and, for a member, the payee) and the remark, on every row of the PV. A PV posted to SUN or a stopped member cheque is refused by the server.

import * as yup from 'yup'
import type { Option } from '../../components/Field'
import type { CsvColumn } from '../../lib/exportCsv'
import { formatMoney } from '../../lib/format'
import { dmyDate, optionalText, requiredDmyDate } from '../../lib/validation'
import { isoDmy, isoToDmy } from '../case/caseShared'

export type Source = 'hospital' | 'member'

export const sourceOptions: Option[] = [
  { value: 'hospital', label: 'To Hospital' },
  { value: 'member', label: 'To Member' },
]

export interface PvListRow {
  pvNo: string
  pvDate: string | null
  payTo: string | null
  amount: number | null
  claims: number
  chequeNo: string | null
  paymentMode: string | null
  status: string | null
  sunNo: string | null
}

export interface PvListResult {
  rows: PvListRow[]
  truncated: boolean
}

export interface PvRow {
  id: number
  pvNo: string | null
  pvDate: string | null
  caseNo: string | null
  claimVersion: string | null
  paid: number | null
  amount: number | null
  chequeNo: string | null
  chequeDate: string | null
  paymentMode: string | null
  payTo: string | null
  bank: string | null
  account: string | null
  remark: string | null
  status: string | null
  sunNo: string | null
  accMonth: string | null
  accYear: string | null
}

export interface PvDetail {
  source: Source
  pvNo: string
  rows: PvRow[]
}

export interface SearchValues {
  source: Source
  pvNo: string
  caseNo: string
  dateFrom: string
  dateTo: string
}

export interface EditValues {
  paymentMode: 'ONLINE' | 'CHEQUE'
  chequeNo: string
  chequeDate: string
  payTo: string
  bank: string
  account: string
  remark: string
}

export const searchDefaults: SearchValues = { source: 'hospital', pvNo: '', caseNo: '', dateFrom: '', dateTo: '' }

export const editDefaults: EditValues = { paymentMode: 'CHEQUE', chequeNo: '', chequeDate: '', payTo: '', bank: '', account: '', remark: '' }

export const searchSchema = yup.object({
  source: yup.mixed<Source>().oneOf(['hospital', 'member']).required(),
  pvNo: optionalText(),
  caseNo: optionalText(),
  dateFrom: dmyDate(),
  dateTo: dmyDate().test('order', 'PV Date From cannot be later than PV Date To.', function (to) {
    const from = isoDmy(this.parent.dateFrom as string)
    const until = isoDmy(to ?? '')
    return !from || !until || from <= until
  }),
}) as yup.ObjectSchema<SearchValues>

export const editSchema = yup.object({
  paymentMode: yup.mixed<'ONLINE' | 'CHEQUE'>().oneOf(['ONLINE', 'CHEQUE']).required(),
  chequeDate: requiredDmyDate('Please enter the Cheque Date.'),
  chequeNo: optionalText().when('paymentMode', {
    is: 'CHEQUE',
    then: (s) => s.required('Please enter the Cheque No.').max(40, 'The Cheque No is too long.'),
  }),
  payTo: optionalText().max(120, 'Pay To is too long (120 characters at most).'),
  bank: optionalText().max(100, 'The bank is too long (100 characters at most).'),
  account: optionalText().max(60, 'The account number is too long (60 characters at most).'),
  remark: optionalText().max(400, 'The remark is too long (400 characters at most).'),
}) as yup.ObjectSchema<EditValues>

const text = (v: string) => v.trim() || undefined

export const searchParams = (v: SearchValues) => ({
  source: v.source,
  pvNo: text(v.pvNo),
  caseNo: text(v.caseNo),
  dateFrom: isoDmy(v.dateFrom) ?? undefined,
  dateTo: isoDmy(v.dateTo) ?? undefined,
})

/** Why the PV cannot be changed (null when it can). */
export function lockReason(detail: PvDetail): string | null {
  if (detail.rows.some((r) => r.sunNo)) return `PV ${detail.pvNo} has been posted to SUN and cannot be changed.`
  if (detail.source === 'member' && detail.rows.some((r) => r.status === 'C' || r.status === 'E'))
    return `PV ${detail.pvNo} has been stopped (cancelled or expired) and cannot be changed.`
  return null
}

/** The PV's details as written on its first row. */
export function editValuesOf(detail: PvDetail): EditValues {
  const r = detail.rows[0]
  return {
    paymentMode: r?.paymentMode?.toUpperCase() === 'ONLINE' ? 'ONLINE' : 'CHEQUE',
    chequeNo: r?.chequeNo ?? '',
    chequeDate: isoToDmy(r?.chequeDate),
    payTo: r?.payTo ?? '',
    bank: r?.bank ?? '',
    account: r?.account ?? '',
    remark: r?.remark ?? '',
  }
}

/** An online payment's cheque number is its date as ddMMyyyy, as the payment screens write it. */
export const onlineChequeNo = (chequeDate: string) => chequeDate.replaceAll('/', '')

const chequeOf = (v: EditValues) => (v.paymentMode === 'ONLINE' ? onlineChequeNo(v.chequeDate) : v.chequeNo.trim())

export const saveBody = (detail: PvDetail, v: EditValues) => ({
  source: detail.source,
  pvNo: detail.pvNo,
  paymentMode: v.paymentMode,
  chequeNo: chequeOf(v),
  chequeDate: isoDmy(v.chequeDate),
  payTo: detail.source === 'member' ? text(v.payTo) : undefined,
  bank: text(v.bank),
  account: text(v.account),
  remark: text(v.remark),
})

export const confirmText = (detail: PvDetail, v: EditValues) =>
  `Save the changes on the ${detail.rows.length} row(s) of PV ${detail.pvNo}, paid by ${v.paymentMode} ${chequeOf(v)} on ${v.chequeDate}?`

const m = (v: number | null) => (v == null ? '' : formatMoney(v))

export const listColumns: (CsvColumn<PvListRow> & { right?: boolean })[] = [
  { label: 'PV No', value: (r) => r.pvNo },
  { label: 'PV Date', value: (r) => isoToDmy(r.pvDate) },
  { label: 'Pay To', value: (r) => r.payTo ?? '' },
  { label: 'Amount', value: (r) => m(r.amount), right: true },
  { label: 'Claims', value: (r) => String(r.claims), right: true },
  { label: 'Cheque No', value: (r) => r.chequeNo ?? '' },
  { label: 'Mode', value: (r) => r.paymentMode ?? '' },
  { label: 'Status', value: (r) => r.status ?? '' },
  { label: 'SUN No', value: (r) => r.sunNo ?? '' },
]

export const rowColumns: (CsvColumn<PvRow> & { right?: boolean })[] = [
  { label: 'Claim No', value: (r) => `${r.caseNo ?? ''}-${r.claimVersion ?? ''}` },
  { label: 'Paid', value: (r) => m(r.paid), right: true },
  { label: 'Cheque No', value: (r) => r.chequeNo ?? '' },
  { label: 'Cheque Date', value: (r) => isoToDmy(r.chequeDate) },
  { label: 'Mode', value: (r) => r.paymentMode ?? '' },
  { label: 'Pay To', value: (r) => r.payTo ?? '' },
  { label: 'Bank', value: (r) => r.bank ?? '' },
  { label: 'Account No', value: (r) => r.account ?? '' },
  { label: 'Remark', value: (r) => r.remark ?? '' },
  { label: 'Status', value: (r) => r.status ?? '' },
  { label: 'Acc. Period', value: (r) => [r.accMonth, r.accYear].filter(Boolean).join('/') },
]
