// Contribution Billing > Generate Invoice (legacy frmMCOFeesListingNew, "Member MCO Fees"): the MCO fees of a bordx batch or range of a payor (or of an invoice). Print gives the members that have no invoice a
// new invoice number and writes the invoice or the fee listing; Preview writes the same without giving out a number.

import { useState } from 'react'
import type { FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { useForm, useWatch } from 'react-hook-form'
import { yupResolver } from '@hookform/resolvers/yup'
import { useQuery } from '@tanstack/react-query'
import { CheckField, ComboField, DateField, SelectField, TextField } from '../../components/Field'
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
  groupByOptions,
  invoiceColumns,
  invoiceDefaults,
  invoiceParams,
  invoiceRequest,
  invoiceRows,
  invoiceSchema,
  listingRows,
  listingVersionOptions,
  needsConfirmation,
  printProblem,
  reportTypeOptions,
  searchProblem,
  versionEnabled,
} from './generateInvoiceRules'
import type { InvoiceDocument, InvoiceRow, InvoiceSearchResult, InvoiceValues } from './generateInvoiceRules'

const base = '/api/contribution-billing/generate-invoice'
const columns: GridColumn<InvoiceRow>[] = invoiceColumns.map((c, i) => ({
  key: `c${i}`,
  label: c.label,
  value: c.value,
  align: c.label === 'BMco' || c.label === 'Mco' ? 'right' : undefined,
}))

