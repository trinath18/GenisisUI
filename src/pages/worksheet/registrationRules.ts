// Worksheet > Worksheet Registration, calculation step: types of the server's calculation and the small pure rules the page uses to show it
// beside what the desktop saved.

import { formatMoney } from '../../lib/format'

export interface CalculationLine {
  slot: number
  category: string | null
  benefit: string
  limit: string | null
  savedLimit: string | null
  actual: number
  approved: number
  toHospital: number
  toMember: number
}

export interface CalculationSummary {
  sumApproved: number
  coPayment: number
  limitExceeded: number
  totalApproved: number
  previousBalance: number | null
}

export interface CalculationResult {
  caseNo: string
  version: number
  versions: number[]
  roomDays: number
  icuDays: number
  lines: CalculationLine[]
  calculated: CalculationSummary | null
  saved: CalculationSummary | null
  notes: string[]
}

const FULL = 'FULL'

const amount = (text: string | null | undefined): number | null => {
  const n = Number((text ?? '').replace(/,/g, '').trim())
  return text != null && text.trim() !== '' && Number.isFinite(n) ? n : null
}

/**
 * Whether two limits have the same effect on what is approved: FULL lets everything through, an amount caps, and anything else (a dash, empty) approves nothing, like 0.00.
 * The desktop saves "0.00" or "-" for a row the plan does not cover; they approve the same.
 */
export function sameEffect(a: string | null | undefined, b: string | null | undefined): boolean {
  const effect = (t: string | null | undefined) => (t?.trim().toUpperCase() === FULL ? FULL : (amount(t) ?? 0))
  return effect(a) === effect(b)
}

/** A row whose limit from the plan has a different effect from the limit the desktop saved (only when the version has saved limits and the row has an amount). */
export const limitDiffers = (line: CalculationLine): boolean => line.actual !== 0 && line.savedLimit != null && !sameEffect(line.limit, line.savedLimit)

/** The rows that differ, for the count shown above the grid. */
export const differingRows = (lines: readonly CalculationLine[]): CalculationLine[] => lines.filter(limitDiffers)

export interface SummaryRow {
  label: string
  calculated: string
  saved: string
  differs: boolean
}

const cents = (v: number | null | undefined) => Math.round((v ?? 0) * 100)

/** The summary rows, calculated beside saved, with whether the two differ by a cent or more (a saved figure is only compared when there is one). */
export function summaryRows(calculated: CalculationSummary | null, saved: CalculationSummary | null): SummaryRow[] {
  if (!calculated) return []
  const row = (label: string, calc: number | null, save: number | null | undefined): SummaryRow => ({
    label,
    calculated: calc == null ? '' : formatMoney(calc),
    saved: save == null ? '' : formatMoney(save),
    differs: saved != null && save != null && calc != null && cents(calc) !== cents(save),
  })
  return [
    { label: 'Sum of approved', calculated: formatMoney(calculated.sumApproved), saved: '', differs: false },
    row('Co-payment', calculated.coPayment, saved?.coPayment),
    row('Limit exceeded', calculated.limitExceeded, saved?.limitExceeded),
    row('Total approved', calculated.totalApproved, saved?.totalApproved),
    row('Limit before the worksheet', calculated.previousBalance, saved?.previousBalance),
  ]
}

/** Days as the worksheet shows them: whole numbers without decimals, half days with one. */
export const daysText = (days: number): string => (Number.isInteger(days) ? String(days) : days.toFixed(1))
