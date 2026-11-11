// Claim Bordx > Monitoring > Outstanding Bordx (legacy FrmOSBordx, "Outstanding Bordx"): the bordereaux that were sent and have not come back, and for how long. Read only. One payor shows the lists
// its layout needs (Sihat: Bordx with Payor and Not Paid by MNRB; the others: one list); All Sihat and All Non-Sihat show every payor; the general summaries total each payor.

import { useState } from 'react'
import type { FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { yupResolver } from '@hookform/resolvers/yup'
import { ComboField, DateField, SelectField } from '../../components/Field'
import { DataGrid } from '../../components/DataGrid'
import type { GridColumn } from '../../components/DataGrid'
import { ActionBar, PageShell, Stat } from '../../components/Screen'
import { Button } from '../../components/Button'
import { downloadCsvRows } from '../../lib/exportCsv'
import { formatMoney } from '../../lib/format'
import { notify } from '../../lib/notifyStore'
import { api, errorMessage } from '../../api/client'
import { ALL_NON_SIHAT, ALL_SIHAT } from './bordxControlRules'
import type { ControlPayor } from './bordxControlRules'
import {
  modeOptions,
  outstandingColumns,
  outstandingCsvRows,
  outstandingDefaults,
  outstandingParams,
  outstandingProblem,
  outstandingSchema,
} from './outstandingBordxRules'
import type { OutstandingResult, OutstandingRow, OutstandingSection, OutstandingValues } from './outstandingBordxRules'

const base = '/api/claim-bordx/outstanding'

/** The grid columns of a list: the same headings as the file, money right-aligned. */
function gridColumns(section: OutstandingSection['key'], summary: boolean): GridColumn<OutstandingRow>[] {
  const sorting: Record<string, (r: OutstandingRow) => number> = {
    Amount: (r) => r.amount ?? 0,
    'Bordx <14 days': (r) => r.within14 ?? 0,
    'Bordx >14 days': (r) => r.over14 ?? 0,
  }
  const keys = summary ? ['item', 'payorCode', 'claims', 'amount'] : ['item', 'bordxNo', 'payorCode', 'amount', 'sentDate', 'days', 'within14', 'over14']
  const numeric = new Set(['item', 'claims', 'amount', 'days', 'within14', 'over14'])
  return outstandingColumns(section, summary).map((c, i) => ({
    key: keys[i],
    label: c.label,
    align: numeric.has(keys[i]) ? 'right' : undefined,
    value: (r) => c.value(r),
    sortBy: sorting[c.label],
  }))
}

export function OutstandingBordxPage() {
  const navigate = useNavigate()
  const payors = useQuery({
    queryKey: ['outstanding-bordx', 'payors'],
    queryFn: async () => (await api.get<ControlPayor[]>(`${base}/payors`)).data,
    staleTime: 10 * 60 * 1000,
  })
  const payorOptions = [
    { value: ALL_SIHAT, label: ALL_SIHAT },
    { value: ALL_NON_SIHAT, label: ALL_NON_SIHAT },
    ...(payors.data ?? []).map((p) => ({ value: `${p.code} - ${p.name ?? ''}`.trim(), label: `${p.code} - ${p.name ?? ''}`.trim() })),
  ]

  const [busy, setBusy] = useState(false)
  const [result, setResult] = useState<OutstandingResult | null>(null)
  const [today] = useState(() => new Date())
  const form = useForm<OutstandingValues>({ resolver: yupResolver(outstandingSchema), defaultValues: outstandingDefaults(today), mode: 'onTouched' })

  /** cmdSearch_Click. */
  const search = form.handleSubmit(async (v) => {
    const problem = outstandingProblem(v)
    if (problem) {
      form.setError('payor', { message: problem })
      return form.setFocus('payor')
    }
    setBusy(true)
    try {
      const { data } = await api.get<OutstandingResult>(base, { params: outstandingParams(v) })
      setResult(data)
      if (data.sections.every((s) => s.rows.length === 0)) notify('No record found for Payor!', 'error')
      else if (data.truncated) notify('Only the first 5,000 rows of a list are shown. Narrow the search to see the rest.', 'info')
    } catch (e) {
      notify(errorMessage(e), 'error')
    } finally {
      setBusy(false)
    }
  })

  /** CmdPrint_Click (the desktop wrote an Excel sheet). */
  function print() {
    if (!result || result.sections.every((s) => s.rows.length === 0)) return notify('Report cannot be printed without any record.', 'info')
    downloadCsvRows('outstanding-bordx.csv', outstandingCsvRows(result))
  }

  function clear() {
    form.reset(outstandingDefaults(new Date()))
    setResult(null)
  }

  const summary = result ? result.mode !== 'detail' : false

  return (
    <PageShell title="Outstanding Bordx" subtitle="Bordereaux that were sent and have not come back, and for how long.">
      <form onSubmit={(e: FormEvent) => void search(e)} noValidate className="screen-form">
        <fieldset>
          <legend>Selection criteria</legend>
          <SelectField label="View" blank={false} options={modeOptions} {...form.register('mode', { onChange: () => setResult(null) })} />
          <ComboField
            label="Payor"
            options={payorOptions}
            error={form.formState.errors.payor}
            {...form.register('payor', { onChange: () => setResult(null) })}
          />
          <DateField control={form.control} name="asAt" label="Outstanding Bordereaux As At" />
        </fieldset>
      </form>

      {result?.sections.map((section) => (
        <section key={section.key} aria-label={section.title} className="result-section">
          <h3>{section.title}</h3>
          <DataGrid
            caption={section.title}
            columns={gridColumns(section.key, summary)}
            rows={section.rows}
            rowKey={(r) => `${r.item}`}
            empty="No bordereaux."
          />
          <div className="totals">
            <Stat label={`Sub-Total (${section.title})`} value={formatMoney(section.subTotal)} />
            {!summary && <Stat label={`Bordx <14 days (${section.title})`} value={formatMoney(section.within14)} />}
            {!summary && <Stat label={`Bordx >14 days (${section.title})`} value={formatMoney(section.over14)} />}
          </div>
        </section>
      ))}
      {!result && <p className="muted">Choose what to show and press Search.</p>}

      <ActionBar label="Outstanding bordx actions">
        <Button variant="primary" onClick={() => void search()} busy={busy} busyLabel="Searching…">
          Search
        </Button>
        <Button variant="ghost" onClick={print}>
          Print
        </Button>
        <Button variant="link" onClick={clear}>
          Clear
        </Button>
        <span className="spacer" />
        {result?.totalDue != null && <Stat label="Total Due" value={formatMoney(result.totalDue)} />}
        <Button variant="link" onClick={() => navigate('/')}>
          Close
        </Button>
      </ActionBar>
    </PageShell>
  )
}
