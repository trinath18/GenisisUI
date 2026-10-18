import { api, rethrowBlobError } from '../../../../api/client'
import { fileNameFromDisposition, saveBlob } from '../../../../lib/download'
import { ASCII_FALLBACK_FILE_NAME } from '../constants'
import type { AsciiRequest, AsciiResult, BordxLookups, BordxUploadOptions, UploadResult, VerifyResult } from '../types'

const BASE_URL = '/api/membership/bordx'
/** Large files are processed line by line on the server; no client-side timeout. */
const NO_TIMEOUT = 0

function formData(file: File, options: BordxUploadOptions): FormData {
  const data = new FormData()
  data.append('file', file)
  data.append('fileType', options.fileType)
  data.append('payorCode', options.payorCode)
  data.append('healthCode', options.healthCode)
  data.append('verifyIc', String(options.verifyIc))
  data.append('labelPrinted', String(options.labelPrinted))
  data.append('backToBack', String(options.backToBack))
  return data
}

export const bordxApi = {
  getLookups: async () => (await api.get<BordxLookups>(`${BASE_URL}/lookups`)).data,

  verify: async (file: File, options: BordxUploadOptions, signal: AbortSignal) =>
    (await api.post<VerifyResult>(`${BASE_URL}/verify`, formData(file, options), { signal, timeout: NO_TIMEOUT })).data,

  upload: async (file: File, options: BordxUploadOptions, signal: AbortSignal) =>
    (await api.post<UploadResult>(`${BASE_URL}/upload`, formData(file, options), { signal, timeout: NO_TIMEOUT })).data,

  /** Generates the ASCII file and saves it in the browser. */
  exportAscii: async (request: AsciiRequest): Promise<AsciiResult> => {
    const response = await api.post(`${BASE_URL}/ascii`, request, { responseType: 'blob' }).catch(rethrowBlobError)
    const fileName = fileNameFromDisposition(response.headers['content-disposition'], ASCII_FALLBACK_FILE_NAME)
    saveBlob(response.data as Blob, fileName)
    return { fileName, principals: response.headers['x-total-principals'], supplementaries: response.headers['x-total-supplementaries'] }
  },
}

export const bordxKeys = {
  lookups: ['bordx', 'lookups'] as const,
}
