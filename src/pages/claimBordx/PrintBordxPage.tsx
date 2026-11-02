// Claim Bordx > Print Bordx (legacy FrmPrintBordx, "Print Bordx"): search the claims of a range of bordx and write the detail or summary report for the payor. Printing the detail report marks the bordx as
// printed; the previews and the summary report do not. The desktop printed Crystal reports; the web writes the same claims and totals to CSV files.

import { useState } from 'react'
import type { FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { yupResolver } from '@hookform/resolvers/yup'
import { SelectField } from '../../components/Field'
import { DataGrid } from '../../components/DataGrid'
import type { GridColumn } from '../../components/DataGrid'
import { ActionBar, PageShell, Stat } from '../../components/Screen'
import { Button } from '../../components/Button'
import { downloadCsv, downloadCsvRows } from '../../lib/exportCsv'
import { formatMoney } from '../../lib/format'
import { notify } from '../../lib/notifyStore'
import { api, errorMessage } from '../../api/client'
import { TextRange } from '../worksheet/RangeFields'
import {
  btbgOptions,
  detailRows,
  printColumns,
  printDefaults,
  printOptionOptions,
  printRequest,
  printSchema,
  reportTypeOptions,
  searchParams,
  searchProblem,
  summaryRows,
} from './printBordxRules'
import type { PrintDocument, PrintRow, PrintSearchResult, PrintValues } from './printBordxRules'

const base = '/api/claim-bordx/print-bordx'
const columns: GridColumn<PrintRow>[] = printColumns.map((c, i) => ({
  key: `c${i}`,
  label: c.label,
  value: c.value,
  align: /Amt|Fee/.test(c.label) ? 'right' : undefined,
}))

export function PrintBordxPage() {
  const navigate = useNavigate()
  const [busy, setBusy] = useState(false)
  const [result, setResult] = useState<PrintSearchResult | null>(null)
  const form = useForm<PrintValues>({ resolver: yupResolver(printSchema), defaultValues: printDefaults, mode: 'onTouched' })

  async function run(work: () => Promise<void>) {
    setBusy(true)
    try {
      await work()
    } catch (e) {
      notify(errorMessage(e), 'error')
      setResult(null)
    } finally {
      setBusy(false)
    }
  }

  async function load(v: PrintValues) {
    const { data } = await api.get<PrintSearchResult>(base, { params: searchParams(v) })
    setResult(data)
    form.setValue('printOption', data.printOption)
    if (data.truncated) notify('Only the first 5,000 claims are shown. Narrow the range to see the rest.', 'info')
  }

  /** CmdSearch_Click: both ends of the range are needed. */
  const search = form.handleSubmit((v) => {
    const problem = searchProblem(v)
    if (problem) {
      form.setError(problem.field, { message: problem.message })
      return form.setFocus(problem.field)
    }
    return run(() => load(v))
  })

  /** Detail Preview / Print Detail / Summary Preview / Print Summary. */
  function report(kind: 'detail' | 'summary', print: boolean) {
    const v = form.getValues()
    return run(async () => {
      const { data } = await api.post<PrintDocument>(`${base}/print`, printRequest(v, kind, print))
      downloadCsvRows(`claim-bordx-${kind}-${data.bordxFrom}-${data.bordxTo}.csv`, kind === 'detail' ? detailRows(data) : summaryRows(data))
      if (data.marked) {
        notify('The bordx are marked as printed.', 'success')
        await load(v)
      }
    })
  }

  function clear() {
    form.reset(printDefaults)
    setResult(null)
  }

  const listed = result !== null && result.rows.length > 0
  const off = busy || !listed

  return (
    <PageShell title="Print Bordx" subtitle="Print the bordx of a payor.">
      <form onSubmit={(e: FormEvent) => void search(e)} noValidate className="screen-form">
        <fieldset>
          <legend>Enter Criteria For Searching</legend>
          <TextRange label="Bordx No" from="bordxFrom" to="bordxTo" maxLength={40} register={form.register} errors={form.formState.errors} />
          <SelectField label="Report Type" blank={false} options={reportTypeOptions} {...form.register('reportType')} />
          <SelectField label="BTBG Status" blank={false} options={btbgOptions} {...form.register('btbg')} />
          <SelectField label="Print Status" blank={false} options={printOptionOptions} {...form.register('printOption')} />
        </fieldset>
      </form>

      <DataGrid
        caption="Print bordx"
        columns={columns}
        rows={result?.rows ?? []}
        rowKey={(r) => `${r.bordxNo}|${r.caseNo}|${r.claimVersion}|${r.hospital}|${r.totalApproved}`}
        tall
        empty="No claims. Enter the bordx range and press Search."
      />

      <ActionBar label="Print bordx actions">
        <Button variant="primary" onClick={() => void search()} busy={busy} busyLabel="Working…">
          Search
        </Button>
        <Button variant="ghost" onClick={() => void report('detail', false)} disabled={off}>
          Detail Preview
        </Button>
        <Button variant="ghost" onClick={() => void report('summary', false)} disabled={off}>
          Summary Preview
        </Button>
        <Button variant="ghost" onClick={() => void report('detail', true)} disabled={off}>
          Print Detail
        </Button>
        <Button variant="ghost" onClick={() => void report('summary', true)} disabled={off}>
          Print Summary
        </Button>
        <Button variant="ghost" onClick={() => downloadCsv('print-bordx-listing.csv', printColumns, result?.rows ?? [])} disabled={off}>
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
