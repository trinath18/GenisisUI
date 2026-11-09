// Payment > Payor (legacy FrmPaymentPayor; rebuilt, its source is missing): search the reversed claims not yet paid back to their payor, tick the ones to pay (Check All ticks every one that can be),
// enter the PV date and the first cheque number, and Generate PV: one voucher per payor, the cheques numbered on. The vouchers written are listed and can be saved to a file.

import { useState } from 'react'
import type { FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { yupResolver } from '@hookform/resolvers/yup'
import { ComboField, DateField, TextField } from '../../components/Field'
import { DataGrid } from '../../components/DataGrid'
import type { GridColumn } from '../../components/DataGrid'
import { ActionBar, PageShell, Stat } from '../../components/Screen'
import { Button } from '../../components/Button'
import { downloadCsv } from '../../lib/exportCsv'
import type { CsvColumn } from '../../lib/exportCsv'
import { formatMoney } from '../../lib/format'
import { ask, notify } from '../../lib/notifyStore'
import { api, errorMessage } from '../../api/client'
import { DateRange, TextRange } from '../worksheet/RangeFields'
import { useTickList } from '../worksheet/useTickList'
import { useWorksheetLookups } from '../worksheet/useWorksheetLookups'
import {
  claimColumns,
  confirmText,
  pvBody,
  pvDefaults,
  pvSchema,
  rowKey,
  searchDefaults,
  searchParams,
  searchSchema,
  tickProblem,
  tickableKeys,
  voucherColumns,
} from './paymentToPayorRules'
import type { PayorClaim, PayorVoucher, PvValues, SearchResult, SearchValues } from './paymentToPayorRules'

const base = '/api/payment/to-payor'
const grid = <T extends object>(cols: (CsvColumn<T> & { right?: boolean })[]): GridColumn<T>[] =>
  cols.map((c, i) => ({ key: `c${i}`, label: c.label, value: c.value, align: c.right ? 'right' : undefined }))
const claimGrid = grid(claimColumns)
const voucherGrid = grid(voucherColumns)

export function PaymentToPayorPage() {
  const navigate = useNavigate()
  const lookups = useWorksheetLookups()
  const [busy, setBusy] = useState(false)
  const [vouchers, setVouchers] = useState<PayorVoucher[]>([])
  const list = useTickList<PayorClaim>(rowKey, tickProblem)
  const form = useForm<SearchValues>({ resolver: yupResolver(searchSchema), defaultValues: searchDefaults, mode: 'onTouched' })
  const pv = useForm<PvValues>({ resolver: yupResolver(pvSchema), defaultValues: pvDefaults(), mode: 'onTouched' })
  const tickedTotal = list.ticked.reduce((s, r) => s + (r.amount ?? 0), 0)

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

  const search = form.handleSubmit((values) =>
    run(async () => {
      const { data } = await api.get<SearchResult>(base, { params: searchParams(values), timeout: 300000 })
      list.replace(data.rows)
      if (data.count === 0) notify('No record found!', 'error')
      else if (data.truncated) notify('Only the first 5,000 claims are shown. Narrow the search to see the rest.', 'info')
    }),
  )

  const generate = pv.handleSubmit(async (values) => {
    if (list.ticked.length === 0) return notify('Please select the claims to pay.', 'error')
    if (!(await ask(confirmText(list.ticked, values)))) return
    await run(async () => {
      const { data } = await api.post<{ vouchers: PayorVoucher[] }>(`${base}/vouchers`, pvBody(values, list.ticked))
      setVouchers(data.vouchers)
      notify(`${data.vouchers.length} PV(s) generated: ${data.vouchers.map((v) => v.pvNo).join(', ')}.`, 'success')
      const paid = new Set(list.ticked.map(rowKey))
      list.replace(list.rows.filter((r) => !paid.has(rowKey(r))))
    })
  })

  const checkAll = () => list.change(new Set([...list.checked, ...tickableKeys(list.rows)]))

  function clear() {
    form.reset(searchDefaults)
    pv.reset(pvDefaults())
    list.clear()
    setVouchers([])
  }

  return (
    <PageShell title="Payment To Payor" subtitle="Pay back the payors for the reversed claims: one PV per payor.">
      <form onSubmit={(e: FormEvent) => void search(e)} noValidate className="screen-form">
        <fieldset>
          <legend>Reversed claims</legend>
          <ComboField label="Payor" options={lookups.payors} {...form.register('payor')} />
          <TextRange label="Case No" from="caseFrom" to="caseTo" register={form.register} errors={form.formState.errors} />
          <TextRange label="Bordx No" from="bordxFrom" to="bordxTo" register={form.register} errors={form.formState.errors} />
          <DateRange label="Close Date" from="closeFrom" to="closeTo" control={form.control} register={form.register} />
        </fieldset>
        <ActionBar label="Search actions">
          <Button variant="primary" type="submit" busy={busy} busyLabel="Searching…">
            Search
          </Button>
          <Button variant="ghost" onClick={checkAll} disabled={busy || list.rows.length === 0}>
            Check All
          </Button>
          <Button variant="link" onClick={clear}>
            Clear
          </Button>
          <span className="spacer" />
          <Stat label="Claims" value={list.rows.length} />
          <Stat label="Ticked" value={list.ticked.length} />
          <Stat label="Ticked Amt" value={formatMoney(tickedTotal)} />
        </ActionBar>
      </form>

      <DataGrid
        caption="Reversed claims to pay back"
        columns={claimGrid}
        rows={list.rows}
        rowKey={rowKey}
        check={{ checked: list.checked, onChange: list.change }}
        tall
        empty="No claims. Enter the criteria and press Search."
      />

      <form onSubmit={(e: FormEvent) => void generate(e)} noValidate className="screen-form">
        <fieldset>
          <legend>Payment voucher</legend>
          <DateField control={pv.control} name="pvDate" label="PV Date" required />
          <TextField label="First Cheque No" maxLength={40} required error={pv.formState.errors.chequeNo} {...pv.register('chequeNo')} />
          <TextField label="Remark" wide maxLength={400} error={pv.formState.errors.remark} {...pv.register('remark')} />
        </fieldset>
        <ActionBar label="Payment voucher actions">
          <Button variant="primary" type="submit" busy={busy} busyLabel="Generating…">
            Generate PV
          </Button>
          <Button
            variant="ghost"
            onClick={() => (vouchers.length ? downloadCsv('payment-to-payor.csv', voucherColumns, vouchers) : notify('No PV has been generated.', 'info'))}
          >
            Print to File
          </Button>
          <span className="spacer" />
          <Button variant="link" onClick={() => navigate('/')}>
            Close
          </Button>
        </ActionBar>
      </form>

      {vouchers.length > 0 && <DataGrid caption="Vouchers generated" columns={voucherGrid} rows={vouchers} rowKey={(v) => v.pvNo} />}
    </PageShell>
  )
}
