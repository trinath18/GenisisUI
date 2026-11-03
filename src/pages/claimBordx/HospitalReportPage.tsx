// Claim Bordx > Payment Advice > Hospital Report (legacy frmPayAdviceHosRpt, "Payment Advice- By Hospital"): search the claims of a range of bordx, pick one and write its payment advice (the payments to the
// hospitals, to the members, the recoveries, the staff claims and daily allowances), or write the CC Report (cost allocation). Read only; the reports are CSV files.

import { useState } from 'react'
import type { FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { yupResolver } from '@hookform/resolvers/yup'
import { TextField } from '../../components/Field'
import { DataGrid } from '../../components/DataGrid'
import type { GridColumn } from '../../components/DataGrid'
import { ActionBar, PageShell, Stat } from '../../components/Screen'
import { Button } from '../../components/Button'
import { downloadCsvRows } from '../../lib/exportCsv'
import { formatMoney } from '../../lib/format'
import { notify } from '../../lib/notifyStore'
import { api, errorMessage } from '../../api/client'
import { DateRange, TextRange } from '../worksheet/RangeFields'
import { hospitalColumns, hospitalDefaults, hospitalParams, hospitalSchema, printProblem, rangeProblem, reportRows } from './hospitalReportRules'
import type { HospitalSearchResult, HospitalValues, ReportDocument } from './hospitalReportRules'
import type { PrintRow } from './printBordxRules'

const base = '/api/claim-bordx/hospital-report'
const columns: GridColumn<PrintRow>[] = hospitalColumns.map((c, i) => ({
  key: `c${i}`,
  label: c.label,
  value: c.value,
  align: /Amt|Fee/.test(c.label) ? 'right' : undefined,
}))

export function HospitalReportPage() {
  const navigate = useNavigate()
  const [busy, setBusy] = useState(false)
  const [result, setResult] = useState<HospitalSearchResult | null>(null)
  const [selected, setSelected] = useState<PrintRow | null>(null)
  const form = useForm<HospitalValues>({ resolver: yupResolver(hospitalSchema), defaultValues: hospitalDefaults, mode: 'onSubmit' })

  async function run(work: () => Promise<void>) {
    setBusy(true)
    try {
      await work()
    } catch (e) {
      notify(errorMessage(e), 'error')
    } finally {
      setBusy(false)
    }
  }

  /** CmdSearch_Click: both ends of the bordx range are needed. */
  const search = form.handleSubmit((v) => {
    const problem = rangeProblem(v)
    if (problem) {
      form.setError(problem.field, { message: problem.message })
      return form.setFocus(problem.field)
    }
    setSelected(null)
    return run(async () => {
      const { data } = await api.get<HospitalSearchResult>(`${base}/search`, { params: hospitalParams(v) })
      setResult(data)
      if (data.truncated) notify('Only the first 5,000 claims are shown. Narrow the range to see the rest.', 'info')
    })
  })

  /** CmdPrintSummary_Click: the payment advice of the bordx chosen in the list. */
  function printReport() {
    const v = form.getValues()
    const problem = printProblem(v, selected?.bordxNo ?? null)
    if (problem) return notify(problem, 'error')
    return run(async () => {
      const { data } = await api.get<ReportDocument>(`${base}/payment-advice`, { params: { bordxNo: selected!.bordxNo } })
      if (data.sections.length === 0) return notify('No payment advice for this bordx.', 'info')
      downloadCsvRows(`payment-advice-${data.name}.csv`, reportRows(data))
    })
  }

  /** cmdCCRpt_Click: the cost allocation of the bordx in the range. */
  function costCentreReport() {
    const v = form.getValues()
    return run(async () => {
      const { data } = await api.get<ReportDocument>(`${base}/cost-centre`, { params: hospitalParams(v) })
      downloadCsvRows('cc-report.csv', reportRows(data))
    })
  }

  function clear() {
    form.reset(hospitalDefaults)
    setResult(null)
    setSelected(null)
  }

  return (
    <PageShell title="Payment Advice - By Hospital" subtitle="Payment advice reports of a bordx.">
      <form onSubmit={(e: FormEvent) => void search(e)} noValidate className="screen-form">
        <fieldset>
          <legend>Enter Criteria For Searching</legend>
          <TextRange label="Bordx No" from="bordxFrom" to="bordxTo" maxLength={40} register={form.register} errors={form.formState.errors} />
          <TextField label="Hospital" maxLength={100} {...form.register('hospital')} />
          <DateRange label="Bordx Date" from="bordxDateFrom" to="bordxDateTo" control={form.control} register={form.register} />
          <DateRange label="DOA" from="doaFrom" to="doaTo" control={form.control} register={form.register} />
          <DateRange label="DOD" from="dodFrom" to="dodTo" control={form.control} register={form.register} />
        </fieldset>
      </form>

      <DataGrid
        caption="Payment advice bordx"
        columns={columns}
        rows={result?.rows ?? []}
        rowKey={(r) => `${r.bordxNo}|${r.caseNo}|${r.claimVersion}|${r.hospital}|${r.totalApproved}`}
        selectedKey={selected ? `${selected.bordxNo}|${selected.caseNo}|${selected.claimVersion}|${selected.hospital}|${selected.totalApproved}` : undefined}
        onSelect={setSelected}
        tall
        empty="No claims. Enter the bordx range and press Search."
      />

      <ActionBar label="Hospital report actions">
        <Button variant="primary" onClick={() => void search()} busy={busy} busyLabel="Working…">
          Search
        </Button>
        <Button variant="ghost" onClick={() => void printReport()} disabled={busy}>
          Print Report
        </Button>
        <Button variant="ghost" onClick={() => void costCentreReport()} disabled={busy}>
          CC Report
        </Button>
        <Button variant="link" onClick={clear}>
          Clear
        </Button>
        <span className="spacer" />
        {selected && <Stat label="Bordx No" value={selected.bordxNo ?? ''} />}
        <Stat label="Records" value={result?.rows.length ?? 0} />
        <Stat label="Total Amt" value={formatMoney(result?.totalAmount ?? 0)} />
        <Button variant="link" onClick={() => navigate('/')}>
          Close
        </Button>
      </ActionBar>
    </PageShell>
  )
}
