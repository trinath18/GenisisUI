/** Filters of the desktop search frame; empty strings are not sent. Dates are yyyy-mm-dd. */
export interface CardControlSearch {
  payorCode: string
  numberFrom: string
  numberTo: string
  bordxDateFrom: string
  bordxDateTo: string
  batchFrom: string
  batchTo: string
  sentDateFrom: string
  sentDateTo: string
  sendingMode: string
}

export interface CardControlRow {
  membershipNo: string
  coverId: string
  name: string | null
  bordxDate: string | null
  batchNo: number | null
  sendingMode: string | null
  sentDate: string | null
  policyNo: string | null
  docReference: string | null
  groupCompany: string | null
  costCenter: string | null
  branch: string | null
  department: string | null
}

export interface CardControlSearchResult {
  rows: CardControlRow[]
  totalPrincipal: number
  totalSupplementary: number
  truncated: boolean
}

export interface CardControlItem {
  membershipNo: string
  coverId: string
}

export interface CardControlUpdate {
  sendingMode: string
  sentDate: string | null
  docReference: string
  items: CardControlItem[]
}

export interface CardControlUpdateResult {
  message: string
  updated: number
}
