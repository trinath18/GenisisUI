import type { Ref } from 'react'
import { maskDate } from '../lib/masks'
import { Icon } from './icons'

const toIso = (dmy: string) => {
  const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(dmy)
  return m ? `${m[3]}-${m[2]}-${m[1]}` : ''
}
const toDmy = (iso: string) => (iso ? `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)}` : '')

/** Masked dd/mm/yyyy text box with a calendar picker button — the stored value stays dd/mm/yyyy. */
export function DateInput({
  value,
  onChange,
  onBlur,
  ariaLabel,
  disabled,
  invalid,
  inputRef,
}: {
  value: string
  onChange: (dmy: string) => void
  onBlur?: () => void
  ariaLabel?: string
  disabled?: boolean
  invalid?: boolean
  inputRef?: Ref<HTMLInputElement>
}) {
  return (
    <span className="date-input">
      <input
        ref={inputRef}
        value={value}
        placeholder="dd/mm/yyyy"
        maxLength={10}
        inputMode="numeric"
        aria-label={ariaLabel}
        aria-invalid={invalid ? true : undefined}
        disabled={disabled}
        onChange={(e) => onChange(maskDate(e.target.value))}
        onBlur={onBlur}
      />
      {!disabled && (
        <span className="cal-wrap" title="Pick a date">
          <Icon name="calendar" size={14} />
          <input
            type="date"
            aria-label={ariaLabel ? `${ariaLabel} picker` : 'Pick a date'}
            value={toIso(value)}
            onChange={(e) => e.target.value && onChange(toDmy(e.target.value))}
          />
        </span>
      )}
    </span>
  )
}
