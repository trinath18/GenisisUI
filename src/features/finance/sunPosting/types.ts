export interface CodeName {
  code: string
  name: string
}

export type SearchMode = 'all' | 'credit' | 'debit'
export type PostType = 'P' | 'N'

export interface SunPostingLookups {
  healthTypes: CodeName[]
  payors: CodeName[]
  accountingPeriods: CodeName[]
  postStatuses: CodeName[]
  bordxStatuses: CodeName[]
  postTypes: CodeName[]
  /** "Posting is ended at ..." while the posting window is closed for the user; null when open. */
  postingClosedMessage: string | null
}

/** One SUN journal line (a row of lstMBMInvList / lstMBMInvCDList). */
export interface JournalLine {
  status: string
  journalType: string
  journalSource: string
  database: string
  transRef: string
  accPeriod: string | null
  transDate: string | null
  description: string
  accCode: string
  amount: number
  debitCredit: string
  hospital: string
  groupCompany: string | null
  payor: string | null
  caseNo: string
  productCategory: string | null
  bordxRef: string | null
  batchNo: string | null
  index: string | null
  invoiceCaseNo: string
  invoiceVersion: string
}

export interface SunPostingSearchResult {
  lines: JournalLine[]
  invoices: number
  debitTotal: number
  creditTotal: number
  posted: boolean
  truncated: boolean
}

/** Query parameters of GET /api/finance/sun-posting/search (ISO dates, blank = no criterion). */
export interface SunPostingSearch {
  mode: SearchMode
  healthType?: string
  payor?: string
  invoiceDateFrom?: string
  invoiceDateTo?: string
  caseNoFrom?: string
  caseNoTo?: string
  postStatus?: string
  postDateFrom?: string
  postDateTo?: string
  bordxStatus?: string
  batchNoFrom?: string
  batchNoTo?: string
  bordxDateFrom?: string
  bordxDateTo?: string
  postType: PostType
}

export interface SunPostRequest {
  accPeriod: string
  postType: PostType
  invoiceDateTo: string | null
  bordxStatus: string
  items: { caseNo: string; claimVersion: string }[]
}

export interface SunPostResult {
  batchNo: string
  posted: number
  message: string
  journal: SunPostingSearchResult
}
