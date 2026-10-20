// The case editor shared by Case > Registration (frmCaseAdmission) and Case > Adjustment
// (frmCaseAdjustmentNew): form state, the member/patient context, every validation-on-blur
// and the field renderers — all in the desktop's control names so the field mapping stays 1:1.

import { useState } from 'react'
import type { ReactNode } from 'react'
import { useQuery } from '@tanstack/react-query'
import { api, errorMessage } from '../../api/client'
import { notify, say } from '../../lib/notifyStore'
import { formatDate, formatMoney } from '../../lib/format'
import type { Row } from '../../lib/format'
import { digitsOnly } from '../../lib/masks'
import { DateInput } from '../../components/DateInput'
import type { RepSelection } from './CaseRegistrationDialogs'
import type { LetterResult } from './CaseLetters'
import {
  DEFAULTS, namedHospitals, repudiated,
  S, toDate, parseDmy, isoDmy, num, codeOf, days, ageAt,
} from './caseShared'
import type { DiagGroup, DialogState, Form, Lookups, MemberView, Opt } from './caseShared'

export const NO_SELECTION: RepSelection = { document: '', personnel: '', attention: '', underlying: 'N' }

/** The member fields cmdShow_Click fills on both screens. */
export function memberFieldsFrom(data: MemberView): Form {
  const r = data.member
  return {
    txtMBMNumber: S(r.MBMNumber), txtMBMName: S(r.MBMName), txtMBMIcBcPP: S(r.MBMIcBcPp), txtRenewal: S(r.MBMRenewFlag), txtTakeOver: S(r.MBMTakeover),
    txtPolEffDate: formatDate(r.MBMPolEffDate), txtMBMEffDate: formatDate(r.MBMPayorEffDate), txtMBMExpiryDate: formatDate(r.MBMPayorExpDate),
    txtAdd1: S(r.MBMAddress1), txtAdd2: S(r.MBMAddress2), txtAdd3: S(r.MBMAddress3), txtPostCode: S(r.MBMPostCode), txtCity: S(r.CTYCode), txtState: S(r.STACode),
    txtAnnualLimit: data.annualLimit, txtAvailableAnnualLimit: formatMoney(r.MBMAvailableLimit), txtPrincipalExc: S(data.principalExclusion),
    txtUpgPLNCode: S(r.MBMNewPlanCode), txtDOC: formatDate(r.MBMNewPolEffDate),
  }
}

