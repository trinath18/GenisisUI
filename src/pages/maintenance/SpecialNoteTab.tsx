import { useState } from 'react'
import type { FormEvent } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api, errorMessage } from '../../api/client'
import { Button } from '../../components/Button'


interface NoteRow {
  index: number
  planCode: string
  description: string | null
  groupCompany: string | null
  note: string | null
}
interface SearchResult {
  rows: NoteRow[]
  truncated: boolean
  limit: number
}

/** Special Note tab: the note is kept on the plan row. Delete clears the note; the plan stays. */
export function SpecialNoteTab() {
  const queryClient = useQueryClient()
  const [planCode, setPlanCode] = useState('')
  const [groupCompany, setGroupCompany] = useState('')
  const [note, setNote] = useState('')
  const [editing, setEditing] = useState<NoteRow | null>(null)
  const [filter, setFilter] = useState<{ planCode: string; groupCompany: string; n: number } | null>(null)
  const [done, setDone] = useState<string | null>(null)

  const search = useQuery({
    queryKey: ['special-notes', filter],
    enabled: filter !== null,
    queryFn: async () =>
      (
        await api.get<SearchResult>('/api/maintenance/special-notes', {
          params: { planCode: filter?.planCode || undefined, groupCompany: filter?.groupCompany || undefined },
        })
      ).data,
  })
  const refresh = () => queryClient.invalidateQueries({ queryKey: ['special-notes'] })

  const save = useMutation({
    mutationFn: async () => api.put(`/api/maintenance/special-notes/${editing!.index}`, { note }),
    onSuccess: () => {
      setDone(note.trim() ? 'Record Updated...' : 'Note cleared...')
      clear()
      refresh()
    },
  })
  const remove = useMutation({
    mutationFn: async (r: NoteRow) => api.delete(`/api/maintenance/special-notes/${r.index}`),
    onSuccess: (_, r) => {
      setDone('Note cleared...')
      if (editing?.index === r.index) clear()
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
    setEditing(null)
    setNote('')
  }
  const onSave = (e: FormEvent) => {
    e.preventDefault()
    if (busy || !editing) return
    resetFeedback()
    if (window.confirm(`Do you want to save the special note for plan ${editing.planCode}?`)) save.mutate()
  }
  const onSearch = () => {
    resetFeedback()
    setFilter((f) => ({ planCode: planCode.trim(), groupCompany: groupCompany.trim(), n: (f?.n ?? 0) + 1 }))
  }

  return (
    <section>
      <form className="registration" onSubmit={onSave}>
        <fieldset>
          <label className="form-field">
            <span>Plan Code</span>
            <input value={planCode} maxLength={4} disabled={busy} onChange={(e) => setPlanCode(e.target.value.toUpperCase())} />
          </label>
          <label className="form-field">
            <span>Group Company</span>
            <input value={groupCompany} maxLength={200} disabled={busy} onChange={(e) => setGroupCompany(e.target.value)} />
          </label>
          {editing && (
            <label className="form-field wide">
              <span>
                Special Note for plan {editing.planCode}
                {editing.groupCompany ? ` (${editing.groupCompany})` : ''}
              </span>
              <textarea value={note} rows={5} disabled={busy} onChange={(e) => setNote(e.target.value)} />
            </label>
          )}
        </fieldset>
        {!editing && <p className="muted">Search for a plan, then click Edit to add or change its special note.</p>}
        {save.isError && <p className="error">{errorMessage(save.error)}</p>}
        {remove.isError && <p className="error">{errorMessage(remove.error)}</p>}
        {done && <p className="success">{done}</p>}
        <div className="actions">
          <Button variant="primary" type="submit" disabled={busy || !editing}>
            Update
          </Button>
          <Button variant="ghost" disabled={busy} onClick={onSearch}>
            Search
          </Button>
          <Button variant="link" disabled={busy} onClick={() => { resetFeedback(); clear(); setPlanCode(''); setGroupCompany('') }}>
            Clear
          </Button>
        </div>
      </form>

      {search.isError && <p className="error">{errorMessage(search.error)}</p>}
      {search.data && (
        <>
          <p className="muted">
            Total records: {search.data.rows.length}
            {search.data.truncated && ` (first ${search.data.limit} shown; narrow the search)`}
          </p>
          {search.data.rows.length === 0 ? (
            <p className="muted">Record not found</p>
          ) : (
            <div className="table-wrap">
              <table className="grid">
                <thead>
                  <tr>
                    <th className="center">Plan Code</th>
                    <th>Description</th>
                    <th>Group Company</th>
                    <th>Special Note</th>
                    <th className="action-cell" />
                  </tr>
                </thead>
                <tbody>
                  {search.data.rows.map((r) => (
                    <tr key={r.index} className={editing?.index === r.index ? 'selected' : undefined}>
                      <td className="center">{r.planCode}</td>
                      <td className="wrap">{r.description}</td>
                      <td className="wrap">{r.groupCompany}</td>
                      <td className="wrap">{r.note}</td>
                      <td className="action-cell">
                        <Button variant="link"
                          disabled={busy}
                          onClick={() => { resetFeedback(); setEditing(r); setNote(r.note ?? '') }}
                        >
                          Edit
                        </Button>
                        <Button variant="link"
                          disabled={busy || !r.note}
                          onClick={() => window.confirm(`Do you want to clear the special note of plan ${r.planCode}?`) && (resetFeedback(), remove.mutate(r))}
                        >
                          Clear note
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
