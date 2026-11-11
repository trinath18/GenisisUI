// Payment > To Hospital (legacy FrmPaymentHospital; its source is not in the source tree, so the screen is rebuilt on what it read and what it wrote): the criteria of the claims to pay, which claims
// can be ticked, the PV details, the preview of the vouchers Generate PV writes (one per hospital and PV prefix) and the columns of the lists. The server repeats every check.

import * as yup from 'yup'
import type { Option } from '../../components/Field'
import type { CsvColumn } from '../../lib/exportCsv'
import { formatMoney } from '../../lib/format'
import { dmyDate, optionalText, requiredDmyDate } from '../../lib/validation'
import { isoDmy, isoToDmy } from '../case/caseShared'

export interface HospitalClaim {
  caseNo: string
  claimVersion: string
  memberNo: string | null
  hospitalCode: string | null
  hospitalName: string | null
  payee: string | null
  bordxNo: string | null
  bordxDate: string | null
  payorCode: string | null
  pvInd: string | null
  amount: number | null
  invoices: number
  invDate: string | null
  payPending: string | null
  pendingRemark: string | null
  pvNo: string | null
}

export interface SearchResult {
  rows: HospitalClaim[]
  count: number
  totalAmount: number
  truncated: boolean
}

export interface Voucher {
  pvNo: string
  hospitalName: string | null
  payee: string | null
  claims: number
  amount: number
  chequeNo: string
  wording: string
  wordingTwo: string
}

export interface SearchValues {
  payor: string
  hospital: string
  caseFrom: string
  caseTo: string
  bordxFrom: string
  bordxTo: string
  bordxDateFrom: string
  bordxDateTo: string
}

export interface PvValues {
  pvDate: string
  paymentMode: 'ONLINE' | 'CHEQUE'
  chequeNo: string
  remark: string
}

/** The PV prefixes that have a counter (PAY.PVInd). */
export const prefixes = ['CB', 'CC', 'CG']

export const modeOptions: Option[] = [
  { value: 'ONLINE', label: 'ONLINE' },
  { value: 'CHEQUE', label: 'CHEQUE' },
]

export const searchDefaults: SearchValues = {
  payor: '',
  hospital: '',
  caseFrom: '',
  caseTo: '',
  bordxFrom: '',
  bordxTo: '',
  bordxDateFrom: '',
  bordxDateTo: '',
}

const dmyToday = () => isoToDmy(new Date().toISOString())

export const pvDefaults = (): PvValues => ({ pvDate: dmyToday(), paymentMode: 'ONLINE', chequeNo: '', remark: '' })

