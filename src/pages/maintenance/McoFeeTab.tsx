import { useState } from 'react'
import type { FormEvent } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api, errorMessage } from '../../api/client'

interface McoFeeRow {
  index: number
  planCode: string
  healthCode: string
  insuredCode: string
  suppStatus: string | null
  adult: number | null
  child: number | null
  suppAdult: number | null
  suppChild: number | null
  effectiveDate: string | null
  coveredIdCharge: string | null
}

interface Amounts {
  adult: string
  child: string
  suppAdult: string
  suppChild: string
}

const insuredCodes = ['I', 'F', 'G', 'H'] as const
const family = (ins: string) => ins === 'F' || ins === 'H'
const blank: Amounts = { adult: '', child: '', suppAdult: '', suppChild: '' }
const blankRows = () => Object.fromEntries(insuredCodes.map((c) => [c, { ...blank }])) as Record<string, Amounts>
const emptyHeader = { planCode: '', healthCode: '', suppStatus: 'A', effectiveDate: '', coveredIdCharge: '' }
const money = (v: number | null) => (v == null ? '' : v.toLocaleString(undefined, { minimumFractionDigits: 2 }))
const amount = (v: string) => (v.trim() === '' ? null : Number(v))
const text = (v: number | null) => v?.toString() ?? ''

