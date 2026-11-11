// Receipt > Payor (legacy FrmReceiptPayor, "Receipt From Payor"): the receipts of what the payors pay, one receipt for a whole bordx (By Bordx) or for single claims (By Worksheet). Search, tick, give the
// receipt (number comes from the server), Save; Edit then Update a receipt; Remove it; Print OR writes the official receipt.

import { useEffect, useRef, useState } from 'react'
import type { FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { useForm, useWatch } from 'react-hook-form'
import { yupResolver } from '@hookform/resolvers/yup'
import { useQuery } from '@tanstack/react-query'
import { CheckField, ComboField, DateField, NumberField, ReadField, SelectField, TextField } from '../../components/Field'
import { DataGrid } from '../../components/DataGrid'
import type { GridColumn } from '../../components/DataGrid'
import { ActionBar, PageShell, Stat } from '../../components/Screen'
import { Button } from '../../components/Button'
import { downloadCsv, downloadCsvRows } from '../../lib/exportCsv'
import { formatMoney } from '../../lib/format'
import { ask, notify } from '../../lib/notifyStore'
import { api, errorMessage } from '../../api/client'
import { DateRange, NumberRange, TextRange } from '../worksheet/RangeFields'
import { useWorksheetLookups } from '../worksheet/useWorksheetLookups'
import {
  alreadyListed,
  bordxColumns,
  bordxLine,
  entryDefaults,
  entryOf,
  entrySchema,
  monthOptions,
  officialReceiptRows,
  overPaid,
  periodOf,
  saveProblem,
  saveRequest,
  searchDefaults,
  searchParams,
  searchProblem,
  searchSchema,
  stage,
  stageDefaults,
  stageProblem,
  statusOptions,
  tick,
  updateProblem,
  updateRequest,
  wsColumns,
  wsLine,
  wsStatusOptions,
} from './receiptPayorRules'
import type { EntryValues, Line, Mode, OfficialLine, PayorSearchResult, SearchValues, StageValues } from './receiptPayorRules'

const base = '/api/receipt/from-payor'
type AllValues = EntryValues & StageValues
const money = /Amt|Amount|Paying|Charge|Gain|Misc|Discount|Off|Receipt$|Rec'd/
const toGrid = (columns: typeof bordxColumns): GridColumn<Line>[] =>
  columns.map((c, i) => ({ key: `c${i}`, label: c.label, value: c.value, align: money.test(c.label) ? 'right' : undefined }))
const gridColumns: Record<Mode, GridColumn<Line>[]> = { bordx: toGrid(bordxColumns), worksheet: toGrid(wsColumns) }
const csvColumns = { bordx: bordxColumns, worksheet: wsColumns }

export function ReceiptPayorPage() {
  const navigate = useNavigate()
  const lookups = useWorksheetLookups()
  const [busy, setBusy] = useState(false)
  const [lines, setLines] = useState<Line[]>([])
  const [checked, setChecked] = useState<ReadonlySet<string>>(new Set())
  const [checkedAmount, setCheckedAmount] = useState(0)
  const [authorised, setAuthorised] = useState(false)
  const [selected, setSelected] = useState<string | null>(null)
  const [editing, setEditing] = useState(false)
  const [totals, setTotals] = useState({ amount: 0, received: 0 })
  const lastSearch = useRef<SearchValues | null>(null)
  const keepPeriod = useRef(false)
  const searchForm = useForm<SearchValues>({ resolver: yupResolver(searchSchema), defaultValues: searchDefaults, mode: 'onTouched' })
  const entryForm = useForm<AllValues>({ resolver: yupResolver(entrySchema) as never, defaultValues: { ...entryDefaults, ...stageDefaults }, mode: 'onSubmit' })
  const [mode, scan, payor] = useWatch({ control: searchForm.control, name: ['mode', 'scan', 'payor'] })
  const receiptDate = useWatch({ control: entryForm.control, name: 'receiptDate' })
  const selectedLine = lines.find((l) => l.key === selected) ?? null
  const payorCode = payor.trim().split('-')[0].trim()
  const groups = useQuery({
    queryKey: ['payor-group-companies', payorCode],
    queryFn: async () => (await api.get<string[]>(`${base}/group-companies`, { params: { payor: payorCode } })).data.map((g) => ({ value: g, label: g })),
    enabled: payorCode.length === 2,
    staleTime: 10 * 60 * 1000,
  })

  useEffect(() => {
    if (keepPeriod.current) {
      keepPeriod.current = false
      return
    }
    const period = periodOf(receiptDate)
    if (period) {
      entryForm.setValue('accMonth', period.month)
      entryForm.setValue('accYear', period.year)
    }
  }, [receiptDate, entryForm])

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

  function reset() {
    setChecked(new Set())
    setCheckedAmount(0)
    setSelected(null)
    setEditing(false)
  }

  /** cmdSearch_Click: Use Scan keeps the list and adds the bordx or worksheet scanned (one that is in the list already is "Data has been uploaded!"); a range replaces it. */
  async function load(v: SearchValues, append: boolean) {
    const { data } = await api.get<PayorSearchResult>(base, { params: searchParams(v) })
    const next = v.mode === 'bordx' ? data.bordx.map(bordxLine) : data.worksheets.map(wsLine)
    setAuthorised(data.authorised)
    setLines((prev) => (append ? [...prev, ...next] : next))
    setTotals((t) =>
      append ? { amount: t.amount + data.totalAmount, received: t.received + data.totalReceived } : { amount: data.totalAmount, received: data.totalReceived },
    )
    if (!append) reset()
    if (data.truncated) notify('Only the first 5,000 rows are shown. Narrow the search to see the rest.', 'info')
  }

  function searchFor(v: SearchValues) {
    const problem = searchProblem(v)
    if (problem) {
      searchForm.setError(problem.field, { message: problem.message })
      return searchForm.setFocus(problem.field)
    }
    const scanned = v.mode === 'bordx' ? v.bordxFrom : v.wsFrom
    if (v.scan && alreadyListed(lines, v.mode, scanned)) {
      notify('Data has been uploaded!', 'error')
      searchForm.setValue(v.mode === 'bordx' ? 'bordxFrom' : 'wsFrom', '')
      return
    }
    lastSearch.current = v
    return run(async () => {
      await load(v, v.scan)
      if (v.scan) searchForm.setValue(v.mode === 'bordx' ? 'bordxFrom' : 'wsFrom', '')
    })
  }
  const search = (e?: FormEvent) => searchForm.handleSubmit(searchFor)(e)

  /** lstBordx_ItemCheck / lstWorksheet_ItemCheck. */
  function change(next: Set<string>) {
    let delta = 0
    const refused: string[] = []
    const accepted = new Set(next)
    const updated = new Map<string, Line>()
    for (const l of lines) {
      const was = checked.has(l.key)
      const now = next.has(l.key)
      if (was === now) continue
      const result = tick(l, now, authorised)
      if (result.refused) {
        refused.push(result.refused)
        accepted.delete(l.key)
        continue
      }
      delta += result.delta
      updated.set(l.key, result.line)
    }
    new Set(refused).forEach((m) => notify(m, 'error'))
    setLines((prev) => prev.map((l) => updated.get(l.key) ?? l))
    setChecked(accepted)
    setCheckedAmount((c) => Math.round((c + delta) * 100) / 100)
  }

  /** lstBordx_Click / lstWorksheet_Click: the line is shown in the boxes. */
  function choose(line: Line) {
    setSelected(line.key)
    const loaded = entryOf(line)
    keepPeriod.current = true
    entryForm.reset({ ...loaded.entry, ...loaded.stage })
    setEditing(false)
  }

  /** CmdAdd_Click (By Worksheet): the checks in the desktop's order, "Over Paid ! ", "Update <claim> ?", then the staging. */
  async function updateCase() {
    if (!selectedLine || !checked.has(selectedLine.key)) return notify('Please select a record ! ', 'info')
    if (!(await entryForm.trigger())) return
    const v = entryForm.getValues()
    const problem = stageProblem(v)
    if (problem) {
      entryForm.setError(problem.field, { message: problem.message })
      return entryForm.setFocus(problem.field)
    }
    if (overPaid(selectedLine, v)) notify('Over Paid ! ', 'error')
    const claim = `${selectedLine.ws?.caseNo?.trim()}-${selectedLine.ws?.claimVersion}`
    if (!(await ask(`Update ${claim} ?`))) return
    const result = stage(selectedLine, v)
    setLines((prev) => prev.map((l) => (l.key === selectedLine.key ? result.line : l)))
    setCheckedAmount((c) => Math.round((c + result.delta) * 100) / 100)
    entryForm.reset({ ...entryForm.getValues(), ...stageDefaults })
    notify('Updated .... ', 'success')
  }

  /** cmdSave_Click: the checks in the desktop's order, then one receipt (the number comes from the server) for the ticked bordx or claims. */
  async function save() {
    if (!(await entryForm.trigger())) return
    const v = entryForm.getValues()
    const ticked = lines.filter((l) => checked.has(l.key))
    const problem = saveProblem(v, ticked.length, checkedAmount)
    if (problem) {
      if (problem.field === 'list') return notify(problem.message, 'error')
      entryForm.setError(problem.field, { message: problem.message })
      return entryForm.setFocus(problem.field)
    }
    await run(async () => {
      const { data } = await api.post<{ receiptNo: string; saved: number }>(base, saveRequest(mode, v, ticked, checkedAmount))
      notify(`Record Saved... Receipt ${data.receiptNo}`, 'success')
      entryForm.reset({ ...entryDefaults, ...stageDefaults })
      reset()
      await load(
        {
          ...(lastSearch.current ?? searchForm.getValues()),
          scan: false,
          recFrom: data.receiptNo,
          recTo: data.receiptNo,
          bordxFrom: '',
          bordxTo: '',
          wsFrom: '',
          wsTo: '',
          status: '0',
          wsStatus: '0',
        },
        false,
      )
    })
  }

  /** CmdEdit_Click: only a line with a receipt number can be edited. */
  function edit() {
    if (!selectedLine || (entryForm.getValues('receiptNo') ?? '').trim() === '') return notify('Choose a line that has a receipt number.', 'info')
    setEditing(true)
  }

  /** CmdUpdate_Click: the checks in the desktop's order, then the receipt of the bordx (all its claims) or the claim's receipt row is changed. */
  async function update() {
    if (!(await entryForm.trigger())) return
    const v = entryForm.getValues()
    const problem = updateProblem(v, lines.length)
    if (problem) {
      if (problem.field === 'list') return notify(problem.message, 'error')
      entryForm.setError(problem.field, { message: problem.message })
      return entryForm.setFocus(problem.field)
    }
    if (!selectedLine) return notify('Please select the record', 'error')
    await run(async () => {
      await api.put(base, updateRequest(mode, v, selectedLine))
      notify('Record Updated...', 'success')
      entryForm.reset({ ...entryDefaults, ...stageDefaults })
      reset()
      if (lastSearch.current)
        await load(
          {
            ...lastSearch.current,
            scan: false,
            recFrom: v.receiptNo.trim(),
            recTo: v.receiptNo.trim(),
            bordxFrom: '',
            bordxTo: '',
            wsFrom: '',
            wsTo: '',
            status: '0',
            wsStatus: '0',
          },
          false,
        )
    })
  }

  /** cmdRemove_Click: asks, then removes the receipt rows of the selected bordx or claim. */
  async function remove() {
    if (!selectedLine) return notify(mode === 'bordx' ? 'Please Select Bordx to delete!' : 'Please Select Claim to delete!', 'error')
    if (!(await ask('Do you want to delete the record?'))) return
    await run(async () => {
      const body =
        mode === 'bordx' ? { mode, bordxNo: selectedLine.bordx?.bordxNo } : { mode, caseNo: selectedLine.ws?.caseNo, version: selectedLine.ws?.claimVersion }
      await api.post(`${base}/remove`, body)
      notify('Record has been deleted!', 'success')
      entryForm.reset({ ...entryDefaults, ...stageDefaults })
      reset()
      const bordxNo = selectedLine.bordx?.bordxNo ?? selectedLine.ws?.bordxNo ?? ''
      await load(
        {
          ...(lastSearch.current ?? searchForm.getValues()),
          scan: false,
          bordxFrom: bordxNo,
          bordxTo: bordxNo,
          wsFrom: '',
          wsTo: '',
          recFrom: '',
          recTo: '',
          status: '0',
          wsStatus: '0',
        },
        false,
      )
    })
  }

  /** cmdPrintPV_Click: the official receipt of the receipt number in the box. */
  function printOfficialReceipt() {
    const no = entryForm.getValues('receiptNo').trim()
    if (no === '') return notify('Please Enter or Generate Receipt No', 'error')
    return run(async () => {
      const { data } = await api.get<OfficialLine[]>(`${base}/official-receipt`, { params: { receiptNo: no } })
      downloadCsvRows(`official-receipt-${no}.csv`, officialReceiptRows(data))
    })
  }

  function exportList() {
    if (lines.length === 0) return notify('Report cannot be printed without any record.', 'info')
    downloadCsv('receipt-from-payor.csv', csvColumns[mode], lines)
  }

  function clear() {
    searchForm.reset({ ...searchDefaults, mode })
    entryForm.reset({ ...entryDefaults, ...stageDefaults })
    setLines([])
    setTotals({ amount: 0, received: 0 })
    reset()
    lastSearch.current = null
  }

  function changeMode(next: Mode) {
    searchForm.reset({ ...searchDefaults, mode: next })
    entryForm.reset({ ...entryDefaults, ...stageDefaults })
    setLines([])
    setTotals({ amount: 0, received: 0 })
    reset()
  }

  const sErr = searchForm.formState.errors
  const eErr = entryForm.formState.errors

  return (
    <PageShell title="Receipt From Payor" subtitle="Receipts of what the payors pay.">
      <form onSubmit={(e: FormEvent) => void search(e)} noValidate className="screen-form">
        <fieldset>
          <legend>Enter Criteria For Searching</legend>
          <SelectField
            label="Receipt Type"
            blank={false}
            options={[
              { value: 'bordx', label: 'By Bordx' },
              { value: 'worksheet', label: 'By Worksheet' },
            ]}
            {...searchForm.register('mode', { onChange: (e: { target: { value: string } }) => changeMode(e.target.value as Mode) })}
          />
          <CheckField
            label="Use Scan"
            {...searchForm.register('scan', {
              onChange: () => {
                setLines([])
                setTotals({ amount: 0, received: 0 })
                reset()
              },
            })}
          />
          <ComboField label="Payor" options={lookups.payors} {...searchForm.register('payor')} />
          <TextField
            label={mode === 'bordx' && scan ? 'Bordx No' : 'Bordx No from'}
            maxLength={40}
            error={sErr.bordxFrom}
            {...searchForm.register('bordxFrom')}
          />
          {!(mode === 'bordx' && scan) && <TextField label="Bordx No to" maxLength={40} {...searchForm.register('bordxTo')} />}
          {mode === 'worksheet' && (
            <TextField label={scan ? 'Worksheet No' : 'WS No from'} maxLength={30} error={sErr.wsFrom} {...searchForm.register('wsFrom')} />
          )}
          {mode === 'worksheet' && !scan && <TextField label="WS No to" maxLength={30} {...searchForm.register('wsTo')} />}
          {mode === 'worksheet' && <SelectField label="WS Status" blank={false} options={wsStatusOptions} {...searchForm.register('wsStatus')} />}
          <SelectField label="Payment Status" blank={false} options={statusOptions} {...searchForm.register('status')} />
          <TextRange label="Recp No" from="recFrom" to="recTo" maxLength={30} register={searchForm.register} errors={sErr} />
          <DateRange label="Recp Date" from="recDateFrom" to="recDateTo" control={searchForm.control} register={searchForm.register} />
          <NumberRange label="A/C Period Mth" from="mthFrom" to="mthTo" register={searchForm.register} errors={sErr} />
          <NumberRange label="A/C Period Yr" from="yrFrom" to="yrTo" register={searchForm.register} errors={sErr} />
          <DateRange label="Bordx Date" from="bordxDateFrom" to="bordxDateTo" control={searchForm.control} register={searchForm.register} />
          {mode === 'worksheet' && <DateRange label="WS Date" from="closeFrom" to="closeTo" control={searchForm.control} register={searchForm.register} />}
          <ComboField label="Group Company" options={groups.data ?? []} {...searchForm.register('groupCompany')} />
          <TextField label="Policy Number" maxLength={60} {...searchForm.register('policy')} />
        </fieldset>
      </form>

      <DataGrid
        caption="Receipt From Payor"
        columns={gridColumns[mode]}
        rows={lines}
        rowKey={(l) => l.key}
        selectedKey={selected}
        onSelect={choose}
        check={{ checked, onChange: change }}
        tall
        empty={mode === 'bordx' ? 'No bordx. Enter the bordx number and press Search.' : 'No claims. Enter the worksheet number and press Search.'}
      />

      <fieldset>
        <legend>Receipt from PAYOR</legend>
        <TextField label="Pay PV No." maxLength={40} {...entryForm.register('pvNo')} />
        <DateField control={entryForm.control} name="pvDate" label="Pay Chq Date" />
        <TextField label="Cheque No" maxLength={40} error={eErr.chequeNo} {...entryForm.register('chequeNo')} />
        <NumberField label="Rec Amt" error={eErr.receiptAmt} {...entryForm.register('receiptAmt')} />
        <TextField label="Remark" maxLength={400} error={eErr.remark} {...entryForm.register('remark')} />
        <ReadField label="Receipt No" value={entryForm.getValues('receiptNo')} />
        <DateField control={entryForm.control} name="receiptDate" label="Date" />
        <SelectField label="A/C Mth" options={monthOptions} {...entryForm.register('accMonth')} />
        <TextField label="Year" maxLength={4} {...entryForm.register('accYear')} />
      </fieldset>
      {mode === 'worksheet' && (
        <fieldset>
          <legend>Claim</legend>
          <ReadField label="Claim No" value={selectedLine?.ws ? `${selectedLine.ws.caseNo?.trim()}-${selectedLine.ws.claimVersion}` : ''} />
          <NumberField label="Bank Chrg" error={eErr.bankCharge} {...entryForm.register('bankCharge')} />
          <TextField label="Contra Case" maxLength={30} error={eErr.contraCase} {...entryForm.register('contraCase')} />
          <TextField label="Contra Ver" maxLength={10} {...entryForm.register('contraVersion')} />
          <NumberField label="Contra Amt" error={eErr.contraAmt} {...entryForm.register('contraAmt')} />
          <NumberField label="Gain/Loss" error={eErr.gainLoss} {...entryForm.register('gainLoss')} />
          <NumberField label="Misc. Diff." error={eErr.misc} {...entryForm.register('misc')} />
          <NumberField label="Discount" error={eErr.discount} {...entryForm.register('discount')} />
          <NumberField label="Amt Paid" error={eErr.amtPaid} {...entryForm.register('amtPaid')} />
          <NumberField label="Write Off" error={eErr.writeOff} {...entryForm.register('writeOff')} />
          <NumberField label="Medix Rec" error={eErr.medixRec} {...entryForm.register('medixRec')} />
          <TextField label="Remarks" maxLength={400} {...entryForm.register('casRemark')} />
        </fieldset>
      )}

      <ActionBar label="Receipt from payor actions">
        <Button variant="primary" onClick={() => void search()} busy={busy} busyLabel="Working…">
          Search
        </Button>
        {mode === 'worksheet' && (
          <Button variant="ghost" onClick={() => void updateCase()} disabled={busy}>
            Update Case
          </Button>
        )}
        <Button variant="primary" onClick={() => void save()} disabled={busy || editing}>
          Save
        </Button>
        <Button variant="ghost" onClick={edit} disabled={busy || editing}>
          Edit
        </Button>
        <Button variant="ghost" onClick={() => void update()} disabled={busy || !editing}>
          Update
        </Button>
        <Button variant="ghost" onClick={() => void remove()} disabled={busy}>
          Remove
        </Button>
        <Button variant="ghost" onClick={() => void printOfficialReceipt()} disabled={busy}>
          Print OR
        </Button>
        <Button variant="ghost" onClick={exportList} disabled={busy}>
          Print to File
        </Button>
        <Button variant="link" onClick={clear}>
          Clear
        </Button>
        <span className="spacer" />
        <Stat label="Tot. Bordx Amt" value={formatMoney(totals.amount)} />
        <Stat label="Tot. Rec. Amt" value={formatMoney(totals.received)} />
        <Stat label="Checked Amt" value={formatMoney(checkedAmount)} />
        <Stat label="Records" value={lines.length} />
        <Button variant="link" onClick={() => navigate('/')}>
          Close
        </Button>
      </ActionBar>
    </PageShell>
  )
}
