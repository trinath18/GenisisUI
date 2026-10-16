import { useState } from 'react'
import type { KeyboardEvent } from 'react'
import { api, errorMessage } from '../../api/client'
import { DataTable } from '../../components/DataTable'
import type { Column } from '../../components/DataTable'
import { Modal } from '../../components/Modal'
import { notify } from '../../lib/notifyStore'
import type { Row } from '../../lib/format'

interface Opt {
  code: string
  name: string
}

type SearchBy = 'name' | 'ic' | 'policy' | 'number'

const memberColumns: Column[] = [
  { key: 'MBMNumber', label: 'Member No' },
  { key: 'MBMName', label: 'Member Name' },
  { key: 'MBMIcBcPp', label: 'IC No.' },
  { key: 'MBMPolicyNo', label: 'Policy No' },
  { key: 'MBMPayorEffDate', label: 'Eff Date' },
  { key: 'MBMPayorExpDate', label: 'Exp Date' },
  { key: 'PLNCode', label: 'Plan' },
  { key: 'PAYCode', label: 'Payor' },
  { key: 'MBMGroupCompany', label: 'Group Company' },
  { key: 'MBMStatus', label: 'Status' },
]

const enterRuns = (fn: () => void) => (e: KeyboardEvent) => e.key === 'Enter' && (e.preventDefault(), fn())

/** frmSearchMBM (Search button), also used when the Go button gets a partial membership number. */
export function MemberSearchDialog({
  initial,
  onPick,
  onClose,
}: {
  initial?: { by: SearchBy; q: string; rows: Row[] }
  onPick: (mbmNumber: string) => void
  onClose: () => void
}) {
  const [by, setBy] = useState<SearchBy>(initial?.by ?? 'name')
  const [q, setQ] = useState(initial?.q ?? '')
  const [rows, setRows] = useState<Row[]>(initial?.rows ?? [])
  const [selected, setSelected] = useState<Row>()
  const [busy, setBusy] = useState(false)

  async function search() {
    if (q.trim().length < 3) return notify('Enter at least 3 characters.')
    setBusy(true)
    try {
      const { data } = await api.get<Row[]>('/api/case/registration/member-search', { params: { by, q: q.trim() } })
      setRows(data)
      setSelected(undefined)
      if (data.length === 0) notify('No record found!', 'info')
    } catch (e) {
      notify(errorMessage(e), 'error')
    } finally {
      setBusy(false)
    }
  }

  const radio = (value: SearchBy, label: string) => (
    <label className="radio">
      <input type="radio" name="case-reg-search-by" checked={by === value} onChange={() => setBy(value)} /> {label}
    </label>
  )

  return (
    <Modal title="Search For Member" onClose={onClose} wide>
      <div className="search" role="search">
        <input data-autofocus placeholder="Search…" value={q} aria-label="Search text" onChange={(e) => setQ(e.target.value)} onKeyDown={enterRuns(search)} />
        {radio('name', 'Member Name')}
        {radio('ic', 'IC No')}
        {radio('number', 'Member No')}
        {radio('policy', 'Policy No')}
      </div>
      <DataTable
        columns={memberColumns}
        rows={rows}
        rowKey="MBMNumber"
        selectedKey={selected ? String(selected.MBMNumber) : undefined}
        onSelect={setSelected}
        onActivate={(r) => onPick(String(r.MBMNumber))}
      />
      <div className="modal-actions">
        <span className="muted">{rows.length} record(s)</span>
        <span className="spacer" />
        <button type="button" onClick={search} disabled={busy}>
          {busy ? 'Searching…' : 'Search'}
        </button>
        <button type="button" disabled={!selected} onClick={() => selected && onPick(String(selected.MBMNumber))}>
          OK
        </button>
        <button type="button" className="link" onClick={() => (setQ(''), setRows([]), setSelected(undefined))}>
          Clear
        </button>
        <button type="button" className="link" onClick={onClose}>
          Exit
        </button>
      </div>
    </Modal>
  )
}

