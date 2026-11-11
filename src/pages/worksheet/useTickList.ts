import { useCallback, useState } from 'react'
import { notify } from '../../lib/notifyStore'

/**
 * The rows of a search-and-tick screen and which of them are ticked (the desktop's checkbox ListView).
 * A scan adds to the list and a range search replaces it; ticking a row the guard refuses leaves it unticked with the
 * desktop's message (one message per kind of problem, with a count when several rows were refused).
 */
export function useTickList<T>(keyOf: (row: T) => string, tickProblem?: (row: T) => string | null) {
  const [rows, setRows] = useState<T[]>([])
  const [checked, setChecked] = useState<ReadonlySet<string>>(new Set())

  const replace = useCallback((next: T[]) => {
    setRows(next)
    setChecked(new Set())
  }, [])
  const append = useCallback((more: T[]) => setRows((prev) => [...prev, ...more]), [])
  const clear = useCallback(() => replace([]), [replace])

  /** lstItemCheck: only rows that were not ticked before are tested. */
  const change = useCallback(
    (next: Set<string>) => {
      const byKey = new Map(rows.map((r) => [keyOf(r), r]))
      const problems = new Map<string, number>()
      const accepted = new Set<string>()
      for (const key of next) {
        const row = byKey.get(key)
        if (!row) continue
        const problem = checked.has(key) ? null : (tickProblem?.(row) ?? null)
        if (problem) problems.set(problem, (problems.get(problem) ?? 0) + 1)
        else accepted.add(key)
      }
      problems.forEach((count, text) => notify(count > 1 ? `${text} (${count} worksheets were not selected)` : text, 'error'))
      setChecked(accepted)
    },
    [rows, checked, keyOf, tickProblem],
  )

  return { rows, checked, replace, append, clear, change, ticked: rows.filter((r) => checked.has(keyOf(r))) }
}
