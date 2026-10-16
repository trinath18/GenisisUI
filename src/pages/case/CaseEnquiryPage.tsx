import { useState } from 'react'
import type { FormEvent } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { api, errorMessage } from '../../api/client'
import { DataTable } from '../../components/DataTable'
import type { Column } from '../../components/DataTable'
import { FieldGrid } from '../../components/FieldGrid'
import type { Field } from '../../components/FieldGrid'
import { formatMoney, formatValue } from '../../lib/format'
import type { Row } from '../../lib/format'

type SearchBy = 'number' | 'member' | 'patient' | 'ic' | 'policy'

interface CaseDiagnoses {
  first: Row[]
  final: Row[]
  repudiation: Row[]
}

const money = (v: unknown) => formatMoney(v)
const text = (row: Row, ...keys: string[]) => keys.map((k) => formatValue(row[k])).filter(Boolean).join(' ')
const joinList = (row: Row, prefix: string, n: number) =>
  Array.from({ length: n }, (_, i) => formatValue(row[`${prefix}${i + 1}`])).filter(Boolean).join(', ')

const searchColumns: Column[] = [
  { key: 'CASNumber', label: 'Case No' },
  { key: 'PatientName', label: 'Patient' },
  { key: 'MBMNumber', label: 'Membership No' },
  { key: 'MBMName', label: 'Member' },
  { key: 'MBMIcBcPp', label: 'IC/BC/PP' },
  { key: 'MBMPolicyNo', label: 'Policy No' },
  { key: 'CaseRegDate', label: 'Reg Date' },
  { key: 'CASDateAdmitted', label: 'Admitted' },
  { key: 'CASDischargeDate', label: 'Discharged' },
  { key: 'CASStatus', label: 'Status' },
  { key: 'CASClaimability', label: 'Claimability' },
  { key: 'HOSName', label: 'Hospital' },
  { key: 'FinalDiag', label: 'Final Diagnosis' },
]

const detailFields: Field[] = [
  { label: 'Case No', key: 'CASNumber' },
  { label: 'Case Status', key: 'CASStatus' },
  { label: 'Claimability', key: 'CASClaimability' },
  { label: 'Pending', key: 'CASPending' },
  { label: 'Reg Date', key: 'CaseRegDate' },
  { label: 'Admitted', key: 'CASDateAdmitted' },
  { label: 'Discharged', key: 'CASDischargeDate' },
  { label: 'Stay Type', key: 'CASStayType' },
  { label: 'Pay Type', key: 'CASPAYType' },
  { label: 'Claim Nature', key: 'ClaimNatureCode' },
  { label: 'Hospital', value: (r) => text(r, 'HOSName') + (r.CASHOSName ? ` / ${formatValue(r.CASHOSName)}` : '') },
  { label: 'Attending Doctor', value: (r) => joinList(r, 'CASAttendDoctor', 5) },
  { label: 'Anaesthetist', value: (r) => joinList(r, 'CASAnaesName', 3) },
  { label: 'Referred By', key: 'ReferedBy' },
  { label: 'Admission Reason', key: 'CASAdmissionReason', wide: true },
  { label: 'LG Amount', value: (r) => money(r.CASLGAmt) },
  { label: 'Reserve Amount', value: (r) => money(r.CASReserveAmount) },
  { label: 'Room & Board Days', key: 'RoomBoardDay' },
  { label: 'Linked Case', key: 'LINKCASNo' },
  { label: 'Doc Type / Date', value: (r) => text(r, 'CASDocType', 'CASDocDate') },
  { label: 'Invoice No', key: 'CASInvNo' },
  { label: 'Opened By', key: 'CaseOpenBy' },
  { label: 'VIP', key: 'VIPInd' },
  { label: 'Membership No', key: 'MBMNumber' },
  { label: 'Member', key: 'MBMName' },
  { label: 'Patient', key: 'MBMCName' },
  { label: 'Cover ID', key: 'MBMPatientCovID' },
  { label: 'Patient DOB', key: 'MBMCDOB' },
  { label: 'IC/BC/PP', key: 'MBMIcBcPp' },
  { label: 'Policy No', key: 'MBMPolicyNo' },
  { label: 'Insurer', key: 'INSCode' },
  { label: 'Payor', key: 'PAYCode' },
  { label: 'Plan', value: (r) => text(r, 'PLNCode') + (r.ProductName ? ` - ${formatValue(r.ProductName)}` : '') },
  { label: 'Patient Plan', key: 'MBMCPLNCode' },
  { label: 'Health Type', key: 'HLTCode' },
  { label: 'Member Status', value: (r) => text(r, 'MBMStatus') + (r.MBMDataStatus ? ` (data: ${formatValue(r.MBMDataStatus)})` : '') },
  { label: 'Payor Eff / Exp', value: (r) => `${formatValue(r.MBMPayorEffDate)} - ${formatValue(r.MBMPayorExpDate)}` },
  { label: 'Group Company', key: 'GRPCompany' },
  { label: 'GL Issuance', key: 'MBMGLIssuance' },
  { label: 'Plan Special Note', key: 'PLNSpecialNote', wide: true },
]

