// Finance > Receipt Enquiry (legacy frmReceiptEnquiry; its source is not available). Rebuilt from the receipt tables: search the
// receipts (ReceiptSummary), then open one to see the claims it was allocated to, the fee invoice it pays and its SUN postings.

import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { yupResolver } from '@hookform/resolvers/yup'
import { useQuery } from '@tanstack/react-query'
import * as yup from 'yup'
import { ComboField, DateField, SelectField, TextField } from '../../../../components/Field'
import type { Option } from '../../../../components/Field'
import { DataGrid } from '../../../../components/DataGrid'
import type { GridColumn } from '../../../../components/DataGrid'
import { ActionBar, PageShell, Stat } from '../../../../components/Screen'
import { Tabs } from '../../../../components/Tabs'
import { Button } from '../../../../components/Button'
import { errorMessage } from '../../../../api/client'
import { downloadCsv } from '../../../../lib/exportCsv'
import type { CsvColumn } from '../../../../lib/exportCsv'
import { formatDate, formatMoney } from '../../../../lib/format'
import { parseDmy } from '../../../../lib/masks'
import { notify } from '../../../../lib/notifyStore'
import { dmyDate, optionalText } from '../../../../lib/validation'
import { receiptEnquiryApi } from '../api/receiptEnquiryApi'
import type { CodeName, ReceiptAllocation, ReceiptDetail, ReceiptInvoice, ReceiptPosting, ReceiptRow, ReceiptSearchResult } from '../types'

interface Values {
  receiptNoFrom: string
  receiptNoTo: string
  receiptDateFrom: string
  receiptDateTo: string
  receiptType: string
  payor: string
  chequeNo: string
  batchNo: string
  posted: string
  description: string
  caseNo: string
}

const defaults: Values = {
  receiptNoFrom: '',
  receiptNoTo: '',
  receiptDateFrom: '',
  receiptDateTo: '',
  receiptType: '',
  payor: '',
  chequeNo: '',
  batchNo: '',
  posted: '',
  description: '',
  caseNo: '',
}

const schema: yup.ObjectSchema<Values> = yup.object({
  receiptNoFrom: optionalText(),
  receiptNoTo: optionalText(),
  receiptDateFrom: dmyDate(),
  receiptDateTo: dmyDate(),
  receiptType: optionalText(),
  payor: optionalText(),
  chequeNo: optionalText(),
  batchNo: optionalText(),
  posted: optionalText(),
  description: optionalText(),
  caseNo: optionalText(),
})

const iso = (dmy: string) => {
  const d = parseDmy(dmy)
  return d ? `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}` : undefined
}

const options = (list: CodeName[] | undefined, showCode = true): Option[] =>
  (list ?? []).map((o) => ({ value: o.code, label: showCode && o.code !== o.name ? `${o.code} - ${o.name}` : o.name }))

const money = (v: number | null | undefined) => (v == null ? '' : formatMoney(v))

const receiptColumns: GridColumn<ReceiptRow>[] = [
  { key: 'receiptNo', label: 'Receipt No' },
  { key: 'receiptDate', label: 'Receipt Date', value: (r) => formatDate(r.receiptDate), sortBy: (r) => r.receiptDate ?? '' },
  { key: 'receiptType', label: 'Type' },
  { key: 'amount', label: 'Amount', align: 'right', value: (r) => money(r.amount), sortBy: (r) => r.amount ?? 0 },
  { key: 'description', label: 'Description' },
  { key: 'payor', label: 'Payor' },
  { key: 'chequeNo', label: 'Chq No' },
  { key: 'allocationLines', label: 'Claim Lines', align: 'right' },
  { key: 'allocated', label: 'Allocated', align: 'right', value: (r) => money(r.allocated), sortBy: (r) => r.allocated ?? 0 },
  { key: 'posted', label: 'Posted', align: 'center', value: (r) => (r.posted ? 'Yes' : 'No') },
  { key: 'batchNo', label: 'Batch No' },
  { key: 'postDate', label: 'Post Date', value: (r) => formatDate(r.postDate), sortBy: (r) => r.postDate ?? '' },
  { key: 'postUser', label: 'Posted By' },
  { key: 'reversedBy', label: 'Reversed By' },
]

