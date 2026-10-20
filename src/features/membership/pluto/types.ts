export interface PlutoUploadResult {
  message: string
  rows: number
}

export interface PlutoPayor {
  code: string
  name: string | null
}

export interface PlutoAsciiRequest {
  healthCode: string
  payorCode: string
  /** yyyy-mm-dd. */
  bordxDate: string
}

export interface PlutoAsciiResult {
  fileName: string
  principals: string | undefined
  supplementaries: string | undefined
}
