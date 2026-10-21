import { useState } from 'react'
import { useMutation, useQuery } from '@tanstack/react-query'
import { errorMessage } from '../../../../api/client'
import { CodeSelect } from '../../../../components/common/CodeSelect'
import { FormField } from '../../../../components/common/FormField'
import { formatDate } from '../../../../lib/format'
import { ask, notify } from '../../../../lib/notifyStore'
import { deletionApi, deletionKeys } from '../api/deletionApi'
import { DELETE_OPTION, DELETE_OPTIONS, LIST_LIMIT, LOOKUPS_STALE_MS, confirmDeleteMessage } from '../constants'
import type { DeletionCriteria, DeletionListResult, DeletionOption } from '../types'
import { Button } from '../../../../components/Button'

const EMPTY_FORM = { healthCode: '', payorCode: '', option: '', bordxDateFrom: '', bordxDateTo: '', receiptDate: '', batchNo: '', numberFrom: '', numberTo: '' }
type Form = typeof EMPTY_FORM

const orNull = (value: string) => (value.trim() === '' ? null : value.trim())
const options = (list: DeletionOption[] | undefined) => (list ?? []).map((o) => ({ code: o.code, name: o.name ?? o.code }))

function criteria(form: Form): DeletionCriteria {
  return {
    healthCode: form.healthCode,
    payorCode: form.payorCode,
    option: form.option,
    bordxDateFrom: orNull(form.bordxDateFrom),
    bordxDateTo: orNull(form.bordxDateTo),
    receiptDate: orNull(form.receiptDate),
    batchNo: form.batchNo === '' ? null : Number(form.batchNo),
    numberFrom: orNull(form.numberFrom),
    numberTo: orNull(form.numberTo),
  }
}

