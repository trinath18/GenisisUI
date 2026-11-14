import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { applyTheme, loadPreference, resolveMode, savePreference, systemPrefersDark } from './theme'
import type { ColorThemeId, ModePreference, ThemePreference } from './theme'

interface ThemeState extends ThemePreference {
  /** The mode shown (Same as system resolved). */
  resolvedMode: 'light' | 'dark'
  setMode: (mode: ModePreference) => void
  setColor: (color: ColorThemeId) => void
}

const ThemeContext = createContext<ThemeState | null>(null)

/** Light / dark mode and colour theme of the signed-in user (or of the browser before sign-in). */
export function ThemeProvider({ user, children }: { user: string | null; children: ReactNode }) {
  const [state, setState] = useState(() => ({ user, pref: loadPreference(user) }))
  const [systemDark, setSystemDark] = useState(systemPrefersDark)
  // Another user signs in: show their choice.
  const pref = state.user === user ? state.pref : loadPreference(user)
  if (state.user !== user) setState({ user, pref })

  useEffect(() => {
    const query = window.matchMedia?.('(prefers-color-scheme: dark)')
    if (!query) return
    const onChange = (e: MediaQueryListEvent) => setSystemDark(e.matches)
    query.addEventListener('change', onChange)
    return () => query.removeEventListener('change', onChange)
  }, [])

  useEffect(() => applyTheme(pref, systemDark), [pref, systemDark])

  const update = useCallback((patch: Partial<ThemePreference>) => {
    setState((s) => {
      const next = { ...s.pref, ...patch }
      savePreference(s.user, next)
      return { ...s, pref: next }
    })
  }, [])

  const value = useMemo<ThemeState>(
    () => ({ ...pref, resolvedMode: resolveMode(pref.mode, systemDark), setMode: (mode) => update({ mode }), setColor: (color) => update({ color }) }),
    [pref, systemDark, update],
  )
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
}

// eslint-disable-next-line react-refresh/only-export-components
export function useTheme(): ThemeState {
  const ctx = useContext(ThemeContext)
  if (!ctx) throw new Error('useTheme must be used inside ThemeProvider')
  return ctx
}