const allocationColumns: GridColumn<ReceiptAllocation>[] = [
  { key: 'caseNo', label: 'Case No' },
  { key: 'claimVersion', label: 'Version' },
  { key: 'bordxNo', label: 'Bordx No' },
  { key: 'allocated', label: 'Allocated', align: 'right', value: (r) => money(r.allocated), sortBy: (r) => r.allocated ?? 0 },
  { key: 'bankCharge', label: 'Bank Charge', align: 'right', value: (r) => money(r.bankCharge) },
  { key: 'chequeNo', label: 'Chq No' },
  { key: 'accPeriod', label: 'A/C Period' },
  { key: 'remark', label: 'Remark' },
  { key: 'updatedBy', label: 'Updated By' },
  { key: 'updatedOn', label: 'Updated On', value: (r) => formatDate(r.updatedOn), sortBy: (r) => r.updatedOn ?? '' },
]

const invoiceColumns: GridColumn<ReceiptInvoice>[] = [
  { key: 'invoiceNo', label: 'Invoice No' },
  { key: 'invoiceDate', label: 'Invoice Date', value: (r) => formatDate(r.invoiceDate) },
  { key: 'members', label: 'Members', align: 'right' },
  { key: 'billAmount', label: 'Bill Amount', align: 'right', value: (r) => money(r.billAmount) },
  { key: 'gstAmount', label: 'GST', align: 'right', value: (r) => money(r.gstAmount) },
]

const postingColumns: GridColumn<ReceiptPosting>[] = [
  { key: 'postType', label: 'Post Type' },
  { key: 'batchNo', label: 'Batch No' },
  { key: 'postDate', label: 'Post Date', value: (r) => formatDate(r.postDate) },
  { key: 'postBy', label: 'Posted By' },
  { key: 'accPeriod', label: 'A/C Period' },
  { key: 'rows', label: 'Rows', align: 'right' },
]

const exportColumns: CsvColumn<ReceiptRow>[] = receiptColumns.map((c) => ({
  label: c.label,
  value: (r) => (c.value ? c.value(r) : (r[c.key as keyof ReceiptRow] as string | number | null)),
}))

