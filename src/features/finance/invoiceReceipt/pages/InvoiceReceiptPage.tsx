// Finance > Invoice Receipt (Outstanding) and Notification / Suspension (legacy FrmRecMCO / frmRecMCOManual). Rebuilt on the receipt
// tables in use since 2010: list the member MCO invoices with their balance, pick one, and record a fee receipt (ReceiptSummary)
// with the next RecSeq number, or (manual) with a typed receipt number.

import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { yupResolver } from '@hookform/resolvers/yup'
import { useQuery } from '@tanstack/react-query'
import * as yup from 'yup'
import { CheckField, ComboField, DateField, NumberField, SelectField, TextField } from '../../../../components/Field'
import type { Option } from '../../../../components/Field'
import { DataGrid } from '../../../../components/DataGrid'
import type { GridColumn } from '../../../../components/DataGrid'
import { ActionBar, PageShell, Stat } from '../../../../components/Screen'
import { Button } from '../../../../components/Button'
import { errorMessage } from '../../../../api/client'
import { formatDate, formatMoney } from '../../../../lib/format'
import { parseDmy } from '../../../../lib/masks'
import { ask, notify } from '../../../../lib/notifyStore'
import { dmyDate, optionalText } from '../../../../lib/validation'
import { invoiceReceiptApi } from '../api/invoiceReceiptApi'
import { overpaymentWarning, receiptDefaults, receiptProblem } from '../receiptRules'
import type { CodeName, InvoiceSearchResult, OutstandingInvoice, ReceiptRow } from '../types'

interface SearchValues {
  invoiceNoFrom: string
  invoiceNoTo: string
  invoiceDateFrom: string
  invoiceDateTo: string
  payor: string
  outstandingOnly: boolean
}

interface ReceiptValues {
  receiptNo: string
  prefix: string
  receiptType: string
  receiptDate: string
  amount: string
  chequeNo: string
  payor: string
  description: string
}

const searchDefaults: SearchValues = { invoiceNoFrom: '', invoiceNoTo: '', invoiceDateFrom: '', invoiceDateTo: '', payor: '', outstandingOnly: true }
const receiptBlank: ReceiptValues = {
  receiptNo: '',
  prefix: 'RB',
  receiptType: 'IPFEE',
  receiptDate: '',
  amount: '',
  chequeNo: 'ONLINE',
  payor: '',
  description: '',
}

const searchSchema: yup.ObjectSchema<SearchValues> = yup.object({
  invoiceNoFrom: optionalText(),
  invoiceNoTo: optionalText(),
  invoiceDateFrom: dmyDate(),
  invoiceDateTo: dmyDate(),
  payor: optionalText(),
  outstandingOnly: yup.boolean().default(true),
})

const receiptSchema: yup.ObjectSchema<ReceiptValues> = yup.object({
  receiptNo: optionalText(),
  prefix: optionalText(),
  receiptType: optionalText(),
  receiptDate: dmyDate(),
  amount: yup
    .string()
    .default('')
    .test('amount', 'Enter a valid amount.', (v) => !v || /^-?\d+(\.\d{1,2})?$/.test(v.trim())),
  chequeNo: optionalText(),
  payor: optionalText(),
  description: optionalText(),
})

