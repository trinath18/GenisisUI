// Authorize Claims > DCU Tracking > Claim Report (legacy FrmDCUReport1, "DCU Reports"): the report chosen (Claim or Case, report type, selection), the selection criteria and the list the report makes. The server
// makes every list; this module holds what the screen decides: which report types a Claim or a Case report has, which criteria a Case report does not have, the request and the file Print to File writes.

import * as yup from 'yup'
import type { Option } from '../../components/Field'
import { amount, dmyDate, optionalText } from '../../lib/validation'
import { isoDmy } from '../case/caseShared'

export type Mode = 'claim' | 'case'

export interface CodeName {
  code: string
  name: string
}

export interface PayorInfo extends CodeName {
  healthType: string | null
}

export interface ReportType {
  index: number
  name: string
  claim: string[]
  case: string[] | null
}

export interface Lookups {
  insTypes: CodeName[]
  payors: PayorInfo[]
  policyStatuses: CodeName[]
  reportTypes: ReportType[]
}

export interface ReportResult {
  title: string
  columns: { header: string; right: boolean }[]
  rows: string[][]
  truncated: boolean
}

/** The text and date boxes of the Selection Criteria panel, the "empty" ticks and the report chosen. */
export interface Values {
  mode: Mode
  reportType: string
  selection: string
  modality: string
  stayType: string
  cashType: string
  payor: string
  bordxNoFrom: string
  bordxNoTo: string
  agentCode: string
  joinFrom: string
  joinTo: string
  claimPending: string
  casePending: string
  finalDiagFrom: string
  finalDiagTo: string
  groupCompany: string
  loadGroups: boolean
  caseStatus: string
  claimability: string
  policyStatus: string
  planFrom: string
  planTo: string
  dataStatus: string
  insType: string
  healthType: string
  payorEffFrom: string
  payorEffTo: string
  payorExpFrom: string
  payorExpTo: string
  dorFrom: string
  dorTo: string
  doaFrom: string
  doaTo: string
  dodFrom: string
  dodTo: string
  memberType: string
  policyNo: string
  supplementaryType: string
  caseNoFrom: string
  caseNoTo: string
  bordxDateFrom: string
  bordxDateTo: string
  versionFrom: string
  versionTo: string
  blankHealthType: boolean
  blankInsType: boolean
  blankDataStatus: boolean
  blankClaimability: boolean
  blankPolicyStatus: boolean
  blankCaseStatus: boolean
  blankAgentCode: boolean
  blankPolicyNo: boolean
  blankPayor: boolean
  blankGroupCompany: boolean
  blankDoa: boolean
  blankDod: boolean
  blankDor: boolean
  blankFinalDiag: boolean
  blankPlan: boolean
  blankBordxNo: boolean
  blankPayorEff: boolean
  blankPayorExp: boolean
  blankJoin: boolean
  blankBordxDate: boolean
}

export const defaults: Values = {
  mode: 'claim',
  reportType: '0',
  selection: '0',
  modality: '',
  stayType: '',
  cashType: '',
  payor: '',
  bordxNoFrom: '',
  bordxNoTo: '',
  agentCode: '',
  joinFrom: '',
  joinTo: '',
  claimPending: '',
  casePending: '',
  finalDiagFrom: '',
  finalDiagTo: '',
  groupCompany: '',
  loadGroups: false,
  caseStatus: '1',
  claimability: '',
  policyStatus: '',
  planFrom: '',
  planTo: '',
  dataStatus: '',
  insType: '',
  healthType: '',
  payorEffFrom: '',
  payorEffTo: '',
  payorExpFrom: '',
  payorExpTo: '',
  dorFrom: '',
  dorTo: '',
  doaFrom: '',
  doaTo: '',
  dodFrom: '',
  dodTo: '',
  memberType: '',
  policyNo: '',
  supplementaryType: '',
  caseNoFrom: '',
  caseNoTo: '',
  bordxDateFrom: '',
  bordxDateTo: '',
  versionFrom: '',
  versionTo: '',
  blankHealthType: false,
  blankInsType: false,
  blankDataStatus: false,
  blankClaimability: false,
  blankPolicyStatus: false,
  blankCaseStatus: false,
  blankAgentCode: false,
  blankPolicyNo: false,
  blankPayor: false,
  blankGroupCompany: false,
  blankDoa: false,
  blankDod: false,
  blankDor: false,
  blankFinalDiag: false,
  blankPlan: false,
  blankBordxNo: false,
  blankPayorEff: false,
  blankPayorExp: false,
  blankJoin: false,
  blankBordxDate: false,
}

const text = optionalText()
const date = dmyDate()
const flag = yup.boolean().default(false)
const integer = () => amount('Enter a number.').test('integer', 'Enter a whole number.', (v) => !v || /^\d+$/.test(v))

