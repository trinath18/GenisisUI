// Finance > Electronic Banking (legacy frmFileExportBankESP; its source is not available). Lists the ONLINE payment vouchers (members and
// hospitals) and builds the bank payment file of the ticked ones, in the layout configured on the server (CSV by default). Read only.

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
import { api, errorMessage, rethrowBlobError } from '../../../../api/client'
import { fileNameFromDisposition, saveBlob } from '../../../../lib/download'
import { formatDate, formatMoney } from '../../../../lib/format'
import { parseDmy } from '../../../../lib/masks'
import { ask, notify } from '../../../../lib/notifyStore'
import { dmyDate, optionalText } from '../../../../lib/validation'
import { tickable, tickedTotal } from '../bankRules'
import type { BankPaymentRow } from '../bankRules'

const BASE_URL = '/api/finance/electronic-banking'

interface Values {
  payeeType: string
  pvDateFrom: string
  pvDateTo: string
  creditRef: string
  pvNoFrom: string
  pvNoTo: string
}

const defaults: Values = { payeeType: '', pvDateFrom: '', pvDateTo: '', creditRef: '', pvNoFrom: '', pvNoTo: '' }
const schema: yup.ObjectSchema<Values> = yup.object({
  payeeType: optionalText(),
  pvDateFrom: dmyDate(),
  pvDateTo: dmyDate(),
  creditRef: optionalText(),
  pvNoFrom: optionalText(),
  pvNoTo: optionalText(),
})

const iso = (dmy: string) => {
  const d = parseDmy(dmy)
  return d ? `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}` : undefined
}
const payeeTypes: Option[] = [
  { value: 'M', label: 'M - Member' },
  { value: 'H', label: 'H - Hospital' },
]
const params = (v: Values) =>
  Object.fromEntries(
    Object.entries({
      payeeType: v.payeeType,
      pvDateFrom: iso(v.pvDateFrom),
      pvDateTo: iso(v.pvDateTo),
      creditRef: v.creditRef,
      pvNoFrom: v.pvNoFrom,
      pvNoTo: v.pvNoTo,
    }).filter(([, value]) => value !== undefined && String(value).trim() !== ''),
  )

const columns: GridColumn<BankPaymentRow>[] = [
  { key: 'payeeType', label: 'Payee Type' },
  { key: 'pvNo', label: 'PV No' },
  { key: 'pvDate', label: 'PV Date', value: (r) => formatDate(r.pvDate), sortBy: (r) => r.pvDate ?? '' },
  { key: 'creditDate', label: 'Credit Date', value: (r) => formatDate(r.creditDate), sortBy: (r) => r.creditDate ?? '' },
  { key: 'payee', label: 'Payee' },
  { key: 'bank', label: 'Bank' },
  { key: 'accountMasked', label: 'Account' },
  { key: 'amount', label: 'Amount', align: 'right', value: (r) => formatMoney(r.amount), sortBy: (r) => r.amount },
  { key: 'cases', label: 'Cases', align: 'right' },
  { key: 'problem', label: 'Problem' },
]

/** Finance &gt; Electronic Banking. */
export function ElectronicBankingPage() {
  const navigate = useNavigate()
  const [rows, setRows] = useState<BankPaymentRow[]>([])
  const [ready, setReady] = useState(0)
  const [checked, setChecked] = useState<ReadonlySet<string>>(new Set())
  const [busy, setBusy] = useState(false)
  const { register, handleSubmit, reset, control, getValues } = useForm<Values>({ resolver: yupResolver(schema), defaultValues: defaults, mode: 'onTouched' })

  const search = handleSubmit(async (v) => {
    setBusy(true)
    setChecked(new Set())
    try {
      const { data } = await api.get<{ rows: BankPaymentRow[]; total: number; ready: number; truncated: boolean }>(`${BASE_URL}/search`, { params: params(v) })
      setRows(data.rows)
      setReady(data.ready)
      if (data.rows.length === 0) notify('No record found!', 'error')
      else if (data.ready < data.rows.length)
        notify(`${data.rows.length - data.ready} payment(s) have no usable bank account and cannot go into the file (see Problem).`, 'warn')
      if (data.truncated) notify('Only the first 5000 payments are listed. Narrow the search to see the rest.', 'warn')
    } catch (e) {
      notify(errorMessage(e), 'error')
    } finally {
      setBusy(false)
    }
  })

  function changeChecked(next: Set<string>) {
    const { accepted, refused } = tickable(rows, next)
    if (refused > 0 && accepted.size < next.size) notify('Payments without a usable bank account cannot be selected.', 'error')
    setChecked(accepted)
  }

  async function download() {
    if (checked.size === 0) return notify('Please select the record', 'error')
    if (!(await ask(`Create the bank file for ${checked.size} payment(s), total ${formatMoney(tickedTotal(rows, checked))}?`))) return
    setBusy(true)
    try {
      const response = await api
        .post<Blob>(`${BASE_URL}/file`, { ...params(getValues()), keys: [...checked] }, { responseType: 'blob' })
        .catch(rethrowBlobError)
      saveBlob(response.data, fileNameFromDisposition(response.headers['content-disposition'], 'online-payments.csv'))
      notify(`Bank file created for ${checked.size} payment(s).`, 'success')
    } catch (e) {
      notify(errorMessage(e), 'error')
    } finally {
      setBusy(false)
    }
  }

  function clear() {
    reset(defaults)
    setRows([])
    setReady(0)
    setChecked(new Set())
  }

  return (
    <PageShell title="Electronic Banking" subtitle="ONLINE payments to members and hospitals, and the bank payment file of the ticked ones.">
      <form onSubmit={search} noValidate className="screen-form">
        <fieldset>
          <legend>Payments</legend>
          <SelectField label="Payee Type" options={payeeTypes} {...register('payeeType')} />
          <DateField control={control} name="pvDateFrom" label="PV Date from" />
          <DateField control={control} name="pvDateTo" label="PV Date to" />
          <TextField label="Credit Ref (ddmmyyyy)" maxLength={40} hint="The crediting date on the vouchers" {...register('creditRef')} />
          <TextField label="PV No from" maxLength={30} {...register('pvNoFrom')} />
          <TextField label="PV No to" maxLength={30} {...register('pvNoTo')} />
        </fieldset>
        <ActionBar label="Electronic banking actions">
          <Button variant="primary" type="submit" busy={busy} busyLabel="Working…">
            Search
          </Button>
          <Button variant="ghost" onClick={download} disabled={busy || checked.size === 0}>
            Create Bank File ({checked.size})
          </Button>
          <Button variant="link" onClick={clear}>
            Clear
          </Button>
          <span className="spacer" />
          <Stat label="Payments" value={rows.length} />
          <Stat label="Ready" value={ready} />
          <Stat label="Selected Amt" value={formatMoney(tickedTotal(rows, checked))} />
          <Button variant="link" onClick={() => navigate('/')}>
            Exit
          </Button>
        </ActionBar>
        <DataGrid
          caption="ONLINE payments"
          columns={columns}
          rows={rows}
          rowKey={(r) => r.key}
          check={{ checked, onChange: changeChecked }}
          tall
          empty="No payments. Enter the PV date, credit reference or PV no. and press Search."
        />
      </form>
    </PageShell>
  )
}
