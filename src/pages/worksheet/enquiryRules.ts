// Pure rules of Worksheet > Worksheet Enquiry (legacy frmWorksheetEnq): version choices, the "Reimbursement Not Cover" and "Topup" grids,
// and the summary rows. The API returns saved figures; nothing here recalculates a worksheet.

import type { Option } from '../../components/Field'
import { formatMoney } from '../../lib/format'

export interface EnquiryVersion {
  claimVersion: number
  claimStatus: string | null
  wsStatus: string | null
  bordxed: boolean
}

export interface EnquiryInvoice {
  invIndex: number
  bordxed: boolean
  wsDone: boolean
  wsVersion: string | null
  invNo: string | null
  invDate: string | null
  invAmount: number | null
  payTo: string | null
  payee: string | null
  claimType: string | null
  followUpDate: string | null
  dailyRb: number | null
  rbRate: number | null
  icuDays: number | null
  icuRate: number | null
  hospitalServices: number | null
  operatingTheatre: number | null
  preHospitalService: number | null
  physicianVisit: number | null
  postHospitalTreatment: number | null
  preHospitalOver60: number | null
  preHospitalGpFee: number | null
  preHospitalMedicine: number | null
  preHospitalMedicalReport: number | null
  preHospitalSpecialistFee: number | null
  postHospitalOver31Days: number | null
  postHospitalDifferentPhysician: number | null
  notCoveredOthers: number | null
}

export interface EnquiryBenefit {
  slot: number
  benefitCode: string | null
  category: string | null
  benefit: string
  days: string | null
  limit: number | null
  actual: number | null
  approved: number | null
  hospital: number | null
  member: number | null
}

export interface EnquiryHeader {
  caseNo: string
  claimVersion: number
  memberNo: string | null
  patientCovId: string | null
  memberName: string | null
  patientName: string | null
  policyNo: string | null
  payor: string | null
  payorName: string | null
  planCode: string | null
  insCode: string | null
  groupCompany: string | null
  payorEffDate: string | null
  payorExpDate: string | null
  policyStatus: string | null
  expiredStatus: string | null
  caseStatusText: string | null
  claimabilityText: string | null
  worksheetStatusText: string | null
  payType: string | null
  hospital: string | null
  admitted: string | null
  discharged: string | null
  bordxed: boolean
  bordxRefNo: string | null
  exGratia: string | null
  bordxInd: string | null
  linkCase: string | null
  linkVersion: number | null
  availableLimit: number | null
  lifetimeLimit: number | null
  takeOverLimit: number | null
  previousBalance: number | null
  balanceAfterClaim: number | null
  limitCollectedBy: string | null
  excessCollectedBy: string | null
  nonPayment: boolean
  companyApproved: number | null
  topupApproved: number | null
  topupPreviousBalance: number | null
  underwritingExcess: number | null
  debitCreditRefNo: string | null
  hosDebitCreditRefNo: string | null
  hosDebitCreditAmount: number | null
  lastDocumentDate: string | null
  payTo: string | null
  bank: string | null
  accountNo: string | null
  gpName: string | null
}

export interface EnquirySummary {
  totalActual: number
  totalApproved: number
  coPayRb: number
  totalExcess: number
  limitExceeded: number
  exGratia: number
  btbg: number
  processingFee: number
  majorMedicalFee: number
  mainTopup: number
  hospitalPayorToCollect: number
  payableToHospital: number
  payableToMember: number
  finalApprove: number
  bordxAmount: number
}

export interface EnquiryDiagnosis {
  source: string
  slot: number
  diagnosis: string | null
  onsetDate: string | null
  icdCode: string | null
}

export interface EnquiryOthers {
  worksheetRemarks: string | null
  creditDebitRemarks: string | null
  address1: string | null
  address2: string | null
  address3: string | null
  note: string | null
  postCode: string | null
  city: string | null
  state: string | null
  attention: string | null
  paymentMode: string | null
}

