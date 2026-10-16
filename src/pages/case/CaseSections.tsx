// The tab bodies shared by Case > Registration and Case > Adjustment. Each component mounts
// only while its tab is active, so its queries fire lazily on open (SSTab1_Click).

import { useEffect } from 'react'
import type { ReactNode } from 'react'
import { useQuery } from '@tanstack/react-query'
import { api } from '../../api/client'
import { DataTable } from '../../components/DataTable'
import { FieldGrid } from '../../components/FieldGrid'
import { notify } from '../../lib/notifyStore'
import { formatValue } from '../../lib/format'
import type { Row } from '../../lib/format'
import { digitsOnly, maskTime } from '../../lib/masks'
import type { CaseEditor } from './useCaseEditor'
import { memberColumns, benefitColumns, historyColumns, illnessColumns, surgColumns, memberFields, termLabels, termKeys, useTabRows, yesNo, yesNoUpper, noYes, intExt, yearDay, maternity, S } from './caseShared'
import { CodeSearchDialog, MemberSearchDialog, ProcedureSearchDialog, RepudiationSelectionDialog } from './CaseRegistrationDialogs'
import { LetterModal } from './CaseLetters'

/** The right-hand patient context rail. */
export function MemberRail({ member }: { member: NonNullable<CaseEditor['member']> }) {
  const m = member.member
  return (
    <fieldset className="patient-banner">
      <legend>Member</legend>
      <div className="pb-head">
        <span className="pb-name">{S(m?.MBMName) || '—'}</span>
        <span className="pb-id">{S(m?.MBMNumber)}</span>
      </div>
      <div className="cr-badges">
        <span className={`badge ${member.polStatus === 'S' || member.polStatus === 'C' ? 'red' : 'green'}`}>
          {member.polStatus === 'S' ? 'Suspended' : member.polStatus === 'C' ? 'Cancelled' : 'Active'}
        </span>
        {member.waitingPeriod && <span className="badge amber">Waiting Period</span>}
        {member.expiryLabel && <span className="badge amber">{member.expiryLabel}</span>}
        {!member.lgAllowed && <span className="badge red">GL not allowed</span>}
        {member.agentLabel && <span className="badge blue">{member.agentLabel}</span>}
      </div>
      <FieldGrid fields={memberFields} row={m ?? {}} />
      {member.alerts.length > 0 && (
        <ul className="cr-alerts">
          {member.alerts.map((a, i) => (
            <li key={i} className={a.critical ? 'error' : 'warning'}>
              {a.text}
            </li>
          ))}
        </ul>
      )}
    </fieldset>
  )
}

/** Tab: General Info — member address, limits and covered persons. */
export function GeneralInfoSection({ ed }: { ed: CaseEditor }) {
  const { field, ro, member } = ed
  return (
    <>
      <fieldset>
        <legend>Member Address &amp; Limits</legend>
        {field('Address 1', ro('txtAdd1'))}
        {field('Address 2', ro('txtAdd2'))}
        {field('Address 3', ro('txtAdd3'))}
        {field('Postcode', ro('txtPostCode'))}
        {field('Town', ro('txtCity'))}
        {field('State', ro('txtState'))}
        {field('Annual Limit', ro('txtAnnualLimit'))}
        {field('Available Limit', ro('txtAvailableAnnualLimit'))}
      </fieldset>
      <h4>Covered Persons</h4>
      <DataTable columns={memberColumns} rows={(member?.members ?? []) as unknown as Row[]} empty="Load a member to see covered persons." />
    </>
  )
}

/** Tab: Case Details — patient, admission, classification, diagnoses and repudiation reasons.
 * `extra` renders adjustment-only fields (e.g. pending reason) inside the classification block. */
