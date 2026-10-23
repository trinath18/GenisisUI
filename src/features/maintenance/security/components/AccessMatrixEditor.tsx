import { useMemo, useState } from 'react'
import type { AccessEntry } from '../types'
import { Button } from '../../../../components/Button'

interface AccessMatrixEditorProps {
  matrix: AccessEntry[]
  granted: number[]
  onChange: (granted: number[]) => void
  disabled: boolean
}

/** The desktop's three tabs of checkboxes (ACS 1-178), grouped as its per-group "Check" buttons were, with Check All / Uncheck All. */
export function AccessMatrixEditor({ matrix, granted, onChange, disabled }: AccessMatrixEditorProps) {
  const tabs = useMemo(() => [...new Set(matrix.map((e) => e.tab))], [matrix])
  const [tab, setTab] = useState(tabs[0] ?? '')
  const set = useMemo(() => new Set(granted), [granted])
  const groups = useMemo(() => {
    const map = new Map<string, AccessEntry[]>()
    for (const e of matrix.filter((m) => m.tab === tab)) map.set(e.group, [...(map.get(e.group) ?? []), e])
    return [...map.entries()]
  }, [matrix, tab])

  const apply = (positions: number[], on: boolean) => {
    const next = new Set(set)
    for (const p of positions) {
      if (on) next.add(p)
      else next.delete(p)
    }
    onChange([...next].sort((a, b) => a - b))
  }

  return (
    <div className="tabbed">
      <div className="tabs" role="tablist">
        {tabs.map((t) => (
          <button key={t} type="button" role="tab" aria-selected={t === tab} className={t === tab ? 'active' : undefined} onClick={() => setTab(t)}>
            {t}
          </button>
        ))}
      </div>
      <div className="tab-body">
        <div className="actions tab-actions">
          <Button
            variant="ghost"
            disabled={disabled}
            onClick={() =>
              apply(
                matrix.map((e) => e.position),
                true,
              )
            }
          >
            Check All
          </Button>
          <Button
            variant="ghost"
            disabled={disabled}
            onClick={() =>
              apply(
                matrix.map((e) => e.position),
                false,
              )
            }
          >
            Uncheck All
          </Button>
          <span className="muted">{granted.length} rights granted</span>
        </div>
        <div className="access-groups">
          {groups.map(([group, entries]) => (
            <fieldset key={group}>
              <legend>{group}</legend>
              <Button
                variant="ghost"
                disabled={disabled}
                onClick={() =>
                  apply(
                    entries.map((e) => e.position),
                    true,
                  )
                }
              >
                Check
              </Button>
              {entries.map((e) => (
                <label key={e.position} className="check" title={`Position ${e.position}`}>
                  <input type="checkbox" disabled={disabled} checked={set.has(e.position)} onChange={(ev) => apply([e.position], ev.target.checked)} />
                  {e.caption}
                </label>
              ))}
            </fieldset>
          ))}
        </div>
      </div>
    </div>
  )
}