export function GenerateInvoicePage() {
  const navigate = useNavigate()
  const lookups = useWorksheetLookups()
  const [busy, setBusy] = useState(false)
  const [result, setResult] = useState<InvoiceSearchResult | null>(null)
  const form = useForm<InvoiceValues>({ resolver: yupResolver(invoiceSchema), defaultValues: invoiceDefaults, mode: 'onSubmit' })
  const [criteria, payor, groupBy, reportType] = useWatch({ control: form.control, name: ['criteria', 'payor', 'groupBy', 'reportType'] })
  const payorCode = payor.trim().split(' - ')[0].trim()
  const groups = useQuery({
    queryKey: ['mco-group-companies', payorCode],
    queryFn: async () => (await api.get<string[]>(`${base}/group-companies`, { params: { payor: payorCode } })).data.map((g) => ({ value: g, label: g })),
    enabled: payorCode.length === 2 && groupBy !== 'payor',
    staleTime: 10 * 60 * 1000,
  })

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
      const { data } = await api.get<InvoiceSearchResult>(base, { params: invoiceParams(v) })
      setResult(data)
      if (data.feeEmpty) notify('MCO Fee is Empty!', 'error')
      if (data.truncated) notify('Only the first 5,000 lines are shown. Narrow the search to see the rest.', 'info')
    })
  })

  /** cmdMCOPrint_Click (allocate) and cmdMCOPrintPreview_Click: the document is written to a CSV, the invoice or the fee listing. */
  function print(allocate: boolean) {
    const v = form.getValues()
    const problem = printProblem(v)
    if (problem) {
      form.setError(problem.field, { message: problem.message })
      return form.setFocus(problem.field)
    }
    if (result?.multipleInvoices) return notify('Different Invoice Found in Same Batch or Range, Please Search by Invoice No ! ', 'error')
    return run(async () => {
      if (allocate && needsConfirmation(result) && !(await ask('Printing gives these members a new invoice number. Do you want to continue?'))) return
      const { data } = await api.post<InvoiceDocument>(`${base}/print`, invoiceRequest(v, allocate))
      downloadCsvRows(
        `mco-${data.reportType}${data.invoiceNo ? `-${data.invoiceNo}` : ''}.csv`,
        data.reportType === 'invoice' ? invoiceRows(data) : listingRows(data),
      )
      if (data.allocated) {
        notify(`Invoice ${data.invoiceNo} given to ${data.rows.length} line(s).`, 'success')
        setResult({ ...(result as InvoiceSearchResult), rows: data.rows, invoices: data.invoiceNo ? [data.invoiceNo] : [], billed: true })
      }
    })
  }

  /** cboMCOCriteriaSel_Click: the other boxes and the list are cleared, the choices stay. */
  function changeCriteria(value: string) {
    const keep = form.getValues()
    form.reset({
      ...invoiceDefaults,
      criteria: value,
      reportType: keep.reportType,
      listingVersion: keep.listingVersion,
      groupBy: keep.groupBy,
      principalsOnly: keep.principalsOnly,
    })
    setResult(null)
  }

  function clear() {
    form.reset(invoiceDefaults)
    setResult(null)
  }

  const error = form.formState.errors
  const listed = result !== null

  return (
    <PageShell title="Member MCO Fees" subtitle="MCO invoice of a bordx batch or range, or of an invoice.">
      <form onSubmit={(e: FormEvent) => void search(e)} noValidate className="screen-form">
        <fieldset>
          <legend>Enter Criteria For Searching</legend>
          <SelectField
            label="MCO Criteria"
            options={criteriaOptions}
            error={error.criteria}
            {...form.register('criteria', { onChange: (e: { target: { value: string } }) => changeCriteria(e.target.value) })}
          />
          {criteria !== 'invoice' && (
            <ComboField label="Payor" options={lookups.payors} error={error.payor} {...form.register('payor', { onChange: () => setResult(null) })} />
          )}
          {criteria === 'batch' && <DateField control={form.control} name="bordxDate" label="Bordx Date" />}
          {criteria === 'batch' && <TextField label="Batch No" maxLength={5} error={error.batchNo} {...form.register('batchNo')} />}
          {criteria === 'range' && <DateField control={form.control} name="bordxFrom" label="Bordx Date from" />}
          {criteria === 'range' && <DateField control={form.control} name="bordxTo" label="Bordx Date to" />}
          {criteria === 'invoice' && <TextField label="Invoice No" maxLength={40} error={error.invoiceNo} {...form.register('invoiceNo')} />}
          <SelectField label="Group By" blank={false} options={groupByOptions} {...form.register('groupBy', { onChange: () => setResult(null) })} />
          {groupBy === 'group' && criteria !== 'invoice' && (
            <ComboField label="Grp Company" options={groups.data ?? []} error={error.groupCompany} {...form.register('groupCompany')} />
          )}
          <CheckField label="Principal only (the report lists the principals)" {...form.register('principalsOnly')} />
          <SelectField label="Report Type" options={reportTypeOptions} error={error.reportType} {...form.register('reportType')} />
          <SelectField
            label="Listing Versions"
            blank={false}
            options={listingVersionOptions}
            disabled={!versionEnabled(reportType)}
            {...form.register('listingVersion')}
          />
        </fieldset>
      </form>

      <DataGrid
        caption="Member MCO Fees"
        columns={columns}
        rows={result?.rows ?? []}
        rowKey={(r) => `${r.memberNo}|${r.coverId}|${r.bordxDate}|${r.batchNo}|${r.relation}`}
        tall
        empty="No lines. Choose the criteria and press Search."
      />

      <ActionBar label="Generate invoice actions">
        <Button variant="primary" onClick={() => void search()} busy={busy} busyLabel="Working…">
          Search
        </Button>
        <Button variant="ghost" onClick={() => void print(false)} disabled={busy || !listed}>
          Preview
        </Button>
        <Button variant="ghost" onClick={() => void print(true)} disabled={busy || !listed || result?.billed === true}>
          Print
        </Button>
        <Button variant="link" onClick={clear}>
          Clear
        </Button>
        <span className="spacer" />
        <Stat label="Total Principal" value={result?.principals ?? 0} />
        <Stat label="Total Supp" value={result?.supplementary ?? 0} />
        <Button variant="link" onClick={() => navigate('/')}>
          Close
        </Button>
      </ActionBar>
    </PageShell>
  )
}
