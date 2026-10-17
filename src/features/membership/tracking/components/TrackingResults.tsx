import { formatDate, formatMoney } from '../../../../lib/format'
import { MONEY_COLUMN, SCREEN_ROW_LIMIT } from '../constants'
import type { Cell, TrackingReport, TrackingResult } from '../types'

function display(column: string, value: Cell): string {
  if (value == null) return ''
  if (typeof value === 'number' && MONEY_COLUMN.test(column)) return formatMoney(value)
  return formatDate(value)
}

/** Footer totals (desktop labels) and the result grid. */
export function TrackingResults({ result, report }: { result: TrackingResult; report: TrackingReport | undefined }) {
  const { totals } = result
  const title = report ? `${report.type}${report.selection ? ` - ${report.selection}` : ''}` : ''
  return (
    <>
      <p className={result.rows.length ? 'muted' : 'warning'} role="status">
        {result.rows.length === 0 ? 'No record found!' : `${title}: ${result.rows.length} row(s)`}
        {result.truncated && ` (first ${SCREEN_ROW_LIMIT.toLocaleString()} shown; Print to File exports every row)`}
      </p>
      <p>
        Principals {totals.principals.toLocaleString()} · Supplementaries {totals.supplementaries.toLocaleString()} · Total {totals.total.toLocaleString()} ·
        MCO {formatMoney(totals.mco)} · Premium {formatMoney(totals.premium)} · Access Fee {formatMoney(totals.accessFee)}
      </p>
      {result.rows.length > 0 && (
        <div className="table-wrap">
          <table className="grid">
            <thead><tr>{result.columns.map((c) => <th key={c} scope="col">{c}</th>)}</tr></thead>
            <tbody>
              {result.rows.map((row, index) => (
                // Report rows have no identity of their own and are never reordered, so the position is a stable key.
                <tr key={index}>
                  {result.columns.map((c) => <td key={c} className={typeof row[c] === 'number' ? 'num' : undefined}>{display(c, row[c])}</td>)}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  )
}
