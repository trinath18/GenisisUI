// Claim Bordx > Payment Advice > Generate Bordx No (legacy frmPayAdviceHosp, "Payment Advice - Generate Bordx"): search the MH payor's worksheets flagged for a payment advice, tick the ones to include and
// generate one bordx for them. The worksheet rules are Inpatient Case Listing's plus the final ICD code, the cost centre and the group category.

import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useForm, useWatch } from 'react-hook-form'
import { yupResolver } from '@hookform/resolvers/yup'
import { CheckField, ComboField, DateField, SelectField, TextField } from '../../components/Field'
import { DataGrid } from '../../components/DataGrid'
import type { GridColumn } from '../../components/DataGrid'
import { ActionBar, PageShell, Stat } from '../../components/Screen'
import { Tabs } from '../../components/Tabs'
import { Button } from '../../components/Button'
import { formatMoney } from '../../lib/format'
import { ask, notify } from '../../lib/notifyStore'
import { api, errorMessage } from '../../api/client'
import { isoDmy, isoToDmy } from '../case/caseShared'
import { useScreenLookups } from '../case/useScreenLookups'
import {
  NO_DOCUMENTS,
  bordxProblem,
  bordxRequest,
  cashTypeOptions,
  groupCompanyProblem,
  payColumns,
  payDefaults,
  payParams,
  paySchema,
  tickProblem,
  totalApproved,
} from './paymentAdviceBordxRules'
import type { BordxLine, PayRow, PayValues } from './paymentAdviceBordxRules'

const base = '/api/claim-bordx/payment-advice-bordx'
const money = /Amt/
const worksheetColumns: GridColumn<PayRow>[] = payColumns.map((c, i) => ({
  key: `c${i}`,
  label: c.label,
  value: c.value,
  align: money.test(c.label) ? 'right' : undefined,
  sortBy: c.label === 'DOA' ? (r: PayRow) => isoDmy(isoToDmy(r.doa)) ?? '' : c.label === 'DOD' ? (r: PayRow) => isoDmy(isoToDmy(r.dod)) ?? '' : undefined,
}))
const bordxColumns: GridColumn<BordxLine>[] = [
  { key: 'claimNo', label: 'Claim No' },
  { key: 'bordxNo', label: 'Bordx No' },
  { key: 'bordxDate', label: 'Bordx Date', value: (r) => isoToDmy(r.bordxDate) },
  { key: 'bordxAmount', label: 'Bordx Amt', align: 'right', value: (r) => formatMoney(r.bordxAmount) },
]

