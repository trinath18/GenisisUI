// Worksheet > Worksheet Registration, calculation step (legacy frmWorksheetRegGST2015): enter a case and see its worksheet worked out from the invoices and the patient's plan,
// row by row, beside what the desktop saved. Nothing is written: registering a new worksheet (entering invoices and saving) is not migrated yet.

import { useState } from 'react'
import type { FormEvent } from 'react'
import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { api, errorMessage } from '../../api/client'
import { Button } from '../../components/Button'
import { DataGrid } from '../../components/DataGrid'
import type { GridColumn } from '../../components/DataGrid'
import { ReadField, SelectField, TextField } from '../../components/Field'
import { ActionBar, PageShell } from '../../components/Screen'
import { amountText, moneyOrDash } from './enquiryRules'
import { daysText, differingRows, limitDiffers, summaryRows } from './registrationRules'
import type { CalculationLine, CalculationResult, SummaryRow } from './registrationRules'

interface Request {
  cas: string
  version: string
}

async function load({ cas, version }: Request) {
  return (await api.get<CalculationResult>(`/api/worksheet/calculation/${encodeURIComponent(cas)}`, { params: version ? { version } : {} })).data
}

const gridColumns: GridColumn<CalculationLine>[] = [
  { key: 'benefit', label: 'Benefits', value: (r) => r.benefit },
  { key: 'limit', label: 'Limit (plan)', value: (r) => r.limit ?? '-' },
  {
    key: 'savedLimit',
    label: 'Limit (saved)',
    value: (r) => r.savedLimit ?? '',
    render: (r) => (limitDiffers(r) ? <strong className="diff">{r.savedLimit}</strong> : (r.savedLimit ?? '')),
  },
  { key: 'actual', label: 'Actual', align: 'right', value: (r) => moneyOrDash(r.actual), sortBy: (r) => r.actual },
  { key: 'approved', label: 'Approved', align: 'right', value: (r) => moneyOrDash(r.approved), sortBy: (r) => r.approved },
  { key: 'toHospital', label: 'Payable to Hosp', align: 'right', value: (r) => moneyOrDash(r.toHospital), sortBy: (r) => r.toHospital },
  { key: 'toMember', label: 'Due to/(frm) Mem', align: 'right', value: (r) => moneyOrDash(r.toMember), sortBy: (r) => r.toMember },
]

const summaryColumns: GridColumn<SummaryRow>[] = [
  { key: 'label', label: 'Summary' },
  { key: 'calculated', label: 'Calculated', align: 'right' },
  {
    key: 'saved',
    label: 'Saved',
    align: 'right',
    render: (r) => (r.differs ? <strong className="diff">{r.saved}</strong> : r.saved),
  },
]

export function WorksheetRegistrationPage() {
  const [caseNo, setCaseNo] = useState('')
  const [error, setError] = useState('')
  const [request, setRequest] = useState<Request | null>(null)
  const calculation = useQuery({
    queryKey: ['worksheet-calculation', request],
    queryFn: () => load(request as Request),
    enabled: request !== null,
    retry: false,
    placeholderData: keepPreviousData,
  })
  const result = calculation.data

  const submit = (e: FormEvent) => {
    e.preventDefault()
    if (!caseNo.trim()) {
      setError('Please enter Case Number!')
      return
    }
    setError('')
    setRequest({ cas: caseNo.trim(), version: '' })
  }

  const differing = result ? differingRows(result.lines) : []

  return (
    <PageShell title="Worksheet Registration" subtitle="Calculate a worksheet from its invoices and the plan, and compare it with what was saved">
      <p role="status" className="muted">
        This page works a saved worksheet out again from its invoices and the patient&apos;s plan. Entering the invoices of a new worksheet and saving it are
        not available yet, so nothing is written here.
      </p>
      <form onSubmit={submit} noValidate>
        <ActionBar label="Case">
          <TextField
            label="Case No"
            value={caseNo}
            onChange={(e) => setCaseNo(e.target.value)}
            error={error ? { type: 'required', message: error } : undefined}
            autoFocus
          />
          {result && (
            <SelectField
              label="Version"
              blank={false}
              value={String(result.version)}
              options={result.versions.map((v) => ({ value: String(v), label: String(v) }))}
              onChange={(e) => setRequest({ cas: result.caseNo, version: e.target.value })}
            />
          )}
          <Button type="submit" disabled={calculation.isFetching}>
            {calculation.isFetching ? 'Calculating…' : 'Calculate'}
          </Button>
        </ActionBar>
      </form>

      {request && calculation.error && (
        <p role="alert" className="error">
          {errorMessage(calculation.error)}
        </p>
      )}
      {result && (
        <>
          <div className="form-row">
            <ReadField label="Room & Board days" value={daysText(result.roomDays)} hint="summed over the invoices" />
            <ReadField label="ICU days" value={daysText(result.icuDays)} hint="summed over the invoices" />
          </div>
          {result.notes.map((n) => (
            <p key={n} role="status" className="muted">
              {n}
            </p>
          ))}
          {differing.length > 0 && (
            <p role="status" className="muted">
              {differing.length === 1 ? '1 row has' : `${differing.length} rows have`} a limit from the plan that differs from the saved one (in bold):{' '}
              {differing.map((r) => r.benefit).join(', ')}.
            </p>
          )}
          <DataGrid caption="Worksheet" columns={gridColumns} rows={result.lines} rowKey={(r) => String(r.slot)} tall />
          <DataGrid caption="Worksheet summary" columns={summaryColumns} rows={summaryRows(result.calculated, result.saved)} rowKey={(r) => r.label} />
          {result.calculated && result.saved === null && <p className="muted">No figures were saved with this version, so there is nothing to compare with.</p>}
          {result.calculated && <p className="muted">Amount due to the member: {amountText(result.lines.reduce((sum, l) => sum + l.toMember, 0))}</p>}
        </>
      )}
    </PageShell>
  )
}