export interface EnquiryLgRow {
  caseNo: string
  lgNo: number
  lgDate: string | null
  lgAmt: number | null
  lgIssuedBy: string | null
  lgRemark: string | null
  lgStatus: string | null
  lgUserTime: string | null
  lgSystemTime: string | null
  reference: string | null
}

export interface EnquiryTotals {
  actual: number
  approved: number
  hospital: number
  member: number
}

export interface EnquiryResult {
  header: EnquiryHeader
  versions: EnquiryVersion[]
  selectedVersion: string
  diagnoses: EnquiryDiagnosis[]
  invoices: EnquiryInvoice[]
  benefits: EnquiryBenefit[]
  totals: EnquiryTotals
  summary: EnquirySummary
  others: EnquiryOthers | null
  lgListing: EnquiryLgRow[]
  notices: string[]
}

export interface EnquiryCaseRow {
  caseNo: string
  memberNo: string | null
  patientName: string | null
  hospital: string | null
  admitted: string | null
  discharged: string | null
  policyNo: string | null
  payor: string | null
  caseStatus: string | null
  claimability: string | null
  versions: number
}

/** cboVersion before a case is loaded lists "1" and "Master"; afterwards each version as "n" and "Mn", then "Master". */
export function versionOptions(versions: readonly { claimVersion: number }[]): Option[] {
  const list = versions.length === 0 ? [{ claimVersion: 1 }] : versions
  return [
    ...list.flatMap((v) => [
      { value: String(v.claimVersion), label: String(v.claimVersion) },
      { value: `M${v.claimVersion}`, label: `M${v.claimVersion}` },
    ]),
    { value: 'Master', label: 'Master' },
  ]
}

export const claimTypeOptions: Option[] = [
  { value: 'B', label: 'Both' },
  { value: 'C', label: 'C - Cashless' },
  { value: 'R', label: 'R - Reimbursement' },
]

export const exGratiaOptions: Record<string, string> = { Y: 'Y - Yes', N: 'N - No' }

export const searchKindOptions: Option[] = [
  { value: 'number', label: 'Case No' },
  { value: 'member', label: 'Member No' },
  { value: 'patient', label: 'Patient name' },
  { value: 'ic', label: 'I/C No' },
  { value: 'policy', label: 'Policy No' },
]

/** The grid showed "-" for a zero amount. */
export const moneyOrDash = (v: number | null | undefined) => (v == null || v === 0 ? '-' : formatMoney(v))

/** Fgrid cells are text: "-" for nothing, otherwise the amount with thousands separators. */
export const amountText = (v: number | null | undefined) => (v == null ? '' : formatMoney(v))

const sum = (values: readonly (number | null)[]) => values.reduce<number>((total, v) => total + (v ?? 0), 0)

/** FGridNCover: the eight not-covered items added up over the invoices listed. */
export function notCoveredRows(invoices: readonly EnquiryInvoice[]): { label: string; amount: number }[] {
  const column = (pick: (i: EnquiryInvoice) => number | null) => sum(invoices.map(pick))
  return [
    { label: 'Pre-Hosp > 60', amount: column((i) => i.preHospitalOver60) },
    { label: 'Pre-Hosp GP Fee', amount: column((i) => i.preHospitalGpFee) },
    { label: 'Pre-Hosp Medicine', amount: column((i) => i.preHospitalMedicine) },
    { label: 'Pre-Hosp Medical Report', amount: column((i) => i.preHospitalMedicalReport) },
    { label: 'Pre-Hosp Subsequent Specialist Fee', amount: column((i) => i.preHospitalSpecialistFee) },
    { label: 'Post-Hosp More Than 31 Days', amount: column((i) => i.postHospitalOver31Days) },
    { label: 'Post-Hosp Different Physician', amount: column((i) => i.postHospitalDifferentPhysician) },
    { label: 'Others', amount: column((i) => i.notCoveredOthers) },
  ]
}

export interface TopupRow {
  label: string
  ghs4: string
  ghs5: string
  total: string
}

