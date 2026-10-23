// Finance > Suspend / Active (legacy frmPaymentMBMReissue; its source is not available). Member payment vouchers (Payment2MBM): stop a
// payment (C cancel / E expired cheque: a row with the negative amount under the same PV no.) and re-issue it (an R row under a new PV no.).

import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { yupResolver } from '@hookform/resolvers/yup'
import * as yup from 'yup'
import { DateField, SelectField, TextField } from '../../../../components/Field'
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
import { reissueProblem, statusLabel, stopProblem } from '../voucherRules'
import type { VoucherRow } from '../voucherRules'

const BASE_URL = '/api/finance/suspend-active'

interface Values {
  pvNoFrom: string
  pvNoTo: string
  pvDateFrom: string
  pvDateTo: string
  caseNo: string
  chequeNo: string
  payee: string
  status: string
  actionDate: string
  stopStatus: string
  newChequeNo: string
  paymentMode: string
  payeeBank: string
  payeeAccount: string
  remark: string
}

const today = () => {
  const d = new Date()
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`
}
const defaults = (): Values => ({
  pvNoFrom: '',
  pvNoTo: '',
  pvDateFrom: '',
  pvDateTo: '',
  caseNo: '',
  chequeNo: '',
  payee: '',
  status: '',
  actionDate: today(),
  stopStatus: 'C',
  newChequeNo: '',
  paymentMode: 'ONLINE',
  payeeBank: '',
  payeeAccount: '',
  remark: '',
})
const schema: yup.ObjectSchema<Values> = yup.object({
  pvNoFrom: optionalText(),
  pvNoTo: optionalText(),
  pvDateFrom: dmyDate(),
  pvDateTo: dmyDate(),
  caseNo: optionalText(),
  chequeNo: optionalText(),
  payee: optionalText(),
  status: optionalText(),
  actionDate: dmyDate(),
  stopStatus: optionalText(),
  newChequeNo: optionalText(),
  paymentMode: optionalText(),
  payeeBank: optionalText(),
  payeeAccount: optionalText(),
  remark: optionalText(),
})

const iso = (dmy: string) => {
  const d = parseDmy(dmy)
  return d ? `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}` : undefined
}
const money = (v: number | null | undefined) => (v == null ? '' : formatMoney(v))
const statuses: Option[] = ['A', 'C', 'E', 'R'].map((c) => ({ value: c, label: statusLabel(c) }))
const stopStatuses: Option[] = ['C', 'E'].map((c) => ({ value: c, label: statusLabel(c) }))
const modes: Option[] = [
  { value: 'ONLINE', label: 'ONLINE' },
  { value: 'CHEQUE', label: 'CHEQUE' },
]

const columns: GridColumn<VoucherRow>[] = [
  { key: 'pvNo', label: 'PV No' },
  { key: 'pvDate', label: 'PV Date', value: (r) => formatDate(r.pvDate), sortBy: (r) => r.pvDate ?? '' },
  { key: 'status', label: 'Status', value: (r) => statusLabel(r.status) },
  { key: 'amount', label: 'Amount', align: 'right', value: (r) => money(r.amount), sortBy: (r) => r.amount ?? 0 },
  { key: 'chequeNo', label: 'Chq No / TT Ref' },
  { key: 'chequeDate', label: 'Chq Date', value: (r) => formatDate(r.chequeDate) },
  { key: 'paymentMode', label: 'Mode' },
  { key: 'payTo', label: 'Pay To' },
  { key: 'payeeBank', label: 'Bank' },
  { key: 'payeeAccount', label: 'Account' },
  { key: 'caseNo', label: 'Case No' },
  { key: 'claimVersion', label: 'Ver' },
  { key: 'stoppedAs', label: 'Stopped', value: (r) => (r.stoppedAs ? `${r.stoppedAs} on ${formatDate(r.stoppedOn)}` : '') },
  { key: 'reissuedAs', label: 'Re-issued As' },
  { key: 'remark', label: 'Remark' },
]

/** Finance &gt; Suspend / Active. */
export function SuspendActivePage() {
  const navigate = useNavigate()
  const [rows, setRows] = useState<VoucherRow[]>([])
  const [selected, setSelected] = useState<VoucherRow | null>(null)
  const [busy, setBusy] = useState(false)
  const { register, handleSubmit, reset, control, getValues } = useForm<Values>({ resolver: yupResolver(schema), defaultValues: defaults(), mode: 'onTouched' })

  async function load(v: Values) {
    const { data } = await api.get<{ rows: VoucherRow[]; truncated: boolean }>(`${BASE_URL}/search`, {
      params: Object.fromEntries(
        Object.entries({
          pvNoFrom: v.pvNoFrom,
          pvNoTo: v.pvNoTo,
          pvDateFrom: iso(v.pvDateFrom),
          pvDateTo: iso(v.pvDateTo),
          caseNo: v.caseNo,
          chequeNo: v.chequeNo,
          payee: v.payee,
          status: v.status,
        }).filter(([, value]) => value !== undefined && String(value).trim() !== ''),
      ),
    })
    setRows(data.rows)
    if (data.truncated) notify('Only the first 5000 vouchers are listed. Narrow the search to see the rest.', 'warn')
    return data.rows
  }

  const search = handleSubmit(async (v) => {
    setBusy(true)
    setSelected(null)
    try {
      if ((await load(v)).length === 0) notify('No record found!', 'error')
    } catch (e) {
      notify(errorMessage(e), 'error')
    } finally {
      setBusy(false)
    }
  })

  async function act(kind: 'stop' | 'reissue') {
    if (!selected) return notify('Please select the payment', 'error')
    const v = getValues()
    const problem = kind === 'stop' ? stopProblem(selected) : reissueProblem(selected)
    if (problem) return notify(problem, 'error')
    if (!v.actionDate) return notify('Please Enter Date', 'error')
    if (kind === 'reissue') {
      if (!v.newChequeNo.trim()) return notify('Please Enter Cheque No / TT Reference', 'error')
      if (!v.remark.trim()) return notify('Please Enter Remark', 'error')
    }
    const question =
      kind === 'stop'
        ? `${v.stopStatus === 'C' ? 'Cancel' : 'Expire'} PV ${selected.pvNo} (${money(selected.amount)})? A ${v.stopStatus} row with the negative amount will be added.`
        : `Re-issue PV ${selected.pvNo} (${money(selected.amount)}) under a new PV no. with ${v.paymentMode} ${v.newChequeNo.trim()}?`
    if (!(await ask(question))) return
    setBusy(true)
    try {
      const body =
        kind === 'stop'
          ? { status: v.stopStatus, actionDate: iso(v.actionDate) ?? null, remark: v.remark }
          : {
              actionDate: iso(v.actionDate) ?? null,
              chequeNo: v.newChequeNo.trim(),
              paymentMode: v.paymentMode,
              payeeBank: v.payeeBank,
              payeeAccount: v.payeeAccount,
              remark: v.remark.trim(),
            }
      const { data } = await api.post<{ message: string; pvNo?: string }>(`${BASE_URL}/${selected.id}/${kind}`, body)
      notify(data.message, 'success')
      const refreshed = await load(getValues())
      setSelected(refreshed.find((r) => r.id === selected.id) ?? null)
      reset({ ...getValues(), newChequeNo: '', payeeBank: '', payeeAccount: '', remark: '' })
    } catch (e) {
      notify(errorMessage(e), 'error')
    } finally {
      setBusy(false)
    }
  }

  function clear() {
    reset(defaults())
    setRows([])
    setSelected(null)
  }

  const canStop = selected ? !stopProblem(selected) : false
  const canReissue = selected ? !reissueProblem(selected) : false
  return (
    <PageShell title="Suspend / Active" subtitle="Member payment vouchers: cancel or expire a payment, then re-issue it under a new PV number.">
      <form onSubmit={search} noValidate className="screen-form">
        <fieldset>
          <legend>Find the payment</legend>
          <TextField label="PV No from" maxLength={30} autoFocus {...register('pvNoFrom')} />
          <TextField label="PV No to" maxLength={30} {...register('pvNoTo')} />
          <DateField control={control} name="pvDateFrom" label="PV Date from" />
          <DateField control={control} name="pvDateTo" label="PV Date to" />
          <TextField label="Case No" maxLength={30} {...register('caseNo')} />
          <TextField label="Chq No / TT Ref" maxLength={40} {...register('chequeNo')} />
          <TextField label="Payee contains" maxLength={120} {...register('payee')} />
          <SelectField label="PV Status" options={statuses} {...register('status')} />
        </fieldset>
        <ActionBar label="Payment search actions">
          <Button variant="primary" type="submit" busy={busy} busyLabel="Working…">
            Search
          </Button>
          <Button variant="link" onClick={clear}>
            Clear
          </Button>
          <span className="spacer" />
          <Stat label="Records" value={rows.length} />
          <Button variant="link" onClick={() => navigate('/')}>
            Exit
          </Button>
        </ActionBar>
        <DataGrid
          caption="Member payment vouchers"
          columns={columns}
          rows={rows}
          rowKey={(r) => String(r.id)}
          selectedKey={selected ? String(selected.id) : null}
          onSelect={setSelected}
          empty="No payments. Enter at least one criterion and press Search."
        />

        {selected && (
          <>
            <fieldset>
              <legend>
                PV {selected.pvNo} · {statusLabel(selected.status)} · {money(selected.amount)} · {selected.payTo}
              </legend>
              <DateField control={control} name="actionDate" label="Date" required />
              <TextField label="Remark" maxLength={400} wide {...register('remark')} />
              {canStop && <SelectField label="Stop as" blank={false} options={stopStatuses} {...register('stopStatus')} />}
              {canReissue && (
                <>
                  <TextField label="New Chq No / TT Ref" required maxLength={40} {...register('newChequeNo')} />
                  <SelectField label="Payment Mode" blank={false} options={modes} {...register('paymentMode')} />
                  <TextField label="Payee Bank" maxLength={200} hint="Blank keeps the current bank" {...register('payeeBank')} />
                  <TextField label="Payee Account No" maxLength={60} hint="Blank keeps the current account" {...register('payeeAccount')} />
                </>
              )}
            </fieldset>
            {!canStop && !canReissue && (
              <p className="warning" role="alert">
                {selected.reissuedAs
                  ? `This payment was stopped and re-issued as ${selected.reissuedAs}.`
                  : 'Nothing to do on this row: pick the active payment (status A or R) to stop it, or the stopped one to re-issue it.'}
              </p>
            )}
            <ActionBar label="Payment actions">
              <Button variant="primary" onClick={() => act('stop')} disabled={busy || !canStop}>
                Stop Payment
              </Button>
              <Button variant="primary" onClick={() => act('reissue')} disabled={busy || !canReissue}>
                Re-issue
              </Button>
            </ActionBar>
          </>
        )}
      </form>
    </PageShell>
  )
}
