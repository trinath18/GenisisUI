import { text } from '../memberForm'
import type { MemberForm, Option } from '../types'

interface MemberInputProps {
  form: MemberForm
  field: string
  type?: 'text' | 'date' | 'number'
  maxLength?: number
  upperCase?: boolean
  disabled?: boolean
}

/** Text / date / number input bound to one principal field; read-only unless the endorsement edits the principal. */
export function MemberInput({ form, field, type = 'text', maxLength, upperCase, disabled }: MemberInputProps) {
  return (
    <input
      type={type}
      value={text(form.member[field])}
      maxLength={maxLength}
      disabled={!form.editable || disabled || form.busy}
      onChange={(e) => form.set(field, upperCase ? e.target.value.toUpperCase() : e.target.value)}
    />
  )
}

interface MemberSelectProps {
  form: MemberForm
  field: string
  options: Option[]
  /** Offer an empty choice. */
  allowBlank?: boolean
  /** Store the option name instead of its code (city, state, salutation, blood type). */
  storeName?: boolean
}

/** Drop-down bound to one principal field; a stored value missing from the list is still shown. */
export function MemberSelect({ form, field, options, allowBlank = true, storeName = false }: MemberSelectProps) {
  const current = text(form.member[field])
  const valueOf = (o: Option) => (storeName ? o.name : o.code)
  return (
    <select value={current} disabled={!form.editable || form.busy} onChange={(e) => form.set(field, e.target.value)}>
      {allowBlank && <option value="" />}
      {current && !options.some((o) => valueOf(o) === current) && <option value={current}>{current}</option>}
      {options.map((o) => (
        <option key={o.code} value={valueOf(o)}>
          {storeName ? o.name : `${o.code} - ${o.name}`}
        </option>
      ))}
    </select>
  )
}

interface MemberTextAreaProps {
  form: MemberForm
  field: string
  rows?: number
  maxLength?: number
}

export function MemberTextArea({ form, field, rows = 2, maxLength }: MemberTextAreaProps) {
  return (
    <textarea
      rows={rows}
      maxLength={maxLength}
      value={text(form.member[field])}
      disabled={!form.editable || form.busy}
      onChange={(e) => form.set(field, e.target.value)}
    />
  )
}