/** TopupGrid: shown only when a top-up amount was approved. GHS4 is the main policy, GHS5 the top-up policy. */
export function topupGrid(h: Pick<EnquiryHeader, 'previousBalance' | 'companyApproved' | 'topupPreviousBalance' | 'topupApproved'>): TopupRow[] | null {
  const topupApproved = h.topupApproved ?? 0
  if (topupApproved === 0) return null
  const [balance4, used4, balance5, used5] = [h.previousBalance ?? 0, h.companyApproved ?? 0, h.topupPreviousBalance ?? 0, topupApproved]
  const row = (label: string, a: number, b: number): TopupRow => ({ label, ghs4: moneyOrDash(a), ghs5: moneyOrDash(b), total: moneyOrDash(a + b) })
  return [row('Bal Lmt', balance4, balance5), row('Utilised', used4, used5), row('Limit After This Claim', balance4 - used4, balance5 - used5)]
}

/** optExcess* / optLimit*: who collects. Anything but payor or hospital is Medix. */
export const collectedByText = (code: string | null | undefined) =>
  (code ?? '').trim() === 'P' ? 'By Payor' : (code ?? '').trim() === 'H' ? 'By Hospital' : 'By Medix'

export interface SummaryRow {
  label: string
  value: string
}

/** The rows under the benefit grid, in the desktop's order, with the saved figures. */
export function summaryRows(
  s: EnquirySummary,
  h: Pick<EnquiryHeader, 'underwritingExcess' | 'excessCollectedBy' | 'limitCollectedBy' | 'nonPayment'>,
): SummaryRow[] {
  const money = (v: number) => formatMoney(v)
  return [
    { label: 'Total Actual', value: money(s.totalActual) },
    { label: 'Total Approved', value: money(s.totalApproved) },
    { label: 'Co-Payment R&B', value: money(s.coPayRb) },
    { label: 'Underwriting Excess', value: money(h.underwritingExcess ?? 0) },
    { label: 'Total Excess', value: money(s.totalExcess) },
    { label: 'Excess Collected By', value: collectedByText(h.excessCollectedBy) },
    { label: 'Limit Exceeded', value: money(s.limitExceeded) },
    { label: 'Limit Collected By', value: collectedByText(h.limitCollectedBy) },
    { label: 'Main/Topup Policy', value: money(s.mainTopup) },
    { label: 'Hospital / Payor To Collect', value: money(s.hospitalPayorToCollect) },
    { label: 'Ex-Gratia (Not Payable)', value: money(s.exGratia) },
    { label: 'BTBG', value: money(s.btbg) },
    { label: 'Processing Fee', value: money(s.processingFee) },
    { label: 'Major Medical Fee', value: money(s.majorMedicalFee) },
    { label: 'Final Total - Payable to Hospital', value: money(s.payableToHospital) },
    { label: 'Final Total - Due to/(frm) Member', value: money(s.payableToMember) },
    { label: 'Bordereaux Amount', value: money(s.bordxAmount) },
    { label: 'Non-Payment', value: h.nonPayment ? 'Yes' : 'No' },
  ]
}

/** Bordx Ind is only shown for payor MH (users allowed) and IB, as the desktop did. */
export const showsBordxInd = (payor: string | null | undefined) => ['MH', 'IB'].includes((payor ?? '').trim().toUpperCase())

/** The diagnoses of one source as the Disability / ICD Code fields show them: final diagnoses one per line, ICD codes comma separated. */
export function disabilityText(diagnoses: readonly EnquiryDiagnosis[]) {
  const final = diagnoses.filter((d) => d.source === 'Final')
  return {
    disability: final
      .map((d) => (d.diagnosis ?? '').trim())
      .filter(Boolean)
      .join('\n'),
    icdCodes: final
      .map((d) => (d.icdCode ?? '').trim())
      .filter(Boolean)
      .join(', '),
  }
}

/** The invoice numbers / invoice dates / follow-up dates the desktop strung together (comma separated, blanks left out). */
export const joined = (values: readonly (string | null)[], separator = ', ') =>
  values
    .map((v) => (v ?? '').trim())
    .filter(Boolean)
    .join(separator)
