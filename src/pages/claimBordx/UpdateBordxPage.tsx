// Claim Bordx > Update Bordx (legacy frmUpdateWS2Bordx, "Update Bordx"): search the pending worksheets, tick the ones to put into a bordx, give the bordx number and date (a new bordx, or one that exists),
// the accounting period and the dates it was sent to and received from the payor and MNRB, and optionally the MNRB receipt, then Update.

import { useState } from 'react'
import type { FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { yupResolver } from '@hookform/resolvers/yup'
import { CheckField, ComboField, DateField, SelectField, TextField } from '../../components/Field'
import { DataGrid } from '../../components/DataGrid'
import type { GridColumn } from '../../components/DataGrid'
import { ActionBar, PageShell, Stat } from '../../components/Screen'
import { Button } from '../../components/Button'
import { formatMoney } from '../../lib/format'
import { ask, notify } from '../../lib/notifyStore'
import { api, errorMessage } from '../../api/client'
import { DateRange, TextRange } from '../worksheet/RangeFields'
import { useTickList } from '../worksheet/useTickList'
import { useWorksheetLookups } from '../worksheet/useWorksheetLookups'
import {
  amountOptions,
  monthOptions,
  rowKey,
  searchDefaults,
  searchParams,
  searchSchema,
  tickProblem,
  totalApproved,
  updateColumns,
  updateDefaults,
  updateProblem,
  updateRequest,
  updateSchema,
  yearOptions,
} from './updateBordxRules'
import type { SearchValues, UpdateRow, UpdateSearchResult, UpdateValues } from './updateBordxRules'

const base = '/api/claim-bordx/update-bordx'
const money = /Amt/
const columns: GridColumn<UpdateRow>[] = updateColumns.map((c, i) => ({
  key: `c${i}`,
  label: c.label,
  value: c.value,
  align: money.test(c.label) ? 'right' : undefined,
}))

export function UpdateBordxPage() {
  const navigate = useNavigate()
  const lookups = useWorksheetLookups()
  const [busy, setBusy] = useState(false)
  const [found, setFound] = useState(0)
  const [today] = useState(() => new Date())
  const list = useTickList<UpdateRow>(rowKey, tickProblem)
  const searchForm = useForm<SearchValues>({ resolver: yupResolver(searchSchema), defaultValues: searchDefaults, mode: 'onTouched' })
  const updateForm = useForm<UpdateValues>({ resolver: yupResolver(updateSchema), defaultValues: updateDefaults, mode: 'onTouched' })

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

  /** CmdSearch_Click + WorksheetTrackingListing. */
  const search = searchForm.handleSubmit((v) =>
    run(async () => {
      const { data } = await api.get<UpdateSearchResult>(base, { params: searchParams(v) })
      list.replace(data.rows)
      setFound(data.rows.length)
      if (data.rows.length === 0) notify('No record found!', 'error')
      else if (data.truncated) notify('Only the first 5,000 rows are shown. Narrow the search to see the rest.', 'info')
    }),
  )

  /** CmdBordx_Click: the checks in the desktop's order, "Do you want to update the record?", then the update. */
  const update = updateForm.handleSubmit((v) => {
    const problem = updateProblem(list.rows.length, list.ticked.length, v)
    if (problem) {
      if (problem.field) {
        updateForm.setError(problem.field, { message: problem.message })
        return updateForm.setFocus(problem.field)
      }
      return notify(problem.message, 'error')
    }
    return run(async () => {
      if (!(await ask('Do you want to update the record?'))) return
      await api.post(base, updateRequest(list.ticked, v))
      notify('Record Saved', 'success')
      list.clear()
      setFound(0)
      updateForm.reset(updateDefaults)
    })
  })

  function clear() {
    searchForm.reset(searchDefaults)
    updateForm.reset(updateDefaults)
    list.clear()
    setFound(0)
  }

  const error = updateForm.formState.errors

  return (
    <PageShell title="Update Bordx" subtitle="Put pending worksheets into a bordx.">
      <form onSubmit={(e: FormEvent) => void search(e)} noValidate className="screen-form">
        <fieldset>
          <legend>Search</legend>
          <ComboField label="Payor" options={lookups.payors} {...searchForm.register('payor')} />
          <SelectField label="Amount" options={amountOptions} {...searchForm.register('amount')} />
          <CheckField label="Search Empty Data (worksheets in no bordx)" {...searchForm.register('unbordxedOnly')} />
          <TextRange label="Case No" from="caseFrom" to="caseTo" maxLength={30} register={searchForm.register} errors={searchForm.formState.errors} />
          <TextRange label="Bordx No" from="bordxFrom" to="bordxTo" maxLength={40} register={searchForm.register} errors={searchForm.formState.errors} />
          <DateRange label="DOA" from="doaFrom" to="doaTo" control={searchForm.control} register={searchForm.register} />
          <DateRange label="DOD" from="dodFrom" to="dodTo" control={searchForm.control} register={searchForm.register} />
        </fieldset>
      </form>

      <DataGrid
        caption="Pending worksheets"
        columns={columns}
        rows={list.rows}
        rowKey={rowKey}
        check={{ checked: list.checked, onChange: list.change }}
        tall
        empty="No worksheets. Enter the criteria and press Search."
      />

      <form onSubmit={(e: FormEvent) => void update(e)} noValidate className="screen-form">
        <fieldset>
          <legend>Update bordx</legend>
          <TextField label="Bordx No" required maxLength={40} error={error.bordxNo} {...updateForm.register('bordxNo')} />
          <DateField control={updateForm.control} name="bordxDate" label="Bordx Date" />
          <SelectField label="A/C Period Mth" options={monthOptions} {...updateForm.register('acMonth')} />
          <SelectField label="A/C Period Yr" options={yearOptions(today)} {...updateForm.register('acYear')} />
          <DateField control={updateForm.control} name="toPayorDate" label="To Payor" />
          <DateField control={updateForm.control} name="fromPayorDate" label="FR Payor" />
          <DateField control={updateForm.control} name="toMnrbDate" label="To MNRB" />
          <DateField control={updateForm.control} name="fromMnrbDate" label="FR MNRB" />
        </fieldset>
        <fieldset>
          <legend>MNRB receipt (written when a Rec No is given)</legend>
          <TextField label="Rec No" maxLength={30} error={error.receiptNo} {...updateForm.register('receiptNo')} />
          <DateField control={updateForm.control} name="receiptDate" label="Rec Date" />
          <TextField label="Cheque Amt" error={error.chequeAmount} {...updateForm.register('chequeAmount')} />
          <TextField label="Cheque No" maxLength={40} {...updateForm.register('chequeNo')} />
        </fieldset>
      </form>

      <ActionBar label="Update bordx actions">
        <Button variant="primary" onClick={() => void search()} busy={busy} busyLabel="Working…">
          Search
        </Button>
        <Button variant="ghost" onClick={() => void update()} disabled={busy}>
          Update
        </Button>
        <Button variant="link" onClick={clear}>
          Clear
        </Button>
        <span className="spacer" />
        <Stat label="Records" value={found} />
        <Stat label="Total Amt" value={formatMoney(totalApproved(list.rows))} />
        <Stat label="Amt Checked" value={formatMoney(totalApproved(list.ticked))} />
        <Button variant="link" onClick={() => navigate('/')}>
          Close
        </Button>
      </ActionBar>
    </PageShell>
  )
}
