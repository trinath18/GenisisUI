import type { CodeName, ReceiptRow } from '../receiptEnquiry/types'

export type { CodeName, ReceiptRow }

export interface InvoiceReceiptLookups {
  receiptTypes: CodeName[]
  prefixes: CodeName[]
  payors: CodeName[]
  defaultPrefix: string
}

/** A member MCO invoice with what has been received against it. */
export interface OutstandingInvoice {
  invoiceNo: string
  invoiceDate: string | null
  members: number
  billAmount: number
  payor: string | null
  receipts: number
  received: number
  outstanding: number
}

export interface InvoiceSearchResult {
  rows: OutstandingInvoice[]
  totalOutstanding: number
  truncated: boolean
}

export interface InvoiceSearch {
  invoiceNoFrom?: string
  invoiceNoTo?: string
  invoiceDateFrom?: string
  invoiceDateTo?: string
  payor?: string
  outstandingOnly: boolean
  /** Short Payment Receipt: part-paid invoices with a balance left. */
  partPaidOnly?: boolean
}

export interface InvoiceReceiptRequest {
  invoiceNo: string
  receiptType: string
  receiptDate: string | null
  amount: number | null
  chequeNo: string
  payor: string
  description: string
  prefix?: string
  receiptNo?: string
}

export interface InvoiceReceiptResult {
  id: number
  receiptNo: string
  message: string
}
