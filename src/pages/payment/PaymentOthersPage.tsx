// Payment > Others (legacy FrmPaymentOthers; rebuilt, its source is missing): write a payment voucher to any payee, paid by cheque, with the next PV number of the type chosen; and list the vouchers
// written (Print to File saves the list).

import { useState } from 'react'
import type { FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { yupResolver } from '@hookform/resolvers/yup'
import { DateField, SelectField, TextField } from '../../components/Field'
import { DataGrid } from '../../components/DataGrid'
import type { GridColumn } from '../../components/DataGrid'
import { ActionBar, PageShell, Stat } from '../../components/Screen'
import { Button } from '../../components/Button'
import { downloadCsv } from '../../lib/exportCsv'
import { formatMoney } from '../../lib/format'
import { ask, notify } from '../../lib/notifyStore'
import { api, errorMessage } from '../../api/client'
import { DateRange, TextRange } from '../worksheet/RangeFields'
import {
  confirmText,
  othersColumns,
  prefixOptions,
  searchDefaults,
  searchParams,
  searchSchema,
  voucherBody,
  voucherDefaults,
  voucherSchema,
} from './paymentOthersRules'
import type { OthersRow, SearchResult, SearchValues, VoucherValues } from './paymentOthersRules'

const base = '/api/payment/others'
const columns: GridColumn<OthersRow>[] = othersColumns.map((c, i) => ({ key: `c${i}`, label: c.label, value: c.value, align: c.right ? 'right' : undefined }))

export function PaymentOthersPage() {
  const navigate = useNavigate()
  const [busy, setBusy] = useState(false)
  const [result, setResult] = useState<SearchResult | null>(null)
  const voucher = useForm<VoucherValues>({ resolver: yupResolver(voucherSchema), defaultValues: voucherDefaults(), mode: 'onTouched' })
  const filter = useForm<SearchValues>({ resolver: yupResolver(searchSchema), defaultValues: searchDefaults, mode: 'onTouched' })
  const errors = voucher.formState.errors

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

  const load = (values: SearchValues) =>
    run(async () => {
      const { data } = await api.get<SearchResult>(base, { params: searchParams(values) })
      setResult(data)
      if (data.count === 0) notify('No record found!', 'error')
      else if (data.truncated) notify('Only the first 5,000 vouchers are shown. Narrow the search to see the rest.', 'info')
    })
  const search = filter.handleSubmit(load)

  const save = voucher.handleSubmit(async (values) => {
    if (!(await ask(confirmText(values)))) return
    await run(async () => {
      const { data } = await api.post<{ id: number; pvNo: string }>(base, voucherBody(values))
      notify(`PV ${data.pvNo} saved.`, 'success')
      voucher.reset({ ...voucherDefaults(), prefix: values.prefix, pvDate: values.pvDate })
      filter.reset({ ...searchDefaults, pvFrom: data.pvNo, pvTo: data.pvNo })
      const { data: list } = await api.get<SearchResult>(base, { params: searchParams({ ...searchDefaults, pvFrom: data.pvNo, pvTo: data.pvNo }) })
      setResult(list)
    })
  })

  return (
    <PageShell title="Payment (Others)" subtitle="A payment voucher to any payee, paid by cheque.">
      <form onSubmit={(e: FormEvent) => void save(e)} noValidate className="screen-form">
        <fieldset>
          <legend>New voucher</legend>
          <SelectField label="PV Type" blank={false} options={prefixOptions} {...voucher.register('prefix')} />
          <DateField control={voucher.control} name="pvDate" label="PV Date" required />
          <TextField label="Pay To" required wide maxLength={120} error={errors.payTo} {...voucher.register('payTo')} />
          <TextField label="Amount" required inputMode="decimal" error={errors.amount} {...voucher.register('amount')} />
          <TextField label="Cheque No" required maxLength={40} error={errors.chequeNo} {...voucher.register('chequeNo')} />
          <DateField control={voucher.control} name="chequeDate" label="Cheque Date" hint="The PV date when empty" />
          <TextField label="Payee Bank" maxLength={200} error={errors.payeeBank} {...voucher.register('payeeBank')} />
          <TextField label="Payee A/C No" maxLength={60} error={errors.payeeAccount} {...voucher.register('payeeAccount')} />
          <TextField label="Case No" maxLength={30} error={errors.caseNo} {...voucher.register('caseNo')} />
          <TextField label="Bank Charges" inputMode="decimal" error={errors.bankCharges} {...voucher.register('bankCharges')} />
          <TextField label="Remark" wide maxLength={400} error={errors.remark} {...voucher.register('remark')} />
        </fieldset>
        <ActionBar label="Voucher actions">
          <Button variant="primary" type="submit" busy={busy} busyLabel="Saving…">
            Save
          </Button>
          <Button variant="link" onClick={() => voucher.reset(voucherDefaults())}>
            Clear
          </Button>
        </ActionBar>
      </form>

      <form onSubmit={(e: FormEvent) => void search(e)} noValidate className="screen-form">
        <fieldset>
          <legend>Vouchers</legend>
          <TextRange label="PV No" from="pvFrom" to="pvTo" register={filter.register} errors={filter.formState.errors} />
          <DateRange label="PV Date" from="dateFrom" to="dateTo" control={filter.control} register={filter.register} />
          <TextField label="Pay To" {...filter.register('payTo')} />
          <TextField label="Case No" {...filter.register('caseNo')} />
        </fieldset>
        <ActionBar label="Voucher list actions">
          <Button variant="primary" type="submit" busy={busy} busyLabel="Searching…">
            Search
          </Button>
          <Button
            variant="ghost"
            onClick={() =>
              result?.count ? downloadCsv('payment-others.csv', othersColumns, result.rows) : notify('Report cannot be printed without any record.', 'info')
            }
          >
            Print to File
          </Button>
          <span className="spacer" />
          <Stat label="Records" value={result?.count ?? 0} />
          <Stat label="Total Amt" value={formatMoney(result?.totalAmount ?? 0)} />
          <Button variant="link" onClick={() => navigate('/')}>
            Close
          </Button>
        </ActionBar>
      </form>

      <DataGrid
        caption="Payment vouchers (others)"
        columns={columns}
        rows={result?.rows ?? []}
        rowKey={(r) => String(r.id)}
        tall
        empty="No vouchers. Press Search."
      />
    </PageShell>
  )
}
