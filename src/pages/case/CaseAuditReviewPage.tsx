// Case > Case Audit Review (legacy frmCaseAuditReview, "Audit Review"): load a case, review its member/case
// details (read-only) and record the audit-review query, answer, invoice and hospital-visit details.

import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { yupResolver } from '@hookform/resolvers/yup'
import * as yup from 'yup'
import { DateField, Field, NumberField, ReadField, SelectField, TextAreaField, TextField, TimeField } from '../../components/Field'
import type { Option } from '../../components/Field'
import { DataGrid } from '../../components/DataGrid'
import type { GridColumn } from '../../components/DataGrid'
import { ActionBar, PageShell } from '../../components/Screen'
import { Tabs } from '../../components/Tabs'
import { Button } from '../../components/Button'
import { api, errorMessage } from '../../api/client'
import { ask, notify } from '../../lib/notifyStore'
import { formatMoney } from '../../lib/format'
import type { Row } from '../../lib/format'
import { amount, dmyDate, hhmmTime, optionalText, requiredText } from '../../lib/validation'
import { dispDate, enterRuns, isoDmy, isoToDmy, num, S } from './caseShared'
import type { MemberView } from './caseShared'

interface AuditDto {
  invoiceNo: string | null
  invoiceDate: string | null
  invoiceAmount: number | null
  discountReceived: number | null
  discountType: string | null
  letterSent: string | null
  letterReply: string | null
  status: string | null
  dateOpen: string | null
  dateToClaims: string | null
  query: string | null
  answer: string | null
  remarks: string | null
  visitDate: string | null
  visitTime: string | null
  visitAction: string | null
  officer: string | null
}

interface PaymentDto {
  pvNo: string | null
  pvDate: string | null
  amountPaid: number | null
}

interface AuditMemberDto {
  memberNo: string
  name: string | null
  ic: string | null
  payor: string | null
  policyNo: string | null
  renewal: string | null
  takeOver: string | null
  effectiveDate: string | null
  expiryDate: string | null
  address1: string | null
  address2: string | null
  address3: string | null
  postCode: string | null
  town: string | null
  state: string | null
  dob: string | null
  availableLimit: number | null
  status: string | null
  installment: string | null
}

/** The case as Case Adjustment loads it, plus the audit review record, the hospital payments and the member read from MBM. */
interface AuditView {
  case: {
    case: Row
    member: MemberView | null
    firstDiagnosis?: Row
    finalDiagnosis?: Row
    repudiation?: Row
  }
  audit: AuditDto | null
  payments: PaymentDto[]
  member: AuditMemberDto | null
}

type Info = Record<string, string>
interface DiagRow {
  diagnosis: string
  dateOnset: string
  icd: string
}
interface ReviewInfo {
  header: Info
  member: Info
  general: Info
  caseInfo: Info
  diagnoses: Record<string, DiagRow[]>
  repudiation: string[]
  covered: CoveredMember[]
  payment: Info
}

interface Values {
  caseNo: string
  invoiceNo: string
  invoiceDate: string
  invoiceAmount: string
  discountReceived: string
  discountType: string
  dateLetterSent: string
  dateLetterReply: string
  auditStatus: string
  dateOpen: string
  dateToClaims: string
  query: string
  answer: string
  remarks: string
  visitDate: string
  visitTime: string
  visitAction: string
  visitOfficer: string
}

interface CoveredMember {
  coverId: string
  name: string
  icNo: string
  relation: string
  dob: string
  suppAnnualLimit: string
  warrantyExclusion: string
}

const defaults: Values = {
  caseNo: '',
  invoiceNo: '',
  invoiceDate: '',
  invoiceAmount: '',
  discountReceived: '',
  discountType: '',
  dateLetterSent: '',
  dateLetterReply: '',
  auditStatus: '',
  dateOpen: '',
  dateToClaims: '',
  query: '',
  answer: '',
  remarks: '',
  visitDate: '',
  visitTime: '',
  visitAction: '',
  visitOfficer: '',
}

const auditStatuses: Option[] = [
  { value: 'C', label: 'C - Close' },
  { value: 'O', label: 'O - Open' },
]
const discountTypes: Option[] = [
  { value: 'A', label: 'A - Discount in main bordx' },
  { value: 'B', label: 'B - Discount in reverse bordx' },
]

