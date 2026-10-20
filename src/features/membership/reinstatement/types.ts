/** genisis.Reinstatement_Load, as returned by GET /api/membership/reinstatement/{number}. */
export interface ReinstatementMember {
  membershipNo: string
  name: string | null
  policyNo: string | null
  status: string | null
  payorEffectiveDate: string | null
  payorExpiryDate: string | null
  finalExpiryDate: string | null
  insuredType: string | null
  planCode: string | null
  lapsedDate: string | null
}

export interface ReinstatementView {
  member: ReinstatementMember
  coveredCount: number
}

/** Dates as yyyy-mm-dd (input type="date"); empty means not entered. */
export interface ReinstatementRequest {
  endtBordxDate: string | null
  batchNo: string
  reinstateDate: string | null
  lapsedDate: string | null
  expiryDate: string | null
}

export interface ReinstatedCover {
  coverId: string
  mcoFee: number
  premium: number
}

export interface ReinstatementResult {
  message: string
  covers: ReinstatedCover[]
  warnings: string[]
}
