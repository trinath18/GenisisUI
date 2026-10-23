import { api, rethrowBlobError } from '../../../../api/client'
import { fileNameFromDisposition } from '../../../../lib/download'
import type { PostType, SunPostingLookups, SunPostingSearch, SunPostingSearchResult, SunPostRequest, SunPostResult } from '../types'

const BASE_URL = '/api/finance/sun-posting'

/** Only the criteria that were filled in. */
function params(search: SunPostingSearch): Record<string, string> {
  return Object.fromEntries(
    Object.entries(search)
      .filter(([, value]) => value !== undefined && String(value).trim() !== '')
      .map(([key, value]) => [key, String(value).trim()]),
  )
}

export const sunPostingApi = {
  lookups: async () => (await api.get<SunPostingLookups>(`${BASE_URL}/lookups`)).data,

  search: async (search: SunPostingSearch) => (await api.get<SunPostingSearchResult>(`${BASE_URL}/search`, { params: params(search) })).data,

  post: async (body: SunPostRequest) => (await api.post<SunPostResult>(`${BASE_URL}/post`, body)).data,

  /** The journal file of a posted batch (CSV); without a post type the API reads it from the batch's amounts. */
  journal: async (batchNo: string, postType?: PostType, fileDate?: string) => {
    try {
      const response = await api.get<Blob>(`${BASE_URL}/journal`, { params: { batchNo, postType, fileDate }, responseType: 'blob' })
      return { blob: response.data, fileName: fileNameFromDisposition(response.headers['content-disposition'], `${batchNo} journal.csv`) }
    } catch (error) {
      return rethrowBlobError(error)
    }
  },
}
