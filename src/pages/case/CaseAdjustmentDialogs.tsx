// frmGLMenu (Generate Guarantee Letter) and frmCASList (case pick-list) for Case > Adjustment.

import { useEffect, useState } from 'react'
import { api, errorMessage } from '../../api/client'
import { Modal } from '../../components/Modal'
import { DataTable } from '../../components/DataTable'
import type { Column } from '../../components/DataTable'
import { ask, notify } from '../../lib/notifyStore'
import { formatDate, formatMoney, formatValue } from '../../lib/format'
import type { Row } from '../../lib/format'
import { maskTime, digitsOnly } from '../../lib/masks'
import { DateInput } from '../../components/DateInput'
import { isoDmy, num, S } from './caseShared'
import type { LetterResult } from './CaseLetters'
import { caseEndpoints, glDecision, needsTakeOver } from './glRules'
import type { GlCheck, GlEndpoints } from './glRules'

interface GLOptions {
  purposes: string[]
  requestModes: string[]
  requestBy: string[]
  delayReasons: string[]
}

interface GLDefaults {
  requestDate?: string
  requestTime?: string
  lastPurpose?: string
}

const pad = (n: number) => String(n).padStart(2, '0')
const todayDmy = () => {
  const d = new Date()
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}`
}
const nowHm = () => {
  const d = new Date()
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`
}

