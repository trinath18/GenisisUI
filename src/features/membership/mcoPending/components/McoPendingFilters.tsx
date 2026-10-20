import { useState } from 'react'
import { FormField } from '../../../../components/common/FormField'
import { SEARCH_STATUSES } from '../constants'
import type { McoPendingSearch } from '../types'

const EMPTY: McoPendingSearch = { numberFrom: '', numberTo: '', bordxDateFrom: '', bordxDateTo: '', status: '' }

/** The desktop search frame: MBM Number and Bordx Date ranges and the status. */
export function McoPendingFilters({ busy, onSearch }: { busy: boolean; onSearch: (search: McoPendingSearch) => void }) {
  const [search, setSearch] = useState(EMPTY)
  const set = (field: keyof McoPendingSearch) => (value: string) => setSearch((s) => ({ ...s, [field]: value }))

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
      <FormField label="Status">
        <select value={search.status} onChange={(e) => set('status')(e.target.value)}>
          <option value="">(any)</option>
          {SEARCH_STATUSES.map((s) => (
            <option key={s.code} value={s.code}>
              {s.name}
            </option>
          ))}
        </select>
      </FormField>
      <div className="actions">
        <button type="button" disabled={busy} onClick={() => onSearch({ ...search })}>
          Search
        </button>
        <button type="button" disabled={busy} onClick={() => setSearch(EMPTY)}>
          Clear
        </button>
      </div>
    </fieldset>
  )
}
