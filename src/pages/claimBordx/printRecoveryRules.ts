// Claim Bordx > Print Recovery (legacy frmGenerateRecovery, "Generate Recovery Listing"): the criteria, the check the desktop made before searching, the query, the columns of the list and the
// recovery listing "Print" wrote into an Excel template (here a CSV with the template's columns). The server repeats the check and adds up the totals.

import * as yup from 'yup'
import type { CsvColumn } from '../../lib/exportCsv'
import { formatMoney } from '../../lib/format'
import { dmyDate, optionalText } from '../../lib/validation'
import { isoDmy, isoToDmy } from '../case/caseShared'

export interface RecoveryCompany {
  name: string
  reportType: string | null
}

export interface RecoveryRow {
  caseNo: string
  claimVersion: number
  patientName: string | null
  patientIc: string | null
  memberNo: string | null
  memberName: string | null
  memberIc: string | null
  employeeNo: string | null
  deptCode: string | null
  department: string | null
  costCenter: string | null
  planCode: string | null
  dateAdmitted: string | null
  dateDischarged: string | null
  claimOpenDate: string | null
  invoiceDate: string | null
  hospital: string | null
  diagnosis1: string | null
  diagnosis2: string | null
  diagnosis3: string | null
  debitNoteNo: string | null
  bordxAmount: number | null
  recovery: number | null
  actualAmount: number | null
  bordxNo: string | null
  payorName: string | null
  policyNo: string | null
  payorEffDate: string | null
  payorExpDate: string | null
}

export interface RecoveryResult {
  reportType: string | null
  rows: RecoveryRow[]
  totalBordxAmount: number
  totalRecovery: number
  totalActual: number
  truncated: boolean
}

export interface RecoveryValues {
  company: string
  bordxFrom: string
  bordxTo: string
  bordxDateFrom: string
  bordxDateTo: string
  openFrom: string
  openTo: string
}

export const recoveryDefaults: RecoveryValues = { company: '', bordxFrom: '', bordxTo: '', bordxDateFrom: '', bordxDateTo: '', openFrom: '', openTo: '' }

export const recoverySchema = yup.object({
  company: optionalText(),
  bordxFrom: optionalText(),
  bordxTo: optionalText(),
  bordxDateFrom: dmyDate(),
  bordxDateTo: dmyDate(),
  openFrom: dmyDate(),
  openTo: dmyDate(),
}) as yup.ObjectSchema<RecoveryValues>

/** CmdSearch_Click: a group company is needed. */
export const recoveryProblem = (v: Pick<RecoveryValues, 'company'>) => (v.company.trim() === '' ? 'Please select Group Company' : null)

const text = (v: string) => v.trim() || undefined
const day = (v: string) => isoDmy(v) ?? undefined

/** The query of the search. */
export const recoveryParams = (v: RecoveryValues) => ({
  company: v.company.trim(),
  bordxFrom: text(v.bordxFrom),
  bordxTo: text(v.bordxTo),
  bordxDateFrom: day(v.bordxDateFrom),
  bordxDateTo: day(v.bordxDateTo),
  openFrom: day(v.openFrom),
  openTo: day(v.openTo),
})

const d = (value: string | null) => isoToDmy(value)
const money = (value: number | null) => (value == null ? '' : formatMoney(value))

/** The recovery as the list and the listing show it: the database holds it negative, the desktop multiplied it by -1. */
export const shownRecovery = (value: number | null) => (value == null ? null : value === 0 ? 0 : -value)

/** The columns of the list on the screen. */
export const recoveryListColumns: CsvColumn<RecoveryRow>[] = [
  { label: 'Case No', value: (r) => `${r.caseNo}-${r.claimVersion}` },
  { label: 'Patient', value: (r) => r.patientName ?? '' },
  { label: 'Member No', value: (r) => r.memberNo ?? '' },
  { label: 'Hospital', value: (r) => r.hospital ?? '' },
  { label: 'Actual Amt', value: (r) => money(r.actualAmount) },
  { label: 'Recovery', value: (r) => money(shownRecovery(r.recovery)) },
  { label: 'Bordx Amt', value: (r) => money(r.bordxAmount) },
  { label: 'Bordx Ref', value: (r) => r.bordxNo ?? '' },
]

