import type { ComponentProps } from 'react'

export type ButtonVariant = 'default' | 'primary' | 'ghost' | 'link' | 'danger'

type ButtonProps = Omit<ComponentProps<'button'>, 'className'> & {
  /** Visual style; `primary` is the one main action of a screen, `ghost` a secondary action, `link` a quiet action (Clear, Close), `danger` a destructive one. */
  variant?: ButtonVariant
  /** A request is running: the button is disabled, announced as busy and shows `busyLabel`. */
  busy?: boolean
  busyLabel?: string
}

/**
 * The app's button. Defaults to `type="button"` so a button inside a form never submits it by accident;
 * pass `type="submit"` for the form's own action.
 */
export function Button({ variant = 'default', busy = false, busyLabel, type = 'button', disabled, children, ...rest }: ButtonProps) {
  return (
    <button type={type} className={variant === 'default' ? undefined : variant} disabled={disabled || busy} aria-busy={busy || undefined} {...rest}>
      {busy && busyLabel ? busyLabel : children}
    </button>
  )
}
