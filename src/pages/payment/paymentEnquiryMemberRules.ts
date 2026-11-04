// Payment > Enquiry > Payment To Member (legacy FrmEnquiryPayMember, "Enquiry Payment to Member"): the claims with a debit / credit note and their payments (Payment To Member), the receipts of those claims
// (Receipts) and the payments that were reissued (Reissue). Scan a claim number to add it to the lists, or search; the server makes the lists. This module holds the criteria, the cells of the three lists in the
// desktop's column order and the checks.

import * as yup from 'yup'
import { dmyDate, optionalText } from '../../lib/validation'
import { formatMoney } from '../../lib/format'
import { isoDmy } from '../case/caseShared'

export interface PaymentCode {
  code: string
  name: string | null
}

export interface HealthType {
  code: string
  description: string | null
}

export interface Lookups {
  payors: PaymentCode[]
  healthTypes: HealthType[]
}

export interface PaymentRow {
  crNo: string | null
  caseNo: string | null
  claimVersion: string | null
  payable: number | null
  memberName: string | null
  payTo: string | null
  mbmNo: string | null
  pvIndex: number | null
  paidAmt: number | null
  arStatus: string | null
  pvNo: string | null
  pvDate: string | null
  pvStatus: string | null
  payStatus: string | null
  chequeNo: string | null
  chequeDate: string | null
  chequeAmt: number | null
  pvPayTo: string | null
  payeeBank: string | null
  payeeAcNo: string | null
  remark: string | null
  wsStatus: string | null
  sunPvNo: string | null
  sunPvDate: string | null
  bankCharges: number | null
  accMonth: string | null
  accYear: string | null
  updatedBy: string | null
  paidTotal: number | null
  os: number | null
}

export interface ReceiptRow {
  caseNo: string | null
  claimVersion: string | null
  mbmNo: string | null
  kind: string | null
  payable: number | null
  amount: number | null
  receiptNo: string | null
  receiptDate: string | null
  accMonth: string | null
  accYear: string | null
  remarks: string | null
}

export interface SearchResult {
  payments: PaymentRow[]
  reissues: PaymentRow[]
  receipts: ReceiptRow[]
  totalPayable: number
  totalPaid: number
  truncated: boolean
}

export interface SearchValues {
  scan: boolean
  caseNo: string
  version: string
  wsStatus: string
  healthType: string
  mbmNo: string
  mbmName: string
  payor: string
  payment: string
  pvNoFrom: string
  pvNoTo: string
  blankPvNo: boolean
  pvDateFrom: string
  pvDateTo: string
  blankPvDate: boolean
  crNoFrom: string
  crNoTo: string
  blankCrNo: boolean
  monthFrom: string
  monthTo: string
  blankMonth: boolean
  yearFrom: string
  yearTo: string
  blankYear: boolean
  sunNoFrom: string
  sunNoTo: string
  blankSunNo: boolean
  sunDateFrom: string
  sunDateTo: string
  blankSunDate: boolean
}

/** Form_Load: Use Scan is on (the single claim number box), Pymt Status is "0 - All". */
export const searchDefaults: SearchValues = {
  scan: true,
  caseNo: '',
  version: '',
  wsStatus: '',
  healthType: '',
  mbmNo: '',
  mbmName: '',
  payor: '',
  payment: '0',
  pvNoFrom: '',
  pvNoTo: '',
  blankPvNo: false,
  pvDateFrom: '',
  pvDateTo: '',
  blankPvDate: false,
  crNoFrom: '',
  crNoTo: '',
  blankCrNo: false,
  monthFrom: '',
  monthTo: '',
  blankMonth: false,
  yearFrom: '',
  yearTo: '',
  blankYear: false,
  sunNoFrom: '',
  sunNoTo: '',
  blankSunNo: false,
  sunDateFrom: '',
  sunDateTo: '',
  blankSunDate: false,
}

const flag = yup.boolean().default(false)

export const searchSchema: yup.ObjectSchema<SearchValues> = yup.object({
  scan: flag,
  caseNo: optionalText().max(30, 'Case No is too long.'),
  version: optionalText().max(4, 'Ver is too long.'),
  wsStatus: optionalText(),
  healthType: optionalText(),
  mbmNo: optionalText().max(30, 'Member No is too long.'),
  mbmName: optionalText().max(100, 'Member Name is too long.'),
  payor: optionalText(),
  payment: optionalText(),
  pvNoFrom: optionalText().max(40, 'PV No is too long.'),
  pvNoTo: optionalText().max(40, 'PV No is too long.'),
  blankPvNo: flag,
  pvDateFrom: dmyDate(),
  pvDateTo: dmyDate(),
  blankPvDate: flag,
  crNoFrom: optionalText().max(40, 'CR No is too long.'),
  crNoTo: optionalText().max(40, 'CR No is too long.'),
  blankCrNo: flag,
  monthFrom: optionalText(),
  monthTo: optionalText(),
  blankMonth: flag,
  yearFrom: optionalText(),
  yearTo: optionalText(),
  blankYear: flag,
  sunNoFrom: optionalText().max(40, 'SUN PV No is too long.'),
  sunNoTo: optionalText().max(40, 'SUN PV No is too long.'),
  blankSunNo: flag,
  sunDateFrom: dmyDate(),
  sunDateTo: dmyDate(),
  blankSunDate: flag,
})

