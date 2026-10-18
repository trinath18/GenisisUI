export interface CodeOption {
  code: string
  name: string
}

interface CodeSelectProps {
  value: string
  onChange: (value: string) => void
  options: CodeOption[]
  /** Offer an empty choice (default true). */
  allowBlank?: boolean
  disabled?: boolean
  /** Accessible name when the select is not inside a label. */
  ariaLabel?: string
}

/** Drop-down of code / name options shown as "code - name" (just the name when both are the same). */
export function CodeSelect({ value, onChange, options, allowBlank = true, disabled, ariaLabel }: CodeSelectProps) {
  return (
    <select value={value} disabled={disabled} aria-label={ariaLabel} onChange={(e) => onChange(e.target.value)}>
      {allowBlank && <option value="" />}
      {options.map((o) => (
        <option key={o.code} value={o.code}>
          {o.code === o.name ? o.name : `${o.code} - ${o.name}`}
        </option>
      ))}
    </select>
  )
}
