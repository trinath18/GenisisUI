import { api } from '../../../../api/client'
import type { DeletionCriteria, DeletionListResult, DeletionLookups, DeletionResult } from '../types'

const BASE_URL = '/api/membership/deletion'

export const deletionApi = {
  getLookups: async () => (await api.get<DeletionLookups>(`${BASE_URL}/lookups`)).data,

  list: async (criteria: DeletionCriteria) => (await api.post<DeletionListResult>(`${BASE_URL}/list`, criteria)).data,

  delete: async (criteria: DeletionCriteria) => (await api.post<DeletionResult>(`${BASE_URL}/delete`, criteria)).data,
}

export const deletionKeys = {
  lookups: ['deletion', 'lookups'] as const,
}
