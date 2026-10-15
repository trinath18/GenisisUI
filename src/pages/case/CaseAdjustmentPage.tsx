// Case > Adjustment (legacy frmCaseAdjustmentNew + frmGLMenu + frmCASList): load a case by
// number (or the search dialog), edit the same fields as registration, run the progress /
// repudiation / GL actions and browse the LG, Worksheet, Forms and Policy Wording tabs.

import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { AxiosError } from 'axios'
import { api, errorMessage } from '../../api/client'
import { DataTable } from '../../components/DataTable'
import type { Column } from '../../components/DataTable'
import { ask, notify, say } from '../../lib/notifyStore'
import { formatDate, formatMoney, formatValue } from '../../lib/format'
import type { Row } from '../../lib/format'
import { useCaseEditor, memberFieldsFrom } from './useCaseEditor'
import { CaseEditorDialogs, GeneralInfoSection, CaseDetailsSection, CaseOthersSection, TakeOverSection, BenefitSection, WarrantySection, NotesSection, PolicyTermsSection, SurgicalSection, MemberRail } from './CaseSections'
import { CaseSearchDialog, GlDialog } from './CaseAdjustmentDialogs'
import {
  claimabilities, statuses, yesNo, namedHospitals, enterRuns, enterToTab, parseDmy, days, isoToDmy, isoDmy, unTilde, dispDate, S, DEFAULTS,
} from './caseShared'
import type { MemberView, Form } from './caseShared'
import type { LetterResult } from './CaseLetters'

const tabs = ['General Info', 'Case Details', 'Case Others', 'Take Over/Others', 'Benefit', 'Warranty Exclusion', 'Case Mgmt Notes', 'LG', 'Worksheet', 'Policy Terms', 'Surgical Schedule', 'Forms', 'Policy Wording'] as const

interface AdjustView {
  case: Row
  member: MemberView
  firstDiagnosis?: Row
  finalDiagnosis?: Row
  repudiation?: Row
  pendingReason?: string
  policyWording?: string
  hasLg: boolean
  canUpdate: boolean
  lgEnabled: boolean
  askResetClaimability: boolean
  alerts: { text: string; critical: boolean }[]
}

interface CaseFile {
  name: string
  size: number
  modified: string
}

