// Invoice > Invoice Processing (legacy frmInvoice), read side: enter a case, see its invoices, pick one and see its amounts by worksheet row.
// Adding, changing and removing invoices are not migrated yet, and the page says so.

import { useState } from 'react'
import type { FormEvent } from 'react'
import { keepPreviousData, useQuery, useQueryClient } from '@tanstack/react-query'
import { api, errorMessage } from '../../api/client'
import { Button } from '../../components/Button'
import { DataGrid } from '../../components/DataGrid'
import type { GridColumn } from '../../components/DataGrid'
import { ReadField, TextField } from '../../components/Field'
import { ActionBar, PageShell } from '../../components/Screen'
import { formatDate, formatMoney } from '../../lib/format'
import { ask, notify } from '../../lib/notifyStore'
import { InvoiceEntryForm } from './InvoiceEntryForm'
import { emptyValues, messages, valuesOf } from './invoiceEntryRules'
import type { InvoiceField, InvoiceFormData, InvoiceLookups, InvoiceValues } from './invoiceEntryRules'
import { amountNote, invoicesTotal, payToText, unregistered, worksheetText } from './invoiceRules'
import type { InvoiceCaseResult, InvoiceDetail, InvoiceRowAmount, InvoiceSummary } from './invoiceRules'

const money = (v: number | null | undefined) => (v == null ? '' : formatMoney(v))

const invoiceColumns: GridColumn<InvoiceSummary>[] = [
  { key: 'invoiceNo', label: 'Invoice No', value: (r) => r.invoiceNo },
  { key: 'invoiceDate', label: 'Invoice Date', value: (r) => formatDate(r.invoiceDate), sortBy: (r) => r.invoiceDate ?? '' },
  { key: 'payTo', label: 'Pay To', value: (r) => payToText(r.payTo) },
  { key: 'payeeName', label: 'Payee', value: (r) => r.payeeName ?? r.payee },
  { key: 'amount', label: 'Amount', align: 'right', value: (r) => money(r.amount), sortBy: (r) => r.amount ?? 0 },
  { key: 'inWorksheet', label: 'Worksheet', value: (r) => worksheetText(r), sortBy: (r) => (r.inWorksheet ? 1 : 0) },
  { key: 'bordxNo', label: 'Bordx No', value: (r) => r.bordxNo },
  { key: 'enteredBy', label: 'Entered By', value: (r) => r.enteredBy },
]

const rowColumns: GridColumn<InvoiceRowAmount>[] = [
  { key: 'benefit', label: 'Benefits', value: (r) => r.benefit },
  { key: 'amount', label: 'Amount', align: 'right', value: (r) => (r.amount === 0 ? '-' : formatMoney(r.amount)), sortBy: (r) => r.amount },
]

