import { api } from '../../../../api/client'
import type { CardControlSearch, CardControlSearchResult, CardControlUpdate, CardControlUpdateResult } from '../types'

const BASE_URL = '/api/membership/card-control'

/** Only the filters that were filled in. */
function searchParams(search: CardControlSearch): Record<string, string> {
  return Object.fromEntries(Object.entries(search).filter(([, value]) => value.trim() !== '').map(([key, value]) => [key, value.trim()]))
}

export const cardControlApi = {
  search: async (search: CardControlSearch) => (await api.get<CardControlSearchResult>(BASE_URL, { params: searchParams(search) })).data,

  update: async (body: CardControlUpdate) => (await api.post<CardControlUpdateResult>(BASE_URL, body)).data,
}

export const cardControlKeys = {
  search: (search: CardControlSearch | null) => ['card-control', search] as const,
}