export const schema = yup.object({
  mode: yup.mixed<Mode>().oneOf(['claim', 'case']).default('claim'),
  reportType: text,
  selection: text,
  modality: text,
  stayType: text,
  cashType: text,
  payor: text,
  bordxNoFrom: text,
  bordxNoTo: text,
  agentCode: text,
  joinFrom: date,
  joinTo: date,
  claimPending: text,
  casePending: text,
  finalDiagFrom: text,
  finalDiagTo: text,
  groupCompany: text,
  loadGroups: flag,
  caseStatus: text,
  claimability: text,
  policyStatus: text,
  planFrom: text,
  planTo: text,
  dataStatus: text,
  insType: text,
  healthType: text,
  payorEffFrom: date,
  payorEffTo: date,
  payorExpFrom: date,
  payorExpTo: date,
  dorFrom: date,
  dorTo: date,
  doaFrom: date,
  doaTo: date,
  dodFrom: date,
  dodTo: date,
  memberType: text,
  policyNo: text,
  supplementaryType: text,
  caseNoFrom: text,
  caseNoTo: text,
  bordxDateFrom: date,
  bordxDateTo: date,
  versionFrom: integer(),
  versionTo: integer(),
  blankHealthType: flag,
  blankInsType: flag,
  blankDataStatus: flag,
  blankClaimability: flag,
  blankPolicyStatus: flag,
  blankCaseStatus: flag,
  blankAgentCode: flag,
  blankPolicyNo: flag,
  blankPayor: flag,
  blankGroupCompany: flag,
  blankDoa: flag,
  blankDod: flag,
  blankDor: flag,
  blankFinalDiag: flag,
  blankPlan: flag,
  blankBordxNo: flag,
  blankPayorEff: flag,
  blankPayorExp: flag,
  blankJoin: flag,
  blankBordxDate: flag,
}) as yup.ObjectSchema<Values>

/** The criteria a Case report does not have: the desktop's Option14 cleared and disabled them (a case has no bordx and no version). */
export const caseDisabled: (keyof Values)[] = [
  'bordxNoFrom',
  'bordxNoTo',
  'blankBordxNo',
  'bordxDateFrom',
  'bordxDateTo',
  'blankBordxDate',
  'versionFrom',
  'versionTo',
]

/** Is a criterion unavailable for the report chosen? */
export const disabledFor = (mode: Mode, name: keyof Values) => mode === 'case' && caseDisabled.includes(name)

/** The values with the criteria a Case report does not have cleared. */
export const withoutCaseCriteria = (values: Values): Values => {
  const next = { ...values }
  for (const name of caseDisabled) (next as unknown as Record<string, unknown>)[name] = typeof defaults[name] === 'boolean' ? false : ''
  return next
}

/** cboReportType: the types of a Claim report, or of a Case report (Efficiency is for claims only). */
export const typesFor = (types: ReportType[], mode: Mode) => types.filter((t) => mode === 'claim' || t.case !== null)

/** cboReportSelection: the selections of the type chosen (none for Payor and State). */
export const selectionsFor = (types: ReportType[], mode: Mode, typeIndex: number): string[] => {
  const type = types.find((t) => t.index === typeIndex)
  return (mode === 'claim' ? type?.claim : type?.case) ?? []
}

export const options = (list: string[]): Option[] => list.map((label, i) => ({ value: String(i), label }))

/** LoadPayor: the payors of the health type chosen (all of them when none is), as "code - name". */
export const payorOptions = (payors: PayorInfo[], healthType: string): Option[] =>
  payors
    .filter((p) => !healthType || (p.healthType ?? '').trim() === healthType)
    .map((p) => ({ value: `${p.code} - ${p.name}`, label: `${p.code} - ${p.name}` }))

export const codeOptions = (list: CodeName[]): Option[] => list.map((c) => ({ value: c.code, label: `${c.code} - ${c.name}` }))

export const modalityOptions: Option[] = [
  { value: 'B', label: 'B - Both' },
  { value: 'N', label: 'N - Non-Surgical' },
  { value: 'S', label: 'S - Surgical' },
]
export const stayTypeOptions: Option[] = [
  { value: 'I', label: 'I - In-Patient' },
  { value: 'O', label: 'O - Out-Patient' },
]
export const cashTypeOptions: Option[] = [
  { value: 'C', label: 'C - Cashless' },
  { value: 'R', label: 'R - Reimbursement' },
]
export const claimPendingOptions: Option[] = [
  { value: 'B', label: 'B - Bordxed' },
  { value: 'C', label: 'C - Cancelled' },
  { value: 'P', label: 'P - Pending' },
]
export const casePendingOptions: Option[] = [
  { value: 'N', label: 'N - No' },
  { value: 'Y', label: 'Y - Yes' },
]
export const caseStatusOptions: Option[] = [
  { value: '0', label: '0 - Open' },
  { value: '1', label: '1 - Open & Close' },
  { value: '2', label: '2 - Delete' },
  { value: '3', label: '3 - All' },
]
export const claimabilityOptions: Option[] = [
  { value: 'A', label: 'A - Accepted' },
  { value: 'R', label: 'R - Rejected' },
]
export const dataStatusOptions: Option[] = [
  { value: 'A', label: 'A - Active' },
  { value: 'D', label: 'D - Delete' },
]
export const healthTypeOptions: Option[] = [
  { value: 'S', label: 'S - Sihat' },
  { value: 'N', label: 'N - Non-Sihat' },
]
export const memberTypeOptions: Option[] = [
  { value: '', label: 'Both' },
  { value: 'P', label: 'P - Principal' },
  { value: 'S', label: 'S - Supplementary' },
]
export const supplementaryTypeOptions: Option[] = [
  { value: '', label: 'Both' },
  { value: 'C', label: 'C - Combined Limit' },
  { value: 'S', label: 'S - Separated Limit' },
]

