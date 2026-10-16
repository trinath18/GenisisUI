const FILE_NAME_PATTERN = /filename="?([^";]+)"?/

/** File name from a Content-Disposition header, or the fallback. */
export function fileNameFromDisposition(header: unknown, fallback: string): string {
  return FILE_NAME_PATTERN.exec(String(header ?? ''))?.[1] ?? fallback
}

/** Saves a blob through a temporary link (the browser's download prompt). */
export function saveBlob(blob: Blob, fileName: string): void {
  const link = document.createElement('a')
  link.href = URL.createObjectURL(blob)
  link.download = fileName
  link.click()
  URL.revokeObjectURL(link.href)
}

/** Opens a blob (PDF / image) in a new tab and releases it once the tab has had time to load it. */
export function openBlob(blob: Blob): void {
  const RELEASE_AFTER_MS = 60_000
  const url = URL.createObjectURL(blob)
  window.open(url, '_blank', 'noopener')
  window.setTimeout(() => URL.revokeObjectURL(url), RELEASE_AFTER_MS)
}

/** A CSV cell: quoted when needed; leading = + @ are prefixed so spreadsheets do not run them as formulas. */
export function csvCell(value: string | number): string {
  let text = String(value)
  if (/^[=+@]/.test(text)) text = `'${text}`
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text
}

export function saveCsv(rows: (string | number)[][], fileName: string): void {
  saveBlob(new Blob([rows.map((r) => r.map(csvCell).join(',')).join('\r\n')], { type: 'text/csv' }), fileName)
}
