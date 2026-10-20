// Case > Pay & Claim (legacy frmCASPayClaim): load a case, pick the covered member, then add/edit the
// "Pay & Claim" reasons that go on the payor letter.

import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useForm, useWatch } from 'react-hook-form'
import { yupResolver } from '@hookform/resolvers/yup'
import * as yup from 'yup'
import { CheckField, DateField, Field, ReadField, TextField } from '../../components/Field'
import { DataGrid } from '../../components/DataGrid'
import type { GridColumn } from '../../components/DataGrid'
import { ActionBar, PageShell } from '../../components/Screen'
import { Tabs } from '../../components/Tabs'
import { Button } from '../../components/Button'
import { api, errorMessage } from '../../api/client'
import { ask, notify } from '../../lib/notifyStore'
import { requiredDmyDate, requiredText } from '../../lib/validation'
import { enterRuns, isoDmy, isoToDmy, S } from './caseShared'

interface MemberDto {
  memberNo: string
  coverId: string
  patientName: string | null
  policyNo: string | null
  policyEffective: string | null
  policyExpiry: string | null
  add1: string | null
  add2: string | null
  add3: string | null
  postCode: string | null
  state: string | null
  insuranceCompany: string | null
}

interface MemberRow {
  memberNo: string
  coverId: string
  patientName: string
  policyNo: string
  policyEffective: string
  policyExpiry: string
  add1: string
  add2: string
  add3: string
  postCode: string
  state: string
  insuranceCompany: string
}

interface PayClaimRow {
  caseNo: string
  payClaimDate: string
  labTest: string
  conflictingInfo: string
  investigation: string
  radiology: string
  nonPanel: string
  noCashless: string
  others: string
  remarks: string
}

interface PayClaimDto {
  caseNo: string
  payClaimDate: string | null
  labTest: string | null
  conflictingInfo: string | null
  investigation: string | null
  radiology: string | null
  nonPanel: string | null
  noCashless: string | null
  others: string | null
  remarks: string | null
}

interface CaseHeader {
  caseNumber: string
  membershipNo: string | null
  policyNo: string | null
  principalName: string | null
  patientName: string | null
  admissionDate: string | null
  dischargeDate: string | null
}

interface PayClaimView {
  case: CaseHeader
  members: MemberDto[]
  record: PayClaimDto | null
}

interface Values {
  caseNo: string
  payClaimDate: string
  labTest: boolean
  conflictingInfo: boolean
  furtherInfo: boolean
  radiology: boolean
  nonPanel: boolean
  noCashless: boolean
  others: boolean
  othersRemark: string
}

type Mode = 'view' | 'add' | 'edit'

const cleared = {
  labTest: false,
  conflictingInfo: false,
  furtherInfo: false,
  radiology: false,
  nonPanel: false,
  noCashless: false,
  others: false,
  othersRemark: '',
}
const defaults: Values = { caseNo: '', payClaimDate: '', ...cleared }

const schema: yup.ObjectSchema<Values> = yup.object({
  caseNo: requiredText('Please enter the Case Number.'),
  payClaimDate: requiredDmyDate('Please enter the Pay & Claim Date.'),
  labTest: yup.boolean().default(false),
  conflictingInfo: yup.boolean().default(false),
  furtherInfo: yup.boolean().default(false),
  radiology: yup.boolean().default(false),
  nonPanel: yup.boolean().default(false),
  noCashless: yup.boolean().default(false),
  others: yup.boolean().default(false),
  othersRemark: yup
    .string()
    .trim()
    .default('')
    .when('others', { is: true, then: (s) => s.required('Please enter Remarks.') }),
})

const memberColumns: GridColumn<MemberRow>[] = [
  { key: 'memberNo', label: 'Member No' },
  { key: 'coverId', label: 'Cover ID' },
  { key: 'patientName', label: 'Patient Name' },
  { key: 'policyNo', label: 'Policy No' },
  { key: 'policyEffective', label: 'Policy Effective' },
  { key: 'policyExpiry', label: 'Policy Expiry' },
  { key: 'add1', label: 'Address 1' },
  { key: 'add2', label: 'Address 2' },
  { key: 'add3', label: 'Address 3' },
  { key: 'postCode', label: 'Postcode' },
  { key: 'state', label: 'State' },
  { key: 'insuranceCompany', label: 'Insurance Company' },
]

