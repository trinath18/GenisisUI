import { api, rethrowBlobError } from '../../../../api/client'
import { openBlob } from '../../../../lib/download'
import type { CardExport, LeafletCardCriteria, LeafletCardLookups, LeafletCardSearchResult } from '../types'

const BASE_URL = '/api/membership/leaflet-card'

/** Opens the PDF the server renders in a new tab (the desktop sent the Crystal report to the printer). */
async function openPdf(path: string, criteria: LeafletCardCriteria) {
  const response = await api.post(`${BASE_URL}/${path}`, criteria, { responseType: 'blob' }).catch(rethrowBlobError)
  openBlob(response.data as Blob)
}

export const leafletCardApi = {
  getLookups: async () => (await api.get<LeafletCardLookups>(`${BASE_URL}/lookups`)).data,
  search: async (criteria: LeafletCardCriteria) => (await api.post<LeafletCardSearchResult>(`${BASE_URL}/search`, criteria)).data,
  openLeaflets: (criteria: LeafletCardCriteria) => openPdf('leaflets', criteria),
  openCards: (criteria: LeafletCardCriteria) => openPdf('cards', criteria),
  getCardExport: async (criteria: LeafletCardCriteria) => (await api.post<CardExport>(`${BASE_URL}/card-export`, criteria)).data,
}

export const leafletCardKeys = {
  lookups: ['leaflet-card', 'lookups'] as const,
}
