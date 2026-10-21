export interface CodeName {
  code: string
  name: string
}

export interface ReceiptEnquiryLookups {
  receiptTypes: CodeName[]
  payors: CodeName[]
  postedStatuses: CodeName[]
}

/** One receipt (ReceiptSummary). */
export interface ReceiptRow {
  id: number
  receiptNo: string | null
  receiptDate: string | null
  amount: number | null
  receiptType: string | null
  description: string | null
  chequeNo: string | null
  payor: string | null
  batchNo: string | null
  posted: boolean
  postDate: string | null
  postUser: string | null
  allocationLines: number
  allocated: number | null
  /** The receipt that reversed this one (Reverse Receipt). */
  reversedBy: string | null
  /** True when this receipt is itself a reversal. */
  isReversal: boolean
}

export interface ReceiptSearchResult {
  rows: ReceiptRow[]
  total: number
  truncated: boolean
}

export interface ReceiptAllocation {
  id: number
  caseNo: string | null
  claimVersion: string | null
  bordxNo: string | null
  allocated: number | null
  receiptAmount: number | null
  bankCharge: number | null
  chequeNo: string | null
  accPeriod: string | null
  remark: string | null
  updatedBy: string | null
  updatedOn: string | null
}

export interface ReceiptInvoice {
  invoiceNo: string | null
  invoiceDate: string | null
  members: number
  billAmount: number | null
  gstAmount: number | null
}

export interface ReceiptPosting {
  postType: string | null
  batchNo: string | null
  postDate: string | null
  postBy: string | null
  accPeriod: string | null
  rows: number
}

export interface ReceiptDetail {
  receipt: ReceiptRow
  allocations: ReceiptAllocation[]
  invoices: ReceiptInvoice[]
  postings: ReceiptPosting[]
  unallocated: number | null
}

/** Query parameters of GET /api/finance/receipt-enquiry/search (ISO dates; blank = no criterion). */
export interface ReceiptSearch {
  receiptNoFrom?: string
  receiptNoTo?: string
  receiptDateFrom?: string
  receiptDateTo?: string
  receiptType?: string
  payor?: string
  chequeNo?: string
  batchNo?: string
  posted?: string
  description?: string
  caseNo?: string
}
