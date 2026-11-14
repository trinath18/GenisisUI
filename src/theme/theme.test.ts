import { describe, expect, it } from 'vitest'
import { applyTheme, loadPreference, resolveMode, savePreference } from './theme'

function memoryStorage(seed: Record<string, string> = {}) {
  const data = { ...seed }
  return { data, getItem: (k: string) => data[k] ?? null, setItem: (k: string, v: string) => void (data[k] = v) }
}

describe('theme preference', () => {
  it('defaults to the system mode and the blue theme, and ignores bad values', () => {
    expect(loadPreference(null, memoryStorage())).toEqual({ mode: 'system', color: 'blue' })
    expect(loadPreference(null, memoryStorage({ 'genisis.theme': '{"mode":"neon","color":"pink"}' }))).toEqual({ mode: 'system', color: 'blue' })
    expect(loadPreference(null, memoryStorage({ 'genisis.theme': 'not json' }))).toEqual({ mode: 'system', color: 'blue' })
  })

  it('remembers the choice per user, and as the last choice of the browser', () => {
    const storage = memoryStorage()
    savePreference('TRINATH', { mode: 'dark', color: 'teal' }, storage)
    expect(loadPreference('trinath', storage)).toEqual({ mode: 'dark', color: 'teal' })
    expect(loadPreference(null, storage)).toEqual({ mode: 'dark', color: 'teal' })
    savePreference('OTHER', { mode: 'light', color: 'green' }, storage)
    expect(loadPreference('TRINATH', storage)).toEqual({ mode: 'dark', color: 'teal' })
  })

  it('resolves Same as system and puts the theme on the root element', () => {
    expect(resolveMode('system', true)).toBe('dark')
    expect(resolveMode('system', false)).toBe('light')
    expect(resolveMode('light', true)).toBe('light')
    const root = { dataset: {}, style: {} } as unknown as HTMLElement
    applyTheme({ mode: 'system', color: 'indigo' }, true, root)
    expect([root.dataset.theme, root.dataset.color, root.style.colorScheme]).toEqual(['dark', 'indigo', 'dark'])
  })
})
