// Contribution Billing > Refund Listing (legacy frmMCORefundListing2, "MCO Refund Listing"): the criteria, the checks the desktop made before searching, the query and the columns of the list and of the
// file "Print" writes. The server repeats the checks and works out the refund (Min.) and the totals. "Print CR Note" (which writes credit note numbers) is not part of this screen.

import * as yup from 'yup'
import type { Option } from '../../components/Field'
import type { CsvColumn } from '../../lib/exportCsv'
import { formatMoney } from '../../lib/format'
import { dmyDate, optionalText } from '../../lib/validation'
import { isoDmy, isoToDmy } from '../case/caseShared'

export interface RefundRow {
  kind: 'principal' | 'supplementary'
  memberNo: string
  coverId: string | null
  policyNo: string | null
  memberName: string | null
  status: string | null
  icNo: string | null
  bordxDate: string | null
  payorEffDate: string | null
  payorExpDate: string | null
  daysInsured: number | null
  endtEffDate: string | null
  endtBordxDate: string | null
  daysUtilised: number | null
  monthsUtilised: number
  mcoFee: number
  mcoUtilised: number
  mcoRefund: number | null
  mcoRefundMin: number
  invoiceNo: string | null
  invoiceDate: string | null
  remarks: string | null
  creditNote: string | null
  creditDate: string | null
}

export interface RefundResult {
  rows: RefundRow[]
  principals: number
  supplementary: number
  totalRefund: number
  truncated: boolean
}

export interface RefundValues {
  dateBy: string
  payor: string
  dateFrom: string
  dateTo: string
  printed: string
}

/** CboDateSelection: "Endt. Eff Date" and "Endt. Bordx Date". */
export const dateByOptions: Option[] = [
  { value: 'effective', label: 'Endt. Eff Date' },
  { value: 'bordx', label: 'Endt. Bordx Date' },
]

/** CboPrintStatus: "N - No", "Y - Yes". */
export const printedOptions: Option[] = [
  { value: 'N', label: 'N - No' },
  { value: 'Y', label: 'Y - Yes' },
]

export const refundDefaults: RefundValues = { dateBy: '', payor: '', dateFrom: '', dateTo: '', printed: 'N' }

export const refundSchema = yup.object({
  dateBy: optionalText(),
  payor: optionalText(),
  dateFrom: dmyDate(),
  dateTo: dmyDate(),
  printed: optionalText(),
}) as yup.ObjectSchema<RefundValues>

/** The label of the date boxes follows the date selection (CboDateSelection_Click). */
export const dateLabel = (dateBy: string) => (dateBy === 'bordx' ? 'Endt. Bordx Date' : 'Endt. Eff Date')

/** cmdSearch_Click's checks, in the desktop's order; null when the search may go ahead. */
export const refundProblem = (v: RefundValues) => {
  if (v.dateBy.trim() === '') return { field: 'dateBy' as const, message: 'Please Select Date Selection!' }
  if (v.payor.trim() === '') return { field: 'payor' as const, message: 'Please Select Payor!' }
  return null
}

const day = (v: string) => isoDmy(v) ?? undefined

/** The query of the search. */
export const refundParams = (v: RefundValues) => ({
  dateBy: v.dateBy,
  payor: v.payor.trim(),
  dateFrom: day(v.dateFrom),
  dateTo: day(v.dateTo),
  printed: v.printed || 'N',
})

/** The name as the desktop showed it: with the member's status after it. */
export const shownName = (r: Pick<RefundRow, 'memberName' | 'status'>) =>
  `${(r.memberName ?? '').trim()}${r.status?.trim() === 'C' ? ' (Cancelled)' : r.status?.trim() === 'P' ? ' (Pending)' : ''}`

const d = (value: string | null) => isoToDmy(value)
const m = (value: number | null) => (value == null ? '' : formatMoney(value))

/** The columns of the list and of "Print", headed as the desktop headed them (the type of the line is added at the end). */
export const refundColumns: CsvColumn<RefundRow>[] = [
  { label: 'Member No', value: (r) => r.memberNo },
  { label: 'Cover ID', value: (r) => r.coverId ?? '' },
  { label: 'Policy No', value: (r) => r.policyNo ?? '' },
  { label: 'Member Name', value: shownName },
  { label: 'I/C No', value: (r) => r.icNo ?? '' },
  { label: 'Bordx Date', value: (r) => d(r.bordxDate) },
  { label: 'Eff. Date', value: (r) => d(r.payorEffDate) },
  { label: 'Exp. Date', value: (r) => d(r.payorExpDate) },
  { label: 'Days Insured', value: (r) => (r.daysInsured == null ? '' : String(r.daysInsured)) },
  { label: 'Cancellation Date', value: (r) => d(r.endtEffDate) },
  { label: 'Endt. Bordx Date', value: (r) => d(r.endtBordxDate) },
  { label: 'Days Utilised', value: (r) => (r.daysUtilised == null ? '' : String(r.daysUtilised)) },
  { label: 'Month Utilised', value: (r) => String(r.monthsUtilised) },
  { label: 'MCO fees Charged', value: (r) => m(r.mcoFee) },
  { label: 'MCO fees Utilised', value: (r) => m(r.mcoUtilised) },
  { label: 'MCO fees Refund', value: (r) => (r.mcoRefund == null ? '0.00' : m(r.mcoRefund)) },
  { label: 'MCO fees Refund (Min.)', value: (r) => m(r.mcoRefundMin) },
  { label: 'Invoice No', value: (r) => r.invoiceNo ?? '' },
  { label: 'Invoice Date', value: (r) => d(r.invoiceDate) },
  { label: 'Remarks', value: (r) => r.remarks ?? '' },
  { label: 'Credit Note', value: (r) => r.creditNote ?? '' },
  { label: 'Credit Date', value: (r) => d(r.creditDate) },
  { label: 'Type', value: (r) => (r.kind === 'principal' ? 'Principal' : 'Supplementary') },
]
