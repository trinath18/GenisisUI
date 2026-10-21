export interface BankPaymentRow {
  key: string
  payeeType: string
  pvNo: string
  pvDate: string | null
  creditDate: string | null
  payee: string | null
  bank: string | null
  accountMasked: string | null
  amount: number
  cases: number
  problem: string | null
}

/** Only payments with a usable bank account can be ticked; returns the accepted set and how many were refused. */
export function tickable(rows: BankPaymentRow[], next: ReadonlySet<string>): { accepted: Set<string>; refused: number } {
  const ok = new Set(rows.filter((r) => !r.problem).map((r) => r.key))
  const accepted = new Set([...next].filter((k) => ok.has(k)))
  return { accepted, refused: next.size - accepted.size }
}

/** Total of the ticked payments. */
export const tickedTotal = (rows: BankPaymentRow[], checked: ReadonlySet<string>) =>
  rows.filter((r) => checked.has(r.key)).reduce((sum, r) => sum + r.amount, 0)