const remarkFields: Field[] = [
  { label: 'Remarks 1', key: 'CASORemarks', wide: true },
  { label: 'Remarks 2', key: 'CASORemarksTwo', wide: true },
  { label: 'Internal Remarks', key: 'CASORemarksInt', wide: true },
  { label: 'Remarks 3', key: 'CASOTwoRemarks', wide: true },
  { label: 'Remarks 4', key: 'CASOTwoRemarksTwo', wide: true },
  { label: 'Case Remarks', key: 'CASRemarks', wide: true },
  { label: 'Remarks Four', key: 'CASRemarksFour', wide: true },
  { label: 'Remarks Five', key: 'CASRemarksFive', wide: true },
  { label: 'Query', key: 'CASQuery', wide: true },
  { label: 'DRD', key: 'CASDRD' },
  { label: 'Special Note', key: 'CASSpecialNote', wide: true },
  { label: 'Invoice Note', key: 'CASInvNote', wide: true },
  { label: 'Payment Pending Remark', key: 'CasPymtPdingRemark', wide: true },
  { label: 'Complaint Date', key: 'CASComplaintDate' },
  { label: 'Complainant', key: 'CASComplainant' },
  { label: 'Complaint Issue', key: 'CASComplaintIssue', wide: true },
  { label: 'Complaint Action', key: 'CASCompAction', wide: true },
]

const diagColumns: Column[] = [
  { key: 'ICD', label: 'ICD Code' },
  { key: 'Diagnosis', label: 'Diagnosis' },
  { key: 'DOS', label: 'DOS' },
  { key: 'User', label: 'Last Adj User' },
  { key: 'Adjusted', label: 'Last Adj Date' },
]

const repudiationColumns: Column[] = [
  { key: 'CASREPCode1', label: 'Rep Code 1', format: (v, r) => [v, r.RepDesc1].map(formatValue).filter(Boolean).join(' - ') },
  { key: 'CASREPCode2', label: 'Rep Code 2', format: (v, r) => [v, r.RepDesc2].map(formatValue).filter(Boolean).join(' - ') },
  { key: 'CASREPCode3', label: 'Rep Code 3', format: (v, r) => [v, r.RepDesc3].map(formatValue).filter(Boolean).join(' - ') },
  { key: 'CASREPReasons1', label: 'Reasons', format: (_v, r) => text(r, 'CASREPReasons1', 'CASREPReasons2', 'CASREPReasons3') },
  { key: 'CASREPIssuedBy', label: 'Issued By' },
  { key: 'CASREPDate', label: 'Rep Date' },
  { key: 'CASPersonnel', label: 'Personnel' },
  { key: 'CASAttention', label: 'Attention' },
  { key: 'CASUnderlying', label: 'Underlying', format: (_v, r) => text(r, 'CASUnderlying', 'CASUnderlyingRemark') },
  { key: 'Remarks', label: 'Remarks' },
]

const procColumns: Column[] = [
  { key: 'Procedure', label: 'Procedure' },
  { key: 'CPT', label: 'CPT Code' },
  { key: 'Qty', label: 'Qty' },
  { key: 'Surg', label: 'Surg Fee', format: money },
  { key: 'Anae', label: 'Anae Fee', format: money },
  { key: 'NonSurg', label: 'Non-Surg Fee', format: money },
]

const nonSurgProcColumns: Column[] = [
  { key: 'Procedure', label: 'Procedure' },
  { key: 'CPT', label: 'CPT Code' },
  { key: 'Qty', label: 'Qty' },
]

