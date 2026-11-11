// Receipt > From Member (legacy FrmReceiptMember, "Receipt From Member"): the debit notes raised to members who owe money and the receipts of what they paid back. Search, tick the claims being paid, stage the
// amounts of each (Update Case), give the receipt (number, date, cheque, amount) and Save; or Edit a receipt row and Update it; Print OR writes the official receipt.

import { useEffect, useRef, useState } from 'react'
import type { FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { useForm, useWatch } from 'react-hook-form'
import { yupResolver } from '@hookform/resolvers/yup'
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
  entryDefaults,
  entryOf,
  entrySchema,
  memberColumns,
  monthOptions,
  officialReceiptRows,
  periodOf,
  saveProblem,
  saveRequest,
  searchDefaults,
  searchParams,
  searchSchema,
  stage,
  stageDefaults,
  stageProblem,
  statusOptions,
  tick,
  toRow,
  updateProblem,
  updateRequest,
} from './receiptMemberRules'
import type { EntryValues, MemberRow, MemberSearchResult, OfficialLine, ReceiptApiRow, SearchValues, StageValues } from './receiptMemberRules'

const base = '/api/receipt/from-member'
const columns: GridColumn<MemberRow>[] = memberColumns.map((c, i) => ({
  key: `c${i}`,
  label: c.label,
  value: c.value,
  align: /Amount|Amt|Charge|Gain|Misc|Discount|Off|Receipt$/.test(c.label) ? 'right' : undefined,
}))
type AllValues = EntryValues & StageValues

