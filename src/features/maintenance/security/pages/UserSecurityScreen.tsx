import { useState } from 'react'
import type { FormEvent } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { errorMessage } from '../../../../api/client'
import { CodeSelect } from '../../../../components/common/CodeSelect'
import { FormField } from '../../../../components/common/FormField'
import { ask, notify } from '../../../../lib/notifyStore'
import { securityApi, securityKeys } from '../api/securityApi'
import { AccessMatrixEditor } from '../components/AccessMatrixEditor'
import type { CodeOption } from '../../../../components/common/CodeSelect'
import type { CodeName, PermissionUserRequest, UserDetail } from '../types'
import { Button } from '../../../../components/Button'

const LOOKUPS_STALE_MS = 10 * 60_000
const CODE_MAX = 10
const NAME_MAX = 60
const LG_MAX = 10
const PASSWORD_MAX = 10
const STATUSES: CodeOption[] = [
  { code: 'A', name: 'Active' },
  { code: 'S', name: 'Suspended' },
]
const AUTHORISED: CodeOption[] = [
  { code: 'Y', name: 'Yes' },
  { code: 'N', name: 'No' },
]

const today = () => new Date().toISOString().slice(0, 10)
const blank = (): PermissionUserRequest => ({
  code: '',
  name: '',
  password: '',
  department: '',
  status: 'A',
  dateCreated: today(),
  lgCode: '',
  serviceProvider: '',
  authorisedStatus: 'N',
  granted: [],
})
const fromDetail = (u: UserDetail): PermissionUserRequest => ({
  code: u.code,
  name: u.name ?? '',
  password: '',
  department: u.department ?? '',
  status: u.status ?? '',
  dateCreated: u.dateCreated?.slice(0, 10) ?? '',
  lgCode: u.lgCode ?? '',
  serviceProvider: u.serviceProvider ?? '',
  authorisedStatus: u.authorisedStatus ?? '',
  granted: u.granted,
})
const options = (list: CodeName[] | undefined) => (list ?? []).map((o) => ({ code: o.code, name: o.name ?? o.code }))

interface UserSecurityScreenProps {
  /** Role Management edits code, name, password, department, status and date; User Permission adds LG ID, service provider, authorised status and rights. */
  mode: 'role' | 'permission'
}

/**
 * Maintenance > Security > Role Management (legacy frmUserMaintenance) and User Permission (frmUserPermissionMaintenance).
 * Stored passwords are never shown: a blank password keeps the current one, and a new one must be changed at the next sign-in.
 */