const historyColumns: GridColumn<PayClaimRow>[] = [
  { key: 'caseNo', label: 'Case No' },
  { key: 'payClaimDate', label: 'Pay & Claim Date' },
  { key: 'labTest', label: 'Lab Test', align: 'center' },
  { key: 'conflictingInfo', label: 'Conflicting Info', align: 'center' },
  { key: 'investigation', label: 'Investigation', align: 'center' },
  { key: 'radiology', label: 'Radiology/Scan', align: 'center' },
  { key: 'nonPanel', label: 'Non-Panel Hospital', align: 'center' },
  { key: 'noCashless', label: 'No Cashless 90 Days', align: 'center' },
  { key: 'others', label: 'Others', align: 'center' },
  { key: 'remarks', label: 'Remarks' },
]

const TAB_DETAILS = 1
const today = () => new Date().toLocaleDateString('en-GB')
const flag = (v: string | null) => S(v) === 'Y'

const toMember = (m: MemberDto): MemberRow => ({
  memberNo: m.memberNo,
  coverId: m.coverId,
  patientName: S(m.patientName),
  policyNo: S(m.policyNo),
  policyEffective: isoToDmy(m.policyEffective),
  policyExpiry: isoToDmy(m.policyExpiry),
  add1: S(m.add1),
  add2: S(m.add2),
  add3: S(m.add3),
  postCode: S(m.postCode),
  state: S(m.state),
  insuranceCompany: S(m.insuranceCompany),
})

const toHistory = (r: PayClaimDto): PayClaimRow => ({
  caseNo: r.caseNo,
  payClaimDate: isoToDmy(r.payClaimDate),
  labTest: S(r.labTest),
  conflictingInfo: S(r.conflictingInfo),
  investigation: S(r.investigation),
  radiology: S(r.radiology),
  nonPanel: S(r.nonPanel),
  noCashless: S(r.noCashless),
  others: S(r.others),
  remarks: S(r.remarks),
})

/** showPayClaimform: the record's flags back into the form. */
const recordValues = (caseNo: string, r: PayClaimDto): Values => ({
  caseNo,
  payClaimDate: isoToDmy(r.payClaimDate),
  labTest: flag(r.labTest),
  conflictingInfo: flag(r.conflictingInfo),
  furtherInfo: flag(r.investigation),
  radiology: flag(r.radiology),
  nonPanel: flag(r.nonPanel),
  noCashless: flag(r.noCashless),
  others: flag(r.others),
  othersRemark: S(r.remarks),
})

