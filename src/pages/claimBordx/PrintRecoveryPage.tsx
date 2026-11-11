// Claim Bordx > Print Recovery (legacy frmGenerateRecovery, "Generate Recovery Listing"): the recoveries (worksheets whose amount payable by the member is negative) of a BTBG client, listed by bordx
// and worksheet dates, and written to the recovery listing the client is sent. Read only.

import { useState } from 'react'
import type { FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { yupResolver } from '@hookform/resolvers/yup'
import { ComboField } from '../../components/Field'
import { DataGrid } from '../../components/DataGrid'
import type { GridColumn } from '../../components/DataGrid'
import { ActionBar, PageShell, Stat } from '../../components/Screen'
import { Button } from '../../components/Button'
import { downloadCsvRows } from '../../lib/exportCsv'
import { formatMoney } from '../../lib/format'
import { notify } from '../../lib/notifyStore'
import { api, errorMessage } from '../../api/client'
import { DateRange, TextRange } from '../worksheet/RangeFields'
import { listingRows, recoveryDefaults, recoveryListColumns, recoveryParams, recoveryProblem, recoverySchema, shownRecovery } from './printRecoveryRules'
import type { RecoveryCompany, RecoveryResult, RecoveryRow, RecoveryValues } from './printRecoveryRules'

const base = '/api/claim-bordx/recovery'

const columns: GridColumn<RecoveryRow>[] = recoveryListColumns.map((c, i) => ({
  key: ['caseNo', 'patientName', 'memberNo', 'hospital', 'actualAmount', 'recovery', 'bordxAmount', 'bordxNo'][i],
  label: c.label,
  align: i >= 4 && i <= 6 ? 'right' : undefined,
  value: (r) => c.value(r),
  sortBy: i === 4 ? (r) => r.actualAmount ?? 0 : i === 5 ? (r) => shownRecovery(r.recovery) ?? 0 : i === 6 ? (r) => r.bordxAmount ?? 0 : undefined,
}))

export function PrintRecoveryPage() {
  const navigate = useNavigate()
  const companies = useQuery({
    queryKey: ['recovery', 'companies'],
    queryFn: async () => (await api.get<RecoveryCompany[]>(`${base}/companies`)).data,
    staleTime: 10 * 60 * 1000,
  })
  const [busy, setBusy] = useState(false)
  const [result, setResult] = useState<RecoveryResult | null>(null)
  const form = useForm<RecoveryValues>({ resolver: yupResolver(recoverySchema), defaultValues: recoveryDefaults, mode: 'onTouched' })

  /** CmdSearch_Click. */
  const search = form.handleSubmit(async (v) => {
    const problem = recoveryProblem(v)
    if (problem) {
      form.setError('company', { message: problem })
      return form.setFocus('company')
    }
    setBusy(true)
    try {
      const { data } = await api.get<RecoveryResult>(base, { params: recoveryParams(v), timeout: 300000 })
      setResult(data)
      if (data.rows.length === 0) notify('No record found ', 'error')
      else if (data.truncated) notify('Only the first 5,000 rows are shown. Narrow the search to see the rest.', 'info')
    } catch (e) {
      notify(errorMessage(e), 'error')
    } finally {
      setBusy(false)
    }
  })

  /** cmdPrintDetails_Click: the recovery listing of the rows searched (the desktop filled an Excel template). */
  function print() {
    if (!result || result.rows.length === 0) return notify('Report cannot be printed without any record.', 'info')
    const now = new Date()
    const today = `${String(now.getDate()).padStart(2, '0')}/${String(now.getMonth() + 1).padStart(2, '0')}/${now.getFullYear()}`
    downloadCsvRows(
      `recovery-listing-${form
        .getValues('company')
        .trim()
        .replace(/[^A-Za-z0-9]+/g, '-')}.csv`,
      listingRows(result, today),
    )
  }

  function clear() {
    form.reset(recoveryDefaults)
    setResult(null)
  }

  return (
    <PageShell title="Generate Recovery Listing" subtitle="The recoveries of a BTBG client, for the recovery listing it is sent.">
      <form onSubmit={(e: FormEvent) => void search(e)} noValidate className="screen-form">
        <fieldset>
          <legend>Selection criteria</legend>
          <ComboField
            label="Grp Company"
            required
            options={(companies.data ?? []).map((c) => ({ value: c.name, label: c.name }))}
            error={form.formState.errors.company}
            {...form.register('company', { onChange: () => setResult(null) })}
          />
          <TextRange label="Bordx No" from="bordxFrom" to="bordxTo" maxLength={40} register={form.register} errors={form.formState.errors} />
          <DateRange label="Bordx Date" from="bordxDateFrom" to="bordxDateTo" control={form.control} register={form.register} />
          <DateRange label="WS Reg Date" from="openFrom" to="openTo" control={form.control} register={form.register} />
        </fieldset>
      </form>

      <DataGrid
        caption="Recoveries"
        columns={columns}
        rows={result?.rows ?? []}
        rowKey={(r) => `${r.caseNo}-${r.claimVersion}`}
        tall
        empty="No recoveries. Choose a group company and press Search."
      />

      <ActionBar label="Recovery listing actions">
        <Button variant="primary" onClick={() => void search()} busy={busy} busyLabel="Searching…">
          Search
        </Button>
        <Button variant="ghost" onClick={print} disabled={!result || result.rows.length === 0}>
          Print
        </Button>
        <Button variant="link" onClick={clear}>
          Clear
        </Button>
        <span className="spacer" />
        <Stat label="Records" value={result?.rows.length ?? 0} />
        <Stat label="Total Amt" value={formatMoney(result?.totalBordxAmount ?? 0)} />
        <Button variant="link" onClick={() => navigate('/')}>
          Close
        </Button>
      </ActionBar>
    </PageShell>
  )
}
