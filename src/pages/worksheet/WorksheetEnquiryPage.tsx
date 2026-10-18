// Worksheet > Worksheet Enquiry (legacy frmWorksheetEnq, "Worksheet Enquiry"): pick a case and a version of its worksheet and see the
// saved worksheet read-only: member and case details, invoices, the benefit grid with the saved figures, not-covered items, top-up,
// remarks and guarantee letters. The desktop form was also the Adjustment editor; here nothing can be changed.

import { useState } from 'react'
import type { FormEvent } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { Access, useAuth } from '../../auth/access'
import { Button } from '../../components/Button'
import { ReadField, SelectField, TextField } from '../../components/Field'
import { ActionBar, PageShell, Stat } from '../../components/Screen'
import { Tabs } from '../../components/Tabs'
import { downloadCsv } from '../../lib/exportCsv'
import type { CsvColumn } from '../../lib/exportCsv'
import { notify } from '../../lib/notifyStore'
import { isScanCode, resolveScanCode } from '../../lib/scanCodes'
import { api, errorMessage } from '../../api/client'
import { EnquiryCaseDialog } from './EnquiryCaseDialog'
import { InvoicesTab, LgTab, NotCoveredTab, PaymentPanel, RemarksTab, TopupTab, WorksheetTab } from './EnquiryTabs'
import { amountText, claimTypeOptions, disabilityText, exGratiaOptions, showsBordxInd, summaryRows, versionOptions } from './enquiryRules'
import type { EnquiryBenefit, EnquiryResult } from './enquiryRules'

const TABS = ['Invoices & Diagnosis', 'Worksheet', 'Reimbursement Not Cover', 'Topup', 'Remarks', 'LG Listing'] as const

interface Request {
  cas: string
  version: string
  claimType: string
}

async function load({ cas, version, claimType }: Request) {
  return (await api.get<EnquiryResult>(`/api/worksheet/enquiry/${encodeURIComponent(cas)}`, { params: { version, claimType } })).data
}

const exportColumns: CsvColumn<Record<string, string>>[] = [
  { label: 'Benefits', value: (r) => r.benefit },
  { label: 'Days/Mths', value: (r) => r.days },
  { label: 'Limit', value: (r) => r.limit },
  { label: 'Actual', value: (r) => r.actual },
  { label: 'Approved', value: (r) => r.approved },
  { label: 'Payable to Hosp', value: (r) => r.hospital },
  { label: 'Due to/(frm) Mem', value: (r) => r.member },
]

/** CmdExport_Click wrote the worksheet to Excel; this is the benefit grid and the saved summary as a CSV Excel opens. */
function exportRows(result: EnquiryResult) {
  const line = (b: EnquiryBenefit) => ({
    benefit: b.benefit,
    days: b.days ?? '',
    limit: amountText(b.limit),
    actual: amountText(b.actual),
    approved: amountText(b.approved),
    hospital: amountText(b.hospital),
    member: amountText(b.member),
  })
  const t = result.totals
  const total = {
    benefit: 'Total',
    days: '',
    limit: '',
    actual: amountText(t.actual),
    approved: amountText(t.approved),
    hospital: amountText(t.hospital),
    member: amountText(t.member),
  }
  const summary = summaryRows(result.summary, result.header).map((r) => ({
    benefit: r.label,
    days: '',
    limit: '',
    actual: '',
    approved: r.value,
    hospital: '',
    member: '',
  }))
  return [...result.benefits.map(line), total, ...summary]
}

