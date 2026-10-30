// Claim Bordx > Monitoring > Bordx Control (legacy FrmBordxControl, "Bordx Control"): the criteria, the checks the desktop made before searching, the query and the columns of the two layouts
// (Sihat payors are followed through MNRB, the others straight to the payor). The server repeats the checks.

import * as yup from 'yup'
import type { Option } from '../../components/Field'
import type { CsvColumn } from '../../lib/exportCsv'
import { formatMoney } from '../../lib/format'
import { dmyDate, optionalText } from '../../lib/validation'
import { isoDmy, isoToDmy } from '../case/caseShared'

export interface ControlPayor {
  code: string
  name: string | null
  healthCode: string | null
}

export interface ControlRow {
  payorCode: string | null
  bordxNo: string
  bordxDate: string | null
  claims: number | null
  amount: number | null
  status: string | null
  sentToPayor: string | null
  docReceived: string | null
  days: number | null
  sentToMnrb: string | null
  moneyFromMnrb: string | null
  moneyFromPayor: string | null
  days2: number | null
  totalDays: number | null
}

export interface ControlResult {
  kind: 'S' | 'N'
  rows: ControlRow[]
  totalAmount: number
  truncated: boolean
}

export interface ControlValues {
  payor: string
  bordxFrom: string
  bordxTo: string
  dateFrom: string
  dateTo: string
  payTo: string
  payDocFr: string
  mnrbTo: string
  mnrbFr: string
  payFr: string
}

/** The two "All" boxes of the desktop, offered at the top of the Payor drop-down. */
export const ALL_SIHAT = 'All Sihat'
export const ALL_NON_SIHAT = 'All Non-Sihat'

/** The radio groups start on "Both"; To MNRB's "Both" keeps only bordx that have a To MNRB status. */
export const controlDefaults: ControlValues = {
  payor: '',
  bordxFrom: '',
  bordxTo: '',
  dateFrom: '',
  dateTo: '',
  payTo: '',
  payDocFr: '',
  mnrbTo: 'B',
  mnrbFr: '',
  payFr: '',
}

export const controlSchema = yup.object({
  payor: optionalText(),
  bordxFrom: optionalText(),
  bordxTo: optionalText(),
  dateFrom: dmyDate(),
  dateTo: dmyDate(),
  payTo: optionalText(),
  payDocFr: optionalText(),
  mnrbTo: optionalText(),
  mnrbFr: optionalText(),
  payFr: optionalText(),
}) as yup.ObjectSchema<ControlValues>

const sentOptions: Option[] = [
  { value: '1', label: 'Sent' },
  { value: '0', label: 'Not Yet Sent' },
]
const moneyOptions: Option[] = [
  { value: 'F', label: 'Paid' },
  { value: 'P', label: 'Partial Paid' },
  { value: 'U', label: 'Unpaid' },
]
export const payToOptions = sentOptions
export const payDocOptions: Option[] = [
  { value: '1', label: 'Received' },
  { value: '0', label: 'Not Yet Received' },
]
export const mnrbToOptions: Option[] = [{ value: 'B', label: 'Both' }, ...sentOptions]
export const moneyFromOptions = moneyOptions

export type Scope = 'payor' | 'allSihat' | 'allNonSihat'

/** Which of the three the Payor box holds. */
export const scopeOf = (payor: string): Scope => (payor === ALL_SIHAT ? 'allSihat' : payor === ALL_NON_SIHAT ? 'allNonSihat' : 'payor')

/** The payor code of "CODE - Name". */
export const payorCodeOf = (payor: string) => payor.split(' - ')[0].trim().toUpperCase()

/** The layout the choice gives: S, N, or undefined while no payor is chosen (cboPayor_Click read the payor's HLTCode; anything but N is the Sihat layout). */
export const kindOf = (payor: string, payors: readonly ControlPayor[]): 'S' | 'N' | undefined => {
  const scope = scopeOf(payor)
  if (scope === 'allSihat') return 'S'
  if (scope === 'allNonSihat') return 'N'
  const known = payors.find((p) => p.code.toUpperCase() === payorCodeOf(payor))
  return known ? (known.healthCode?.toUpperCase() === 'N' ? 'N' : 'S') : undefined
}

/** cmdSearch_Click: a payor is needed unless an "All" is chosen. */
export const controlProblem = (v: Pick<ControlValues, 'payor'>) => (v.payor.trim() === '' ? 'Please Enter Payor Code.' : null)

const text = (v: string) => v.trim() || undefined
const day = (v: string) => isoDmy(v) ?? undefined

/** The query of the search. */
export const controlParams = (v: ControlValues) => ({
  scope: scopeOf(v.payor),
  payor: scopeOf(v.payor) === 'payor' ? payorCodeOf(v.payor) : undefined,
  bordxFrom: text(v.bordxFrom),
  bordxTo: text(v.bordxTo),
  dateFrom: day(v.dateFrom),
  dateTo: day(v.dateTo),
  payTo: text(v.payTo),
  payDocFr: text(v.payDocFr),
  mnrbTo: text(v.mnrbTo),
  mnrbFr: text(v.mnrbFr),
  payFr: text(v.payFr),
})

const d = (value: string | null) => isoToDmy(value)
const n = (value: number | null) => (value == null ? '' : String(value))

/** The columns of a layout; the payor column is added when the list holds several payors. */
export function controlColumns(kind: 'S' | 'N', withPayor: boolean): CsvColumn<ControlRow>[] {
  const first: CsvColumn<ControlRow>[] = [
    { label: 'Bordx No', value: (r) => r.bordxNo },
    { label: 'Bordx Date', value: (r) => d(r.bordxDate) },
    { label: 'No of Claims', value: (r) => n(r.claims) },
    { label: 'Bordx Amt', value: (r) => (r.amount == null ? '' : formatMoney(r.amount)) },
    { label: 'Bordx Status', value: (r) => r.status ?? '' },
    { label: 'DTP', value: (r) => d(r.sentToPayor) },
    { label: 'DRP (Doc)', value: (r) => d(r.docReceived) },
    { label: 'No of Days (DRP - DTP)', value: (r) => n(r.days) },
  ]
  const rest: CsvColumn<ControlRow>[] =
    kind === 'S'
      ? [
          { label: 'DTMNRB', value: (r) => d(r.sentToMnrb) },
          { label: 'DFMNRB (Money)', value: (r) => d(r.moneyFromMnrb) },
          { label: 'No of Days (Date Fr MNRB - Date to MNRB)', value: (r) => n(r.days2) },
          { label: 'Total Days', value: (r) => n(r.totalDays) },
        ]
      : [
          { label: 'DFPayor (Money)', value: (r) => d(r.moneyFromPayor) },
          { label: 'No of Days (DTP - DPayment)', value: (r) => n(r.days2) },
        ]
  return [...(withPayor ? [{ label: 'Payor', value: (r: ControlRow) => r.payorCode ?? '' }] : []), ...first, ...rest]
}