export const searchSchema = yup.object({
  payor: optionalText(),
  hospital: optionalText(),
  caseFrom: optionalText(),
  caseTo: optionalText(),
  bordxFrom: optionalText(),
  bordxTo: optionalText(),
  bordxDateFrom: dmyDate(),
  bordxDateTo: dmyDate().test('order', 'Bordx Date From cannot be later than Bordx Date To.', function (to) {
    const from = isoDmy(this.parent.bordxDateFrom as string)
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

export const searchParams = (v: SearchValues) => ({
  payor: text(v.payor),
  hospital: text(v.hospital),
  caseFrom: text(v.caseFrom),
  caseTo: text(v.caseTo),
  bordxFrom: text(v.bordxFrom),
  bordxTo: text(v.bordxTo),
  bordxDateFrom: day(v.bordxDateFrom),
  bordxDateTo: day(v.bordxDateTo),
})

export const rowKey = (r: HospitalClaim) => `${r.caseNo}|${r.claimVersion}`

/** Why a claim cannot be ticked (null when it can). */
export function tickProblem(r: HospitalClaim): string | null {
  if (r.payPending === 'Y') return `The payment of claim ${r.caseNo}-${r.claimVersion} is pending${r.pendingRemark ? ': ' + r.pendingRemark : ''}.`
  if (!r.pvInd || !prefixes.includes(r.pvInd)) return `Payor ${r.payorCode ?? ''} has no PV prefix.`
  if (!r.amount) return `Claim ${r.caseNo}-${r.claimVersion} has nothing payable to the hospital.`
  return null
}

export const tickableKeys = (rows: HospitalClaim[]) => rows.filter((r) => tickProblem(r) === null).map(rowKey)

/** The vouchers Generate PV will write: one per hospital and PV prefix, with the number of claims and the total. */
export function preview(ticked: HospitalClaim[]): { hospitalName: string; pvInd: string; claims: number; amount: number }[] {
  const groups = new Map<string, { hospitalName: string; pvInd: string; claims: number; amount: number }>()
  for (const r of ticked) {
    const key = `${r.hospitalCode ?? ''}|${r.pvInd ?? ''}`
    const g = groups.get(key) ?? { hospitalName: r.hospitalName ?? r.hospitalCode ?? '', pvInd: r.pvInd ?? '', claims: 0, amount: 0 }
    g.claims += 1
    g.amount = Math.round((g.amount + (r.amount ?? 0)) * 100) / 100
    groups.set(key, g)
  }
  return [...groups.values()].sort((a, b) => a.hospitalName.localeCompare(b.hospitalName) || a.pvInd.localeCompare(b.pvInd))
}

/** The confirmation before the vouchers are written, or the reason they cannot be. */
export function generateProblem(ticked: HospitalClaim[]): string | null {
  if (ticked.length === 0) return 'Please select the claims to pay.'
  const nothing = preview(ticked).find((g) => g.amount <= 0)
  return nothing ? `The payment to ${nothing.hospitalName} adds up to ${formatMoney(nothing.amount)}: a PV has to be more than 0.` : null
}

export function confirmText(ticked: HospitalClaim[], v: PvValues): string {
  const groups = preview(ticked)
  const total = groups.reduce((s, g) => s + g.amount, 0)
  return `Generate ${groups.length} PV(s) for ${ticked.length} claim(s), ${formatMoney(total)} in all, dated ${v.pvDate}, paid by ${v.paymentMode}?`
}

export const pvBody = (v: PvValues, ticked: HospitalClaim[]) => ({
  pvDate: isoDmy(v.pvDate),
  paymentMode: v.paymentMode,
  chequeNo: v.paymentMode === 'CHEQUE' ? v.chequeNo.trim() : undefined,
  remark: v.remark.trim() || undefined,
  claims: ticked.map((r) => ({ caseNo: r.caseNo, claimVersion: r.claimVersion })),
})

const d = (v: string | null) => isoToDmy(v)
const m = (v: number | null) => (v == null ? '' : formatMoney(v))

export const claimColumns: (CsvColumn<HospitalClaim> & { right?: boolean })[] = [
  { label: 'Hospital', value: (r) => r.hospitalName ?? r.hospitalCode ?? '' },
  { label: 'Claim No', value: (r) => `${r.caseNo}-${r.claimVersion}` },
  { label: 'Member No', value: (r) => r.memberNo ?? '' },
  { label: 'Payor', value: (r) => r.payorCode ?? '' },
  { label: 'PV', value: (r) => r.pvInd ?? '' },
  { label: 'Bordx No', value: (r) => r.bordxNo ?? '' },
  { label: 'Bordx Date', value: (r) => d(r.bordxDate) },
  { label: 'Inv Date', value: (r) => d(r.invDate) },
  { label: 'Invoices', value: (r) => String(r.invoices) },
  { label: 'Payable 2H', value: (r) => m(r.amount), right: true },
  { label: 'Pending', value: (r) => (r.payPending === 'Y' ? `Y ${r.pendingRemark ?? ''}`.trim() : '') },
  { label: 'Payee', value: (r) => r.payee ?? '' },
]

export const voucherColumns: (CsvColumn<Voucher> & { right?: boolean })[] = [
  { label: 'PV No', value: (v) => v.pvNo },
  { label: 'Hospital', value: (v) => v.hospitalName ?? '' },
  { label: 'Payee', value: (v) => v.payee ?? '' },
  { label: 'Claims', value: (v) => String(v.claims) },
  { label: 'Amount', value: (v) => formatMoney(v.amount), right: true },
  { label: 'Cheque No', value: (v) => v.chequeNo },
  { label: 'In Words', value: (v) => `${v.wording}${v.wordingTwo}` },
]
