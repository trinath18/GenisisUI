// Finance > Reverse Receipt (legacy frmReverseReceipt; its source is not available). Find the receipt, check what is behind it, then
// reverse it: a new receipt with the negative amount (and negative claim lines) is created; the original is never deleted.

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
import { Button } from '../../../../components/Button'
import { api, errorMessage } from '../../../../api/client'
import { formatDate, formatMoney } from '../../../../lib/format'
import { parseDmy } from '../../../../lib/masks'
import { ask, notify } from '../../../../lib/notifyStore'
import { dmyDate, optionalText } from '../../../../lib/validation'
import { receiptEnquiryApi } from '../../receiptEnquiry/api/receiptEnquiryApi'
import type { CodeName, ReceiptAllocation, ReceiptDetail, ReceiptRow, ReceiptSearchResult } from '../../receiptEnquiry/types'
import { currentPeriod, reversalProblem, reverseProblem } from '../reverseRules'

interface Values {
  receiptNoFrom: string
  receiptNoTo: string
  receiptDateFrom: string
  receiptDateTo: string
  receiptType: string
  payor: string
  caseNo: string
  reversalDate: string
  accPeriod: string
}

const today = () => {
  const d = new Date()
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`
}

const defaults = (): Values => ({
  receiptNoFrom: '',
  receiptNoTo: '',
  receiptDateFrom: '',
  receiptDateTo: '',
  receiptType: '',
  payor: '',
  caseNo: '',
  reversalDate: today(),
  accPeriod: currentPeriod(),
})

const schema: yup.ObjectSchema<Values> = yup.object({
  receiptNoFrom: optionalText(),
  receiptNoTo: optionalText(),
  receiptDateFrom: dmyDate(),
  receiptDateTo: dmyDate(),
  receiptType: optionalText(),
  payor: optionalText(),
  caseNo: optionalText(),
  reversalDate: dmyDate(),
  accPeriod: optionalText(),
})

const iso = (dmy: string) => {
  const d = parseDmy(dmy)
  return d ? `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}` : undefined
}
const options = (list: CodeName[] | undefined, showCode = true): Option[] =>
  (list ?? []).map((o) => ({ value: o.code, label: showCode && o.code !== o.name ? `${o.code} - ${o.name}` : o.name }))
const money = (v: number | null | undefined) => (v == null ? '' : formatMoney(v))

const columns: GridColumn<ReceiptRow>[] = [
  { key: 'receiptNo', label: 'Receipt No' },
  { key: 'receiptDate', label: 'Receipt Date', value: (r) => formatDate(r.receiptDate), sortBy: (r) => r.receiptDate ?? '' },
  { key: 'receiptType', label: 'Type' },
  { key: 'amount', label: 'Amount', align: 'right', value: (r) => money(r.amount), sortBy: (r) => r.amount ?? 0 },
  { key: 'description', label: 'Description' },
  { key: 'payor', label: 'Payor' },
  { key: 'allocationLines', label: 'Claim Lines', align: 'right' },
  { key: 'posted', label: 'Posted', align: 'center', value: (r) => (r.posted ? 'Yes' : 'No') },
  { key: 'reversedBy', label: 'Reversed By' },
]

const lineColumns: GridColumn<ReceiptAllocation>[] = [
  { key: 'caseNo', label: 'Case No' },
  { key: 'claimVersion', label: 'Version' },
  { key: 'bordxNo', label: 'Bordx No' },
  { key: 'allocated', label: 'Allocated', align: 'right', value: (r) => money(r.allocated) },
  { key: 'accPeriod', label: 'A/C Period' },
]

/** Finance &gt; Reverse Receipt. */
export function ReverseReceiptPage() {
  const navigate = useNavigate()
  const lookups = useQuery({ queryKey: ['finance', 'receipt-enquiry', 'lookups'], queryFn: receiptEnquiryApi.lookups })
  const [result, setResult] = useState<ReceiptSearchResult | null>(null)
  const [detail, setDetail] = useState<ReceiptDetail | null>(null)
  const [busy, setBusy] = useState(false)
  const { register, handleSubmit, reset, control, getValues } = useForm<Values>({ resolver: yupResolver(schema), defaultValues: defaults(), mode: 'onTouched' })

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
        caseNo: v.caseNo,
      })
      setResult(found)
      if (found.rows.length === 0) notify('No record found!', 'error')
    } catch (e) {
      notify(errorMessage(e), 'error')
    } finally {
      setBusy(false)
    }
  })

  async function open(row: ReceiptRow) {
    try {
      setDetail(await receiptEnquiryApi.get(row.id))
    } catch (e) {
      notify(errorMessage(e), 'error')
    }
  }

  async function reverse() {
    if (!detail) return notify('Please select the receipt', 'error')
    const r = detail.receipt
    const problem = reverseProblem(r) ?? reversalProblem({ reversalDate: getValues('reversalDate'), accPeriod: getValues('accPeriod') })
    if (problem) return notify(problem, 'error')
    const lines = detail.allocations.length
    const confirm = `Reverse receipt ${r.receiptNo} (${money(r.amount)})? A new receipt of ${money(-(r.amount ?? 0))}${lines ? ` with ${lines} negative claim line(s)` : ''} will be created.`
    if (!(await ask(confirm))) return
    setBusy(true)
    try {
      const { data } = await api.post<{ id: number; receiptNo: string; lines: number; message: string }>(`/api/finance/reverse-receipt/${r.id}`, {
        reversalDate: iso(getValues('reversalDate')) ?? null,
        accPeriod: getValues('accPeriod').trim(),
      })
      notify(data.message, 'success')
      setDetail(await receiptEnquiryApi.get(r.id))
      setResult((prev) => (prev ? { ...prev, rows: prev.rows.map((x) => (x.id === r.id ? { ...x, reversedBy: data.receiptNo } : x)) } : prev))
    } catch (e) {
      notify(errorMessage(e), 'error')
    } finally {
      setBusy(false)
    }
  }

  function clear() {
    reset(defaults())
    setResult(null)
    setDetail(null)
  }

  const r = detail?.receipt
  const blocked = r ? reverseProblem(r) : null
  return (
    <PageShell title="Reverse Receipt" subtitle="Reverses a receipt with a new negative receipt; the original stays on record.">
      <form onSubmit={search} noValidate className="screen-form">
        <fieldset>
          <legend>Find the receipt</legend>
          <TextField label="Receipt No from" maxLength={40} autoFocus {...register('receiptNoFrom')} />
          <TextField label="Receipt No to" maxLength={40} {...register('receiptNoTo')} />
          <DateField control={control} name="receiptDateFrom" label="Receipt Date from" />
          <DateField control={control} name="receiptDateTo" label="Receipt Date to" />
          <SelectField label="Receipt Type" options={options(lookups.data?.receiptTypes, false)} {...register('receiptType')} />
          <ComboField label="Payor" options={options(lookups.data?.payors)} {...register('payor')} />
          <TextField label="Case No" maxLength={30} {...register('caseNo')} />
        </fieldset>
        <ActionBar label="Receipt search actions">
          <Button variant="primary" type="submit" busy={busy} busyLabel="Working…">
            Search
          </Button>
          <Button variant="link" onClick={clear}>
            Clear
          </Button>
          <span className="spacer" />
          <Stat label="Records" value={result?.rows.length ?? 0} />
          <Button variant="link" onClick={() => navigate('/')}>
            Exit
          </Button>
        </ActionBar>
        <DataGrid
          caption="Receipts"
          columns={columns}
          rows={result?.rows ?? []}
          rowKey={(row) => String(row.id)}
          selectedKey={r ? String(r.id) : null}
          onSelect={open}
          empty="No receipts. Enter at least one criterion and press Search."
        />

        {detail && r && (
          <>
            <fieldset>
              <legend>
                Reverse receipt {r.receiptNo} ({r.receiptType}, {money(r.amount)}, {formatDate(r.receiptDate)})
              </legend>
              <DateField control={control} name="reversalDate" label="Reversal Date" required />
              <TextField label="A/C Period (MM/YYYY)" maxLength={7} required {...register('accPeriod')} />
            </fieldset>
            {blocked && (
              <p className="warning" role="alert">
                {blocked}
              </p>
            )}
            <ActionBar label="Reverse actions">
              <Button variant="primary" onClick={reverse} busy={busy} busyLabel="Reversing…" disabled={!!blocked}>
                Reverse
              </Button>
              <span className="spacer" />
              <Stat label="Claim Lines" value={detail.allocations.length} />
              <Stat label="Posted" value={r.posted ? `Yes (batch ${r.batchNo ?? ''})` : 'No'} />
              {r.reversedBy && <Stat label="Reversed By" value={r.reversedBy} />}
            </ActionBar>
            {detail.allocations.length > 0 && (
              <DataGrid caption={`Claim lines of ${r.receiptNo}`} columns={lineColumns} rows={detail.allocations} rowKey={(a) => String(a.id)} />
            )}
          </>
        )}
      </form>
    </PageShell>
  )
}
