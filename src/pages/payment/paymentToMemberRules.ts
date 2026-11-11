// Payment > To Member > Pay2MBM and Pay2MBM(Auto) (legacy FrmPayMember and frmPayMemberJul08; their sources are not in the source tree, so the screens are rebuilt on the views they read and the rows they
// wrote): Pay2MBM lists the claims with a debit / credit note, Pay2MBM(Auto) the claims with an amount payable to the member. The claims ticked get one PV each (Generate PV) or are closed without
// payment (Void, as the desktop wrote VOID rows). The criteria, which claims can be ticked, the payee edits and the columns. The server repeats every check.

import * as yup from 'yup'
import type { CsvColumn } from '../../lib/exportCsv'
import { formatMoney } from '../../lib/format'
import { dmyDate, optionalText, requiredDmyDate } from '../../lib/validation'
import { isoDmy, isoToDmy } from '../case/caseShared'
import { prefixes } from './paymentToHospitalRules'

export type Source = 'dn' | 'auto'

export interface MemberClaim {
  caseNo: string
  claimVersion: string
  memberNo: string | null
  memberName: string | null
  patientName: string | null
  payorCode: string | null
  pvInd: string | null
  debitNoteNo: string | null
  amount: number | null
  payTo: string | null
  bank: string | null
  account: string | null
  payMode: string | null
  receiptNo: string | null
  receiptDate: string | null
  payPending: string | null
  bordxNo: string | null
  closeDate: string | null
  pvNo: string | null
}

export interface SearchResult {
  rows: MemberClaim[]
  count: number
  totalAmount: number
  truncated: boolean
}

export interface MemberVoucher {
  pvNo: string
  caseNo: string
  claimVersion: string
  payTo: string | null
  bank: string | null
  account: string | null
  amount: number
  chequeNo: string
  wording: string
  wordingTwo: string
}

export interface Payee {
  payTo: string
  bank: string
  account: string
}

export interface SearchValues {
  payor: string
  memberNo: string
  memberName: string
  caseFrom: string
  caseTo: string
  noteFrom: string
  noteTo: string
  closeFrom: string
  closeTo: string
}

export interface PvValues {
  pvDate: string
  paymentMode: 'ONLINE' | 'CHEQUE'
  chequeNo: string
  remark: string
}

export const screens: Record<Source, { title: string; subtitle: string; legend: string; empty: string }> = {
  dn: {
    title: 'Payment To Member (Pay2MBM)',
    subtitle: 'Pay the members for the claims with a debit / credit note, or void the ones with nothing to pay.',
    legend: 'Claims with a debit / credit note',
    empty: 'No claims. Enter the criteria and press Search.',
  },
  auto: {
    title: 'Payment To Member (Pay2MBM Auto)',
    subtitle: 'Pay the members the amounts payable to them, one PV per claim.',
    legend: 'Claims payable to members',
    empty: 'No claims. Enter the criteria and press Search.',
  },
}

export const searchDefaults: SearchValues = {
  payor: '',
  memberNo: '',
  memberName: '',
  caseFrom: '',
  caseTo: '',
  noteFrom: '',
  noteTo: '',
  closeFrom: '',
  closeTo: '',
}

export const pvDefaults = (): PvValues => ({ pvDate: isoToDmy(new Date().toISOString()), paymentMode: 'ONLINE', chequeNo: '', remark: '' })

export const searchSchema = yup.object({
  payor: optionalText(),
  memberNo: optionalText(),
  memberName: optionalText(),
  caseFrom: optionalText(),
  caseTo: optionalText(),
  noteFrom: optionalText(),
  noteTo: optionalText(),
  closeFrom: dmyDate(),
  closeTo: dmyDate().test('order', 'Close Date From cannot be later than Close Date To.', function (to) {
    const from = isoDmy(this.parent.closeFrom as string)
    const until = isoDmy(to ?? '')
    return !from || !until || from <= until
  }),
}) as yup.ObjectSchema<SearchValues>

export const pvSchema = yup.object({
  pvDate: requiredDmyDate('Please enter the PV Date.'),
  paymentMode: yup.mixed<'ONLINE' | 'CHEQUE'>().oneOf(['ONLINE', 'CHEQUE']).required(),
  chequeNo: optionalText().when('paymentMode', {
    is: 'CHEQUE',
    then: (s) =>
      s.required('Please enter the Cheque No.').matches(/\d$/, 'The Cheque No has to end with a number, e.g. MBB026496.').max(40, 'The Cheque No is too long.'),
  }),
  remark: optionalText().max(400, 'The remark is too long (400 characters at most).'),
}) as yup.ObjectSchema<PvValues>

const text = (v: string) => v.trim() || undefined
const day = (v: string) => isoDmy(v) ?? undefined

export const searchParams = (source: Source, v: SearchValues) => ({
  source,
  payor: text(v.payor),
  memberNo: text(v.memberNo),
  memberName: text(v.memberName),
  caseFrom: text(v.caseFrom),
  caseTo: text(v.caseTo),
  noteFrom: text(v.noteFrom),
  noteTo: text(v.noteTo),
  closeFrom: day(v.closeFrom),
  closeTo: day(v.closeTo),
})

