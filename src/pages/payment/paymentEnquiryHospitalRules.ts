// Payment > Enquiry > Payment To Hospital (legacy FrmEnquiryPaymentHospital, "Enquiry Payment to Hospital"): the claims payable to hospitals and what has been paid. Scan a claim number to add it to the list, or
// search a range; the server makes the list. This module holds the criteria, the cells of the list in the desktop's column order and the checks.

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
  hospitals: PaymentCode[]
  payors: PaymentCode[]
  healthTypes: HealthType[]
}

export interface PaymentRow {
  payStatus: string | null
  hospitalName: string | null
  invNo: string | null
  invDate: string | null
  payable: number | null
  paidAmt: number | null
  patientName: string | null
  caseNo: string | null
  claimVersion: string | null
  bordxNo: string | null
  arStatus: string | null
  doa: string | null
  dod: string | null
  paymentDate: string | null
  entryBy: string | null
  pvIndex: number | null
  pvNo: string | null
  chequeNo: string | null
  chequeDate: string | null
  accMonth: number | null
  accYear: number | null
  bankCharges: number | null
  wsStatus: string | null
  sunPvNo: string | null
  sunPvDate: string | null
  paidTotal: number | null
  os: number | null
  receiptNo: string | null
  receiptAmt: number | null
}

export interface SearchResult {
  rows: PaymentRow[]
  totalPayable: number
  truncated: boolean
}

export interface SearchValues {
  hospital: string
  payor: string
  healthType: string
  wsStatus: string
  payment: string
  scan: boolean
  caseFrom: string
  caseTo: string
  invNo: string
  blankInvNo: boolean
  invDateFrom: string
  invDateTo: string
  blankInvDate: boolean
  pvNoFrom: string
  pvNoTo: string
  blankPvNo: boolean
  pvDateFrom: string
  pvDateTo: string
  blankPvDate: boolean
  sunNoFrom: string
  sunNoTo: string
  blankSunNo: boolean
  sunDateFrom: string
  sunDateTo: string
  blankSunDate: boolean
}

/** Form_Load: Use Scan is on, Pymt Status is "0 - All". */
export const searchDefaults: SearchValues = {
  hospital: '',
  payor: '',
  healthType: '',
  wsStatus: '',
  payment: '0',
  scan: true,
  caseFrom: '',
  caseTo: '',
  invNo: '',
  blankInvNo: false,
  invDateFrom: '',
  invDateTo: '',
  blankInvDate: false,
  pvNoFrom: '',
  pvNoTo: '',
  blankPvNo: false,
  pvDateFrom: '',
  pvDateTo: '',
  blankPvDate: false,
  sunNoFrom: '',
  sunNoTo: '',
  blankSunNo: false,
  sunDateFrom: '',
  sunDateTo: '',
  blankSunDate: false,
}

const flag = yup.boolean().default(false)

export const searchSchema: yup.ObjectSchema<SearchValues> = yup.object({
  hospital: optionalText(),
  payor: optionalText(),
  healthType: optionalText(),
  wsStatus: optionalText(),
  payment: optionalText(),
  scan: flag,
  caseFrom: optionalText().max(30, 'Clm No is too long.'),
  caseTo: optionalText().max(30, 'Clm No is too long.'),
  invNo: optionalText().max(100, 'Inv No is too long.'),
  blankInvNo: flag,
  invDateFrom: dmyDate(),
  invDateTo: dmyDate(),
  blankInvDate: flag,
  pvNoFrom: optionalText().max(40, 'PV No is too long.'),
  pvNoTo: optionalText().max(40, 'PV No is too long.'),
  blankPvNo: flag,
  pvDateFrom: dmyDate(),
  pvDateTo: dmyDate(),
  blankPvDate: flag,
  sunNoFrom: optionalText().max(40, 'SUN PV No is too long.'),
  sunNoTo: optionalText().max(40, 'SUN PV No is too long.'),
  blankSunNo: flag,
  sunDateFrom: dmyDate(),
  sunDateTo: dmyDate(),
  blankSunDate: flag,
})

