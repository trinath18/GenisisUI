// Receipt > Receipt Tracking (legacy FrmReceiptTracking, "Receipt Tracking"): follow the receipts that came in from members, payors and MNRB, listed by claim or summed by bordx, receipt number or
// payor. Read only. The desktop had twelve lists; here the kind of receipt and the layout are two choices over one search.

import { useState } from 'react'
import type { FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { useForm, useWatch } from 'react-hook-form'
import { yupResolver } from '@hookform/resolvers/yup'
import { ComboField, SelectField, TextField } from '../../components/Field'
import { DataGrid } from '../../components/DataGrid'
import type { GridColumn } from '../../components/DataGrid'
import { ActionBar, PageShell, Stat } from '../../components/Screen'
import { Button } from '../../components/Button'
import { downloadCsv } from '../../lib/exportCsv'
import { formatMoney } from '../../lib/format'
import { notify } from '../../lib/notifyStore'
import { api, errorMessage } from '../../api/client'
import { DateRange, TextRange } from '../worksheet/RangeFields'
import { useWorksheetLookups } from '../worksheet/useWorksheetLookups'
import { healthOptions, modeOptions, sourceOptions, trackingColumns, trackingDefaults, trackingParams, trackingSchema } from './receiptTrackingRules'
import type { DetailRow, SummaryRow, TrackingResult, TrackingValues } from './receiptTrackingRules'

const base = '/api/receipt/tracking'

/** The grid columns of a layout: the same headings as the file, money right-aligned. */
function gridColumns<T extends object>(
  columns: { label: string; value: (r: T) => string | number | null | undefined }[],
  moneyLabels: RegExp,
): GridColumn<T>[] {
  return columns.map((c, i) => ({ key: `c${i}`, label: c.label, value: c.value, align: moneyLabels.test(c.label) ? 'right' : undefined }))
}

export function ReceiptTrackingPage() {
  const navigate = useNavigate()
  const lookups = useWorksheetLookups()
  const [busy, setBusy] = useState(false)
  const [result, setResult] = useState<TrackingResult | null>(null)
  const form = useForm<TrackingValues>({ resolver: yupResolver(trackingSchema), defaultValues: trackingDefaults, mode: 'onTouched' })
  const [source, mode] = useWatch({ control: form.control, name: ['source', 'mode'] })

  /** CmdSearch_Click. */
  const search = form.handleSubmit(async (v) => {
    setBusy(true)
    try {
      const { data } = await api.get<TrackingResult>(base, { params: trackingParams(v), timeout: 300000 })
      setResult(data)
      if (data.count === 0) notify('No record found!', 'error')
      else if (data.truncated) notify('Only the first 5,000 rows are shown. Narrow the search to see the rest.', 'info')
    } catch (e) {
      notify(errorMessage(e), 'error')
    } finally {
      setBusy(false)
    }
  })

  /** cmdEXPtoExcel_Click. */
  function print() {
    if (!result || result.count === 0) return notify('Report cannot be printed without any record.', 'info')
    const columns = trackingColumns(result.source, result.mode)
    if (result.mode === 'claim') downloadCsv('receipt-tracking.csv', columns.detail, result.detail)
    else downloadCsv('receipt-tracking.csv', columns.summary, result.summary)
  }

  function clear() {
    form.reset({ ...trackingDefaults, source: form.getValues('source'), mode: form.getValues('mode') })
    setResult(null)
  }

  const shown = result ? trackingColumns(result.source, result.mode) : trackingColumns(source, mode)
  const detailMode = (result?.mode ?? mode) === 'claim'
  const detailOnly = mode === 'claim'

  return (
    <PageShell title="Receipt Tracking" subtitle="Receipts that came in from members, payors and MNRB.">
      <form onSubmit={(e: FormEvent) => void search(e)} noValidate className="screen-form">
        <fieldset>
          <legend>Selection criteria</legend>
          <SelectField label="Receipts from" blank={false} options={sourceOptions} {...form.register('source', { onChange: () => setResult(null) })} />
          <SelectField label="Reports Type" blank={false} options={modeOptions} {...form.register('mode', { onChange: () => setResult(null) })} />
          <SelectField label="Health Type" options={healthOptions} {...form.register('healthType')} />
          <ComboField label="Payor" options={lookups.payors} {...form.register('payor')} />
          {detailOnly && <TextField label="Mem No" {...form.register('memberNo')} />}
          {detailOnly && <TextField label="Mem Name" {...form.register('memberName')} />}
          {detailOnly && <TextRange label="CLM No" from="claimFrom" to="claimTo" register={form.register} errors={form.formState.errors} />}
          <TextRange label="Bordx No" from="bordxFrom" to="bordxTo" register={form.register} errors={form.formState.errors} />
          <TextRange label="Receipt No" from="receiptFrom" to="receiptTo" register={form.register} errors={form.formState.errors} />
          <DateRange label="Receipt Date" from="dateFrom" to="dateTo" control={form.control} register={form.register} />
          {detailOnly && (
            <TextRange label="A/C Period Mth" from="acMonthFrom" to="acMonthTo" maxLength={2} register={form.register} errors={form.formState.errors} />
          )}
          {detailOnly && (
            <TextRange label="A/C Period Yr" from="acYearFrom" to="acYearTo" maxLength={4} register={form.register} errors={form.formState.errors} />
          )}
          {detailOnly && <TextRange label="Debit Note" from="debitFrom" to="debitTo" register={form.register} errors={form.formState.errors} />}
          {detailOnly && <TextRange label="Amount" from="amountFrom" to="amountTo" register={form.register} errors={form.formState.errors} />}
        </fieldset>
      </form>

      {detailMode ? (
        <DataGrid<DetailRow>
          key={`d-${result?.source ?? source}`}
          caption="Receipts"
          columns={gridColumns(shown.detail, /Amount|Amt/)}
          rows={result?.detail ?? []}
          rowKey={(r) => `${r.receiptNo}|${r.caseNo}|${r.claimVersion}|${r.amount}|${r.memberNo}`}
          tall
          empty="No receipts. Choose the criteria and press Search."
        />
      ) : (
        <DataGrid<SummaryRow>
          key={`s-${result?.source ?? source}-${result?.mode ?? mode}`}
          caption="Receipts"
          columns={gridColumns(shown.summary, /Amt/)}
          rows={result?.summary ?? []}
          rowKey={(r) => `${r.key1}|${r.keyDate}`}
          tall
          empty="No receipts. Choose the criteria and press Search."
        />
      )}

      <ActionBar label="Receipt tracking actions">
        <Button variant="primary" onClick={() => void search()} busy={busy} busyLabel="Searching…">
          Search
        </Button>
        <Button variant="ghost" onClick={print}>
          Print to File
        </Button>
        <Button variant="link" onClick={clear}>
          Clear
        </Button>
        <span className="spacer" />
        <Stat label="Records" value={result?.count ?? 0} />
        <Stat label="Total Amt" value={formatMoney(result?.totalAmount ?? 0)} />
        <Button variant="link" onClick={() => navigate('/')}>
          Close
        </Button>
      </ActionBar>
    </PageShell>
  )
}
