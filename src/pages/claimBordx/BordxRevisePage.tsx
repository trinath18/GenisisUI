// Claim Bordx > Worksheet > Remove Worksheet (legacy FrmBordxRevise, "Bordereaux Revise"): look a bordx up by its number, tick the worksheets to take out of it and remove them. A bordx that has
// been sent out cannot be revised. A code starting LO in the Bordx No box opens another screen (the desktop's scan codes).

import { useRef, useState } from 'react'
import type { FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { TextField } from '../../components/Field'
import { DataGrid } from '../../components/DataGrid'
import type { GridColumn } from '../../components/DataGrid'
import { ActionBar, PageShell, Stat } from '../../components/Screen'
import { Button } from '../../components/Button'
import { downloadCsv } from '../../lib/exportCsv'
import type { CsvColumn } from '../../lib/exportCsv'
import { formatMoney } from '../../lib/format'
import { isScanCode, resolveScanCode } from '../../lib/scanCodes'
import { ask, notify } from '../../lib/notifyStore'
import { api, errorMessage } from '../../api/client'
import { useTickList } from '../worksheet/useTickList'
import { reviseConfirmText, reviseDay, reviseKey, reviseLookupProblem, reviseRemoveProblem, reviseRequest } from './bordxReviseRules'
import type { ReviseResult, ReviseRow } from './bordxReviseRules'

const columns: GridColumn<ReviseRow>[] = [
  { key: 'claimNo', label: 'Claim No' },
  { key: 'claimOpenDate', label: 'Claim Reg Date', value: (r) => reviseDay(r.claimOpenDate), sortBy: (r) => r.claimOpenDate ?? '' },
  { key: 'mbmNumber', label: 'Mem No' },
  { key: 'patientName', label: 'Patient' },
  { key: 'dateAdmitted', label: 'DOA', value: (r) => reviseDay(r.dateAdmitted), sortBy: (r) => r.dateAdmitted ?? '' },
  { key: 'dischargeDate', label: 'DOD', value: (r) => reviseDay(r.dischargeDate), sortBy: (r) => r.dischargeDate ?? '' },
  {
    key: 'totalApproved',
    label: 'Approved Amt',
    align: 'right',
    value: (r) => (r.totalApproved == null ? '' : formatMoney(r.totalApproved)),
    sortBy: (r) => r.totalApproved ?? 0,
  },
  { key: 'caseStatus', label: 'Case Status' },
]

const exportColumns: CsvColumn<ReviseRow>[] = columns.map((c) => ({
  label: c.label,
  value: (r) => (c.value ? c.value(r) : (r[c.key as keyof ReviseRow] as string | number | null)?.toString()),
}))

export function BordxRevisePage() {
  const navigate = useNavigate()
  const list = useTickList<ReviseRow>(reviseKey)
  const input = useRef<HTMLInputElement>(null)
  const [bordxNo, setBordxNo] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [shown, setShown] = useState<ReviseResult | null>(null)
  const [busy, setBusy] = useState(false)

  /** CmdGo_Click. */
  async function go(e: FormEvent) {
    e.preventDefault()
    if (isScanCode(bordxNo)) {
      const outcome = resolveScanCode(bordxNo)
      setBordxNo('')
      if (outcome.kind === 'open') return navigate(outcome.route)
      return notify(outcome.kind === 'notMigrated' ? `${outcome.label} has not been migrated yet.` : `Unknown scan code ${outcome.code}.`, 'error')
    }
    const problem = reviseLookupProblem(bordxNo)
    setError(problem)
    if (problem) return input.current?.focus()
    setBusy(true)
    try {
      const { data } = await api.get<ReviseResult>('/api/claim-bordx/revise', { params: { bordxNo: bordxNo.trim() } })
      list.replace(data.rows)
      setShown(data.rows.length === 0 ? null : data)
      if (data.rows.length === 0) notify('No record found!', 'error')
      else if (data.sentOut) notify('This Bordx has been sent out.', 'error')
    } catch (ex) {
      notify(errorMessage(ex), 'error')
    } finally {
      setBusy(false)
    }
  }

  function clear() {
    setBordxNo('')
    setError(null)
    setShown(null)
    list.clear()
    input.current?.focus()
  }

  /** CmdReject_Click: "Are you sure?", the removal in one transaction, then the form is cleared. */
  async function remove() {
    const problem = reviseRemoveProblem(list.ticked.length)
    if (problem) return notify(problem, 'error')
    if (!(await ask(reviseConfirmText))) return
    setBusy(true)
    try {
      const { data } = await api.post<{ message: string }>('/api/claim-bordx/revise/remove', reviseRequest(shown?.bordxNo ?? bordxNo, list.ticked))
      notify(data.message, 'success')
      clear()
    } catch (ex) {
      notify(errorMessage(ex), 'error')
    } finally {
      setBusy(false)
    }
  }

  function exportList() {
    if (list.rows.length === 0) return notify('Report cannot be printed without any record.', 'info')
    downloadCsv(`bordx-${shown?.bordxNo ?? 'revise'}.csv`, exportColumns, list.rows)
  }

  return (
    <PageShell title="Bordereaux Revise" subtitle="Look a bordx up and remove worksheets from it.">
      <form onSubmit={go} noValidate className="screen-form">
        <fieldset>
          <legend>Bordx</legend>
          <TextField
            label="Bordx No"
            required
            maxLength={20}
            autoFocus
            ref={input}
            value={bordxNo}
            onChange={(e) => setBordxNo(e.target.value)}
            hint="Type a code starting LO to open another screen."
            error={error ? { type: 'required', message: error } : undefined}
          />
          <dl className="fields">
            <div className="field">
              <dt>Bordx Date</dt>
              <dd>{reviseDay(shown?.bordxDate ?? null) || '\u00a0'}</dd>
            </div>
            <div className="field">
              <dt>Bordx Printed Date</dt>
              <dd>{reviseDay(shown?.printedDate ?? null) || '\u00a0'}</dd>
            </div>
          </dl>
        </fieldset>

        <ActionBar label="Bordereaux revise actions">
          <Button variant="primary" type="submit" busy={busy} busyLabel="Working…">
            Go
          </Button>
          <Button variant="ghost" onClick={remove} disabled={busy || shown?.sentOut === true}>
            Remove
          </Button>
          <Button variant="ghost" onClick={exportList}>
            Print to File
          </Button>
          <Button variant="link" onClick={clear}>
            Clear
          </Button>
          <span className="spacer" />
          <Stat label="Items" value={shown?.items ?? 0} />
          <Stat label="Selected" value={list.checked.size} />
          <Stat label="Approved Amount" value={formatMoney(shown?.totalApproved ?? 0)} />
          <Button variant="link" onClick={() => navigate('/')}>
            Close
          </Button>
        </ActionBar>

        <DataGrid
          caption="Worksheets of the bordx"
          columns={columns}
          rows={list.rows}
          rowKey={reviseKey}
          check={{ checked: list.checked, onChange: list.change }}
          tall
          empty="No worksheets. Enter a Bordx No and press Go."
        />
      </form>
    </PageShell>
  )
}
