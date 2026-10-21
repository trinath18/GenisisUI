import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { errorMessage } from '../../../../api/client'
import { FormField } from '../../../../components/common/FormField'
import { saveCsv } from '../../../../lib/download'
import { formatDate } from '../../../../lib/format'
import { ask, notify } from '../../../../lib/notifyStore'
import { cardControlApi, cardControlKeys } from '../api/cardControlApi'
import { CardControlFilters } from '../components/CardControlFilters'
import { DOC_REFERENCE_MAX_LENGTH, EXPORT_FILE_NAME, MESSAGES, SEARCH_LIMIT, SENDING_MODES, rowKey } from '../constants'
import type { CardControlRow, CardControlSearch } from '../types'
import { Button } from '../../../../components/Button'

const HEADINGS = [
  'MBMNumber',
  'Cover ID',
  'Member Name',
  'Bordx Date',
  'Batch No',
  'Sending Mode',
  'Sent Date',
  'Policy No',
  'Doc Reference',
  'Grp Company',
  'Cost Center',
  'Branch',
  'Department',
] as const

const cells = (r: CardControlRow): string[] => [
  r.membershipNo,
  r.coverId,
  r.name ?? '',
  formatDate(r.bordxDate),
  r.batchNo?.toString() ?? '',
  r.sendingMode ?? '',
  formatDate(r.sentDate),
  r.policyNo ?? '',
  r.docReference ?? '',
  r.groupCompany ?? '',
  r.costCenter ?? '',
  r.branch ?? '',
  r.department ?? '',
]

/** Membership &gt; Card Sending Mode (legacy frmMembershipCardControl). */
export function CardControlPage() {
  const queryClient = useQueryClient()
  const [search, setSearch] = useState<CardControlSearch | null>(null)
  const [checked, setChecked] = useState<Set<string>>(new Set())
  const [mode, setMode] = useState('')
  const [sentDate, setSentDate] = useState('')
  const [docReference, setDocReference] = useState('')

  const list = useQuery({ queryKey: cardControlKeys.search(search), enabled: search !== null, queryFn: () => cardControlApi.search(search!) })
  const rows = list.data?.rows ?? []

  const update = useMutation({
    mutationFn: () =>
      cardControlApi.update({
        sendingMode: mode,
        sentDate: sentDate === '' ? null : sentDate,
        docReference,
        items: rows.filter((r) => checked.has(rowKey(r))).map((r) => ({ membershipNo: r.membershipNo, coverId: r.coverId })),
      }),
    onSuccess: (result) => {
      notify(result.message, 'success')
      void queryClient.invalidateQueries({ queryKey: cardControlKeys.search(search) })
    },
  })

  function runSearch(next: CardControlSearch) {
    setMode('')
    setSentDate('')
    setSearch(next)
    void queryClient.invalidateQueries({ queryKey: cardControlKeys.search(next) })
  }

  function clear() {
    setSearch(null)
    setChecked(new Set())
    setMode('')
    setSentDate('')
    setDocReference('')
  }

  function toggle(key: string) {
    setChecked((current) => {
      const next = new Set(current)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  const allChecked = rows.length > 0 && rows.every((r) => checked.has(rowKey(r)))
  const selected = rows.filter((r) => checked.has(rowKey(r))).length

  async function confirmUpdate() {
    if (await ask(MESSAGES.confirmUpdate)) update.mutate()
  }

  function print() {
    if (rows.length === 0) return notify(MESSAGES.nothingToPrint, 'info')
    saveCsv([[...HEADINGS], ...rows.map(cells)], EXPORT_FILE_NAME)
  }

  return (
    <section>
      <h2>Membership Card Control</h2>
      <div className="registration">
        <CardControlFilters busy={list.isFetching} onSearch={runSearch} onClear={clear} />
        <fieldset>
          <legend>Update</legend>
          <FormField label="Send Mode *">
            <select value={mode} onChange={(e) => setMode(e.target.value)}>
              <option value="">(choose)</option>
              {SENDING_MODES.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
          </FormField>
          <FormField label="Sent Date *">
            <input type="date" value={sentDate} onChange={(e) => setSentDate(e.target.value)} />
          </FormField>
          <FormField label="Doc Reference">
            <input value={docReference} maxLength={DOC_REFERENCE_MAX_LENGTH} onChange={(e) => setDocReference(e.target.value)} />
          </FormField>
          <div className="actions">
            <Button
              variant="primary"
              busy={update.isPending}
              busyLabel="Updating…"
              disabled={selected === 0 || update.isPending}
              onClick={() => void confirmUpdate()}
            >
              {' '}
              {`Update (${selected})`}{' '}
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
      {list.data && rows.length === 0 && <p className="muted">{MESSAGES.notFound}</p>}
      {list.data?.truncated && <p className="warning">Only the first {SEARCH_LIMIT} principals are listed. Narrow the search to see the rest.</p>}
      {list.data && rows.length > 0 && (
        <>
          <p className="muted">
            Total Principal {list.data.totalPrincipal} · Total Supp {list.data.totalSupplementary} · Total Member{' '}
            {list.data.totalPrincipal + list.data.totalSupplementary}
          </p>
          <div className="table-wrap">
            <table className="grid">
              <thead>
                <tr>
                  <th>
                    <input
                      type="checkbox"
                      aria-label="Check All"
                      checked={allChecked}
                      onChange={() => setChecked(allChecked ? new Set() : new Set(rows.map(rowKey)))}
                    />
                  </th>
                  {HEADINGS.map((h) => (
                    <th key={h}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => {
                  const key = rowKey(r)
                  return (
                    <tr key={key}>
                      <td>
                        <input
                          type="checkbox"
                          aria-label={`Select ${r.membershipNo} cover ${r.coverId}`}
                          checked={checked.has(key)}
                          onChange={() => toggle(key)}
                        />
                      </td>
                      {cells(r).map((value, i) => (
                        <td key={HEADINGS[i]}>{value}</td>
                      ))}
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </>
      )}
    </section>
  )
}
