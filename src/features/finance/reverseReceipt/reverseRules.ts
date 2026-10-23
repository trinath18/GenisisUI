import type { ReceiptRow } from '../receiptEnquiry/types'

/** The checks on the receipt itself (the API repeats them); null when it can be reversed. */
export function reverseProblem(receipt: Pick<ReceiptRow, 'receiptNo' | 'amount' | 'isReversal' | 'reversedBy'>): string | null {
  const no = receipt.receiptNo?.trim() ?? ''
  if (!no) return 'A receipt without a receipt number cannot be reversed.'
  if (receipt.isReversal || (receipt.amount ?? 0) <= 0) return `Receipt ${no} is a reversal or has no positive amount, so it cannot be reversed.`
  if (receipt.reversedBy?.trim()) return `Receipt ${no} has already been reversed by ${receipt.reversedBy}.`
  return null
}

/** The reversal form's checks, in order. */
export function reversalProblem(input: { reversalDate: string; accPeriod: string }): string | null {
  if (!input.reversalDate) return 'Please Enter Reversal Date'
  if (!input.accPeriod.trim()) return 'Please Keyin for Accounting Period ! '
  if (!/^(0[1-9]|1[0-2])\/\d{4}$/.test(input.accPeriod.trim())) return 'Select a valid accounting period.'
  return null
}

/** The current month as "MM/YYYY" (the reversal's default accounting period). */
export const currentPeriod = (now = new Date()) => `${String(now.getMonth() + 1).padStart(2, '0')}/${now.getFullYear()}`
