import { useState } from 'react'
import type { FormEvent } from 'react'
import { useQuery } from '@tanstack/react-query'
import { api, errorMessage } from '../../api/client'
import { DataTable } from '../../components/DataTable'
import type { Column } from '../../components/DataTable'
import { FieldGrid } from '../../components/FieldGrid'
import type { Field } from '../../components/FieldGrid'
import { formatDate, formatMoney, formatValue } from '../../lib/format'
import type { Row } from '../../lib/format'

type SearchBy = 'number' | 'name' | 'ic' | 'policy'

interface MemberDetail {
  principal: Row
  coveredPersons: Row[]
  plan: Row | null
  annualLimit: Row | null
  clinic: Row[]
  benefitLimits: Row[]
}

const money = (v: unknown) => formatMoney(v)
const text = (row: Row, ...keys: string[]) => keys.map((k) => formatValue(row[k])).filter(Boolean).join(' ')

const searchColumns: Column[] = [
  { key: 'MBMNumber', label: 'Membership No' },
  { key: 'MBMName', label: 'Name' },
  { key: 'MBMIcBcPp', label: 'IC/BC/PP' },
  { key: 'MBMPolicyNo', label: 'Policy No' },
  { key: 'MBMPayorEffDate', label: 'Eff Date' },
  { key: 'MBMPayorExpDate', label: 'Exp Date' },
  { key: 'MBMStatus', label: 'Status' },
  { key: 'MBMGroupCompany', label: 'Group Company' },
]

const principalFields = (d: MemberDetail): Field[] => [
  { label: 'Membership No', key: 'MBMNumber' },
  { label: 'Name', value: (r) => text(r, 'MBMSalutation', 'MBMName') },
  { label: 'IC/BC/PP', key: 'MBMIcBcPp' },
  { label: 'Other IC', key: 'MBMIcBcPp2nd' },
  { label: 'Policy No', key: 'MBMPolicyNo' },
  { label: 'Status', value: (r) => text(r, 'MBMStatus') + (r.MBMDataStatus ? ` (data: ${formatValue(r.MBMDataStatus)})` : '') },
  { label: 'Member Type', key: 'MBMMemberType' },
  { label: 'Insurer', key: 'INSCode' },
  { label: 'Payor', key: 'PAYCode' },
  { label: 'Plan', value: (r) => text(r, 'PLNCode') + (d.plan?.ProductName ? ` - ${formatValue(d.plan.ProductName)}` : '') },
  { label: 'Health Type', key: 'HLTCode' },
  { label: 'Renewal', key: 'MBMRenewFlag' },
  { label: 'Date of Birth', key: 'MBMDOB' },
  { label: 'Sex', key: 'MBMSex' },
  { label: 'Adult/Child', key: 'MBMAdultChild' },
  { label: 'Policy Year', key: 'MBMPolicyYear' },
  { label: 'Payor Eff Date', key: 'MBMPayorEffDate' },
  { label: 'Payor Exp Date', key: 'MBMPayorExpDate' },
  { label: 'Final Expiry', key: 'MBMFinalExpiryDate' },
  { label: 'Value Date', key: 'MBMValueDate' },
  { label: 'Bordx Date', key: 'MBMBordxDate' },
  { label: 'Batch No', key: 'MBMBatchNo' },
  { label: 'Annual Limit', value: () => money(d.annualLimit?.AnnLimit) },
  { label: 'Available Limit', value: (r) => money(r.MBMAvailableLimit) },
  { label: 'GL Issuance', key: 'MBMGLIssuance' },
  { label: 'Suspended', value: (r) => text(r, 'MBMSuspendStatus') + (r.MBMSuspendDate ? ` ${formatDate(r.MBMSuspendDate)}` : '') },
  { label: 'Cancel Date', key: 'MBMCancelDate' },
  { label: 'Group Company', key: 'MBMGroupCompany' },
  { label: 'Employee No', key: 'MBMEmployeeNo' },
  { label: 'Department', key: 'MBMDepartment' },
  { label: 'Phone (H/M/O)', value: (r) => [r.MBMTelnoH, r.MBMTelNoM, r.MBMTelNoO].map(formatValue).filter(Boolean).join(' / ') },
  { label: 'Email', key: 'MBMEmail' },
  { label: 'Address', value: (r) => text(r, 'MBMAddress1', 'MBMAddress2', 'MBMAddress3', 'MBMPostCode', 'STACode'), wide: true },
  { label: 'Allergic', key: 'MBMAllergic', wide: true },
  { label: 'Exclusion', key: 'MBMExclusion', wide: true },
  { label: 'Remarks', key: 'MBMRemarks', wide: true },
  { label: 'Management Notes', key: 'MBMMmgtNotes', wide: true },
  { label: 'Plan Special Note', key: 'PLNSpecialNote', wide: true },
  { label: 'Plan Message', value: () => formatValue(d.plan?.MessagePromt), wide: true },
]