const schema: yup.ObjectSchema<Values> = yup.object({
  caseNo: requiredText('Please Enter Case No!'),
  invoiceNo: optionalText(),
  invoiceDate: dmyDate(),
  invoiceAmount: amount(),
  discountReceived: amount(),
  discountType: requiredText('Please Enter Discount Type!'),
  dateLetterSent: dmyDate(),
  dateLetterReply: dmyDate(),
  auditStatus: optionalText(),
  dateOpen: dmyDate(),
  dateToClaims: dmyDate(),
  query: optionalText(),
  answer: optionalText(),
  remarks: optionalText(),
  visitDate: dmyDate(),
  visitTime: hhmmTime(),
  visitAction: optionalText(),
  visitOfficer: optionalText(),
})

const memberLabels = ['Member No', 'Member Name', 'IC No', 'Payor', 'Policy No', 'Renewal', 'Take Over', 'Effective Date', 'Expiry Date']
const generalLabels = [
  'Address 1',
  'Address 2',
  'Address 3',
  'Postcode',
  'Town',
  'State',
  'Date of Birth',
  'Age',
  'Annual Limit',
  'Available Limit',
  'Amount O/S',
  'Installment',
]
const caseLabels = [
  'Patient',
  'IC No',
  'Hospital',
  'Reason',
  'Attending Doctor',
  'Referred by',
  'Nature of Claim',
  'Treatment Mode',
  'Stay Type',
  'Cash Type',
  'Recurrence',
  'Follow-up required',
  'First Call',
  'First Call Time',
  'First Treated',
  'First Treated Time',
  'Date of Admission',
  'Admission Time',
  'Date of Discharge',
  'Discharge Time',
  'Reserve Amount',
  'LG Amount',
]
const wideLabels = ['Hospital', 'Reason']
const diagnosisGroups = ['Preliminary Diagnosis', 'Underlying Disease', 'Final Diagnosis']

const memberColumns: GridColumn<CoveredMember>[] = [
  { key: 'coverId', label: 'Cover ID' },
  { key: 'name', label: 'Name' },
  { key: 'icNo', label: 'I/C No' },
  { key: 'relation', label: 'Relation' },
  { key: 'dob', label: 'DOB' },
  { key: 'suppAnnualLimit', label: 'Supp Annual Limit', align: 'right' },
  { key: 'warrantyExclusion', label: 'Warranty Exc' },
]

function ReadFields({ labels, values, wide = [] }: { labels: readonly string[]; values: Info; wide?: readonly string[] }) {
  return (
    <>
      {labels.map((l) => (
        <ReadField key={l} label={l} value={values[l] ?? ''} wide={wide.includes(l)} />
      ))}
    </>
  )
}

function DiagnosisRows({ title, rows }: { title: string; rows: DiagRow[] }) {
  return (
    <fieldset>
      <legend>{title}</legend>
      <div className="diag-rows">
        <div className="diag-head">
          <span>Diagnosis</span>
          <span>Date Onset</span>
          <span>ICD</span>
        </div>
        {[1, 2, 3].map((i) => (
          <div key={i} className="diag-row">
            <input className="ro" readOnly aria-label={`${title} ${i}`} value={rows[i - 1]?.diagnosis ?? ''} />
            <input className="ro" readOnly aria-label={`${title} ${i} date onset`} value={rows[i - 1]?.dateOnset ?? ''} />
            <input className="ro" readOnly aria-label={`${title} ${i} ICD`} value={rows[i - 1]?.icd ?? ''} />
          </div>
        ))}
      </div>
    </fieldset>
  )
}

const timeText = (v: unknown) => /T(\d{2}:\d{2})/.exec(S(v))?.[1] ?? S(v)
const dmy = (d: Date) => `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`
const money = (v: unknown) => (v == null || v === '' ? '' : formatMoney(v))
const unique = (values: (string | null)[]) => [...new Set(values.map(S).filter(Boolean))]

function ageText(dob: unknown) {
  const s = S(dob)
  if (!s) return ''
  const born = new Date(s)
  if (Number.isNaN(born.getTime())) return ''
  const now = new Date()
  const days = Math.floor((now.getTime() - born.getTime()) / 86400000)
  return days <= 364 ? `${Math.max(days, 0)} Day(s)` : `${now.getFullYear() - born.getFullYear()} Year(s)`
}