export function CaseDetailsSection({ ed, extra }: { ed: CaseEditor; extra?: ReactNode }) {
  const { field, txt, ro, dateBox, sel, memo, diagGroup, v, set, member, L, loaded, isRepudiated, setDialog,
    selectPatient, hospitalBlur, dateBlur, otherDateBlur, patientAgeBlur, chkDOA, setChkDOA, chkDOD, setChkDOD,
    hosNameEnabled } = ed
  return (
    <>
      <fieldset>
        <legend>Patient &amp; Admission</legend>
        {field(
          'Patient',
          loaded ? (
            <select value={v('cboPatientList')} onChange={(e) => selectPatient(e.target.value)}>
              <option value="" />
              {(member?.patients ?? []).map((p) => (
                <option key={p.coverId} value={p.coverId}>
                  {p.coverId} - {p.name}
                </option>
              ))}
            </select>
          ) : (
            <input disabled />
          ),
        )}
        {field('Patient IC', ro('txtPatientIC'))}
        {field(
          'Hospital',
          <>
            <input value={v('txtHOSCode')} list="case-hospitals" placeholder="Hospital" onChange={(e) => set('txtHOSCode')(e.target.value)} onBlur={hospitalBlur} />
            <datalist id="case-hospitals">
              {L?.hospitals.map((h) => (
                <option key={`${h.code}|${h.name}`} value={h.name} />
              ))}
            </datalist>
          </>,
        )}
        {field('Hospital Name', txt('txtHOSName', { max: 100, disabled: !hosNameEnabled }))}
        {field('1st Call', dateBox('txtFirstCall', otherDateBlur('txtFirstCall')))}
        {field('1st Treated', dateBox('txtFirstTreated', otherDateBlur('txtFirstTreated')))}
        {field(
          'D.O.A',
          <span className="field-pair">
            {dateBox('txtDateAdmitted', () => dateBlur('doa'))}
            <label className="check" title="Check admission date">
              <input type="checkbox" checked={chkDOA} onChange={(e) => setChkDOA(e.target.checked)} /> chk
            </label>
          </span>,
        )}
        {field(
          'D.O.D',
          <span className="field-pair">
            {dateBox('txtDateDischarge', () => dateBlur('dod'))}
            <label className="check" title="Check discharge date">
              <input type="checkbox" checked={chkDOD} onChange={(e) => setChkDOD(e.target.checked)} /> chk
            </label>
          </span>,
        )}
        {field('Reasons', memo('txtReason', { max: 500 }), true)}
      </fieldset>
      <fieldset>
        <legend>Amounts &amp; Follow-up</legend>
        {field('Reserve Amt', txt('txtCASReserveAmount', { numeric: true }))}
        {field('LG Amt', txt('txtCASLGAmt', { numeric: true }))}
        {field(
          'LG Time',
          <input
            value={v('txtLGTime')}
            placeholder="hh:mm"
            maxLength={5}
            onChange={(e) => set('txtLGTime')(maskTime(e.target.value))}
            onBlur={() => v('txtLGTime') && !/^([01]\d|2[0-3]):[0-5]\d$/.test(v('txtLGTime')) && notify('Invalid Time Format! ', 'error')}
          />,
        )}
        {field('Rcur', sel('cboCondwillOcc', yesNoUpper))}
        {field('Fol. Req', sel('cboFLWTreatment', yesNoUpper))}
        {field('Fol. Up', sel('cboFolUp', yesNo))}
        {field('Ref By', txt('txtREFBy', { max: 100 }))}
        {field('R&B Days', txt('txtRoomNBoardDays', { numeric: true, title: 'Not saved (same as the desktop)' }))}
      </fieldset>
      <fieldset>
        <legend>Classification</legend>
        {field('Nat of Clm', sel('cboNature', L?.claimNatures ?? []))}
        {field('Stay Type', sel('CboStayType', L?.stayTypes ?? []))}
        {field('Treat. Mode', sel('cboModality', L?.treatmentModes ?? []))}
        {field('Cash Type', sel('CboPayType', L?.payTypes ?? []))}
        {field('Policy Year', txt('txtMBMPolYr', { numeric: true, max: 4 }))}
        {field(
          'Patient Age',
          <span className="field-pair">
            <input value={v('txtPatientAge')} inputMode="numeric" maxLength={4} onChange={(e) => set('txtPatientAge')(digitsOnly(e.target.value))} onBlur={patientAgeBlur} />
            {sel('cboYearDay', yearDay)}
          </span>,
        )}
        {field('Maternity', sel('cboMaternityStatus', maternity, { title: 'Not saved (same as the desktop)' }))}
        {extra}
      </fieldset>
      <div className="diag-grid">
        {diagGroup('Preliminary Diagnosis', 'txtPrelimDiag', 'txtPDDOS', 'cboICDCode', 'prelim')}
        {diagGroup('Final Diagnosis', 'txtFinalDiag', 'txtFDDOS', 'cboFDICDCode', 'final')}
        {diagGroup('Underlying Disease', 'txtUD', 'txtUDDOS', 'cboUDICDCode', 'underlying')}
        <fieldset disabled={!isRepudiated}>
          <legend>
            Repudiation Reasons{' '}
            <button
              type="button"
              className="link"
              disabled={!isRepudiated}
              onClick={() => setDialog({ kind: 'rep' })}
              title="Search repudiation codes"
            >
              🔎 search
            </button>
          </legend>
          <div className="diag-rows">
            {[1, 2, 3].map((i) => (
              <input key={i} aria-label={`Repudiation reason ${i}`} value={v(`cboREPCode${i}`)} onChange={(e) => set(`cboREPCode${i}`)(e.target.value)} />
            ))}
          </div>
        </fieldset>
      </div>
    </>
  )
}