export function UserSecurityScreen({ mode }: UserSecurityScreenProps) {
  const permission = mode === 'permission'
  const client = useQueryClient()
  const [search, setSearch] = useState('')
  const [applied, setApplied] = useState('')
  const [selected, setSelected] = useState<string | null>(null)
  const [editing, setEditing] = useState<'add' | 'edit' | null>(null)
  const [form, setForm] = useState<PermissionUserRequest>(blank)

  const lookups = useQuery({ queryKey: securityKeys.lookups, queryFn: securityApi.lookups, staleTime: LOOKUPS_STALE_MS })
  const users = useQuery({ queryKey: securityKeys.users(applied), queryFn: () => securityApi.users(applied) })
  const detail = useMutation({
    mutationFn: (code: string) => securityApi.user(code),
    onSuccess: (u) => {
      setSelected(u.code)
      setForm(fromDetail(u))
    },
  })

  const reset = () => {
    setSelected(null)
    setEditing(null)
    setForm(blank())
  }
  const refresh = () => client.invalidateQueries({ queryKey: ['security', 'users'] })
  const set = (key: keyof PermissionUserRequest) => (value: string) => setForm((f) => ({ ...f, [key]: value }))

  const save = useMutation({
    mutationFn: () => (permission ? securityApi.savePermission(form, editing === 'add') : securityApi.saveRole(form, editing === 'add')),
    onSuccess: () => {
      notify(editing === 'add' ? 'Record Saved...' : 'Record Updated...', 'success')
      reset()
      void refresh()
    },
  })
  const remove = useMutation({
    mutationFn: (code: string) => securityApi.deleteUser(code),
    onSuccess: () => {
      notify('Record Deleted...', 'success')
      reset()
      void refresh()
    },
  })

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    if (await ask('Do you want to save the record?')) save.mutate()
  }
  const onDelete = async () => {
    if (selected && (await ask(`Do you want to delete the record? User ${selected} will no longer be able to sign in.`))) remove.mutate(selected)
  }

  if (lookups.isLoading) return <p className="muted">Loading…</p>
  if (lookups.isError)
    return (
      <p className="error" role="alert">
        {errorMessage(lookups.error)}
      </p>
    )
  const locked = editing === null
  const failure = save.error ?? remove.error ?? detail.error
  return (
    <section>
      <h2>{permission ? 'Security Maintenance - User Permission' : 'Security Maintenance - User'}</h2>
      <form className="registration" onSubmit={submit}>
        <fieldset>
          <legend>User</legend>
          <FormField label="User ID">
            <input value={form.code} maxLength={CODE_MAX} disabled={editing !== 'add'} onChange={(e) => set('code')(e.target.value.toUpperCase())} />
          </FormField>
          {permission && (
            <FormField label="User LG ID">
              <input value={form.lgCode} maxLength={LG_MAX} disabled={locked} onChange={(e) => set('lgCode')(e.target.value)} />
            </FormField>
          )}
          <FormField label={permission ? 'Staff Name' : 'User Name'}>
            <input value={form.name} maxLength={NAME_MAX} disabled={locked} onChange={(e) => set('name')(e.target.value)} />
          </FormField>
          <FormField label={editing === 'edit' ? 'New Password (blank keeps current)' : 'Password'}>
            <input
              type="password"
              autoComplete="new-password"
              value={form.password}
              maxLength={PASSWORD_MAX}
              disabled={locked}
              onChange={(e) => set('password')(e.target.value)}
            />
          </FormField>
          <FormField label={permission ? 'Department' : 'Group'}>
            <CodeSelect value={form.department} onChange={set('department')} options={options(lookups.data?.departments)} disabled={locked} />
          </FormField>
          {permission && (
            <FormField label="Service Provider">
              <CodeSelect value={form.serviceProvider} onChange={set('serviceProvider')} options={options(lookups.data?.serviceProviders)} disabled={locked} />
            </FormField>
          )}
          <FormField label="Date Created">
            <input type="date" value={form.dateCreated} disabled={locked} onChange={(e) => set('dateCreated')(e.target.value)} />
          </FormField>
          <FormField label="Status">
            <CodeSelect value={form.status} onChange={set('status')} options={STATUSES} disabled={locked} />
          </FormField>
          {permission && (
            <FormField label="Auth. Status">
              <CodeSelect value={form.authorisedStatus} onChange={set('authorisedStatus')} options={AUTHORISED} disabled={locked} />
            </FormField>
          )}
          <div className="actions">
            <Button
              variant="ghost"
              onClick={() => {
                reset()
                setEditing('add')
              }}
            >
              Add
            </Button>
            <Button variant="ghost" disabled={!selected || editing !== null} onClick={() => setEditing('edit')}>
              Edit
            </Button>
            <Button variant="danger" disabled={!selected || remove.isPending} onClick={() => void onDelete()}>
              Delete
            </Button>
            <Button variant="primary" type="submit" disabled={locked || save.isPending}>
              Save
            </Button>
            <Button variant="link" disabled={locked} onClick={reset}>
              Cancel
            </Button>
          </div>
        </fieldset>
      </form>
      {failure && (
        <p className="error" role="alert">
          {errorMessage(failure)}
        </p>
      )}
      {permission && lookups.data && (
        <AccessMatrixEditor matrix={lookups.data.matrix} granted={form.granted} disabled={locked} onChange={(granted) => setForm((f) => ({ ...f, granted }))} />
      )}
      <form
        className="actions"
        onSubmit={(e) => {
          e.preventDefault()
          setApplied(search)
        }}
      >
        <input placeholder="User ID contains" aria-label="Search user ID" value={search} onChange={(e) => setSearch(e.target.value)} />
        <Button variant="primary" type="submit">
          Search
        </Button>
      </form>
      {users.isLoading && <p className="muted">Loading…</p>}
      {users.isError && (
        <p className="error" role="alert">
          {errorMessage(users.error)}
        </p>
      )}
      {users.data && (
        <div className="table-wrap">
          <table className="grid">
            <thead>
              <tr>
                <th>User ID</th>
                <th>{permission ? 'Staff Name' : 'User Name'}</th>
                {permission && <th>User LG ID</th>}
                <th>Department</th>
                {permission && <th>Service Provider</th>}
                <th>Status</th>
                {permission && <th>Auth. Status</th>}
              </tr>
            </thead>
            <tbody>
              {users.data.map((u) => (
                <tr
                  key={u.code}
                  className={selected === u.code ? 'selected' : undefined}
                  onClick={() => {
                    if (editing === null) detail.mutate(u.code)
                  }}
                >
                  <td>{u.code}</td>
                  <td>{u.name}</td>
                  {permission && <td>{u.lgCode}</td>}
                  <td>{u.department}</td>
                  {permission && <td>{u.serviceProvider}</td>}
                  <td>{u.status}</td>
                  {permission && <td>{u.authorisedStatus}</td>}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  )
}