/** showCAS / showMBMDetails / showOther: the read-only parts of the three tabs, from the loaded case. */
function buildInfo(data: AuditView): ReviewInfo {
  const c = data.case.case
  const mv = data.case.member
  const am = data.member
  const cover = S(c.MBMPatientCovID)
  const principal = cover === '00'
  const pm = mv?.members.find((x) => x.coverId === cover)
  const diag = (rows: Row | undefined, text: string, dos: string, icd: string): DiagRow[] =>
    [1, 2, 3].map((i) => ({ diagnosis: S(rows?.[`${text}${i}`]), dateOnset: isoToDmy(rows?.[`${dos}${i}`]), icd: S(rows?.[`${icd}${i}`]) }))
  return {
    header: { 'Case Status': S(c.CASStatus), Claimability: S(c.CASClaimability), 'Policy Status': S(mv?.polStatus) || S(am?.status) },
    member: {
      'Member No': S(am?.memberNo ?? c.MBMNumber),
      'Member Name': S(am?.name ?? c.MBMName),
      'IC No': S(am?.ic ?? c.MBMIcBcPp),
      Payor: S(am?.payor ?? c.PAYCode),
      'Policy No': S(am?.policyNo ?? c.MBMPolicyNo),
      Renewal: S(am?.renewal),
      'Take Over': S(am?.takeOver),
      'Effective Date': isoToDmy(am?.effectiveDate ?? c.MBMPayorEffDate),
      'Expiry Date': isoToDmy(am?.expiryDate ?? c.MBMPayorExpDate),
    },
    general: {
      'Address 1': S(am?.address1),
      'Address 2': S(am?.address2),
      'Address 3': S(am?.address3),
      Postcode: S(am?.postCode),
      Town: S(am?.town),
      State: S(am?.state),
      'Date of Birth': isoToDmy(am?.dob ?? c.MBMDOB),
      Age: ageText(am?.dob ?? c.MBMDOB),
      'Annual Limit': S(mv?.annualLimit),
      'Available Limit': money(am?.availableLimit),
      'Amount O/S': '',
      Installment: S(am?.installment),
    },
    caseInfo: {
      Patient: principal ? S(am?.name ?? c.MBMName) : S(pm?.name ?? c.MBMCName),
      'IC No': principal ? S(am?.ic ?? c.MBMIcBcPp) : S(pm?.ic),
      Hospital: S(c.HOSName) + (S(c.CASHOSName) ? ` (${S(c.CASHOSName)})` : ''),
      Reason: S(c.CASAdmissionReason),
      'Attending Doctor': S(c.CASAttendDoctor1),
      'Referred by': S(c.ReferedBy),
      'Nature of Claim': S(c.ClaimNatureCode),
      'Treatment Mode': S(c.ModalityCode),
      'Stay Type': S(c.CASStayType),
      'Cash Type': S(c.CASPAYType),
      Recurrence: S(c.CASOCondWillRecur),
      'Follow-up required': S(c.CASOFollowUpRequired),
      'First Call': dispDate(c.CASFirstCall),
      'First Call Time': timeText(c.CASFCallTime),
      'First Treated': dispDate(c.CASFirstTreated),
      'First Treated Time': timeText(c.CASFTreatedTime),
      'Date of Admission': isoToDmy(c.CASDateAdmitted),
      'Admission Time': timeText(c.CASDOATime),
      'Date of Discharge': isoToDmy(c.CASDischargeDate),
      'Discharge Time': timeText(c.CASDODTime),
      'Reserve Amount': money(c.CASReserveAmount),
      'LG Amount': money(c.CASLGAmt),
    },
    diagnoses: {
      'Preliminary Diagnosis': diag(data.case.firstDiagnosis, 'DIAPrelimDiag', 'DIADOS', 'ICDCode'),
      'Underlying Disease': diag(c, 'CASUDReasons', 'CASUDDOS', 'CASUDCode'),
      'Final Diagnosis': diag(data.case.finalDiagnosis, 'DIAFinalDiag', 'DIADOS', 'ICDCode'),
    },
    repudiation: [1, 2, 3].map((i) => S(data.case.repudiation?.[`Rep${i}`])),
    covered: (mv?.members ?? []).map((x) => ({
      coverId: x.coverId,
      name: S(x.name),
      icNo: S(x.ic),
      relation: S(x.relation),
      dob: isoToDmy(x.dob),
      suppAnnualLimit: money(x.annualLimit),
      warrantyExclusion: S(x.exclusion),
    })),
    payment: {
      'PV Number': unique(data.payments.map((p) => p.pvNo)).join(', '),
      'PV Date': unique(data.payments.map((p) => (p.pvDate ? dmy(new Date(p.pvDate)) : null))).join(', '),
      'Amount Paid': data.payments.length ? formatMoney(data.payments.reduce((sum, p) => sum + (p.amountPaid ?? 0), 0)) : '',
    },
  }
}