/** Tab: Case Others — procedures, investigations, medical management and doctors.
 * `actualFees` (adjustment) shows the saved actual-fee columns instead of the MMA-rate columns. */
export function CaseOthersSection({ ed, actualFees }: { ed: CaseEditor; actualFees?: boolean }) {
  const { procCol, v, set, setDialog, mma } = ed
  return (
    <>
      <fieldset>
        <legend>
          Surgical Procedures{' '}
          <button type="button" className="link" onClick={() => setDialog({ kind: 'opcs' })} title="Search OPCS codes">
            🔎 search OPCS
          </button>
        </legend>
        <div className={`proc-grid ${actualFees ? 'four' : 'four'}`}>
          {procCol('Procedure', 'txtProcedure', 6, { max: 200 })}
          {procCol('OPCS', 'txtProcCode', 6, { max: 6, blur: (i) => mma('S', i) })}
          {actualFees ? procCol('Surg Act Fee', 'txtSActFee', 6, { ro: true }) : procCol('Surg MMA', 'txtSMMARate', 6, { ro: true })}
          {actualFees ? procCol('Anaes Act Fee', 'txtAnaesActFees', 6, { ro: true }) : procCol('Anaes MMA', 'txtAnaesMMARate', 6, { ro: true })}
        </div>
      </fieldset>
      <fieldset>
        <legend>
          Non-Surgical Charges{' '}
          <button type="button" className="link" onClick={() => setDialog({ kind: 'opcs-ns' })} title="Search OPCS codes">
            🔎 search OPCS
          </button>
        </legend>
        <div className="proc-grid three">
          {procCol('Procedure', 'txtNSProcedure', 6, { max: 200 })}
          {procCol('OPCS', 'txtNSProcCode', 6, { max: 6, blur: (i) => mma('NS', i) })}
          {actualFees ? procCol('N-Surg Act Fee', 'txtNSActFee', 6, { ro: true }) : procCol('N-Surg MMA', 'txtNSMMARate', 6, { ro: true })}
        </div>
      </fieldset>
      <fieldset>
        <legend>
          Investigation{' '}
          <button type="button" className="link" onClick={() => setDialog({ kind: 'inv' })} title="Search investigation codes">
            🔎 search
          </button>
        </legend>
        <div className="diag-rows">
          {[1, 2, 3].map((i) => (
            <div key={i} className="inv-row">
              <input aria-label={`Investigation ${i}`} maxLength={150} value={v(`txtPROCINVDone${i}`)} onChange={(e) => set(`txtPROCINVDone${i}`)(e.target.value)} />
              <input aria-label={`Investigation code ${i}`} maxLength={20} value={v(`txtINVCode${i}`)} onChange={(e) => set(`txtINVCode${i}`)(e.target.value)} />
            </div>
          ))}
        </div>
      </fieldset>
      <div className="diag-grid">
        <fieldset>
          <legend>Medical Management</legend>
          <div className="diag-rows">
            {[1, 2, 3].map((i) => (
              <input key={i} aria-label={`Medical management ${i}`} maxLength={150} value={v(`txtMEDSURDone${i}`)} onChange={(e) => set(`txtMEDSURDone${i}`)(e.target.value)} />
            ))}
          </div>
        </fieldset>
        <fieldset>
          <legend>Anaesthetists</legend>
          <div className="diag-rows">
            {[0, 1, 2].map((i) => (
              <input key={i} aria-label={`Anaesthetist ${i + 1}`} maxLength={30} value={v(`txtAnaesDoc${i}`)} onChange={(e) => set(`txtAnaesDoc${i}`)(e.target.value)} />
            ))}
          </div>
        </fieldset>
      </div>
      <fieldset>
        <legend>Attending Doctors</legend>
        <div className="proc-grid two">
          {procCol('Doctor', 'txtATTDoc', 5, { max: 100 })}
        </div>
      </fieldset>
    </>
  )
}