export function CaseAdjustmentPage() {
  const navigate = useNavigate()
  const ed = useCaseEditor()
  const {
    setF, v, set, member, setMember, setPatient, tab, setTab, isRepudiated, notificationEnabled,
    m, mbm, lookups, claimabilityChange, baseRequest, invalidDate, field, sel, setRepSel, setHosNameEnabled,
  } = ed
  const [view, setView] = useState<AdjustView | null>(null)
  const [caseNo, setCaseNo] = useState('')
  const [busy, setBusy] = useState(false)
  const [saving, setSaving] = useState(false)
  const [docBusy, setDocBusy] = useState(false)
  const [searchOpen, setSearchOpen] = useState(false)
  const [glOpen, setGlOpen] = useState(false)

  const pendingReasons = useQuery({
    queryKey: ['case-adj', 'pending-reasons'],
    queryFn: async () => (await api.get<string[]>('/api/case/adjustment/pending-reasons')).data,
    staleTime: 600_000,
  })
  const lgRows = useQuery({
    queryKey: ['case-adj', 'lg', caseNo],
    queryFn: async () => (await api.get<Row[]>(`/api/case/adjustment/${encodeURIComponent(caseNo)}/lg`)).data,
    enabled: tab === 7 && !!caseNo,
  })
  const wsRows = useQuery({
    queryKey: ['case-adj', 'ws', caseNo],
    queryFn: async () => (await api.get<Row[]>(`/api/case/adjustment/${encodeURIComponent(caseNo)}/worksheet`)).data,
    enabled: tab === 8 && !!caseNo,
  })
  const docs = useQuery({
    queryKey: ['case-adj', 'docs', caseNo],
    queryFn: async () => (await api.get<Record<string, CaseFile[]> | { unavailable: true }>(`/api/case/adjustment/${encodeURIComponent(caseNo)}/documents`)).data,
    enabled: tab === 11 && !!caseNo,
  })
  const wordingFiles = useQuery({
    queryKey: ['case-adj', 'wording', view?.policyWording],
    queryFn: async () => (await api.get<CaseFile[]>(`/api/case/adjustment/policy-wording/${encodeURIComponent(view!.policyWording!)}`)).data,
    enabled: tab === 12 && !!view?.policyWording,
  })

  /** Map the loaded case (SearchCasAdjustment + extras) into the form's control keys. */
  function applyView(data: AdjustView) {
    const c = data.case
    const cover = S(c.MBMPatientCovID)
    const pm = data.member?.members.find((x) => x.coverId === cover)
    const fd = data.firstDiagnosis, ld = data.finalDiagnosis, rep = data.repudiation
    const nf: Form = {}
    for (let i = 1; i <= 6; i++) {
      nf[`txtProcedure${i}`] = S(c[`CASOPROCRequired${i}`])
      nf[`txtProcCode${i}`] = S(c[`CASCptCode${i}`])
      nf[`txtSActFee${i}`] = S(c[`CASProcActSurgFees${i}`])
      nf[`txtAnaesActFees${i}`] = S(c[`CASProcActAnaeFees${i}`])
      nf[`txtNSProcedure${i}`] = S(c[`CASONonSurgPROCRequired${i}`])
      nf[`txtNSProcCode${i}`] = S(c[`CASNonSurgCptCode${i}`])
      nf[`txtNSActFee${i}`] = S(c[`CASProcActNonSurgFees${i}`])
    }
    for (let i = 1; i <= 3; i++) {
      nf[`txtPROCINVDone${i}`] = S(c[`CASOProcInvestigationDone${i}`])
      nf[`txtINVCode${i}`] = S(c[`CASInvCode${i}`])
      nf[`txtMEDSURDone${i}`] = S(c[`CASOMedSurMgmt${i}`])
      nf[`cboICDCode${i}`] = S(fd?.[`ICDCode${i}`])
      nf[`txtPDDOS${i}`] = isoToDmy(fd?.[`DIADOS${i}`])
      nf[`txtPrelimDiag${i}`] = S(fd?.[`DIAPrelimDiag${i}`])
      nf[`cboFDICDCode${i}`] = S(ld?.[`ICDCode${i}`])
      nf[`txtFDDOS${i}`] = isoToDmy(ld?.[`DIADOS${i}`])
      nf[`txtFinalDiag${i}`] = S(ld?.[`DIAFinalDiag${i}`])
      nf[`cboUDICDCode${i}`] = S(c[`CASUDCode${i}`])
      nf[`txtUDDOS${i}`] = isoToDmy(c[`CASUDDOS${i}`])
      nf[`txtUD${i}`] = S(c[`CASUDReasons${i}`])
      nf[`cboREPCode${i}`] = S(rep?.[`Rep${i}`])
      nf[`txtAnaesDoc${i - 1}`] = S(c[`CASAnaesName${i}`])
    }
    for (let i = 1; i <= 5; i++) nf[`txtATTDoc${i}`] = S(c[`CASAttendDoctor${i}`])

    ed.reset()
    setView(data)
    setMember(data.member)
    setPatient(pm ? { PatientIC: pm.ic, DOB: pm.dob, Name: pm.name, Relationship: pm.relation, PlanCode: S(c.MBMCPLNCode) } : null)
    setRepSel({ document: S(rep?.CASDocument), personnel: S(rep?.CASPersonnel), attention: S(rep?.CASAttention), underlying: S(rep?.CASUnderlying) === 'Y' ? 'Y' : 'N' })
    setHosNameEnabled(namedHospitals.includes(S(c.HOSName).toUpperCase()))
    setF({
      ...DEFAULTS, ...memberFieldsFrom(data.member), ...nf,
      cboPatientList: cover,
      txtPatientIC: S(pm?.ic),
      cboStatus1: S(c.CASStatus) || 'O',
      cboClaimability: S(c.CASClaimability), cboPending: S(c.CASPending), cboCASInd: S(c.CASInd),
      cboPendingReason: S(data.pendingReason),
      txtDateAdmitted: formatDate(c.CASDateAdmitted), txtDateDischarge: formatDate(c.CASDischargeDate),
      cboQuery: S(c.CASQuery),
      txtHOSCode: S(c.HOSName), txtHOSName: S(c.CASHOSName),
      CboStayType: S(c.CASStayType), CboPayType: S(c.CASPAYType),
      txtReason: S(c.CASAdmissionReason), cboNature: S(c.ClaimNatureCode), cboModality: S(c.ModalityCode),
      txtREFBy: S(c.ReferedBy), txtCASReserveAmount: S(c.CASReserveAmount), txtCASLGAmt: S(c.CASLGAmt), txtLGTime: S(c.CASLGTime),
      TxtLinkCASNo: S(c.LINKCASNo), cboTopUpLmt: S(c.CASTopupLmt),
      txtCASTakeOverAmt: S(c.CASTakeOverAmt), cboCASTakeOveInd: S(c.CASTakeOverInd), txtCASTOPlan: S(c.CASTakeOverPlan), cboIntExtTO: S(c.CASIntExtTO),
      txtMBMPolYr: S(c.CASPolYear), txtPolEffDate: formatDate(c.MBMPolEffDate),
      txtCASRemark1: unTilde(S(c.CASORemarks) + S(c.CASORemarksTwo)),
      txtCASRemark2: unTilde(S(c.CASOTwoRemarks) + S(c.CASOTwoRemarksTwo)),
      txtCASRemark3: unTilde(S(c.CASRemarks)), txtCASRemark4: unTilde(S(c.CASRemarksFour)), txtCASRemark5: unTilde(S(c.CASRemarksFive)),
      cboCondwillOcc: S(c.CASOCondWillRecur), cboFLWTreatment: S(c.CASOFollowUpRequired), cboFolUp: S(c.CASFolUp),
      txtFirstCall: dispDate(c.CASFirstCall), txtFirstTreated: dispDate(c.CASFirstTreated),
      txtDateRECDoc: formatDate(c.CASDRD), txtREDAmt: S(c.CASRedAmt), cboPayPending: S(c.CASPayPending),
      txtPatientAge: S(c.CASPatientAge), cboYearDay: S(c.CASPatientDayYr),
      txtFirstDocDate: formatDate(c.CASFirstDocDate), txtSubDocDate: formatDate(c.CASSubSeqDocDate),
      cboSuppExc: cover !== '00' ? cover : '', txtSuppExc: cover !== '00' ? S(pm?.exclusion) : '',
    })
    setCaseNo(S(c.CASNumber))
    setTab(0)
    say([...(data.member?.alerts ?? []).map((a) => a.text), ...(data.alerts ?? []).map((a) => a.text)])
  }

  /** cmdShow_Click. */
  async function load(no?: string) {
    const cas = (no ?? v('txtCaseNo')).trim()
    if (!cas) return notify('Please Enter Case No', 'error')
    if (busy) return
    setBusy(true)
    try {
      const { data } = await api.get<AdjustView>(`/api/case/adjustment/${encodeURIComponent(cas)}`)
      applyView(data)
      // showCAS: an accepted case still pending asks to flip the claimability back to Not Decided.
      if (data.askResetClaimability && (await ask('Do you want to change Claimability Status?'))) {
        try {
          const { data: r } = await api.post<{ message: string }>(`/api/case/adjustment/${encodeURIComponent(S(data.case.CASNumber))}/reset-claimability`)
          set('cboClaimability')('NN')
          notify(r.message ?? 'Status has been updated sucessfully', 'success')
        } catch (e) {
          notify(errorMessage(e), 'error')
        }
      }
    } catch (e) {
      notify(e instanceof AxiosError && e.response?.status === 404 ? 'No record found!' : errorMessage(e), 'error')
    } finally {
      setBusy(false)
    }
  }

  const request = () => ({
    ...baseRequest(),
    memberName: S(m?.MBMName),
    status: v('cboStatus1'),
    linkCaseNo: v('TxtLinkCASNo'),
    docReceivedDate: isoDmy(v('txtDateRECDoc')),
    pendingReason: v('cboPendingReason'),
  })

  /** cmdUpdate1_Click's checks, in the desktop order. */
  function updateError(): string | null {
    if (!caseNo) return 'Please Enter Case No!'
    if (!v('cboClaimability').trim()) return 'Please Select Claimability!'
    if (!mbm) return 'Please Enter Member No!'
    if (!S(m?.MBMName)) return 'Please Enter Member Name!'
    if (!v('txtDateAdmitted').trim()) return 'Please Enter Admission Date'
    if (v('cboIntExtTO') === 'I' && !v('txtCASTOPlan').trim()) return 'Please Enter Takeover Plan'
    if (!v('txtMBMPolYr').trim()) return 'Please Enter Policy Year'
    if (!/^\d+$/.test(v('txtMBMPolYr').trim())) return 'Policy Year must be a number'
    if (!v('txtPatientAge').trim()) return "Please Enter Patient's Age"
    if (!v('cboYearDay').trim()) return 'Please Select Day/Year'
    if (namedHospitals.includes(v('txtHOSCode').toUpperCase()) && !v('txtHOSName').trim()) return 'Please Enter Hospital Name or Clinic Name!'
    if (v('txtLGTime').trim() && !/^([01]\d|2[0-3]):[0-5]\d$/.test(v('txtLGTime').trim())) return 'Invalid Time Format!'
    if ([1, 2, 3, 4, 5].some((i) => v(`txtCASRemark${i}`).includes('~'))) return 'You are not allowed to use the ~ symbol in the remarks'
    return invalidDate()
  }

  async function update() {
    if (!view || saving) return
    const doa = parseDmy(v('txtDateAdmitted')), dod = parseDmy(v('txtDateDischarge'))
    if (doa && dod && days(dod, doa) > 5 && !(await ask('Admission Period Is More Than 5 Days.'))) return
    const bad = updateError()
    if (bad) return notify(bad, 'error')
    if (!(await ask('Are you sure?'))) return
    setSaving(true)
    try {
      const { data } = await api.put<{ message: string }>(`/api/case/adjustment/${encodeURIComponent(caseNo)}`, request())
      notify(data.message ?? 'Record Updated Sucessfully', 'success')
    } catch (e) {
      notify(errorMessage(e), 'error')
    } finally {
      setSaving(false)
    }
  }

  /** cmdRepudiate_Click: save the repudiation, mark the case declined and show the letter. */
  async function repudiate() {
    if (docBusy || !view?.canUpdate || !isRepudiated) return
    if (!(await ask('Are you sure?'))) return
    setDocBusy(true)
    try {
      const { data } = await api.post<LetterResult>(`/api/case/adjustment/${encodeURIComponent(caseNo)}/repudiate`, request())
      ed.setLetters((q) => [...q, data])
      notify('The case has been repudiated.', 'success')
    } catch (e) {
      notify(errorMessage(e), 'error')
    } finally {
      setDocBusy(false)
    }
  }

  /** The letter buttons: D (Doc Disch), I (GP/QA), S (Reim Req), M (Mgmt Note), AUTO (Notify). */
  async function fetchLetter(letter: 'D' | 'I' | 'S' | 'M' | 'auto', confirm = false) {
    if (docBusy || !view) return
    if (confirm && !(await ask('Are you sure?'))) return
    setDocBusy(true)
    try {
      const { data } = await api.post<LetterResult>(`/api/case/adjustment/${encodeURIComponent(caseNo)}/letter/${letter}`, request())
      ed.setLetters((q) => [...q, data])
    } catch (e) {
      notify(errorMessage(e), 'error')
    } finally {
      setDocBusy(false)
    }
  }

  /** C. Ref AA / C. Ref RR / Clear Doc Record. */
  async function progress(action: 'referral-accept' | 'referral-reject' | 'clear-doc') {
    if (docBusy || !view?.canUpdate) return
    if (!(await ask('Are you sure?'))) return
    setDocBusy(true)
    try {
      const { data } = await api.post<{ message: string }>(`/api/case/adjustment/${encodeURIComponent(caseNo)}/progress/${action}`)
      notify(data.message, 'success')
    } catch (e) {
      notify(errorMessage(e), 'error')
    } finally {
      setDocBusy(false)
    }
  }

  /** cmdDocReqAdm on the LG tab: delete the selected GL record. */
  async function deleteLg(row: Row) {
    if (!(await ask('Are you sure?'))) return
    try {
      const { data } = await api.delete<{ message: string }>(`/api/case/adjustment/${encodeURIComponent(caseNo)}/lg/${row.LGNo}`)
      notify(data.message ?? 'GL Deleted Successful...', 'success')
      lgRows.refetch()
    } catch (e) {
      notify(errorMessage(e), 'error')
    }
  }

  /** cmdDelGL_Click: remove a document file (InternalDocuments / FinalLgs). */
  async function deleteFile(folder: string, row: Row) {
    if (!(await ask('Are you sure?'))) return
    try {
      const { data } = await api.delete<{ message: string }>(
        `/api/case/adjustment/${encodeURIComponent(caseNo)}/documents/${folder}/${encodeURIComponent(S(row.name))}`,
      )
      notify(data.message ?? 'File Deleted Successful...', 'success')
      docs.refetch()
    } catch (e) {
      notify(errorMessage(e), 'error')
    }
  }

  async function downloadFile(url: string, name: string) {
    try {
      const { data } = await api.get(url, { responseType: 'blob' })
      const a = document.createElement('a')
      a.href = URL.createObjectURL(data)
      a.download = name
      a.click()
      URL.revokeObjectURL(a.href)
    } catch (e) {
      notify(errorMessage(e), 'error')
    }
  }

  /** CmdBrowse_Click + CmdCopy_Click: upload into the case's ScannedDoc folder. */
  async function upload(fileList: FileList | null) {
    const file = fileList?.[0]
    if (!file || !caseNo) return
    try {
      const body = new FormData()
      body.append('file', file)
      await api.post(`/api/case/adjustment/${encodeURIComponent(caseNo)}/documents`, body)
      notify('File copied to the case documents.', 'success')
      docs.refetch()
    } catch (e) {
      notify(errorMessage(e), 'error')
    }
  }

  function clear() {
    ed.reset()
    setView(null)
    setCaseNo('')
    setTab(0)
  }

  const lgColumns: Column[] = [
    { key: '_lg', label: 'GL No', format: (_x, r) => `${S(r.LGStatus) === 'B' ? 'B' : 'L'}${S(r.CaseNo)}-${S(r.LGNo)}${S(r.LGPurpose).slice(0, 1)}` },
    { key: 'LGPurpose', label: 'Purpose' },
    { key: 'LGDate', label: 'GL Date', format: (x) => formatDate(x) },
    { key: 'LGAmt', label: 'Amount', format: (x) => formatMoney(x) },
    { key: 'LGIssuedBy', label: 'Issued By' },
    { key: 'LGUserTime', label: 'User Time' },
    { key: 'LGSystemTime', label: 'System Time' },
    { key: 'LGIndicator', label: 'Ind' },
    { key: 'LGRemark', label: 'Remark' },
  ]

  const wsColumns: Column[] = (wsRows.data?.[0] ? Object.keys(wsRows.data[0]) : []).map((k) => ({ key: k, label: k }))

  const docTable = (title: string, folder: 'scanned' | 'internal' | 'final-lgs', canDelete: boolean) => {
    const files = docs.data && !('unavailable' in docs.data) ? (docs.data[folder] ?? []) : []
    return (
      <fieldset>
        <legend>{title}</legend>
        {docs.isFetching ? (
          <p className="muted">Loading…</p>
        ) : files.length === 0 ? (
          <p className="muted">No files.</p>
        ) : (
          <ul className="doc-list">
            {files.map((x) => (
              <li key={x.name}>
                <button type="button" className="link doc-name" title="Download" onClick={() => downloadFile(`/api/case/adjustment/${encodeURIComponent(caseNo)}/documents/${folder}/${encodeURIComponent(x.name)}`, x.name)}>
                  {x.name}
                </button>
                <span className="muted">
                  {formatValue(x.size)} B — {formatDate(x.modified)}
                </span>
                {canDelete && (
                  <button type="button" className="link danger" title="Delete this file" onClick={() => deleteFile(folder, { name: x.name })}>
                    ✕ Delete
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}
      </fieldset>
    )
  }

  const canUpdate = !!view?.canUpdate

  return (
    <section className="registration case-reg" onKeyDown={enterToTab}>
      <fieldset>
        <legend>Case Adjustment</legend>
        {field(
          'Case No',
          <div className="search-inline">
            <input value={v('txtCaseNo')} maxLength={15} autoFocus onChange={(e) => set('txtCaseNo')(e.target.value)} onKeyDown={enterRuns(() => load())} />
            <button type="button" onClick={() => load()} disabled={busy}>
              {busy ? 'Loading…' : 'Go'}
            </button>
            <button type="button" className="link" onClick={() => setSearchOpen(true)}>
              Search
            </button>
          </div>,
        )}
        {field('Case Status', sel('cboStatus1', statuses, { disabled: !canUpdate, blank: false }))}
        {field('Claimability', sel('cboClaimability', claimabilities, { onChange: claimabilityChange, disabled: !canUpdate }))}
        {field('Pending', sel('cboPending', yesNo, { blank: false, disabled: !canUpdate }))}
        {field(
          'Pending Reason',
          <select value={v('cboPendingReason')} onChange={(e) => set('cboPendingReason')(e.target.value)} disabled={!canUpdate}>
            <option value="" />
            {(pendingReasons.data ?? []).map((x) => (
              <option key={x} value={x}>
                {x}
              </option>
            ))}
          </select>,
        )}
      </fieldset>

      <div className="actions cr-actions">
        <button
          type="button"
          className="ghost"
          onClick={() => setGlOpen(true)}
          disabled={!view?.lgEnabled || docBusy}
          title={!view ? 'Load a case first' : !view.lgEnabled ? 'A new GL is not allowed for this case' : 'Generate Guarantee Letter (frmGLMenu)'}
        >
          LG
        </button>
        <button type="button" className="ghost" onClick={() => fetchLetter('auto')} disabled={!notificationEnabled || docBusy}
          title={!member ? 'Load a case first' : !notificationEnabled ? 'Available within 45 days of the membership expiry' : 'Payor notification letter'}>
          Notify
        </button>
        <button type="button" className="ghost" onClick={() => fetchLetter('D', true)} disabled={!canUpdate || docBusy} title="Documents required on discharge + mark pending">
          Doc Disch
        </button>
        <button type="button" className="ghost" onClick={() => fetchLetter('I')} disabled={!view || docBusy} title="GP / QA investigation request">
          GP/QA
        </button>
        <button type="button" className="ghost" onClick={() => fetchLetter('S')} disabled={!view || docBusy} title="Reimbursement documents request">
          Reim Req
        </button>
        <button type="button" className="ghost" onClick={() => fetchLetter('M')} disabled={!view || docBusy} title="Case management note">
          Mgmt Note
        </button>
        <button type="button" className="ghost" onClick={() => progress('referral-accept')} disabled={!canUpdate || docBusy} title="Case approved for referral doctor">
          C. Ref AA
        </button>
        <button type="button" className="ghost" onClick={() => progress('referral-reject')} disabled={!canUpdate || docBusy} title="Case declined for referral doctor">
          C. Ref RR
        </button>
        <span className="spacer" />
        {caseNo && <span className="case-no">Case No: {caseNo}</span>}
        <button type="button" className="ghost" onClick={repudiate} disabled={!canUpdate || !isRepudiated || docBusy}
          title={!isRepudiated ? 'Select a repudiated claimability code first' : 'Repudiate the case and produce the letter'}>
          Repudiate
        </button>
        <button type="button" className="primary" onClick={update} disabled={!canUpdate || saving}>
          {saving ? 'Updating…' : 'Update'}
        </button>
        <button type="button" className="link" onClick={clear}>
          Clear
        </button>
        <button type="button" className="link" onClick={() => navigate('/')}>
          Exit
        </button>
      </div>

      <div className="cr-main">
        <div className="cr-content">
          <div className="tabs" role="tablist">
            {tabs.map((t, i) => (
              <button key={t} type="button" role="tab" aria-selected={tab === i} className={tab === i ? 'active' : ''} onClick={() => setTab(i)}>
                {t}
              </button>
            ))}
          </div>
          <div className="tab-body">
            {tab === 0 && <GeneralInfoSection ed={ed} />}
            {tab === 1 && <CaseDetailsSection ed={ed} />}
            {tab === 2 && <CaseOthersSection ed={ed} actualFees />}
            {tab === 3 && (
              <TakeOverSection
                ed={ed}
                extras={
                  <>
                    {field('Link Case No', <input value={v('TxtLinkCASNo')} maxLength={15} onChange={(e) => set('TxtLinkCASNo')(e.target.value)} />)}
                    {field('Doc Received', <input value={v('txtDateRECDoc')} placeholder="dd/mm/yyyy" maxLength={10} inputMode="numeric" onChange={(e) => set('txtDateRECDoc')(e.target.value)} />)}
                  </>
                }
              />
            )}
            {tab === 4 && <BenefitSection ed={ed} />}
            {tab === 5 && <WarrantySection ed={ed} />}
            {tab === 6 && (
              <NotesSection
                ed={ed}
                template={
                  caseNo
                    ? async () => (await api.post<{ page1: string; page2: string }>(`/api/case/adjustment/${encodeURIComponent(caseNo)}/notes-template`, request())).data
                    : undefined
                }
              />
            )}
            {tab === 7 && (
              <>
                <fieldset>
                  <legend>Guarantee Letters on File</legend>
                  {lgRows.isFetching ? <p className="muted">Loading…</p> : (
                    <DataTable columns={lgColumns} rows={lgRows.data ?? []} empty="No guarantee letters for this case." onActivate={(r) => deleteLg(r)} />
                  )}
                  {(lgRows.data?.length ?? 0) > 0 && <p className="muted">Double-click a row (or press Enter) to delete the GL — same as the desktop's Delete button.</p>}
                </fieldset>
              </>
            )}
            {tab === 8 && (wsRows.isFetching ? <p className="muted">Loading…</p> : <DataTable columns={wsColumns} rows={wsRows.data ?? []} empty="No worksheet claim versions for this case." />)}
            {tab === 9 && (
              <PolicyTermsSection
                ed={ed}
                actions={
                  <button type="button" className="ghost" onClick={() => progress('clear-doc')} disabled={!canUpdate || docBusy} title="Clear Doc Record">
                    Clear Doc Record
                  </button>
                }
              />
            )}
            {tab === 10 && <SurgicalSection ed={ed} />}
            {tab === 11 && (
              <>
                {docs.data && 'unavailable' in docs.data ? (
                  <p className="muted">The case document folder is not configured on this server.</p>
                ) : (
                  <>
                    {docTable('Scanned Documents', 'scanned', false)}
                    {docTable('Internal Documents', 'internal', true)}
                    {docTable('Final LGs', 'final-lgs', true)}
                  </>
                )}
                <fieldset>
                  <legend>Browse + Copy</legend>
                  <label className="form-field wide">
                    <span>Upload a document into this case's scanned documents</span>
                    <input type="file" onChange={(e) => (upload(e.target.files), (e.target.value = ''))} />
                  </label>
                </fieldset>
              </>
            )}
            {tab === 12 && (
              <>
                <h4>{view?.policyWording ? `Policy wording — ${view.policyWording}` : 'Policy Wording'}</h4>
                {!view?.policyWording ? (
                  <p className="muted">Load a case to see its policy wording documents.</p>
                ) : wordingFiles.isFetching ? (
                  <p className="muted">Loading…</p>
                ) : (
                  <DataTable
                    columns={[
                      { key: 'name', label: 'Document' },
                      { key: 'size', label: 'Size (B)', format: (x) => formatValue(x) },
                      { key: 'modified', label: 'Modified', format: (x) => formatDate(x) },
                    ]}
                    rows={(wordingFiles.data ?? []) as unknown as Row[]}
                    empty="No policy wording files."
                    onActivate={(r) => downloadFile(`/api/case/adjustment/policy-wording/${encodeURIComponent(view.policyWording!)}/${encodeURIComponent(S(r.name))}`, S(r.name))}
                  />
                )}
              </>
            )}
          </div>
        </div>

        {member && <MemberRail member={member} />}
      </div>

      {lookups.error && <p className="error">{errorMessage(lookups.error)}</p>}
      <CaseEditorDialogs ed={ed} />
      {searchOpen && <CaseSearchDialog onPick={(cas) => (setSearchOpen(false), set('txtCaseNo')(cas), load(cas))} onClose={() => setSearchOpen(false)} />}
      {glOpen && caseNo && (
        <GlDialog
          cas={caseNo}
          request={request}
          defaultAmount={v('txtCASLGAmt') || v('txtCASReserveAmount')}
          onIssued={(r) => {
            setGlOpen(false)
            ed.setLetters((q) => [...q, r.letter])
            notify(`GL ${r.lgNumber} issued.`, 'success')
            lgRows.refetch()
            setView((x) => (x ? { ...x, hasLg: true, lgEnabled: false } : x))
          }}
          onClose={() => setGlOpen(false)}
        />
      )}
    </section>
  )
}