const diagnosis = (r: RecoveryRow) => `${r.diagnosis1 ?? ''}/${r.diagnosis2 ?? ''}/${r.diagnosis3 ?? ''}`

/** The columns of the Recovery Listing: layout 1 (BTBGRpt = 1, the standard template) or layout 2 (the MDEC template). */
export function listingColumns(reportType: string | null): CsvColumn<RecoveryRow>[] {
  return reportType === '2'
    ? [
        { label: 'Case No', value: (r) => `${r.caseNo}-${r.claimVersion}` },
        { label: 'Patient Name', value: (r) => r.patientName ?? '' },
        { label: 'IC No', value: (r) => r.patientIc ?? '' },
        { label: 'Member Name', value: (r) => r.memberName ?? '' },
        { label: 'Employee No', value: (r) => r.employeeNo ?? '' },
        { label: 'Cost Centre', value: (r) => r.costCenter ?? '' },
        { label: 'Invoice Date', value: (r) => d(r.invoiceDate) },
        { label: 'Date Admitted', value: (r) => d(r.dateAdmitted) },
        { label: 'Date Discharged', value: (r) => d(r.dateDischarged) },
        { label: 'Hospital', value: (r) => r.hospital ?? '' },
        { label: 'Diagnosis', value: diagnosis },
        { label: 'Debit Note No', value: (r) => r.debitNoteNo ?? '' },
        { label: 'Bordx Amt', value: (r) => money(r.bordxAmount) },
        { label: 'Recovery', value: (r) => money(shownRecovery(r.recovery)) },
        { label: 'Actual Amt', value: (r) => money(r.actualAmount) },
      ]
    : [
        { label: 'Case No', value: (r) => `${r.caseNo}-${r.claimVersion}` },
        { label: 'Patient Name', value: (r) => r.patientName ?? '' },
        { label: 'IC No', value: (r) => r.patientIc ?? '' },
        { label: 'Member Name', value: (r) => r.memberName ?? '' },
        { label: 'Member IC/BC/PP', value: (r) => r.memberIc ?? '' },
        { label: 'Employee No', value: (r) => r.employeeNo ?? '' },
        { label: 'Dept Code', value: (r) => r.deptCode ?? '' },
        { label: 'Department', value: (r) => r.department ?? '' },
        { label: 'Plan Code', value: (r) => r.planCode ?? '' },
        { label: 'Date Admitted', value: (r) => d(r.dateAdmitted) },
        { label: 'Date Discharged', value: (r) => d(r.dateDischarged) },
        { label: 'Claim Open Date', value: (r) => d(r.claimOpenDate) },
        { label: 'Hospital', value: (r) => r.hospital ?? '' },
        { label: 'Diagnosis', value: diagnosis },
        { label: 'Bordx Amt', value: (r) => money(r.bordxAmount) },
        { label: 'Recovery', value: (r) => money(shownRecovery(r.recovery)) },
        { label: 'Actual Amt', value: (r) => money(r.actualAmount) },
      ]
}

/** The payment note the template carries under the totals. */
export const PAYMENT_NOTE = 'Kindly note that payment term is 14 days and payment should be issued to MediExpress (Malaysia) Sdn Bhd'

/**
 * The file "Print" writes: the payor, the policy, its period and today's date at the top (the first row's), the rows numbered from 1, the totals under the amount columns and the payment note.
 * Layout 1 has the three amounts last, layout 2 too; the totals line sits under them.
 */
export function listingRows(result: RecoveryResult, today: string): string[][] {
  const columns = listingColumns(result.reportType)
  const first = result.rows[0]
  const period = first ? `${d(first.payorEffDate)} To ${d(first.payorExpDate)}` : ''
  const amountColumns = 3
  return [
    ['Payor', first?.payorName ?? ''],
    ['Policy No', first?.policyNo ?? ''],
    ['Period', period],
    ['Date', today],
    [],
    ['No', ...columns.map((c) => c.label)],
    ...result.rows.map((r, i) => [String(i + 1), ...columns.map((c) => String(c.value(r) ?? ''))]),
    [],
    [
      ...Array<string>(columns.length - amountColumns + 1).fill(''),
      formatMoney(result.totalBordxAmount),
      formatMoney(-result.totalRecovery),
      formatMoney(result.totalActual),
    ],
    [],
    [PAYMENT_NOTE],
  ]
}
