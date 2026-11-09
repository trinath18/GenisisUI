// Payment > Payment Tracking (legacy FrmPaymentTracking; its source is not in the source tree, so the screen is rebuilt on the PaymentTracking procedure it called): the criteria, the query and the
// columns of the lists (payments to hospitals or to members, listed by claim or summed by bordx, claim, hospital and PV date, member, payor and PV date, PV number or hospital), and the file
// "Print to File" writes. The server repeats the checks and adds up the totals.

import * as yup from 'yup'
import type { Option } from '../../components/Field'
import type { CsvColumn } from '../../lib/exportCsv'
import { formatMoney } from '../../lib/format'
import { dmyDate, optionalText } from '../../lib/validation'
import { isoDmy, isoToDmy } from '../case/caseShared'

export type Source = 'hospital' | 'member'
export type Mode = 'claim' | 'bordx' | 'case' | 'hospitalDate' | 'member' | 'payorDate' | 'pv' | 'hospital'

export interface DetailRow {
  pvNo: string | null
  pvDate: string | null
  amount: number | null
  caseNo: string | null
  claimVersion: string | null
  memberNo: string | null
  memberName: string | null
  hospitalName: string | null
  payorCode: string | null
  bordxNo: string | null
  debitNoteNo: string | null
  payTo: string | null
  status: string | null
  remark: string | null
  accMonth: string | null
  accYear: string | null
}

export interface SummaryRow {
  key1: string | null
  keyDate: string | null
  cases: number
  amount: number | null
}

export interface TrackingResult {
  source: Source
  mode: Mode
  detail: DetailRow[]
  summary: SummaryRow[]
  count: number
  totalAmount: number
  truncated: boolean
}

export interface TrackingValues {
  source: Source
  mode: Mode
  healthType: string
  payor: string
  memberNo: string
  memberName: string
  hospital: string
  status: string
  claimFrom: string
  claimTo: string
  bordxFrom: string
  bordxTo: string
  pvFrom: string
  pvTo: string
  dateFrom: string
  dateTo: string
  acMonthFrom: string
  acMonthTo: string
  acYearFrom: string
  acYearTo: string
  debitFrom: string
  debitTo: string
}

/** Payment to hospital (PaymentTracking cases 1 to 8) or to member (9 to 16). */
export const sourceOptions: Option[] = [
  { value: 'hospital', label: 'To Hospital' },
  { value: 'member', label: 'To Member' },
]

/** The eight layouts of each kind; the order follows the procedure's cases. */
export const modeOptions: Option[] = [
  { value: 'claim', label: 'By Claim' },
  { value: 'bordx', label: 'By Bordx' },
  { value: 'case', label: 'By Claim (Total)' },
  { value: 'hospitalDate', label: 'By Hospital & PV Date' },
  { value: 'member', label: 'By Member' },
  { value: 'payorDate', label: 'By Payor & PV Date' },
  { value: 'pv', label: 'By PV No' },
  { value: 'hospital', label: 'By Hospital' },
]

export const healthOptions: Option[] = [
  { value: 'S', label: 'S - Sihat' },
  { value: 'N', label: 'N - Non-Sihat' },
]

/** PVPayHOSStatus / PVPayMBMStatus as the data has them. */
export const statusOptions: Option[] = [
  { value: 'F', label: 'F - Full' },
  { value: 'P', label: 'P - Part' },
]

export const trackingDefaults: TrackingValues = {
  source: 'hospital',
  mode: 'claim',
  healthType: '',
  payor: '',
  memberNo: '',
  memberName: '',
  hospital: '',
  status: '',
  claimFrom: '',
  claimTo: '',
  bordxFrom: '',
  bordxTo: '',
  pvFrom: '',
  pvTo: '',
  dateFrom: '',
  dateTo: '',
  acMonthFrom: '',
  acMonthTo: '',
  acYearFrom: '',
  acYearTo: '',
  debitFrom: '',
  debitTo: '',
}

const modes = modeOptions.map((o) => o.value as Mode)

export const trackingSchema = yup.object({
  source: yup.mixed<Source>().oneOf(['hospital', 'member']).required(),
  mode: yup.mixed<Mode>().oneOf(modes).required(),
  healthType: optionalText(),
  payor: optionalText(),
  memberNo: optionalText(),
  memberName: optionalText(),
  hospital: optionalText(),
  status: optionalText(),
  claimFrom: optionalText(),
  claimTo: optionalText(),
  bordxFrom: optionalText(),
  bordxTo: optionalText(),
  pvFrom: optionalText(),
  pvTo: optionalText(),
  dateFrom: dmyDate(),
  dateTo: dmyDate().test('order', 'PV Date From cannot be later than PV Date To.', function (to) {
    const from = isoDmy(this.parent.dateFrom as string)
    const until = isoDmy(to ?? '')
    return !from || !until || from <= until
  }),
  acMonthFrom: optionalText(),
  acMonthTo: optionalText(),
  acYearFrom: optionalText(),
  acYearTo: optionalText(),
  debitFrom: optionalText(),
  debitTo: optionalText(),
}) as yup.ObjectSchema<TrackingValues>

