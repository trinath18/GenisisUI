import { useId, useState } from 'react'
import type { KeyboardEvent, ReactNode } from 'react'

/**
 * Tabbed card (VB6 SSTab). `panels[i]` belongs to `tabs[i]`; only the active panel is mounted.
 * Left/Right/Home/End move between tabs. Pass `active` + `onChange` to control it from the page.
 */
export function Tabs({
  label,
  tabs,
  panels,
  active,
  onChange,
}: {
  label: string
  tabs: readonly string[]
  panels: readonly ReactNode[]
  active?: number
  onChange?: (index: number) => void
}) {
  const base = useId()
  const [inner, setInner] = useState(0)
  const current = active ?? inner

  const select = (i: number) => {
    setInner(i)
    onChange?.(i)
    document.getElementById(`${base}-tab-${i}`)?.focus()
  }

  function onKeyDown(e: KeyboardEvent<HTMLDivElement>) {
    const last = tabs.length - 1
    const next = { ArrowRight: current === last ? 0 : current + 1, ArrowLeft: current === 0 ? last : current - 1, Home: 0, End: last }[e.key]
    if (next === undefined) return
    e.preventDefault()
    select(next)
  }

  return (
    <div className="tabbed">
      <div className="tabs" role="tablist" aria-label={label} onKeyDown={onKeyDown}>
        {tabs.map((t, i) => (
          <button
            key={t}
            type="button"
            role="tab"
            id={`${base}-tab-${i}`}
            aria-selected={i === current}
            aria-controls={`${base}-panel-${i}`}
            tabIndex={i === current ? 0 : -1}
            className={i === current ? 'active' : ''}
            onClick={() => select(i)}
          >
            {t}
          </button>
        ))}
      </div>
      <div className="tab-body" role="tabpanel" id={`${base}-panel-${current}`} aria-labelledby={`${base}-tab-${current}`}>
        {panels[current]}
      </div>
    </div>
  )
}
