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

/** The CSV text of rows that are already text (several lists one after the other, each with its own heading). */
export const rowsToCsv = (rows: string[][]) => rows.map((r) => r.map(escapeCell).join(',')).join('\r\n')

/** Client-side export of a table to a CSV file that opens in Excel (replaces ExportListViewtoExcel). */
export function downloadCsv<T>(fileName: string, columns: CsvColumn<T>[], rows: T[]) {
  saveText(fileName, toCsv(columns, rows))
}

/** Client-side export of rows of text to a CSV file. */
export function downloadCsvRows(fileName: string, rows: string[][]) {
  saveText(fileName, rowsToCsv(rows))
}

function saveText(fileName: string, text: string) {
  const url = URL.createObjectURL(new Blob(['\ufeff', text], { type: 'text/csv;charset=utf-8' }))
  const link = document.createElement('a')
  link.href = url
  link.download = fileName
  link.click()
  URL.revokeObjectURL(url)
}
