import { useState } from 'react'
import type { FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { api, errorMessage } from '../../api/client'
import { DataTable } from '../../components/DataTable'
import type { Column } from '../../components/DataTable'
import { formatMoney, formatValue } from '../../lib/format'
import type { Row } from '../../lib/format'

interface Lookups {
  hospitals: Row[]
  payors: Row[]
  repudiationCodes: Row[]
  claimNatures: Row[]
  healthTypes: Row[]
  insuredTypes: Row[]
}

interface Option {
  value: string
  label: string
}

const money = (v: unknown) => formatMoney(v)

const columns: Column[] = [
  { key: 'CASNumber', label: 'Case No' },
  { key: 'PatientName', label: 'Patient' },
  { key: 'MBMNumber', label: 'Membership No' },
  { key: 'MBMPolicyNo', label: 'Policy No' },
  { key: 'PatientIC', label: 'Patient IC' },
  { key: 'CaseRegDate', label: 'Reg Date' },
  { key: 'CASDateAdmitted', label: 'Admitted' },
  { key: 'CASDischargeDate', label: 'Discharged' },
  { key: 'CASStatus', label: 'Status' },
  { key: 'CASClaimability', label: 'Claimability' },
  { key: 'CASStayType', label: 'Stay' },
  { key: 'CASPAYType', label: 'Pay Type' },
  { key: 'HOSName', label: 'Hospital' },
  { key: 'FinalDiag', label: 'Final Diagnosis' },
  { key: 'ActualAmt', label: 'Actual', format: money },
  { key: 'ApprovedAmt', label: 'Approved', format: money },
  { key: 'CASDRD', label: 'DRD' },
  { key: 'BordxRefNo', label: 'Bordx Ref' },
  { key: 'ClaimOpenDate', label: 'Claim Opened' },
  { key: 'CaseOpenBy', label: 'Opened By' },
]

type Filters = Record<string, string>

const input = { width: 130 } as const
const wideInput = { width: 200 } as const
const panelInput = { width: '100%' } as const

function TextFilter({ name, label, form, set, style, type }: { name: string; label: string; form: Filters; set: (n: string, v: string) => void; style?: React.CSSProperties; type?: string }) {
  return (
    <label className="muted" title={label}>
      {label}
      <br />
      <input type={type ?? 'text'} style={style ?? input} value={form[name] ?? ''} onChange={(e) => set(name, e.target.value)} />
    </label>
  )
}

function SelectFilter({ name, label, form, set, options, style }: { name: string; label: string; form: Filters; set: (n: string, v: string) => void; options: Option[]; style?: React.CSSProperties }) {
  return (
    <label className="muted" title={label}>
      {label}
      <br />
      <select style={style ?? input} value={form[name] ?? ''} onChange={(e) => set(name, e.target.value)}>
        <option value="">All</option>
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  )
}

export function CaseTrackingPage() {
  const navigate = useNavigate()
  const [form, setForm] = useState<Filters>({})
  const [applied, setApplied] = useState<Filters | null>(null)

  // Lookups are gated on Case Enquiry access (pos 7); degrade to text inputs if denied.
  const lookups = useQuery({
    queryKey: ['case-lookups'],
    queryFn: async () => (await api.get<Lookups>('/api/case/lookups')).data,
    retry: false,
    staleTime: 5 * 60 * 1000,
  })

  const tracking = useQuery({
    queryKey: ['case-tracking', applied],
    queryFn: async () => (await api.get<Row[]>('/api/case/tracking', { params: applied })).data,
    enabled: applied !== null,
  })
  const summary = useQuery({
    queryKey: ['case-tracking-summary', applied],
    queryFn: async () => (await api.get<Row | null>('/api/case/tracking/summary', { params: applied })).data,
    enabled: applied !== null,
  })

  const set = (name: string, value: string) => setForm((f) => ({ ...f, [name]: value }))
  const opts = (rows: Row[] | undefined, valueKey: string, labelKey: string): Option[] =>
    (rows ?? []).map((r) => ({ value: formatValue(r[valueKey]), label: `${formatValue(r[valueKey])} - ${formatValue(r[labelKey])}` }))

  const codeOrText = (name: string, label: string, options: Option[]) =>
    options.length ? (
      <SelectFilter name={name} label={label} form={form} set={set} options={options} />
    ) : (
      <TextFilter name={name} label={label} form={form} set={set} />
    )

  function submit(e: FormEvent) {
    e.preventDefault()
    const params = Object.fromEntries(Object.entries(form).filter(([, v]) => v.trim() !== ''))
    setApplied(params)
  }

  const l = lookups.data
  const pf = { form, set, style: panelInput }
  const pfSel = { form, set, style: panelInput }
  return (
    <section>
      <h2>Case Tracking</h2>
      <form onSubmit={submit} className="ct-layout">
        <div className="ct-content">
          <div className="search" style={{ flexWrap: 'wrap', alignItems: 'flex-end' }}>
            <TextFilter name="patient" label="Patient" form={form} set={set} style={wideInput} />
            {codeOrText('payor', 'Payor', opts(l?.payors, 'PAYCode', 'PAYCompanyName'))}
            {codeOrText('hosName', 'Hospital', (l?.hospitals ?? []).map((h) => ({ value: formatValue(h.HOSName), label: formatValue(h.HOSName) })))}
            <SelectFilter
              name="status"
              label="Status"
              form={form}
              set={set}
              options={[
                { value: 'O', label: 'Open' },
                { value: 'D', label: 'Discharged' },
                { value: 'OC', label: 'Open or Closed' },
              ]}
            />
            <SelectFilter
              name="claimability"
              label="Claimability"
              form={form}
              set={set}
              options={[
                { value: 'A', label: 'Approved set' },
                { value: 'R', label: 'Repudiated set' },
              ]}
            />
            <TextFilter name="regFrom" label="Reg From" form={form} set={set} type="date" />
            <TextFilter name="regTo" label="Reg To" form={form} set={set} type="date" />
            <button type="submit">Show</button>
          </div>
          {tracking.isFetching && <p className="muted">Searching…</p>}
          {tracking.error && <p className="error">{errorMessage(tracking.error)}</p>}
          {summary.data && (
            <p className="muted">
              Cases: {formatValue(summary.data.CaseCount)} &nbsp;·&nbsp; Actual: RM {formatMoney(summary.data.ActualAmt)} &nbsp;·&nbsp; Approved: RM{' '}
              {formatMoney(summary.data.ApprovedAmt)}
            </p>
          )}
          {tracking.data && (
            <>
              <p className="muted">
                {tracking.data.length} row(s){tracking.data.length >= 2000 ? ' (first 2000 shown, refine your filters)' : ''} — click a row to open it in Case Enquiry
              </p>
              <DataTable columns={columns} rows={tracking.data} rowKey="CASNumber" onSelect={(r) => navigate(`/case/enquiry?cas=${encodeURIComponent(String(r.CASNumber))}`)} />
            </>
          )}
        </div>

        <fieldset className="ct-filters">
          <legend>More filters</legend>
          <div className="ct-pair">
            <TextFilter name="caseFrom" label="Case From" {...pf} />
            <TextFilter name="caseTo" label="Case To" {...pf} />
          </div>
          <div className="ct-pair">
            <TextFilter name="mbmFrom" label="Member From" {...pf} />
            <TextFilter name="mbmTo" label="Member To" {...pf} />
          </div>
          <TextFilter name="batch" label="Batch" {...pf} />
          <TextFilter name="grp" label="Group Company" {...pf} />
          <SelectFilter name="pending" label="Pending" {...pfSel} options={[{ value: 'Y', label: 'Yes' }, { value: 'N', label: 'No' }]} />
          <SelectFilter
            name="claimPending"
            label="Claim Pending"
            {...pfSel}
            options={[
              { value: 'P', label: 'Pending' },
              { value: 'C', label: 'Closed' },
              { value: 'B', label: 'Both' },
            ]}
          />
          <TextFilter name="regBy" label="Registered By" {...pf} />
          <TextFilter name="payType" label="Pay Type" {...pf} />
          <TextFilter name="userToken" label="User Token" {...pf} />
          <SelectFilter name="sex" label="Sex" {...pfSel} options={[{ value: 'M', label: 'Male' }, { value: 'F', label: 'Female' }]} />
          <SelectFilter
            name="memberType"
            label="Member Type"
            {...pfSel}
            options={[
              { value: 'principal', label: 'Principal' },
              { value: 'supplementary', label: 'Supplementary' },
            ]}
          />
          {optionsOrText(l?.healthTypes, 'HLTCode', 'HLTDescription', 'hltCode', 'Health Type')}
          {optionsOrText(l?.insuredTypes, 'INSCode', 'INSDescription', 'insCode', 'Insured Type')}
          <SelectFilter
            name="renewFlag"
            label="Renewal"
            {...pfSel}
            options={[
              { value: 'P', label: 'P' },
              { value: 'R', label: 'R' },
              { value: 'T', label: 'T' },
              { value: 'N', label: 'N' },
            ]}
          />
          <TextFilter name="takeover" label="Takeover" {...pf} />
          <TextFilter name="agentCode" label="Agent Code" {...pf} />
          <TextFilter name="policyNo" label="Policy No" {...pf} />
          <TextFilter name="doctor" label="Doctor" {...pf} />
          <div className="ct-pair">
            {optionsOrText(l?.repudiationCodes, 'RepCode', 'RepDescription', 'repFrom', 'Rep Code From')}
            {optionsOrText(l?.repudiationCodes, 'RepCode', 'RepDescription', 'repTo', 'Rep Code To')}
          </div>
          <div className="ct-pair">
            {optionsOrText(l?.claimNatures, 'ClaimNatureCode', 'ClaimNatureName', 'claimNatureFrom', 'Claim Nature From')}
            {optionsOrText(l?.claimNatures, 'ClaimNatureCode', 'ClaimNatureName', 'claimNatureTo', 'Claim Nature To')}
          </div>
          <TextFilter name="stayType" label="Stay Type" {...pf} />
        </fieldset>
      </form>
    </section>
  )

  function optionsOrText(rows: Row[] | undefined, valueKey: string, labelKey: string, name: string, label: string) {
    const options = opts(rows, valueKey, labelKey)
    return options.length ? (
      <SelectFilter name={name} label={label} {...pfSel} options={options} />
    ) : (
      <TextFilter name={name} label={label} {...pf} />
    )
  }
}