const coveredColumns: Column[] = [
  { key: 'MBMCCoverID', label: 'Cover ID' },
  { key: 'MBMCName', label: 'Name', format: (_, r) => text(r, 'MBMCSalutation', 'MBMCName') },
  { key: 'MBMCICBCPPNo', label: 'IC/BC/PP' },
  { key: 'MBMCDOB', label: 'DOB' },
  { key: 'MBMCSex', label: 'Sex' },
  { key: 'MBMCAdultChild', label: 'A/C' },
  { key: 'MBMCRELCode', label: 'Relationship' },
  { key: 'MBMCStatus', label: 'Status' },
  { key: 'MBMCPLNCode', label: 'Plan' },
  { key: 'MBMCEffDate', label: 'Eff Date' },
  { key: 'MBMCExpDate', label: 'Exp Date' },
  { key: 'MBMCAnnualLimit', label: 'Annual Limit', format: money },
  { key: 'MBMCAvailableLimit', label: 'Available', format: money },
  { key: 'MBMCPremium', label: 'Premium', format: money },
  { key: 'MBMCAllergic', label: 'Allergy' },
  { key: 'MBMCExclusion', label: 'Exclusion' },
]

const adjustmentColumns: Column[] = [
  { key: 'MBMAmendID', label: 'ID' },
  { key: 'MBMCoverID', label: 'Cover ID' },
  { key: 'MBMAmendEdtType', label: 'Endt Type' },
  { key: 'MBMAmendDate', label: 'Amend Date' },
  { key: 'MBMAENDtEffDate', label: 'Endt Eff Date' },
  { key: 'MBMAEndtBordxDate', label: 'Bordx Date' },
  { key: 'MBMAEndtBatchNo', label: 'Batch No' },
  { key: 'MBMAmendUser', label: 'User' },
]

const caseColumns: Column[] = [
  { key: 'CASNumber', label: 'Case No' },
  { key: 'MBMCName', label: 'Patient' },
  { key: 'MBMPatientCovID', label: 'Cover ID' },
  { key: 'MBMNumber', label: 'Membership No' },
  { key: 'CASDateAdmitted', label: 'Admitted' },
  { key: 'CASDischargeDate', label: 'Discharged' },
  { key: 'CASStatus', label: 'Status' },
  { key: 'CASClaimability', label: 'Claimability' },
  { key: 'DIAFinalDiag1', label: 'Final Diagnosis' },
  { key: 'HOSName', label: 'Hospital' },
]

const historyColumns: Column[] = [
  { key: 'MBMNumber', label: 'Membership No' },
  { key: 'MBMPolicyNo', label: 'Policy No' },
  { key: 'MBMName', label: 'Name' },
  { key: 'INSCode', label: 'Insurer' },
  { key: 'PAYCode', label: 'Payor' },
  { key: 'PLNCode', label: 'Plan' },
  { key: 'ProductName', label: 'Product' },
  { key: 'MBMPayorEffDate', label: 'Eff Date' },
  { key: 'MBMPayorExpDate', label: 'Exp Date' },
  { key: 'MBMStatus', label: 'Status' },
]