/** Tab: Take Over/Others. `extras` renders the adjustment-only fields (link case, doc received). */
export function TakeOverSection({ ed, extras }: { ed: CaseEditor; extras?: ReactNode }) {
  const { field, txt, sel, memo, dateBox, otherDateBlur, v, setF, L } = ed
  return (
    <>
      <fieldset>
        <legend>Take Over Details</legend>
        {field('T/O Ind', sel('cboCASTakeOveInd', yesNo, { onChange: (x) => setF((s) => ({ ...s, cboCASTakeOveInd: x, ...(x === 'Y' ? {} : { txtCASTakeOverAmt: '' }) })) }))}
        {field('T/O Amt', txt('txtCASTakeOverAmt', { numeric: true, disabled: v('cboCASTakeOveInd') !== 'Y' }))}
        {field('Int/Ext TakeOver', sel('cboIntExtTO', intExt))}
        {field('T/O PLN', txt('txtCASTOPlan', { max: 4 }))}
      </fieldset>
      <fieldset>
        <legend>Other Details</legend>
        {field('Red Amt', txt('txtREDAmt', { numeric: true, max: 10 }))}
        {field('Topup Lmt', sel('cboTopUpLmt', noYes))}
        {field('Special App', sel('cboCASInd', L?.specialApprovals ?? []))}
        {field('Query Status', sel('cboQuery', noYes))}
        {field("Pymt P'ding App", sel('cboPayPending', yesNo, { blank: false }))}
        {field('First Doc Date', dateBox('txtFirstDocDate', otherDateBlur('txtFirstDocDate')))}
        {field('Subseq. Doc Date', dateBox('txtSubDocDate', otherDateBlur('txtSubDocDate')))}
        {extras}
        {field('LG Remark', memo('TxtLGRemark', { max: 100, rows: 4, title: 'Not saved (same as the desktop)' }), true)}
      </fieldset>
    </>
  )
}

/** Tab: Benefit — current (and upgraded) plan benefits. */
export function BenefitSection({ ed }: { ed: CaseEditor }) {
  const { field, ro, v, m, patient, plan, hlt, ins } = ed
  const benefitPlan = patient && v('cboPatientList') !== '00' && S(patient.PlanCode) ? S(patient.PlanCode) : plan
  const upgradePlan = S(m?.MBMNewPlanCode)
  const benefits = useTabRows(['bnf', benefitPlan, hlt, ins], '/api/case/registration/benefits', { plan: benefitPlan, hlt, ins }, !!benefitPlan)
  const newBenefits = useTabRows(['bnf', upgradePlan, hlt, ins], '/api/case/registration/benefits', { plan: upgradePlan, hlt, ins }, !!upgradePlan)
  return (
    <>
      <fieldset>
        <legend>Plan Upgrade</legend>
        {field('New Benefit Plan', ro('txtUpgPLNCode'))}
        {field('D.O.C', ro('txtDOC'))}
      </fieldset>
      <h4>Current Plan Benefits</h4>
      {benefits.isFetching ? <p className="muted">Loading…</p> : <DataTable columns={benefitColumns} rows={benefits.data ?? []} />}
      {upgradePlan && (
        <>
          <h4>New Plan Benefits ({upgradePlan})</h4>
          {newBenefits.isFetching ? <p className="muted">Loading…</p> : <DataTable columns={benefitColumns} rows={newBenefits.data ?? []} />}
        </>
      )}
    </>
  )
}

/** Tab: MBM'Ship History (registration). */
export function HistorySection({ ed }: { ed: CaseEditor }) {
  const { ic } = ed
  const history = useTabRows(['his', ic], '/api/case/registration/member-history', { ic }, !!ic)
  return history.isFetching ? <p className="muted">Loading…</p> : <DataTable columns={historyColumns} rows={history.data ?? []} empty="Load a member to see membership history." />
}

/** Tab: Warranty Exclusion — the principal's and one supplementary member's exclusions. */
export function WarrantySection({ ed }: { ed: CaseEditor }) {
  const { field, sel, memo, member, setF } = ed
  return (
    <>
      <h4>Principal</h4>
      {memo('txtPrincipalExc', { rows: 6, disabled: true })}
      <h4>Supplementary</h4>
      {field(
        'Member',
        sel('cboSuppExc', (member?.members ?? []).filter((p) => p.coverId !== '00').map((p) => ({ code: p.coverId, name: p.name ?? '' })), {
          onChange: (x) => setF((s) => ({ ...s, cboSuppExc: x, txtSuppExc: S(member?.members.find((p) => p.coverId === x)?.exclusion) })),
        }),
      )}
      {memo('txtSuppExc', { rows: 6, disabled: true })}
    </>
  )
}

/** Tab: Non-Disclosure (registration). */
export function NonDisclosureSection({ ed }: { ed: CaseEditor }) {
  const { ic } = ed
  const illness = useTabRows(['ill', ic], '/api/case/registration/non-disclosure', { ic }, !!ic)
  return illness.isFetching ? <p className="muted">Loading…</p> : <DataTable columns={illnessColumns} rows={illness.data ?? []} empty="No non-disclosure records." />
}

