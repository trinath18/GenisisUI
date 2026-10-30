// Claim Bordx > Monitoring > Bordx Control (legacy FrmBordxControl, "Bordx Control"): follow the bordereaux of a payor, or of all the Sihat or all the non-Sihat payors, from the day they were sent
// to the day the documents and the money came back. Read only. Sihat payors are followed through MNRB; the others straight to the payor.

import { useState } from 'react'
import type { FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { useForm, useWatch } from 'react-hook-form'
import { yupResolver } from '@hookform/resolvers/yup'
import { ComboField, SelectField } from '../../components/Field'
import { DataGrid } from '../../components/DataGrid'
import type { GridColumn } from '../../components/DataGrid'
import { ActionBar, PageShell, Stat } from '../../components/Screen'
import { Button } from '../../components/Button'
import { downloadCsv } from '../../lib/exportCsv'
import { formatMoney } from '../../lib/format'
import { notify } from '../../lib/notifyStore'
import { api, errorMessage } from '../../api/client'
import { isoToDmy } from '../case/caseShared'
import { DateRange, TextRange } from '../worksheet/RangeFields'
import {
  ALL_NON_SIHAT,
  ALL_SIHAT,
  controlColumns,
  controlDefaults,
  controlParams,
  controlProblem,
  controlSchema,
  kindOf,
  mnrbToOptions,
  moneyFromOptions,
  payDocOptions,
  payToOptions,
  scopeOf,
} from './bordxControlRules'
import type { ControlPayor, ControlResult, ControlRow, ControlValues } from './bordxControlRules'

const base = '/api/claim-bordx/control'

const dateCol = (key: keyof ControlRow & string, label: string): GridColumn<ControlRow> => ({
  key,
  label,
  value: (r) => isoToDmy(r[key] as string | null),
  sortBy: (r) => String(r[key] ?? ''),
})

/** The grid columns of a layout, with the same headings as the file. */
function gridColumns(kind: 'S' | 'N', withPayor: boolean): GridColumn<ControlRow>[] {
  const common: GridColumn<ControlRow>[] = [
    ...(withPayor ? [{ key: 'payorCode', label: 'Payor' }] : []),
    { key: 'bordxNo', label: 'Bordx No' },
    dateCol('bordxDate', 'Bordx Date'),
    { key: 'claims', label: 'No of Claims', align: 'right' },
    { key: 'amount', label: 'Bordx Amt', align: 'right', value: (r) => (r.amount == null ? '' : formatMoney(r.amount)), sortBy: (r) => r.amount ?? 0 },
    { key: 'status', label: 'Bordx Status', align: 'center' },
    dateCol('sentToPayor', 'DTP'),
    dateCol('docReceived', 'DRP (Doc)'),
    { key: 'days', label: 'No of Days (DRP - DTP)', align: 'right' },
  ]
  return kind === 'S'
    ? [
        ...common,
        dateCol('sentToMnrb', 'DTMNRB'),
        dateCol('moneyFromMnrb', 'DFMNRB (Money)'),
        { key: 'days2', label: 'No of Days (Date Fr MNRB - Date to MNRB)', align: 'right' },
        { key: 'totalDays', label: 'Total Days', align: 'right' },
      ]
    : [...common, dateCol('moneyFromPayor', 'DFPayor (Money)'), { key: 'days2', label: 'No of Days (DTP - DPayment)', align: 'right' }]
}

export function BordxControlPage() {
  const navigate = useNavigate()
  const payors = useQuery({
    queryKey: ['bordx-control', 'payors'],
    queryFn: async () => (await api.get<ControlPayor[]>(`${base}/payors`)).data,
    staleTime: 10 * 60 * 1000,
  })
  const payorOptions = [
    { value: ALL_SIHAT, label: ALL_SIHAT },
    { value: ALL_NON_SIHAT, label: ALL_NON_SIHAT },
    ...(payors.data ?? []).map((p) => ({ value: `${p.code} - ${p.name ?? ''}`.trim(), label: `${p.code} - ${p.name ?? ''}`.trim() })),
  ]

  const [busy, setBusy] = useState(false)
  const [result, setResult] = useState<ControlResult | null>(null)
  const [withPayor, setWithPayor] = useState(false)
  const form = useForm<ControlValues>({ resolver: yupResolver(controlSchema), defaultValues: controlDefaults, mode: 'onTouched' })
  const payor = useWatch({ control: form.control, name: 'payor' })
  const kind = kindOf(payor, payors.data ?? [])

  /** cmdSearch_Click. */
  const search = form.handleSubmit(async (v) => {
    const problem = controlProblem(v)
    if (problem) {
      form.setError('payor', { message: problem })
      return form.setFocus('payor')
    }
    setBusy(true)
    try {
      const { data } = await api.get<ControlResult>(base, { params: controlParams(v) })
      setResult(data)
      setWithPayor(scopeOf(v.payor) !== 'payor')
      if (data.rows.length === 0) notify('No record found!', 'error')
      else if (data.truncated) notify('Only the first 5,000 rows are shown. Narrow the search to see the rest.', 'info')
    } catch (e) {
      notify(errorMessage(e), 'error')
    } finally {
      setBusy(false)
    }
  })

  /** CmdPrintFile_Click. */
  function print() {
    if (!result || result.rows.length === 0) return notify('Report cannot be printed without any record.', 'info')
    downloadCsv('bordx-control.csv', controlColumns(result.kind, withPayor), result.rows)
  }

  function clear() {
    form.reset(controlDefaults)
    setResult(null)
  }

  return (
    <PageShell title="Bordx Control" subtitle="Follow the bordereaux from the day they were sent to the day the documents and the money came back.">
      <form onSubmit={(e: FormEvent) => void search(e)} noValidate className="screen-form">
        <fieldset>
          <legend>Selection criteria</legend>
          <ComboField
            label="Payor"
            required
            options={payorOptions}
            error={form.formState.errors.payor}
            {...form.register('payor', { onChange: () => setResult(null) })}
          />
          <TextRange label="Bordx No" from="bordxFrom" to="bordxTo" maxLength={40} register={form.register} errors={form.formState.errors} />
          <DateRange label="Bordx Date" from="dateFrom" to="dateTo" control={form.control} register={form.register} />
          <SelectField label="To Payor" options={payToOptions} {...form.register('payTo')} />
          <SelectField label="From Payor (Doc)" options={payDocOptions} {...form.register('payDocFr')} />
          {kind !== 'N' && <SelectField label="To MNRB" blank={false} options={mnrbToOptions} {...form.register('mnrbTo')} />}
          {kind !== 'N' && <SelectField label="From MNRB (Money)" options={moneyFromOptions} {...form.register('mnrbFr')} />}
          {kind !== 'S' && <SelectField label="From Payor (Money)" options={moneyFromOptions} {...form.register('payFr')} />}
        </fieldset>
      </form>

      <DataGrid
        caption="Bordereaux"
        columns={gridColumns(result?.kind ?? kind ?? 'N', withPayor)}
        rows={result?.rows ?? []}
        rowKey={(r) => `${r.payorCode}|${r.bordxNo}|${r.amount}`}
        tall
        empty="No bordereaux. Choose a payor and press Search."
      />

      <ActionBar label="Bordx control actions">
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
        <Stat label="Records" value={result?.rows.length ?? 0} />
        <Stat label="Total Amt" value={formatMoney(result?.totalAmount ?? 0)} />
        <Button variant="link" onClick={() => navigate('/')}>
          Close
        </Button>
      </ActionBar>
    </PageShell>
  )
}