const suppHistoryColumns: Column[] = [
  { key: 'MBMNumber', label: 'Membership No' },
  { key: 'MBMCOVID', label: 'Cover ID' },
  { key: 'MBMCName', label: 'Name' },
  { key: 'PrincipalName', label: 'Principal' },
  { key: 'MBMPolicyNo', label: 'Policy No' },
  { key: 'MBMPayorEffDate', label: 'Eff Date' },
  { key: 'MBMPayorExpDate', label: 'Exp Date' },
  { key: 'MBMStatus', label: 'Status' },
]

const accountColumns: Column[] = [
  { key: 'MBMPatientCovID', label: 'Cover ID' },
  ...['totalApprove', 'totalReimburse', 'totalPayable2Mbm', 'totalPayable2Hos', 'totalPaid2Hos', 'totalPaid2MBM', 'totalPaidByMBM', 'TotalExcess', 'MBMPaidAmt'].map(
    (k) => ({ key: k, label: k.replace(/^total/i, 'Total ').replace(/2/g, ' to '), format: money }),
  ),
]

const tabs = ['Prin Detail', 'Supp', 'Adjust History', 'Current Case', 'Case History', 'Mem History', 'Account', 'Notes', 'All Fields'] as const
type Tab = (typeof tabs)[number]

function useMemberData<T>(mbmNumber: string, path: string, enabled: boolean) {
  return useQuery({
    queryKey: ['membership', mbmNumber, path],
    queryFn: async () => (await api.get<T>(`/api/membership/${encodeURIComponent(mbmNumber)}/${path}`)).data,
    enabled,
  })
}

function Loading({ query, children }: { query: { isLoading: boolean; error: unknown }; children: () => React.ReactNode }) {
  if (query.isLoading) return <p className="muted">Loading…</p>
  if (query.error) return <p className="error">{errorMessage(query.error)}</p>
  return <>{children()}</>
}

function MemberView({ mbmNumber }: { mbmNumber: string }) {
  const [tab, setTab] = useState<Tab>('Prin Detail')
  const detail = useQuery({
    queryKey: ['membership', mbmNumber],
    queryFn: async () => (await api.get<MemberDetail>(`/api/membership/${encodeURIComponent(mbmNumber)}`)).data,
  })
  const adjustments = useMemberData<Row[]>(mbmNumber, 'adjustments', tab === 'Adjust History')
  const cases = useMemberData<Row[]>(mbmNumber, 'cases', tab === 'Current Case')
  const caseHistory = useMemberData<Row[]>(mbmNumber, 'case-history', tab === 'Case History')
  const memHistory = useMemberData<{ principal: Row[]; supplementary: Row[] }>(mbmNumber, 'member-history', tab === 'Mem History')
  const account = useMemberData<Row[]>(mbmNumber, 'account', tab === 'Account')
  const notes = useMemberData<{ exclusions: Row[]; remarks: Row[] }>(mbmNumber, 'notes', tab === 'Notes')

  return (
    <Loading query={detail}>
      {() => {
        const d = detail.data!
        return (
          <div className="member">
            <h3>
              {formatValue(d.principal.MBMNumber)} - {formatValue(d.principal.MBMName)}
            </h3>
            <div className="tabs" role="tablist">
              {tabs.map((t) => (
                <button key={t} role="tab" aria-selected={t === tab} className={t === tab ? 'active' : ''} onClick={() => setTab(t)}>
                  {t === 'Supp' ? `Supp (${d.coveredPersons.length})` : t}
                </button>
              ))}
            </div>
            <div className="tab-body">
              {tab === 'Prin Detail' && <FieldGrid fields={principalFields(d)} row={d.principal} />}
              {tab === 'Supp' && <DataTable columns={coveredColumns} rows={d.coveredPersons} empty="No covered persons." />}
              {tab === 'Adjust History' && (
                <Loading query={adjustments}>{() => <DataTable columns={adjustmentColumns} rows={adjustments.data!} />}</Loading>
              )}
              {tab === 'Current Case' && <Loading query={cases}>{() => <DataTable columns={caseColumns} rows={cases.data!} />}</Loading>}
              {tab === 'Case History' && (
                <Loading query={caseHistory}>{() => <DataTable columns={caseColumns} rows={caseHistory.data!} />}</Loading>
              )}
              {tab === 'Mem History' && (
                <Loading query={memHistory}>
                  {() => (
                    <>
                      <h4>As principal</h4>
                      <DataTable columns={historyColumns} rows={memHistory.data!.principal} />
                      <h4>As covered person</h4>
                      <DataTable columns={suppHistoryColumns} rows={memHistory.data!.supplementary} />
                    </>
                  )}
                </Loading>
              )}
              {tab === 'Account' && <Loading query={account}>{() => <DataTable columns={accountColumns} rows={account.data!} />}</Loading>}
              {tab === 'Notes' && (
                <Loading query={notes}>
                  {() => (
                    <>
                      <h4>Exclusions</h4>
                      <DataTable
                        columns={[
                          { key: 'MBMNumber', label: 'Membership No' },
                          { key: 'INSCode', label: 'Insurer' },
                          { key: 'MBMExclusion', label: 'Exclusion' },
                        ]}
                        rows={notes.data!.exclusions.filter((r) => r.MBMExclusion)}
                      />
                      <h4>Remarks</h4>
                      <DataTable
                        columns={[
                          { key: 'MBMNumber', label: 'Membership No' },
                          { key: 'MBMTakeover', label: 'Takeover' },
                          { key: 'MBMRemarks', label: 'Remarks' },
                        ]}
                        rows={notes.data!.remarks.filter((r) => r.MBMRemarks)}
                      />
                    </>
                  )}
                </Loading>
              )}
              {tab === 'All Fields' && (
                <FieldGrid fields={Object.keys(d.principal).map((k) => ({ label: k, key: k }))} row={d.principal} />
              )}
            </div>
          </div>
        )
      }}
    </Loading>
  )
}

