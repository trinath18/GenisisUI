import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { CodeSelect } from '../../../../components/common/CodeSelect'
import { FormField } from '../../../../components/common/FormField'
import { adjustmentApi, adjustmentKeys } from '../../adjustment/api/adjustmentApi'
import { EMPTY_SEARCH, LOOKUPS_STALE_MS, SENDING_MODES } from '../constants'
import type { CardControlSearch } from '../types'
import { Button } from '../../../../components/Button'

interface CardControlFiltersProps {
  busy: boolean
  onSearch: (search: CardControlSearch) => void
  onClear: () => void
}

/** The desktop search frame: MBM number, bordx date, batch and sent date ranges, payor and sending mode. */
export function CardControlFilters({ busy, onSearch, onClear }: CardControlFiltersProps) {
  const [search, setSearch] = useState(EMPTY_SEARCH)
  const lookups = useQuery({ queryKey: adjustmentKeys.lookups, queryFn: adjustmentApi.getLookups, staleTime: LOOKUPS_STALE_MS })
  const set = (field: keyof CardControlSearch) => (value: string) => setSearch((s) => ({ ...s, [field]: value }))
  const digits = (value: string) => value.replace(/\D/g, '')

  return (
    <fieldset>
      <legend>Search</legend>
      <FormField label="MBM Number">
        <input value={search.numberFrom} onChange={(e) => set('numberFrom')(e.target.value.toUpperCase())} />
      </FormField>
      <FormField label="To">
        <input value={search.numberTo} onChange={(e) => set('numberTo')(e.target.value.toUpperCase())} />
      </FormField>
      <FormField label="Bordx Date">
        <input type="date" value={search.bordxDateFrom} onChange={(e) => set('bordxDateFrom')(e.target.value)} />
      </FormField>
      <FormField label="To">
        <input type="date" value={search.bordxDateTo} onChange={(e) => set('bordxDateTo')(e.target.value)} />
      </FormField>
      <FormField label="Payor">
        <CodeSelect value={search.payorCode} onChange={set('payorCode')} options={lookups.data?.payors ?? []} disabled={!lookups.data} />
      </FormField>
      <FormField label="Batch No.">
        <input value={search.batchFrom} inputMode="numeric" onChange={(e) => set('batchFrom')(digits(e.target.value))} />
      </FormField>
      <FormField label="To">
        <input value={search.batchTo} inputMode="numeric" onChange={(e) => set('batchTo')(digits(e.target.value))} />
      </FormField>
      <FormField label="Sending Mode">
        <select value={search.sendingMode} onChange={(e) => set('sendingMode')(e.target.value)}>
          <option value="">(any)</option>
          {SENDING_MODES.map((m) => (
            <option key={m} value={m}>
              {m}
            </option>
          ))}
        </select>
      </FormField>
      <FormField label="Sent Date">
        <input type="date" value={search.sentDateFrom} onChange={(e) => set('sentDateFrom')(e.target.value)} />
      </FormField>
      <FormField label="To">
        <input type="date" value={search.sentDateTo} onChange={(e) => set('sentDateTo')(e.target.value)} />
      </FormField>
      <div className="actions">
        <Button variant="ghost" disabled={busy} onClick={() => onSearch({ ...search })}>
          Search
        </Button>
        <Button
          variant="link"
          disabled={busy}
          onClick={() => {
            setSearch(EMPTY_SEARCH)
            onClear()
          }}
        >
          Clear
        </Button>
      </div>
    </fieldset>
  )
}