/** Membership &gt; Deletion (legacy frmDeleteMembers). */
export function DeletionPage() {
  const [form, setForm] = useState(EMPTY_FORM)
  /** The listing and the exact criteria it was made with; Delete is only offered for those criteria. */
  const [listed, setListed] = useState<{ form: Form; result: DeletionListResult } | null>(null)
  const lookups = useQuery({ queryKey: deletionKeys.lookups, queryFn: deletionApi.getLookups, staleTime: LOOKUPS_STALE_MS })

  const set = (field: keyof Form) => (value: string) => setForm((f) => ({ ...f, [field]: value }))
  const list = useMutation({
    mutationFn: (current: Form) => deletionApi.list(criteria(current)),
    onSuccess: (result, current) => {
      setListed({ form: current, result })
      notify(result.message, result.memberships === 0 ? 'info' : 'success')
    },
  })
  const remove = useMutation({
    mutationFn: (current: Form) => deletionApi.delete(criteria(current)),
    onSuccess: (result) => {
      setListed(null)
      notify(
        `${result.message} Principal ${result.totalPrincipal}, Supplementary ${result.totalSupplementary}, Total ${result.totalPrincipal + result.totalSupplementary}`,
        'success',
      )
    },
  })

  const sameCriteria = listed !== null && JSON.stringify(listed.form) === JSON.stringify(form)
  const canDelete = sameCriteria && listed.result.memberships > 0 && !remove.isPending

  async function confirmDelete() {
    if (!listed) return
    const { memberships, totalPrincipal, totalSupplementary } = listed.result
    if (await ask(confirmDeleteMessage(memberships, totalPrincipal, totalSupplementary))) remove.mutate(form)
  }

  if (lookups.isLoading) return <p className="muted">Loading…</p>
  if (lookups.isError)
    return (
      <p className="error" role="alert">
        {errorMessage(lookups.error)}
      </p>
    )
  const result = listed?.result
  return (
    <section>
      <h2>Membership Deletion</h2>
      <div className="registration">
        <fieldset>
          <legend>Selection</legend>
          <FormField label="Health Type *">
            <CodeSelect value={form.healthCode} onChange={set('healthCode')} options={options(lookups.data?.healthCodes)} />
          </FormField>
          <FormField label="Payor *">
            <CodeSelect value={form.payorCode} onChange={set('payorCode')} options={options(lookups.data?.payors)} />
          </FormField>
          <FormField label="Delete Option *">
            <select value={form.option} onChange={(e) => set('option')(e.target.value)}>
              <option value="">(choose)</option>
              {DELETE_OPTIONS.map((o) => (
                <option key={o.code} value={o.code}>
                  {o.name}
                </option>
              ))}
            </select>
          </FormField>
          {form.option === DELETE_OPTION.bordxDate && (
            <>
              <FormField label="Bordx Date From *">
                <input type="date" value={form.bordxDateFrom} onChange={(e) => set('bordxDateFrom')(e.target.value)} />
              </FormField>
              <FormField label="Bordx Date To *">
                <input type="date" value={form.bordxDateTo} onChange={(e) => set('bordxDateTo')(e.target.value)} />
              </FormField>
            </>
          )}
          {form.option === DELETE_OPTION.batch && (
            <>
              <FormField label="Receipt Date *">
                <input type="date" value={form.receiptDate} onChange={(e) => set('receiptDate')(e.target.value)} />
              </FormField>
              <FormField label="Batch No *">
                <input value={form.batchNo} inputMode="numeric" onChange={(e) => set('batchNo')(e.target.value.replace(/\D/g, ''))} />
              </FormField>
            </>
          )}
          {form.option === DELETE_OPTION.membership && (
            <>
              <FormField label="MBM'Ship No From *">
                <input value={form.numberFrom} onChange={(e) => set('numberFrom')(e.target.value.toUpperCase())} />
              </FormField>
              <FormField label="MBM'Ship No To *">
                <input value={form.numberTo} onChange={(e) => set('numberTo')(e.target.value.toUpperCase())} />
              </FormField>
            </>
          )}
          <div className="actions">
            <Button
              variant="ghost"
              busy={list.isPending}
              busyLabel="Listing…"
              disabled={list.isPending || remove.isPending}
              onClick={() => list.mutate({ ...form })}
            >
              {' '}
              Go{' '}
            </Button>
            <Button
              variant="danger"
              busy={remove.isPending}
              busyLabel="Deleting…"
              disabled={!canDelete}
              title={sameCriteria ? undefined : 'Press Go first to list what will be deleted.'}
              onClick={() => void confirmDelete()}
            >
              {' '}
              Delete{' '}
            </Button>
          </div>
        </fieldset>
      </div>
      {list.isError && (
        <p className="error" role="alert">
          {errorMessage(list.error)}
        </p>
      )}
      {remove.isError && (
        <p className="error" role="alert">
          {errorMessage(remove.error)}
        </p>
      )}
      {result && (
        <>
          <p className="muted">
            Principal {result.totalPrincipal} · Supplementary {result.totalSupplementary} · Total {result.totalPrincipal + result.totalSupplementary} (
            {result.memberships} membership(s) selected)
          </p>
          {result.truncated && (
            <p className="warning">
              Only the first {LIST_LIMIT} memberships are listed; Delete applies to all {result.memberships}+ selected.
            </p>
          )}
          {result.rows.length > 0 && (
            <div className="table-wrap">
              <table className="grid">
                <thead>
                  <tr>
                    <th>Bordx. Date</th>
                    <th>Bordx. Batch</th>
                    <th>Mem. No</th>
                    <th>Covered ID</th>
                    <th>Mem. Name</th>
                  </tr>
                </thead>
                <tbody>
                  {result.rows.map((r) => (
                    <tr key={`${r.membershipNo}|${r.coverId}`}>
                      <td>{formatDate(r.bordxDate)}</td>
                      <td>{r.batchNo ?? ''}</td>
                      <td>{r.membershipNo}</td>
                      <td>{r.coverId}</td>
                      <td>{r.name ?? ''}</td>
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