/** Tab: Case Mgmt Notes — five pages of remarks. `template` (adjustment) loads the generated
 * note the first time the tab is opened while page 1 is still empty. */
export function NotesSection({ ed, template }: { ed: CaseEditor; template?: () => Promise<{ page1: string; page2: string }> }) {
  const { v, set, page, setPage } = ed
  useEffect(() => {
    if (!template || v('txtCASRemark1')) return
    template()
      .then((t) => {
        set('txtCASRemark1')(v('txtCASRemark1') || t.page1)
        set('txtCASRemark2')(v('txtCASRemark2') || t.page2)
      })
      .catch(() => {})
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  return (
    <>
      <div className="cr-notes-head">
        <span className="muted">
          Page {page} of 5 — recorded with date and person-in-charge columns on the desktop; enter notes below.
        </span>
        <span className="pager" role="navigation" aria-label="Notes pages">
          {[1, 2, 3, 4, 5].map((p) => (
            <button key={p} type="button" className={p === page ? 'link current' : 'link'} aria-current={p === page} onClick={() => setPage(p)}>
              {p}
            </button>
          ))}
        </span>
      </div>
      <textarea
        className="notes"
        maxLength={3800}
        rows={14}
        aria-label={`Case management notes page ${page}`}
        value={v(`txtCASRemark${page}`)}
        onChange={(e) => (e.target.value.includes('~') ? notify('You are not allowed to use this symbol as a Keyword') : set(`txtCASRemark${page}`)(e.target.value))}
      />
    </>
  )
}

/** Tab: Policy Terms. `actions` renders tab-level buttons (the desktop's Clear Doc Record). */
export function PolicyTermsSection({ ed, actions }: { ed: CaseEditor; actions?: ReactNode }) {
  const { plan, pay, hlt } = ed
  const terms = useQuery({
    queryKey: ['case-reg', 'terms', plan, pay, hlt],
    queryFn: async () => (await api.get<Row | null>('/api/case/registration/policy-terms', { params: { plan, pay, hlt } })).data,
    enabled: !!plan,
  })
  return (
    <>
      {actions && <div className="actions tab-actions">{actions}</div>}
      {terms.isFetching ? (
        <p className="muted">Loading…</p>
      ) : (
        <dl className="fields">
          {termLabels.map((label, i) => (
            <div key={label} className="field">
              <dt>{label}</dt>
              <dd>{formatValue(terms.data?.[termKeys[i]]) || ' '}</dd>
            </div>
          ))}
        </dl>
      )}
    </>
  )
}

/** Tab: Surgical Schedule. */
export function SurgicalSection({ ed }: { ed: CaseEditor }) {
  const { pay, plan } = ed
  const surgical = useTabRows(['surg', pay, plan], '/api/case/registration/surgical-schedule', { pay, plan }, !!plan)
  return surgical.isFetching ? <p className="muted">Loading…</p> : <DataTable columns={surgColumns} rows={surgical.data ?? []} empty="Load a member to see the surgical schedule." />
}

/** The shared search/selection dialogs + the letter preview queue. `onMemberPick` is only used
 * by registration (the member search feeds its Go). */
export function CaseEditorDialogs({ ed, onMemberPick }: { ed: CaseEditor; onMemberPick?: (no: string) => void }) {
  const { dialog, setDialog, pickCode, showRepSel, setShowRepSel, repSel, setRepSel, L, letters, setLetters } = ed
  return (
    <>
      {dialog?.kind === 'member' && onMemberPick && (
        <MemberSearchDialog initial={dialog.initial} onClose={() => setDialog(null)} onPick={(no) => (setDialog(null), onMemberPick(no))} />
      )}
      {(dialog?.kind === 'icd' || dialog?.kind === 'rep') && (
        <CodeSearchDialog kind={dialog.kind} group={dialog.kind === 'icd' ? dialog.group : undefined} onPick={pickCode} onClose={() => setDialog(null)} />
      )}
      {(dialog?.kind === 'opcs' || dialog?.kind === 'opcs-ns' || dialog?.kind === 'inv') && (
        <ProcedureSearchDialog inv={dialog.kind === 'inv'} onPick={(code) => pickCode(code, '')} onClose={() => setDialog(null)} />
      )}
      {showRepSel && L && (
        <RepudiationSelectionDialog
          value={repSel}
          documents={L.documents}
          personnel={L.personnel}
          onSave={(sel) => (setRepSel(sel), setShowRepSel(false))}
          onClose={() => setShowRepSel(false)}
        />
      )}
      {letters.length > 0 && <LetterModal letter={letters[0]} onClose={() => setLetters((q) => q.slice(1))} />}
    </>
  )
}
