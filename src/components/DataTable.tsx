import type { Row } from '../lib/format'
import { formatValue } from '../lib/format'

export interface Column {
  key: string
  label: string
  format?: (value: unknown, row: Row) => string
}

interface Props {
  columns: Column[]
  rows: Row[]
  onSelect?: (row: Row) => void
  selectedKey?: string
  rowKey?: string
  empty?: string
}

export function DataTable({ columns, rows, onSelect, selectedKey, rowKey, empty = 'No records found.' }: Props) {
  if (rows.length === 0) return <p className="muted">{empty}</p>
  return (
    <div className="table-wrap">
      <table className="grid">
        <thead>
          <tr>
            {columns.map((c) => (
              <th key={c.key}>{c.label}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => {
            const key = rowKey ? String(row[rowKey]) : String(i)
            return (
              <tr
                key={`${key}-${i}`}
                className={[onSelect ? 'clickable' : '', selectedKey && key === selectedKey ? 'selected' : ''].join(' ')}
                onClick={onSelect ? () => onSelect(row) : undefined}
              >
                {columns.map((c) => (
                  <td key={c.key}>{c.format ? c.format(row[c.key], row) : formatValue(row[c.key])}</td>
                ))}
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
