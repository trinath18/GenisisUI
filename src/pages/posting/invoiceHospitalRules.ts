// Posting > Invoice > Hospital (legacy frmPostingInvoiceHosp, "Posting - HospInv"): the criteria, the checks of Post and the lines of the journal as the screen lists and exports them. The journal itself (two
// lines per hospital invoice: the debit to the payor's account, the credit to the hospital's) is made on the server.

import * as yup from 'yup'
import type { Option } from '../../components/Field'
import { invoiceKey } from '../../features/finance/sunPosting/journalRules'
import type { CodeName, JournalLine, SearchMode } from '../../features/finance/sunPosting/types'
import { formatDate } from '../../lib/format'
import { parseDmy } from '../../lib/masks'
import { dmyDate, optionalText } from '../../lib/validation'

export interface PayorOption extends CodeName {
  healthType: string | null
}

export interface HospitalLookups {
  healthTypes: CodeName[]
  payors: PayorOption[]
  hospitals: CodeName[]
  accountingPeriods: CodeName[]
  postStatuses: CodeName[]
  bordxStatuses: CodeName[]
  /** "Posting is ended at ..." while the posting window is closed for the user; null when open. */
  postingClosedMessage: string | null
}

export interface HospitalValues {
  healthType: string
  hospital: string
  payor: string
  invoiceDateFrom: string
  invoiceDateTo: string
  invoiceNoFrom: string
  invoiceNoTo: string
  postStatus: string
  postDateFrom: string
  postDateTo: string
  bordxStatus: string
  bordxDateFrom: string
  bordxDateTo: string
  batchNoFrom: string
  batchNoTo: string
  accPeriod: string
}

export const hospitalDefaults: HospitalValues = {
  healthType: '',
  hospital: '',
  payor: '',
  invoiceDateFrom: '',
  invoiceDateTo: '',
  invoiceNoFrom: '',
  invoiceNoTo: '',
  postStatus: '0',
  postDateFrom: '',
  postDateTo: '',
  bordxStatus: '1',
  bordxDateFrom: '',
  bordxDateTo: '',
  batchNoFrom: '',
  batchNoTo: '',
  accPeriod: '',
}

export const hospitalSchema: yup.ObjectSchema<HospitalValues> = yup.object({
  healthType: optionalText(),
  hospital: optionalText(),
  payor: optionalText(),
  invoiceDateFrom: dmyDate(),
  invoiceDateTo: dmyDate(),
  invoiceNoFrom: optionalText(),
  invoiceNoTo: optionalText(),
  postStatus: optionalText(),
  postDateFrom: dmyDate(),
  postDateTo: dmyDate(),
  bordxStatus: optionalText(),
  bordxDateFrom: dmyDate(),
  bordxDateTo: dmyDate(),
  batchNoFrom: optionalText(),
  batchNoTo: optionalText(),
  accPeriod: optionalText(),
})

// The fixed lists (cboPostStatus, CboBordx) are kept in the page so the defaults ("0 - No", "1 - Yes") are selected from the first render.
export const yesNoOptions: Option[] = [
  { value: '0', label: '0 - No' },
  { value: '1', label: '1 - Yes' },
]

/** dd/mm/yyyy to yyyy-mm-dd for the API (blank stays blank). */
export const isoDay = (dmy: string) => {
  const d = parseDmy(dmy)
  return d ? `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}` : undefined
}

const text = (v: string) => v.trim() || undefined

/** The query of a search (the criteria that were filled in) for the posting list, the credit list or the debit list. */
export const searchParams = (mode: SearchMode, v: HospitalValues) => ({
  mode,
  healthType: text(v.healthType),
  hospital: text(v.hospital),
  payor: text(v.payor)?.split(' - ')[0].trim(),
  invoiceDateFrom: isoDay(v.invoiceDateFrom),
  invoiceDateTo: isoDay(v.invoiceDateTo),
  invoiceNoFrom: text(v.invoiceNoFrom),
  invoiceNoTo: text(v.invoiceNoTo),
  postStatus: text(v.postStatus),
  postDateFrom: isoDay(v.postDateFrom),
  postDateTo: isoDay(v.postDateTo),
  bordxStatus: text(v.bordxStatus),
  batchNoFrom: text(v.batchNoFrom),
  batchNoTo: text(v.batchNoTo),
  bordxDateFrom: isoDay(v.bordxDateFrom),
  bordxDateTo: isoDay(v.bordxDateTo),
})

/** chkPayor_Click: the payors of the health type chosen (all of them when none is). */
export const payorsOf = (payors: PayorOption[], healthType: string) =>
  payors.filter((p) => !healthType.trim() || (p.healthType ?? '').trim() === healthType.trim())

/** The ticked invoices (their ClaimInvoice index), once each, in list order. */
export function pickedIndexes(lines: { key: string; index: string | null; invoiceCaseNo: string }[], checked: ReadonlySet<string>) {
  const seen = new Set<string>()
  for (const l of lines) if (checked.has(l.key)) seen.add(l.invoiceCaseNo)
  return [...seen]
}

/** CmdPost_Click's screen checks before asking for confirmation, in the desktop's order (the API repeats them). */
export function postProblem(input: { picked: number; invoiceDateTo: string; bordxStatus: string; posted: boolean; accPeriod: string }): string | null {
  if (input.picked === 0) return 'Please select the record'
  if (!input.invoiceDateTo) return 'Please Enter Invoice Date(To)'
  if (input.bordxStatus === '0') return 'Please Change Bordx Status'
  if (input.posted) return 'Record(s) has been posted ! '
  if (!input.accPeriod.trim()) return 'Please Keyin for Accounting Period ! '
  return null
}

/** The request of Post. */
export const postRequest = (v: HospitalValues, picked: string[]) => ({
  accPeriod: v.accPeriod,
  invoiceDateTo: isoDay(v.invoiceDateTo) ?? null,
  bordxStatus: v.bordxStatus,
  invoiceIndexes: picked,
})

/** A line of the list with its unique key (the posting list has two lines per invoice). */
export type KeyedLine = JournalLine & { key: string }

export { invoiceKey }

const header = [
  'Chk',
  'J/T',
  'J/S',
  'DB',
  'Trans.Ref.',
  'AccPeriod',
  'Trans.Date',
  'Description',
  'AccCode',
  'Amt',
  'D/C',
  'Hospital',
  'Grp Company',
  'Payor',
  'Case No',
  'Product Cat.',
  'Bordx Ref',
  'BatchNo',
  'Index',
]

/** Print to File: the listed lines (the desktop exported the list to Excel). */
export const journalRows = (lines: JournalLine[]): string[][] => [
  header,
  ...lines.map((l) => [
    l.status,
    l.journalType,
    l.journalSource,
    l.database,
    l.transRef,
    l.accPeriod ?? '',
    formatDate(l.transDate),
    l.description,
    l.accCode,
    l.amount.toFixed(2),
    l.debitCredit,
    l.hospital,
    l.groupCompany ?? '',
    l.payor ?? '',
    l.caseNo,
    l.productCategory ?? '',
    l.bordxRef ?? '',
    l.batchNo ?? '',
    l.index ?? '',
  ]),
]
