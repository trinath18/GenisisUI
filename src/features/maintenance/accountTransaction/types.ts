/** The desktop's Criteria frame; empty strings are not sent. */
export interface AccountTransactionQuery {
  bodyPart: string
  opcs: string
  procedure: string
  surgeonCategory: string
  anaesthetistCategory: string
  part: string
  pageFrom: string
  pageTo: string
  cptCode: string
  cptDescription: string
}

export interface AccountTransactionRow {
  bodyPart: string | null
  opcs: string | null
  procedureDescription: string | null
  surgeonCategory: string | null
  anaesthetistCategory: string | null
  part: string | null
  page: string | null
  surgeonFee: number | null
  anaesthetistFee: number | null
  partACost: string | null
  cptCode: string | null
  cptDescription: string | null
}

export interface AccountTransactionResult {
  rows: AccountTransactionRow[]
  truncated: boolean
}