/** frmGLMenu: collect the GL details, run the server-side checks, then issue the GL. */
export function GlDialog({ cas, request, defaultAmount, onIssued, onClose, endpoints, final = false }: {
  cas: string
  request: () => object
  defaultAmount: string
  onIssued: (result: { lgNumber: string; letter: LetterResult }) => void
  onClose: () => void
  endpoints?: GlEndpoints
  final?: boolean
}) {
  const urls = endpoints ?? caseEndpoints(cas)
  const [f, setF] = useState<Record<string, string>>({})
  const [options, setOptions] = useState<GLOptions | null>(null)
  const [lastPurpose, setLastPurpose] = useState<string | undefined>()
  const [busy, setBusy] = useState(false)
  const v = (k: string) => f[k] ?? ''
  const set = (k: string, x: string) => setF((s) => ({ ...s, [k]: x }))

  useEffect(() => {
    let live = true
    Promise.all([
      api.get<GLOptions>(urls.options),
      api.get<GLDefaults>(urls.defaults),
    ])
      .then(([o, d]) => {
        if (!live) return
        setOptions(o.data)
        setLastPurpose(d.data.lastPurpose)
        setF((s) => ({
          ...s,
          requestDate: s.requestDate ?? (d.data.requestDate ? formatDate(d.data.requestDate) : todayDmy()),
          requestTime: s.requestTime ?? (d.data.requestTime || nowHm()),
          glDate: s.glDate ?? todayDmy(),
          glTime: s.glTime ?? nowHm(),
          lgAmount: s.lgAmount ?? defaultAmount,
        }))
      })
      .catch((e) => notify(errorMessage(e), 'error'))
    return () => {
      live = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cas])

  async function issue() {
    if (busy) return
    const body: Record<string, unknown> = {
      purpose: v('purpose') || null,
      requestDate: isoDmy(v('requestDate')),
      requestTime: v('requestTime'),
      requestMode: v('requestMode') || null,
      requestBy: v('requestBy') || null,
      glDate: isoDmy(v('glDate')),
      glTime: v('glTime'),
      faxDate: isoDmy(v('faxDate')),
      faxTime: v('faxTime'),
      lgAmount: num(v('lgAmount')),
      delayReason: v('delayReason') || null,
      remarks: v('remarks') || null,
      form: request(),
    }
    setBusy(true)
    try {
      let { data: check } = await api.post<GlCheck>(urls.check, body)
      if (needsTakeOver(final, check)) {
        if (!(await ask(check.prompt ?? 'Have you checked Take Over clause?'))) return
        body.takeOverChecked = true
        check = (await api.post<GlCheck>(urls.check, body)).data
      }
      const decision = glDecision(final, check)
      if ('stop' in decision) {
        notify(decision.stop, 'error')
        return
      }
      if (!(await ask(decision.ask))) return
      const { data: result } = await api.post<{ lgNumber: string; letter: LetterResult }>(urls.issue, body)
      onIssued(result)
    } catch (e) {
      notify(errorMessage(e), 'error')
    } finally {
      setBusy(false)
    }
  }

  const field = (label: string, children: React.ReactNode) => (
    <label className="form-field">
      <span>{label}</span>
      {children}
    </label>
  )
  const date = (k: string) => <DateInput value={v(k)} onChange={(x) => set(k, x)} />
  const time = (k: string) => <input value={v(k)} placeholder="hh:mm" maxLength={5} inputMode="numeric" onChange={(e) => set(k, maskTime(e.target.value))} />
  const pick = (k: string, list: string[]) => (
    <select value={v(k)} onChange={(e) => set(k, e.target.value)}>
      <option value="" />
      {list.map((x) => (
        <option key={x} value={x}>
          {x}
        </option>
      ))}
    </select>
  )

  return (
    <Modal title={`${final ? 'Final Guarantee Letter' : 'Generate Guarantee Letter'} — ${cas}`} onClose={onClose} wide>
      {lastPurpose && <p className="muted">Last GL purpose on this case: {lastPurpose}</p>}
      <div className="fields gl-fields">
        {field('Purpose', pick('purpose', options?.purposes ?? []))}
        {field('Request Date', date('requestDate'))}
        {field('Request Time', time('requestTime'))}
        {field('Request Mode', pick('requestMode', options?.requestModes ?? []))}
        {field('Request By', pick('requestBy', options?.requestBy ?? []))}
        {field('GL Date', date('glDate'))}
        {field('GL Time', time('glTime'))}
        {field('Fax Date', date('faxDate'))}
        {field('Fax Time', time('faxTime'))}
        {field('GL Amount', <input value={v('lgAmount')} inputMode="decimal" onChange={(e) => set('lgAmount', digitsOnly(e.target.value))} />)}
        {field('Delay Reason', pick('delayReason', options?.delayReasons ?? []))}
      </div>
      <label className="form-field wide">
        <span>Remarks</span>
        <textarea value={v('remarks')} rows={3} maxLength={200} onChange={(e) => set('remarks', e.target.value)} />
      </label>
      <div className="modal-actions">
        <button type="button" className="primary" onClick={issue} disabled={busy}>
          {busy ? 'Working…' : final ? 'Issue Final LG' : 'Issue GL'}
        </button>
        <button type="button" className="ghost" onClick={onClose}>
          Cancel
        </button>
      </div>
    </Modal>
  )
}

const searchBy = [
  { code: 'case', name: 'Case No' },
  { code: 'member', name: 'Member No' },
  { code: 'policy', name: 'Policy No' },
  { code: 'name', name: 'Member Name' },
  { code: 'ic', name: 'IC / BC / PP' },
  { code: 'employee', name: 'Employee No' },
  { code: 'polsub', name: 'Policy Sub No' },
]

const caseColumns: Column[] = [
  { key: 'CASNumber', label: 'Case No' },
  { key: 'MBMNumber', label: 'Member No' },
  { key: 'MBMPatientCovID', label: 'Patient ID' },
  { key: 'PatientName', label: 'Patient' },
  { key: 'MBMPolicyNo', label: 'Policy No' },
  { key: 'CASDateAdmitted', label: 'Admitted', format: (x) => formatDate(x) },
  { key: 'CASDischargeDate', label: 'Discharged', format: (x) => formatDate(x) },
  { key: 'CASStatus', label: 'Sts' },
  { key: 'CASHOSCode', label: 'Hospital' },
  { key: 'CASReserveAmount', label: 'Reserve', format: (x) => formatMoney(x) },
  { key: 'CASClaimability', label: 'Claim', format: (x) => formatValue(x) },
]

/** frmCASList (Source = Case Adjustment): find a case, then load it. */
export function CaseSearchDialog({ onPick, onClose }: { onPick: (cas: string) => void; onClose: () => void }) {
  const [by, setBy] = useState('case')
  const [q, setQ] = useState('')
  const [rows, setRows] = useState<Row[]>([])
  const [busy, setBusy] = useState(false)

  async function search() {
    const query = q.trim()
    if (query.length < 3) return notify('Enter at least 3 characters.', 'error')
    setBusy(true)
    try {
      const { data } = await api.get<Row[]>('/api/case/adjustment/search', { params: { by, q: query } })
      if (data.length === 0) notify('No record found!', 'error')
      else if (data.length === 1) onPick(S(data[0].CASNumber))
      else setRows(data)
    } catch (e) {
      notify(errorMessage(e), 'error')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal title="Case Search" onClose={onClose} wide>
      <div className="search-inline">
        <select value={by} onChange={(e) => setBy(e.target.value)} aria-label="Search by">
          {searchBy.map((x) => (
            <option key={x.code} value={x.code}>
              {x.name}
            </option>
          ))}
        </select>
        <input value={q} placeholder="Search text" autoFocus onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && search()} />
        <button type="button" className="primary" onClick={search} disabled={busy}>
          {busy ? 'Searching…' : 'Search'}
        </button>
      </div>
      <DataTable
        columns={caseColumns}
        rows={rows}
        empty="Enter a search above."
        onActivate={(r) => onPick(S(r.CASNumber))}
      />
      <p className="muted">Double-click or press Enter on a row to open the case.</p>
    </Modal>
  )
}