export function WorksheetEnquiryPage() {
  const navigate = useNavigate()
  const { hasAccess } = useAuth()
  const [params] = useSearchParams()
  const first = params.get('cas')?.trim() ?? ''
  const [caseNo, setCaseNo] = useState(first)
  const [claimType, setClaimType] = useState('B')
  const [tab, setTab] = useState(0)
  const [searching, setSearching] = useState(false)
  const [request, setRequest] = useState<Request | null>(first ? { cas: first, version: '', claimType: 'B' } : null)
  const [problem, setProblem] = useState('')

  const enquiry = useQuery({
    queryKey: ['worksheet-enquiry', request],
    queryFn: () => load(request!),
    enabled: request !== null,
    retry: false,
    placeholderData: keepPreviousData,
  })
  const result = request ? enquiry.data : undefined
  const version = request?.version || result?.selectedVersion || '1'
  const isMaster = version === 'Master'
  const header = result?.header
  const { disability, icdCodes } = disabilityText(result?.diagnoses ?? [])

  /** cmdDisplay_Click: a scan code opens another screen; otherwise the case is loaded at the version chosen. */
  function go(e?: FormEvent) {
    e?.preventDefault()
    const cas = caseNo.trim()
    if (cas === '') return setProblem('Please select a Case Number !')
    setProblem('')
    if (isScanCode(cas)) {
      const outcome = resolveScanCode(cas)
      setCaseNo('')
      if (outcome.kind === 'open') return navigate(outcome.route)
      return notify(outcome.kind === 'notMigrated' ? `${outcome.label} has not been migrated yet.` : `Unknown scan code ${outcome.code}.`, 'error')
    }
    setRequest({ cas, version: request?.cas === cas ? version : '', claimType: isMaster ? 'B' : claimType })
  }

  /** cboVersion_Click: Master cannot be filtered by claim type or exported. */
  function chooseVersion(next: string) {
    if (!request) return
    const type = next === 'Master' ? 'B' : claimType
    setClaimType(type)
    setRequest({ ...request, version: next, claimType: type })
  }

  function chooseClaimType(next: string) {
    setClaimType(next)
    if (request) setRequest({ ...request, claimType: next })
  }

  function pick(cas: string) {
    setSearching(false)
    setCaseNo(cas)
    setProblem('')
    setRequest({ cas, version: '', claimType })
  }

  function exportWorksheet() {
    if (result) downloadCsv(`worksheet-${result.header.caseNo}-${result.selectedVersion}.csv`, exportColumns, exportRows(result))
  }

  const panels = result
    ? [
        <InvoicesTab key="invoices" result={result} disability={disability} icdCodes={icdCodes} />,
        <WorksheetTab key="worksheet" result={result} />,
        <NotCoveredTab key="notcovered" invoices={result.invoices} />,
        <TopupTab key="topup" header={result.header} />,
        <RemarksTab key="remarks" others={result.others} />,
        <LgTab key="lg" header={result.header} rows={result.lgListing} />,
      ]
    : []

  return (
    <PageShell title="Worksheet Enquiry" subtitle="Show a case's saved worksheet. Nothing can be changed here.">
      <form onSubmit={go} noValidate className="screen-form">
        <fieldset>
          <legend>Case</legend>
          <TextField
            label="Case Num"
            maxLength={15}
            autoFocus
            value={caseNo}
            error={problem ? { type: 'required', message: problem } : undefined}
            onChange={(e) => setCaseNo(e.target.value)}
          />
          <SelectField
            label="Version"
            blank={false}
            options={versionOptions(result?.versions ?? [])}
            value={version}
            onChange={(e) => chooseVersion(e.target.value)}
          />
          <SelectField
            label="Clm Type"
            blank={false}
            options={claimTypeOptions}
            value={claimType}
            disabled={isMaster}
            onChange={(e) => chooseClaimType(e.target.value)}
            hint="Filters the invoice list."
          />
          <ReadField label="WS CLM" value={header?.worksheetStatusText ?? ''} />
          <ReadField label="Ex-Gratia" value={exGratiaOptions[(header?.exGratia ?? '').trim()] ?? ''} />
        </fieldset>

        <ActionBar label="Worksheet enquiry actions">
          <Button variant="primary" type="submit" busy={enquiry.isFetching} busyLabel="Loading…">
            Go
          </Button>
          <Button variant="ghost" onClick={() => setSearching(true)}>
            Search
          </Button>
          {hasAccess(Access.CaseEnquiry) && (
            <Button variant="ghost" disabled={!header} onClick={() => navigate(`/case/enquiry?cas=${encodeURIComponent(header!.caseNo)}`)}>
              Case Enq
            </Button>
          )}
          {hasAccess(Access.MembershipEnquiry) && (
            <Button variant="ghost" disabled={!header?.memberNo} onClick={() => navigate(`/membership/enquiry?mbm=${encodeURIComponent(header!.memberNo!)}`)}>
              MBM Enq
            </Button>
          )}
          <Button variant="ghost" disabled={!result || isMaster} onClick={exportWorksheet}>
            Export
          </Button>
          <span className="spacer" />
          <Stat label="Versions" value={result?.versions.length ?? 0} />
          <Stat label="Invoices" value={result?.invoices.length ?? 0} />
          <Button variant="link" onClick={() => navigate('/')}>
            Close
          </Button>
        </ActionBar>
      </form>

      {request && enquiry.error && (
        <p role="alert" className="error">
          {errorMessage(enquiry.error)}
        </p>
      )}
      {result && (
        <>
          {result.notices.map((n) => (
            <p key={n} role="status" className="muted">
              {n}
            </p>
          ))}
          <Tabs label="Worksheet sections" tabs={TABS} panels={panels} active={tab} onChange={setTab} />
          <PaymentPanel header={result.header} others={result.others} showBordxInd={showsBordxInd(result.header.payor)} />
        </>
      )}
      {searching && <EnquiryCaseDialog onPick={pick} onClose={() => setSearching(false)} />}
    </PageShell>
  )
}
