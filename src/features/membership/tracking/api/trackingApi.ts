import { api, rethrowBlobError } from '../../../../api/client'
import { fileNameFromDisposition, saveBlob } from '../../../../lib/download'
import { EXPORT_FALLBACK_FILE_NAME } from '../constants'
import type { TrackingMeta, TrackingRequest, TrackingResult } from '../types'

const BASE_URL = '/api/membership/tracking'
/** Reports can take minutes on the full membership table; the server enforces its own timeout. */
const NO_TIMEOUT = 0

export const trackingApi = {
  getMeta: async () => (await api.get<TrackingMeta>(`${BASE_URL}/meta`)).data,

  run: async (request: TrackingRequest, signal: AbortSignal) =>
    (await api.post<TrackingResult>(`${BASE_URL}/run`, request, { signal, timeout: NO_TIMEOUT })).data,

  /** Every row as CSV, saved in the browser (Print to File). */
  exportCsv: async (request: TrackingRequest) => {
    const response = await api.post(`${BASE_URL}/export`, request, { responseType: 'blob', timeout: NO_TIMEOUT }).catch(rethrowBlobError)
    saveBlob(response.data as Blob, fileNameFromDisposition(response.headers['content-disposition'], EXPORT_FALLBACK_FILE_NAME))
  },
}

export const trackingKeys = {
  meta: ['tracking', 'meta'] as const,
}