const udColumns: Column[] = [
  { key: 'Code', label: 'UD Code' },
  { key: 'Reason', label: 'Reason' },
  { key: 'DOS', label: 'DOS' },
]

const claimColumns: Column[] = [
  { key: 'ClaimVersion', label: 'Ver' },
  { key: 'CLMTotalActual', label: 'Actual', format: money },
  { key: 'CLMTotalApproved', label: 'Approved', format: money },
  { key: 'CLMPayableByMedix2H', label: 'Payable to Hosp', format: money },
  { key: 'CLMPayableByMedix2M', label: 'Payable to Mbr', format: money },
  { key: 'CLMPending', label: 'Pending' },
  { key: 'CLMPayorAppStatus', label: 'Payor Status' },
  { key: 'CLMPayorAppDate', label: 'Payor App Date' },
  { key: 'BordxRefNo', label: 'Bordx Ref' },
  { key: 'BordxDate', label: 'Bordx Date' },
  { key: 'ClaimCloseDate', label: 'Closed' },
  { key: 'TotGST', label: 'GST', format: money },
  { key: 'DOSend', label: 'DO Sent' },
]

const memberCaseColumns: Column[] = [
  { key: 'CASNumber', label: 'Case No' },
  { key: 'MBMCName', label: 'Patient' },
  { key: 'MBMCRELCode', label: 'Rel' },
  { key: 'MBMPatientCovID', label: 'Cover ID' },
  { key: 'CASDateAdmitted', label: 'Admitted' },
  { key: 'CASDischargeDate', label: 'Discharged' },
  { key: 'CASStatus', label: 'Status' },
  { key: 'CASClaimability', label: 'Claimability' },
  { key: 'DIAPrelimDiag1', label: 'First Diag' },
  { key: 'DIAFinalDiag1', label: 'Final Diag' },
  { key: 'HOSName', label: 'Hospital' },
]

const historyColumns: Column[] = [
  { key: 'CASNumber', label: 'Case No' },
  { key: 'MBMNumber', label: 'Membership No' },
  { key: 'MBMName', label: 'Member' },
  { key: 'MBMCName', label: 'Patient' },
  { key: 'MBMCRELCode', label: 'Rel' },
  { key: 'MBMIcBcPp', label: 'IC/BC/PP' },
  { key: 'PAYCode', label: 'Payor' },
  { key: 'CASDateAdmitted', label: 'Admitted' },
  { key: 'CASDischargeDate', label: 'Discharged' },
  { key: 'CASStatus', label: 'Status' },
  { key: 'CASClaimability', label: 'Claimability' },
  { key: 'DIAFinalDiag1', label: 'Final Diag' },
  { key: 'HOSName', label: 'Hospital' },
]

const tabs = ['Detail', 'Diagnosis', 'Procedures', 'Remarks', 'Claims', 'Member Cases', 'History', 'All Fields'] as const
type Tab = (typeof tabs)[number]

function diagRows(data: Row[] | undefined, diagPrefix: string): Row[] {
  return (data ?? []).flatMap((r) =>
    [1, 2, 3]
      .map((i) => ({
        ICD: r[`ICDCode${i}`],
        Diagnosis: r[`${diagPrefix}${i}`],
        DOS: r[`DIADOS${i}`],
        User: r.DIALastAdjustmentUser,
        Adjusted: r.DIALastAdjustmentDate,
      }))
      .filter((x) => formatValue(x.ICD) || formatValue(x.Diagnosis)),
  )
}

function procRows(d: Row, reqPrefix: string, cptPrefix: string, qtyPrefix: string, withFees: boolean): Row[] {
  return Array.from({ length: 8 }, (_, i) => i + 1)
    .map((i) => ({
      Procedure: d[`${reqPrefix}${i}`],
      CPT: d[`${cptPrefix}${i}`],
      Qty: d[`${qtyPrefix}${i}`],
      ...(withFees
        ? { Surg: d[`CASProcActSurgFees${i}`], Anae: d[`CASProcActAnaeFees${i}`], NonSurg: d[`CASProcActNonSurgFees${i}`] }
        : {}),
    }))
    .filter((x) => formatValue(x.Procedure) || formatValue(x.CPT))
}

