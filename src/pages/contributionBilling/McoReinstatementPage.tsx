// Contribution Billing > MCO Reinstatement (legacy frmMCOInvoiceReinstatement, "MCO Reinstatement Invoice"): the MCO fees of members whose cover was reinstated, by bordx date and batch for a payor or
// by invoice number. Print gives the members a new invoice number when they have none and writes the invoice or the listing; Preview writes the same without giving out a number.

import { useState } from 'react'
import type { FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { useForm, useWatch } from 'react-hook-form'
import { yupResolver } from '@hookform/resolvers/yup'
import { ComboField, DateField, SelectField, TextField } from '../../components/Field'
import { DataGrid } from '../../components/DataGrid'
import type { GridColumn } from '../../components/DataGrid'
import { ActionBar, PageShell, Stat } from '../../components/Screen'
import { Button } from '../../components/Button'
import { downloadCsvRows } from '../../lib/exportCsv'
import { ask, notify } from '../../lib/notifyStore'
import { api, errorMessage } from '../../api/client'
import { useWorksheetLookups } from '../worksheet/useWorksheetLookups'
import {
  criteriaOptions,
  invoiceRows,
  listingRows,
  mcoColumns,
  mcoDefaults,
  mcoParams,
  mcoSchema,
  needsConfirmation,
  printProblem,
  printRequest,
  reportTypeOptions,
  searchProblem,
  totalFees,
} from './mcoReinstatementRules'
import type { McoDocument, McoRow, McoSearchResult, McoValues } from './mcoReinstatementRules'

const base = '/api/contribution-billing/mco-reinstatement'
const columns: GridColumn<McoRow>[] = mcoColumns.map((c, i) => ({
  key: `c${i}`,
  label: c.label,
  value: c.value,
  align: c.label === 'MCOFee' ? 'right' : undefined,
}))

export function McoReinstatementPage() {
  const navigate = useNavigate()
  const lookups = useWorksheetLookups()
  const [busy, setBusy] = useState(false)
  const [result, setResult] = useState<McoSearchResult | null>(null)
  const form = useForm<McoValues>({ resolver: yupResolver(mcoSchema), defaultValues: mcoDefaults, mode: 'onTouched' })
  const criteria = useWatch({ control: form.control, name: 'criteria' })

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

  /** cmdMCOSearch_Click: the checks in the desktop's order, then the list. */
  const search = form.handleSubmit((v) => {
    const problem = searchProblem(v)
    if (problem) {
      form.setError(problem.field, { message: problem.message })
      return form.setFocus(problem.field)
    }
    return run(async () => {
      const { data } = await api.get<McoSearchResult>(base, { params: mcoParams(v) })
      setResult(data)
      if (data.truncated) notify('Only the first 5,000 lines are shown. Narrow the search to see the rest.', 'info')
    })
  })

  /** cmdMCOPrint_Click (allocate) and cmdMCOPrintPreview_Click: the document is written to a CSV, the invoice or the listing. */
  function print(allocate: boolean) {
    const v = form.getValues()
    const problem = printProblem(v)
    if (problem) {
      form.setError(problem.field, { message: problem.message })
      return form.setFocus(problem.field)
    }
    return run(async () => {
      if (allocate && needsConfirmation(result) && !(await ask('Printing gives these members a new invoice number. Do you want to continue?'))) return
      const { data } = await api.post<McoDocument>(`${base}/print`, printRequest(v, allocate))
      downloadCsvRows(
        `mco-reinstatement-${data.reportType}${data.invoiceNo ? `-${data.invoiceNo}` : ''}.csv`,
        data.reportType === 'invoice' ? invoiceRows(data) : listingRows(data),
      )
      if (data.allocated) {
        notify(`Invoice ${data.invoiceNo} given to ${data.rows.length} line(s).`, 'success')
        setResult({ ...(result as McoSearchResult), rows: data.rows, invoices: data.invoiceNo ? [data.invoiceNo] : [] })
      }
    })
  }

  /** cboMCOCriteriaSel_Click: the other boxes and the list are cleared, the choice stays. */
  function changeCriteria(value: string) {
    form.reset({ ...mcoDefaults, criteria: value, reportType: form.getValues('reportType') })
    setResult(null)
  }

  function clear() {
    form.reset(mcoDefaults)
    setResult(null)
  }

  const error = form.formState.errors
  const listed = result !== null

  return (
    <PageShell title="MCO Reinstatement Invoice" subtitle="MCO fees of reinstated members, and their invoice.">
      <form onSubmit={(e: FormEvent) => void search(e)} noValidate className="screen-form">
        <fieldset>
          <legend>Enter Criteria For Searching</legend>
          <SelectField
            label="MCO Criteria"
            options={criteriaOptions}
            error={error.criteria}
            {...form.register('criteria', { onChange: (e: { target: { value: string } }) => changeCriteria(e.target.value) })}
          />
          {criteria === 'batch' && <ComboField label="Payor" options={lookups.payors} error={error.payor} {...form.register('payor')} />}
          {criteria === 'batch' && <DateField control={form.control} name="bordxDate" label="Bordx Date" />}
          {criteria === 'batch' && <TextField label="Batch No" maxLength={5} error={error.batchNo} {...form.register('batchNo')} />}
          {criteria === 'invoice' && <TextField label="Invoice No" maxLength={40} error={error.invoiceNo} {...form.register('invoiceNo')} />}
          <SelectField label="Report Type" options={reportTypeOptions} error={error.reportType} {...form.register('reportType')} />
        </fieldset>
      </form>

      <DataGrid
        caption="Reinstatement MCO Fees"
        columns={columns}
        rows={result?.rows ?? []}
        rowKey={(r) => `${r.memberNo}|${r.coverId}|${r.bordxDate}|${r.batchNo}`}
        tall
        empty="No lines. Choose the criteria and press Search."
      />

      <ActionBar label="MCO reinstatement actions">
        <Button variant="primary" onClick={() => void search()} busy={busy} busyLabel="Working…">
          Search
        </Button>
        <Button variant="ghost" onClick={() => void print(false)} disabled={busy || !listed}>
          Preview
        </Button>
        <Button variant="ghost" onClick={() => void print(true)} disabled={busy || !listed}>
          Print
        </Button>
        <Button variant="link" onClick={clear}>
          Clear
        </Button>
        <span className="spacer" />
        <Stat label="Total Principal" value={result?.principals ?? 0} />
        <Stat label="Total Supp" value={result?.supplementary ?? 0} />
        <Stat label="Total MCO Fee" value={totalFees(result?.rows ?? [])} />
        <Button variant="link" onClick={() => navigate('/')}>
          Close
        </Button>
      </ActionBar>
    </PageShell>
  )
}
