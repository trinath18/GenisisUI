export interface VoucherRow {
  id: number
  pvNo: string | null
  pvDate: string | null
  amount: number | null
  chequeNo: string | null
  chequeDate: string | null
  status: string | null
  chequeStatus: string | null
  paymentMode: string | null
  payTo: string | null
  payeeBank: string | null
  payeeAccount: string | null
  caseNo: string | null
  claimVersion: string | null
  remark: string | null
  updatedBy: string | null
  updatedOn: string | null
  stoppedAs: string | null
  stoppedOn: string | null
  reissuedAs: string | null
}

/** Why a voucher cannot be stopped (cancel / expired); null when it can. Same rule as the API. */
export function stopProblem(v: Pick<VoucherRow, 'pvNo' | 'status' | 'amount' | 'stoppedAs'>): string | null {
  const status = v.status?.trim()
  if ((status !== 'A' && status !== 'R') || (v.amount ?? 0) <= 0) return `PV ${v.pvNo} is not an active payment, so it cannot be stopped.`
  if (v.stoppedAs?.trim()) return `PV ${v.pvNo} has already been stopped (${v.stoppedAs}).`
  return null
}

/** Why a voucher cannot be re-issued; null when it can. Same rule as the API. */
export function reissueProblem(v: Pick<VoucherRow, 'pvNo' | 'stoppedAs' | 'reissuedAs'>): string | null {
  if (!v.stoppedAs?.trim()) return `PV ${v.pvNo} has not been stopped. Cancel or expire it first.`
  if (v.reissuedAs?.trim()) return `PV ${v.pvNo} has already been re-issued as ${v.reissuedAs}.`
  return null
}

const STATUS_NAMES: Record<string, string> = { A: 'Active', C: 'Cancel', E: 'Expired', R: 'Reissue' }

/** "A - Active" style label of a PV status. */
export const statusLabel = (code: string | null | undefined) => (code ? `${code} - ${STATUS_NAMES[code.trim()] ?? code}` : '')
