import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { AxiosError } from 'axios'
import { api, errorMessage } from '../../api/client'
import { ask, notify, say } from '../../lib/notifyStore'
import type { Row } from '../../lib/format'
import { useCaseEditor, memberFieldsFrom } from './useCaseEditor'
import { CaseEditorDialogs, GeneralInfoSection, CaseDetailsSection, CaseOthersSection, TakeOverSection, BenefitSection, HistorySection, WarrantySection, NonDisclosureSection, NotesSection, PolicyTermsSection, SurgicalSection, MemberRail } from './CaseSections'
import { claimabilities, statuses, yesNo, enterRuns, enterToTab, parseDmy, days, DEFAULTS } from './caseShared'
import type { MemberView } from './caseShared'
import type { LetterResult } from './CaseLetters'

// Behaviour follows the desktop frmCaseAdmission (Case > Registration): same fields, same checks, same messages.

const tabs = ['General Info', 'Case Details', 'Case Others', 'Take Over/Others', 'Benefit', "MBM'Ship History", 'Warranty', 'Non-Disclosure', 'Case Mgmt Notes', 'Policy Terms', 'Surgical Schedule', 'Policy Wording'] as const

export function CaseRegistrationPage() {
  const navigate = useNavigate()
  const ed = useCaseEditor()
  const {
    setF, v, set, member, setMember, tab, setTab, chkDOA, chkDOD, panelBlocked, isRepudiated, daysLeft, notificationEnabled,
    pay, lookups, claimabilityChange, baseRequest, invalidDate, field, sel,
  } = ed
  const [caseNo, setCaseNo] = useState('')
  const [saving, setSaving] = useState(false)
  const [busy, setBusy] = useState(false)
  const [docBusy, setDocBusy] = useState(false)
  const [lgDone, setLgDone] = useState(false)
  const registerEnabled = !!member && !caseNo && !saving && !panelBlocked && (member.canRegister || (!chkDOA && !chkDOD))

  function clear() {
    ed.reset()
    setTab(0)
    setCaseNo('')
    setLgDone(false)
  }

  /** cmdShow_Click (Go). */
  async function show(picked?: string) {
    const no = (picked ?? v('txtMBMNumber')).trim()
    if (!no || (busy && !picked)) return
    setBusy(true)
    if (!picked && (no.length === 8 || no.length === 9 || (no.length === 11 && no[8] !== '*'))) {
      try {
        const { data } = await api.get<Row[]>('/api/case/registration/member-search', { params: { by: 'number', q: no } })
        if (data.length === 0) notify('No record found!', 'error')
        else if (data.length === 1) {
          setBusy(false)
          return show(String(data[0].MBMNumber))
        } else ed.setDialog({ kind: 'member', initial: { by: 'number', q: no, rows: data } })
      } catch (e) {
        notify(errorMessage(e), 'error')
      } finally {
        setBusy(false)
      }
      return
    }
    try {
      const { data } = await api.get<MemberView>(`/api/case/registration/member/${encodeURIComponent(no)}`)
      clear()
      setF({ ...DEFAULTS, ...memberFieldsFrom(data) })
      setMember(data)
      setTab(1)
      say(data.alerts.map((a) => a.text))
    } catch (e) {
      notify(e instanceof AxiosError && e.response?.status === 404 ? 'No record found!' : errorMessage(e), 'error')
    } finally {
      setBusy(false)
    }
  }

  /** cmdRegister_Click / NewCaseAddmission. */
  async function register() {
    if (!member) return
    const doa = parseDmy(v('txtDateAdmitted')), dod = parseDmy(v('txtDateDischarge'))
    if (doa && dod && days(dod, doa) > 5 && !(await ask('Admission Period Is More Than 5 Days. Continue?'))) return
    if (pay === 'AX' && v('txtPolEffDate') !== v('txtMBMEffDate') && !(await ask('Have you checked Take Over clause?'))) return
    const bad = invalidDate()
    if (bad) return notify(bad, 'error')
    const body = baseRequest()
    setSaving(true)
    try {
      const { data: checks } = await api.post<{ recentlyActivated: boolean; sameDayAdmission: boolean }>('/api/case/registration/validate', body)
      if (checks.recentlyActivated && !(await ask('Policy has just been activated less than 30 days !\ndo you want to proceed?'))) return
      if (!(await ask(checks.sameDayAdmission ? 'Patient has not been discharged, do you want to continue' : 'Are you sure'))) return
      const { data } = await api.post<{ caseNumber: string }>('/api/case/registration', body)
      setCaseNo(data.caseNumber)
      set('cboStatus1')('O')
      notify(`Record Saved, Your Case No is : ${data.caseNumber}`, 'success')
      // NewCaseAddmission's post-save letters: P/E within the expiry window, then R for repudiated cases.
      const queue: string[] = []
      if (daysLeft != null && daysLeft <= 45) queue.push('auto')
      if (isRepudiated) queue.push('R')
      for (const letter of queue) await fetchLetter(letter, data.caseNumber)
    } catch (e) {
      notify(errorMessage(e), 'error')
    } finally {
      setSaving(false)
    }
  }

  /** Fetches a rendered letter and queues it for preview. */
  async function fetchLetter(letter: string, cas?: string) {
    const { data } = await api.post<LetterResult>('/api/case/registration/letter', {
      letter, caseNumber: cas ?? caseNo, lgNumber: '', form: baseRequest(),
    })
    ed.setLetters((q) => [...q, data])
  }

  /** cmdDocReqAdm_Click / cmdDocReqDis_Click / cmdTHDrugs_Click share this validation order. */
  function docReqReady(): boolean {
    if (!member || !ed.mbm) { notify('Please Enter Membership Information', 'error'); return false }
    if (!v('cboPatientList')) { setTab(1); notify('Please Enter Patient Information', 'error'); return false }
    if (!v('txtHOSCode').trim()) { notify('Please Enter Hospital Information', 'error'); return false }
    if (!v('txtDateAdmitted').trim()) { setTab(1); notify('Please Enter Admission Date', 'error'); return false }
    return true
  }

  /** A/D/T letters: validate, "Are you sure?", then preview/print. */
  async function docReq(letter: 'A' | 'D' | 'T') {
    if (docBusy || !docReqReady()) return
    if (!(await ask('Are you sure?'))) return
    setDocBusy(true)
    try {
      await fetchLetter(letter)
    } catch (e) {
      notify(errorMessage(e), 'error')
    } finally {
      setDocBusy(false)
    }
  }

  /** cmdPrior_Click: notification while the membership expiry is near / passed. */
  async function priorNotify() {
    if (docBusy || !member || !notificationEnabled) return
    setDocBusy(true)
    try {
      await fetchLetter('auto')
    } catch (e) {
      notify(errorMessage(e), 'error')
    } finally {
      setDocBusy(false)
    }
  }

  /** cmdLG_Click: validates, balance check on the server, then issues the LG + letter. */
  async function issueLg() {
    if (docBusy || lgDone || !docReqReady()) return
    if (!caseNo) { notify('Please Register the case before issuing an LG', 'error'); return }
    if (!v('txtCASLGAmt').trim()) { notify('Please Enter Reserve Amount', 'error'); return }
    if (!v('txtLGTime').trim()) { notify('Please Enter LG Time', 'error'); return }
    if (pay === 'AX' && v('txtPolEffDate') !== v('txtMBMEffDate') && !(await ask('Have you checked Take Over clause?'))) return
    if (!(await ask('Are you sure?'))) return
    setDocBusy(true)
    try {
      const { data } = await api.post<{ lgNumber: string; letter: LetterResult; balanceLimit: string }>('/api/case/registration/lg', {
        caseNumber: caseNo, form: baseRequest(),
      })
      ed.setLetters((q) => [...q, data.letter])
      setLgDone(true)
      notify(`LG ${data.lgNumber} issued (balance limit RM ${data.balanceLimit})`, 'success')
    } catch (e) {
      // The desktop disables the LG button when the balance limit is insufficient.
      if (errorMessage(e) === 'Please Check Balance Limit') setLgDone(true)
      notify(errorMessage(e), 'error')
    } finally {
      setDocBusy(false)
    }
  }

  return (
    <section className="registration case-reg" onKeyDown={enterToTab}>
      <fieldset>
        <legend>Case Registration</legend>
        {field(
          'Membership No',
          <div className="search-inline">
            <input value={v('txtMBMNumber')} maxLength={15} autoFocus onChange={(e) => set('txtMBMNumber')(e.target.value)} onKeyDown={enterRuns(() => show())} />
            <button type="button" onClick={() => show()} disabled={busy}>
              {busy ? 'Loading…' : 'Go'}
            </button>
            <button type="button" className="link" onClick={() => ed.setDialog({ kind: 'member' })}>
              Search
            </button>
          </div>,
        )}
        {field('Case Status', sel('cboStatus1', statuses, { disabled: true, blank: false }))}
        {field('Claimability', sel('cboClaimability', claimabilities, { onChange: claimabilityChange }))}
        {field('Pending', sel('cboPending', yesNo, { blank: false }))}
        {caseNo &&
          field(
            'Case No',
            <strong className="case-no">{caseNo}</strong>,
          )}
      </fieldset>

      <div className="actions cr-actions">
        <button type="button" className="ghost" onClick={issueLg} disabled={!caseNo || lgDone || docBusy || isRepudiated}
          title={isRepudiated ? 'Repudiated cases do not get a guarantee letter'
            : !caseNo ? 'Register the case first — the LG number is generated from the case no'
            : lgDone ? 'An LG has already been issued for this case' : undefined}>
          LG
        </button>
        <button type="button" className="ghost" onClick={priorNotify} disabled={!notificationEnabled || docBusy}
          title={!member ? 'Load a member first' : !notificationEnabled ? 'Available within 45 days of the membership expiry' : undefined}>
          Notification
        </button>
        <button type="button" className="ghost" onClick={() => docReq('T')} disabled={docBusy}>
          T.Home Drugs
        </button>
        <button type="button" className="ghost" onClick={() => docReq('A')} disabled={docBusy}>
          Doc Req Adm
        </button>
        <button type="button" className="ghost" onClick={() => docReq('D')} disabled={docBusy}>
          Doc Req Discharge
        </button>
        <span className="spacer" />
        {caseNo && <span className="case-no">Case No: {caseNo}</span>}
        <button type="button" className="primary" onClick={register} disabled={!registerEnabled}>
          {saving ? 'Saving…' : 'Register'}
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
          {tab === 2 && <CaseOthersSection ed={ed} />}
          {tab === 3 && <TakeOverSection ed={ed} />}
          {tab === 4 && <BenefitSection ed={ed} />}
          {tab === 5 && <HistorySection ed={ed} />}
          {tab === 6 && <WarrantySection ed={ed} />}
          {tab === 7 && <NonDisclosureSection ed={ed} />}
          {tab === 8 && <NotesSection ed={ed} />}
          {tab === 9 && <PolicyTermsSection ed={ed} />}
          {tab === 10 && <SurgicalSection ed={ed} />}
          {tab === 11 && (
            <p className="muted">
              {member?.policyWording
                ? `${member.policyWording} — policy wording documents are listed on the Case Adjustment screen.`
                : 'Load a member to see the policy wording reference.'}
            </p>
          )}
        </div>
        </div>

        {member && <MemberRail member={member} />}
      </div>

      {lookups.error && <p className="error">{errorMessage(lookups.error)}</p>}
      <CaseEditorDialogs ed={ed} onMemberPick={(no) => show(no)} />
    </section>
  )
}
