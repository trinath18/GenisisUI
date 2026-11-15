// The Export button: a list the page shows, saved as CSV, Excel (.xlsx) or PDF. CSV and Excel are made in the browser; the PDF is
// laid out by the API (POST /api/export/pdf), which repeats the heading row on every page.
import { api } from '../api/client'
import { saveBlob } from './download'
import { exportCsvText, pdfRequest } from './exportSpec'
import type { ExportFormat, ExportSpec } from './exportSpec'
import { buildXlsx } from './exportXlsx'

/** Saves the list in the format chosen. */
export async function exportList(format: ExportFormat, spec: ExportSpec): Promise<void> {
  if (format === 'csv') {
    saveBlob(new Blob(['\ufeff', exportCsvText(spec)], { type: 'text/csv;charset=utf-8' }), `${spec.fileName}.csv`)
    return
  }
  if (format === 'xlsx') {
    const blocks = spec.blocks.map((b) => ({
      heading: b.heading,
      columns: b.columns.map((c) => ({ label: c.label, numeric: c.numeric })),
      rows: b.rows.map((r) => b.columns.map((c) => c.value(r))),
    }))
    const bytes = buildXlsx(spec.title, blocks)
    saveBlob(new Blob([bytes], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }), `${spec.fileName}.xlsx`)
    return
  }
  const response = await api.post<Blob>('/api/export/pdf', pdfRequest(spec), { responseType: 'blob' })
  saveBlob(response.data, `${spec.fileName}.pdf`)
}
