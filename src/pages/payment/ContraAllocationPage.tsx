// Payment > Contra Allocation (legacy frmContraAllocation, "Contra Allocation"): search the contra rows, tick the ones to allocate (Check All ticks every row that can be) and Update: they get one allocation number.

import { useState } from 'react'
import type { FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { useForm, useWatch } from 'react-hook-form'
import { yupResolver } from '@hookform/resolvers/yup'
import { CheckField, DateField, SelectField, TextField } from '../../components/Field'
import { DataGrid } from '../../components/DataGrid'
import type { GridColumn } from '../../components/DataGrid'
import { ActionBar, PageShell, Stat } from '../../components/Screen'
import { Button } from '../../components/Button'
import { ask, notify } from '../../lib/notifyStore'
import { api, errorMessage } from '../../api/client'
import { TextRange } from '../worksheet/RangeFields'
import { useTickList } from '../worksheet/useTickList'
import {
  contraColumns,
  doneMessage,
  rowKey,
  scanProblem,
  searchDefaults,
  searchParams,
  searchSchema,
  statusOptions,
  tickProblem,
  tickableKeys,
  updateProblem,
} from './contraAllocationRules'
import type { ContraRow, SearchResult, SearchValues } from './contraAllocationRules'

const base = '/api/payment/contra-allocation'
const columns: GridColumn<ContraRow>[] = contraColumns.map((c, i) => ({ key: `c${i}`, label: c.label, value: c.value, align: c.right ? 'right' : undefined }))

export function ContraAllocationPage() {
  const navigate = useNavigate()
  const [busy, setBusy] = useState(false)
  const [allocationNo, setAllocationNo] = useState<string | null>(null)
  const list = useTickList<ContraRow>(rowKey, tickProblem)
  const form = useForm<SearchValues>({ resolver: yupResolver(searchSchema), defaultValues: searchDefaults, mode: 'onTouched' })
  const { register, handleSubmit, control, setValue, reset, formState } = form
  const scan = useWatch({ control, name: 'scan' })

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

  /** cmdSearch_Click: a range replaces the list; a scanned claim is added to it. */
  async function searchFor(values: SearchValues) {
    setAllocationNo(null)
    const problem = scanProblem(values, list.rows)
    if (problem) return notify(problem, 'error')
    await run(async () => {
      const { data } = await api.get<SearchResult>(base, { params: searchParams(values) })
      if (values.scan) {
        list.append(data.rows)
        setValue('caseFrom', '')
      } else list.replace(data.rows)
      if (data.truncated) notify('Only the first 5,000 rows are shown. Narrow the search to see the rest.', 'info')
    })
  }
  const search = (e?: FormEvent) => handleSubmit(searchFor)(e)

  /** cmdUpdate_Click: "Please select the record", "Do you want to update the record?", then the allocation. */
  async function update() {
    const problem = updateProblem(list.ticked)
    if (problem) return notify(problem, 'error')
    if (!(await ask('Do you want to update the record?'))) return
    await run(async () => {
      const { data } = await api.post<{ allocationNo: string; count: number }>(`${base}/allocate`, { ids: list.ticked.map((r) => r.id) })
      setAllocationNo(data.allocationNo)
      notify(doneMessage(data.allocationNo), 'success')
      list.clear()
    })
  }

  /** cmdCheckALL_Click. */
  const checkAll = () => list.change(new Set([...list.checked, ...tickableKeys(list.rows)]))

  /** ChkScan_Click clears the list. */
  const clear = () => {
    reset(searchDefaults)
    list.clear()
    setAllocationNo(null)
  }

  return (
    <PageShell title="Contra Allocation" subtitle="Allocate the contra rows of the receipts.">
      <form onSubmit={(e: FormEvent) => void search(e)} noValidate className="screen-form">
        <fieldset>
          <legend>Search</legend>
          <TextRange label="Ref No" from="refFrom" to="refTo" register={register} errors={formState.errors} />
          <SelectField label="Status" blank={false} options={statusOptions} {...register('status')} />
          <CheckField label="Use Scan" {...register('scan', { onChange: () => list.clear() })} />
          {scan ? (
            <TextField label="Case No" maxLength={15} error={formState.errors.caseFrom} {...register('caseFrom')} />
          ) : (
            <TextRange label="Case No" from="caseFrom" to="caseTo" register={register} errors={formState.errors} />
          )}
          <TextRange label="Contra Case No" from="contraFrom" to="contraTo" register={register} errors={formState.errors} />
          <TextRange label="Allocation No" from="allocationFrom" to="allocationTo" register={register} errors={formState.errors} />
          <DateField control={control} name="dateFrom" label="Allocation Date from" />
          <DateField control={control} name="dateTo" label="Allocation Date to" />
        </fieldset>
        <ActionBar label="Contra allocation actions">
          <Button variant="primary" type="submit" busy={busy} busyLabel="Searching…">
            Search
          </Button>
          <Button variant="ghost" onClick={checkAll} disabled={busy || list.rows.length === 0}>
            Check All
          </Button>
          <Button variant="ghost" onClick={() => void update()} disabled={busy}>
            Update
          </Button>
          <Button variant="link" onClick={clear}>
            Clear
          </Button>
          <span className="spacer" />
          <Stat label="Record(s)" value={list.rows.length} />
          {allocationNo && <Stat label="Allocation No" value={allocationNo} />}
          <Button variant="link" onClick={() => navigate('/')}>
            Close
          </Button>
        </ActionBar>
        <DataGrid
          caption="Contra allocation"
          columns={columns}
          rows={list.rows}
          rowKey={rowKey}
          check={{ checked: list.checked, onChange: list.change }}
          tall
          empty="No contra rows. Enter the criteria and press Search."
        />
      </form>
    </PageShell>
  )
}
