import { useEffect, useMemo, useRef, useState } from 'react'
import type { KeyboardEvent, ReactNode } from 'react'

export interface GridColumn<T> {
  key: string
  label: string
  /** Cell text; defaults to `String(row[key])`. */
  value?: (row: T) => string | number | null | undefined
  render?: (row: T) => ReactNode
  /** Value used for sorting when it differs from the display text (dates, money). */
  sortBy?: (row: T) => string | number
  align?: 'left' | 'right' | 'center'
  sortable?: boolean
}

interface Props<T> {
  /** Accessible table name. */
  caption: string
  columns: GridColumn<T>[]
  rows: T[]
  rowKey: (row: T) => string
  empty?: string
  selectedKey?: string | null
  onSelect?: (row: T) => void
  /** Adds a leading checkbox column with a select-all header (VB6 checkbox ListView). */
  check?: { checked: ReadonlySet<string>; onChange: (next: Set<string>) => void }
  tall?: boolean
}

type Sort = { key: string; dir: 'asc' | 'desc' } | null

const compare = (a: string | number, b: string | number) =>
  typeof a === 'number' && typeof b === 'number' ? a - b : String(a).localeCompare(String(b), undefined, { numeric: true, sensitivity: 'base' })

const cellValue = <T extends object>(c: GridColumn<T>, row: T) =>
  c.value ? c.value(row) : ((row as Record<string, unknown>)[c.key] as string | number | null | undefined)
const cellText = <T extends object>(c: GridColumn<T>, row: T) => String(cellValue(c, row) ?? '')

/** Sortable, optionally selectable/checkable results table (replaces the VB6 ListView + ColumnClick sort). */
export function DataGrid<T extends object>({ caption, columns, rows, rowKey, empty = 'No records found.', selectedKey, onSelect, check, tall }: Props<T>) {
  const [sort, setSort] = useState<Sort>(null)
  const allBox = useRef<HTMLInputElement>(null)

  const sorted = useMemo(() => {
    const col = sort && columns.find((c) => c.key === sort.key)
    if (!sort || !col) return rows
    const by = (r: T) => (col.sortBy ? col.sortBy(r) : (cellValue(col, r) ?? ''))
    return [...rows].sort((a, b) => (sort.dir === 'asc' ? 1 : -1) * compare(by(a), by(b)))
  }, [rows, columns, sort])

  const keys = rows.map(rowKey)
  const checkedCount = check ? keys.filter((k) => check.checked.has(k)).length : 0
  useEffect(() => {
    if (allBox.current) allBox.current.indeterminate = checkedCount > 0 && checkedCount < keys.length
  }, [checkedCount, keys.length])

  const toggleSort = (key: string) => setSort((s) => (s?.key !== key ? { key, dir: 'asc' } : s.dir === 'asc' ? { key, dir: 'desc' } : null))
  const toggleRow = (key: string) => {
    if (!check) return
    const next = new Set(check.checked)
    if (!next.delete(key)) next.add(key)
    check.onChange(next)
  }
  const toggleAll = () => check?.onChange(checkedCount === keys.length ? new Set() : new Set(keys))

  const onRowKey = (e: KeyboardEvent<HTMLTableRowElement>, row: T) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      onSelect?.(row)
    }
  }

  const cls = (c: GridColumn<T>) => (c.align === 'right' ? 'num' : c.align === 'center' ? 'center' : undefined)
  const span = columns.length + (check ? 1 : 0)

  return (
    <div className={`table-wrap${tall ? ' tall' : ''}`}>
      <table className="grid" aria-label={caption}>
        <thead>
          <tr>
            {check && (
              <th scope="col" className="check-cell">
                <input
                  ref={allBox}
                  type="checkbox"
                  aria-label="Select all rows"
                  checked={keys.length > 0 && checkedCount === keys.length}
                  disabled={keys.length === 0}
                  onChange={toggleAll}
                />
              </th>
            )}
            {columns.map((c) => (
              <th key={c.key} scope="col" className={cls(c)} aria-sort={sort?.key === c.key ? (sort.dir === 'asc' ? 'ascending' : 'descending') : undefined}>
                {c.sortable === false ? (
                  c.label
                ) : (
                  <button type="button" className="th-sort" onClick={() => toggleSort(c.key)} title={`Sort by ${c.label}`}>
                    {c.label}
                    <span aria-hidden="true" className="sort-mark">
                      {sort?.key === c.key ? (sort.dir === 'asc' ? '▲' : '▼') : ''}
                    </span>
                  </button>
                )}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {sorted.length === 0 ? (
            <tr className="empty-row">
              <td colSpan={span}>{empty}</td>
            </tr>
          ) : (
            sorted.map((row) => {
              const key = rowKey(row)
              const selected = selectedKey != null && key === selectedKey
              return (
                <tr
                  key={key}
                  className={[onSelect ? 'clickable' : '', selected ? 'selected' : ''].join(' ').trim() || undefined}
                  aria-current={selected ? 'true' : undefined}
                  tabIndex={onSelect ? 0 : undefined}
                  onClick={onSelect ? () => onSelect(row) : undefined}
                  onKeyDown={onSelect ? (e) => onRowKey(e, row) : undefined}
                >
                  {check && (
                    <td className="check-cell">
                      <input
                        type="checkbox"
                        aria-label={`Select ${key}`}
                        checked={check.checked.has(key)}
                        onClick={(e) => e.stopPropagation()}
                        onChange={() => toggleRow(key)}
                      />
                    </td>
                  )}
                  {columns.map((c) => (
                    <td key={c.key} className={cls(c)}>
                      {c.render ? c.render(row) : cellText(c, row)}
                    </td>
                  ))}
                </tr>
              )
            })
          )}
        </tbody>
      </table>
    </div>
  )
}
