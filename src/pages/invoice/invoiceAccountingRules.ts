// Invoice > Invoice HOS Accounting (legacy FrmInvoiceHOSAC) and Invoice MBM Accounting (legacy FrmInvoiceMBMAC): the types of the server's rows, the criteria forms, the
// query parameters, the DR/CR columns as the desktop's listing wrote them and what a print changes in the rows, as pure rules the pages use.

import * as yup from 'yup'
import type { Option } from '../../components/Field'
import { formatMoney } from '../../lib/format'
import { dmyDate } from '../../lib/validation'
import { isoDmy } from '../case/caseShared'

export const nothingListed = 'Please select a record(s) before proceeding!'
export const noPrintStatus = 'Please select Print Status'
export const printQuestion = 'Do you want to print the record?'
export const updateQuestion = 'Do you want to update the record?'

export const printStatusOptions: Option[] = [
  { value: 'N', label: 'N - New' },
  { value: 'R', label: 'R - Reprint' },
]

/** The columns the two lists share after their own: the amounts and the batch. */
export interface AccountingAmounts {
  key: string
  payable: number | null
  previousAmount: number | null
  batchDate: string | null
  batchNo: number | null
  debit: number | null
  credit: number | null
}

export interface HospitalAccountingRow extends AccountingAmounts {
  hospitalCode: string | null
  hospital: string | null
  invoiceNo: string | null
  invoiceDate: string | null
  registeredDate: string | null
  caseNo: string
  version: string
  bordxNo: string | null
  memberNo: string | null
  memberName: string | null
  patientName: string | null
  debitCreditRefNo: string | null
}

export interface MemberAccountingRow extends AccountingAmounts {
  payTo: string | null
  payToCode: string | null
  caseNo: string
  version: string
  claimCloseDate: string | null
  debitCreditRefNo: string | null
  bordxNo: string | null
  memberNo: string | null
  memberName: string | null
  patientName: string | null
  bordxDate: string | null
  planCode: string | null
  totalActual: number | null
}

export interface PrintResult {
  batch: string | null
  updated: number
  rows: number
}

/** The rows the server sent, each with a key of its own (a worksheet version can be listed more than once). */
export const withKeys = <T extends object>(rows: readonly T[]): (T & { key: string })[] => rows.map((r, i) => ({ ...r, key: String(i) }))

/** The debit and credit of a listed invoice, from the amount printed before and the amount payable now (the desktop's four cases). */
export function debitCredit(previous: number | null, payable: number | null): { debit: number | null; credit: number | null } {
  const pay = payable ?? 0
  const amount =
    previous == null
      ? pay
      : previous >= 0 && pay >= 0
        ? pay - previous
        : previous < 0 && pay >= 0
          ? pay + previous
          : previous < 0 && pay < 0
            ? pay - previous
            : pay
  return amount < 0 ? { debit: -amount, credit: null } : { debit: null, credit: amount }
}

/** "#,##0.00;(#,##0.00)": a negative amount in brackets. */
export const bracketMoney = (value: number | null): string => (value == null ? '' : value < 0 ? `(${formatMoney(-value)})` : formatMoney(value))

/** The DR column: a negative result, without its sign. */
export const debitText = (row: Pick<AccountingAmounts, 'debit'>): string => (row.debit == null ? '' : formatMoney(row.debit))

/** The CR column: a positive result in brackets, and 0.00 for nothing. */
export const creditText = (row: Pick<AccountingAmounts, 'credit'>): string =>
  row.credit == null ? '' : row.credit > 0 ? `(${formatMoney(row.credit)})` : '0.00'

/** The batch label the server returns (<c>H23102026-1</c>) as the list shows it: the date part and the number of the day. */
export function batchParts(label: string): { batchDate: string; batchNo: number | null } {
  const dash = label.indexOf('-')
  const no = dash < 0 ? NaN : Number(label.slice(dash + 1))
  return { batchDate: label.slice(0, dash < 0 ? label.length : dash), batchNo: Number.isInteger(no) ? no : null }
}

/**
 * The listed rows as they stand once a print has marked them: in the batch, with the amount payable as the previous amount (so nothing is left to debit or credit).
 * <c>marks</c> says which rows the print marks (the member print marks only the member-paid invoices).
 */
export function afterPrint<T extends AccountingAmounts>(rows: readonly T[], label: string, marks: (row: T) => boolean = () => true): T[] {
  const { batchDate, batchNo } = batchParts(label)
  return rows.map((r) => {
    if (!marks(r)) return r
    const previousAmount = r.payable ?? 0
    return { ...r, batchDate, batchNo, previousAmount, ...debitCredit(previousAmount, r.payable) }
  })
}

export const totalPayable = (rows: readonly Pick<AccountingAmounts, 'payable'>[]): number => rows.reduce((sum, r) => sum + (r.payable ?? 0), 0)

const whole = yup
  .string()
  .default('')
  .test('whole', 'Enter a whole number.', (v) => !v || /^\d+$/.test(v.trim()))

const text = (v: string) => v.trim() || undefined
const date = (v: string) => isoDmy(v) ?? undefined
const count = (v: string) => (v.trim() === '' ? undefined : Number(v))

// ---------------- Invoice HOS Accounting ----------------

export interface HospitalFilterValues {
  printStatus: string
  hospitalCode: string
  invoiceDateFrom: string
  invoiceDateTo: string
  registeredFrom: string
  registeredTo: string
  batchDateFrom: string
  batchDateTo: string
  batchNoFrom: string
  batchNoTo: string
}

