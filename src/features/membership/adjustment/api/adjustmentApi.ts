import { api } from '../../../../api/client'
import type { AdjustmentLookups, FormRow, LoadedMembership, Option, Recalculation, SaveRequest, SaveResult, SupplementaryExpiry } from '../types'

const BASE_URL = '/api/membership/adjustment'
const memberUrl = (membershipNo: string, suffix = '') => `${BASE_URL}/${encodeURIComponent(membershipNo)}${suffix}`

export const adjustmentApi = {
  getLookups: async () => (await api.get<AdjustmentLookups>(`${BASE_URL}/lookups`)).data,

  getPlans: async (healthCode: string, payorCode: string) =>
    (await api.get<Option[]>(`${BASE_URL}/plans`, { params: { healthCode, payorCode } })).data,

  search: async (q: string, by: string) => (await api.get<FormRow[]>(`${BASE_URL}/search`, { params: { q, by } })).data,

  navigate: async (from: string, direction: 'next' | 'prev') =>
    (await api.get<{ membershipNo: string }>(`${BASE_URL}/navigate`, { params: { from, direction } })).data,

  load: async (membershipNo: string) => (await api.get<LoadedMembership>(memberUrl(membershipNo))).data,

  getFees: async (membershipNo: string) => (await api.get<FormRow[]>(memberUrl(membershipNo, '/fees'))).data,

  getHistory: async (membershipNo: string) => (await api.get<FormRow[]>(memberUrl(membershipNo, '/history'))).data,

  getMemberHistory: async (membershipNo: string) => (await api.get<FormRow[]>(memberUrl(membershipNo, '/member-history'))).data,

  getLastBatch: async (bordxDate: string, payorCode: string | undefined) =>
    (await api.get<{ lastBatch: number }>(`${BASE_URL}/last-batch`, { params: { bordxDate, payorCode } })).data,

  checkPolicy: async (policyNo: string, membershipNo: string) =>
    (await api.get<{ duplicateOf: string | null }>(`${BASE_URL}/policy-check`, { params: { policyNo, number: membershipNo } })).data,

  recalculate: async (membershipNo: string, body: { planCode: string | null; payorEffectiveDate: string | null; payorExpiryDate: string | null; dateOfBirth: string | null; sex: string | null }) =>
    (await api.post<Recalculation>(memberUrl(membershipNo, '/recalculate'), body)).data,

  getSupplementaryExpiry: async (body: { dateOfBirth: string; planCode: string; effectiveDate: string; expiryDate: string }) =>
    (await api.post<SupplementaryExpiry>(`${BASE_URL}/supplementary-expiry`, body)).data,

  save: async (membershipNo: string, body: SaveRequest) => (await api.post<SaveResult>(memberUrl(membershipNo), body)).data,
}

/** React Query keys of the Adjustment screen. */
export const adjustmentKeys = {
  lookups: ['adjustment', 'lookups'] as const,
  member: (membershipNo: string | null) => ['adjustment', 'member', membershipNo] as const,
  plans: (healthCode: unknown, payorCode: unknown) => ['adjustment', 'plans', healthCode, payorCode] as const,
  search: (by: string, q: string | null) => ['adjustment', 'search', by, q] as const,
  lastBatch: (bordxDate: string, payorCode: unknown) => ['adjustment', 'last-batch', bordxDate, payorCode] as const,
  fees: (membershipNo: string | null) => ['adjustment', 'fees', membershipNo] as const,
  history: (membershipNo: string | null) => ['adjustment', 'history', membershipNo] as const,
  memberHistory: (membershipNo: string | null) => ['adjustment', 'member-history', membershipNo] as const,
  /** Everything that changes after a save. */
  afterSave: ['adjustment'] as const,
}