export function PaymentAdviceBordxPage() {
  const navigate = useNavigate()
  const { worksheetVersions } = useScreenLookups()
  const [rows, setRows] = useState<PayRow[]>([])
  const [lines, setLines] = useState<BordxLine[]>([])
  const [checked, setChecked] = useState<ReadonlySet<string>>(new Set())
  const [tab, setTab] = useState(0)
  const [busy, setBusy] = useState(false)
  const form = useForm<PayValues>({ resolver: yupResolver(paySchema), defaultValues: payDefaults, mode: 'onSubmit' })
  const [useScan, doaEmpty, dodEmpty] = useWatch({ control: form.control, name: ['useScan', 'doaEmpty', 'dodEmpty'] })
  const ticked = rows.filter((r) => checked.has(r.wksNo))

  /** CmdSearch_Click. Scan mode adds the scanned worksheet to the list; a range replaces it. */
  const search = form.handleSubmit(async (v) => {
    setTab(0)
    setBusy(true)
    try {
      const { data } = await api.get<PayRow[]>(`${base}/search`, { params: payParams(v) })
      if (data.length === 0) notify('No record found!', 'error')
      else if (v.useScan) {
        const fresh = data.filter((f) => !rows.some((w) => w.wksNo === f.wksNo))
        if (fresh.length === 0) notify('This worksheet is already in the list.', 'info')
        setRows([...rows, ...fresh])
      } else {
        setRows(data)
        setChecked(new Set())
      }
      if (v.useScan) {
        form.setValue('wksNoFrom', '')
        form.setFocus('wksNoFrom')
      }
    } catch (e) {
      notify(errorMessage(e), 'error')
    } finally {
      setBusy(false)
    }
  })

  function clear() {
    form.reset(payDefaults)
    setRows([])
    setLines([])
    setChecked(new Set())
    setTab(0)
  }

  /** lstWorksheetTrackList_ItemCheck: a ticked row must pass the rules, including the scanned documents (checked on the server). */
  async function changeChecked(next: Set<string>) {
    const added = rows.filter((w) => next.has(w.wksNo) && !checked.has(w.wksNo))
    const removed = [...checked].filter((k) => !next.has(k))
    const accepted: string[] = []
    const problems = new Map<string, number>()
    const flag = (text: string) => problems.set(text, (problems.get(text) ?? 0) + 1)
    const needDocs: PayRow[] = []
    for (const r of added) {
      const problem = tickProblem(r)
      if (problem) flag(problem)
      else needDocs.push(r)
    }
    if (needDocs.length > 0) {
      try {
        const { data } = await api.post<{ available: boolean; cases: Record<string, boolean> }>(`${base}/documents`, {
          cases: [...new Set(needDocs.map((r) => r.caseNo))],
        })
        for (const r of needDocs) {
          if (data.available && !data.cases[r.caseNo.trim()]) flag(NO_DOCUMENTS)
          else if (groupCompanyProblem(r)) flag(groupCompanyProblem(r)!)
          else accepted.push(r.wksNo)
        }
      } catch (e) {
        notify(errorMessage(e), 'error')
      }
    }
    problems.forEach((count, text) => notify(count > 1 ? `${text} (${count} worksheets were not selected)` : text, 'error'))
    setChecked((prev) => {
      const n = new Set(prev)
      removed.forEach((k) => n.delete(k))
      accepted.forEach((k) => n.add(k))
      return n
    })
  }

  /** CmdBordx_Click: the checks in the desktop's order, "Do you want to update the record?", then one bordx for the ticked worksheets. */
  async function generate() {
    const problem = bordxProblem(rows.length, ticked.length)
    if (problem) return notify(problem, 'error')
    if (!(await ask('Do you want to update the record?'))) return
    setBusy(true)
    try {
      const { data } = await api.post<{ bordxNo: string; lines: BordxLine[] }>(`${base}/bordx`, bordxRequest(ticked))
      const done = new Set(data.lines.map((l) => l.claimNo))
      setLines(data.lines)
      setRows((current) => current.filter((w) => !done.has(w.wksNo)))
      setChecked(new Set())
      setTab(1)
      notify('Record Saved!', 'success')
    } catch (e) {
      notify(errorMessage(e), 'error')
    } finally {
      setBusy(false)
    }
  }

  return (
    <PageShell title="Payment Advice - Generate Bordx" subtitle="Select worksheets for a payment advice bordx.">
      <form onSubmit={search} noValidate className="screen-form">
        <fieldset>
          <legend>Selection Criteria</legend>
          <CheckField label="Use Scan" {...form.register('useScan')} />
          {useScan ? (
            <>
              <TextField label="Wks No" required maxLength={15} autoFocus error={form.formState.errors.wksNoFrom} {...form.register('wksNoFrom')} />
              <ComboField label="Version" options={worksheetVersions} {...form.register('version')} />
            </>
          ) : (
            <>
              <TextField label="Wks No from" maxLength={15} autoFocus {...form.register('wksNoFrom')} />
              <TextField label="Wks No to" maxLength={15} {...form.register('wksNoTo')} />
            </>
          )}
          <SelectField label="Cash Type" options={cashTypeOptions} {...form.register('cashType')} />
          <TextField label="Hospital" maxLength={100} {...form.register('hospital')} />
          <DateField control={form.control} name="doaFrom" label="DOA from" hint="Date of admission" disabled={doaEmpty} />
          <DateField control={form.control} name="doaTo" label="DOA to" disabled={doaEmpty} />
          <CheckField label="DOA is empty" {...form.register('doaEmpty')} />
          <DateField control={form.control} name="dodFrom" label="DOD from" hint="Date of discharge" disabled={dodEmpty} />
          <DateField control={form.control} name="dodTo" label="DOD to" disabled={dodEmpty} />
          <CheckField label="DOD is empty" {...form.register('dodEmpty')} />
        </fieldset>

        <ActionBar label="Payment advice bordx actions">
          <Button variant="primary" type="submit" busy={busy} busyLabel="Working…">
            Search
          </Button>
          <Button variant="ghost" onClick={() => void generate()} disabled={busy}>
            Bordx
          </Button>
          <Button variant="link" onClick={clear}>
            Clear
          </Button>
          <span className="spacer" />
          {lines.length > 0 && <Stat label="Bordx No" value={lines[0].bordxNo} />}
          <Stat label="Records" value={rows.length} />
          <Stat label="Selected" value={checked.size} />
          <Stat label="Total Amt" value={formatMoney(totalApproved(rows))} />
          <Button variant="link" onClick={() => navigate('/')}>
            Close
          </Button>
        </ActionBar>

        <Tabs
          label="Payment advice bordx sections"
          tabs={['Worksheets', 'Generated Bordx']}
          panels={[
            <DataGrid
              key="rows"
              caption="Worksheets"
              columns={worksheetColumns}
              rows={rows}
              rowKey={(r) => r.wksNo}
              check={{ checked, onChange: changeChecked }}
              tall
              empty="No worksheets. Enter the search criteria and press Search."
            />,
            <DataGrid
              key="lines"
              caption="Generated bordx"
              columns={bordxColumns}
              rows={lines}
              rowKey={(r) => r.claimNo}
              tall
              empty="No bordx generated yet."
            />,
          ]}
          active={tab}
          onChange={setTab}
        />
      </form>
    </PageShell>
  )
}