const code = (v: string) => v.split(' - ')[0].trim()
const t = (v: string) => v.trim() || undefined
const d = (v: string) => isoDmy(v) ?? undefined
const n = (v: string) => (v.trim() === '' ? undefined : Number(v))

/** The request of Search: the report and every criterion that was filled in (a Case report without the bordx and version criteria). */
export function requestOf(values: Values) {
  const v = values.mode === 'case' ? withoutCaseCriteria(values) : values
  return {
    mode: v.mode,
    reportType: Number(v.reportType || 0),
    selection: v.selection === '' ? undefined : Number(v.selection),
    healthType: t(v.healthType),
    insType: t(code(v.insType)),
    memberType: t(v.memberType),
    supplementaryType: t(v.supplementaryType),
    dataStatus: t(v.dataStatus),
    claimability: t(v.claimability),
    policyStatus: t(code(v.policyStatus)),
    caseStatus: n(v.caseStatus),
    agentCode: t(v.agentCode),
    policyNo: t(v.policyNo),
    payor: t(code(v.payor)),
    groupCompany: t(v.groupCompany),
    doaFrom: d(v.doaFrom),
    doaTo: d(v.doaTo),
    dodFrom: d(v.dodFrom),
    dodTo: d(v.dodTo),
    dorFrom: d(v.dorFrom),
    dorTo: d(v.dorTo),
    finalDiagFrom: t(v.finalDiagFrom),
    finalDiagTo: t(v.finalDiagTo),
    casePending: t(v.casePending),
    claimPending: t(v.claimPending),
    planFrom: t(v.planFrom),
    planTo: t(v.planTo),
    bordxNoFrom: t(v.bordxNoFrom),
    bordxNoTo: t(v.bordxNoTo),
    payorEffFrom: d(v.payorEffFrom),
    payorEffTo: d(v.payorEffTo),
    payorExpFrom: d(v.payorExpFrom),
    payorExpTo: d(v.payorExpTo),
    joinFrom: d(v.joinFrom),
    joinTo: d(v.joinTo),
    bordxDateFrom: d(v.bordxDateFrom),
    bordxDateTo: d(v.bordxDateTo),
    caseNoFrom: t(v.caseNoFrom),
    caseNoTo: t(v.caseNoTo),
    versionFrom: n(v.versionFrom),
    versionTo: n(v.versionTo),
    stayType: t(v.stayType),
    cashType: t(v.cashType),
    modality: t(v.modality),
    blankHealthType: v.blankHealthType,
    blankInsType: v.blankInsType,
    blankDataStatus: v.blankDataStatus,
    blankClaimability: v.blankClaimability,
    blankPolicyStatus: v.blankPolicyStatus,
    blankCaseStatus: v.blankCaseStatus,
    blankAgentCode: v.blankAgentCode,
    blankPolicyNo: v.blankPolicyNo,
    blankPayor: v.blankPayor,
    blankGroupCompany: v.blankGroupCompany,
    blankDoa: v.blankDoa,
    blankDod: v.blankDod,
    blankDor: v.blankDor,
    blankFinalDiag: v.blankFinalDiag,
    blankPlan: v.blankPlan,
    blankBordxNo: v.blankBordxNo,
    blankPayorEff: v.blankPayorEff,
    blankPayorExp: v.blankPayorExp,
    blankJoin: v.blankJoin,
    blankBordxDate: v.blankBordxDate,
  }
}

/** The report the boxes name, as "Claim - Age Band - Summary". */
export const reportName = (types: ReportType[], values: Values) => {
  const type = types.find((x) => x.index === Number(values.reportType))
  const selection = selectionsFor(types, values.mode, Number(values.reportType))[Number(values.selection || 0)]
  return [values.mode === 'claim' ? 'Claim' : 'Case', type?.name, selection].filter(Boolean).join(' - ')
}

/** A figure of a list cell: "1,234.50" is 1234.5 and "(3.00)" is -3; text is NaN. */
export const figure = (cell: string) => {
  const negative = /^\(.*\)$/.test(cell)
  const value = Number(cell.replace(/[(),]/g, ''))
  return Number.isNaN(value) || cell.trim() === '' ? Number.NaN : negative ? -value : value
}

/** Print to File: the list as rows of text, headed as the list is. */
export const fileRows = (result: ReportResult): string[][] => [result.columns.map((c) => c.header), ...result.rows]
