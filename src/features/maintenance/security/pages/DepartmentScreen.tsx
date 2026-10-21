import { useState } from 'react'
import type { FormEvent } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { errorMessage } from '../../../../api/client'
import { FormField } from '../../../../components/common/FormField'
import { ask, notify } from '../../../../lib/notifyStore'
import { securityApi, securityKeys } from '../api/securityApi'
import type { Department } from '../types'

const CODE_MAX = 3
const DESCRIPTION_MAX = 255

/** Maintenance > Security > Department (legacy frmGroupMaintenance, table GRP). */
export function DepartmentScreen() {
  const client = useQueryClient()
  const list = useQuery({ queryKey: securityKeys.departments, queryFn: securityApi.departments })
  const [selected, setSelected] = useState<Department | null>(null)
  const [editing, setEditing] = useState<'add' | 'edit' | null>(null)
  const [code, setCode] = useState('')
  const [description, setDescription] = useState('')

  const reset = () => {
    setSelected(null)
    setEditing(null)
    setCode('')
    setDescription('')
  }
  const refresh = () => client.invalidateQueries({ queryKey: securityKeys.departments })

  const save = useMutation({
    mutationFn: () =>
      editing === 'add' ? securityApi.createDepartment(code.trim(), description.trim()) : securityApi.updateDepartment(code, description.trim()),
    onSuccess: () => {
      notify(editing === 'add' ? 'Record Saved...' : 'Record Updated...', 'success')
      reset()
      void refresh()
    },
  })
  const remove = useMutation({
    mutationFn: (c: string) => securityApi.deleteDepartment(c),
    onSuccess: () => {
      notify('Record Deleted...', 'success')
      reset()
      void refresh()
    },
  })

  const pick = (d: Department) => {
    setSelected(d)
    setEditing(null)
    setCode(d.code)
    setDescription(d.description ?? '')
    save.reset()
    remove.reset()
  }
  const submit = async (e: FormEvent) => {
    e.preventDefault()
    if (await ask('Do you want to save the record?')) save.mutate()
  }
  const onDelete = async () => {
    if (selected && (await ask('Do you want to delete the record?'))) remove.mutate(selected.code)
  }

  const failure = save.error ?? remove.error
  const locked = editing === null
  return (
    <section>
      <h2>Security Maintenance - Department</h2>
      <form className="registration" onSubmit={submit}>
        <fieldset>
          <legend>Department</legend>
          <FormField label="Department Code">
            <input value={code} maxLength={CODE_MAX} disabled={editing !== 'add'} onChange={(e) => setCode(e.target.value.toUpperCase())} />
          </FormField>
          <FormField label="Description">
            <input value={description} maxLength={DESCRIPTION_MAX} disabled={locked} onChange={(e) => setDescription(e.target.value)} />
          </FormField>
          <div className="actions">
            <button
              type="button"
              onClick={() => {
                reset()
                setEditing('add')
              }}
            >
              Add
            </button>
            <button type="button" disabled={!selected || editing !== null} onClick={() => setEditing('edit')}>
              Edit
            </button>
            <button type="button" className="danger" disabled={!selected || remove.isPending} onClick={() => void onDelete()}>
              Delete
            </button>
            <button type="submit" disabled={locked || save.isPending}>
              Save
            </button>
            <button type="button" disabled={locked} onClick={reset}>
              Cancel
            </button>
          </div>
        </fieldset>
      </form>
      {failure && (
        <p className="error" role="alert">
          {errorMessage(failure)}
        </p>
      )}
      {list.isLoading && <p className="muted">Loading…</p>}
      {list.isError && (
        <p className="error" role="alert">
          {errorMessage(list.error)}
        </p>
      )}
      {list.data && (
        <div className="table-wrap">
          <table className="grid">
            <thead>
              <tr>
                <th>Department Code</th>
                <th>Description</th>
                <th>Users</th>
              </tr>
            </thead>
            <tbody>
              {list.data.map((d) => (
                <tr key={d.code} className={selected?.code === d.code ? 'selected' : undefined} onClick={() => pick(d)}>
                  <td>{d.code}</td>
                  <td>{d.description}</td>
                  <td>{d.users}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  )
}
