import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { errorMessage } from '../../../../api/client'
import { FormField } from '../../../../components/common/FormField'
import { saveCsv } from '../../../../lib/download'
import { formatDate } from '../../../../lib/format'
import { ask, notify } from '../../../../lib/notifyStore'
import { mcoPendingApi, mcoPendingKeys } from '../api/mcoPendingApi'
import { McoPendingFilters } from '../components/McoPendingFilters'
import { EXPORT_FILE_NAME, MCO_PENDING_STATUS, MESSAGES, SEARCH_LIMIT, UPDATE_STATUSES } from '../constants'
import type { McoPendingRow, McoPendingSearch } from '../types'
import { Button } from '../../../../components/Button'

const isBilled = (row: McoPendingRow) => row.status?.trim().toUpperCase() === MCO_PENDING_STATUS.billed

/** Membership &gt; MCO Pending (legacy frmMBMMCOPending). */
export function McoPendingPage() {
  const queryClient = useQueryClient()
  const [search, setSearch] = useState<McoPendingSearch | null>(null)
  const [status, setStatus] = useState<string>(MCO_PENDING_STATUS.pending)
  const [checked, setChecked] = useState<Set<string>>(new Set())

  const list = useQuery({ queryKey: mcoPendingKeys.search(search), enabled: search !== null, queryFn: () => mcoPendingApi.search(search!) })
  const rows = list.data?.rows ?? []

  const update = useMutation({
    mutationFn: () => mcoPendingApi.update({ status, membershipNos: [...checked] }),
    onSuccess: (result) => {
      notify(result.message, 'success')
      setChecked(new Set())
      void queryClient.invalidateQueries({ queryKey: mcoPendingKeys.search(search) })
    },
  })

  function runSearch(next: McoPendingSearch) {
    setChecked(new Set())
    setSearch(next)
    void queryClient.invalidateQueries({ queryKey: mcoPendingKeys.search(next) })
  }

  function toggle(row: McoPendingRow) {
    if (isBilled(row)) return notify(MESSAGES.billed, 'error')
    setChecked((current) => {
      const next = new Set(current)
      if (next.has(row.membershipNo)) next.delete(row.membershipNo)
      else next.add(row.membershipNo)
      return next
    })
  }

  async function confirmUpdate() {
    if (await ask(MESSAGES.confirmUpdate)) update.mutate()
  }

  function print() {
    if (rows.length === 0) return notify(MESSAGES.noRecordToPrint, 'error')
    saveCsv(
      [
        ['MBMNumber', 'Bordx Date', 'New Bordx Date', 'Status'],
        ...rows.map((r) => [r.membershipNo, formatDate(r.bordxDate), formatDate(r.newBordxDate), r.status ?? '']),
      ],
      EXPORT_FILE_NAME,
    )
  }

  return (
    <section>
      <h2>Membership MCO Pending</h2>
      <div className="registration">
        <McoPendingFilters busy={list.isFetching} onSearch={runSearch} />
        <fieldset>
          <legend>Update</legend>
          <FormField label="Status">
            <select value={status} onChange={(e) => setStatus(e.target.value)}>
              {UPDATE_STATUSES.map((s) => (
                <option key={s.code} value={s.code}>
                  {s.name}
                </option>
              ))}
            </select>
          </FormField>
          <div className="actions">
            <Button
              variant="primary"
              busy={update.isPending}
              busyLabel="Updating…"
              disabled={checked.size === 0 || update.isPending}
              onClick={() => void confirmUpdate()}
            >
              {' '}
              {`Update (${checked.size})`}{' '}
            </Button>
            <Button variant="ghost" disabled={rows.length === 0} onClick={print}>
              Print
            </Button>
          </div>
        </fieldset>
      </div>
      {update.isError && (
        <p className="error" role="alert">
          {errorMessage(update.error)}
        </p>
      )}
      {list.isLoading && <p className="muted">Searching…</p>}
      {list.isError && (
        <p className="error" role="alert">
          {errorMessage(list.error)}
        </p>
      )}
      {list.data && rows.length === 0 && <p className="muted">{MESSAGES.noRecord}</p>}
      {list.data?.truncated && <p className="warning">Only the first {SEARCH_LIMIT} records are shown. Narrow the search to see the rest.</p>}
      {rows.length > 0 && (
        <div className="table-wrap">
          <table className="grid">
            <thead>
              <tr>
                <th>Check</th>
                <th>MBMNumber</th>
                <th>Bordx Date</th>
                <th>New Bordx Date</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.membershipNo}>
                  <td>
                    <input
                      type="checkbox"
                      aria-label={`Select ${r.membershipNo}`}
                      checked={checked.has(r.membershipNo)}
                      disabled={update.isPending}
                      onChange={() => toggle(r)}
                    />
                  </td>
                  <td>{r.membershipNo}</td>
                  <td>{formatDate(r.bordxDate)}</td>
                  <td>{formatDate(r.newBordxDate)}</td>
                  <td>{r.status ?? ''}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  )
}
