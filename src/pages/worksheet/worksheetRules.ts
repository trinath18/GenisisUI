// Pure rules and form models of the worksheet screens (Tracking, Send to A/C, Send to A/R).
// Behaviour follows the desktop FrmWorksheetTracking / FrmWksSendToAC / FrmARRecFrCLM: same fields, same checks, same messages.

import * as yup from 'yup'
import type { Option } from '../../components/Field'
import { amount, dmyDate, optionalText } from '../../lib/validation'
import { isoDmy, num } from '../case/caseShared'

/** What a search answers: the rows and whether more rows matched than are shown. */
export interface SearchResult<T> {
  rows: T[]
  truncated: boolean
}

/** The code of a "CODE - Description" drop-down entry (the desktop took the text before the dash). */
export const payorCode = (text: string) => {
  const t = text.trim()
  const dash = t.indexOf(' - ')
  return (dash < 0 ? t : t.slice(0, dash)).trim()
}

/** CaseNoCheck: scanning a case that is already in the list is refused (compared trimmed and upper-cased, as ChkStr did). */
export const isAlreadyListed = (rows: readonly { caseNo: string }[], caseNo: string) => {
  const wanted = caseNo.trim().toUpperCase()
  return rows.some((r) => r.caseNo.trim().toUpperCase() === wanted)
}

/** lstWorksheetTrackList_ItemCheck: a worksheet that is already in a bordx cannot be ticked. */
export const trackingTickProblem = (r: { bordxed: boolean }) => (r.bordxed ? 'This claim has been bordxed!' : null)

/** lstClaimDelivery_ItemCheck: a worksheet that was already sent to accounts cannot be ticked. */
export const accountsTickProblem = (r: { sent: boolean }) => (r.sent ? 'Record has been Updated!' : null)

export const worksheetKey = (r: { caseNo: string; claimVersion: number }) => `${r.caseNo}-${r.claimVersion}`

export const tokenStatusOptions: Option[] = [
  { value: '0', label: 'Both' },
  { value: '1', label: 'Passed' },
  { value: '2', label: 'Not Yet Passed' },
]
export const searchPendingOptions: Option[] = [
  { value: 'B', label: 'Bordxed' },
  { value: 'C', label: 'Cancelled' },
  { value: 'P', label: 'Pending' },
]
export const updatePendingOptions: Option[] = searchPendingOptions.filter((o) => o.value !== 'B')
export const claimabilityOptions: Option[] = [
  { value: 'A', label: 'Accepted' },
  { value: 'R', label: 'Rejected' },
]

const text = (v: string) => v.trim() || undefined
const date = (v: string) => isoDmy(v) ?? undefined
const amountOf = (v: string) => num(v) ?? undefined
const whole = (v: string) => (v.trim() === '' ? undefined : Number(v))

// ---------------- Worksheet Tracking ----------------

export interface TrackingValues {
  useScan: boolean
  wksNoFrom: string
  wksNoTo: string
  versionFrom: string
  versionTo: string
  payor: string
  groupCompany: string
  icFrom: string
  icTo: string
  icEmpty: boolean
  claimability: string
  pending: string
  pendingEmpty: boolean
  planFrom: string
  planTo: string
  approvedFrom: string
  approvedTo: string
  payMemberFrom: string
  payMemberTo: string
  payHospitalFrom: string
  payHospitalTo: string
  policyFrom: string
  policyTo: string
  memberFrom: string
  memberTo: string
  insFrom: string
  insTo: string
  bordxFrom: string
  bordxTo: string
  bordxEmpty: boolean
  dpoFrom: string
  dpoTo: string
  dpoEmpty: boolean
  doaFrom: string
  doaTo: string
  doaEmpty: boolean
  dodFrom: string
  dodTo: string
  dodEmpty: boolean
  firstFrom: string
  firstTo: string
  firstEmpty: boolean
  finalFrom: string
  finalTo: string
  finalEmpty: boolean
  updateDate: string
  updatePending: string
}

export const trackingDefaults: TrackingValues = {
  useScan: true,
  wksNoFrom: '',
  wksNoTo: '',
  versionFrom: '',
  versionTo: '',
  payor: '',
  groupCompany: '',
  icFrom: '',
  icTo: '',
  icEmpty: false,
  claimability: '',
  pending: '',
  pendingEmpty: false,
  planFrom: '',
  planTo: '',
  approvedFrom: '',
  approvedTo: '',
  payMemberFrom: '',
  payMemberTo: '',
  payHospitalFrom: '',
  payHospitalTo: '',
  policyFrom: '',
  policyTo: '',
  memberFrom: '',
  memberTo: '',
  insFrom: '',
  insTo: '',
  bordxFrom: '',
  bordxTo: '',
  bordxEmpty: false,
  dpoFrom: '',
  dpoTo: '',
  dpoEmpty: false,
  doaFrom: '',
  doaTo: '',
  doaEmpty: false,
  dodFrom: '',
  dodTo: '',
  dodEmpty: false,
  firstFrom: '',
  firstTo: '',
  firstEmpty: false,
  finalFrom: '',
  finalTo: '',
  finalEmpty: false,
  updateDate: '',
  updatePending: '',
}