/** frmSearchICD / FrmSearchRepudiation: same window, different list. Enter or double-click picks a row. */
export function CodeSearchDialog({
  kind,
  group,
  onPick,
  onClose,
}: {
  kind: 'icd' | 'rep'
  group?: 'prelim' | 'final' | 'underlying'
  onPick: (code: string, description: string) => void
  onClose: () => void
}) {
  const icd = kind === 'icd'
  const [code, setCode] = useState('')
  const [desc, setDesc] = useState('')
  const [desc2, setDesc2] = useState('')
  const [andOr, setAndOr] = useState('AND')
  const [rows, setRows] = useState<Row[]>([])
  const [busy, setBusy] = useState(false)

  async function search() {
    setBusy(true)
    try {
      const { data } = await api.get<Row[]>(`/api/case/registration/${icd ? 'icd' : 'repudiation-codes'}`, {
        params: { code: code || undefined, desc: desc || undefined, desc2: desc2 || undefined, any: andOr === 'OR' },
      })
      setRows(data)
      if (data.length === 0) notify('Record not found', 'info')
    } catch (e) {
      notify(errorMessage(e), 'error')
    } finally {
      setBusy(false)
    }
  }

  const columns: Column[] = icd
    ? [
        { key: 'ICDCode', label: 'ICD Code' },
        { key: 'ICDDescription', label: 'ICD Description' },
      ]
    : [
        { key: 'RepCode', label: 'Repudiation Code' },
        { key: 'RepDescription', label: 'Repudiation Description' },
        { key: 'RepNonDisc', label: 'Non-Disc' },
      ]

  const groupLabel = { prelim: 'Preliminary Diagnosis', final: 'Final Diagnosis', underlying: 'Underlying Disease' }

  return (
    <Modal title={icd ? `Search ICD — ${groupLabel[group ?? 'prelim']}` : 'Search Repudiation'} onClose={onClose} wide>
      <div className="search">
        <input data-autofocus placeholder={icd ? 'ICD code' : 'Repudiation code'} aria-label="Code" value={code} onChange={(e) => setCode(e.target.value)} onKeyDown={enterRuns(search)} style={{ width: 140 }} />
        <input placeholder="Description" aria-label="Description" value={desc} onChange={(e) => setDesc(e.target.value)} onKeyDown={enterRuns(search)} />
        <select aria-label="Match" value={andOr} onChange={(e) => setAndOr(e.target.value)}>
          <option>AND</option>
          <option>OR</option>
        </select>
        <input placeholder="Description 2" aria-label="Description 2" value={desc2} onChange={(e) => setDesc2(e.target.value)} onKeyDown={enterRuns(search)} />
      </div>
      <DataTable
        columns={columns}
        rows={rows}
        onActivate={(r) => onPick(String(icd ? r.ICDCode : r.RepCode), String((icd ? r.ICDDescription : r.RepDescription) ?? ''))}
        empty="Search for a code or description."
      />
      <div className="modal-actions">
        <button type="button" onClick={search} disabled={busy}>
          {busy ? 'Searching…' : 'Search'}
        </button>
        <button type="button" className="link" onClick={() => (setCode(''), setDesc(''), setDesc2(''), setRows([]))}>
          Clear
        </button>
        <button type="button" className="link" onClick={onClose}>
          Exit
        </button>
      </div>
    </Modal>
  )
}

/** frmSearchCPT ("Search Procedure") / frmSearchInv ("Search Investigation"): OPCS codes from MMAProcedures.
 *  Investigations are ProcPart 'A'. Enter or double-click picks a code. */
