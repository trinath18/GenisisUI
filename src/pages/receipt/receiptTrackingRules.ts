// Receipt > Receipt Tracking (legacy FrmReceiptTracking, "Receipt Tracking"): the criteria, the query and the columns of the twelve lists the desktop had (three kinds of receipt, from the member,
// from the payor and from MNRB, each listed by claim or summed by bordx, receipt number or payor), and the file "Print to File" writes. The server repeats the checks and adds up the totals.

import * as yup from 'yup'
import type { Option } from '../../components/Field'
import type { CsvColumn } from '../../lib/exportCsv'
import { formatMoney } from '../../lib/format'
import { dmyDate, optionalText } from '../../lib/validation'
import { isoDmy, isoToDmy } from '../case/caseShared'

export type Source = 'member' | 'payor' | 'mnrb'
export type Mode = 'claim' | 'bordx' | 'receipt' | 'payor'

export interface DetailRow {
  receiptNo: string | null
  receiptDate: string | null
  amount: number | null
  payorCode: string | null
  memberNo: string | null
  memberName: string | null
  caseNo: string | null
  claimVersion: number | null
  bordxNo: string | null
  debitNoteNo: string | null
  remarks: string | null
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
  memberNo: string
  payor: string
  memberName: string
  claimFrom: string
  claimTo: string
  bordxFrom: string
  bordxTo: string
  receiptFrom: string
  receiptTo: string
  dateFrom: string
  dateTo: string
  acMonthFrom: string
  acMonthTo: string
  acYearFrom: string
  acYearTo: string
  debitFrom: string
  debitTo: string
  amountFrom: string
  amountTo: string
}

/** OptMBM (selected when the form opens), OptPayor, OptMNRB. */
export const sourceOptions: Option[] = [
  { value: 'member', label: 'Member' },
  { value: 'payor', label: 'Payor' },
  { value: 'mnrb', label: 'MNRB' },
]

/** Option2 (selected when the form opens), Option1, Option3, Option4. */
export const modeOptions: Option[] = [
  { value: 'claim', label: 'By Claim' },
  { value: 'bordx', label: 'By Bordx' },
  { value: 'receipt', label: 'By Receipt No' },
  { value: 'payor', label: 'By Payor' },
]

/** CboHLTCode. */
export const healthOptions: Option[] = [
  { value: 'S', label: 'S - Sihat' },
  { value: 'N', label: 'N - Non-Sihat' },
]

export const trackingDefaults: TrackingValues = {
  source: 'member',
  mode: 'claim',
  healthType: '',
  memberNo: '',
  payor: '',
  memberName: '',
  claimFrom: '',
  claimTo: '',
  bordxFrom: '',
  bordxTo: '',
  receiptFrom: '',
  receiptTo: '',
  dateFrom: '',
  dateTo: '',
  acMonthFrom: '',
  acMonthTo: '',
  acYearFrom: '',
  acYearTo: '',
  debitFrom: '',
  debitTo: '',
  amountFrom: '',
  amountTo: '',
}

const amount = (label: string) => optionalText().test('number', `${label} is not a number`, (v) => !v || !Number.isNaN(Number(v.replace(/,/g, ''))))

export const trackingSchema = yup.object({
  source: yup.mixed<Source>().oneOf(['member', 'payor', 'mnrb']).required(),
  mode: yup.mixed<Mode>().oneOf(['claim', 'bordx', 'receipt', 'payor']).required(),
  healthType: optionalText(),
  memberNo: optionalText(),
  payor: optionalText(),
  memberName: optionalText(),
  claimFrom: optionalText(),
  claimTo: optionalText(),
  bordxFrom: optionalText(),
  bordxTo: optionalText(),
  receiptFrom: optionalText(),
  receiptTo: optionalText(),
  dateFrom: dmyDate(),
  dateTo: dmyDate(),
  acMonthFrom: optionalText(),
  acMonthTo: optionalText(),
  acYearFrom: optionalText(),
  acYearTo: optionalText(),
  debitFrom: optionalText(),
  debitTo: optionalText(),
  amountFrom: amount('Amount From'),
  amountTo: amount('Amount To'),
}) as yup.ObjectSchema<TrackingValues>

const text = (v: string) => v.trim() || undefined
const day = (v: string) => isoDmy(v) ?? undefined
const money = (v: string) => (v.trim() === '' ? undefined : Number(v.replace(/,/g, '')))