export function EnquiryPage() {
  const [by, setBy] = useState<SearchBy>('number')
  const [input, setInput] = useState('')
  const [criteria, setCriteria] = useState<{ by: SearchBy; q: string } | null>(null)
  const [selected, setSelected] = useState<string | null>(null)

  const search = useQuery({
    queryKey: ['membership-search', criteria],
    queryFn: async () => {
      const { data } = await api.get<Row[]>('/api/membership/search', { params: criteria })
      if (data.length === 1) setSelected(String(data[0].MBMNumber))
      return data
    },
    enabled: criteria !== null,
  })

  function submit(e: FormEvent) {
    e.preventDefault()
    setSelected(null)
    setCriteria({ by, q: input.trim() })
  }

  return (
    <section>
      <h2>Membership Enquiry</h2>
      <form className="search" onSubmit={submit}>
        <select value={by} onChange={(e) => setBy(e.target.value as SearchBy)} aria-label="Search by">
          <option value="number">Membership No</option>
          <option value="ic">IC/BC/PP</option>
          <option value="name">Name</option>
          <option value="policy">Policy No</option>
        </select>
        <input value={input} onChange={(e) => setInput(e.target.value)} placeholder="Enter at least 3 characters" aria-label="Search text" />
        <button type="submit" disabled={input.trim().length < 3}>
          Show
        </button>
      </form>
      {search.isFetching && <p className="muted">Searching…</p>}
      {search.error && <p className="error">{errorMessage(search.error)}</p>}
      {search.data && search.data.length !== 1 && (
        <>
          <p className="muted">
            {search.data.length} result(s){search.data.length >= 200 ? ' (first 200 shown, refine your search)' : ''}
          </p>
          <DataTable columns={searchColumns} rows={search.data} rowKey="MBMNumber" selectedKey={selected ?? undefined} onSelect={(r) => setSelected(String(r.MBMNumber))} />
        </>
      )}
      {selected && <MemberView key={selected} mbmNumber={selected} />}
    </section>
  )
}