export function ReceiptMemberPage() {
  const navigate = useNavigate()
  const lookups = useWorksheetLookups()
  const [busy, setBusy] = useState(false)
  const [rows, setRows] = useState<MemberRow[]>([])
  const [checked, setChecked] = useState<ReadonlySet<string>>(new Set())
  const [checkedAmount, setCheckedAmount] = useState(0)
  const [authorised, setAuthorised] = useState(false)
  const [selected, setSelected] = useState<string | null>(null)
  const [editing, setEditing] = useState(false)
  const lastSearch = useRef<SearchValues | null>(null)
  const keepPeriod = useRef(false)
  const searchForm = useForm<SearchValues>({ resolver: yupResolver(searchSchema), defaultValues: searchDefaults, mode: 'onTouched' })
  const entryForm = useForm<AllValues>({
    resolver: yupResolver(entrySchema) as never,
    defaultValues: { ...entryDefaults, ...stageDefaults },
    mode: 'onSubmit',
  })
  const scan = useWatch({ control: searchForm.control, name: 'scan' })
  const receiptDate = useWatch({ control: entryForm.control, name: 'receiptDate' })
  const selectedRow = rows.find((r) => r.key === selected) ?? null

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

  /** cmdSearch_Click: Use Scan keeps the list and adds the worksheet scanned (a worksheet in the list already is "Data has been uploaded!"); a range replaces it. */
  async function load(v: SearchValues, append: boolean) {
    const { data } = await api.get<MemberSearchResult>(base, { params: searchParams(v) })
    const next = data.rows.map(toRow)
    setAuthorised(data.authorised)
    setRows((prev) => (append ? [...prev, ...next] : next))
    if (!append) {
      setChecked(new Set())
      setCheckedAmount(0)
      setSelected(null)
    }
    if (data.truncated) notify('Only the first 5,000 rows are shown. Narrow the search to see the rest.', 'info')
  }

  function searchFor(v: SearchValues) {
    if (v.scan && v.caseFrom.trim() === '') {
      searchForm.setError('caseFrom', { message: 'Please Enter Worksheet No' })
      return searchForm.setFocus('caseFrom')
    }
    if (v.scan && alreadyListed(rows, v.caseFrom)) {
      notify('Data has been uploaded!', 'error')
      searchForm.setValue('caseFrom', '')
      return
    }
    lastSearch.current = v
    return run(async () => {
      await load(v, v.scan)
      if (v.scan) searchForm.setValue('caseFrom', '')
    })
  }
  const search = (e?: FormEvent) => searchForm.handleSubmit(searchFor)(e)

  /** lstReceiptMBM_ItemCheck: each row that was ticked or unticked is worked out with the ticking rule. */
  function change(next: Set<string>) {
    let delta = 0
    const refused: string[] = []
    const accepted = new Set(next)
    const updated = new Map<string, MemberRow>()
    for (const r of rows) {
      const was = checked.has(r.key)
      const now = next.has(r.key)
      if (was === now) continue
      const result = tick(r, now, authorised)
      if (result.refused) {
        refused.push(result.refused)
        accepted.delete(r.key)
        continue
      }
      delta += result.delta
      updated.set(r.key, result.row)
    }
    new Set(refused).forEach((m) => notify(m, 'error'))
    setRows((prev) => prev.map((r) => updated.get(r.key) ?? r))
    setChecked(accepted)
    setCheckedAmount((c) => Math.round((c + delta) * 100) / 100)
  }

  /** lstReceiptMBM_Click: in Edit the receipt row is loaded into the boxes; otherwise the claim is shown for staging. */
  async function choose(row: MemberRow) {
    setSelected(row.key)
    if (!editing) return
    setEditing(false)
    if (row.api.receiptIndex == null) return notify("Payment hasn't been made!", 'error')
    await run(async () => {
      const { data } = await api.get<ReceiptApiRow>(`${base}/${row.api.receiptIndex}`)
      const loaded = entryOf(data)
      keepPeriod.current = true
      entryForm.reset({ ...loaded.entry, ...loaded.stage })
    })
  }

  /** CmdAdd_Click: the checks in the desktop's order, "Update <claim> ?", then the staging. */
  async function updateCase() {
    if (!selectedRow || !checked.has(selectedRow.key)) return notify('Please select a record ! ', 'info')
    if (!(await entryForm.trigger())) return
    const v = entryForm.getValues()
    const problem = stageProblem(selectedRow, v)
    if (problem) {
      entryForm.setError(problem.field, { message: problem.message })
      return entryForm.setFocus(problem.field)
    }
    if (!(await ask(`Update ${selectedRow.api.caseNo?.trim()}-${selectedRow.api.claimVersion} ?`))) return
    const result = stage(selectedRow, v)
    setRows((prev) => prev.map((r) => (r.key === selectedRow.key ? result.row : r)))
    setCheckedAmount((c) => Math.round((c + result.delta) * 100) / 100)
    entryForm.reset({ ...entryForm.getValues(), ...stageDefaults })
    notify('Updated .... ', 'success')
  }

  /** cmdSave_Click: the checks in the desktop's order, "Do you want to update the record?", then every ticked claim is received. */
  async function save() {
    if (!(await entryForm.trigger())) return
    const v = entryForm.getValues()
    const problem = saveProblem(v)
    if (problem) {
      entryForm.setError(problem.field, { message: problem.message })
      return entryForm.setFocus(problem.field)
    }
    const ticked = rows.filter((r) => checked.has(r.key))
    if (ticked.length === 0) return notify('Please tick the claims to be received.', 'error')
    if (!(await ask('Do you want to update the record?'))) return
    await run(async () => {
      await api.post(base, saveRequest(v, ticked))
      notify('Record updated...', 'success')
      setCheckedAmount(0)
      setChecked(new Set())
      if (scan) setRows([])
      else if (lastSearch.current) await load(lastSearch.current, false)
    })
  }

  /** CmdUpdate_Click: the checks in the desktop's order, "Do you want to update the record?", then the row is changed. */
  async function update() {
    if (!(await entryForm.trigger())) return
    const v = entryForm.getValues()
    const problem = updateProblem(v, rows.length)
    if (problem) {
      if (problem.field === 'list') return notify(problem.message, 'error')
      entryForm.setError(problem.field, { message: problem.message })
      return entryForm.setFocus(problem.field)
    }
    if (!selectedRow || selectedRow.api.receiptIndex == null) return notify("Payment hasn't been made!", 'error')
    if (!(await ask('Do you want to update the record?'))) return
    await run(async () => {
      await api.put(base, updateRequest(v, v, selectedRow.api.receiptIndex!))
      notify('Record Updated...', 'success')
      entryForm.reset({ ...entryDefaults, ...stageDefaults })
      if (lastSearch.current) await load(lastSearch.current, false)
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

  /** cmdEXPtoExcel_Click. */
  function exportList() {
    if (rows.length === 0) return notify('Report cannot be printed without any record.', 'info')
    downloadCsv('receipt-from-member.csv', memberColumns, rows)
  }

  function clear() {
    searchForm.reset(searchDefaults)
    entryForm.reset({ ...entryDefaults, ...stageDefaults })
    setRows([])
    setChecked(new Set())
    setCheckedAmount(0)
    setSelected(null)
    setEditing(false)
    lastSearch.current = null
  }

  const sErr = searchForm.formState.errors
  const eErr = entryForm.formState.errors
  const received = rows.reduce((s, r) => s + (r.api.receiptAmt ?? 0), 0)

  return (
    <PageShell title="Receipt From Member" subtitle="Receipts of the debit notes raised to members.">
      <form onSubmit={(e: FormEvent) => void search(e)} noValidate className="screen-form">
        <fieldset>
          <legend>Enter Criteria For Searching</legend>
          <CheckField label="Use Scan" {...searchForm.register('scan', { onChange: () => setRows([]) })} />
          <TextField label={scan ? 'Worksheet No' : 'Case No from'} maxLength={30} error={sErr.caseFrom} {...searchForm.register('caseFrom')} />
          {!scan && <TextField label="Case No to" maxLength={30} error={sErr.caseTo} {...searchForm.register('caseTo')} />}
          <TextField label="Mem No" maxLength={30} {...searchForm.register('memberNo')} />
          <TextField label="Mem Name" maxLength={100} {...searchForm.register('memberName')} />
          <ComboField label="Payor" options={lookups.payors} {...searchForm.register('payor')} />
          <SelectField label="Payment Status" blank={false} options={statusOptions} {...searchForm.register('status')} />
          <TextRange label="Recp No" from="recFrom" to="recTo" empty="recEmpty" maxLength={30} register={searchForm.register} errors={sErr} />
          <DateRange label="Recp Date" from="recDateFrom" to="recDateTo" control={searchForm.control} register={searchForm.register} />
          <TextRange label="DR No" from="drFrom" to="drTo" empty="drEmpty" maxLength={40} register={searchForm.register} errors={sErr} />
          <NumberRange label="DR Amt" from="amtFrom" to="amtTo" empty="amtEmpty" register={searchForm.register} errors={sErr} />
          <NumberRange label="A/C Period Mth" from="mthFrom" to="mthTo" empty="mthEmpty" register={searchForm.register} errors={sErr} />
          <NumberRange label="A/C Period Yr" from="yrFrom" to="yrTo" empty="yrEmpty" register={searchForm.register} errors={sErr} />
        </fieldset>
      </form>

      <DataGrid
        caption="Receipt From Member"
        columns={columns}
        rows={rows}
        rowKey={(r) => r.key}
        selectedKey={selected}
        onSelect={(r) => void choose(r)}
        check={{ checked, onChange: change }}
        tall
        empty="No debit notes. Enter the worksheet number and press Search."
      />

      <fieldset>
        <legend>Receipt</legend>
        <TextField label="Receipt No" maxLength={30} error={eErr.receiptNo} {...entryForm.register('receiptNo')} />
        <DateField control={entryForm.control} name="receiptDate" label="Receipt Date" />
        <NumberField label="Amount" error={eErr.amount} {...entryForm.register('amount')} />
        <TextField label="Cheque No" maxLength={40} error={eErr.chequeNo} {...entryForm.register('chequeNo')} />
        <TextField label="Receipt Remarks" maxLength={100} {...entryForm.register('receiptRemarks')} />
        <SelectField label="A/C Period Mth" options={monthOptions} {...entryForm.register('accMonth')} />
        <TextField label="A/C Period Year" maxLength={4} {...entryForm.register('accYear')} />
      </fieldset>
      <fieldset>
        <legend>Claim</legend>
        <ReadField label="Claim No" value={selectedRow ? `${selectedRow.api.caseNo?.trim()}-${selectedRow.api.claimVersion}` : ''} />
        <NumberField label="Bank Chrg" error={eErr.bankCharge} {...entryForm.register('bankCharge')} />
        <TextField label="Contra Case" maxLength={30} error={eErr.contraCase} {...entryForm.register('contraCase')} />
        <TextField label="Contra Ver" maxLength={10} {...entryForm.register('contraVersion')} />
        <NumberField label="Contra Amt" error={eErr.contraAmt} {...entryForm.register('contraAmt')} />
        <NumberField label="Clm Gain/Loss" error={eErr.gainLoss} {...entryForm.register('gainLoss')} />
        <NumberField label="Misc. Diff." error={eErr.misc} {...entryForm.register('misc')} />
        <NumberField label="Discount" error={eErr.discount} {...entryForm.register('discount')} />
        <NumberField label="Amt Paid" error={eErr.amtPaid} {...entryForm.register('amtPaid')} />
        <NumberField label="Write Off" error={eErr.writeOff} {...entryForm.register('writeOff')} />
        <NumberField label="Medix Rec." error={eErr.medixRec} {...entryForm.register('medixRec')} />
        <TextField label="Remarks" maxLength={100} {...entryForm.register('remarks')} />
      </fieldset>

      <ActionBar label="Receipt from member actions">
        <Button variant="primary" onClick={() => void search()} busy={busy} busyLabel="Working…">
          Search
        </Button>
        <Button variant="ghost" onClick={() => void updateCase()} disabled={busy}>
          Update Case
        </Button>
        <Button variant="primary" onClick={() => void save()} disabled={busy || editing}>
          Save
        </Button>
        <Button
          variant="ghost"
          onClick={() => {
            setEditing(true)
            notify('Choose the receipt row to edit.', 'info')
          }}
          disabled={busy}
        >
          Edit
        </Button>
        <Button variant="ghost" onClick={() => void update()} disabled={busy}>
          Update
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
        <Stat label="Received Amt" value={formatMoney(received)} />
        <Stat label="Checked Amt" value={formatMoney(checkedAmount)} />
        <Stat label="Records" value={rows.length} />
        <Button variant="link" onClick={() => navigate('/')}>
          Close
        </Button>
      </ActionBar>
    </PageShell>
  )
}