export function InvoiceProcessingPage() {
  const [caseNo, setCaseNo] = useState('')
  const [error, setError] = useState('')
  const [requested, setRequested] = useState<string | null>(null)
  const [selected, setSelected] = useState<number | null>(null)
  const [entry, setEntry] = useState<{ index: number | null; initial: InvoiceValues } | null>(null)
  const queryClient = useQueryClient()
  const fields = useQuery({
    queryKey: ['invoice-fields'],
    queryFn: async () => (await api.get<InvoiceField[]>('/api/invoice/fields')).data,
    staleTime: Infinity,
  })
  const lookups = useQuery({
    queryKey: ['invoice-lookups'],
    queryFn: async () => (await api.get<InvoiceLookups>('/api/invoice/lookups')).data,
    staleTime: Infinity,
  })

  const loaded = useQuery({
    queryKey: ['invoice-case', requested],
    queryFn: async () => (await api.get<InvoiceCaseResult>(`/api/invoice/${encodeURIComponent(requested as string)}`)).data,
    enabled: requested !== null,
    retry: false,
    placeholderData: keepPreviousData,
  })
  const result = loaded.data
  const detail = useQuery({
    queryKey: ['invoice-detail', result?.header.caseNo, selected],
    queryFn: async () => (await api.get<InvoiceDetail>(`/api/invoice/${encodeURIComponent(result?.header.caseNo ?? '')}/${selected}`)).data,
    enabled: result !== undefined && selected !== null,
    retry: false,
  })

  const show = (e: FormEvent) => {
    e.preventDefault()
    if (!caseNo.trim()) {
      setError('Please enter Case Number!')
      return
    }
    setError('')
    setSelected(null)
    setEntry(null)
    setRequested(caseNo.trim())
  }

  const reload = async (select: number | null) => {
    await queryClient.invalidateQueries({ queryKey: ['invoice-case'] })
    await queryClient.invalidateQueries({ queryKey: ['invoice-detail'] })
    setSelected(select)
  }

  // cmdAdd_Click
  const add = () => {
    if (!result) return notify(messages.selectCaseFirst, 'error')
    setEntry({ index: null, initial: emptyValues(result.header) })
  }

  // cmdEdit_Click: a bordxed invoice cannot be changed; one a worksheet has used is not migrated yet (the server says so)
  const edit = async () => {
    if (!result || selected === null) return
    try {
      const data = (await api.get<InvoiceFormData>(`/api/invoice/${encodeURIComponent(result.header.caseNo)}/${selected}/form`)).data
      if (data.bordxed) return notify('Invoice has been bordx!', 'error')
      if (data.inWorksheet)
        return notify(
          "This invoice has been used in a worksheet. Changing it is not available yet: the desktop also saves the worksheet's limits then.",
          'error',
        )
      setEntry({ index: selected, initial: valuesOf(data.form, fields.data ?? []) })
    } catch (e) {
      notify(errorMessage(e), 'error')
    }
  }

  // CmdRemove_Click
  const remove = async () => {
    if (!result || selected === null) return
    const invoice = result.invoices.find((i) => i.index === selected)
    if (invoice?.inWorksheet) return notify('Selected Invoice cannot be deleted!\nIt has been used in Worksheet!', 'error')
    if (!(await ask(messages.removeSure))) return
    try {
      await api.delete(`/api/invoice/${encodeURIComponent(result.header.caseNo)}/${selected}`)
      setEntry(null)
      await reload(null)
    } catch (e) {
      notify(errorMessage(e), 'error')
    }
  }

  const header = result?.header
  const pending = result ? unregistered(result.invoices) : []

  return (
    <PageShell title="Invoice Processing" subtitle="The invoices of a case, and what each one charges">
      <p role="status" className="muted">
        Add an invoice to a case, or pick one to change or remove. An invoice a worksheet has used cannot be changed or removed here yet.
      </p>
      <form onSubmit={show} noValidate>
        <ActionBar label="Case">
          <TextField
            label="Case No"
            value={caseNo}
            onChange={(e) => setCaseNo(e.target.value)}
            error={error ? { type: 'required', message: error } : undefined}
            autoFocus
          />
          <Button type="submit" disabled={loaded.isFetching}>
            {loaded.isFetching ? 'Loading…' : 'Show'}
          </Button>
        </ActionBar>
      </form>

      {requested && loaded.error && (
        <p role="alert" className="error">
          {errorMessage(loaded.error)}
        </p>
      )}
      {header && result && (
        <>
          <div className="registration">
            <fieldset>
              <legend>Case</legend>
              <ReadField label="Membership No" value={header.memberNo ?? ''} />
              <ReadField label="Member" value={header.memberName ?? ''} />
              <ReadField label="Patient" value={header.patientName ?? (header.coverId === '00' ? 'Member' : '')} />
              <ReadField label="Payor" value={header.payor ?? ''} />
              <ReadField label="Plan" value={header.planCode ?? ''} />
              <ReadField label="Hospital" value={header.hospital ?? ''} />
              <ReadField label="Date of Admission" value={formatDate(header.admitted)} />
              <ReadField label="Date of Discharge" value={formatDate(header.discharged)} />
              <ReadField label="Worksheet" value={header.lastWorksheetVersion == null ? 'None yet' : `Version ${header.lastWorksheetVersion}`} />
              <ReadField label="Next Worksheet Version" value={String(header.nextWorksheetVersion)} />
            </fieldset>
          </div>
          {pending.length > 0 && (
            <p role="status" className="muted">
              {pending.length === 1 ? '1 invoice is' : `${pending.length} invoices are`} not in a worksheet yet ({formatMoney(invoicesTotal(pending))}).
            </p>
          )}
          <ActionBar label="Invoice">
            <Button onClick={add}>Add</Button>
            <Button onClick={edit} disabled={selected === null}>
              Edit
            </Button>
            <Button onClick={remove} disabled={selected === null}>
              Remove
            </Button>
            <Button variant="link" onClick={() => setEntry(null)} disabled={entry === null}>
              Clear
            </Button>
          </ActionBar>
          {entry && fields.data && lookups.data && (
            <InvoiceEntryForm
              key={entry.index ?? 'new'}
              header={result.header}
              fields={fields.data}
              lookups={lookups.data}
              initial={entry.initial}
              index={entry.index}
              onCancel={() => setEntry(null)}
              onSaved={async (index) => {
                setEntry(null)
                await reload(index)
              }}
            />
          )}
          <DataGrid
            caption="Invoices"
            columns={invoiceColumns}
            rows={result.invoices}
            rowKey={(r) => String(r.index)}
            selectedKey={selected === null ? null : String(selected)}
            onSelect={(r) => setSelected(r.index)}
            empty="This case has no invoice."
          />
          {detail.error && (
            <p role="alert" className="error">
              {errorMessage(detail.error)}
            </p>
          )}
          {detail.data && (
            <>
              <h3>Invoice {detail.data.invoice.invoiceNo}</h3>
              <div className="registration">
                <fieldset>
                  <legend>Invoice details</legend>
                  <ReadField label="Stay Type" value={detail.data.invoice.stayType ?? ''} />
                  <ReadField label="Pay Type" value={detail.data.invoice.payType ?? ''} />
                  <ReadField label="Room Type" value={detail.data.invoice.roomType ?? ''} />
                  <ReadField label="Receipt Date" value={formatDate(detail.data.invoice.receiptDate)} />
                  <ReadField label="Receipt Mode" value={detail.data.invoice.receiptMode ?? ''} />
                  <ReadField label="Follow-up Date" value={formatDate(detail.data.invoice.followUpDate)} />
                  <ReadField label="Initial Invoice Amount" value={money(detail.data.invoice.initialAmount)} />
                  <ReadField label="Excess Amount" value={money(detail.data.invoice.excessAmount)} />
                  <ReadField label="Amount to Pay" value={money(detail.data.invoice.payAmount)} />
                  <ReadField label="UHC No" value={detail.data.invoice.uhcNo ?? ''} />
                </fieldset>
              </div>
              {amountNote(detail.data) && (
                <p role="status" className="muted">
                  {amountNote(detail.data)}
                </p>
              )}
              <DataGrid caption="Invoice amounts" columns={rowColumns} rows={detail.data.rows} rowKey={(r) => String(r.slot)} tall />
              <p className="muted">
                Invoice amount: {money(detail.data.invoice.amount)}; rows added up: {formatMoney(detail.data.rowsTotal)}
              </p>
            </>
          )}
        </>
      )}
    </PageShell>
  )
}