const text = (v: string) => v.trim() || undefined
const day = (v: string) => isoDmy(v) ?? undefined

/** The query of the search. Every criterion applies to every layout; the debit note range only exists for payments to members. */
export const trackingParams = (v: TrackingValues) => ({
  source: v.source,
  mode: v.mode,
  healthType: text(v.healthType),
  payor: text(v.payor),
  memberNo: text(v.memberNo),
  memberName: text(v.memberName),
  hospital: text(v.hospital),
  status: text(v.status),
  claimFrom: text(v.claimFrom),
  claimTo: text(v.claimTo),
  bordxFrom: text(v.bordxFrom),
  bordxTo: text(v.bordxTo),
  pvFrom: text(v.pvFrom),
  pvTo: text(v.pvTo),
  dateFrom: day(v.dateFrom),
  dateTo: day(v.dateTo),
  acMonthFrom: text(v.acMonthFrom),
  acMonthTo: text(v.acMonthTo),
  acYearFrom: text(v.acYearFrom),
  acYearTo: text(v.acYearTo),
  ...(v.source === 'member' ? { debitFrom: text(v.debitFrom), debitTo: text(v.debitTo) } : {}),
})

const d = (value: string | null) => isoToDmy(value)
const m = (value: number | null) => (value == null ? '' : formatMoney(value))
const n = (value: number | null) => (value == null ? '' : String(value))
const claim = (r: DetailRow) => (r.caseNo ? `${r.caseNo}-${r.claimVersion ?? ''}` : '')
const period = (r: DetailRow) => (r.accMonth || r.accYear ? `${r.accMonth ?? ''}/${r.accYear ?? ''}` : '')

/** The heading of the grouping column of each summary, and whether it has a date. */
const summaryKeys: Record<Exclude<Mode, 'claim'>, { key: string; date?: string }> = {
  bordx: { key: 'Bordx No', date: 'Bordx Date' },
  case: { key: 'Claim No' },
  hospitalDate: { key: 'Hospital', date: 'PV Date' },
  member: { key: 'Member No' },
  payorDate: { key: 'Payor', date: 'PV Date' },
  pv: { key: 'PV No', date: 'PV Date' },
  hospital: { key: 'Hospital' },
}

/** The columns of a list (also the columns of the file). */
export function trackingColumns(source: Source, mode: Mode): { detail: CsvColumn<DetailRow>[]; summary: CsvColumn<SummaryRow>[] } {
  const paid = source === 'hospital' ? 'Amt Paid 2H' : 'Amt Paid 2M'
  const detail: CsvColumn<DetailRow>[] =
    source === 'hospital'
      ? [
          { label: 'PV No', value: (r) => r.pvNo ?? '' },
          { label: 'PV Date', value: (r) => d(r.pvDate) },
          { label: paid, value: (r) => m(r.amount) },
          { label: 'Claim No', value: claim },
          { label: 'Member No', value: (r) => r.memberNo ?? '' },
          { label: 'Member Name', value: (r) => r.memberName ?? '' },
          { label: 'Hospital', value: (r) => r.hospitalName ?? '' },
          { label: 'Payor', value: (r) => r.payorCode ?? '' },
          { label: 'Bordx No', value: (r) => r.bordxNo ?? '' },
          { label: 'Status', value: (r) => r.status ?? '' },
          { label: 'Remark', value: (r) => r.remark ?? '' },
          { label: 'A/C Period', value: period },
        ]
      : [
          { label: 'PV No', value: (r) => r.pvNo ?? '' },
          { label: 'PV Date', value: (r) => d(r.pvDate) },
          { label: paid, value: (r) => m(r.amount) },
          { label: 'Claim No', value: claim },
          { label: 'Member No', value: (r) => r.memberNo ?? '' },
          { label: 'Member Name', value: (r) => r.memberName ?? '' },
          { label: 'Pay To', value: (r) => r.payTo ?? '' },
          { label: 'D/N No', value: (r) => r.debitNoteNo ?? '' },
          { label: 'Hospital', value: (r) => r.hospitalName ?? '' },
          { label: 'Payor', value: (r) => r.payorCode ?? '' },
          { label: 'Status', value: (r) => r.status ?? '' },
          { label: 'Remark', value: (r) => r.remark ?? '' },
          { label: 'A/C Period', value: period },
        ]
  const summary: CsvColumn<SummaryRow>[] = []
  if (mode !== 'claim') {
    const k = summaryKeys[mode]
    summary.push({ label: k.key, value: (r) => r.key1 ?? '' })
    if (k.date) summary.push({ label: k.date, value: (r) => d(r.keyDate) })
    summary.push({ label: 'No of Case', value: (r) => n(r.cases) }, { label: paid, value: (r) => m(r.amount) })
  }
  return { detail, summary }
}
