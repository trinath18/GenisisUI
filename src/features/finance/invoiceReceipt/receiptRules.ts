import type { OutstandingInvoice } from './types'

/** The receipt form's starting values for an invoice: the balance (when above zero), a transfer, the invoice's payor and number. */
export function receiptDefaults(invoice: OutstandingInvoice, today: string) {
  return {
    receiptType: 'IPFEE',
    receiptDate: today,
    amount: invoice.outstanding > 0 ? invoice.outstanding.toFixed(2) : '',
    chequeNo: 'ONLINE',
    payor: invoice.payor ?? '',
    description: invoice.invoiceNo,
  }
}

/** CmdSave_Click's screen checks, in the desktop's order (the API repeats them). */
export function receiptProblem(input: {
  manual: boolean
  receiptNo: string
  invoiceNo: string
  receiptType: string
  receiptDate: string
  amount: string
}): string | null {
  if (input.manual && !input.receiptNo.trim()) return 'Please Enter Receipt No'
  if (!input.invoiceNo) return 'Please select the invoice'
  if (!input.receiptType) return 'Please Enter Rec. Type'
  if (!input.receiptDate) return 'Please Enter Receipt Date'
  if (!input.amount.trim()) return 'Please Enter Receipt Amount'
  if (Number(input.amount) === 0) return 'Receipt Amount cannot be zero.'
  return null
}

/** A warning (not a block) when the receipt is more than the balance: the data shows over-payments, so they are allowed. */
export function overpaymentWarning(invoice: OutstandingInvoice, amount: number): string | null {
  if (invoice.outstanding <= 0) return `Invoice ${invoice.invoiceNo} has no outstanding balance (${invoice.outstanding.toFixed(2)}). Save the receipt anyway?`
  return amount > invoice.outstanding ? `The amount is more than the outstanding balance (${invoice.outstanding.toFixed(2)}). Save it anyway?` : null
}
