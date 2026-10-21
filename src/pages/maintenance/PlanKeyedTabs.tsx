import { useState } from 'react'
import type { FormEvent } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api, errorMessage } from '../../api/client'
import { Button } from '../../components/Button'


interface CodeRow {
  code: string
  description: string | null
}

interface Key {
  planCode: string
  healthCode: string
  insuredCode: string
}

const emptyKey: Key = { planCode: '', healthCode: '', insuredCode: '' }
const money = (v: number | null) => (v == null ? '' : v.toLocaleString(undefined, { minimumFractionDigits: 2 }))
const amount = (v: string) => (v.trim() === '' ? null : Number(v))
const keyParams = (k: Key) => ({
  planCode: k.planCode.trim() || undefined,
  healthCode: k.healthCode || undefined,
  insuredCode: k.insuredCode || undefined,
})

function useCodes(list: string) {
  return useQuery({
    queryKey: ['code-list', list, 'options'],
    queryFn: async () => (await api.get<CodeRow[]>(`/api/maintenance/code-lists/${list}`)).data,
  })
}

/** Plan code, health type and insured type: the key both tabs share. */
function KeyFields({ value, onChange, disabled }: { value: Key; onChange: (k: Key) => void; disabled: boolean }) {
  const health = useCodes('health-types')
  const insured = useCodes('insured-types')
  const select = (field: 'healthCode' | 'insuredCode', label: string, options: CodeRow[] | undefined) => (
    <label className="form-field">
      <span>{label} *</span>
      <select value={value[field]} disabled={disabled} onChange={(e) => onChange({ ...value, [field]: e.target.value })}>
        <option value="" />
        {options?.map((o) => (
          <option key={o.code} value={o.code}>
            {o.code} - {o.description}
          </option>
        ))}
      </select>
    </label>
  )
  return (
    <>
      <label className="form-field">
        <span>Plan Code *</span>
        <input
          value={value.planCode}
          maxLength={4}
          disabled={disabled}
          onChange={(e) => onChange({ ...value, planCode: e.target.value.toUpperCase() })}
        />
      </label>
      {select('healthCode', 'Health Type', health.data)}
      {select('insuredCode', 'Insured Type', insured.data)}
    </>
  )
}

interface BenefitLimitRow extends Key {
  index: number
  effectiveDate: string | null
  suppStatus: string | null
  kidneyDialysisLimit: number | null
  cancerLimit: number | null
  homeNursingLimit: number | null
}

const emptyBenefit = { suppStatus: '', effectiveDate: '', kidneyDialysisLimit: '', cancerLimit: '', homeNursingLimit: '' }

