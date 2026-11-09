// Payment > PV Update (Manual) (legacy FrmPaymentManual; rebuilt, its source is missing): find a PV and correct its cheque and payee details on every row. The rules are in paymentPvUpdateRules.

import { useState } from 'react'
import type { FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { useForm, useWatch } from 'react-hook-form'
import { yupResolver } from '@hookform/resolvers/yup'
import { DateField, SelectField, TextField } from '../../components/Field'
import { DataGrid } from '../../components/DataGrid'
import type { GridColumn } from '../../components/DataGrid'
import { ActionBar, PageShell, Stat } from '../../components/Screen'
import { Button } from '../../components/Button'
import type { CsvColumn } from '../../lib/exportCsv'
import { downloadCsv } from '../../lib/exportCsv'
import { ask, notify } from '../../lib/notifyStore'
import { api, errorMessage } from '../../api/client'
import { DateRange } from '../worksheet/RangeFields'
import { modeOptions } from './paymentToHospitalRules'
import {
  confirmText,
  editDefaults,
  editSchema,
  editValuesOf,
  listColumns,
  lockReason,
  onlineChequeNo,
  rowColumns,
  saveBody,
  searchDefaults,
  searchParams,
  searchSchema,
  sourceOptions,
} from './paymentPvUpdateRules'
import type { EditValues, PvDetail, PvListResult, PvListRow, PvRow, SearchValues } from './paymentPvUpdateRules'

const base = '/api/payment/pv-update'

function grid<T extends object>(cols: (CsvColumn<T> & { right?: boolean })[]): GridColumn<T>[] {
  return cols.map((c, i) => ({ key: `c${i}`, label: c.label, value: c.value, align: c.right ? 'right' : undefined }))
}
const pvColumns = grid<PvListRow>(listColumns)
const detailColumns = grid<PvRow>(rowColumns)

export function PaymentPvUpdatePage() {
  const navigate = useNavigate()
  const [busy, setBusy] = useState(false)
  const [result, setResult] = useState<PvListResult | null>(null)
  const [detail, setDetail] = useState<PvDetail | null>(null)
  const filter = useForm<SearchValues>({ resolver: yupResolver(searchSchema), defaultValues: searchDefaults, mode: 'onTouched' })
  const edit = useForm<EditValues>({ resolver: yupResolver(editSchema), defaultValues: editDefaults, mode: 'onTouched' })
  const errors = edit.formState.errors
  const mode = useWatch({ control: edit.control, name: 'paymentMode' })
  const chequeDate = useWatch({ control: edit.control, name: 'chequeDate' })
  const locked = detail ? lockReason(detail) : null

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

  async function load(source: string, pvNo: string) {
    const { data } = await api.get<PvDetail>(`${base}/${source}/${encodeURIComponent(pvNo)}`)
    setDetail(data)
    edit.reset(editValuesOf(data))
  }

  const search = filter.handleSubmit((values) =>
    run(async () => {
      const { data } = await api.get<PvListResult>(base, { params: searchParams(values) })
      setResult(data)
      setDetail(null)
      if (data.rows.length === 0) notify('No record found!', 'error')
      else if (data.truncated) notify('Only the first 5,000 PVs are shown. Narrow the search to see the rest.', 'info')
      if (data.rows.length === 1) await load(values.source, data.rows[0].pvNo)
    }),
  )

  const save = edit.handleSubmit(async (values) => {
    if (!detail) return notify('Please select the PV.', 'error')
    if (locked) return notify(locked, 'error')
    if (!(await ask(confirmText(detail, values)))) return
    await run(async () => {
      const { data } = await api.put<{ rows: number }>(base, saveBody(detail, values))
      notify(`PV ${detail.pvNo} saved (${data.rows} row(s)).`, 'success')
      await load(detail.source, detail.pvNo)
    })
  })

  return (
    <PageShell title="PV Update (Manual)" subtitle="Correct the cheque and payee details of a payment voucher already written.">
      <form onSubmit={(e: FormEvent) => void search(e)} noValidate className="screen-form">
        <fieldset>
          <legend>Find the PV</legend>
          <SelectField label="Paid To" blank={false} options={sourceOptions} {...filter.register('source')} />
          <TextField label="PV No" maxLength={30} {...filter.register('pvNo')} />
          <TextField label="Case No" maxLength={30} {...filter.register('caseNo')} />
          <DateRange label="PV Date" from="dateFrom" to="dateTo" control={filter.control} register={filter.register} />
        </fieldset>
        <ActionBar label="Search actions">
          <Button variant="primary" type="submit" busy={busy} busyLabel="Searching…">
            Search
          </Button>
          <Button
            variant="ghost"
            onClick={() =>
              result?.rows.length ? downloadCsv('pv-list.csv', listColumns, result.rows) : notify('Report cannot be printed without any record.', 'info')
            }
          >
            Print to File
          </Button>
          <span className="spacer" />
          <Stat label="PVs" value={result?.rows.length ?? 0} />
          <Button variant="link" onClick={() => navigate('/')}>
            Close
          </Button>
        </ActionBar>
      </form>

      <DataGrid
        caption="Payment vouchers"
        columns={pvColumns}
        rows={result?.rows ?? []}
        rowKey={(r) => r.pvNo}
        selectedKey={detail?.pvNo ?? null}
        onSelect={(r) => void run(() => load(filter.getValues('source'), r.pvNo))}
        empty="No PVs. Enter the criteria and press Search."
      />

      {detail && (
        <form onSubmit={(e: FormEvent) => void save(e)} noValidate className="screen-form">
          <fieldset disabled={!!locked}>
            <legend>{locked ? `PV ${detail.pvNo}: ${locked}` : `PV ${detail.pvNo}`}</legend>
            <SelectField label="Payment Mode" blank={false} options={modeOptions} {...edit.register('paymentMode')} />
            {mode === 'ONLINE' ? (
              <TextField label="Cheque No" readOnly value={onlineChequeNo(chequeDate)} hint="The cheque date, for an online payment" />
            ) : (
              <TextField label="Cheque No" required maxLength={40} error={errors.chequeNo} {...edit.register('chequeNo')} />
            )}
            <DateField control={edit.control} name="chequeDate" label="Cheque Date" required />
            {detail.source === 'member' && <TextField label="Pay To" wide maxLength={120} error={errors.payTo} {...edit.register('payTo')} />}
            <TextField label="Bank" maxLength={100} error={errors.bank} {...edit.register('bank')} />
            <TextField label="Account No" maxLength={60} error={errors.account} {...edit.register('account')} />
            <TextField label="Remark" wide maxLength={400} error={errors.remark} {...edit.register('remark')} />
          </fieldset>
          <ActionBar label="PV actions">
            <Button variant="primary" type="submit" busy={busy} busyLabel="Saving…" disabled={!!locked}>
              Save
            </Button>
            <Button variant="link" onClick={() => edit.reset(editValuesOf(detail))}>
              Undo
            </Button>
          </ActionBar>
        </form>
      )}

      {detail && <DataGrid caption={`Rows of PV ${detail.pvNo}`} columns={detailColumns} rows={detail.rows} rowKey={(r) => String(r.id)} />}
    </PageShell>
  )
}
