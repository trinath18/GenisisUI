import type { CodeOption } from '../../../components/common/CodeSelect'

export interface BordxLookups {
  healthCodes: CodeOption[]
  payors: CodeOption[]
  planFilters: string[]
}

export interface BordxError {
  line: number
  policyNo: string
  name: string
  message: string
  fileName: string
}

export interface VerifyResult {
  submissionDate: string | null
  totalPrincipal: number
  totalSupplementary: number
  errors: BordxError[]
}

export interface UploadResult {
  message: string
  batchNo: number | null
  newMembers: number
  supplementaries: number
  cancelled: number
  reinstated: number
  membershipNumbers: string[]
  warnings: string[]
}

/** Screen options sent with the file. */
export interface BordxUploadOptions {
  fileType: string
  payorCode: string
  healthCode: string
  verifyIc: boolean
  labelPrinted: boolean
  backToBack: boolean
}

export interface AsciiRequest {
  healthCode: string | null
  payorCode: string | null
  version: string | null
  exportOption: string | null
  bordxFrom: string | null
  bordxTo: string | null
  receiptDate: string | null
  batchNo: number | null
  plan: string | null
}

export interface AsciiResult {
  fileName: string
  principals: string | undefined
  supplementaries: string | undefined
}
