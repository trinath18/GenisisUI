import { api } from '../../../../api/client'
import type { McoPendingSearch, McoPendingSearchResult, McoPendingUpdate, McoPendingUpdateResult } from '../types'

const BASE_URL = '/api/membership/mco-pending'

/** Only the filters that were filled in. */
function searchParams(search: McoPendingSearch): Record<string, string> {
  return Object.fromEntries(Object.entries(search).filter(([, value]) => value.trim() !== '').map(([key, value]) => [key, value.trim()]))
}

export const mcoPendingApi = {
  search: async (search: McoPendingSearch) => (await api.get<McoPendingSearchResult>(BASE_URL, { params: searchParams(search) })).data,

  update: async (body: McoPendingUpdate) => (await api.post<McoPendingUpdateResult>(BASE_URL, body)).data,
}

export const mcoPendingKeys = {
  search: (search: McoPendingSearch | null) => ['mco-pending', search] as const,
}