export function CasePayClaimPage() {
  const navigate = useNavigate()
  const [loaded, setLoaded] = useState(false)
  const [busy, setBusy] = useState(false)
  const [mode, setMode] = useState<Mode>('view')
  const [tab, setTab] = useState(0)
  const [members, setMembers] = useState<MemberRow[]>([])
  const [history, setHistory] = useState<PayClaimRow[]>([])
  const [header, setHeader] = useState<CaseHeader | null>(null)
  const [record, setRecord] = useState<PayClaimDto | null>(null)
  const [selectedMember, setSelectedMember] = useState<string | null>(null)
  const {
    register,
    handleSubmit,
    trigger,
    reset,
    setValue,
    getValues,
    control,
    formState: { errors },
  } = useForm<Values>({
    resolver: yupResolver(schema),
    defaultValues: defaults,
    mode: 'onTouched',
  })
  const others = useWatch({ control, name: 'others' })
  const editing = mode !== 'view'

  /** cmdShow_Click: members, case header and the case's Pay & Claim record (at most one). */
  async function load(caseNo = getValues('caseNo')) {
    if (!(await trigger('caseNo'))) return
    setBusy(true)
    try {
      const { data } = await api.get<PayClaimView>(`/api/case/pay-claim/${encodeURIComponent(caseNo.trim())}`)
      setMembers(data.members.map(toMember))
      setHeader(data.case)
      setRecord(data.record)
      setHistory(data.record ? [toHistory(data.record)] : [])
      reset(data.record ? recordValues(data.case.caseNumber, data.record) : { caseNo: data.case.caseNumber, ...cleared, payClaimDate: today() })
      setSelectedMember(null)
      setLoaded(true)
      setMode('view')
    } catch (e) {
      setLoaded(false)
      setMembers([])
      setHistory([])
      setHeader(null)
      setRecord(null)
      notify(errorMessage(e), 'error')
    } finally {
      setBusy(false)
    }
  }

  function add() {
    setMode('add')
    reset({ caseNo: getValues('caseNo'), payClaimDate: today(), ...cleared })
    setTab(TAB_DETAILS)
  }

  function edit() {
    setMode('edit')
    setTab(TAB_DETAILS)
  }

  function pickMember(row: MemberRow) {
    setSelectedMember(`${row.memberNo}|${row.coverId}`)
    setTab(TAB_DETAILS)
  }

  /** lstPayClaim_Click / showPayClaimform. */
  function pickHistory() {
    if (!record || mode !== 'view') return
    reset(recordValues(getValues('caseNo'), record))
  }

  const save = handleSubmit(
    async (v) => {
      if (!(await ask('Are you sure?'))) return
      setBusy(true)
      try {
        const { data } = await api.put<{ message: string }>(`/api/case/pay-claim/${encodeURIComponent(v.caseNo.trim())}`, {
          isNew: mode === 'add',
          payClaimDate: isoDmy(v.payClaimDate),
          labTest: v.labTest,
          conflictingInfo: v.conflictingInfo,
          furtherInfo: v.furtherInfo,
          radiology: v.radiology,
          nonPanel: v.nonPanel,
          noCashless: v.noCashless,
          others: v.others,
          othersRemark: v.others ? v.othersRemark : '',
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
    (invalid) => invalid.othersRemark && setTab(TAB_DETAILS),
  )

  const detailsPanel = (
    <div className="screen-form">
      <fieldset>
        <legend>Member</legend>
        <ReadField label="Membership No" value={S(header?.membershipNo)} />
        <ReadField label="Principal Name" value={S(header?.principalName)} />
        <ReadField label="Policy No" value={S(header?.policyNo)} />
        <ReadField label="Patient Name" value={S(header?.patientName)} />
        <ReadField label="Date of Admission" value={isoToDmy(header?.admissionDate)} />
        <ReadField label="Date of Discharge" value={isoToDmy(header?.dischargeDate)} />
      </fieldset>

      <fieldset disabled={!editing}>
        <legend>Actions</legend>
        <div className="check-grid">
          <CheckField label="Awaiting lab test result which is pending" {...register('labTest')} />
          <CheckField label="Further information/investigation is required on your condition" {...register('furtherInfo')} />
          <CheckField label="Conflicting information provided" {...register('conflictingInfo')} />
          <CheckField label="Coverage subject to Radiology/Scan result which is pending" {...register('radiology')} />
          <CheckField label="Non-Panel Hospital" {...register('nonPanel')} />
          <CheckField label="No cashless 90 days" {...register('noCashless')} />
        </div>
        <CheckField label="Others" {...register('others', { onChange: (e) => !e.target.checked && setValue('othersRemark', '') })} />
        <TextField label="Others remarks" wide maxLength={80} required={others} disabled={!others} error={errors.othersRemark} {...register('othersRemark')} />
      </fieldset>

      <fieldset>
        <legend>Pay &amp; Claim History</legend>
        <DataGrid
          caption="Pay and claim history"
          columns={historyColumns}
          rows={history}
          rowKey={(r) => `${r.caseNo}|${r.payClaimDate}`}
          onSelect={pickHistory}
          empty="No Pay & Claim records for this case."
        />
      </fieldset>
    </div>
  )

  const membersPanel = (
    <DataGrid
      caption="Members on the case"
      columns={memberColumns}
      rows={members}
      rowKey={(r) => `${r.memberNo}|${r.coverId}`}
      selectedKey={selectedMember}
      onSelect={pickMember}
      empty="Load a case to list its members."
    />
  )

  return (
    <PageShell title="Pay & Claim" subtitle="Record the Pay & Claim reasons for a case.">
      <form onSubmit={save} noValidate className="screen-form">
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
          <DateField control={control} name="payClaimDate" label="Pay & Claim Date" required disabled={!editing} />
        </fieldset>

        <ActionBar label="Pay and claim actions">
          <Button variant="ghost" onClick={add} disabled={!loaded || !!record || mode !== 'view'}>
            Add
          </Button>
          <Button variant="ghost" onClick={edit} disabled={!loaded || !record || mode !== 'view'}>
            Edit
          </Button>
          <Button variant="primary" type="submit" disabled={!editing || busy}>
            Save
          </Button>
          <span className="spacer" />
          <Button variant="link" onClick={() => navigate('/')}>
            Close
          </Button>
        </ActionBar>

        <Tabs
          label="Pay and claim sections"
          tabs={['Member Details', 'Pay & Claim Details']}
          panels={[membersPanel, detailsPanel]}
          active={tab}
          onChange={setTab}
        />
      </form>
    </PageShell>
  )
}