/** cboPayment. */
export const paymentOptions = [
  { value: '0', label: '0 - All' },
  { value: '1', label: '1 - Paid' },
  { value: '2', label: '2 - Unpaid' },
  { value: '3', label: '3 - Partial Paid' },
  { value: '4', label: '4 - Paid & Partial Paid' },
  { value: '5', label: '5 - Unpaid & Partial Paid' },
]

/** cboWSStatus. */
export const wsStatusOptions = [
  ['AA', 'Accepted'],
  ['RR', 'Repudiated'],
  ['CC', 'Cancelled'],
  ['SA', 'Special Approval'],
  ['PP', 'Pay & Claim'],
  ['NN', 'Not Decided'],
  ['NA', 'Not Decided/Accepted'],
  ['NR', 'Not Decided/Repudiated'],
  ['PA', 'Pay&Claim/Accepted'],
  ['PR', 'Pay&Claim/Rejected'],
  ['AR', 'Accepted/Rejected'],
  ['RA', 'Rejected/Accepted'],
  ['BR', 'BTBG/Rejected'],
].map(([code, name]) => ({ value: `${code} - ${name}`, label: `${code} - ${name}` }))

export const codeOptions = (list: PaymentCode[]) => list.map((c) => ({ value: `${c.code} - ${c.name ?? ''}`, label: `${c.code} - ${c.name ?? ''}` }))
export const healthTypeOptions = (list: HealthType[]) =>
  list.map((c) => ({ value: `${c.code} - ${c.description ?? ''}`, label: `${c.code} - ${c.description ?? ''}` }))

const code = (v: string) => v.split(' - ')[0].trim()
const t = (v: string) => v.trim() || undefined

/** The query of Search: in Use Scan the one claim number scanned (exact), otherwise the claim range. */
export function searchParams(v: SearchValues) {
  return {
    hospital: t(code(v.hospital)),
    payor: t(code(v.payor)),
    wsStatus: t(code(v.wsStatus)),
    healthType: t(code(v.healthType)),
    payment: Number(v.payment || 0),
    scanCase: v.scan ? t(v.caseFrom) : undefined,
    caseFrom: v.scan ? undefined : t(v.caseFrom),
    caseTo: v.scan ? undefined : t(v.caseTo),
    invNo: t(v.invNo),
    blankInvNo: v.blankInvNo,
    invDateFrom: isoDmy(v.invDateFrom) ?? undefined,
    invDateTo: isoDmy(v.invDateTo) ?? undefined,
    blankInvDate: v.blankInvDate,
    pvNoFrom: t(v.pvNoFrom),
    pvNoTo: t(v.pvNoTo),
    blankPvNo: v.blankPvNo,
    pvDateFrom: isoDmy(v.pvDateFrom) ?? undefined,
    pvDateTo: isoDmy(v.pvDateTo) ?? undefined,
    blankPvDate: v.blankPvDate,
    sunNoFrom: t(v.sunNoFrom),
    sunNoTo: t(v.sunNoTo),
    blankSunNo: v.blankSunNo,
    sunDateFrom: isoDmy(v.sunDateFrom) ?? undefined,
    sunDateTo: isoDmy(v.sunDateTo) ?? undefined,
    blankSunDate: v.blankSunDate,
  }
}

/** cmdSearch_Click in Use Scan: the claim number has to be entered, and a claim already in the list is not added again ("Data has been uploaded!"). */
export function scanProblem(v: SearchValues, rows: PaymentRow[]): string | null {
  if (!v.scan) return null
  const scanned = v.caseFrom.trim()
  if (!scanned) return 'Please Enter Worksheet No'
  return rows.some((r) => (r.caseNo ?? '').trim().toLowerCase() === scanned.toLowerCase()) ? 'Data has been uploaded!' : null
}

const date = (v: string | null) => (v ? v.slice(0, 10).split('-').reverse().join('/') : '')
const money = (v: number | null) => (v == null ? '' : formatMoney(v))
const status = (s: string | null) => ((s ?? '').trim() === 'F' ? 'Full' : (s ?? '').trim() === 'P' ? 'Partial' : 'Unpaid')

