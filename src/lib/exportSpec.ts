// The Export button's lists, without the browser or the API: the formats, the lists of a page and their CSV / PDF request forms.
import { rowsToCsv } from './exportCsv'
import type { CsvColumn } from './exportCsv'
import type { XlsxCell } from './exportXlsx'

export type ExportFormat = 'csv' | 'xlsx' | 'pdf'

export const exportFormats: { id: ExportFormat; label: string; hint: string }[] = [
  { id: 'xlsx', label: 'Excel', hint: '.xlsx workbook' },
  { id: 'pdf', label: 'PDF', hint: 'Printable A4 landscape' },
  { id: 'csv', label: 'CSV', hint: 'Plain text, opens in Excel' },
]

/** A column to export: the CSV column plus whether it holds amounts (right-aligned in the PDF, numbers in Excel). */
export interface ExportColumn<T> extends CsvColumn<T> {
  numeric?: boolean
}

/** One list of the export (a worksheet's benefits, then its summary, …). */
export interface ExportBlock<T> {
  heading?: string
  columns: ExportColumn<T>[]
  rows: T[]
}

export interface ExportSpec {
  /** The file name without its extension. */
  fileName: string
  /** The PDF's title and the Excel sheet's name. */
  title: string
  subtitle?: string
  /** The lists, each made with {@link block} (each may have its own row type). */
  blocks: ExportBlock<unknown>[]
}

/** A list for {@link ExportSpec.blocks}: its own row type is kept by its columns. */
export const block = <T>(b: ExportBlock<T>) => b as unknown as ExportBlock<unknown>

/** A list with the same row type everywhere: the usual case of one table. */
export function singleList<T>(fileName: string, title: string, columns: ExportColumn<T>[], rows: T[], subtitle?: string): ExportSpec {
  return { fileName, title, subtitle, blocks: [block({ columns, rows })] }
}

const text = (v: XlsxCell) => (v == null ? '' : String(v))

/** Each block as rows of text: its heading (if any), the column labels, then the cells. */
export function blockRows(spec: ExportSpec): { heading?: string; labels: string[]; numeric: boolean[]; cells: string[][] }[] {
  return spec.blocks.map((b) => ({
    heading: b.heading,
    labels: b.columns.map((c) => c.label),
    numeric: b.columns.map((c) => c.numeric === true),
    cells: b.rows.map((r) => b.columns.map((c) => text(c.value(r)))),
  }))
}

/** The CSV text: the blocks one after the other, a blank line and the heading between them. */
export function exportCsvText(spec: ExportSpec): string {
  const lines: string[][] = []
  blockRows(spec).forEach((b, i) => {
    if (i > 0) lines.push([])
    if (b.heading) lines.push([b.heading])
    lines.push(b.labels, ...b.cells)
  })
  return rowsToCsv(lines)
}

/** The body of POST /api/export/pdf. */
export function pdfRequest(spec: ExportSpec) {
  return {
    title: spec.title,
    subtitle: spec.subtitle,
    sections: blockRows(spec).map((b) => ({
      heading: b.heading,
      columns: b.labels.map((label, i) => ({ label, numeric: b.numeric[i] })),
      rows: b.cells,
    })),
  }
}
