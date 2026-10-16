import type { ReactNode } from 'react'

interface FormFieldProps {
  label: string
  children: ReactNode
  /** Spans the full row of the form grid. */
  wide?: boolean
}

/** Label + control in the screens' form grid. The label wraps the control, so it is its accessible name. */
export function FormField({ label, children, wide }: FormFieldProps) {
  return (
    <label className={wide ? 'form-field wide' : 'form-field'}>
      <span>{label}</span>
      {children}
    </label>
  )
}