function udRows(d: Row): Row[] {
  return [1, 2, 3]
    .map((i) => ({ Code: d[`CASUDCode${i}`], Reason: d[`CASUDReasons${i}`], DOS: d[`CASUDDOS${i}`] }))
    .filter((x) => formatValue(x.Code) || formatValue(x.Reason))
}

function useCaseData<T>(casNumber: string, path: string, enabled: boolean) {
  return useQuery({
    queryKey: ['case', casNumber, path],
    queryFn: async () => (await api.get<T>(`/api/case/${encodeURIComponent(casNumber)}/${path}`)).data,
    enabled,
  })
}

function Loading({ query, children }: { query: { isLoading: boolean; error: unknown }; children: () => React.ReactNode }) {
  if (query.isLoading) return <p className="muted">Loading…</p>
  if (query.error) return <p className="error">{errorMessage(query.error)}</p>
  return <>{children()}</>
}

function DiagnosisTab({ casNumber }: { casNumber: string }) {
  const diagnoses = useCaseData<CaseDiagnoses>(casNumber, 'diagnoses', true)
  return (
    <Loading query={diagnoses}>
      {() => (
        <>
          <h4>First Diagnosis</h4>
          <DataTable columns={diagColumns} rows={diagRows(diagnoses.data!.first, 'DIAPrelimDiag')} empty="No first diagnosis recorded." />
          <h4>Final Diagnosis</h4>
          <DataTable columns={diagColumns} rows={diagRows(diagnoses.data!.final, 'DIAFinalDiag')} empty="No final diagnosis recorded." />
          <h4>Repudiation</h4>
          <DataTable columns={repudiationColumns} rows={diagnoses.data!.repudiation} empty="No repudiation recorded." />
        </>
      )}
    </Loading>
  )
}

function CaseView({ casNumber, onOpenCase }: { casNumber: string; onOpenCase: (cas: string) => void }) {
  const [tab, setTab] = useState<Tab>('Detail')
  const detail = useQuery({
    queryKey: ['case', casNumber],
    queryFn: async () => (await api.get<Row>(`/api/case/${encodeURIComponent(casNumber)}`)).data,
  })
  const claims = useCaseData<Row[]>(casNumber, 'claims', tab === 'Claims')
  const memberCases = useCaseData<Row[]>(casNumber, 'member-cases', tab === 'Member Cases')
  const history = useCaseData<Row[]>(casNumber, 'history', tab === 'History')

  return (
    <Loading query={detail}>
      {() => {
        const d = detail.data!
        return (
          <div className="member">
            <h3>
              {formatValue(d.CASNumber)} - {formatValue(d.MBMCName) || formatValue(d.MBMName)}
            </h3>
            <div className="tabs" role="tablist">
              {tabs.map((t) => (
                <button key={t} role="tab" aria-selected={t === tab} className={t === tab ? 'active' : ''} onClick={() => setTab(t)}>
                  {t}
                </button>
              ))}
            </div>
            <div className="tab-body">
              {tab === 'Detail' && <FieldGrid fields={detailFields} row={d} />}
              {tab === 'Diagnosis' && <DiagnosisTab casNumber={casNumber} />}
              {tab === 'Procedures' && (
                <>
                  <h4>Surgical Procedures</h4>
                  <DataTable
                    columns={procColumns}
                    rows={procRows(d, 'CASOPROCRequired', 'CASCptCode', 'CaseSurgProcQty', true)}
                    empty="No surgical procedures recorded."
                  />
                  <h4>Non-Surgical Procedures</h4>
                  <DataTable
                    columns={nonSurgProcColumns}
                    rows={procRows(d, 'CASONonSurgPROCRequired', 'CASNonSurgCptCode', 'CaseNonSurgProcQty', false)}
                    empty="No non-surgical procedures recorded."
                  />
                  <h4>Underwriting / Deferral</h4>
                  <DataTable columns={udColumns} rows={udRows(d)} empty="No UD codes recorded." />
                  <FieldGrid
                    fields={[
                      { label: 'Investigation Codes', value: (r) => joinList(r, 'CASInvCode', 3) },
                      { label: 'Investigation Done', value: (r) => joinList(r, 'CASOProcInvestigationDone', 3) },
                      { label: 'First Call', value: (r) => text(r, 'CASFirstCall', 'CASFCallTime') },
                      { label: 'First Treated', value: (r) => text(r, 'CASFirstTreated', 'CASFTreatedTime') },
                      { label: 'DOA / DOD Time', value: (r) => `${formatValue(r.CASDOATime)} / ${formatValue(r.CASDODTime)}` },
                      { label: 'Condition Will Recur', key: 'CASOCondWillRecur' },
                      { label: 'Follow Up Required', key: 'CASOFollowUpRequired' },
                      { label: 'Patient Age', value: (r) => text(r, 'CASPatientAge', 'CASPatientDayYr') },
                    ]}
                    row={d}
                  />
                </>
              )}
              {tab === 'Remarks' && <FieldGrid fields={remarkFields} row={d} />}
              {tab === 'Claims' && <Loading query={claims}>{() => <DataTable columns={claimColumns} rows={claims.data!} />}</Loading>}
              {tab === 'Member Cases' && (
                <Loading query={memberCases}>
                  {() => (
                    <DataTable
                      columns={memberCaseColumns}
                      rows={memberCases.data!}
                      rowKey="CASNumber"
                      selectedKey={casNumber}
                      onSelect={(r) => onOpenCase(String(r.CASNumber))}
                    />
                  )}
                </Loading>
              )}
              {tab === 'History' && (
                <Loading query={history}>
                  {() => (
                    <DataTable
                      columns={historyColumns}
                      rows={history.data!}
                      rowKey="CASNumber"
                      selectedKey={casNumber}
                      onSelect={(r) => onOpenCase(String(r.CASNumber))}
                    />
                  )}
                </Loading>
              )}
              {tab === 'All Fields' && <FieldGrid fields={Object.keys(d).map((k) => ({ label: k, key: k }))} row={d} />}
            </div>
          </div>
        )
      }}
    </Loading>
  )
}

