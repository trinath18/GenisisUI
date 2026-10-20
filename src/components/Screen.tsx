import { useId } from 'react'
import type { ReactNode } from 'react'

/** Standard screen frame: heading and the card container the case screens share. */
export function PageShell({ title, subtitle, children }: { title: string; subtitle?: string; children: ReactNode }) {
  const headingId = useId()
  return (
    <section className="registration case-reg screen" aria-labelledby={headingId}>
      <header className="screen-head">
        <h2 id={headingId}>{title}</h2>
        {subtitle && <p className="muted">{subtitle}</p>}
      </header>
      {children}
    </section>
  )
}

/** Sticky command bar (VB6 command-button frame). Children are the buttons; use <span className="spacer" /> to split groups. */
export function ActionBar({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="actions cr-actions" role="toolbar" aria-label={label}>
      {children}
    </div>
  )
}

/** Small read-only counter (VB6 "Records" / "Total Amt" labels). */
export function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <span className="stat">
      <span className="stat-label">{label}</span>
      <strong className="stat-value">{value}</strong>
    </span>
  )
}
