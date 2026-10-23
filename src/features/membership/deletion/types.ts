export interface DeletionOption {
  code: string
  name: string | null
}

export interface DeletionLookups {
  healthCodes: DeletionOption[]
  payors: DeletionOption[]
}

/** The form's criteria; dates are yyyy-mm-dd and only the chosen option's range is used. */
export interface DeletionCriteria {
  healthCode: string
  payorCode: string
  option: string
  bordxDateFrom: string | null
  bordxDateTo: string | null
  receiptDate: string | null
  batchNo: number | null
  numberFrom: string | null
  numberTo: string | null
}

export interface DeletionRow {
  membershipNo: string
  coverId: string
  name: string | null
  bordxDate: string | null
  batchNo: number | null
}

export interface DeletionListResult {
  message: string
  rows: DeletionRow[]
  totalPrincipal: number
  totalSupplementary: number
  memberships: number
  truncated: boolean
}

export interface DeletionResult {
  message: string
  totalPrincipal: number
  totalSupplementary: number
  memberships: number
}
