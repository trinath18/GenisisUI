import { CodeSelect } from '../../../../components/common/CodeSelect'
import type { CodeOption } from '../../../../components/common/CodeSelect'
import type { RangeValue, TrackingField } from '../types'

interface TrackingFiltersProps {
  groups: [string, TrackingField[]][]
  values: Record<string, string>
  ranges: Record<string, RangeValue>
  blanks: string[]
  optionsFor: (field: TrackingField) => CodeOption[]
  onValueChange: (key: string, value: string) => void
  onRangeChange: (key: string, range: RangeValue) => void
  onBlankChange: (key: string, blank: boolean) => void
}

const inputType = (field: TrackingField) => (field.kind === 'Date' ? 'date' : field.kind === 'Number' ? 'number' : 'text')

function FilterInput({ field, value, onChange, options, label }: {
  field: TrackingField
  value: string
  onChange: (value: string) => void
  options: CodeOption[]
  label: string
}) {
  return field.kind === 'Select'
    ? <CodeSelect value={value} onChange={onChange} options={options} ariaLabel={label} />
    : <input aria-label={label} type={inputType(field)} value={value} onChange={(e) => onChange(e.target.value)} />
}

/** The desktop's filter controls, grouped; every field can have from / to and a "blank" box as the server describes it. */
export function TrackingFilters(props: TrackingFiltersProps) {
  return (
    <>
      {props.groups.map(([group, fields]) => (
        <fieldset key={group}>
          <legend>{group}</legend>
          {fields.map((field) => {
            const range = props.ranges[field.key] ?? { from: '', to: '' }
            return (
              <div key={field.key} className="form-field">
                <span>{field.label}</span>
                {field.blankOnly ? null : field.range ? (
                  <div className="actions">
                    <FilterInput field={field} label={`${field.label} from`} value={range.from} options={props.optionsFor(field)}
                      onChange={(from) => props.onRangeChange(field.key, { ...range, from })} />
                    <span className="muted">to</span>
                    <FilterInput field={field} label={`${field.label} to`} value={range.to} options={props.optionsFor(field)}
                      onChange={(to) => props.onRangeChange(field.key, { ...range, to })} />
                  </div>
                ) : (
                  <FilterInput field={field} label={field.label} value={props.values[field.key] ?? ''} options={props.optionsFor(field)}
                    onChange={(value) => props.onValueChange(field.key, value)} />
                )}
                {field.blankable && (
                  <label className="muted">
                    <input type="checkbox" checked={props.blanks.includes(field.key)} onChange={(e) => props.onBlankChange(field.key, e.target.checked)} /> blank
                  </label>
                )}
              </div>
            )
          })}
        </fieldset>
      ))}
    </>
  )
}
