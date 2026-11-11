// Payment > Payor (legacy FrmPaymentPayor; its source is not in the source tree, so the screen is rebuilt on VIEW_Payment_Payor and the rows of Payment2PAY): the reversed claims (total approved below 0)
// are paid back to their payor by cheque, one PV per payor. The criteria, which claims can be ticked, the preview of the vouchers and the columns of the lists. The server repeats every check.

import * as yup from 'yup'
import type { CsvColumn } from '../../lib/exportCsv'
import { formatMoney } from '../../lib/format'
import { dmyDate, optionalText, requiredDmyDate } from '../../lib/validation'
import { isoDmy, isoToDmy } from '../case/caseShared'
import { prefixes } from './paymentToHospitalRules'

export interface PayorClaim {
  caseNo: string
  claimVersion: string
  memberNo: string | null
  memberName: string | null
  payorCode: string | null
  payorName: string | null
  pvInd: string | null
  bordxNo: string | null
  closeDate: string | null
  amount: number | null
  pvNo: string | null
}

export interface SearchResult {
  rows: PayorClaim[]
  count: number
  totalAmount: number
  truncated: boolean
}

export interface PayorVoucher {
  pvNo: string
  payorCode: string
  payorName: string | null
  claims: number
  amount: number
  chequeNo: string
}

export interface SearchValues {
  payor: string
  caseFrom: string
  caseTo: string
  bordxFrom: string
  bordxTo: string
  closeFrom: string
  closeTo: string
}

export interface PvValues {
  pvDate: string
  chequeNo: string
  remark: string
}

export const searchDefaults: SearchValues = { payor: '', caseFrom: '', caseTo: '', bordxFrom: '', bordxTo: '', closeFrom: '', closeTo: '' }

export const pvDefaults = (): PvValues => ({ pvDate: isoToDmy(new Date().toISOString()), chequeNo: '', remark: '' })

export const searchSchema = yup.object({
  payor: optionalText(),
  caseFrom: optionalText(),
  caseTo: optionalText(),
  bordxFrom: optionalText(),
  bordxTo: optionalText(),
  closeFrom: dmyDate(),
  closeTo: dmyDate().test('order', 'Close Date From cannot be later than Close Date To.', function (to) {
    const from = isoDmy(this.parent.closeFrom as string)
    const until = isoDmy(to ?? '')
    return !from || !until || from <= until
  }),
}) as yup.ObjectSchema<SearchValues>

export const pvSchema = yup.object({
  pvDate: requiredDmyDate('Please enter the PV Date.'),
  chequeNo: optionalText()
    .required('Please enter the Cheque No.')
    .matches(/\d$/, 'The Cheque No has to end with a number, e.g. CB002704.')
    .max(40, 'The Cheque No is too long.'),
  remark: optionalText().max(400, 'The remark is too long (400 characters at most).'),
}) as yup.ObjectSchema<PvValues>

const text = (v: string) => v.trim() || undefined
const day = (v: string) => isoDmy(v) ?? undefined

export const searchParams = (v: SearchValues) => ({
  payor: text(v.payor),
  caseFrom: text(v.caseFrom),
  caseTo: text(v.caseTo),
  bordxFrom: text(v.bordxFrom),
  bordxTo: text(v.bordxTo),
  closeFrom: day(v.closeFrom),
  closeTo: day(v.closeTo),
})

export const rowKey = (r: PayorClaim) => `${r.caseNo}|${r.claimVersion}`

/** Why a claim cannot be ticked (null when it can). */
export function tickProblem(r: PayorClaim): string | null {
  if (!r.pvInd || !prefixes.includes(r.pvInd)) return `Payor ${r.payorCode ?? ''} has no PV prefix.`
  if (!r.amount || r.amount <= 0) return `Claim ${r.caseNo}-${r.claimVersion} has nothing to pay back.`
  return null
}

export const tickableKeys = (rows: PayorClaim[]) => rows.filter((r) => tickProblem(r) === null).map(rowKey)

/** The vouchers Generate PV will write: one per payor and PV prefix. */
export function preview(ticked: PayorClaim[]): { payorCode: string; claims: number; amount: number }[] {
  const groups = new Map<string, { payorCode: string; claims: number; amount: number }>()
  for (const r of ticked) {
    const key = `${r.payorCode ?? ''}|${r.pvInd ?? ''}`
    const g = groups.get(key) ?? { payorCode: r.payorCode ?? '', claims: 0, amount: 0 }
    g.claims += 1
    g.amount = Math.round((g.amount + (r.amount ?? 0)) * 100) / 100
    groups.set(key, g)
  }
  return [...groups.values()].sort((a, b) => a.payorCode.localeCompare(b.payorCode))
}

export function confirmText(ticked: PayorClaim[], v: PvValues): string {
  const groups = preview(ticked)
  const total = groups.reduce((s, g) => s + g.amount, 0)
  return `Generate ${groups.length} PV(s) for ${ticked.length} claim(s), ${formatMoney(total)} in all, dated ${v.pvDate}, cheques from ${v.chequeNo.trim()}?`
}

export const pvBody = (v: PvValues, ticked: PayorClaim[]) => ({
  pvDate: isoDmy(v.pvDate),
  chequeNo: v.chequeNo.trim(),
  remark: v.remark.trim() || undefined,
  claims: ticked.map((r) => ({ caseNo: r.caseNo, claimVersion: r.claimVersion })),
})

const m = (v: number | null) => (v == null ? '' : formatMoney(v))

export const claimColumns: (CsvColumn<PayorClaim> & { right?: boolean })[] = [
  { label: 'Payor', value: (r) => r.payorCode ?? '' },
  { label: 'Payor Name', value: (r) => r.payorName ?? '' },
  { label: 'Claim No', value: (r) => `${r.caseNo}-${r.claimVersion}` },
  { label: 'Member No', value: (r) => r.memberNo ?? '' },
  { label: 'Member Name', value: (r) => r.memberName ?? '' },
  { label: 'PV', value: (r) => r.pvInd ?? '' },
  { label: 'Bordx No', value: (r) => r.bordxNo ?? '' },
  { label: 'Close Date', value: (r) => isoToDmy(r.closeDate) },
  { label: 'Pay Back Amt', value: (r) => m(r.amount), right: true },
]

export const voucherColumns: (CsvColumn<PayorVoucher> & { right?: boolean })[] = [
  { label: 'PV No', value: (v) => v.pvNo },
  { label: 'Payor', value: (v) => v.payorCode },
  { label: 'Payor Name', value: (v) => v.payorName ?? '' },
  { label: 'Claims', value: (v) => String(v.claims) },
  { label: 'Amount', value: (v) => formatMoney(v.amount), right: true },
  { label: 'Cheque No', value: (v) => v.chequeNo },
]
