// Light / dark mode and colour theme, as in Genesis FIS (theme/AppThemeProvider there): remembered per user in localStorage, defaulting to the system's light / dark setting.
// The colours themselves are CSS variables in index.css, chosen by the data-theme and data-color attributes of <html>.

export type ModePreference = 'system' | 'light' | 'dark'
export type ColorThemeId = 'blue' | 'teal' | 'indigo' | 'green'
export interface ThemePreference {
  mode: ModePreference
  color: ColorThemeId
}

/** The FIS colour themes (the swatch is the light primary colour). */
export const colorThemes: Record<ColorThemeId, { label: string; swatch: string }> = {
  blue: { label: 'Blue', swatch: '#1e5bb8' },
  teal: { label: 'Teal', swatch: '#0b7d7a' },
  indigo: { label: 'Indigo', swatch: '#5146c7' },
  green: { label: 'Green', swatch: '#2e7d4f' },
}

export const defaultPreference: ThemePreference = { mode: 'system', color: 'blue' }
const lastKey = 'genisis.theme'
const userKey = (user: string) => `genisis.theme.${user.toLowerCase()}`

/** The stored choice of a user (or the last one used on this browser), falling back to the defaults for anything missing or invalid. */
export function loadPreference(user?: string | null, storage: Pick<Storage, 'getItem'> = localStorage): ThemePreference {
  try {
    const raw = (user && storage.getItem(userKey(user))) || storage.getItem(lastKey)
    const v = raw ? (JSON.parse(raw) as Partial<ThemePreference>) : {}
    return {
      mode: v.mode === 'light' || v.mode === 'dark' || v.mode === 'system' ? v.mode : defaultPreference.mode,
      color: v.color && v.color in colorThemes ? v.color : defaultPreference.color,
    }
  } catch {
    return defaultPreference
  }
}

export function savePreference(user: string | null | undefined, pref: ThemePreference, storage: Pick<Storage, 'setItem'> = localStorage) {
  try {
    const json = JSON.stringify(pref)
    storage.setItem(lastKey, json)
    if (user) storage.setItem(userKey(user), json)
  } catch {
    // storage unavailable: the choice lasts for this page only
  }
}

export const resolveMode = (mode: ModePreference, systemDark: boolean): 'light' | 'dark' => (mode === 'system' ? (systemDark ? 'dark' : 'light') : mode)

export const systemPrefersDark = () => typeof window !== 'undefined' && window.matchMedia?.('(prefers-color-scheme: dark)').matches === true

/** Puts the theme on <html>; index.css picks the colours from these attributes. */
export function applyTheme(pref: ThemePreference, systemDark = systemPrefersDark(), root: HTMLElement = document.documentElement) {
  const mode = resolveMode(pref.mode, systemDark)
  root.dataset.theme = mode
  root.dataset.color = pref.color
  root.style.colorScheme = mode
}
