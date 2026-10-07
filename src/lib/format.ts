export type Row = Record<string, unknown>

const ISO_DATE = /^\d{4}-\d{2}-\d{2}T/

export function formatDate(value: unknown): string {
  if (typeof value !== 'string' || !ISO_DATE.test(value)) return value == null ? '' : String(value)
  const [y, m, d] = value.slice(0, 10).split('-')
  return `${d}/${m}/${y}`
}

export function formatMoney(value: unknown): string {
  if (value == null || value === '') return ''
  const n = Number(value)
  return Number.isNaN(n) ? String(value) : n.toLocaleString('en-MY', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

export function formatValue(value: unknown): string {
  if (value == null) return ''
  if (typeof value === 'boolean') return value ? 'Yes' : 'No'
  if (typeof value === 'string' && ISO_DATE.test(value)) return formatDate(value)
  return String(value)
}
