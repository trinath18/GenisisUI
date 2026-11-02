// Claim Bordx > Payment Advice > Generate Bordx No (legacy frmPayAdviceHosp, "Payment Advice - Generate Bordx"): the criteria, the tick rules, the requests and the columns of the list. The server repeats the rules
// when it generates the bordx.

import * as yup from 'yup'
import type { Option } from '../../components/Field'
import { formatMoney } from '../../lib/format'
import { dmyDate, optionalText } from '../../lib/validation'
import { isoDmy, isoToDmy } from '../case/caseShared'

export interface PayRow {
  payor: string | null
  caseNo: string
  claimVersion: number
  appAmt: number | null
  doa: string | null
  dod: string | null
  cashType: string | null
  patient: string | null
  hospital: string | null
  hosAmt: number | null
  groupCompany: string | null
  planCode: string | null
  icdCode: string | null
  btbg: string | null
  insuredType: string | null
  claimability: string | null
  costCenter: string | null
  groupCategory: string | null
  hospitalState: string | null
  wksNo: string
}

export interface BordxLine {
  claimNo: string
  bordxNo: string
  bordxDate: string
  bordxAmount: number
}

export interface PayValues {
  useScan: boolean
  wksNoFrom: string
  wksNoTo: string
  version: string
  cashType: string
  hospital: string
  doaFrom: string
  doaTo: string
  doaEmpty: boolean
  dodFrom: string
  dodTo: string
  dodEmpty: boolean
}

/** cboCashType: paid to the hospital or to the member. */
export const cashTypeOptions: Option[] = [
  { value: 'H', label: 'H - Hospital' },
  { value: 'M', label: 'M - Member' },
]

export const payDefaults: PayValues = {
  useScan: true,
  wksNoFrom: '',
  wksNoTo: '',
  version: '',
  cashType: '',
  hospital: '',
  doaFrom: '',
  doaTo: '',
  doaEmpty: false,
  dodFrom: '',
  dodTo: '',
  dodEmpty: false,
}

export const paySchema: yup.ObjectSchema<PayValues> = yup.object({
  useScan: yup.boolean().default(true),
  wksNoFrom: yup
    .string()
    .trim()
    .default('')
    .when('useScan', { is: true, then: (s) => s.required('Please Enter Worksheet No') }),
  wksNoTo: optionalText(),
  version: optionalText(),
  cashType: optionalText(),
  hospital: optionalText(),
  doaFrom: dmyDate(),
  doaTo: dmyDate(),
  doaEmpty: yup.boolean().default(false),
  dodFrom: dmyDate(),
  dodTo: dmyDate(),
  dodEmpty: yup.boolean().default(false),
})

/** The query of the search: a date box is not sent when its "is empty" box is ticked. */
export const payParams = (v: PayValues) => ({
  useScan: v.useScan,
  wksNoFrom: v.wksNoFrom.trim() || undefined,
  wksNoTo: v.useScan ? undefined : v.wksNoTo.trim() || undefined,
  version: v.useScan && v.version ? Number(v.version) : undefined,
  cashType: v.cashType || undefined,
  hospital: v.hospital.trim() || undefined,
  doaFrom: v.doaEmpty ? undefined : (isoDmy(v.doaFrom) ?? undefined),
  doaTo: v.doaEmpty ? undefined : (isoDmy(v.doaTo) ?? undefined),
  doaEmpty: v.doaEmpty,
  dodFrom: v.dodEmpty ? undefined : (isoDmy(v.dodFrom) ?? undefined),
  dodTo: v.dodEmpty ? undefined : (isoDmy(v.dodTo) ?? undefined),
  dodEmpty: v.dodEmpty,
})

/** lstWorksheetTrackList_ItemCheck's tests on the row, in the desktop's order (the scanned documents are checked by the server). The claimability test keeps the desktop's literal "N". */
export function tickProblem(r: PayRow): string | null {
  if (!r.dod) return 'Date of Discharge is Empty.'
  if (!(r.hospital ?? '').trim()) return 'Hospital cannot be empty!'
  if (!(r.icdCode ?? '').trim()) return 'Final ICD Code cannot be empty!'
  if ((r.claimability ?? '').trim() === 'N') return 'Claimability is Not Decided!'
  if (!(r.costCenter ?? '').trim()) return 'Cost Centre is empty'
  if (!(r.groupCategory ?? '').trim()) return 'Group Category is empty'
  return null
}

/** After the scanned documents: a group or household worksheet needs its group company. */
export const groupCompanyProblem = (r: PayRow) =>
  ['G', 'H'].includes((r.insuredType ?? '').trim()) && !(r.groupCompany ?? '').trim() ? 'Group Company cannot be empty!' : null

export const NO_DOCUMENTS = 'Please ensure scanned documents are in system!'

/** cmdBordx_Click's checks in the desktop's order; null when the bordx may be generated. */
export const bordxProblem = (rows: number, ticked: number) =>
  rows === 0 ? 'Please select a record before proceeding!' : ticked === 0 ? 'Please select at least one record to be updated! ' : null

/** The request: the ticked worksheets. */
export const bordxRequest = (rows: readonly PayRow[]) => ({ items: rows.map((r) => ({ caseNo: r.caseNo, claimVersion: r.claimVersion })) })

/** The total of the approved amounts of the worksheets. */
export const totalApproved = (rows: readonly PayRow[]) => rows.reduce((sum, r) => sum + (r.appAmt ?? 0), 0)

const d = (value: string | null) => isoToDmy(value)
const m = (value: number | null) => formatMoney(value ?? 0)

/** The columns of the list, headed as the desktop headed them (an empty BTBG shows as N). */
export const payColumns: { label: string; value: (r: PayRow) => string }[] = [
  { label: 'Payor', value: (r) => r.payor ?? '' },
  { label: 'Case No', value: (r) => r.caseNo },
  { label: 'Claim Version', value: (r) => String(r.claimVersion) },
  { label: 'Wks No', value: (r) => r.wksNo },
  { label: 'Cash Type', value: (r) => r.cashType ?? '' },
  { label: 'Hos Amt', value: (r) => m(r.hosAmt) },
  { label: 'App Amt', value: (r) => m(r.appAmt) },
  { label: 'DOA', value: (r) => d(r.doa) },
  { label: 'DOD', value: (r) => d(r.dod) },
  { label: 'Patient', value: (r) => r.patient ?? '' },
  { label: 'Hospital', value: (r) => r.hospital ?? '' },
  { label: 'Grp Company', value: (r) => r.groupCompany ?? '' },
  { label: 'Plan Code', value: (r) => r.planCode ?? '' },
  { label: 'ICD Code', value: (r) => r.icdCode ?? '' },
  { label: 'BTBG', value: (r) => (r.btbg ?? '').trim() || 'N' },
  { label: 'Insured Type', value: (r) => r.insuredType ?? '' },
  { label: 'Claimability', value: (r) => r.claimability ?? '' },
  { label: 'Cost Centre', value: (r) => r.costCenter ?? '' },
  { label: 'Group Category', value: (r) => r.groupCategory ?? '' },
  { label: 'Hosp State', value: (r) => r.hospitalState ?? '' },
]
