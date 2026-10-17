export interface CsvColumn<T> {
  label: string
  value: (row: T) => string | number | null | undefined
}

const escapeCell = (v: string | number | null | undefined) => {
  const s = v == null ? '' : String(v)
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

/** The CSV text (header row, then one line per row; cells quoted when they contain a comma, a quote or a line break). */
export function toCsv<T>(columns: CsvColumn<T>[], rows: T[]) {
  return [columns.map((c) => escapeCell(c.label)).join(','), ...rows.map((r) => columns.map((c) => escapeCell(c.value(r))).join(','))].join('\r\n')
}

/** Client-side export of a table to a CSV file that opens in Excel (replaces ExportListViewtoExcel). */
export function downloadCsv<T>(fileName: string, columns: CsvColumn<T>[], rows: T[]) {
  const url = URL.createObjectURL(new Blob(['\ufeff', toCsv(columns, rows)], { type: 'text/csv;charset=utf-8' }))
  const link = document.createElement('a')
  link.href = url
  link.download = fileName
  link.click()
  URL.revokeObjectURL(url)
}
