import { useState } from 'react'
import type { FormEvent } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { errorMessage } from '../../../../api/client'
import { benefitsApi } from '../api/benefitsApi'
import { lookupsKey, optionLabel, useBenefitLookups } from '../benefitLookups'
import { Button } from '../../../../components/Button'

interface CategoryRow {
  code: string
  description: string | null
}

/** Category tab: benefit categories (dbo.BNFCategory). Search matches the code prefix and part of the description. */
export function BenefitCategoryTab() {
  const queryClient = useQueryClient()
  const [code, setCode] = useState('')
  const [description, setDescription] = useState('')
  const [editing, setEditing] = useState<string | null>(null)
  const [filter, setFilter] = useState<{ code: string; description: string; n: number } | null>(null)
  const [done, setDone] = useState<string | null>(null)

  const search = useQuery({
    queryKey: ['benefit-categories', filter],
    enabled: filter !== null,
    queryFn: async () => benefitsApi.searchCategories<CategoryRow>({ code: filter!.code || undefined, description: filter!.description || undefined }),
  })
  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ['benefit-categories'] })
    queryClient.invalidateQueries({ queryKey: lookupsKey })
  }

  const save = useMutation({
    mutationFn: async () => {
      const body = { code, description }
      return benefitsApi.saveCategory(editing, body)
    },
    onSuccess: () => {
      setDone(editing === null ? 'Record Saved...' : 'Record Updated...')
      clear()
      if (filter === null) setFilter({ code: '', description: '', n: 0 })
      refresh()
    },
  })
  const remove = useMutation({
    mutationFn: async (c: string) => benefitsApi.deleteCategory(c),
    onSuccess: (_, c) => {
      setDone('Record Deleted...')
      if (editing === c) clear()
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
    setCode('')
    setDescription('')
    setEditing(null)
  }
  const onSave = (e: FormEvent) => {
    e.preventDefault()
    if (busy) return
    resetFeedback()
    if (window.confirm('Do you want to save this record?')) save.mutate()
  }
  const onEdit = (r: CategoryRow) => {
    resetFeedback()
    setEditing(r.code)
    setCode(r.code)
    setDescription(r.description ?? '')
  }

  return (
    <section>
      <form className="registration" onSubmit={onSave}>
        <fieldset>
          <label className="form-field">
            <span>Category Code *</span>
            <input value={code} maxLength={10} disabled={editing !== null || busy} onChange={(e) => setCode(e.target.value.toUpperCase())} />
          </label>
          <label className="form-field wide">
            <span>Description *</span>
            <textarea value={description} maxLength={255} rows={3} disabled={busy} onChange={(e) => setDescription(e.target.value)} />
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
              setFilter((f) => ({ code: code.trim(), description: description.trim(), n: (f?.n ?? 0) + 1 }))
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
            <p className="muted">Record not found!</p>
          ) : (
            <div className="table-wrap">
              <table className="grid">
                <thead>
                  <tr>
                    <th className="center">Category Code</th>
                    <th>Category Description</th>
                    <th className="action-cell" />
                  </tr>
                </thead>
                <tbody>
                  {search.data.map((r) => (
                    <tr key={r.code} className={editing === r.code ? 'selected' : undefined}>
                      <td className="center">{r.code}</td>
                      <td className="wrap">{r.description}</td>
                      <td className="action-cell">
                        <Button variant="link" disabled={busy} onClick={() => onEdit(r)}>
                          Edit
                        </Button>
                        <Button
                          variant="link"
                          disabled={busy}
                          onClick={() => window.confirm('Do you want to delete this record?') && (resetFeedback(), remove.mutate(r.code))}
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

interface SubCategoryRow {
  categoryCode: string | null
  categoryDescription: string | null
  code: string
  name: string | null
}

const emptySub = { categoryCode: '', code: '', name: '' }

/** Sub Category tab: benefit sub categories (dbo.BNFSubCat). 602 Govt. Service Tax is hidden, as in the desktop. */
export function BenefitSubCategoryTab() {
  const queryClient = useQueryClient()
  const lookups = useBenefitLookups()
  const [form, setForm] = useState(emptySub)
  const [editing, setEditing] = useState<string | null>(null)
  const [filter, setFilter] = useState<{ form: typeof emptySub; n: number } | null>(null)
  const [done, setDone] = useState<string | null>(null)

  const search = useQuery({
    queryKey: ['benefit-sub-categories', filter],
    enabled: filter !== null,
    queryFn: async () =>
      benefitsApi.searchSubCategories<SubCategoryRow>({
        categoryCode: filter!.form.categoryCode || undefined,
        code: filter!.form.code.trim() || undefined,
        name: filter!.form.name.trim() || undefined,
      }),
  })
  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ['benefit-sub-categories'] })
    queryClient.invalidateQueries({ queryKey: lookupsKey })
  }

  const save = useMutation({
    mutationFn: async () => benefitsApi.saveSubCategory(editing, form),
    onSuccess: () => {
      setDone(editing === null ? 'Record Saved...' : 'Record Updated...')
      if (filter === null) setFilter({ form: { ...emptySub, categoryCode: form.categoryCode }, n: 0 })
      clear()
      refresh()
    },
  })
  const remove = useMutation({
    mutationFn: async (c: string) => benefitsApi.deleteSubCategory(c),
    onSuccess: (_, c) => {
      setDone('Record Deleted...')
      if (editing === c) clear()
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
    setForm(emptySub)
    setEditing(null)
  }
  const onSave = (e: FormEvent) => {
    e.preventDefault()
    if (busy) return
    resetFeedback()
    if (window.confirm('Do you want to save this record?')) save.mutate()
  }
  const onEdit = (r: SubCategoryRow) => {
    resetFeedback()
    setEditing(r.code)
    setForm({ categoryCode: r.categoryCode ?? '', code: r.code, name: r.name ?? '' })
  }

  return (
    <section>
      <form className="registration" onSubmit={onSave}>
        <fieldset>
          <label className="form-field">
            <span>Cat Code *</span>
            <select value={form.categoryCode} disabled={busy} onChange={(e) => setForm({ ...form, categoryCode: e.target.value })}>
              <option value="" />
              {form.categoryCode && !lookups.data?.categories.some((c) => c.code === form.categoryCode) && (
                <option value={form.categoryCode}>{form.categoryCode} (not found)</option>
              )}
              {lookups.data?.categories.map((c) => (
                <option key={c.code} value={c.code}>
                  {optionLabel(c)}
                </option>
              ))}
            </select>
          </label>
          <label className="form-field">
            <span>Sub Cat Code *</span>
            <input
              value={form.code}
              maxLength={10}
              disabled={editing !== null || busy}
              onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })}
            />
          </label>
          <label className="form-field wide">
            <span>Description *</span>
            <textarea value={form.name} maxLength={100} rows={2} disabled={busy} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          </label>
        </fieldset>
        {lookups.isError && <p className="error">{errorMessage(lookups.error)}</p>}
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
              setFilter((f) => ({ form, n: (f?.n ?? 0) + 1 }))
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
                    <th className="center">Cat Code</th>
                    <th>Category Desc</th>
                    <th className="center">Sub Cat Code</th>
                    <th>Description</th>
                    <th className="action-cell" />
                  </tr>
                </thead>
                <tbody>
                  {search.data.map((r) => (
                    <tr key={r.code} className={editing === r.code ? 'selected' : undefined}>
                      <td className="center">{r.categoryCode}</td>
                      <td>{r.categoryDescription ?? <span className="muted">(category not found)</span>}</td>
                      <td className="center">{r.code}</td>
                      <td className="wrap">{r.name}</td>
                      <td className="action-cell">
                        <Button variant="link" disabled={busy} onClick={() => onEdit(r)}>
                          Edit
                        </Button>
                        <Button
                          variant="link"
                          disabled={busy}
                          onClick={() => window.confirm('Do you want to delete this record?') && (resetFeedback(), remove.mutate(r.code))}
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
