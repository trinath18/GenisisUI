// Shared constants, types and helpers for the case screens (registration + adjustment).
// Behaviour follows the desktop frmCaseAdmission / frmCaseAdjustmentNew: same fields, same checks.

import type { KeyboardEvent } from 'react'
import { useQuery } from '@tanstack/react-query'
import { api } from '../../api/client'
import { formatMoney, formatValue } from '../../lib/format'
import { parseDmy } from '../../lib/masks'
import type { Column } from '../../components/DataTable'
import type { Row } from '../../lib/format'

export interface Opt {
  code: string
  name: string
}

export interface Lookups {
  specialApprovals: Opt[]
  claimNatures: Opt[]
  payTypes: Opt[]
  stayTypes: Opt[]
  treatmentModes: Opt[]
  hospitals: Opt[]
  documents: Opt[]
  personnel: Opt[]
}

export interface MemberView {
  member: Row
  polStatus: string
  annualLimit: string
  patients: { coverId: string; name: string }[]
  members: { coverId: string; name?: string; ic?: string; relation?: string; dob?: string; annualLimit?: number; exclusion?: string }[]
  principalExclusion?: string
  planStartAge?: number
  planEndAge?: number
  policyWording?: string
  agentLabel?: string
  waitingPeriod: boolean
  expiryLabel?: string
  canRegister: boolean
  lgAllowed: boolean
  alerts: { text: string; critical: boolean }[]
  today: string
}

export type Form = Record<string, string>
export type DiagGroup = 'prelim' | 'final' | 'underlying'
export type DialogState =
  | { kind: 'member'; initial?: { by: 'number'; q: string; rows: Row[] } }
  | { kind: 'icd'; group: DiagGroup }
  | { kind: 'rep' }
  | { kind: 'opcs' | 'opcs-ns' | 'inv' }
  | null

export const o = (code: string, name: string): Opt => ({ code, name })
export const claimabilities = [
  o('AA', 'Accepted'), o('RR', 'Repudiated'), o('CC', 'Cancelled'), o('SA', 'Special Approval'), o('PP', 'Pay & Claim'),
  o('NN', 'Not Decided'), o('NA', 'Not Decided/Accepted'), o('NR', 'Not Decided/Repudiated'), o('PA', 'Pay&Claim/Accepted'),
  o('PR', 'Pay&Claim/Rejected'), o('AR', 'Accepted/Rejected'), o('RA', 'Rejected/Accepted'), o('BR', 'BTBG/Rejected'),
  o('ER', 'Expired/Rejected'), o('AI', 'Accepted/Insurance'),
]
export const statuses = [o('O', 'Open'), o('C', 'Close'), o('D', 'Delete')]
export const yesNo = [o('Y', 'Yes'), o('N', 'No')]
export const noYes = [o('N', 'No'), o('Y', 'Yes')]
export const yesNoUpper = [o('Y', 'YES'), o('N', 'NO')]
export const intExt = [o('I', 'Internal'), o('E', 'External')]
export const yearDay = [o('W', 'Weeks'), o('M', 'Months'), o('Y', 'Year')]
export const maternity = [o('N', 'No'), o('D', 'Normal Delivery'), o('C', 'Caesarean')]
export const repudiated = ['RR', 'NR', 'PR', 'AR', 'BR', 'ER']
export const namedHospitals = ['DENTAL CLINIC', 'DIALYSIS CENTRE', 'FOREIGN HOSPITAL', 'GENERAL PRACTITIONER', 'GOVERNMENT HOSPITAL', 'NON-PANEL HOSPITAL', 'SPECIALIST CLINIC']
export const termLabels = ['Ref. Req. Adm', 'Ref. Req for Pre-Specialist', 'Min. Dur. Hosp', 'No. Phy Vst/Day', 'Spec. Per. Prin (Days)', 'Spec. Per. Supp (Days)', 'Lower Age Lmt', 'Upper Age Lmt', 'Student Age', 'Child Under Age']
export const termKeys = ['PLNRefRqdAdmin', 'PLNRefRqdPreSpec', 'PLNMinDurHosp', 'PLNPhyVstPerDay', 'PLNSepPeriodPrin', 'PLNSepPeriodSup', 'PLNLowerAgeLimit', 'PLNUpperAgeLimit', 'PLNStudentAge', 'PLNChildUntilAge']

export const DEFAULTS: Form = {
  cboStatus1: 'O', cboClaimability: 'AA', cboPending: 'N', txtCASReserveAmount: '1600', txtCASLGAmt: '2500',
  cboNature: 'ILL', cboModality: 'S', CboStayType: 'I', CboPayType: 'C', cboTopUpLmt: 'N', cboPayPending: 'N',
}