const noInfo: ReviewInfo = { header: {}, member: {}, general: {}, caseInfo: {}, diagnoses: {}, repudiation: [], covered: [], payment: {} }
const amountText = (v: number | null) => (v == null ? '' : v.toFixed(2))

/** The audit record as the form shows it (a case with no audit record yet starts empty). */
const auditValues = (caseNo: string, a: AuditDto | null): Values => ({
  caseNo,
  invoiceNo: S(a?.invoiceNo),
  invoiceDate: isoToDmy(a?.invoiceDate),
  invoiceAmount: amountText(a?.invoiceAmount ?? null),
  discountReceived: amountText(a?.discountReceived ?? null),
  discountType: S(a?.discountType),
  dateLetterSent: isoToDmy(a?.letterSent),
  dateLetterReply: isoToDmy(a?.letterReply),
  auditStatus: S(a?.status),
  dateOpen: isoToDmy(a?.dateOpen),
  dateToClaims: isoToDmy(a?.dateToClaims),
  query: S(a?.query),
  answer: S(a?.answer),
  remarks: S(a?.remarks),
  visitDate: isoToDmy(a?.visitDate),
  visitTime: S(a?.visitTime),
  visitAction: S(a?.visitAction),
  visitOfficer: S(a?.officer),
})

export function CaseAuditReviewPage() {
  const navigate = useNavigate()
  const [loaded, setLoaded] = useState(false)
  const [busy, setBusy] = useState(false)
  const [tab, setTab] = useState(0)
  const [info, setInfo] = useState<ReviewInfo>(noInfo)
  const {
    register,
    handleSubmit,
    trigger,
    reset,
    getValues,
    control,
    formState: { errors },
  } = useForm<Values>({
    resolver: yupResolver(schema),
    defaultValues: defaults,
    mode: 'onTouched',
  })

  /** cmdShow_Click. */
  async function load(caseNo = getValues('caseNo')) {
    if (!(await trigger('caseNo'))) return
    setBusy(true)
    try {
      const { data } = await api.get<AuditView>(`/api/case/audit-review/${encodeURIComponent(caseNo.trim())}`)
      setInfo(buildInfo(data))
      reset(auditValues(S(data.case.case.CASNumber), data.audit))
      setLoaded(true)
    } catch (e) {
      setLoaded(false)
      setInfo(noInfo)
      notify(errorMessage(e), 'error')
    } finally {
      setBusy(false)
    }
  }

  function clear() {
    reset(defaults)
    setInfo(noInfo)
    setLoaded(false)
    setTab(0)
  }

  /** cmdUpdate1_Click. */
  const update = handleSubmit(
    async (v) => {
      if (!(await ask('Are you sure?'))) return
      setBusy(true)
      try {
        const { data } = await api.put<{ message: string }>(`/api/case/audit-review/${encodeURIComponent(v.caseNo.trim())}`, {
          invoiceNo: v.invoiceNo,
          invoiceDate: isoDmy(v.invoiceDate),
          invoiceAmount: num(v.invoiceAmount),
          discountReceived: num(v.discountReceived),
          discountType: v.discountType,
          letterSent: isoDmy(v.dateLetterSent),
          letterReply: isoDmy(v.dateLetterReply),
          status: v.auditStatus,
          dateOpen: isoDmy(v.dateOpen),
          dateToClaims: isoDmy(v.dateToClaims),
          query: v.query,
          answer: v.answer,
          remarks: v.remarks,
          visitDate: isoDmy(v.visitDate),
          visitTime: v.visitTime,
          visitAction: v.visitAction,
          officer: v.visitOfficer,
        })
        notify(data.message, 'success')
        setBusy(false)
        await load(v.caseNo)
      } catch (e) {
        notify(errorMessage(e), 'error')
      } finally {
        setBusy(false)
      }
    },
    () => setTab(0),
  )

  const auditPanel = (
    <div className="screen-form">
      <fieldset disabled={!loaded}>
        <legend>Invoice</legend>
        <TextField label="Invoice Number" maxLength={50} {...register('invoiceNo')} />
        <DateField control={control} name="invoiceDate" label="Invoice Date" />
        <NumberField label="Invoice Amount" maxLength={15} error={errors.invoiceAmount} {...register('invoiceAmount')} />
        <NumberField label="Discount Received" maxLength={15} error={errors.discountReceived} {...register('discountReceived')} />
        <SelectField label="Discount Type" required options={discountTypes} error={errors.discountType} {...register('discountType')} />
      </fieldset>

      <fieldset disabled={!loaded}>
        <legend>Letters &amp; Status</legend>
        <DateField control={control} name="dateLetterSent" label="Date Letter Sent" />
        <DateField control={control} name="dateLetterReply" label="Date Letter Reply" />
        <SelectField label="Audit Review Status" options={auditStatuses} {...register('auditStatus')} />
        <DateField control={control} name="dateOpen" label="Date Open" />
        <DateField control={control} name="dateToClaims" label="Date to Claims" />
      </fieldset>

      <fieldset disabled={!loaded}>
        <legend>Audit Review</legend>
        <TextAreaField label="Query" wide maxLength={500} {...register('query')} />
        <TextAreaField label="Answer" wide maxLength={500} {...register('answer')} />
        <TextField label="Remarks" wide maxLength={200} {...register('remarks')} />
      </fieldset>

      <fieldset>
        <legend>Payment Record</legend>
        <ReadField label="PV Number" value={info.payment['PV Number']} />
        <ReadField label="PV Date" value={info.payment['PV Date']} />
        <ReadField label="Amount Paid" value={info.payment['Amount Paid']} />
      </fieldset>

      <fieldset disabled={!loaded}>
        <legend>Hospital Visit</legend>
        <DateField control={control} name="visitDate" label="Date of Visit" />
        <TimeField label="Time" error={errors.visitTime} {...register('visitTime')} />
        <TextField label="Action" wide maxLength={200} {...register('visitAction')} />
        <TextField label="Officer-in-Charge" maxLength={50} {...register('visitOfficer')} />
      </fieldset>
    </div>
  )

  const generalPanel = (
    <div className="screen-form">
      <fieldset>
        <legend>Member Information</legend>
        <ReadFields labels={generalLabels} values={info.general} />
      </fieldset>
      <fieldset>
        <legend>Covered Members</legend>
        <DataGrid
          caption="Covered members"
          columns={memberColumns}
          rows={info.covered}
          rowKey={(r) => r.coverId}
          empty="Load a case to list its covered members."
        />
      </fieldset>
    </div>
  )

  const detailsPanel = (
    <div className="screen-form">
      <fieldset>
        <legend>Case</legend>
        <ReadFields labels={caseLabels} values={info.caseInfo} wide={wideLabels} />
      </fieldset>
      <div className="diag-grid">
        {diagnosisGroups.map((g) => (
          <DiagnosisRows key={g} title={g} rows={info.diagnoses[g] ?? []} />
        ))}
        <fieldset>
          <legend>Repudiation Reasons</legend>
          <div className="diag-rows">
            {[1, 2, 3].map((i) => (
              <input key={i} className="ro" readOnly aria-label={`Repudiation reason ${i}`} value={info.repudiation[i - 1] ?? ''} />
            ))}
          </div>
        </fieldset>
      </div>
    </div>
  )

  return (
    <PageShell title="Case Audit Review" subtitle="Record the audit review of a case.">
      <form onSubmit={update} noValidate className="screen-form">
        <fieldset>
          <legend>Case</legend>
          <Field label="Case No" required error={errors.caseNo}>
            <div className="search-inline">
              <input
                maxLength={15}
                autoFocus
                aria-invalid={errors.caseNo ? true : undefined}
                {...register('caseNo', { onChange: () => setLoaded(false) })}
                onKeyDown={enterRuns(load)}
              />
              <Button onClick={() => load()} busy={busy} busyLabel="Loading…">
                Load
              </Button>
            </div>
          </Field>
          <ReadField label="Case Status" value={info.header['Case Status']} />
          <ReadField label="Claimability" value={info.header.Claimability} />
          <ReadField label="Policy Status" value={info.header['Policy Status']} />
        </fieldset>

        <fieldset>
          <legend>Member</legend>
          <ReadFields labels={memberLabels} values={info.member} />
        </fieldset>

        <ActionBar label="Audit review actions">
          <Button variant="primary" type="submit" disabled={!loaded || busy}>
            Update
          </Button>
          <Button variant="link" onClick={clear}>
            Clear
          </Button>
          <span className="spacer" />
          <Button variant="link" onClick={() => navigate('/')}>
            Close
          </Button>
        </ActionBar>

        <Tabs
          label="Audit review sections"
          tabs={['Audit Review', 'General Info', 'Case Details']}
          panels={[auditPanel, generalPanel, detailsPanel]}
          active={tab}
          onChange={setTab}
        />
      </form>
    </PageShell>
  )
}