export function useCaseEditor() {
  const [f, setF] = useState<Form>(DEFAULTS)
  const [member, setMember] = useState<MemberView | null>(null)
  const [patient, setPatient] = useState<Row | null>(null)
  const [tab, setTab] = useState(1)
  const [page, setPage] = useState(1)
  const [chkDOA, setChkDOA] = useState(true)
  const [chkDOD, setChkDOD] = useState(true)
  const [panelBlocked, setPanelBlocked] = useState(false)
  const [hosNameEnabled, setHosNameEnabled] = useState(false)
  const [repSel, setRepSel] = useState<RepSelection>(NO_SELECTION)
  const [showRepSel, setShowRepSel] = useState(false)
  const [dialog, setDialog] = useState<DialogState>(null)
  const [letters, setLetters] = useState<LetterResult[]>([])

  const lookups = useQuery({ queryKey: ['case-reg-lookups'], queryFn: async () => (await api.get<Lookups>('/api/case/registration/lookups')).data, staleTime: 600_000 })
  const L = lookups.data

  const v = (k: string) => f[k] ?? ''
  const set = (k: string) => (value: string) => setF((x) => ({ ...x, [k]: value }))

  const m = member?.member
  const mbm = S(m?.MBMNumber)
  const ic = v('txtMBMIcBcPP')
  const pay = S(m?.PAYCode), hlt = S(m?.HLTCode), ins = S(m?.INSCode), plan = S(m?.PLNCode)
  const today = member ? new Date(member.today) : new Date()
  const isRepudiated = repudiated.includes(v('cboClaimability'))
  const expiry = parseDmy(v('txtMBMExpiryDate'))
  const daysLeft = expiry ? days(expiry, today) : null
  const notificationEnabled = !!member && daysLeft != null && daysLeft <= 45
  const loaded = !!member
  const hospitalCode = (name: string) => L?.hospitals.find((h) => h.name.toUpperCase() === name.trim().toUpperCase())?.code

  function reset() {
    setF(DEFAULTS)
    setMember(null)
    setPatient(null)
    setPage(1)
    setChkDOA(true)
    setChkDOD(true)
    setPanelBlocked(false)
    setHosNameEnabled(false)
    setRepSel(NO_SELECTION)
    setShowRepSel(false)
    setDialog(null)
    setLetters([])
  }

  function ageWarnings(on: Date | null, dobValue: unknown) {
    const dob = toDate(dobValue)
    if (!member || !on || !dob) return []
    const a = ageAt(on, dob)
    const out: string[] = []
    if (member.planStartAge != null && a.unit !== 'Y' && member.planStartAge >= a.n) out.push("Please verify Patient's Age!")
    if (member.planEndAge != null && a.unit !== 'D' && member.planEndAge < a.n) out.push("Please verify Patient's Age!")
    return out
  }

  /** cboPatientList_Click. */
  async function selectPatient(coverId: string) {
    set('cboPatientList')(coverId)
    if (!member || !coverId) return
    try {
      const { data: p } = await api.get<Row>(`/api/case/registration/member/${encodeURIComponent(mbm)}/patient/${encodeURIComponent(coverId)}`)
      setPatient(p)
      set('txtPatientIC')(S(p.PatientIC))
      const out: string[] = []
      if (S(p.BDayStatus) === 'Y') out.push('Please verify birthdate!')
      out.push(...ageWarnings(parseDmy(v('txtDateAdmitted')), p.DOB))
      const dob = toDate(p.DOB), eff = toDate(m?.MBMPayorEffDate)
      if (['S', 'D'].includes(S(p.Relationship)) && dob && eff && eff.getFullYear() - dob.getFullYear() >= 19) out.push('Please check employment status!')
      for (const [key, label] of [['PreExistIllDate', 'Pre-Existing Illness'], ['SpecificIllDate', 'Specific Illness'], ['WaitingPeriodDate', 'Waiting Period']]) {
        const d = toDate(p[key])
        if (d && d >= new Date(today.toDateString())) out.push(`Subject to ${label} until ${formatDate(p[key])}!`)
      }
      say(out)
    } catch (e) {
      notify(errorMessage(e), 'error')
    }
  }

  /** txtHOSCode_LostFocus. */
  async function hospitalBlur() {
    const name = v('txtHOSCode').trim()
    if (!name || !member) return
    const named = namedHospitals.includes(name.toUpperCase())
    if (named && !v('txtHOSName').trim()) notify('Please Enter Hospital Name or Clinic Name!')
    if (!named && v('txtHOSName').trim()) set('txtHOSName')('')
    setHosNameEnabled(named)
    setPanelBlocked(false)
    const code = hospitalCode(name)
    if (named || !code || v('CboPayType') !== 'C') return
    try {
      const { data } = await api.get<{ notOnPanel: boolean }>('/api/case/registration/hospital-check', {
        params: { hospital: code, pay, policy: S(m?.MBMPolicyNo), payType: v('CboPayType') },
      })
      if (data.notOnPanel) {
        notify('The selected hospital is not on the panel!', 'error')
        setPanelBlocked(true)
      }
    } catch (e) {
      notify(errorMessage(e), 'error')
    }
  }

  /** txtDateAdmitted_LostFocus / txtDateDischarge_LostFocus. */
  function dateBlur(which: 'doa' | 'dod') {
    const s = v(which === 'doa' ? 'txtDateAdmitted' : 'txtDateDischarge')
    if (!s || !(which === 'doa' ? chkDOA : chkDOD)) return
    const d = parseDmy(s)
    if (!d) return notify(which === 'doa' ? 'Invalid date format ! ' : 'Invalid Date Format! ', 'error')
    const doa = parseDmy(v('txtDateAdmitted')), dod = parseDmy(v('txtDateDischarge'))
    const eff = parseDmy(v('txtMBMEffDate')), exp = parseDmy(v('txtMBMExpiryDate'))
    const name = which === 'doa' ? 'Admission' : 'Discharge'
    const out: string[] = []
    if (doa && dod && dod < doa) out.push(which === 'doa' ? 'Admission Date cannot greater than Discharge Date! ' : 'Discharge Date must be greater then Admission date! ')
    if (d > today) out.push(`${name} Date cannot greater than system date ! `)
    if (eff && d < eff) out.push(`${name} Date cannot be less than Effective Date! `)
    if (v('CboPayType') === 'C' && exp && exp < d) out.push(`${name} Date cannot be greater than Expiry Date! `)
    if (which === 'doa' && out.length === 0 && patient) out.push(...ageWarnings(d, patient.DOB))
    say(out)
  }

  const otherDateBlur = (k: string) => () => v(k) && !parseDmy(v(k)) && notify('Invalid Date Format! ', 'error')

  /** txtPatientAge_LostFocus / cboYearDay_LostFocus. */
  function patientAgeBlur() {
    const n = Number(v('txtPatientAge')), unit = v('cboYearDay')
    if (!member || !v('txtPatientAge') || Number.isNaN(n) || !unit) return
    if (unit !== 'Y' && member.planStartAge != null && member.planStartAge >= n * (unit === 'W' ? 7 : 30)) notify("Please verify Patient's Age!")
    if (unit === 'Y' && member.planEndAge != null && member.planEndAge < n) notify("Please verify Patient's Age!")
  }

  /** cboClaimability_Click. */
  function claimabilityChange(code: string) {
    set('cboClaimability')(code)
    setRepSel(NO_SELECTION)
    if (!repudiated.includes(code)) return
    if (!v('cboREPCode1')) {
      notify('Please Select Repudiation reason', 'error')
      setTab(1)
    }
    setShowRepSel(true)
  }

  /** Picks fill the first empty slot, like the desktop's If/ElseIf chain on the target fields. */
  function pickCode(code: string, description: string) {
    if (dialog?.kind === 'rep') {
      const slot = [1, 2, 3].find((i) => !v(`cboREPCode${i}`).trim()) ?? 3
      set(`cboREPCode${slot}`)(`${code} - ${description}`)
    } else if (dialog?.kind === 'icd') {
      const prefix = { prelim: 'cboICDCode', final: 'cboFDICDCode', underlying: 'cboUDICDCode' }[dialog.group]
      const slot = [1, 2, 3].find((i) => !v(`${prefix}${i}`).trim()) ?? 3
      set(`${prefix}${slot}`)(code)
    } else if (dialog?.kind === 'opcs' || dialog?.kind === 'opcs-ns' || dialog?.kind === 'inv') {
      const prefix = { opcs: 'txtProcCode', 'opcs-ns': 'txtNSProcCode', inv: 'txtINVCode' }[dialog.kind]
      const count = dialog.kind === 'inv' ? 3 : 6
      const slot = Array.from({ length: count }, (_, i) => i + 1).find((i) => !v(`${prefix}${i}`).trim())
      if (slot) set(`${prefix}${slot}`)(code)
      if (dialog.kind !== 'inv' && slot) mma(dialog.kind === 'opcs' ? 'S' : 'NS', slot, code)
    }
    setDialog(null)
  }

  /** txtProcCodeN_Change / txtNSProcCodeN_Change: MMA fees for the OPCS code. */
  async function mma(kind: 'S' | 'NS', i: number, picked?: string) {
    const code = (picked ?? v(kind === 'S' ? `txtProcCode${i}` : `txtNSProcCode${i}`)).trim()
    let fees = { SurgeonsFees: 0, AnaesthetistsFees: 0 }
    if (code) {
      try {
        fees = (await api.get<typeof fees>(`/api/case/registration/mma/${encodeURIComponent(code)}`)).data
      } catch (e) {
        return notify(errorMessage(e), 'error')
      }
    }
    if (kind === 'S') setF((x) => ({ ...x, [`txtSMMARate${i}`]: String(fees.SurgeonsFees ?? 0), [`txtAnaesMMARate${i}`]: String(fees.AnaesthetistsFees ?? 0) }))
    else set(`txtNSMMARate${i}`)(String(fees.SurgeonsFees ?? 0))
  }

  /** The request body both screens send (CaseAdjustmentRequest adds its own fields on top). */
  function baseRequest() {
    const lines = (t: string, d: string, c: string) => [1, 2, 3].map((i) => ({ text: v(`${t}${i}`), onset: isoDmy(v(`${d}${i}`)), icd: v(`${c}${i}`) }))
    const procs = (p: string, c: string) => [1, 2, 3, 4, 5, 6].map((i) => ({ procedure: v(`${p}${i}`), code: v(`${c}${i}`) }))
    return {
      mbmNumber: mbm, claimability: v('cboClaimability'), pending: v('cboPending'),
      coverId: v('cboPatientList'), hospitalCode: hospitalCode(v('txtHOSCode')) ?? '', hospitalName: v('txtHOSName'),
      reason: v('txtReason'), referredBy: v('txtREFBy'), claimNature: v('cboNature'), stayType: v('CboStayType'), treatmentMode: v('cboModality'), payType: v('CboPayType'),
      firstCall: isoDmy(v('txtFirstCall')), firstTreated: isoDmy(v('txtFirstTreated')), dateAdmitted: isoDmy(v('txtDateAdmitted')), dateDischarged: isoDmy(v('txtDateDischarge')),
      checkAdmitted: chkDOA, checkDischarged: chkDOD,
      reserveAmount: num(v('txtCASReserveAmount')), lgAmount: num(v('txtCASLGAmt')), lgTime: v('txtLGTime'),
      recur: v('cboCondwillOcc'), followUpRequired: v('cboFLWTreatment'), followUp: v('cboFolUp'),
      policyYear: v('txtMBMPolYr'), patientAge: v('txtPatientAge'), ageUnit: v('cboYearDay'),
      prelimDiagnoses: lines('txtPrelimDiag', 'txtPDDOS', 'cboICDCode'),
      finalDiagnoses: lines('txtFinalDiag', 'txtFDDOS', 'cboFDICDCode'),
      underlyingDiseases: lines('txtUD', 'txtUDDOS', 'cboUDICDCode'),
      repudiationCodes: [1, 2, 3].map((i) => codeOf(v(`cboREPCode${i}`))),
      repDocument: repSel.document, repPersonnel: repSel.personnel, repAttention: repSel.attention, repUnderlying: repSel.underlying,
      surgicalProcedures: procs('txtProcedure', 'txtProcCode'), nonSurgicalProcedures: procs('txtNSProcedure', 'txtNSProcCode'),
      investigations: [1, 2, 3].map((i) => ({ procedure: v(`txtPROCINVDone${i}`), code: v(`txtINVCode${i}`) })),
      medicalManagement: [1, 2, 3].map((i) => v(`txtMEDSURDone${i}`)),
      anaesDoctors: [0, 1, 2].map((i) => v(`txtAnaesDoc${i}`)), attendingDoctors: [1, 2, 3, 4, 5].map((i) => v(`txtATTDoc${i}`)),
      takeOverInd: v('cboCASTakeOveInd'), takeOverAmount: num(v('txtCASTakeOverAmt')), intExtTakeOver: v('cboIntExtTO'), takeOverPlan: v('txtCASTOPlan'),
      reductionAmount: num(v('txtREDAmt')), topUpLimit: v('cboTopUpLmt'), specialApproval: v('cboCASInd'), queryStatus: v('cboQuery'), paymentPending: v('cboPayPending'),
      firstDocDate: isoDmy(v('txtFirstDocDate')), subsequentDocDate: isoDmy(v('txtSubDocDate')),
      remarks: [1, 2, 3, 4, 5].map((i) => v(`txtCASRemark${i}`)),
    }
  }

  /** Date fields checked for a valid date before saving. */
  function invalidDate() {
    const bad = (k: string) => !!v(k) && !parseDmy(v(k))
    if (bad('txtDateAdmitted')) return 'Please Enter a Valid Admission Date'
    if (['txtPDDOS', 'txtUDDOS', 'txtFDDOS'].some((p) => [1, 2, 3].some((i) => bad(`${p}${i}`)))) return 'Please Enter a Valid Diagnosis Date'
    if (bad('txtFirstCall')) return 'Please Enter a Valid First Call Date'
    if (bad('txtFirstTreated')) return 'Please Enter a Valid First Treated Date'
    if (bad('txtDateDischarge')) return 'Please Enter a Valid Discharge Date'
    if (bad('txtFirstDocDate') || bad('txtSubDocDate')) return 'Invalid Date Format! '
    return null
  }

  // ---- field helpers (modern layout, same control keys) ----
  const field = (label: string, children: ReactNode, wide?: boolean) => (
    <label className={wide ? 'form-field wide' : 'form-field'}>
      <span>{label}</span>
      {children}
    </label>
  )
  const txt = (k: string, o: { numeric?: boolean; max?: number; blur?: () => void; disabled?: boolean; title?: string } = {}) => (
    <input
      value={v(k)}
      maxLength={o.max}
      disabled={o.disabled}
      title={o.title}
      inputMode={o.numeric ? 'decimal' : undefined}
      onChange={(e) => set(k)(o.numeric ? digitsOnly(e.target.value) : e.target.value)}
      onBlur={o.blur}
    />
  )
  const ro = (k: string) => <input value={v(k)} readOnly className="ro" />
  const dateBox = (k: string, blur?: () => void) => <DateInput value={v(k)} onChange={set(k)} onBlur={blur} />
  const sel = (k: string, options: Opt[], o: { onChange?: (x: string) => void; disabled?: boolean; blank?: boolean; title?: string } = {}) => (
    <select value={v(k)} disabled={o.disabled} title={o.title} onChange={(e) => (o.onChange ?? set(k))(e.target.value)}>
      {(o.blank ?? true) && <option value="" />}
      {options.map((x) => (
        <option key={`${x.code}|${x.name ?? ''}`} value={x.code}>
          {x.name ? `${x.code} - ${x.name}` : x.code}
        </option>
      ))}
    </select>
  )
  const memo = (k: string, o: { max?: number; rows?: number; disabled?: boolean; title?: string } = {}) => (
    <textarea
      value={v(k)}
      maxLength={o.max}
      rows={o.rows ?? 3}
      disabled={o.disabled}
      title={o.title}
      onChange={(e) => set(k)(e.target.value)}
    />
  )

  /** Three diagnosis lines: description, onset date, ICD code (+ the search button). */
  const diagGroup = (caption: string, t: string, d: string, c: string, group: DiagGroup, extra?: ReactNode) => (
    <fieldset>
      <legend>
        {caption}{' '}
        <button type="button" className="link" onClick={() => setDialog({ kind: 'icd', group })} title="Search ICD">
          🔎 search
        </button>
        {extra}
      </legend>
      <div className="diag-rows">
        <div className="diag-head">
          <span>Diagnosis</span>
          <span>Date Onset</span>
          <span>ICD</span>
        </div>
        {[1, 2, 3].map((i) => (
          <div key={i} className="diag-row">
            <input aria-label={`${caption} ${i}`} maxLength={150} value={v(`${t}${i}`)} onChange={(e) => set(`${t}${i}`)(e.target.value)} />
            <DateInput ariaLabel={`Onset ${i}`} value={v(`${d}${i}`)} onChange={set(`${d}${i}`)} onBlur={otherDateBlur(`${d}${i}`)} />
            <input aria-label={`ICD ${i}`} maxLength={3} value={v(`${c}${i}`)} onChange={(e) => set(`${c}${i}`)(e.target.value)} />
          </div>
        ))}
      </div>
    </fieldset>
  )

  /** Procedure column: label + N bound inputs. */
  const procCol = (label: string, k: string, count: number, o: { max?: number; ro?: boolean; blur?: (i: number) => void } = {}) => (
    <div className="proc-col">
      <span className="proc-head">{label}</span>
      {Array.from({ length: count }, (_, i) =>
        o.ro ? (
          <input key={i} value={v(`${k}${i + 1}`)} readOnly className="ro" aria-label={`${label} ${i + 1}`} />
        ) : (
          <input key={i} value={v(`${k}${i + 1}`)} maxLength={o.max} aria-label={`${label} ${i + 1}`} onChange={(e) => set(`${k}${i + 1}`)(e.target.value)} onBlur={o.blur ? () => o.blur!(i + 1) : undefined} />
        ),
      )}
    </div>
  )

  return {
    f, setF, v, set, member, setMember, patient, setPatient, tab, setTab, page, setPage,
    chkDOA, setChkDOA, chkDOD, setChkDOD, panelBlocked, setPanelBlocked, hosNameEnabled, setHosNameEnabled,
    repSel, setRepSel, showRepSel, setShowRepSel, dialog, setDialog, letters, setLetters,
    lookups, L, m, mbm, ic, pay, hlt, ins, plan, today, isRepudiated, expiry, daysLeft,
    notificationEnabled, loaded, hospitalCode, reset, ageWarnings, selectPatient,
    hospitalBlur, dateBlur, otherDateBlur, patientAgeBlur, claimabilityChange,
    pickCode, mma, baseRequest, invalidDate, field, txt, ro, dateBox, sel, memo, diagGroup, procCol,
  }
}

export type CaseEditor = ReturnType<typeof useCaseEditor>