export const S = (v: unknown) => (v == null ? '' : String(v).trim())
export const toDate = (v: unknown) => (typeof v === 'string' && v ? new Date(v.length === 10 ? `${v}T00:00:00` : v) : null)
export { parseDmy }
export const isoDmy = (s: string) => {
  const d = parseDmy(s)
  return d ? `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}` : null
}
export const num = (s: string) => (s.trim() === '' ? null : Number.isNaN(Number(s.replace(/,/g, ''))) ? 0 : Number(s.replace(/,/g, '')))
export const codeOf = (s: string) => S(s.includes(' - ') ? s.slice(0, s.indexOf(' - ')) : s)
export const days = (a: Date, b: Date) => Math.floor((a.getTime() - b.getTime()) / 86400000)
/** GetAgeDays: days up to 364, otherwise whole years by calendar year. */
export const ageAt = (on: Date, dob: Date) => (days(on, dob) <= 364 ? { n: days(on, dob), unit: 'D' } : { n: on.getFullYear() - dob.getFullYear(), unit: 'Y' })
export const enterRuns = (fn: () => void) => (e: KeyboardEvent) => e.key === 'Enter' && (e.preventDefault(), fn())
/** The desktop stores the ~ as the line-break marker inside the remarks columns. */
export const unTilde = (s: string) => s.replaceAll('~', '\n')
/** CASFirstCall / CASFirstTreated are nvarchar columns holding dd/MM/yyyy already. */
export const dispDate = (v: unknown) => {
  const s = S(v)
  if (/^\d{2}\/\d{2}\/\d{4}$/.test(s)) return s
  const d = toDate(v)
  return d ? `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}` : ''
}
const pad = (n: number) => String(n).padStart(2, '0')
export const isoToDmy = (v: unknown) => {
  const d = toDate(v)
  return d ? `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}` : ''
}
/** Form_KeyPress: EnterToTab — Enter moves to the next field (fields with their own Enter action are skipped). */
export function enterToTab(e: KeyboardEvent) {
  if (e.key !== 'Enter' || e.defaultPrevented) return
  const el = e.target as HTMLElement
  if (el.tagName !== 'INPUT' && el.tagName !== 'SELECT') return
  if ((el as HTMLInputElement).type === 'checkbox') return
  e.preventDefault()
  const fields = Array.from(
    (e.currentTarget as HTMLElement).querySelectorAll<HTMLElement>('input:not(:disabled), select:not(:disabled), textarea:not(:disabled), button:not(:disabled)'),
  ).filter((x) => x.offsetParent !== null)
  const next = fields[(fields.indexOf(el) + 1) % fields.length]
  next?.focus()
}

export const memberColumns: Column[] = [
  { key: 'coverId', label: 'Cover ID' }, { key: 'name', label: 'Name' }, { key: 'ic', label: 'I/C No' }, { key: 'relation', label: 'Relation' },
  { key: 'dob', label: 'DOB' }, { key: 'annualLimit', label: 'Supp Annual Limit', format: (v) => formatMoney(v) }, { key: 'exclusion', label: 'Warranty Exc' },
]
export const benefitColumns: Column[] = [
  { key: 'BNFCode', label: 'Code' }, { key: 'BNFDescription', label: 'Bnf Desc' }, { key: 'BNFNoOfDays', label: 'Days', format: (v) => formatValue(v ?? 0) },
  { key: 'BNFClaimAbleAmount', label: 'RM PDay', format: (v) => formatMoney(v) }, { key: 'BNFRMPerDis', label: 'Per Dis', format: (v) => formatMoney(v) },
]
export const historyColumns: Column[] = [
  { key: 'MBMNumber', label: 'Mem No' }, { key: 'MBMPolicyNo', label: 'Pol No' }, { key: 'MBMPayorEffDate', label: 'Eff Date' },
  { key: 'MBMPayorExpDate', label: 'Exp Date' }, { key: 'INSCode', label: 'Insured Type' }, { key: 'PLNCode', label: 'Plan Code' },
]
const preIll: Record<string, string> = { '1': 'Illness', '2': 'Injury', '3': 'Hospitalisation' }
const undIll: Record<string, string> = { '1': 'Diabetes', '2': 'Hypertension' }
export const illnessColumns: Column[] = [
  { key: 'MBMNumber', label: 'Member No' }, { key: 'CASNumber', label: 'Case No' }, { key: 'MBMPatientCovID', label: 'Patient ID' },
  { key: 'CASDateAdmitted', label: 'Admission Date' }, { key: 'CASPreIllDate', label: 'Pre. Illness Date' },
  { key: 'CASPreIllCAT', label: 'Pre. Illness', format: (v, r) => preIll[S(v)] ?? (S(v) === '4' ? S(r.CASPreIllOthers) : '') },
  { key: 'CASPreIllInfBy', label: 'Pre. Illness Inf. By' }, { key: 'CASUndIllDate', label: 'Und. Illness Date' },
  { key: 'CASUndIllCAT', label: 'Und. Illness', format: (v, r) => undIll[S(v)] ?? (S(v) === '3' ? S(r.CASUndIllOthers) : '') },
  { key: 'CASUndIllInfBy', label: 'Und. Illness Inf. By' },
]
export const surgColumns: Column[] = [
  { key: 'PAYCode', label: 'Payor Code' }, { key: 'PLNCode', label: 'Plan Code' }, { key: 'SurgMainCat', label: 'Surgical Main Category' },
  { key: 'SurgSubCat', label: 'Surgical Sub Cat' }, { key: 'SurgPerc', label: 'Perc (% ) of Max. Benefit' },
]
export const memberFields = [
  { label: 'IC / BC / PP', key: 'MBMIcBcPp' },
  { label: 'Renewal', key: 'MBMRenewFlag' },
  { label: 'Takeover', key: 'MBMTakeover' },
  { label: 'Policy Eff. Date', key: 'MBMPolEffDate' },
  { label: 'Effective Date', key: 'MBMPayorEffDate' },
  { label: 'Expiry Date', key: 'MBMPayorExpDate' },
  { label: 'Policy No', key: 'MBMPolicyNo' },
]

/** A list loaded when its tab is opened (SSTab1_Click). */
export function useTabRows(key: unknown[], url: string, params: object, enabled: boolean) {
  return useQuery({ queryKey: ['case-reg', ...key], queryFn: async () => (await api.get<Row[]>(url, { params })).data, enabled })
}
