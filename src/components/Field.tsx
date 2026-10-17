import { useId } from 'react'
import type { ComponentProps, ReactNode } from 'react'
import { useController } from 'react-hook-form'
import type { Control, FieldError, FieldValues, Path } from 'react-hook-form'
import { digitsOnly, maskTime } from '../lib/masks'
import { DateInput } from './DateInput'

export interface Option {
  value: string
  label: string
}

interface FieldBase {
  label: string
  error?: FieldError
  hint?: string
  wide?: boolean
  required?: boolean
}

/** Label + control + hint/error. The label wraps the control, so the control is announced with its label. */
export function Field({ label, error, hint, wide, required, children }: FieldBase & { children: ReactNode }) {
  return (
    <label className={`form-field${wide ? ' wide' : ''}${error ? ' invalid' : ''}`}>
      <span>
        {label}
        {required && (
          <abbr className="req" title="Required">
            *
          </abbr>
        )}
      </span>
      {children}
      {hint && !error && <small className="hint">{hint}</small>}
      {error && (
        <small className="field-error" role="alert">
          {error.message}
        </small>
      )}
    </label>
  )
}

type InputProps = FieldBase & Omit<ComponentProps<'input'>, 'className' | 'type'>

export function TextField({ label, error, hint, wide, required, ...input }: InputProps) {
  return (
    <Field label={label} error={error} hint={hint} wide={wide} required={required}>
      <input type="text" aria-invalid={error ? true : undefined} {...input} />
    </Field>
  )
}

/** KeyNumber parity: digits and a single decimal point only. */
export function NumberField({ onChange, ...props }: InputProps) {
  return (
    <TextField
      inputMode="decimal"
      {...props}
      onChange={(e) => {
        e.target.value = digitsOnly(e.target.value)
        return onChange?.(e)
      }}
    />
  )
}

/** MaskEdBox "##:##". */
export function TimeField({ onChange, ...props }: InputProps) {
  return (
    <TextField
      inputMode="numeric"
      placeholder="hh:mm"
      maxLength={5}
      {...props}
      onChange={(e) => {
        e.target.value = maskTime(e.target.value)
        return onChange?.(e)
      }}
    />
  )
}

export function ReadField({ label, value = '', hint, wide }: { label: string; value?: string; hint?: string; wide?: boolean }) {
  return (
    <Field label={label} hint={hint} wide={wide}>
      <input className="ro" readOnly value={value} placeholder="—" />
    </Field>
  )
}

export function TextAreaField({ label, error, hint, wide, required, ...area }: FieldBase & Omit<ComponentProps<'textarea'>, 'className'>) {
  return (
    <Field label={label} error={error} hint={hint} wide={wide} required={required}>
      <textarea rows={3} aria-invalid={error ? true : undefined} {...area} />
    </Field>
  )
}

export function SelectField({
  label,
  error,
  hint,
  wide,
  required,
  options,
  blank = true,
  ...select
}: FieldBase & { options: readonly Option[]; blank?: boolean } & Omit<ComponentProps<'select'>, 'className' | 'children'>) {
  return (
    <Field label={label} error={error} hint={hint} wide={wide} required={required}>
      <select aria-invalid={error ? true : undefined} {...select}>
        {blank && <option value="" />}
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </Field>
  )
}

/** Editable combo (VB6 DropDown ComboBox): type to filter, or pick from the list. */
export function ComboField({ label, error, hint, wide, required, options, ...input }: InputProps & { options: readonly Option[] }) {
  const listId = useId()
  return (
    <Field label={label} error={error} hint={hint} wide={wide} required={required}>
      <input type="text" list={listId} autoComplete="off" aria-invalid={error ? true : undefined} {...input} />
      <datalist id={listId}>
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </datalist>
    </Field>
  )
}

export function CheckField({ label, wide, ...input }: { label: string; wide?: boolean } & Omit<ComponentProps<'input'>, 'className' | 'type'>) {
  return (
    <label className={`check-field${wide ? ' wide' : ''}`}>
      <input type="checkbox" {...input} />
      <span>{label}</span>
    </label>
  )
}

/** Masked dd/mm/yyyy date with calendar picker, bound to a React Hook Form field. */
export function DateField<T extends FieldValues>({
  control,
  name,
  label,
  hint,
  wide,
  required,
  disabled,
}: Omit<FieldBase, 'error'> & { control: Control<T>; name: Path<T>; disabled?: boolean }) {
  const { field, fieldState } = useController({ control, name })
  return (
    <Field label={label} error={fieldState.error} hint={hint} wide={wide} required={required}>
      <DateInput
        value={String(field.value ?? '')}
        onChange={field.onChange}
        onBlur={field.onBlur}
        inputRef={field.ref}
        ariaLabel={label}
        disabled={disabled}
        invalid={!!fieldState.error}
      />
    </Field>
  )
}