export const rowKey = (r: MemberClaim) => `${r.caseNo}|${r.claimVersion}`

/** Why a claim cannot be paid (null when it can); Void takes any claim of the list. */
export function payProblem(r: MemberClaim, payee?: Payee): string | null {
  const name = `${r.caseNo}-${r.claimVersion}`
  if (!r.amount || r.amount <= 0) return `Claim ${name} has nothing payable to the member: void it instead.`
  if (r.payPending === 'Y') return `The payment of claim ${name} is pending.`
  if (!r.pvInd || !prefixes.includes(r.pvInd)) return `Payor ${r.payorCode ?? ''} of claim ${name} has no PV prefix.`
  if (!(payee?.payTo.trim() || r.payTo?.trim())) return `Please enter the payee of claim ${name}.`
  return null
}

export function generateProblem(ticked: MemberClaim[], payees: ReadonlyMap<string, Payee>): string | null {
  if (ticked.length === 0) return 'Please select the claims to pay.'
  for (const r of ticked) {
    const problem = payProblem(r, payees.get(rowKey(r)))
    if (problem) return problem
  }
  return null
}

export function confirmText(ticked: MemberClaim[], v: PvValues): string {
  const total = ticked.reduce((s, r) => s + (r.amount ?? 0), 0)
  return `Generate ${ticked.length} PV(s), ${formatMoney(total)} in all, dated ${v.pvDate}, paid by ${v.paymentMode}?`
}

export const voidText = (ticked: MemberClaim[]) => `Void ${ticked.length} claim(s)? Nothing will be paid to the member for them.`

/** The payee typed for a claim, or the claim's own. */
export const payeeOf = (r: MemberClaim, payees: ReadonlyMap<string, Payee>): Payee =>
  payees.get(rowKey(r)) ?? { payTo: r.payTo ?? '', bank: r.bank ?? '', account: r.account ?? '' }

export const pvBody = (source: Source, v: PvValues, ticked: MemberClaim[], payees: ReadonlyMap<string, Payee>) => ({
  source,
  pvDate: isoDmy(v.pvDate),
  paymentMode: v.paymentMode,
  chequeNo: v.paymentMode === 'CHEQUE' ? v.chequeNo.trim() : undefined,
  remark: v.remark.trim() || undefined,
  claims: ticked.map((r) => {
    const p = payees.get(rowKey(r))
    return {
      caseNo: r.caseNo,
      claimVersion: r.claimVersion,
      payTo: p ? text(p.payTo) : undefined,
      bank: p ? text(p.bank) : undefined,
      account: p ? text(p.account) : undefined,
    }
  }),
})

export const voidBody = (source: Source, v: PvValues, ticked: MemberClaim[]) => ({
  source,
  voidDate: isoDmy(v.pvDate),
  remark: v.remark.trim() || undefined,
  claims: ticked.map((r) => ({ caseNo: r.caseNo, claimVersion: r.claimVersion })),
})

const m = (v: number | null) => (v == null ? '' : formatMoney(v))

export function claimColumns(source: Source, payees: ReadonlyMap<string, Payee>): (CsvColumn<MemberClaim> & { right?: boolean })[] {
  return [
    { label: 'Claim No', value: (r) => `${r.caseNo}-${r.claimVersion}` },
    { label: 'Member No', value: (r) => r.memberNo ?? '' },
    { label: 'Member Name', value: (r) => r.memberName ?? '' },
    { label: 'Patient', value: (r) => r.patientName ?? '' },
    { label: 'Payor', value: (r) => r.payorCode ?? '' },
    { label: 'D/N No', value: (r) => r.debitNoteNo ?? '' },
    { label: 'Payable 2M', value: (r) => m(r.amount), right: true },
    { label: 'Pay To', value: (r) => payeeOf(r, payees).payTo },
    { label: 'Bank', value: (r) => payeeOf(r, payees).bank },
    { label: 'Account No', value: (r) => payeeOf(r, payees).account },
    ...(source === 'auto'
      ? [
          { label: 'Pay Mode', value: (r: MemberClaim) => r.payMode ?? '' },
          { label: 'Payor Receipt', value: (r: MemberClaim) => [r.receiptNo, isoToDmy(r.receiptDate)].filter(Boolean).join(' ') },
        ]
      : []),
    { label: 'Close Date', value: (r) => isoToDmy(r.closeDate) },
    { label: 'Pending', value: (r) => (r.payPending === 'Y' ? 'Y' : '') },
  ]
}

export const voucherColumns: (CsvColumn<MemberVoucher> & { right?: boolean })[] = [
  { label: 'PV No', value: (v) => v.pvNo },
  { label: 'Claim No', value: (v) => `${v.caseNo}-${v.claimVersion}` },
  { label: 'Pay To', value: (v) => v.payTo ?? '' },
  { label: 'Bank', value: (v) => v.bank ?? '' },
  { label: 'Account No', value: (v) => v.account ?? '' },
  { label: 'Amount', value: (v) => formatMoney(v.amount), right: true },
  { label: 'Cheque No', value: (v) => v.chequeNo },
  { label: 'In Words', value: (v) => `${v.wording}${v.wordingTwo}` },
]
