import type { Row } from '../lib/format'
import { formatValue } from '../lib/format'

export interface Field {
  label: string
  key?: string
  value?: (row: Row) => string
  wide?: boolean
}

export function FieldGrid({ fields, row }: { fields: Field[]; row: Row }) {
  return (
    <dl className="fields">
      {fields.map((f) => (
        <div key={f.label} className={f.wide ? 'field wide' : 'field'}>
          <dt>{f.label}</dt>
          <dd>{(f.value ? f.value(row) : formatValue(f.key ? row[f.key] : '')) || '\u00a0'}</dd>
        </div>
      ))}
    </dl>
  )
}