/** The query of the search: a summary only uses the health type, payor, receipt date, bordx and receipt number ranges (the server ignores the rest, as the desktop did). */
export const trackingParams = (v: TrackingValues) => ({
  source: v.source,
  mode: v.mode,
  healthType: text(v.healthType),
  payor: text(v.payor),
  dateFrom: day(v.dateFrom),
  dateTo: day(v.dateTo),
  bordxFrom: text(v.bordxFrom),
  bordxTo: text(v.bordxTo),
  receiptFrom: text(v.receiptFrom),
  receiptTo: text(v.receiptTo),
  ...(v.mode === 'claim'
    ? {
        memberNo: text(v.memberNo),
        memberName: text(v.memberName),
        claimFrom: text(v.claimFrom),
        claimTo: text(v.claimTo),
        acMonthFrom: text(v.acMonthFrom),
        acMonthTo: text(v.acMonthTo),
        acYearFrom: text(v.acYearFrom),
        acYearTo: text(v.acYearTo),
        debitFrom: text(v.debitFrom),
        debitTo: text(v.debitTo),
        amountFrom: money(v.amountFrom),
        amountTo: money(v.amountTo),
      }
    : {}),
})

const d = (value: string | null) => isoToDmy(value)
const m = (value: number | null) => (value == null ? '' : formatMoney(value))
const n = (value: number | null) => (value == null ? '' : String(value))

const fromLabel = (source: Source) => (source === 'member' ? 'Amt Receipt Fr MBM' : source === 'payor' ? 'Amt Receipt Fr Payor' : 'Amt Receipt Fr MNRB')

/** The columns of a list, headed as the desktop headed them. */
export function trackingColumns(source: Source, mode: Mode): { detail: CsvColumn<DetailRow>[]; summary: CsvColumn<SummaryRow>[] } {
  const detail: CsvColumn<DetailRow>[] =
    source === 'member'
      ? [
          { label: 'Receipt No', value: (r) => r.receiptNo ?? '' },
          { label: 'Receipt Date', value: (r) => d(r.receiptDate) },
          { label: 'Amount', value: (r) => m(r.amount) },
          { label: 'Payor', value: (r) => r.payorCode ?? '' },
          { label: 'Member No', value: (r) => r.memberNo ?? '' },
          { label: 'Member Name', value: (r) => r.memberName ?? '' },
          { label: 'Claim No', value: (r) => (r.caseNo ? `${r.caseNo}-${r.claimVersion ?? ''}` : '') },
          { label: 'D/N No', value: (r) => r.debitNoteNo ?? '' },
          { label: 'Remarks', value: (r) => r.remarks ?? '' },
          { label: 'A/C Period', value: (r) => (r.accMonth || r.accYear ? `${r.accMonth ?? ''}/${r.accYear ?? ''}` : '') },
        ]
      : [
          { label: 'Receipt No', value: (r) => r.receiptNo ?? '' },
          { label: 'Receipt Date', value: (r) => d(r.receiptDate) },
          { label: "Rec't Amt", value: (r) => m(r.amount) },
          { label: 'Member No', value: (r) => r.memberNo ?? '' },
          { label: 'Member Name', value: (r) => r.memberName ?? '' },
          { label: 'Bordx No', value: (r) => r.bordxNo ?? '' },
          { label: 'WKS No', value: (r) => (r.caseNo ? `${r.caseNo}-${r.claimVersion ?? ''}` : '') },
          { label: 'D/N No', value: (r) => r.debitNoteNo ?? '' },
          { label: 'Remarks', value: (r) => r.remarks ?? '' },
          { label: 'A/C Period', value: (r) => (r.accMonth || r.accYear ? `${r.accMonth ?? ''}/${r.accYear ?? ''}` : '') },
        ]
  const summary: CsvColumn<SummaryRow>[] =
    mode === 'payor'
      ? [
          { label: 'Payor', value: (r) => r.key1 ?? '' },
          { label: 'No of Receipt', value: (r) => n(r.cases) },
          { label: fromLabel(source), value: (r) => m(r.amount) },
        ]
      : [
          { label: mode === 'bordx' ? 'Bordx No' : 'Receipt No', value: (r) => r.key1 ?? '' },
          { label: mode === 'bordx' ? 'Bordx Date' : 'Receipt Date', value: (r) => d(r.keyDate) },
          { label: 'No of Case', value: (r) => n(r.cases) },
          { label: fromLabel(source), value: (r) => m(r.amount) },
        ]
  return { detail, summary }
}
