import { useEffect, useRef, useState } from 'react'
import { Icon } from '../components/icons'
import type { IconName } from '../components/icons'
import { useTheme } from './ThemeProvider'
import { colorThemes } from './theme'
import type { ColorThemeId, ModePreference } from './theme'

const modes: { id: ModePreference; label: string; icon: IconName }[] = [
  { id: 'light', label: 'Light', icon: 'sun' },
  { id: 'dark', label: 'Dark', icon: 'moon' },
  { id: 'system', label: 'Same as system', icon: 'monitor' },
]

/** Top-bar controls, as in Genesis FIS: a quick light / dark toggle and a menu with the mode and the colour theme. */
export function ThemeSwitcher() {
  const { mode, color, resolvedMode, setMode, setColor } = useTheme()
  const [open, setOpen] = useState(false)
  const box = useRef<HTMLDivElement>(null)
  const dark = resolvedMode === 'dark'

  useEffect(() => {
    if (!open) return
    const onDown = (e: PointerEvent) => !box.current?.contains(e.target as Node) && setOpen(false)
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false)
    document.addEventListener('pointerdown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('pointerdown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  const toggleLabel = dark ? 'Switch to light mode' : 'Switch to dark mode'
  return (
    <div className="theme-switcher" ref={box}>
      <button type="button" className="icon-button" onClick={() => setMode(dark ? 'light' : 'dark')} title={toggleLabel} aria-label={toggleLabel}>
        <Icon name={dark ? 'sun' : 'moon'} />
      </button>
      <button
        type="button"
        className="icon-button"
        onClick={() => setOpen((o) => !o)}
        title="Theme"
        aria-label="Theme"
        aria-haspopup="menu"
        aria-expanded={open}
      >
        <Icon name="palette" />
      </button>
      {open && (
        <div className="theme-menu" role="menu" aria-label="Theme">
          <div className="theme-menu-head">Appearance</div>
          {modes.map((m) => (
            <button
              key={m.id}
              type="button"
              role="menuitemradio"
              aria-checked={mode === m.id}
              className={mode === m.id ? 'selected' : ''}
              onClick={() => setMode(m.id)}
            >
              <Icon name={m.icon} size={16} />
              <span>{m.label}</span>
              {mode === m.id && <Icon name="check" size={16} />}
            </button>
          ))}
          <hr />
          <div className="theme-menu-head">Colour theme</div>
          {(Object.keys(colorThemes) as ColorThemeId[]).map((id) => (
            <button
              key={id}
              type="button"
              role="menuitemradio"
              aria-checked={color === id}
              className={color === id ? 'selected' : ''}
              onClick={() => setColor(id)}
            >
              <span className="swatch" style={{ background: colorThemes[id].swatch }} />
              <span>{colorThemes[id].label}</span>
              {color === id && <Icon name="check" size={16} />}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