const iso = (dmy: string) => {
  const d = parseDmy(dmy)
  return d ? `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}` : undefined
}
const today = () => {
  const d = new Date()
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`
}
const options = (list: CodeName[] | undefined, showCode = true): Option[] =>
  (list ?? []).map((o) => ({ value: o.code, label: showCode && o.code !== o.name ? `${o.code} - ${o.name}` : o.name }))
const money = (v: number | null | undefined) => (v == null ? '' : formatMoney(v))

/** "Outstanding only" applies to range searches; asking for one invoice number always shows that invoice, whatever its balance. */
const applyOutstandingOnly = (v: SearchValues) => {
  const from = v.invoiceNoFrom.trim().toUpperCase()
  return v.outstandingOnly && !(from !== '' && from === v.invoiceNoTo.trim().toUpperCase())
}

const invoiceColumns: GridColumn<OutstandingInvoice>[] = [
  { key: 'invoiceNo', label: 'Invoice No' },
  { key: 'invoiceDate', label: 'Invoice Date', value: (r) => formatDate(r.invoiceDate), sortBy: (r) => r.invoiceDate ?? '' },
  { key: 'payor', label: 'Payor' },
  { key: 'members', label: 'Members', align: 'right' },
  { key: 'billAmount', label: 'Bill Amount', align: 'right', value: (r) => money(r.billAmount), sortBy: (r) => r.billAmount },
  { key: 'receipts', label: 'Receipts', align: 'right' },
  { key: 'received', label: 'Received', align: 'right', value: (r) => money(r.received), sortBy: (r) => r.received },
  { key: 'outstanding', label: 'Outstanding', align: 'right', value: (r) => money(r.outstanding), sortBy: (r) => r.outstanding },
]

const receiptColumns: GridColumn<ReceiptRow>[] = [
  { key: 'receiptNo', label: 'Receipt No' },
  { key: 'receiptDate', label: 'Receipt Date', value: (r) => formatDate(r.receiptDate), sortBy: (r) => r.receiptDate ?? '' },
  { key: 'receiptType', label: 'Type' },
  { key: 'amount', label: 'Amount', align: 'right', value: (r) => money(r.amount), sortBy: (r) => r.amount ?? 0 },
  { key: 'description', label: 'Description' },
  { key: 'chequeNo', label: 'Chq No' },
  { key: 'payor', label: 'Payor' },
  { key: 'posted', label: 'Posted', align: 'center', value: (r) => (r.posted ? 'Yes' : 'No') },
  { key: 'batchNo', label: 'Batch No' },
]

/**
 * Invoice Receipt (auto receipt number); with `manual`, Notification / Suspension (typed receipt number); with `shortPayment`, Short
 * Payment Receipt (legacy frmReceiptAdjustment, rebuilt): only invoices already part paid, to receipt the balance still owed.
 */
export function InvoiceReceiptPage({ manual = false, shortPayment = false }: { manual?: boolean; shortPayment?: boolean }) {
  const navigate = useNavigate()
  const lookups = useQuery({ queryKey: ['finance', 'invoice-receipt', 'lookups'], queryFn: invoiceReceiptApi.lookups })
  const [result, setResult] = useState<InvoiceSearchResult | null>(null)
  const [selected, setSelected] = useState<OutstandingInvoice | null>(null)
  const [receipts, setReceipts] = useState<ReceiptRow[]>([])
  const [busy, setBusy] = useState(false)
  const search = useForm<SearchValues>({ resolver: yupResolver(searchSchema), defaultValues: searchDefaults, mode: 'onTouched' })
  const receipt = useForm<ReceiptValues>({ resolver: yupResolver(receiptSchema), defaultValues: receiptBlank, mode: 'onTouched' })

  /**
   * Runs the search. With `keep`, the invoice just paid stays in the list and selected even when it no longer matches
   * "Outstanding only" (fully paid), so the user sees the new receipt; it drops out on the next search.
   */
  async function loadInvoices(v: SearchValues, keep?: string) {
    const found = await invoiceReceiptApi.invoices({
      invoiceNoFrom: v.invoiceNoFrom,
      invoiceNoTo: v.invoiceNoTo,
      invoiceDateFrom: iso(v.invoiceDateFrom),
      invoiceDateTo: iso(v.invoiceDateTo),
      payor: v.payor,
      outstandingOnly: shortPayment ? false : applyOutstandingOnly(v),
      partPaidOnly: shortPayment,
    })
    if (!keep) {
      setResult(found)
      return { kept: null, count: found.rows.length }
    }
    const listed = found.rows.find((r) => r.invoiceNo === keep)
    const kept = listed ?? (await invoiceReceiptApi.invoices({ invoiceNoFrom: keep, invoiceNoTo: keep, outstandingOnly: false })).rows[0] ?? null
    setResult(listed || !kept ? found : { ...found, rows: [kept, ...found.rows] })
    return { kept, count: found.rows.length }
  }

  const runSearch = search.handleSubmit(async (v) => {
    setBusy(true)
    setSelected(null)
    setReceipts([])
    try {
      const { count } = await loadInvoices(v)
      if (count === 0)
        notify(
          shortPayment
            ? 'No part-paid invoice with a balance left matches.'
            : applyOutstandingOnly(v)
              ? 'No invoice with an outstanding balance matches. Untick "Outstanding only" to include fully paid or over-received invoices.'
              : 'No record found!',
          'error',
        )
    } catch (e) {
      notify(errorMessage(e), 'error')
    } finally {
      setBusy(false)
    }
  })

  async function pick(invoice: OutstandingInvoice) {
    setSelected(invoice)
    receipt.reset({ ...receiptBlank, prefix: lookups.data?.defaultPrefix ?? 'RB', ...receiptDefaults(invoice, today()) })
    try {
      setReceipts(await invoiceReceiptApi.receipts(invoice.invoiceNo))
    } catch (e) {
      notify(errorMessage(e), 'error')
    }
  }

  /** CmdSave_Click. */
  const save = receipt.handleSubmit(async (v) => {
    const problem = receiptProblem({
      manual,
      receiptNo: v.receiptNo,
      invoiceNo: selected?.invoiceNo ?? '',
      receiptType: v.receiptType,
      receiptDate: v.receiptDate,
      amount: v.amount,
    })
    if (problem || !selected) return notify(problem ?? 'Please select the invoice', 'error')
    const warning = overpaymentWarning(selected, Number(v.amount))
    if (warning && !(await ask(warning))) return
    if (!(await ask('Do you want to save the record?'))) return
    setBusy(true)
    try {
      const saved = await invoiceReceiptApi.record(
        {
          invoiceNo: selected.invoiceNo,
          receiptType: v.receiptType,
          receiptDate: iso(v.receiptDate) ?? null,
          amount: Number(v.amount),
          chequeNo: v.chequeNo,
          payor: v.payor,
          description: v.description,
          prefix: manual ? undefined : v.prefix,
          receiptNo: manual ? v.receiptNo.trim() : undefined,
        },
        manual,
      )
      // Saved: close the receipt form; the invoice stays listed with its new balance (even when fully paid) until the next search.
      const { kept: refreshed } = await loadInvoices(search.getValues(), selected.invoiceNo)
      const settled = refreshed && refreshed.outstanding <= 0 && search.getValues('outstandingOnly')
      notify(
        `${saved.message} Receipt No ${saved.receiptNo} for invoice ${selected.invoiceNo} (outstanding now ${money(refreshed?.outstanding ?? 0)}).` +
          (settled ? ' It will leave the "Outstanding only" list on the next search.' : ''),
        'success',
      )
      setSelected(null)
      setReceipts([])
      receipt.reset({ ...receiptBlank, prefix: v.prefix })
    } catch (e) {
      notify(errorMessage(e), 'error')
    } finally {
      setBusy(false)
    }
  })

  function clear() {
    search.reset(searchDefaults)
    receipt.reset(receiptBlank)
    setResult(null)
    setSelected(null)
    setReceipts([])
  }

  return (
    <PageShell
      title={manual ? 'Notification / Suspension' : shortPayment ? 'Short Payment Receipt' : 'Invoice Receipt (Outstanding)'}
      subtitle={
        manual
          ? 'Fee receipts against member MCO invoices, with a typed receipt number.'
          : shortPayment
            ? 'Member MCO invoices that were paid short: receipt the balance still owed.'
            : 'Fee receipts against member MCO invoices, numbered from the receipt sequence.'
      }
    >
      <form onSubmit={runSearch} noValidate className="screen-form">
        <fieldset>
          <legend>Invoices</legend>
          <TextField label="Invoice No from" maxLength={40} autoFocus {...search.register('invoiceNoFrom')} />
          <TextField label="Invoice No to" maxLength={40} {...search.register('invoiceNoTo')} />
          <DateField control={search.control} name="invoiceDateFrom" label="Invoice Date from" />
          <DateField control={search.control} name="invoiceDateTo" label="Invoice Date to" />
          <ComboField label="Payor" options={options(lookups.data?.payors)} {...search.register('payor')} />
          {!shortPayment && <CheckField label="Outstanding only" {...search.register('outstandingOnly')} />}
        </fieldset>
        <ActionBar label="Invoice search actions">
          <Button variant="primary" type="submit" busy={busy} busyLabel="Working…">
            Search
          </Button>
          <Button variant="link" onClick={clear}>
            Clear
          </Button>
          <span className="spacer" />
          <Stat label="Invoices" value={result?.rows.length ?? 0} />
          <Stat label="Total Outstanding" value={money(result?.totalOutstanding ?? 0)} />
          <Button variant="link" onClick={() => navigate('/')}>
            Exit
          </Button>
        </ActionBar>
        <DataGrid
          caption="Member MCO invoices"
          columns={invoiceColumns}
          rows={result?.rows ?? []}
          rowKey={(r) => r.invoiceNo}
          selectedKey={selected?.invoiceNo}
          onSelect={pick}
          empty="No invoices. Enter the criteria and press Search."
        />
      </form>

      {selected && (
        <form onSubmit={save} noValidate className="screen-form">
          <fieldset>
            <legend>
              Receipt for invoice {selected.invoiceNo} (outstanding {money(selected.outstanding)})
            </legend>
            {manual ? (
              <TextField label="Receipt No" required maxLength={40} error={receipt.formState.errors.receiptNo} {...receipt.register('receiptNo')} />
            ) : (
              <SelectField
                label="Receipt No prefix"
                blank={false}
                options={options(lookups.data?.prefixes, false)}
                hint="Next number from the receipt sequence"
                {...receipt.register('prefix')}
              />
            )}
            <SelectField label="Rec. Type" required blank={false} options={options(lookups.data?.receiptTypes, false)} {...receipt.register('receiptType')} />
            <DateField control={receipt.control} name="receiptDate" label="Receipt Date" required />
            <NumberField label="Receipt Amount" required error={receipt.formState.errors.amount} {...receipt.register('amount')} />
            <TextField label="Chq No" maxLength={40} {...receipt.register('chequeNo')} />
            <ComboField label="Payor" options={options(lookups.data?.payors)} maxLength={4} {...receipt.register('payor')} />
            <TextField label="Description" maxLength={100} wide {...receipt.register('description')} />
          </fieldset>
          <ActionBar label="Receipt actions">
            <Button variant="primary" type="submit" busy={busy} busyLabel="Saving…">
              Save
            </Button>
            <span className="spacer" />
            <Stat label="Bill" value={money(selected.billAmount)} />
            <Stat label="Received" value={money(selected.received)} />
            <Stat label="Outstanding" value={money(selected.outstanding)} />
          </ActionBar>
          <DataGrid
            caption={`Receipts of invoice ${selected.invoiceNo}`}
            columns={receiptColumns}
            rows={receipts}
            rowKey={(r) => String(r.id)}
            empty="No receipts recorded against this invoice yet."
          />
        </form>
      )}
    </PageShell>
  )
}