/** Finance &gt; Receipt Enquiry (read only). */
export function ReceiptEnquiryPage() {
  const navigate = useNavigate()
  const lookups = useQuery({ queryKey: ['finance', 'receipt-enquiry', 'lookups'], queryFn: receiptEnquiryApi.lookups })
  const [result, setResult] = useState<ReceiptSearchResult | null>(null)
  const [detail, setDetail] = useState<ReceiptDetail | null>(null)
  const [tab, setTab] = useState(0)
  const [busy, setBusy] = useState(false)
  const { register, handleSubmit, reset, control } = useForm<Values>({ resolver: yupResolver(schema), defaultValues: defaults, mode: 'onTouched' })

  const search = handleSubmit(async (v) => {
    setBusy(true)
    setDetail(null)
    try {
      const found = await receiptEnquiryApi.search({
        receiptNoFrom: v.receiptNoFrom,
        receiptNoTo: v.receiptNoTo,
        receiptDateFrom: iso(v.receiptDateFrom),
        receiptDateTo: iso(v.receiptDateTo),
        receiptType: v.receiptType,
        payor: v.payor,
        chequeNo: v.chequeNo,
        batchNo: v.batchNo,
        posted: v.posted,
        description: v.description,
        caseNo: v.caseNo,
      })
      setResult(found)
      if (found.rows.length === 0) notify('No record found!', 'error')
      if (found.truncated) notify('Only the first 5000 receipts are listed. Narrow the search to see the rest.', 'warn')
    } catch (e) {
      notify(errorMessage(e), 'error')
    } finally {
      setBusy(false)
    }
  })

  async function open(row: ReceiptRow) {
    try {
      const d = await receiptEnquiryApi.get(row.id)
      setDetail(d)
      setTab(d.allocations.length > 0 ? 0 : d.invoices.length > 0 ? 1 : 2)
    } catch (e) {
      notify(errorMessage(e), 'error')
    }
  }

  function exportList() {
    if (!result || result.rows.length === 0) return notify('Report cannot be printed without any record.', 'info')
    downloadCsv('receipt-enquiry.csv', exportColumns, result.rows)
  }

  function clear() {
    reset(defaults)
    setResult(null)
    setDetail(null)
  }

  const r = detail?.receipt
  return (
    <PageShell title="Receipt Enquiry" subtitle="Receipts with the claims they were allocated to, the fee invoice they pay and their SUN posting.">
      <form onSubmit={search} noValidate className="screen-form">
        <fieldset>
          <legend>Selection Criteria</legend>
          <TextField label="Receipt No from" maxLength={40} autoFocus {...register('receiptNoFrom')} />
          <TextField label="Receipt No to" maxLength={40} {...register('receiptNoTo')} />
          <DateField control={control} name="receiptDateFrom" label="Receipt Date from" />
          <DateField control={control} name="receiptDateTo" label="Receipt Date to" />
          <SelectField label="Receipt Type" options={options(lookups.data?.receiptTypes, false)} {...register('receiptType')} />
          <ComboField label="Payor" options={options(lookups.data?.payors)} {...register('payor')} />
          <TextField label="Chq No" maxLength={40} {...register('chequeNo')} />
          <TextField label="SUN Batch No" maxLength={30} {...register('batchNo')} />
          <SelectField label="Posted to SUN" options={options(lookups.data?.postedStatuses, false)} {...register('posted')} />
          <TextField label="Description contains" maxLength={100} {...register('description')} />
          <TextField label="Case No" maxLength={30} hint="Receipts allocated to this case" {...register('caseNo')} />
        </fieldset>

        <ActionBar label="Receipt enquiry actions">
          <Button variant="primary" type="submit" busy={busy} busyLabel="Searching…">
            Search
          </Button>
          <Button variant="ghost" onClick={exportList} disabled={busy}>
            Print to File
          </Button>
          <Button variant="link" onClick={clear}>
            Clear
          </Button>
          <span className="spacer" />
          <Stat label="Records" value={result?.rows.length ?? 0} />
          <Stat label="Total Amt" value={money(result?.total ?? 0)} />
          <Button variant="link" onClick={() => navigate('/')}>
            Exit
          </Button>
        </ActionBar>

        <DataGrid
          caption="Receipts"
          columns={receiptColumns}
          rows={result?.rows ?? []}
          rowKey={(row) => String(row.id)}
          selectedKey={r ? String(r.id) : null}
          onSelect={open}
          empty="No receipts. Enter at least one criterion and press Search."
        />
      </form>

      {detail && r && (
        <section className="receipt-detail" aria-label={`Receipt ${r.receiptNo ?? ''}`}>
          <ActionBar label="Receipt summary">
            <Stat label="Receipt" value={r.receiptNo ?? '—'} />
            <Stat label="Date" value={formatDate(r.receiptDate)} />
            <Stat label="Amount" value={money(r.amount)} />
            <Stat label="Allocated" value={money(r.allocated) || '—'} />
            <Stat label="Unallocated" value={money(detail.unallocated) || '—'} />
            <Stat label="Posted" value={r.posted ? `Yes (batch ${r.batchNo ?? ''})` : 'No'} />
            {r.reversedBy && <Stat label="Reversed By" value={r.reversedBy} />}
          </ActionBar>
          <Tabs
            label="Receipt details"
            tabs={[`Claim Lines (${detail.allocations.length})`, `Fee Invoice (${detail.invoices.length})`, `SUN Postings (${detail.postings.length})`]}
            panels={[
              <DataGrid
                key="lines"
                caption="Claim allocation lines"
                columns={allocationColumns}
                rows={detail.allocations}
                rowKey={(a) => String(a.id)}
                empty="No claim lines (fee receipt)."
              />,
              <DataGrid
                key="invoice"
                caption="Fee invoice"
                columns={invoiceColumns}
                rows={detail.invoices}
                rowKey={(i) => i.invoiceNo ?? ''}
                empty="The description does not name a member MCO invoice."
              />,
              <DataGrid
                key="postings"
                caption="SUN postings"
                columns={postingColumns}
                rows={detail.postings}
                rowKey={(p) => `${p.postType}-${p.batchNo}-${p.postDate}`}
                empty="No SUN posting rows reference this receipt."
              />,
            ]}
            active={tab}
            onChange={setTab}
          />
        </section>
      )}
    </PageShell>
  )
}
