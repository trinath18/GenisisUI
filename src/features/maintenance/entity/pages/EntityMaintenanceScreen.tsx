import { useState } from 'react'
import type { FormEvent, ReactNode } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { errorMessage } from '../../../../api/client'
import { entityApi } from '../api/entityApi'
import { formatMoney } from '../../../../lib/format'
import { Button } from '../../../../components/Button'

interface ProcedureRow {
  index: number
  bodyPart: string | null
  code: string | null
  narrative: string | null
  surgeonCategory: string | null
  anaesthetistCategory: string | null
  part: string | null
  partACost: string | null
  pageNo: string | null
}

const emptyProcedure = { bodyPart: '', code: '', narrative: '', surgeonCategory: '', anaesthetistCategory: '', part: '', partACost: '', pageNo: '' }
type ProcedureForm = typeof emptyProcedure

/** Procedures tab (MMAProcedures). Search matches part of the main body part and OPCS code. */
function ProceduresTab() {
  const queryClient = useQueryClient()
  const [form, setForm] = useState<ProcedureForm>(emptyProcedure)
  const [editing, setEditing] = useState<number | null>(null)
  const [filter, setFilter] = useState<{ bodyPart: string; code: string; n: number } | null>(null)
  const [done, setDone] = useState<string | null>(null)

  const search = useQuery({
    queryKey: ['mma-procedures', filter],
    enabled: filter !== null,
    queryFn: async () =>
      entityApi.searchProcedures<{ rows: ProcedureRow[]; truncated: boolean; limit: number }>({
        bodyPart: filter!.bodyPart || undefined,
        code: filter!.code || undefined,
      }),
  })
  const refresh = () => queryClient.invalidateQueries({ queryKey: ['mma-procedures'] })

  const save = useMutation({
    mutationFn: async () => entityApi.saveProcedure(editing, form),
    onSuccess: () => {
      setDone(editing === null ? 'Record Saved...' : 'Record Updated...')
      if (filter === null) setFilter({ bodyPart: form.bodyPart.trim(), code: form.code.trim(), n: 0 })
      clear()
      refresh()
    },
  })
  const remove = useMutation({
    mutationFn: async (index: number) => entityApi.deleteProcedure(index),
    onSuccess: (_, index) => {
      setDone('Record Deleted...')
      if (editing === index) clear()
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
    setForm(emptyProcedure)
    setEditing(null)
  }
  const onSave = (e: FormEvent) => {
    e.preventDefault()
    if (busy) return
    resetFeedback()
    if (window.confirm('Do you want to save the record?')) save.mutate()
  }
  const onEdit = (r: ProcedureRow) => {
    resetFeedback()
    setEditing(r.index)
    setForm({
      bodyPart: r.bodyPart ?? '',
      code: r.code ?? '',
      narrative: r.narrative ?? '',
      surgeonCategory: r.surgeonCategory ?? '',
      anaesthetistCategory: r.anaesthetistCategory ?? '',
      part: r.part ?? '',
      partACost: r.partACost ?? '',
      pageNo: r.pageNo ?? '',
    })
  }
  const field = (name: keyof ProcedureForm, label: string, maxLength: number, extra?: { digits?: boolean; upper?: boolean }) => (
    <label className="form-field">
      <span>{label}</span>
      <input
        value={form[name]}
        maxLength={maxLength}
        inputMode={extra?.digits ? 'numeric' : undefined}
        disabled={busy}
        onChange={(e) => {
          let v = e.target.value
          if (extra?.digits) v = v.replace(/\D/g, '')
          if (extra?.upper) v = v.toUpperCase()
          setForm({ ...form, [name]: v })
        }}
      />
    </label>
  )

  return (
    <section>
      <form className="registration" onSubmit={onSave}>
        <fieldset>
          {field('bodyPart', 'Main Body Part *', 100)}
          {field('code', 'OPCS Code', 10, { upper: true })}
          <label className="form-field wide">
            <span>OPCS Narrative *</span>
            <textarea value={form.narrative} maxLength={400} rows={3} disabled={busy} onChange={(e) => setForm({ ...form, narrative: e.target.value })} />
          </label>
          {field('surgeonCategory', "Surgeon's Category", 30, { upper: true })}
          {field('anaesthetistCategory', "Anaesthetist's Category", 30, { upper: true })}
          <label className="form-field">
            <span>Part</span>
            <select value={form.part} disabled={busy} onChange={(e) => setForm({ ...form, part: e.target.value })}>
              <option value="" />
              {form.part && !['A', 'B', 'C'].includes(form.part) && <option value={form.part}>{form.part}</option>}
              <option value="A">A</option>
              <option value="B">B</option>
              <option value="C">C</option>
            </select>
          </label>
          {field('partACost', 'Part A Cost', 50)}
          {field('pageNo', 'Page No *', 10, { digits: true })}
        </fieldset>
        {save.isError && <p className="error">{errorMessage(save.error)}</p>}
        {remove.isError && <p className="error">{errorMessage(remove.error)}</p>}
        {done && <p className="success">{done}</p>}
        <div className="actions">
          <Button variant="primary" type="submit" disabled={busy}>
            {editing === null ? 'Save' : 'Update'}
          </Button>
          <Button
            variant="ghost"
            disabled={busy || editing !== null}
            onClick={() => {
              resetFeedback()
              setFilter((f) => ({ bodyPart: form.bodyPart.trim(), code: form.code.trim(), n: (f?.n ?? 0) + 1 }))
            }}
          >
            Search
          </Button>
          <Button
            variant="link"
            disabled={busy}
            onClick={() => {
              resetFeedback()
              clear()
            }}
          >
            Clear
          </Button>
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
                    <th>Main Body Part</th>
                    <th className="center">OPCS Code</th>
                    <th>OPCS Narrative</th>
                    <th className="center">Surgeon's Category</th>
                    <th className="center">Anaesthetist's Category</th>
                    <th className="center">Part</th>
                    <th className="num">Part A Cost</th>
                    <th className="num">Page No</th>
                    <th className="action-cell" />
                  </tr>
                </thead>
                <tbody>
                  {search.data.rows.map((r) => (
                    <tr key={r.index} className={editing === r.index ? 'selected' : undefined}>
                      <td>{r.bodyPart}</td>
                      <td className="center">{r.code}</td>
                      <td className="wrap">{r.narrative}</td>
                      <td className="center">{r.surgeonCategory}</td>
                      <td className="center">{r.anaesthetistCategory}</td>
                      <td className="center">{r.part}</td>
                      <td className="num">{r.partACost}</td>
                      <td className="num">{r.pageNo}</td>
                      <td className="action-cell">
                        <Button variant="link" disabled={busy} onClick={() => onEdit(r)}>
                          Edit
                        </Button>
                        <Button
                          variant="link"
                          disabled={busy}
                          onClick={() => window.confirm('Do you want to delete the record?') && (resetFeedback(), remove.mutate(r.index))}
                        >
                          Delete
                        </Button>
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

interface FeeRow {
  index: number
  surgeonCategory: string | null
  surgeonFee: number | null
  anaesthetistCategory: string | null
  anaesthetistFee: number | null
}

const emptyFee = { surgeonCategory: '', surgeonFee: '', anaesthetistCategory: '', anaesthetistFee: '' }
const amount = (v: string) => (v.trim() === '' ? null : Number(v))

/** Look Up Table tab (MMAFees): surgeon and anaesthetist fee per category. Search matches part of either category. */
function LookUpTab() {
  const queryClient = useQueryClient()
  const [form, setForm] = useState(emptyFee)
  const [editing, setEditing] = useState<number | null>(null)
  const [filter, setFilter] = useState<{ surgeonCategory: string; anaesthetistCategory: string; n: number } | null>(null)
  const [done, setDone] = useState<string | null>(null)

  const search = useQuery({
    queryKey: ['mma-fees', filter],
    enabled: filter !== null,
    queryFn: async () =>
      entityApi.searchFees<FeeRow>({
        surgeonCategory: filter!.surgeonCategory || undefined,
        anaesthetistCategory: filter!.anaesthetistCategory || undefined,
      }),
  })
  const refresh = () => queryClient.invalidateQueries({ queryKey: ['mma-fees'] })

  const save = useMutation({
    mutationFn: async () => {
      const body = {
        surgeonCategory: form.surgeonCategory,
        surgeonFee: amount(form.surgeonFee),
        anaesthetistCategory: form.anaesthetistCategory,
        anaesthetistFee: amount(form.anaesthetistFee),
      }
      return entityApi.saveFee(editing, body)
    },
    onSuccess: () => {
      setDone(editing === null ? 'Record Saved...' : 'Record Updated...')
      if (filter === null) setFilter({ surgeonCategory: '', anaesthetistCategory: '', n: 0 })
      clear()
      refresh()
    },
  })
  const remove = useMutation({
    mutationFn: async (index: number) => entityApi.deleteFee(index),
    onSuccess: (_, index) => {
      setDone('Record Deleted...')
      if (editing === index) clear()
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
    setForm(emptyFee)
    setEditing(null)
  }
  const onSave = (e: FormEvent) => {
    e.preventDefault()
    if (busy) return
    resetFeedback()
    if (window.confirm('Do you want to save the record?')) save.mutate()
  }
  const onEdit = (r: FeeRow) => {
    resetFeedback()
    setEditing(r.index)
    setForm({
      surgeonCategory: r.surgeonCategory ?? '',
      surgeonFee: r.surgeonFee?.toString() ?? '',
      anaesthetistCategory: r.anaesthetistCategory ?? '',
      anaesthetistFee: r.anaesthetistFee?.toString() ?? '',
    })
  }

  return (
    <section>
      <form className="registration" onSubmit={onSave}>
        <fieldset>
          <label className="form-field">
            <span>Surgeon's Category</span>
            <input
              value={form.surgeonCategory}
              maxLength={10}
              disabled={busy}
              onChange={(e) => setForm({ ...form, surgeonCategory: e.target.value.toUpperCase() })}
            />
          </label>
          <label className="form-field">
            <span>Surgeon's Fees</span>
            <input
              type="number"
              min={0}
              step="0.01"
              value={form.surgeonFee}
              disabled={busy}
              onChange={(e) => setForm({ ...form, surgeonFee: e.target.value })}
            />
          </label>
          <label className="form-field">
            <span>Anaesthetist's Category</span>
            <input
              value={form.anaesthetistCategory}
              maxLength={50}
              disabled={busy}
              onChange={(e) => setForm({ ...form, anaesthetistCategory: e.target.value.toUpperCase() })}
            />
          </label>
          <label className="form-field">
            <span>Anaesthetists Fees</span>
            <input
              type="number"
              min={0}
              step="0.01"
              value={form.anaesthetistFee}
              disabled={busy}
              onChange={(e) => setForm({ ...form, anaesthetistFee: e.target.value })}
            />
          </label>
        </fieldset>
        {save.isError && <p className="error">{errorMessage(save.error)}</p>}
        {remove.isError && <p className="error">{errorMessage(remove.error)}</p>}
        {done && <p className="success">{done}</p>}
        <div className="actions">
          <Button variant="primary" type="submit" disabled={busy}>
            {editing === null ? 'Save' : 'Update'}
          </Button>
          <Button
            variant="ghost"
            disabled={busy || editing !== null}
            onClick={() => {
              resetFeedback()
              setFilter((f) => ({ surgeonCategory: form.surgeonCategory.trim(), anaesthetistCategory: form.anaesthetistCategory.trim(), n: (f?.n ?? 0) + 1 }))
            }}
          >
            Search
          </Button>
          <Button
            variant="link"
            disabled={busy}
            onClick={() => {
              resetFeedback()
              clear()
            }}
          >
            Clear
          </Button>
        </div>
      </form>

      {search.isError && <p className="error">{errorMessage(search.error)}</p>}
      {search.data && (
        <>
          <p className="muted">Total records: {search.data.length}</p>
          {search.data.length === 0 ? (
            <p className="muted">Record not found</p>
          ) : (
            <div className="table-wrap">
              <table className="grid">
                <thead>
                  <tr>
                    <th className="center">Surgeon's Category</th>
                    <th className="num">Surgeon's Fees</th>
                    <th className="center">Anaesthetist's Category</th>
                    <th className="num">Anaesthetist's Fees</th>
                    <th className="action-cell" />
                  </tr>
                </thead>
                <tbody>
                  {search.data.map((r) => (
                    <tr key={r.index} className={editing === r.index ? 'selected' : undefined}>
                      <td className="center">{r.surgeonCategory}</td>
                      <td className="num">{formatMoney(r.surgeonFee)}</td>
                      <td className="center">{r.anaesthetistCategory}</td>
                      <td className="num">{formatMoney(r.anaesthetistFee)}</td>
                      <td className="action-cell">
                        <Button variant="link" disabled={busy} onClick={() => onEdit(r)}>
                          Edit
                        </Button>
                        <Button
                          variant="link"
                          disabled={busy}
                          onClick={() => window.confirm('Do you want to delete the record?') && (resetFeedback(), remove.mutate(r.index))}
                        >
                          Delete
                        </Button>
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

const tabs: { id: string; label: string; body: () => ReactNode }[] = [
  { id: 'procedures', label: 'Procedures', body: () => <ProceduresTab /> },
  { id: 'look-up', label: 'Look Up Table', body: () => <LookUpTab /> },
]

/** Maintenance > Entity (legacy frmMMA, Malaysian Medical Association schedule). */
export function EntityMaintenanceScreen() {
  const [params, setParams] = useSearchParams()
  const current = tabs.find((t) => t.id === params.get('tab')) ?? tabs[0]

  return (
    <section>
      <h2>Entity Maintenance</h2>
      <p className="muted">Malaysian Medical Association</p>
      <div className="tabs" role="tablist">
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            role="tab"
            aria-selected={t.id === current.id}
            className={t.id === current.id ? 'active' : undefined}
            onClick={() => setParams({ tab: t.id })}
          >
            {t.label}
          </button>
        ))}
      </div>
      <div className="tab-body" key={current.id}>
        {current.body()}
      </div>
    </section>
  )
}
