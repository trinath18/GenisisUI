import { api, rethrowBlobError } from '../../../../api/client'
import { fileNameFromDisposition, saveBlob } from '../../../../lib/download'
import { ASCII_FALLBACK_FILE_NAME } from '../constants'
import type { PlutoAsciiRequest, PlutoAsciiResult, PlutoPayor, PlutoUploadResult } from '../types'

const BASE_URL = '/api/membership/pluto'
/** Large workbooks are inserted row by row on the server; no client-side timeout. */
const NO_TIMEOUT = 0

export const plutoApi = {
  getPayors: async (healthCode: string) => (await api.get<PlutoPayor[]>(`${BASE_URL}/payors`, { params: { healthCode } })).data,

  upload: async (file: File) => {
    const data = new FormData()
    data.append('file', file)
    return (await api.post<PlutoUploadResult>(`${BASE_URL}/upload`, data, { timeout: NO_TIMEOUT })).data
  },

  /** Generates the ASCII file and saves it in the browser (the desktop wrote it to \\Mars\Membership\Bor_in\Temp). */
  exportAscii: async (request: PlutoAsciiRequest): Promise<PlutoAsciiResult> => {
    const response = await api.post(`${BASE_URL}/ascii`, request, { responseType: 'blob' }).catch(rethrowBlobError)
    const fileName = fileNameFromDisposition(response.headers['content-disposition'], ASCII_FALLBACK_FILE_NAME)
    saveBlob(response.data as Blob, fileName)
    return { fileName, principals: response.headers['x-total-principals'], supplementaries: response.headers['x-total-supplementaries'] }
  },
}

export const plutoKeys = {
  payors: (healthCode: string) => ['pluto', 'payors', healthCode] as const,
}
