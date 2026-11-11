// Worksheet > Worksheet Send to A/R (legacy FrmARRecFrCLM, "Date Send to Audit Review"): search cases, tick the ones to send to
// audit review and mark them as sent today by the logged-in user.

import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useForm, useWatch } from 'react-hook-form'
import { yupResolver } from '@hookform/resolvers/yup'
import { CheckField, SelectField, TextField } from '../../components/Field'
import { DataGrid } from '../../components/DataGrid'
import type { GridColumn } from '../../components/DataGrid'
import { ActionBar, PageShell, Stat } from '../../components/Screen'
import { Button } from '../../components/Button'
import { downloadCsv } from '../../lib/exportCsv'
import type { CsvColumn } from '../../lib/exportCsv'
import { ask, notify } from '../../lib/notifyStore'
import { api, errorMessage } from '../../api/client'
import { isoToDmy, S } from '../case/caseShared'
import { DateRange } from './RangeFields'
import { useTickList } from './useTickList'
import { arDefaults, arParams, arSchema, isAlreadyListed, tokenStatusOptions } from './worksheetRules'
import type { ArValues, SearchResult } from './worksheetRules'

interface ArRow {
  caseNo: string
  dateSent: string | null
  passedBy: string | null
  status: string | null
}

const columns: GridColumn<ArRow>[] = [
  { key: 'caseNo', label: 'Case Number' },
  { key: 'dateSent', label: 'Date Send to A/R', value: (r) => isoToDmy(r.dateSent), sortBy: (r) => S(r.dateSent) },
  { key: 'passedBy', label: 'Passed By' },
  { key: 'status', label: 'Status', value: (r) => (r.status === '1' ? 'Passed' : 'Not Yet Passed') },
]

const exportColumns: CsvColumn<ArRow>[] = columns.map((c) => ({ label: c.label, value: (r) => (c.value ? c.value(r) : r[c.key as keyof ArRow]) }))
const rowKey = (r: ArRow) => r.caseNo

async function load(v: ArValues) {
  return (await api.get<SearchResult<ArRow>>('/api/worksheet/send-to-ar/search', { params: arParams(v) })).data
}

export function WorksheetSendToArPage() {
  const navigate = useNavigate()
  const list = useTickList<ArRow>(rowKey)
  const [busy, setBusy] = useState(false)
  const {
    register,
    handleSubmit,
    reset,
    control,
    setValue,
    setFocus,
    getValues,
    formState: { errors },
  } = useForm<ArValues>({ resolver: yupResolver(arSchema), defaultValues: arDefaults, mode: 'onTouched' })
  const useScan = useWatch({ control, name: 'useScan' })

  /** CmdSearch_Click. A scan adds the case to the list; a range replaces the list. */
  const search = handleSubmit(async (v) => {
    if (v.useScan && isAlreadyListed(list.rows, v.wksNoFrom)) return notify('This case is already in the list.', 'info')
    setBusy(true)
    try {
      const found = await load(v)
      if (found.rows.length === 0) notify('No record found!', 'error')
      else if (v.useScan) list.append(found.rows)
      else list.replace(found.rows)
      if (found.truncated) notify('Only the first 5,000 cases are shown. Narrow the search to see the rest.', 'info')
      if (v.useScan) {
        setValue('wksNoFrom', '')
        setFocus('wksNoFrom')
      }
    } catch (e) {
      notify(errorMessage(e), 'error')
    } finally {
      setBusy(false)
    }
  })

  function clear() {
    reset(arDefaults)
    list.clear()
  }

  /** CmdToAC_Click: an empty list, then the ticked cases. */
  async function send() {
    if (list.rows.length === 0) return notify('Please select a record before proceeding!', 'error')
    if (list.ticked.length === 0) return notify('Please select at least one record to be updated!', 'error')
    if (!(await ask('Do you want to update the record?'))) return
    setBusy(true)
    try {
      const v = getValues()
      const { data } = await api.post<{ message: string }>('/api/worksheet/send-to-ar/send', { cases: list.ticked.map((r) => r.caseNo) })
      notify(data.message, 'success')
      list.clear()
      if (!v.useScan) list.replace((await load(v)).rows)
    } catch (e) {
      notify(errorMessage(e), 'error')
    } finally {
      setBusy(false)
    }
  }

  function exportList() {
    if (list.rows.length === 0) return notify('Report cannot be printed without any record.', 'info')
    downloadCsv('worksheets-send-to-ar.csv', exportColumns, list.rows)
  }

  return (
    <PageShell title="Worksheet Send to A/R" subtitle="Search cases, tick the ones to send to audit review and mark them as sent today.">
      <form onSubmit={search} noValidate className="screen-form">
        <fieldset>
          <legend>Selection Criteria</legend>
          <CheckField label="Use Scan" {...register('useScan', { onChange: () => list.clear() })} />
          {useScan ? (
            <TextField label="Case No" required maxLength={20} autoFocus error={errors.wksNoFrom} {...register('wksNoFrom')} />
          ) : (
            <>
              <TextField label="Case No from" maxLength={20} autoFocus {...register('wksNoFrom')} />
              <TextField label="Case No to" maxLength={20} {...register('wksNoTo')} />
            </>
          )}
          <DateRange label="Date Sent" from="dateSentFrom" to="dateSentTo" control={control} register={register} />
          <SelectField label="Token Status" options={tokenStatusOptions} blank={false} {...register('tokenStatus')} />
        </fieldset>

        <ActionBar label="Send to audit review actions">
          <Button variant="primary" type="submit" busy={busy} busyLabel="Working…">
            Search
          </Button>
          <Button variant="ghost" onClick={send} disabled={busy}>
            Update
          </Button>
          <Button variant="ghost" onClick={exportList}>
            Print to File
          </Button>
          <Button variant="link" onClick={clear}>
            Clear
          </Button>
          <span className="spacer" />
          <Stat label="Records" value={list.rows.length} />
          <Stat label="Selected" value={list.checked.size} />
          <Button variant="link" onClick={() => navigate('/')}>
            Close
          </Button>
        </ActionBar>

        <DataGrid
          caption="Cases to send to audit review"
          columns={columns}
          rows={list.rows}
          rowKey={rowKey}
          check={{ checked: list.checked, onChange: list.change }}
          tall
          empty="No cases. Enter the search criteria and press Search."
        />
      </form>
    </PageShell>
  )
}