export { paymentOptions, wsStatusOptions } from './paymentEnquiryHospitalRules'

/** The A/C period lists of the desktop: months 1-12 and years 1999-3000. */
export const monthOptions = Array.from({ length: 12 }, (_, i) => ({ value: String(i + 1), label: String(i + 1) }))
export const yearOptions = Array.from({ length: 3000 - 1999 + 1 }, (_, i) => ({ value: String(1999 + i), label: String(1999 + i) }))

export const payorOptions = (list: PaymentCode[]) => list.map((c) => ({ value: `${c.code} - ${c.name ?? ''}`, label: `${c.code} - ${c.name ?? ''}` }))
export const healthTypeOptions = (list: HealthType[]) =>
  list.map((c) => ({ value: `${c.code} - ${c.description ?? ''}`, label: `${c.code} - ${c.description ?? ''}` }))

const code = (v: string) => v.split(' - ')[0].trim()
const t = (v: string) => v.trim() || undefined
const n = (v: string) => (v.trim() === '' ? undefined : Number(v))

/** The query of Search. */
export function searchParams(v: SearchValues) {
  return {
    caseNo: t(v.caseNo),
    version: t(v.version),
    wsStatus: t(code(v.wsStatus)),
    healthType: t(code(v.healthType)),
    mbmNo: t(v.mbmNo),
    mbmName: t(v.mbmName),
    payor: t(code(v.payor)),
    payment: Number(v.payment || 0),
    pvNoFrom: t(v.pvNoFrom),
    pvNoTo: t(v.pvNoTo),
    blankPvNo: v.blankPvNo,
    pvDateFrom: isoDmy(v.pvDateFrom) ?? undefined,
    pvDateTo: isoDmy(v.pvDateTo) ?? undefined,
    blankPvDate: v.blankPvDate,
    crNoFrom: t(v.crNoFrom),
    crNoTo: t(v.crNoTo),
    blankCrNo: v.blankCrNo,
    monthFrom: n(v.monthFrom),
    monthTo: n(v.monthTo),
    blankMonth: v.blankMonth,
    yearFrom: n(v.yearFrom),
    yearTo: n(v.yearTo),
    blankYear: v.blankYear,
    sunNoFrom: t(v.sunNoFrom),
    sunNoTo: t(v.sunNoTo),
    blankSunNo: v.blankSunNo,
    sunDateFrom: isoDmy(v.sunDateFrom) ?? undefined,
    sunDateTo: isoDmy(v.sunDateTo) ?? undefined,
    blankSunDate: v.blankSunDate,
  }
}

const claimKey = (no: string | null, version: string | null) => `${(no ?? '').trim()}-${(version ?? '').trim()}`.toLowerCase()

/** cmdSearch_Click in Use Scan: the claim number has to be entered, and a claim already in the list is not added again ("Data has been uploaded!"). */
export function scanProblem(v: SearchValues, rows: PaymentRow[]): string | null {
  if (!v.scan) return null
  const scanned = v.caseNo.trim()
  if (!scanned) return 'Please Enter Worksheet No'
  return rows.some((r) => (r.caseNo ?? '').trim().toLowerCase() === scanned.toLowerCase()) ? 'Data has been uploaded!' : null
}

/** ReceiptNoCheck: the receipts of a claim already in the list are not added again. */
export const newReceipts = (have: ReceiptRow[], more: ReceiptRow[]): ReceiptRow[] => {
  const known = new Set(have.map((r) => claimKey(r.caseNo, r.claimVersion)))
  return more.filter((r) => !known.has(claimKey(r.caseNo, r.claimVersion)))
}

const date = (v: string | null) => (v ? v.slice(0, 10).split('-').reverse().join('/') : '')
const money = (v: number | null) => (v == null ? '' : formatMoney(v))
const status = (s: string | null) => ((s ?? '').trim() === 'F' ? 'Full' : (s ?? '').trim() === 'P' ? 'Partial' : 'Unpaid')
const period = (m: string | null, y: string | null) => (m || y ? `${m ?? ''}/${y ?? ''}` : '')

type Column<T> = { label: string; right?: boolean; value: (r: T) => string; sort?: (r: T) => string | number }

