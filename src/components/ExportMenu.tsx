import { useEffect, useRef, useState } from 'react'
import { errorMessage } from '../api/client'
import { exportList } from '../lib/exportTable'
import { exportFormats } from '../lib/exportSpec'
import type { ExportFormat, ExportSpec } from '../lib/exportSpec'
import { notify } from '../lib/notifyStore'
import { Icon } from './icons'

interface ExportMenuProps {
  /** The list to export, or a message to show instead (nothing to export yet). */
  spec: () => ExportSpec | string
  disabled?: boolean
  label?: string
}

/** The Export button: a small menu of Excel, PDF and CSV; the list is built when a format is chosen. */
export function ExportMenu({ spec, disabled, label = 'Export' }: ExportMenuProps) {
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState<ExportFormat | null>(null)
  const box = useRef<HTMLDivElement>(null)

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

  async function choose(format: ExportFormat) {
    setOpen(false)
    const what = spec()
    if (typeof what === 'string') return notify(what, 'info')
    setBusy(format)
    try {
      await exportList(format, what)
    } catch (e) {
      notify(errorMessage(e), 'error')
    } finally {
      setBusy(null)
    }
  }

  return (
    <div className="export-menu" ref={box}>
      <button
        type="button"
        className="ghost"
        disabled={disabled || busy !== null}
        aria-busy={busy !== null || undefined}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
      >
        {busy ? `Exporting ${exportFormats.find((f) => f.id === busy)?.label}…` : label}
        <Icon name={open ? 'chevUp' : 'chevDown'} size={16} />
      </button>
      {open && (
        <div className="export-menu-list" role="menu" aria-label={`${label} as`}>
          {exportFormats.map((f) => (
            <button key={f.id} type="button" role="menuitem" onClick={() => choose(f.id)}>
              <span className="export-format">{f.label}</span>
              <span className="export-hint">{f.hint}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