/** The 26 columns of the list in the desktop's order: a part-paid claim shows the sum of its payments as Amt Paid and what is left as OS Amt. */
export const paymentColumns: { label: string; right?: boolean; value: (r: PaymentRow) => string; sort?: (r: PaymentRow) => string | number }[] = [
  { label: 'Pymt Status', value: (r) => status(r.payStatus) },
  { label: 'Hosp Code', value: (r) => r.hospitalName ?? '' },
  { label: 'Inv No', value: (r) => r.invNo ?? '' },
  { label: 'INV Date', value: (r) => date(r.invDate), sort: (r) => r.invDate ?? '' },
  { label: 'Pay2HOS', right: true, value: (r) => money(r.payable), sort: (r) => r.payable ?? 0 },
  {
    label: 'Amt Paid',
    right: true,
    value: (r) => money((r.payStatus ?? '').trim() === 'P' && r.paidTotal != null ? r.paidTotal : r.paidAmt),
    sort: (r) => r.paidAmt ?? 0,
  },
  { label: 'OS Amt', right: true, value: (r) => money(r.os), sort: (r) => r.os ?? 0 },
  { label: 'Patient Name', value: (r) => r.patientName ?? '' },
  { label: 'Clm No', value: (r) => ((r.caseNo ?? '') !== '' ? `${r.caseNo}-${r.claimVersion ?? ''}` : '') },
  { label: 'Bordx No', value: (r) => r.bordxNo ?? '' },
  { label: 'AR Status', value: (r) => r.arStatus ?? '' },
  { label: 'DOA', value: (r) => date(r.doa), sort: (r) => r.doa ?? '' },
  { label: 'DOD', value: (r) => date(r.dod), sort: (r) => r.dod ?? '' },
  { label: 'DOP (Payment)', value: (r) => date(r.paymentDate), sort: (r) => r.paymentDate ?? '' },
  { label: 'Entry By', value: (r) => r.entryBy ?? '' },
  { label: 'PV HOS Index', value: (r) => (r.pvIndex == null ? '' : String(r.pvIndex)), sort: (r) => r.pvIndex ?? 0 },
  { label: 'PV No', value: (r) => r.pvNo ?? '' },
  { label: 'Cheque No', value: (r) => r.chequeNo ?? '' },
  { label: 'Cheque Date', value: (r) => date(r.chequeDate), sort: (r) => r.chequeDate ?? '' },
  { label: 'A/C Period', value: (r) => (r.accMonth != null || r.accYear != null ? `${r.accMonth ?? ''}/${r.accYear ?? ''}` : '') },
  { label: 'Bank Charges', right: true, value: (r) => money(r.bankCharges), sort: (r) => r.bankCharges ?? 0 },
  { label: 'Receipt No', value: (r) => r.receiptNo ?? '' },
  { label: 'Receipt Amt', right: true, value: (r) => money(r.receiptAmt), sort: (r) => r.receiptAmt ?? 0 },
  { label: 'WS Claimability', value: (r) => r.wsStatus ?? '' },
  { label: 'SUN PV', value: (r) => r.sunPvNo ?? '' },
  { label: 'SUN PVDate', value: (r) => date(r.sunPvDate), sort: (r) => r.sunPvDate ?? '' },
]

/** One row per payment: the key is the claim and the PV index (an unpaid claim has no PV, so its index is blank and the claim alone tells it). */
export const rowKey = (r: PaymentRow, i: number) => `${r.caseNo}-${r.claimVersion}-${r.pvIndex ?? ''}-${i}`

/** The sum of what is payable over the rows of the list. */
export const totalPayable = (rows: PaymentRow[]) => rows.reduce((s, r) => s + (r.payable ?? 0), 0)

/** Print to File: the list as rows of text, headed as the list is. */
export const fileRows = (rows: PaymentRow[]): string[][] => [paymentColumns.map((c) => c.label), ...rows.map((r) => paymentColumns.map((c) => c.value(r)))]
