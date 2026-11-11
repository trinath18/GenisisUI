// Worksheet > Worksheet Send to A/C (legacy FrmWksSendToAC, "Claims Send To A/C"): search worksheets, tick the ones to hand over
// to accounts and record the date they were sent; the server adds a "sent to account" line to each case's remarks.

import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useForm, useWatch } from 'react-hook-form'
import { yupResolver } from '@hookform/resolvers/yup'
import { CheckField, ComboField, DateField, SelectField, TextField } from '../../components/Field'
import { DataGrid } from '../../components/DataGrid'
import type { GridColumn } from '../../components/DataGrid'
import { ActionBar, PageShell, SearchLayout, Stat } from '../../components/Screen'
import { Button } from '../../components/Button'
import { downloadCsv } from '../../lib/exportCsv'
import type { CsvColumn } from '../../lib/exportCsv'
import { formatMoney } from '../../lib/format'
import { ask, notify } from '../../lib/notifyStore'
import { api, errorMessage } from '../../api/client'
import { isoDmy, isoToDmy, S } from '../case/caseShared'
import { DateRange, NumberRange, TextRange } from './RangeFields'
import { useTickList } from './useTickList'
import { useWorksheetLookups } from './useWorksheetLookups'
import {
  accountsDefaults,
  accountsParams,
  accountsSchema,
  accountsTickProblem,
  accountsUpdateProblem,
  isAlreadyListed,
  tokenStatusOptions,
  worksheetKey,
} from './worksheetRules'
import type { AccountsValues, SearchResult } from './worksheetRules'

interface AccountsRow {
  payor: string | null
  caseNo: string
  claimVersion: number
  wksDate: string | null
  wksAmount: number | null
  dateToAc: string | null
  passedBy: string | null
  sent: boolean
  hosChequeDate: string | null
  mbmChequeDate: string | null
  bordxNo: string | null
}

const dateColumn = (key: keyof AccountsRow, label: string): GridColumn<AccountsRow> => ({
  key,
  label,
  value: (r) => isoToDmy(r[key]),
  sortBy: (r) => S(r[key]),
})

const columns: GridColumn<AccountsRow>[] = [
  { key: 'payor', label: 'Payor' },
  { key: 'wksNo', label: 'Wks No', value: worksheetKey },
  dateColumn('wksDate', 'Wks Date'),
  {
    key: 'wksAmount',
    label: 'Wks Amount',
    align: 'right',
    value: (r) => (r.wksAmount == null ? '' : formatMoney(r.wksAmount)),
    sortBy: (r) => r.wksAmount ?? 0,
  },
  dateColumn('dateToAc', 'Date To A/C'),
  { key: 'passedBy', label: 'Passed By' },
  { key: 'sent', label: 'Status', value: (r) => (r.sent ? 'Passed' : 'Not Yet Passed') },
  dateColumn('hosChequeDate', 'HOS Cheque Date'),
  dateColumn('mbmChequeDate', 'MBM Cheque Date'),
  { key: 'bordxNo', label: 'Bordx No.' },
]

const exportColumns: CsvColumn<AccountsRow>[] = columns.map((c) => ({
  label: c.label,
  value: (r) => (c.value ? c.value(r) : (r[c.key as keyof AccountsRow] as string | number | boolean | null)?.toString()),
}))

async function load(v: AccountsValues) {
  return (await api.get<SearchResult<AccountsRow>>('/api/worksheet/send-to-accounts/search', { params: accountsParams(v) })).data
}

