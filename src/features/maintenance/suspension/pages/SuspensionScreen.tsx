// Maintenance > Suspension (legacy frmSuspensionDetail, "Suspension Detail"): the Suspension Category tab (the categories) and the Suspension Details tab (the suspended members and agents).
// Search lists the records; clicking a row loads it (read only) and enables Edit and Delete; Add starts a new one.

import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ComboField, SelectField, TextField } from '../../../../components/Field'
import { DataGrid } from '../../../../components/DataGrid'
import type { GridColumn } from '../../../../components/DataGrid'
import { ActionBar, PageShell, Stat } from '../../../../components/Screen'
import { Button } from '../../../../components/Button'
import { Tabs } from '../../../../components/Tabs'
import { downloadCsv } from '../../../../lib/exportCsv'
import { ask, notify } from '../../../../lib/notifyStore'
import { api, errorMessage } from '../../../../api/client'
import { useWorksheetLookups } from '../../../../pages/worksheet/useWorksheetLookups'
import {
  categoryDeleteProblem,
  categoryProblem,
  categoryRequest,
  clean,
  detailDeleteProblem,
  detailProblem,
  detailRequest,
  emptyCategory,
  emptyDetail,
  keyLabel,
  payorOfMember,
  selectionOptions,
} from '../suspensionRules'
import type { CategoryRow, CategoryValues, DetailRow, DetailValues } from '../suspensionRules'

type Mode = 'view' | 'add' | 'edit'
const base = '/api/maintenance/suspension'

const categoryColumns: GridColumn<CategoryRow>[] = [
  { key: 'code', label: 'Suspension Code' },
  { key: 'description', label: 'Description' },
]
const detailColumns: GridColumn<DetailRow>[] = [
  { key: 'selection', label: 'Suspension Code' },
  { key: 'keyCode', label: 'Member Number / Agent Code' },
  { key: 'description', label: 'Description' },
  { key: 'payor', label: 'Payor' },
]
const detailKey = (r: DetailRow) => `${r.selection}|${r.keyCode}`

