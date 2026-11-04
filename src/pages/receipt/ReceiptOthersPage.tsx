// Receipt > Others (legacy FrmReceiptHOS, "Receipt (Others)"): receipts from a hospital (or "OTHER"). Search lists them, Save adds one; Edit, then a row in the list, loads it for Update; Delete removes the row selected.

import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { useForm, useWatch } from 'react-hook-form'
import { yupResolver } from '@hookform/resolvers/yup'
import { useQuery } from '@tanstack/react-query'
import { CheckField, ComboField, DateField, NumberField, SelectField, TextField } from '../../components/Field'
import { DataGrid } from '../../components/DataGrid'
import type { GridColumn } from '../../components/DataGrid'
import { ActionBar, PageShell, Stat } from '../../components/Screen'
import { Button } from '../../components/Button'
import { formatMoney } from '../../lib/format'
import { downloadCsvRows } from '../../lib/exportCsv'
import { ask, notify } from '../../lib/notifyStore'
import { api, errorMessage } from '../../api/client'
import { DateRange, TextRange } from '../worksheet/RangeFields'
import {
  entryDefaults,
  entryFromRow,
  entryRequest,
  entrySchema,
  hospitalOptions,
  monthOptions,
  periodOf,
  receiptColumns,
  rowKey,
  saveProblem,
  searchDefaults,
  searchParams,
  searchSchema,
  updateProblem,
  yearOptions,
} from './receiptOthersRules'
import type { EntryValues, Hospital, ReceiptRow, SearchResult, SearchValues } from './receiptOthersRules'

const base = '/api/receipt/others'
const columns: GridColumn<ReceiptRow>[] = receiptColumns.map((c, i) => ({ key: `c${i}`, label: c.label, value: c.value, align: c.right ? 'right' : undefined }))