export function ProcedureSearchDialog({ inv, onPick, onClose }: { inv?: boolean; onPick: (code: string) => void; onClose: () => void }) {
  const [code, setCode] = useState('')
  const [desc, setDesc] = useState('')
  const [rows, setRows] = useState<Row[]>([])
  const [busy, setBusy] = useState(false)

  async function search() {
    setBusy(true)
    try {
      const { data } = await api.get<Row[]>('/api/case/registration/procedures', {
        params: { code: code || undefined, desc: desc || undefined, inv: inv || undefined },
      })
      setRows(data)
      if (data.length === 0) notify('Record not found', 'info')
    } catch (e) {
      notify(errorMessage(e), 'error')
    } finally {
      setBusy(false)
    }
  }

  const columns: Column[] = [
    { key: 'OPCSCode', label: inv ? 'INV Code' : 'CPT Code' },
    { key: 'OPCSNarrative', label: inv ? 'INV Description' : 'CPT Description' },
  ]

  return (
    <Modal title={inv ? 'Search Investigation' : 'Search Procedure'} onClose={onClose} wide>
      <div className="search">
        <input data-autofocus placeholder={inv ? 'Inv code' : 'MMA code'} maxLength={10} aria-label="Code" value={code} onChange={(e) => setCode(e.target.value)} onKeyDown={enterRuns(search)} style={{ width: 140 }} />
        <input placeholder={inv ? 'Inv description' : 'MMA description'} aria-label="Description" value={desc} onChange={(e) => setDesc(e.target.value)} onKeyDown={enterRuns(search)} />
      </div>
      <DataTable columns={columns} rows={rows} onActivate={(r) => onPick(String(r.OPCSCode))} empty="Search for a code or description." />
      <div className="modal-actions">
        <button type="button" onClick={search} disabled={busy}>
          {busy ? 'Searching…' : 'Search'}
        </button>
        <button type="button" className="link" onClick={() => (setCode(''), setDesc(''), setRows([]))}>
          Clear
        </button>
        <button type="button" className="link" onClick={onClose}>
          Exit
        </button>
      </div>
    </Modal>
  )
}

export interface RepSelection {
  document: string
  personnel: string
  attention: string
  underlying: 'Y' | 'N'
}

/** frmRepudiationSelection: the letter selections a repudiated case needs (Attention stays hidden, as on the desktop). */
export function RepudiationSelectionDialog({
  value,
  documents,
  personnel,
  onSave,
  onClose,
}: {
  value: RepSelection
  documents: Opt[]
  personnel: Opt[]
  onSave: (v: RepSelection) => void
  onClose: () => void
}) {
  const [v, setV] = useState(value)
  const set = (patch: Partial<RepSelection>) => setV((x) => ({ ...x, ...patch }))

  function save() {
    if (!v.document) return notify('Please select Document type')
    if (!v.personnel) return notify('Please select Personnel type')
    onSave(v)
  }

  const option = (list: Opt[]) => (
    <>
      <option value="" />
      {list.map((o) => (
        <option key={`${o.code}|${o.name ?? ''}`} value={o.code}>
          {o.name ? `${o.code} - ${o.name}` : o.code}
        </option>
      ))}
    </>
  )

  return (
    <Modal title="Repudiation Categories" onClose={onClose}>
      <fieldset className="modal-fields">
        <label className="form-field">
          <span>Documents</span>
          <select data-autofocus value={v.document} onChange={(e) => set({ document: e.target.value })}>
            {option(documents)}
          </select>
        </label>
        <label className="form-field">
          <span>Personnel</span>
          <select value={v.personnel} onChange={(e) => set({ personnel: e.target.value })}>
            {option(personnel)}
          </select>
        </label>
        <div className="form-field">
          <span>Underlying</span>
          <div className="radio-row">
            <label className="radio">
              <input type="radio" name="rep-underlying" checked={v.underlying === 'Y'} onChange={() => set({ underlying: 'Y' })} /> Yes
            </label>
            <label className="radio">
              <input type="radio" name="rep-underlying" checked={v.underlying === 'N'} onChange={() => set({ underlying: 'N' })} /> No
            </label>
          </div>
        </div>
      </fieldset>
      <div className="modal-actions">
        <button type="button" onClick={save}>
          Save
        </button>
        <button type="button" className="link" onClick={onClose}>
          Exit
        </button>
      </div>
    </Modal>
  )
}