/** Annual Limit (Benefit) tab: kidney dialysis, cancer and home nursing limits per plan / health / insured. */
export function BenefitLimitTab() {
  const queryClient = useQueryClient()
  const [key, setKey] = useState<Key>(emptyKey)
  const [form, setForm] = useState(emptyBenefit)
  const [editing, setEditing] = useState<number | null>(null)
  const [filter, setFilter] = useState<{ key: Key; n: number } | null>(null)
  const [done, setDone] = useState<string | null>(null)
  const url = '/api/maintenance/benefit-limits'

  const search = useQuery({
    queryKey: ['benefit-limits', filter],
    enabled: filter !== null,
    queryFn: async () => (await api.get<BenefitLimitRow[]>(url, { params: keyParams(filter!.key) })).data,
  })
  const refresh = () => queryClient.invalidateQueries({ queryKey: ['benefit-limits'] })

  const save = useMutation({
    mutationFn: async () => {
      const body = {
        ...key,
        suppStatus: form.suppStatus || null,
        effectiveDate: form.effectiveDate || null,
        kidneyDialysisLimit: amount(form.kidneyDialysisLimit),
        cancerLimit: amount(form.cancerLimit),
        homeNursingLimit: amount(form.homeNursingLimit),
      }
      return editing === null ? api.post(url, body) : api.put(`${url}/${editing}`, body)
    },
    onSuccess: () => {
      setDone(editing === null ? 'Record Saved...' : 'Record Updated...')
      if (filter === null) setFilter({ key, n: 0 })
      clear()
      refresh()
    },
  })
  const remove = useMutation({
    mutationFn: async (index: number) => api.delete(`${url}/${index}`),
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
    setKey(emptyKey)
    setForm(emptyBenefit)
    setEditing(null)
  }
  const onSave = (e: FormEvent) => {
    e.preventDefault()
    if (busy) return
    resetFeedback()
    if (window.confirm('Do you want to save the record?')) save.mutate()
  }
  const onEdit = (r: BenefitLimitRow) => {
    resetFeedback()
    setEditing(r.index)
    setKey({ planCode: r.planCode, healthCode: r.healthCode, insuredCode: r.insuredCode })
    setForm({
      suppStatus: r.suppStatus ?? '',
      effectiveDate: r.effectiveDate?.slice(0, 10) ?? '',
      kidneyDialysisLimit: r.kidneyDialysisLimit?.toString() ?? '',
      cancerLimit: r.cancerLimit?.toString() ?? '',
      homeNursingLimit: r.homeNursingLimit?.toString() ?? '',
    })
  }
  const num = (field: 'kidneyDialysisLimit' | 'cancerLimit' | 'homeNursingLimit', label: string) => (
    <label className="form-field">
      <span>{label}</span>
      <input type="number" min={0} step="0.01" value={form[field]} disabled={busy}
        onChange={(e) => setForm({ ...form, [field]: e.target.value })} />
    </label>
  )

  return (
    <section>
      <form className="registration" onSubmit={onSave}>
        <fieldset>
          <KeyFields value={key} onChange={setKey} disabled={busy} />
          <label className="form-field">
            <span>Supp. Status</span>
            <select value={form.suppStatus} disabled={busy} onChange={(e) => setForm({ ...form, suppStatus: e.target.value })}>
              <option value="" />
              <option value="A">A</option>
              <option value="B">B</option>
              <option value="C">C</option>
            </select>
          </label>
          <label className="form-field">
            <span>Effective Date *</span>
            <input type="date" value={form.effectiveDate} disabled={busy}
              onChange={(e) => setForm({ ...form, effectiveDate: e.target.value })} />
          </label>
          {num('kidneyDialysisLimit', 'Kidney Dialysis Limit')}
          {num('cancerLimit', 'Cancer Limit')}
          {num('homeNursingLimit', 'Home Nursing Limit')}
        </fieldset>
        {save.isError && <p className="error">{errorMessage(save.error)}</p>}
        {remove.isError && <p className="error">{errorMessage(remove.error)}</p>}
        {done && <p className="success">{done}</p>}
        <div className="actions">
          <Button variant="primary" type="submit" disabled={busy}>{editing === null ? 'Save' : 'Update'}</Button>
          <Button variant="ghost" disabled={busy || editing !== null}
            onClick={() => { resetFeedback(); setFilter((f) => ({ key, n: (f?.n ?? 0) + 1 })) }}>
            Search
          </Button>
          <Button variant="link" disabled={busy} onClick={() => { resetFeedback(); clear() }}>Clear</Button>
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
                    <th className="center">Plan</th>
                    <th className="center">Health</th>
                    <th className="center">Insured</th>
                    <th className="center">Supp. Status</th>
                    <th>Effective</th>
                    <th className="num">Kidney Dialysis</th>
                    <th className="num">Cancer</th>
                    <th className="num">Home Nursing</th>
                    <th className="action-cell" />
                  </tr>
                </thead>
                <tbody>
                  {search.data.map((r) => (
                    <tr key={r.index} className={editing === r.index ? 'selected' : undefined}>
                      <td className="center">{r.planCode}</td>
                      <td className="center">{r.healthCode}</td>
                      <td className="center">{r.insuredCode}</td>
                      <td className="center">{r.suppStatus}</td>
                      <td>{r.effectiveDate?.slice(0, 10)}</td>
                      <td className="num">{money(r.kidneyDialysisLimit)}</td>
                      <td className="num">{money(r.cancerLimit)}</td>
                      <td className="num">{money(r.homeNursingLimit)}</td>
                      <td className="action-cell">
                        <Button variant="link" disabled={busy} onClick={() => onEdit(r)}>Edit</Button>
                        <Button variant="link" disabled={busy}
                          onClick={() => window.confirm('Do you want to delete this record?') && (resetFeedback(), remove.mutate(r.index))}>
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

interface MgmtFeeRow extends Key {
  fee: number | null
}

const rowKey = (k: Key) => `${k.planCode}/${k.healthCode}/${k.insuredCode}`

/** Case Mgmt. Fee tab: one fee per plan / health / insured. Editing changes only the fee. */
export function MgmtFeeTab() {
  const queryClient = useQueryClient()
  const [key, setKey] = useState<Key>(emptyKey)
  const [fee, setFee] = useState('')
  const [editing, setEditing] = useState<string | null>(null)
  const [filter, setFilter] = useState<{ key: Key; n: number } | null>(null)
  const [done, setDone] = useState<string | null>(null)
  const url = '/api/maintenance/mgmt-fees'
  const path = (k: Key) => `${url}/${[k.planCode, k.healthCode, k.insuredCode].map(encodeURIComponent).join('/')}`

  const search = useQuery({
    queryKey: ['mgmt-fees', filter],
    enabled: filter !== null,
    queryFn: async () => (await api.get<MgmtFeeRow[]>(url, { params: keyParams(filter!.key) })).data,
  })
  const refresh = () => queryClient.invalidateQueries({ queryKey: ['mgmt-fees'] })

  const save = useMutation({
    mutationFn: async () => {
      const body = { ...key, fee: amount(fee) }
      return editing === null ? api.post(url, body) : api.put(path(key), body)
    },
    onSuccess: () => {
      setDone(editing === null ? 'Record Saved...' : 'Record Updated...')
      if (filter === null) setFilter({ key, n: 0 })
      clear()
      refresh()
    },
  })
  const remove = useMutation({
    mutationFn: async (k: Key) => api.delete(path(k)),
    onSuccess: (_, k) => {
      setDone('Record Deleted...')
      if (editing === rowKey(k)) clear()
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
    setKey(emptyKey)
    setFee('')
    setEditing(null)
  }
  const onSave = (e: FormEvent) => {
    e.preventDefault()
    if (busy) return
    resetFeedback()
    if (window.confirm('Do you want to save the record?')) save.mutate()
  }
  const onEdit = (r: MgmtFeeRow) => {
    resetFeedback()
    setEditing(rowKey(r))
    setKey({ planCode: r.planCode, healthCode: r.healthCode, insuredCode: r.insuredCode })
    setFee(r.fee?.toString() ?? '')
  }

  return (
    <section>
      <form className="registration" onSubmit={onSave}>
        <fieldset>
          <KeyFields value={key} onChange={setKey} disabled={busy || editing !== null} />
          <label className="form-field">
            <span>Mgmt. Fee *</span>
            <input type="number" min={0} step="0.01" value={fee} disabled={busy} onChange={(e) => setFee(e.target.value)} />
          </label>
        </fieldset>
        {save.isError && <p className="error">{errorMessage(save.error)}</p>}
        {remove.isError && <p className="error">{errorMessage(remove.error)}</p>}
        {done && <p className="success">{done}</p>}
        <div className="actions">
          <Button variant="primary" type="submit" disabled={busy}>{editing === null ? 'Save' : 'Update'}</Button>
          <Button variant="ghost" disabled={busy || editing !== null}
            onClick={() => { resetFeedback(); setFilter((f) => ({ key, n: (f?.n ?? 0) + 1 })) }}>
            Search
          </Button>
          <Button variant="link" disabled={busy} onClick={() => { resetFeedback(); clear() }}>Clear</Button>
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
                    <th className="center">Plan</th>
                    <th className="center">Health</th>
                    <th className="center">Insured</th>
                    <th className="num">Mgmt. Fee</th>
                    <th className="action-cell" />
                  </tr>
                </thead>
                <tbody>
                  {search.data.map((r) => (
                    <tr key={rowKey(r)} className={editing === rowKey(r) ? 'selected' : undefined}>
                      <td className="center">{r.planCode}</td>
                      <td className="center">{r.healthCode}</td>
                      <td className="center">{r.insuredCode}</td>
                      <td className="num">{money(r.fee)}</td>
                      <td className="action-cell">
                        <Button variant="link" disabled={busy} onClick={() => onEdit(r)}>Edit</Button>
                        <Button variant="link" disabled={busy}
                          onClick={() => window.confirm('Do you want to delete this record?') && (resetFeedback(), remove.mutate(r))}>
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