export function CaseEnquiryPage() {
  const [params] = useSearchParams()
  const cas = params.get('cas')
  return <CaseEnquiry key={cas ?? ''} initialCas={cas} />
}

function CaseEnquiry({ initialCas }: { initialCas: string | null }) {
  const [by, setBy] = useState<SearchBy>('number')
  const [input, setInput] = useState('')
  const [criteria, setCriteria] = useState<{ by: SearchBy; q: string } | null>(null)
  const [selected, setSelected] = useState<string | null>(initialCas)

  const search = useQuery({
    queryKey: ['case-search', criteria],
    queryFn: async () => {
      const { data } = await api.get<Row[]>('/api/case/search', { params: criteria })
      return data
    },
    enabled: criteria !== null,
  })
  const singleHit = search.data?.length === 1 ? String(search.data[0].CASNumber) : null
  const current = selected ?? singleHit

  function submit(e: FormEvent) {
    e.preventDefault()
    setSelected(null)
    setCriteria({ by, q: input.trim() })
  }

  return (
    <section>
      <h2>Case Enquiry</h2>
      <form className="search" onSubmit={submit}>
        <select value={by} onChange={(e) => setBy(e.target.value as SearchBy)} aria-label="Search by">
          <option value="number">Case No</option>
          <option value="member">Membership No</option>
          <option value="patient">Patient / Member Name</option>
          <option value="ic">IC/BC/PP</option>
          <option value="policy">Policy No</option>
        </select>
        <input value={input} onChange={(e) => setInput(e.target.value)} placeholder="Enter at least 2 characters" aria-label="Search text" />
        <button type="submit" disabled={input.trim().length < 2}>
          Show
        </button>
      </form>
      {input.trim().length > 0 && input.trim().length < 2 && <p className="error">Enter at least 2 characters to search.</p>}
      {search.isFetching && <p className="muted">Searching…</p>}
      {search.error && <p className="error">{errorMessage(search.error)}</p>}
      {search.data && search.data.length !== 1 && (
        <>
          <p className="muted">
            {search.data.length} result(s){search.data.length >= 200 ? ' (first 200 shown, refine your search)' : ''}
          </p>
          <DataTable columns={searchColumns} rows={search.data} rowKey="CASNumber" selectedKey={selected ?? undefined} onSelect={(r) => setSelected(String(r.CASNumber))} />
        </>
      )}
      {current && <CaseView key={current} casNumber={current} onOpenCase={setSelected} />}
    </section>
  )
}
