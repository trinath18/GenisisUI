export interface CodeName {
  code: string
  name: string | null
}

export interface LeafletCardLookups {
  healthCodes: CodeName[]
  payors: CodeName[]
}

/** Dates are yyyy-mm-dd. */
export interface LeafletCardCriteria {
  bordxDateFrom: string | null
  bordxDateTo: string | null
  payorCode: string
  batchNo: number | null
  healthCode: string
}

export interface LeafletCardRow {
  payorCode: string
  membershipNo: string
  bordxDate: string | null
  policyNo: string | null
  healthCode: string | null
  batchNo: number | null
  name: string | null
}

export interface LeafletCardSearchResult {
  rows: LeafletCardRow[]
  truncated: boolean
}

export interface MembershipCard {
  membershipNo: string
  coverId: string
  cardNumber: string
  name: string | null
  icBcPp: string | null
  policyNo: string | null
  planCode: string | null
  expiryDate: string | null
}

export interface CardExport {
  payorName: string
  bordxDate: string
  fileName: string
  cards: MembershipCard[]
}