export function SuspensionScreen() {
  const navigate = useNavigate()
  const lookups = useWorksheetLookups()
  const [tab, setTab] = useState(0)
  const [busy, setBusy] = useState(false)

  const [catMode, setCatMode] = useState<Mode>('view')
  const [cat, setCat] = useState<CategoryValues>(emptyCategory)
  const [catRows, setCatRows] = useState<CategoryRow[]>([])
  const [catSelected, setCatSelected] = useState<string | null>(null)

  const [detMode, setDetMode] = useState<Mode>('view')
  const [det, setDet] = useState<DetailValues>(emptyDetail)
  const [detRows, setDetRows] = useState<DetailRow[]>([])
  const [detSelected, setDetSelected] = useState<string | null>(null)

  const [error, setError] = useState<{ field: string; message: string } | null>(null)
  const fail = (e: unknown) => notify(errorMessage(e), 'error')
  const showError = (field: string) => (error?.field === field ? { type: 'required', message: error.message } : undefined)

  async function run(work: () => Promise<void>) {
    setBusy(true)
    try {
      await work()
    } catch (e) {
      fail(e)
    } finally {
      setBusy(false)
    }
  }

  // ---------------- Suspension Category
  const searchCategories = (code = cat.code) =>
    run(async () => {
      const { data } = await api.get<CategoryRow[]>(`${base}/categories`, { params: { code: clean(code) || undefined } })
      setCatRows(data)
      if (data.length === 0) notify('Record not found', 'info')
    })

  const clearCategory = () => {
    setCat(emptyCategory)
    setCatMode('view')
    setCatSelected(null)
    setError(null)
  }

  const saveCategory = () => {
    const problem = categoryProblem(cat)
    setError(problem)
    if (problem) return
    return run(async () => {
      if (!(await ask('Do you want to save the record?'))) return
      const { data } = await (catMode === 'edit' ? api.put<{ message: string }>(`${base}/categories`, categoryRequest(cat)) : api.post<{ message: string }>(`${base}/categories`, categoryRequest(cat)))
      notify(data.message, 'success')
      clearCategory()
      await searchCategories('')
    })
  }

  const deleteCategory = () => {
    const problem = categoryDeleteProblem(cat.code, catRows.length)
    if (problem) return notify(problem, 'error')
    return run(async () => {
      if (!(await ask('Do you want to delete this record?'))) return
      const { data } = await api.delete<{ message: string }>(`${base}/categories/${encodeURIComponent(clean(cat.code))}`)
      notify(data.message, 'success')
      clearCategory()
      await searchCategories('')
    })
  }

  // ---------------- Suspension Details
  const searchDetails = (values = det) =>
    run(async () => {
      const { data } = await api.get<DetailRow[]>(`${base}/details`, { params: { selection: values.selection || undefined, key: clean(values.key) || undefined, payor: values.payor || undefined } })
      setDetRows(data)
      if (data.length === 0) notify('Record not found', 'info')
    })

  const clearDetail = () => {
    setDet(emptyDetail)
    setDetMode('view')
    setDetSelected(null)
    setError(null)
  }

  const saveDetail = () => {
    const problem = detailProblem(det)
    setError(problem)
    if (problem) return
    return run(async () => {
      if (!(await ask('Do you want to save the record?'))) return
      const { data } = await (detMode === 'edit' ? api.put<{ message: string }>(`${base}/details`, detailRequest(det)) : api.post<{ message: string }>(`${base}/details`, detailRequest(det)))
      notify(data.message, 'success')
      clearDetail()
      await searchDetails(emptyDetail)
    })
  }

  const deleteDetail = () => {
    const problem = detailDeleteProblem(det, detRows.length)
    if (problem) return notify(problem, 'error')
    return run(async () => {
      if (!(await ask('Do you want to delete the record?'))) return
      const { data } = await api.delete<{ message: string }>(`${base}/details`, { params: { selection: det.selection, key: clean(det.key) } })
      notify(data.message, 'success')
      clearDetail()
      await searchDetails(emptyDetail)
    })
  }

  /** txtAGTCode_LostFocus: the key is upper-cased and, for a member, its payor is looked up from the first two letters. */
  function leaveKey() {
    const key = clean(det.key)
    const next = { ...det, key }
    if (det.selection.startsWith('01') && key) {
      const payor = payorOfMember(key, lookups.payors)
      if (payor) next.payor = payor
      else if (lookups.payors.length > 0) notify('Invalid MembershipNumber', 'info')
    }
    setDet(next)
  }

  const print = () => {
    const rows = tab === 0 ? catRows : detRows
    if (rows.length === 0) return notify('Report cannot be printed without any record.', 'info')
    if (tab === 0) downloadCsv('suspension-categories.csv', categoryColumns.map((c) => ({ label: c.label, value: (r: CategoryRow) => String(r[c.key as keyof CategoryRow] ?? '') })), catRows)
    else downloadCsv('suspension-details.csv', detailColumns.map((c) => ({ label: c.label, value: (r: DetailRow) => String(r[c.key as keyof DetailRow] ?? '') })), detRows)
  }

  const mode = tab === 0 ? catMode : detMode
  const selected = tab === 0 ? catSelected : detSelected
  const adding = mode !== 'view'
  const total = tab === 0 ? catRows.length : detRows.length

  function startAdd() {
    if (tab === 0) {
      clearCategory()
      setCatMode('add')
    } else {
      clearDetail()
      setDetMode('add')
    }
  }
  function startEdit() {
    if (tab === 0) setCatMode('edit')
    else setDetMode('edit')
  }
  function switchTab(i: number) {
    setTab(i)
    setError(null)
  }
  const clearAll = () => {
    clearCategory()
    clearDetail()
    setCatRows([])
    setDetRows([])
  }

  const categoryPanel = (
    <div className="screen-form">
      <fieldset>
        <legend>Suspension Category</legend>
        <TextField label="Suspension Code" required maxLength={4} disabled={catMode === 'edit' || (catMode === 'view' && catSelected !== null)} value={cat.code} onChange={(e) => setCat({ ...cat, code: e.target.value })} error={showError('code')} />
        <TextField label="Suspension Description" required maxLength={100} readOnly={catMode === 'view' && catSelected !== null} value={cat.description} onChange={(e) => setCat({ ...cat, description: e.target.value })} error={showError('description')} />
      </fieldset>
      <DataGrid
        caption="Suspension categories"
        columns={categoryColumns}
        rows={catRows}
        rowKey={(r) => r.code}
        selectedKey={catSelected}
        onSelect={(r) => {
          setCat({ code: r.code, description: r.description ?? '' })
          setCatSelected(r.code)
          setCatMode('view')
          setError(null)
        }}
        empty="No categories. Press Search."
      />
    </div>
  )

  const detailPanel = (
    <div className="screen-form">
      <fieldset>
        <legend>Suspension Details</legend>
        <SelectField label="Selection" required options={selectionOptions} disabled={detMode === 'edit' || (detMode === 'view' && detSelected !== null)} value={det.selection} onChange={(e) => setDet({ ...det, selection: e.target.value })} error={showError('selection')} />
        <TextField label={`${keyLabel(det.selection)}`} required maxLength={30} disabled={detMode === 'edit' || (detMode === 'view' && detSelected !== null)} value={det.key} onChange={(e) => setDet({ ...det, key: e.target.value })} onBlur={leaveKey} error={showError('key')} />
        <TextField label="Description" required maxLength={200} readOnly={detMode === 'view' && detSelected !== null} value={det.description} onChange={(e) => setDet({ ...det, description: e.target.value })} error={showError('description')} />
        <ComboField label="Payor" required options={lookups.payors} disabled={detMode === 'edit' || (detMode === 'view' && detSelected !== null)} value={det.payor} onChange={(e) => setDet({ ...det, payor: e.target.value })} error={showError('payor')} />
      </fieldset>
      <DataGrid
        caption="Suspended members and agents"
        columns={detailColumns}
        rows={detRows}
        rowKey={detailKey}
        selectedKey={detSelected}
        onSelect={(r) => {
          setDet({ selection: r.selection, key: r.keyCode ?? '', description: r.description ?? '', payor: r.payorCode ? r.payor : '' })
          setDetSelected(detailKey(r))
          setDetMode('view')
          setError(null)
        }}
        empty="No suspensions. Press Search."
      />
    </div>
  )

  return (
    <PageShell title="Suspension Detail" subtitle="Suspension categories and the members and agents that are suspended.">
      <Tabs label="Suspension" tabs={['Suspension Category', 'Suspension Details']} panels={[categoryPanel, detailPanel]} active={tab} onChange={switchTab} />
      <ActionBar label="Suspension actions">
        <Button variant="primary" onClick={() => void (tab === 0 ? searchCategories() : searchDetails())} busy={busy} busyLabel="Working…">
          Search
        </Button>
        <Button variant="ghost" onClick={startAdd} disabled={busy}>
          Add
        </Button>
        <Button variant="ghost" onClick={startEdit} disabled={busy || selected === null || adding}>
          Edit
        </Button>
        <Button variant="ghost" onClick={() => void (tab === 0 ? saveCategory() : saveDetail())} disabled={busy || !adding}>
          Save
        </Button>
        <Button variant="ghost" onClick={() => void (tab === 0 ? deleteCategory() : deleteDetail())} disabled={busy || selected === null || adding}>
          Delete
        </Button>
        <Button variant="ghost" onClick={print}>
          Print
        </Button>
        <Button variant="link" onClick={clearAll}>
          Clear
        </Button>
        <span className="spacer" />
        <Stat label="Total Records" value={total} />
        <Button variant="link" onClick={() => navigate('/')}>
          Close
        </Button>
      </ActionBar>
    </PageShell>
  )
}
