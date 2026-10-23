import { useState } from 'react'
import type { FormEvent } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api, errorMessage } from '../../api/client'
import { Button } from '../../components/Button'


interface CodeRow {
  code: string
  description: string | null
}

export interface CodeListProps {
  list: string
  codeLabel: string
  descriptionLabel: string
  codeLength: number
  descriptionLength: number
}

/** A Plan Maintenance tab that keeps a code and a description (Health Type, Insured Type, Product Category, Supp. MCO Status). */
export function CodeListTab({ list, codeLabel, descriptionLabel, codeLength, descriptionLength }: CodeListProps) {
  const queryClient = useQueryClient()
  const [code, setCode] = useState('')
  const [description, setDescription] = useState('')
  const [editing, setEditing] = useState<string | null>(null)
  const [filter, setFilter] = useState<{ code: string; n: number } | null>(null)
  const [done, setDone] = useState<string | null>(null)
  const url = `/api/maintenance/code-lists/${list}`

  const search = useQuery({
    queryKey: ['code-list', list, filter],
    enabled: filter !== null,
    queryFn: async () => (await api.get<CodeRow[]>(url, { params: { code: filter?.code || undefined } })).data,
  })
  const refresh = () => queryClient.invalidateQueries({ queryKey: ['code-list', list] })

  const save = useMutation({
    mutationFn: async () => {
      const body = { code, description }
      return editing === null ? api.post(url, body) : api.put(`${url}/${encodeURIComponent(editing)}`, body)
    },
    onSuccess: () => {
      setDone(editing === null ? 'Record Saved...' : 'Record Updated...')
      setCode('')
      setDescription('')
      setEditing(null)
      if (filter === null) setFilter({ code: '', n: 0 })
      refresh()
    },
  })
  const remove = useMutation({
    mutationFn: async (c: string) => api.delete(`${url}/${encodeURIComponent(c)}`),
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
    if (window.confirm('Do you want to save the record?')) save.mutate()
  }
  const onEdit = (r: CodeRow) => {
    resetFeedback()
    setEditing(r.code)
    setCode(r.code)
    setDescription(r.description ?? '')
  }
  const onSearch = () => {
    resetFeedback()
    setFilter((f) => ({ code: code.trim(), n: (f?.n ?? 0) + 1 }))
  }

  return (
    <section>
      <form className="registration" onSubmit={onSave}>
        <fieldset>
          <label className="form-field">
            <span>{codeLabel} *</span>
            <input
              value={code}
              maxLength={codeLength}
              disabled={editing !== null || busy}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
            />
          </label>
          <label className="form-field wide">
            <span>{descriptionLabel} *</span>
            <textarea
              value={description}
              maxLength={descriptionLength}
              rows={3}
              disabled={busy}
              onChange={(e) => setDescription(e.target.value)}
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
          <Button variant="ghost" disabled={busy || editing !== null} onClick={onSearch}>
            Search
          </Button>
          <Button variant="link" disabled={busy} onClick={() => { resetFeedback(); clear() }}>
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
                    <th className="center">{codeLabel}</th>
                    <th>{descriptionLabel}</th>
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
                        <Button variant="link"
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