const digits = (message: string) =>
  yup
    .string()
    .default('')
    .test('digits', message, (v) => !v || /^\d+$/.test(v))

export const trackingSchema: yup.ObjectSchema<TrackingValues> = yup.object({
  useScan: yup.boolean().default(true),
  wksNoFrom: yup
    .string()
    .trim()
    .default('')
    .when('useScan', { is: true, then: (s) => s.required('Please Enter Worksheet No') }),
  wksNoTo: optionalText(),
  versionFrom: digits('Enter a whole number.'),
  versionTo: digits('Enter a whole number.'),
  payor: optionalText(),
  groupCompany: optionalText(),
  icFrom: optionalText(),
  icTo: optionalText(),
  icEmpty: yup.boolean().default(false),
  claimability: optionalText(),
  pending: optionalText(),
  pendingEmpty: yup.boolean().default(false),
  planFrom: optionalText(),
  planTo: optionalText(),
  approvedFrom: amount(),
  approvedTo: amount(),
  payMemberFrom: amount(),
  payMemberTo: amount(),
  payHospitalFrom: amount(),
  payHospitalTo: amount(),
  policyFrom: optionalText(),
  policyTo: optionalText(),
  memberFrom: optionalText(),
  memberTo: optionalText(),
  insFrom: optionalText(),
  insTo: optionalText(),
  bordxFrom: optionalText(),
  bordxTo: optionalText(),
  bordxEmpty: yup.boolean().default(false),
  dpoFrom: dmyDate(),
  dpoTo: dmyDate(),
  dpoEmpty: yup.boolean().default(false),
  doaFrom: dmyDate(),
  doaTo: dmyDate(),
  doaEmpty: yup.boolean().default(false),
  dodFrom: dmyDate(),
  dodTo: dmyDate(),
  dodEmpty: yup.boolean().default(false),
  firstFrom: optionalText(),
  firstTo: optionalText(),
  firstEmpty: yup.boolean().default(false),
  finalFrom: optionalText(),
  finalTo: optionalText(),
  finalEmpty: yup.boolean().default(false),
  updateDate: dmyDate(),
  updatePending: optionalText(),
})

/** SearchRecord: the criteria as the API's query string (blank criteria are left out). */
export const trackingParams = (v: TrackingValues) => ({
  useScan: v.useScan,
  wksNoFrom: text(v.wksNoFrom),
  wksNoTo: v.useScan ? undefined : text(v.wksNoTo),
  versionFrom: whole(v.versionFrom),
  versionTo: whole(v.versionTo),
  payor: text(payorCode(v.payor)),
  groupCompany: text(v.groupCompany),
  icFrom: text(v.icFrom),
  icTo: text(v.icTo),
  icEmpty: v.icEmpty,
  claimability: text(v.claimability),
  pending: text(v.pending),
  pendingEmpty: v.pendingEmpty,
  planFrom: text(v.planFrom),
  planTo: text(v.planTo),
  approvedFrom: amountOf(v.approvedFrom),
  approvedTo: amountOf(v.approvedTo),
  payMemberFrom: amountOf(v.payMemberFrom),
  payMemberTo: amountOf(v.payMemberTo),
  payHospitalFrom: amountOf(v.payHospitalFrom),
  payHospitalTo: amountOf(v.payHospitalTo),
  policyFrom: text(v.policyFrom),
  policyTo: text(v.policyTo),
  memberFrom: text(v.memberFrom),
  memberTo: text(v.memberTo),
  insFrom: text(v.insFrom),
  insTo: text(v.insTo),
  bordxFrom: text(v.bordxFrom),
  bordxTo: text(v.bordxTo),
  bordxEmpty: v.bordxEmpty,
  dpoFrom: date(v.dpoFrom),
  dpoTo: date(v.dpoTo),
  dpoEmpty: v.dpoEmpty,
  doaFrom: date(v.doaFrom),
  doaTo: date(v.doaTo),
  doaEmpty: v.doaEmpty,
  dodFrom: date(v.dodFrom),
  dodTo: date(v.dodTo),
  dodEmpty: v.dodEmpty,
  firstFrom: text(v.firstFrom),
  firstTo: text(v.firstTo),
  firstEmpty: v.firstEmpty,
  finalFrom: text(v.finalFrom),
  finalTo: text(v.finalTo),
  finalEmpty: v.finalEmpty,
})