export const hospitalDefaults: HospitalFilterValues = {
  printStatus: 'N',
  hospitalCode: '',
  invoiceDateFrom: '',
  invoiceDateTo: '',
  registeredFrom: '',
  registeredTo: '',
  batchDateFrom: '',
  batchDateTo: '',
  batchNoFrom: '',
  batchNoTo: '',
}

export const hospitalSchema: yup.ObjectSchema<HospitalFilterValues> = yup.object({
  printStatus: yup.string().default('N').required(noPrintStatus),
  hospitalCode: yup.string().default(''),
  invoiceDateFrom: dmyDate(),
  invoiceDateTo: dmyDate(),
  registeredFrom: dmyDate(),
  registeredTo: dmyDate(),
  batchDateFrom: dmyDate(),
  batchDateTo: dmyDate(),
  batchNoFrom: whole,
  batchNoTo: whole,
})

export const hospitalParams = (v: HospitalFilterValues) => ({
  printStatus: text(v.printStatus),
  hospitalCode: text(v.hospitalCode),
  invoiceDateFrom: date(v.invoiceDateFrom),
  invoiceDateTo: date(v.invoiceDateTo),
  registeredFrom: date(v.registeredFrom),
  registeredTo: date(v.registeredTo),
  batchDateFrom: date(v.batchDateFrom),
  batchDateTo: date(v.batchDateTo),
  batchNoFrom: count(v.batchNoFrom),
  batchNoTo: count(v.batchNoTo),
})

// ---------------- Invoice MBM Accounting ----------------

export interface MemberFilterValues {
  printStatus: string
  payor: string
  closeDateFrom: string
  closeDateTo: string
  bordxDateFrom: string
  bordxDateTo: string
  batchDateFrom: string
  batchDateTo: string
  batchNoFrom: string
  batchNoTo: string
  periodMonth: string
  periodYear: string
}

export const memberDefaults: MemberFilterValues = {
  printStatus: 'N',
  payor: '',
  closeDateFrom: '',
  closeDateTo: '',
  bordxDateFrom: '',
  bordxDateTo: '',
  batchDateFrom: '',
  batchDateTo: '',
  batchNoFrom: '',
  batchNoTo: '',
  periodMonth: '',
  periodYear: '',
}

export const memberSchema: yup.ObjectSchema<MemberFilterValues> = yup.object({
  printStatus: yup.string().default('N').required(noPrintStatus),
  payor: yup.string().default(''),
  closeDateFrom: dmyDate(),
  closeDateTo: dmyDate(),
  bordxDateFrom: dmyDate(),
  bordxDateTo: dmyDate(),
  batchDateFrom: dmyDate(),
  batchDateTo: dmyDate(),
  batchNoFrom: whole,
  batchNoTo: whole,
  periodMonth: yup.string().default(''),
  periodYear: yup.string().default(''),
})

/** The payor is the text before the dash of a "CODE - Name" entry; the server keeps its first two letters. */
export const payorOf = (value: string): string => {
  const t = value.trim()
  const dash = t.indexOf(' - ')
  return (dash < 0 ? t : t.slice(0, dash)).trim()
}

export const memberParams = (v: MemberFilterValues) => ({
  printStatus: text(v.printStatus),
  payor: text(payorOf(v.payor)),
  closeDateFrom: date(v.closeDateFrom),
  closeDateTo: date(v.closeDateTo),
  bordxDateFrom: date(v.bordxDateFrom),
  bordxDateTo: date(v.bordxDateTo),
  batchDateFrom: date(v.batchDateFrom),
  batchDateTo: date(v.batchDateTo),
  batchNoFrom: count(v.batchNoFrom),
  batchNoTo: count(v.batchNoTo),
})

export const periodMonthOptions: Option[] = Array.from({ length: 12 }, (_, i) => ({ value: String(i + 1), label: String(i + 1).padStart(2, '0') }))

/** The years the "A/C Period Yr" drop-down offers: from 2000 to the year after this one. */
export const periodYearOptions = (thisYear: number): Option[] =>
  Array.from({ length: thisYear + 1 - 2000 + 1 }, (_, i) => String(thisYear + 1 - i)).map((y) => ({ value: y, label: y }))

/** cmdUpdate_Click's checks, in the desktop's order. */
export function periodProblem(
  values: Pick<MemberFilterValues, 'periodMonth' | 'periodYear'>,
  listed: number,
  ticked: number,
): { field: 'periodMonth' | 'periodYear' | null; message: string } | null {
  if (listed === 0) return { field: null, message: nothingListed }
  if (!values.periodMonth.trim()) return { field: 'periodMonth', message: 'Month cannot be Empty.' }
  if (!values.periodYear.trim()) return { field: 'periodYear', message: 'Year cannot be empty!' }
  if (ticked === 0) return { field: null, message: 'Please select at least one record to be updated! ' }
  return null
}

/** The body of the period update: the ticked worksheet versions, once each. */
export function periodRequest(
  values: Pick<MemberFilterValues, 'periodMonth' | 'periodYear'>,
  ticked: readonly Pick<MemberAccountingRow, 'caseNo' | 'version'>[],
) {
  const seen = new Set<string>()
  const items = ticked
    .filter((r) => !seen.has(`${r.caseNo}|${r.version}`) && seen.add(`${r.caseNo}|${r.version}`))
    .map((r) => ({ caseNo: r.caseNo, version: r.version }))
  return { month: Number(values.periodMonth), year: Number(values.periodYear), items }
}