export function ReceiptOthersPage() {
  const navigate = useNavigate()
  const hospitals = useQuery({
    queryKey: ['receipt-others', 'hospitals'],
    queryFn: async () => (await api.get<Hospital[]>(`${base}/hospitals`)).data,
    staleTime: 10 * 60 * 1000,
  })
  const [rows, setRows] = useState<ReceiptRow[]>([])
  const [total, setTotal] = useState(0)
  const [selected, setSelected] = useState<ReceiptRow | null>(null)
  const [editing, setEditing] = useState(false)
  const [busy, setBusy] = useState(false)
  const search = useForm<SearchValues>({ resolver: yupResolver(searchSchema), defaultValues: searchDefaults, mode: 'onTouched' })
  const entry = useForm<EntryValues>({ resolver: yupResolver(entrySchema), defaultValues: entryDefaults, mode: 'onTouched' })
  const receiptDate = useWatch({ control: entry.control, name: 'receiptDate' })
  const hospitalList = hospitals.data ?? []

  /** txtReceiptDate_LostFocus: the A/C period follows a valid receipt date. */
  useEffect(() => {
    const period = periodOf(receiptDate)
    if (period && !editing) {
      entry.setValue('accMonth', period.accMonth)
      entry.setValue('accYear', period.accYear)
    }
  }, [receiptDate, editing, entry])

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

  /** ReceiptFrHOSListing: the receipts that match, with their total. */
  async function list(values: SearchValues) {
    setSelected(null)
    try {
      const { data } = await api.get<SearchResult>(base, { params: searchParams(values) })
      setRows(data.rows)
      setTotal(data.totalAmount)
      if (data.truncated) notify('Only the first 5,000 rows are shown. Narrow the search to see the rest.', 'info')
    } catch (e) {
      setRows([])
      setTotal(0)
      throw e
    }
  }

  const doSearch = (e?: FormEvent) => search.handleSubmit((v) => run(() => list(v)))(e)

  /** cmdSave_Click: the boxes in the desktop's order, "Do you want to save the record?", then the new receipt and the whole list again. */
  const save = entry.handleSubmit(async (v) => {
    const problem = saveProblem(v)
    if (problem) {
      entry.setError(problem.field, { message: problem.message })
      return entry.setFocus(problem.field)
    }
    if (!(await ask('Do you want to save the record?'))) return
    await run(async () => {
      const { data } = await api.post<{ message: string }>(base, entryRequest(v))
      entry.reset(entryDefaults)
      await list(searchDefaults)
      notify(data.message, 'success')
    })
  })

  /** cmdUpdate_Click: needs Edit and a row; "Do you want to update the record?", then the change and the search again. */
  const update = entry.handleSubmit(async (v) => {
    if (!editing) return
    const problem = updateProblem(v, selected)
    if (problem) {
      entry.setError(problem.field, { message: problem.message })
      return notify(problem.message, 'error')
    }
    if (!(await ask('Do you want to update the record?'))) return
    await run(async () => {
      const { data } = await api.put<{ message: string }>(`${base}/${selected!.id}`, entryRequest(v))
      notify(data.message, 'success')
      entry.reset(entryDefaults)
      setEditing(false)
      await list(search.getValues())
    })
  })

  /** CmdDelete_Click: "Please search the record", "Do you want to delete this record?", then the receipt of the row selected. */
  async function remove() {
    if (rows.length === 0) return notify('Please search the record', 'error')
    if (!selected) return notify('Please select the record', 'error')
    if (!(await ask('Do you want to delete this record?'))) return
    await run(async () => {
      const { data } = await api.delete<{ message: string }>(`${base}/${selected.id}`)
      notify(data.message, 'success')
      entry.reset(entryDefaults)
      setEditing(false)
      await list(searchDefaults)
    })
  }

  /** lstReceiptHOS_Click in Edit: the row is loaded into the boxes and Save is off. */
  function select(row: ReceiptRow) {
    setSelected(row)
    if (editing) entry.reset(entryFromRow(row, hospitalList))
  }

  /** cmdEdit_Click: a row can now be loaded; the one selected already is loaded. */
  function edit() {
    setEditing(true)
    if (selected) entry.reset(entryFromRow(selected, hospitalList))
  }

  /** CmdClear_Click. */
  function clear() {
    search.reset(searchDefaults)
    entry.reset(entryDefaults)
    setRows([])
    setTotal(0)
    setSelected(null)
    setEditing(false)
  }

  /** cmdEXPtoExcel_Click: the list as a CSV file. */
  function print() {
    if (rows.length === 0) return notify('Report cannot be printed without any record.', 'info')
    downloadCsvRows('receipt-others.csv', [receiptColumns.map((c) => c.label), ...rows.map((r) => receiptColumns.map((c) => c.value(r)))])
  }

  const { register, control, formState } = search
  const errors = entry.formState.errors

  return (
    <PageShell title="Receipt (Others)" subtitle="Receipts from hospitals and others.">
      <form onSubmit={(e: FormEvent) => void doSearch(e)} noValidate className="screen-form">
        <fieldset>
          <legend>Search</legend>
          <ComboField label="Hospital" options={hospitalOptions(hospitalList)} {...register('hospital')} />
          <TextRange label="Receipt No" from="noFrom" to="noTo" register={register} errors={formState.errors} empty="blankNo" />
          <DateRange label="Receipt Date" from="dateFrom" to="dateTo" control={control} register={register} empty="blankDate" />
          <SelectField label="A/C Period Mth from" options={monthOptions} {...register('monthFrom')} />
          <SelectField label="A/C Period Mth to" options={monthOptions} {...register('monthTo')} />
          <CheckField label="A/C Period Mth is empty" {...register('blankMonth')} />
          <SelectField label="A/C Period Yr from" options={yearOptions} {...register('yearFrom')} />
          <SelectField label="A/C Period Yr to" options={yearOptions} {...register('yearTo')} />
          <CheckField label="A/C Period Yr is empty" {...register('blankYear')} />
        </fieldset>
        <ActionBar label="Receipt search actions">
          <Button variant="primary" type="submit" busy={busy} busyLabel="Searching…">
            Search
          </Button>
          <Button variant="ghost" onClick={print} disabled={busy}>
            Print to File
          </Button>
          <Button variant="link" onClick={clear}>
            Clear
          </Button>
          <span className="spacer" />
          <Stat label="Records" value={rows.length} />
          <Stat label="Receipt Amt" value={formatMoney(total)} />
        </ActionBar>
      </form>

      <DataGrid
        caption="Receipts from hospitals and others"
        columns={columns}
        rows={rows}
        rowKey={rowKey}
        selectedKey={selected ? rowKey(selected) : null}
        onSelect={select}
        empty="No receipts. Press Search."
      />

      <form onSubmit={(e: FormEvent) => void (editing ? update(e) : save(e))} noValidate className="screen-form">
        <fieldset>
          <legend>Receipt</legend>
          <ComboField label="Hospital Code" required options={hospitalOptions(hospitalList)} error={errors.hospital} {...entry.register('hospital')} />
          <TextField label="Receipt No" required maxLength={30} error={errors.receiptNo} {...entry.register('receiptNo')} />
          <DateField control={entry.control} name="receiptDate" label="Receipt Date" required />
          <NumberField label="Amount" required error={errors.amount} {...entry.register('amount')} />
          <NumberField label="Bank Charge" error={errors.bankCharge} {...entry.register('bankCharge')} />
          <TextField label="Cheque No" required maxLength={40} error={errors.chequeNo} {...entry.register('chequeNo')} />
          <SelectField label="A/C Period Mth" options={monthOptions} {...entry.register('accMonth')} />
          <SelectField label="A/C Period Yr" options={yearOptions} {...entry.register('accYear')} />
          <TextField label="Remarks" maxLength={100} wide error={errors.remarks} {...entry.register('remarks')} />
        </fieldset>
        <ActionBar label="Receipt actions">
          <Button variant="primary" type="submit" busy={busy} busyLabel="Saving…" disabled={editing}>
            Save
          </Button>
          <Button variant="ghost" onClick={edit} disabled={busy || editing}>
            Edit
          </Button>
          <Button variant="ghost" onClick={() => void update()} disabled={busy || !editing}>
            Update
          </Button>
          <Button variant="danger" onClick={() => void remove()} disabled={busy}>
            Delete
          </Button>
          <span className="spacer" />
          <Button variant="link" onClick={() => navigate('/')}>
            Close
          </Button>
        </ActionBar>
      </form>
    </PageShell>
  )
}