/** CmdUpdate_Click's two checks, in the desktop's order; null when the update may go ahead. */
export const trackingUpdateProblem = (v: Pick<TrackingValues, 'updateDate' | 'updatePending'>) =>
  v.updateDate.trim() === ''
    ? { field: 'updateDate' as const, message: 'Please Enter Date' }
    : v.updatePending.trim() === ''
      ? { field: 'updatePending' as const, message: 'Please Enter Pending Status' }
      : null

// ---------------- Send to A/C ----------------

export interface AccountsValues {
  useScan: boolean
  wksNoFrom: string
  wksNoTo: string
  payor: string
  wksDateFrom: string
  wksDateTo: string
  amountFrom: string
  amountTo: string
  dateSentFrom: string
  dateSentTo: string
  tokenStatus: string
  bordxFrom: string
  bordxTo: string
  sendDate: string
}

export const accountsDefaults: AccountsValues = {
  useScan: true,
  wksNoFrom: '',
  wksNoTo: '',
  payor: '',
  wksDateFrom: '',
  wksDateTo: '',
  amountFrom: '',
  amountTo: '',
  dateSentFrom: '',
  dateSentTo: '',
  tokenStatus: '0',
  bordxFrom: '',
  bordxTo: '',
  sendDate: '',
}

export const accountsSchema: yup.ObjectSchema<AccountsValues> = yup.object({
  useScan: yup.boolean().default(true),
  wksNoFrom: yup
    .string()
    .trim()
    .default('')
    .when('useScan', { is: true, then: (s) => s.required('Please Enter Worksheet No') }),
  wksNoTo: optionalText(),
  payor: optionalText(),
  wksDateFrom: dmyDate(),
  wksDateTo: dmyDate(),
  amountFrom: amount(),
  amountTo: amount(),
  dateSentFrom: dmyDate(),
  dateSentTo: dmyDate(),
  tokenStatus: optionalText(),
  bordxFrom: optionalText(),
  bordxTo: optionalText(),
  sendDate: dmyDate(),
})

export const accountsParams = (v: AccountsValues) => ({
  useScan: v.useScan,
  wksNoFrom: text(v.wksNoFrom),
  wksNoTo: v.useScan ? undefined : text(v.wksNoTo),
  payor: text(payorCode(v.payor)),
  wksDateFrom: date(v.wksDateFrom),
  wksDateTo: date(v.wksDateTo),
  amountFrom: amountOf(v.amountFrom),
  amountTo: amountOf(v.amountTo),
  dateSentFrom: date(v.dateSentFrom),
  dateSentTo: date(v.dateSentTo),
  tokenStatus: text(v.tokenStatus),
  bordxFrom: text(v.bordxFrom),
  bordxTo: text(v.bordxTo),
})

/** CmdToAC_Click's date check; null when the update may go ahead. */
export const accountsUpdateProblem = (v: Pick<AccountsValues, 'sendDate'>) =>
  v.sendDate.trim() === '' ? { field: 'sendDate' as const, message: 'Please Enter in date' } : null

// ---------------- Send to A/R ----------------

export interface ArValues {
  useScan: boolean
  wksNoFrom: string
  wksNoTo: string
  dateSentFrom: string
  dateSentTo: string
  tokenStatus: string
}

export const arDefaults: ArValues = { useScan: true, wksNoFrom: '', wksNoTo: '', dateSentFrom: '', dateSentTo: '', tokenStatus: '0' }

export const arSchema: yup.ObjectSchema<ArValues> = yup.object({
  useScan: yup.boolean().default(true),
  wksNoFrom: yup
    .string()
    .trim()
    .default('')
    .when('useScan', { is: true, then: (s) => s.required('Please Enter Case No') }),
  wksNoTo: optionalText(),
  dateSentFrom: dmyDate(),
  dateSentTo: dmyDate(),
  tokenStatus: optionalText(),
})

export const arParams = (v: ArValues) => ({
  useScan: v.useScan,
  wksNoFrom: text(v.wksNoFrom),
  wksNoTo: v.useScan ? undefined : text(v.wksNoTo),
  dateSentFrom: date(v.dateSentFrom),
  dateSentTo: date(v.dateSentTo),
  tokenStatus: text(v.tokenStatus),
})
