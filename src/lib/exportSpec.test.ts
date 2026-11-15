import { describe, expect, it } from 'vitest'
import { block, exportCsvText, pdfRequest, singleList } from './exportSpec'
import type { ExportColumn } from './exportSpec'

interface Row {
  caseNo: string
  amount: number | null
}

const columns: ExportColumn<Row>[] = [
  { label: 'Case No', value: (r) => r.caseNo },
  { label: 'Amount', value: (r) => (r.amount == null ? '' : r.amount.toFixed(2)), numeric: true },
]

describe('the export lists', () => {
  it('writes one list as CSV, quoting what needs it', () => {
    const spec = singleList('tracking', 'Worksheet Tracking', columns, [
      { caseNo: 'AB0001', amount: 12.5 },
      { caseNo: 'A, "B"', amount: null },
    ])
    expect(exportCsvText(spec).split('\r\n')).toEqual(['Case No,Amount', 'AB0001,12.50', '"A, ""B""",'])
  })

  it('writes several lists one after the other, each under its heading', () => {
    const spec = {
      fileName: 'ws',
      title: 'Worksheet',
      blocks: [
        block({ heading: 'Benefits', columns, rows: [{ caseNo: 'AB0001', amount: 1 }] }),
        block({ heading: 'Summary', columns: [{ label: 'Item', value: (r: string) => r }], rows: ['Total'] }),
      ],
    }
    expect(exportCsvText(spec).split('\r\n')).toEqual(['Benefits', 'Case No,Amount', 'AB0001,1.00', '', 'Summary', 'Item', 'Total'])
  })

  it('sends the PDF the columns, which are amounts, and the cells as text', () => {
    const spec = singleList('t', 'Tracking', columns, [{ caseNo: 'AB0001', amount: null }], '1 worksheet(s)')
    expect(pdfRequest(spec)).toEqual({
      title: 'Tracking',
      subtitle: '1 worksheet(s)',
      sections: [
        {
          heading: undefined,
          columns: [
            { label: 'Case No', numeric: false },
            { label: 'Amount', numeric: true },
          ],
          rows: [['AB0001', '']],
        },
      ],
    })
  })
})
