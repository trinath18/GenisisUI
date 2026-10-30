// Claim Bordx > Monitoring > Outstanding Bordx (legacy FrmOSBordx, "Outstanding Bordx"): the criteria, the check the desktop made before searching, the query, the columns of the lists and the
// file "Print" writes. The server repeats the check and works out the days and the totals.

import * as yup from 'yup'
import type { Option } from '../../components/Field'
import type { CsvColumn } from '../../lib/exportCsv'
import { formatMoney } from '../../lib/format'
import { dmyDate, optionalText } from '../../lib/validation'
import { isoDmy, isoToDmy } from '../case/caseShared'
import { payorCodeOf, scopeOf } from './bordxControlRules'

export interface OutstandingRow {
  item: number
  bordxNo: string | null
  payorCode: string | null
  claims: number | null
  amount: number | null
  sentDate: string | null
  days: number | null
  within14: number | null
  over14: number | null
}

export interface OutstandingSection {
  key: 'payor' | 'mnrb' | 'nonSihat'
  title: string
  rows: OutstandingRow[]
  subTotal: number
  within14: number
  over14: number
}

export interface OutstandingResult {
  kind: 'S' | 'N'
  mode: Mode
  asAt: string
  sections: OutstandingSection[]
  totalDue: number | null
  truncated: boolean
}

export type Mode = 'detail' | 'summaryS' | 'summaryN'

export interface OutstandingValues {
  mode: Mode
  payor: string
  asAt: string
}

/** Option1 (Detail Listing), Option2 (General Summary (S)) and Option3 (General Summary (N)). */
export const modeOptions: Option[] = [
  { value: 'detail', label: 'Detail Listing' },
  { value: 'summaryS', label: 'General Summary (S)' },
  { value: 'summaryN', label: 'General Summary (N)' },
]

/** txtOSDate starts on today. */
export const outstandingDefaults = (today: Date): OutstandingValues => ({
  mode: 'detail',
  payor: '',
  asAt: `${String(today.getDate()).padStart(2, '0')}/${String(today.getMonth() + 1).padStart(2, '0')}/${today.getFullYear()}`,
})

export const outstandingSchema = yup.object({
  mode: yup.mixed<Mode>().oneOf(['detail', 'summaryS', 'summaryN']).required(),
  payor: optionalText(),
  asAt: dmyDate(),
}) as yup.ObjectSchema<OutstandingValues>

/** cmdSearch_Click: the detail listing of one payor needs the payor; an All, or a summary, does not. */
export const outstandingProblem = (v: OutstandingValues) =>
  v.mode === 'detail' && scopeOf(v.payor) === 'payor' && v.payor.trim() === '' ? 'Please Enter Payor Code.' : null

/** The query of the search. */
export const outstandingParams = (v: OutstandingValues) => ({
  mode: v.mode,
  scope: scopeOf(v.payor),
  payor: scopeOf(v.payor) === 'payor' && v.payor.trim() ? payorCodeOf(v.payor) : undefined,
  asAt: isoDmy(v.asAt) ?? undefined,
})

const d = (value: string | null) => isoToDmy(value)
const money = (value: number | null) => (value == null ? '' : formatMoney(value))
const n = (value: number | null) => (value == null ? '' : String(value))

/** The columns of a list, headed as the desktop's three ListViews were. */
export function outstandingColumns(section: OutstandingSection['key'], summary: boolean): CsvColumn<OutstandingRow>[] {
  if (summary)
    return [
      { label: 'Item No', value: (r) => n(r.item) },
      { label: 'Payor', value: (r) => r.payorCode ?? '' },
      { label: 'No of Claims', value: (r) => n(r.claims) },
      { label: 'Amount', value: (r) => money(r.amount) },
    ]
  return [
    { label: 'Item No', value: (r) => n(r.item) },
    { label: 'Bordx No', value: (r) => r.bordxNo ?? '' },
    { label: 'Payor', value: (r) => r.payorCode ?? '' },
    { label: 'Amount', value: (r) => money(r.amount) },
    { label: section === 'mnrb' ? 'DTMNRB' : section === 'nonSihat' ? 'Date sent to Payor' : 'DTP', value: (r) => d(r.sentDate) },
    { label: section === 'nonSihat' ? 'No of Days O/S' : 'O/S Days', value: (r) => n(r.days) },
    { label: 'Bordx <14 days', value: (r) => money(r.within14) },
    { label: 'Bordx >14 days', value: (r) => money(r.over14) },
  ]
}

/** The file of "Print": every list one after the other, each under its title, with a line for its totals. */
export function outstandingCsvRows(result: OutstandingResult): string[][] {
  const summary = result.mode !== 'detail'
  return result.sections.flatMap((s) => {
    const columns = outstandingColumns(s.key, summary)
    return [
      [s.title],
      columns.map((c) => c.label),
      ...s.rows.map((r) => columns.map((c) => String(c.value(r) ?? ''))),
      summary
        ? ['Sub-Total', '', '', formatMoney(s.subTotal)]
        : ['Sub-Total', '', '', formatMoney(s.subTotal), '', '', formatMoney(s.within14), formatMoney(s.over14)],
      [],
    ]
  })
}