/** MCO Fee tab: one save adds a fee row per insured type (I, F, G, H) that has an adult fee; Edit changes one row. */
export function McoFeeTab() {
  const queryClient = useQueryClient()
  const [header, setHeader] = useState(emptyHeader)
  const [rows, setRows] = useState(blankRows)
  const [editing, setEditing] = useState<McoFeeRow | null>(null)
  const [filter, setFilter] = useState<{ planCode: string; healthCode: string; effectiveDate: string; n: number } | null>(null)
  const [done, setDone] = useState<string | null>(null)
  const url = '/api/maintenance/mco-fees'

  const health = useQuery({
    queryKey: ['code-list', 'health-types', 'options'],
    queryFn: async () => (await api.get<{ code: string; description: string | null }[]>('/api/maintenance/code-lists/health-types')).data,
  })
  const search = useQuery({
    queryKey: ['mco-fees', filter],
    enabled: filter !== null,
    queryFn: async () =>
      (
        await api.get<{ rows: McoFeeRow[]; truncated: boolean; limit: number }>(url, {
          params: {
            planCode: filter!.planCode || undefined,
            healthCode: filter!.healthCode || undefined,
            effectiveDate: filter!.effectiveDate || undefined,
          },
        })
      ).data,
  })
  const refresh = () => queryClient.invalidateQueries({ queryKey: ['mco-fees'] })

  const save = useMutation({
    mutationFn: async () => {
      if (editing) {
        const r = rows[editing.insuredCode]
        return api.put(`${url}/${editing.index}`, {
          effectiveDate: header.effectiveDate || null,
          adult: amount(r.adult),
          child: amount(r.child),
          suppAdult: amount(r.suppAdult),
          suppChild: amount(r.suppChild),
          coveredIdCharge: header.coveredIdCharge || null,
        })
      }
      return api.post(url, {
        ...header,
        effectiveDate: header.effectiveDate || null,
        coveredIdCharge: header.coveredIdCharge || null,
        rows: insuredCodes.map((c) => ({
          insuredCode: c,
          adult: amount(rows[c].adult),
          child: amount(rows[c].child),
          suppAdult: amount(rows[c].suppAdult),
          suppChild: amount(rows[c].suppChild),
        })),
      })
    },
    onSuccess: () => {
      setDone(editing ? 'Record Updated...' : 'Record Saved...')
      if (filter === null) setFilter({ planCode: header.planCode, healthCode: header.healthCode, effectiveDate: '', n: 0 })
      clear()
      refresh()
    },
  })
  const remove = useMutation({
    mutationFn: async (index: number) => api.delete(`${url}/${index}`),
    onSuccess: (_, index) => {
      setDone('Record Deleted...')
      if (editing?.index === index) clear()
      refresh()
    },
  })
  const busy = save.isPending || remove.isPending

  const resetFeedback = () => {
    setDone(null)
    if (!save.isPending) save.reset()
    if (!remove.isPending) remove.reset()
  }
  const clear = () => {
    setHeader(emptyHeader)
    setRows(blankRows())
    setEditing(null)
  }
  const onSave = (e: FormEvent) => {
    e.preventDefault()
    if (busy) return
    resetFeedback()
    if (window.confirm('Do you want to save the record?')) save.mutate()
  }
  const onEdit = (r: McoFeeRow) => {
    resetFeedback()
    setEditing(r)
    setHeader({
      planCode: r.planCode,
      healthCode: r.healthCode,
      suppStatus: r.suppStatus ?? 'A',
      effectiveDate: r.effectiveDate?.slice(0, 10) ?? '',
      coveredIdCharge: r.coveredIdCharge ?? '',
    })
    setRows({ ...blankRows(), [r.insuredCode]: { adult: text(r.adult), child: text(r.child), suppAdult: text(r.suppAdult), suppChild: text(r.suppChild) } })
  }
  const shown = editing ? [editing.insuredCode] : insuredCodes
  const supp = header.suppStatus !== 'A'
  const cell = (ins: string, field: keyof Amounts) => (
    <td className="num">
      <input type="number" min={0} step="0.01" aria-label={`${ins} ${field}`} value={rows[ins][field]} disabled={busy}
        onChange={(e) => setRows({ ...rows, [ins]: { ...rows[ins], [field]: e.target.value } })} />
    </td>
  )

  return (
    <section>
      <form className="registration" onSubmit={onSave}>
        <fieldset>
          <label className="form-field">
            <span>Health Type *</span>
            <select value={header.healthCode} disabled={busy || editing !== null}
              onChange={(e) => setHeader({ ...header, healthCode: e.target.value })}>
              <option value="" />
              {health.data?.map((o) => (
                <option key={o.code} value={o.code}>{o.code} - {o.description}</option>
              ))}
            </select>
          </label>
          <label className="form-field">
            <span>Plan Code *</span>
            <input value={header.planCode} maxLength={4} disabled={busy || editing !== null}
              onChange={(e) => setHeader({ ...header, planCode: e.target.value.toUpperCase() })} />
          </label>
          <label className="form-field">
            <span>Supp. MCO Status</span>
            <select value={header.suppStatus} disabled={busy || editing !== null}
              onChange={(e) => setHeader({ ...header, suppStatus: e.target.value })}>
              {['A', 'B', 'C', 'D'].map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </label>
          <label className="form-field">
            <span>Effective Date *</span>
            <input type="date" value={header.effectiveDate} disabled={busy}
              onChange={(e) => setHeader({ ...header, effectiveDate: e.target.value })} />
          </label>
          {header.suppStatus === 'D' && (
            <label className="form-field">
              <span>Covered ID Charge *</span>
              <input value={header.coveredIdCharge} maxLength={2} disabled={busy}
                onChange={(e) => setHeader({ ...header, coveredIdCharge: e.target.value.toUpperCase() })} />
            </label>
          )}
          <div className="form-field wide table-wrap">
            <table className="grid">
              <thead>
                <tr>
                  <th className="center">Insured</th>
                  <th className="num">Adult</th>
                  <th className="num">Child</th>
                  {supp && <th className="num">Supp. Adult</th>}
                  {supp && <th className="num">Supp. Child</th>}
                </tr>
              </thead>
              <tbody>
                {shown.map((ins) => (
                  <tr key={ins}>
                    <td className="center">{ins}</td>
                    {cell(ins, 'adult')}
                    {cell(ins, 'child')}
                    {supp && (family(ins) ? cell(ins, 'suppAdult') : <td />)}
                    {supp && (family(ins) ? cell(ins, 'suppChild') : <td />)}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </fieldset>
        {save.isError && <p className="error">{errorMessage(save.error)}</p>}
        {remove.isError && <p className="error">{errorMessage(remove.error)}</p>}
        {done && <p className="success">{done}</p>}
        <div className="actions">
          <button type="submit" disabled={busy}>{editing ? 'Update' : 'Save'}</button>
          <button type="button" disabled={busy || editing !== null}
            onClick={() => {
              resetFeedback()
              setFilter((f) => ({ planCode: header.planCode, healthCode: header.healthCode, effectiveDate: header.effectiveDate, n: (f?.n ?? 0) + 1 }))
            }}>
            Search
          </button>
          <button type="button" disabled={busy} onClick={() => { resetFeedback(); clear() }}>Clear</button>
        </div>
      </form>

      {search.isError && <p className="error">{errorMessage(search.error)}</p>}
      {search.data && (
        <>
          <p className="muted">
            Total records: {search.data.rows.length}
            {search.data.truncated && ` (first ${search.data.limit} shown, narrow the search)`}
          </p>
          {search.data.rows.length === 0 ? (
            <p className="muted">Record not found</p>
          ) : (
            <div className="table-wrap">
              <table className="grid">
                <thead>
                  <tr>
                    <th className="center">Health</th>
                    <th className="center">Insured</th>
                    <th className="center">Plan</th>
                    <th className="center">Status</th>
                    <th className="num">Adult</th>
                    <th className="num">Child</th>
                    <th className="num">Supp. Adult</th>
                    <th className="num">Supp. Child</th>
                    <th>Effective</th>
                    <th className="center">Cov. ID</th>
                    <th className="action-cell" />
                  </tr>
                </thead>
                <tbody>
                  {search.data.rows.map((r) => (
                    <tr key={r.index} className={editing?.index === r.index ? 'selected' : undefined}>
                      <td className="center">{r.healthCode}</td>
                      <td className="center">{r.insuredCode}</td>
                      <td className="center">{r.planCode}</td>
                      <td className="center">{r.suppStatus}</td>
                      <td className="num">{money(r.adult)}</td>
                      <td className="num">{money(r.child)}</td>
                      <td className="num">{money(r.suppAdult)}</td>
                      <td className="num">{money(r.suppChild)}</td>
                      <td>{r.effectiveDate?.slice(0, 10)}</td>
                      <td className="center">{r.coveredIdCharge}</td>
                      <td className="action-cell">
                        <button type="button" className="link" disabled={busy} onClick={() => onEdit(r)}>Edit</button>
                        <button type="button" className="link" disabled={busy}
                          onClick={() => window.confirm('Do you want to delete this record?') && (resetFeedback(), remove.mutate(r.index))}>
                          Delete
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </section>
  )
}
