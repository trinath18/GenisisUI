// Invoice > Invoice Processing (legacy frmInvoice), read side: enter a case, see its invoices, pick one and see its amounts by worksheet row.
// Adding, changing and removing invoices are not migrated yet, and the page says so.

import { useState } from 'react'
import type { FormEvent } from 'react'
import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { api, errorMessage } from '../../api/client'
import { Button } from '../../components/Button'
import { DataGrid } from '../../components/DataGrid'
import type { GridColumn } from '../../components/DataGrid'
import { ReadField, TextField } from '../../components/Field'
import { ActionBar, PageShell } from '../../components/Screen'
import { formatDate, formatMoney } from '../../lib/format'
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
    setRequested(caseNo.trim())
  }

  const header = result?.header
  const pending = result ? unregistered(result.invoices) : []

  return (
    <PageShell title="Invoice Processing" subtitle="The invoices of a case, and what each one charges">
      <p role="status" className="muted">
        This page shows a case&apos;s invoices and their amounts. Adding, changing and removing invoices are not available yet, so nothing is written here.
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
          <div className="form-row">
            <ReadField label="Membership No" value={header.memberNo ?? ''} />
            <ReadField label="Member" value={header.memberName ?? ''} />
            <ReadField label="Patient" value={header.patientName ?? (header.coverId === '00' ? 'Member' : '')} />
            <ReadField label="Payor" value={header.payor ?? ''} />
            <ReadField label="Plan" value={header.planCode ?? ''} />
            <ReadField label="Hospital" value={header.hospital ?? ''} />
            <ReadField label="Date of Admission" value={formatDate(header.admitted)} />
            <ReadField label="Date of Discharge" value={formatDate(header.discharged)} />
            <ReadField label="Worksheet" value={header.lastWorksheetVersion == null ? 'None yet' : `Version ${header.lastWorksheetVersion}`} />
          </div>
          {pending.length > 0 && (
            <p role="status" className="muted">
              {pending.length === 1 ? '1 invoice is' : `${pending.length} invoices are`} not in a worksheet yet ({formatMoney(invoicesTotal(pending))}).
            </p>
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
              <div className="form-row">
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