export function WorksheetSendToAccountsPage() {
  const navigate = useNavigate()
  const list = useTickList<AccountsRow>(worksheetKey, accountsTickProblem)
  const [busy, setBusy] = useState(false)
  const {
    register,
    handleSubmit,
    reset,
    control,
    setValue,
    setError,
    setFocus,
    getValues,
    trigger,
    formState: { errors },
  } = useForm<AccountsValues>({ resolver: yupResolver(accountsSchema), defaultValues: accountsDefaults, mode: 'onTouched' })
  const [useScan, payor] = useWatch({ control, name: ['useScan', 'payor'] })
  const lookups = useWorksheetLookups(payor)
  const total = list.rows.reduce((sum, r) => sum + (r.wksAmount ?? 0), 0)

  /** CmdSearch_Click. A scan adds the worksheet to the list; a range replaces the list. */
  const search = handleSubmit(async (v) => {
    if (v.useScan && isAlreadyListed(list.rows, v.wksNoFrom)) return notify('This case is already in the list.', 'info')
    setBusy(true)
    try {
      const found = await load(v)
      if (found.rows.length === 0) notify('No record found!', 'error')
      else if (v.useScan) list.append(found.rows)
      else list.replace(found.rows)
      if (found.truncated) notify('Only the first 5,000 worksheets are shown. Narrow the search to see the rest.', 'info')
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
    reset(accountsDefaults)
    list.clear()
  }

  /** CmdToAC_Click: the date, then the ticked worksheets; the server refuses a worksheet that was already sent. */
  async function send() {
    const problem = accountsUpdateProblem(getValues())
    if (problem) {
      setError(problem.field, { message: problem.message })
      return setFocus(problem.field)
    }
    if (!(await trigger('sendDate'))) return setFocus('sendDate')
    if (list.ticked.length === 0) return notify('Please select at least one record to be updated!', 'error')
    if (!(await ask('Do you want to update the record?'))) return
    setBusy(true)
    try {
      const v = getValues()
      const { data } = await api.post<{ message: string }>('/api/worksheet/send-to-accounts/send', {
        date: isoDmy(v.sendDate),
        items: list.ticked.map((r) => ({ caseNo: r.caseNo, claimVersion: r.claimVersion })),
      })
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
    downloadCsv('worksheets-send-to-accounts.csv', exportColumns, list.rows)
  }

  const pair = { register, errors }

  return (
    <PageShell title="Worksheet Send to A/C" subtitle="Search worksheets, tick the ones to send to accounts and record the date.">
      <form onSubmit={search} noValidate className="screen-form">
        <SearchLayout
          panel={
            <>
              <div className="ct-pair">
                <DateRange label="Wks Date" from="wksDateFrom" to="wksDateTo" control={control} register={register} />
              </div>
              <div className="ct-pair">
                <NumberRange label="Wks Amt" from="amountFrom" to="amountTo" {...pair} />
              </div>
              <div className="ct-pair">
                <TextRange label="Bordx No" from="bordxFrom" to="bordxTo" maxLength={20} {...pair} />
              </div>
            </>
          }
        >
          <fieldset>
            <legend>Selection Criteria</legend>
            <CheckField label="Use Scan" {...register('useScan', { onChange: () => list.clear() })} />
            {useScan ? (
              <TextField label="Wks No" required maxLength={20} autoFocus error={errors.wksNoFrom} {...register('wksNoFrom')} />
            ) : (
              <>
                <TextField label="Wks No from" maxLength={20} autoFocus {...register('wksNoFrom')} />
                <TextField label="Wks No to" maxLength={20} {...register('wksNoTo')} />
              </>
            )}
            <ComboField label="Payor" options={lookups.payors} {...register('payor')} />
            <div className="ct-pair ws-span2">
              <DateRange label="Date Sent" from="dateSentFrom" to="dateSentTo" control={control} register={register} />
            </div>
            <SelectField label="Token Status" options={tokenStatusOptions} blank={false} {...register('tokenStatus')} />
          </fieldset>

          <fieldset>
            <legend>Send to accounts</legend>
            <DateField control={control} name="sendDate" label="Date Sent" hint="Applies to the ticked worksheets." />
          </fieldset>

          <ActionBar label="Send to accounts actions">
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
            <Stat label="Total Amt" value={formatMoney(total)} />
            <Button variant="link" onClick={() => navigate('/')}>
              Close
            </Button>
          </ActionBar>

          <DataGrid
            caption="Worksheets to send to accounts"
            columns={columns}
            rows={list.rows}
            rowKey={worksheetKey}
            check={{ checked: list.checked, onChange: list.change }}
            tall
            empty="No worksheets. Enter the search criteria and press Search."
          />
        </SearchLayout>
      </form>
    </PageShell>
  )
}
