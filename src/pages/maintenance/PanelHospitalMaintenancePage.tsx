// Maintenance > Panel Hospital Maintenance (legacy FrmMaintenancePanelHos, "Panel Hospital Maintenance"): choose a hospital panel code to list its hospitals, Add hospitals to it or Edit it (untick a hospital to
// take it out) and Update.

import { useState } from 'react'
import type { FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { SelectField } from '../../components/Field'
import { DataGrid } from '../../components/DataGrid'
import type { GridColumn } from '../../components/DataGrid'
import { ActionBar, PageShell, Stat } from '../../components/Screen'
import { Button } from '../../components/Button'
import { ask, notify } from '../../lib/notifyStore'
import { api, errorMessage } from '../../api/client'
import { allTicked, codeProblem, columnsFor, rowKey, updateRequest } from './panelHospitalMaintenanceRules'
import type { Hospital, Mode, PanelCode } from './panelHospitalMaintenanceRules'

const base = '/api/maintenance/panel-hospitals'

export function PanelHospitalMaintenancePage() {
  const navigate = useNavigate()
  const codes = useQuery({ queryKey: ['panel-hospital-maintenance', 'codes'], queryFn: async () => (await api.get<PanelCode[]>(`${base}/codes`)).data, staleTime: 10 * 60 * 1000 })
  const [code, setCode] = useState('')
  const [mode, setMode] = useState<Mode>('edit')
  const [rows, setRows] = useState<Hospital[]>([])
  const [checked, setChecked] = useState<ReadonlySet<string>>(new Set())
  const [shown, setShown] = useState(false)
  const [busy, setBusy] = useState(false)

  /** PanelListing: the panel's hospitals, all ticked ("No Record Found!" when it has none). */
  async function list(forCode: string) {
    const { data } = await api.get<Hospital[]>(base, { params: { code: forCode } })
    setMode('edit')
    setRows(data)
    setChecked(allTicked(data))
    setShown(true)
    if (data.length === 0) notify('No Record Found!', 'error')
  }

  /** HOSListing: the hospitals that are not in the panel, none ticked. */
  async function available(forCode: string) {
    const { data } = await api.get<Hospital[]>(`${base}/available`, { params: { code: forCode } })
    setMode('add')
    setRows(data)
    setChecked(new Set())
    setShown(true)
  }

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

  /** cboPLNPayor_Click, cmdSearch_Click and cmdEdit_Click: the panel's hospitals. */
  const search = () => {
    const problem = codeProblem(code)
    if (problem) return notify(problem, 'error')
    return run(() => list(code))
  }

  /** cmdAdd_Click. */
  const add = () => {
    const problem = codeProblem(code)
    if (problem) return notify(problem, 'error')
    return run(() => available(code))
  }

  /** cmdUpdate_Click: "Do you want to update the record?", then the changes in one transaction, then the panel again. */
  async function update(e?: FormEvent) {
    e?.preventDefault()
    const problem = codeProblem(code)
    if (problem) return notify(problem, 'error')
    if (!shown) return notify('Search a panel, or press Add, first.', 'error')
    if (!(await ask('Do you want to update the record?'))) return
    await run(async () => {
      await api.put(base, updateRequest(mode, code, rows, checked))
      notify('Record updated !', 'success')
      await list(code)
    })
  }

  /** CmdClear_Click. */
  function clear() {
    setRows([])
    setChecked(new Set())
    setShown(false)
  }

  const columns: GridColumn<Hospital>[] = columnsFor(mode).map((c) => ({ key: c.key, label: c.label, value: c.value }))

  return (
    <PageShell title="Panel Hospital Maintenance" subtitle="The hospitals of a hospital panel code.">
      <form onSubmit={(e: FormEvent) => void update(e)} noValidate className="screen-form">
        <fieldset>
          <legend>Hospital Panel</legend>
          <SelectField
            label="Hospital Panel Code"
            required
            options={(codes.data ?? []).map((c) => ({ value: c.code, label: c.code }))}
            value={code}
            onChange={(e) => {
              setCode(e.target.value)
              clear()
              if (e.target.value) void run(() => list(e.target.value))
            }}
          />
        </fieldset>
        <ActionBar label="Panel hospital maintenance actions">
          <Button variant="ghost" onClick={() => void search()} disabled={busy}>
            Search
          </Button>
          <Button variant="ghost" onClick={() => void search()} disabled={busy || !shown || mode === 'edit'}>
            Edit
          </Button>
          <Button variant="ghost" onClick={() => void add()} disabled={busy || mode === 'add'}>
            Add
          </Button>
          <Button variant="primary" type="submit" busy={busy} busyLabel="Updating…" disabled={!shown}>
            Update
          </Button>
          <Button variant="link" onClick={clear}>
            Clear
          </Button>
          <span className="spacer" />
          <Stat label="Record(s)" value={rows.length} />
          <Button variant="link" onClick={() => navigate('/')}>
            Close
          </Button>
        </ActionBar>
        <DataGrid
          key={mode}
          caption={mode === 'edit' ? 'Hospitals in the panel' : 'Hospitals that can be added'}
          columns={columns}
          rows={rows}
          rowKey={rowKey}
          check={{ checked, onChange: (next) => setChecked(next) }}
          tall
          empty="No hospitals. Choose a hospital panel code."
        />
      </form>
    </PageShell>
  )
}