/** The Payment To Member list in the desktop's order; a part-paid claim shows the sum of its payments as Amt Paid and what is left as OS Amt. */
export const paymentColumns: Column<PaymentRow>[] = [
  { label: 'CR No', value: (r) => r.crNo ?? '' },
  { label: 'Pymt Status', value: (r) => status(r.payStatus) },
  { label: 'Member Name', value: (r) => r.memberName ?? '' },
  { label: 'Pay To', value: (r) => r.payTo ?? '' },
  { label: 'Clm No', value: (r) => ((r.caseNo ?? '') !== '' ? `${r.caseNo}-${r.claimVersion ?? ''}` : '') },
  { label: 'Pay2MBM', right: true, value: (r) => money(r.payable), sort: (r) => r.payable ?? 0 },
  {
    label: 'Amt Paid',
    right: true,
    value: (r) => money((r.payStatus ?? '').trim() === 'P' && r.paidTotal != null ? r.paidTotal : r.paidAmt),
    sort: (r) => r.paidAmt ?? 0,
  },
  { label: 'OS Amt', right: true, value: (r) => money(r.os), sort: (r) => r.os ?? 0 },
  { label: 'AR Status', value: (r) => r.arStatus ?? '' },
  { label: 'PV No', value: (r) => r.pvNo ?? '' },
  { label: 'PV Status', value: (r) => r.pvStatus ?? '' },
  { label: 'Cheque No', value: (r) => r.chequeNo ?? '' },
  { label: 'Cheque Date', value: (r) => date(r.chequeDate), sort: (r) => r.chequeDate ?? '' },
  { label: 'Payee Bank', value: (r) => r.payeeBank ?? '' },
  { label: 'Payee A/C No', value: (r) => r.payeeAcNo ?? '' },
  { label: 'Remark', value: (r) => r.remark ?? '' },
  { label: 'WS Claimability', value: (r) => r.wsStatus ?? '' },
  { label: 'SUN PV', value: (r) => r.sunPvNo ?? '' },
  { label: 'SUN PVDate', value: (r) => date(r.sunPvDate), sort: (r) => r.sunPvDate ?? '' },
]

/** The Receipts list: one line for each receipt a claim has from MNRB, the payor and the member. */
export const receiptColumns: Column<ReceiptRow>[] = [
  { label: 'Clm No', value: (r) => `${r.caseNo ?? ''}-${r.claimVersion ?? ''}` },
  { label: 'Member No', value: (r) => r.mbmNo ?? '' },
  { label: 'Receipt From', value: (r) => r.kind ?? '' },
  { label: 'Pay2MBM', right: true, value: (r) => money(r.payable), sort: (r) => r.payable ?? 0 },
  { label: 'Receipt Amt', right: true, value: (r) => money(r.amount), sort: (r) => r.amount ?? 0 },
  { label: 'Receipt No', value: (r) => r.receiptNo ?? '' },
  { label: 'Receipt Date', value: (r) => date(r.receiptDate), sort: (r) => r.receiptDate ?? '' },
  { label: 'A/C Period', value: (r) => period(r.accMonth, r.accYear) },
  { label: 'Remarks', value: (r) => r.remarks ?? '' },
]

/** The Reissue list: the payments with PV status R (the desktop's patient name column was never filled; the member's name is shown). */
export const reissueColumns: Column<PaymentRow>[] = [
  { label: 'Member Name', value: (r) => r.memberName ?? '' },
  { label: 'Clm No', value: (r) => ((r.caseNo ?? '') !== '' ? `${r.caseNo}-${r.claimVersion ?? ''}` : '') },
  { label: 'Amt Paid', right: true, value: (r) => money(r.paidAmt ?? 0), sort: (r) => r.paidAmt ?? 0 },
  { label: 'PV Index', value: (r) => (r.pvIndex == null ? '' : String(r.pvIndex)), sort: (r) => r.pvIndex ?? 0 },
  { label: 'PV No', value: (r) => r.pvNo ?? '' },
  { label: 'PV Date', value: (r) => date(r.pvDate), sort: (r) => r.pvDate ?? '' },
  { label: 'Cheque No', value: (r) => r.chequeNo ?? '' },
  { label: 'Cheque Date', value: (r) => date(r.chequeDate), sort: (r) => r.chequeDate ?? '' },
  { label: 'Cheque Amt', right: true, value: (r) => money(r.chequeAmt ?? 0), sort: (r) => r.chequeAmt ?? 0 },
  { label: 'Pay To', value: (r) => r.pvPayTo ?? '' },
  { label: 'Payee Bank', value: (r) => r.payeeBank ?? '' },
  { label: 'Payee A/C No', value: (r) => r.payeeAcNo ?? '' },
  { label: 'Bank Charges', right: true, value: (r) => money(r.bankCharges ?? 0), sort: (r) => r.bankCharges ?? 0 },
  { label: 'A/C Period', value: (r) => period(r.accMonth, r.accYear) },
  { label: 'Entry By', value: (r) => r.updatedBy ?? '' },
  { label: 'Remark', value: (r) => r.remark ?? '' },
]

/** Print to File writes the Payment To Member list (the desktop exported that list only). */
export const fileRows = (rows: PaymentRow[]): string[][] => [paymentColumns.map((c) => c.label), ...rows.map((r) => paymentColumns.map((c) => c.value(r)))]
