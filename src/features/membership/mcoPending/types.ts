export interface McoPendingSearch {
  numberFrom: string
  numberTo: string
  /** yyyy-mm-dd; empty means no filter. */
  bordxDateFrom: string
  bordxDateTo: string
  status: string
}

export interface McoPendingRow {
  membershipNo: string
  bordxDate: string | null
  newBordxDate: string | null
  status: string | null
}

export interface McoPendingSearchResult {
  rows: McoPendingRow[]
  truncated: boolean
}

export interface McoPendingUpdate {
  status: string
  membershipNos: string[]
}

export interface McoPendingUpdateResult {
  message: string
  updated: number
}
