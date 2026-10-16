import { useEffect, useRef } from 'react'
import type { KeyboardEvent, ReactNode } from 'react'

/** Modal dialog: Escape closes, Tab cycles inside, focus returns to the opener. */
export function Modal({
  title,
  onClose,
  children,
  wide,
}: {
  title: string
  onClose: () => void
  children: ReactNode
  wide?: boolean
}) {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null
    const el = ref.current
    const focusables = () =>
      Array.from(el?.querySelectorAll<HTMLElement>('input, select, textarea, button, [tabindex]') ?? []).filter(
        (e) => !e.hasAttribute('disabled') && e.tabIndex >= 0,
      )
    ;(el?.querySelector<HTMLElement>('[data-autofocus]') ?? focusables()[0])?.focus()
    return () => previous?.focus()
  }, [])

  function onKeyDown(e: KeyboardEvent<HTMLDivElement>) {
    if (e.key === 'Escape') {
      e.stopPropagation()
      onClose()
      return
    }
    if (e.key !== 'Tab' || !ref.current) return
    const items = Array.from(ref.current.querySelectorAll<HTMLElement>('input, select, textarea, button, [tabindex]')).filter(
      (x) => !x.hasAttribute('disabled') && x.tabIndex >= 0,
    )
    if (items.length === 0) return
    const first = items[0]
    const last = items[items.length - 1]
    const active = document.activeElement as HTMLElement
    if (e.shiftKey ? active === first || !ref.current.contains(active) : active === last) {
      e.preventDefault()
      ;(e.shiftKey ? last : first).focus()
    }
  }

  return (
    <div className="modal-overlay" onKeyDown={onKeyDown}>
      <div className={wide ? 'modal wide' : 'modal'} role="dialog" aria-modal="true" aria-label={title} ref={ref}>
        <div className="modal-head">
          <h3>{title}</h3>
          <button type="button" className="link" onClick={onClose} aria-label="Close">
            ✕
          </button>
        </div>
        <div className="modal-body">{children}</div>
      </div>
    </div>
  )
}
