import { api } from '../../../../api/client'

/** The registration request pre-filled from the previous membership (camelCase, ISO dates, nulls for empty values). */
export interface RenewalDraft {
  request: Record<string, unknown> & { coveredPersons: Record<string, unknown>[] }
  policyYear: number
  sourceHealthCode: string
}

export const tempRegistrationApi = {
  getDraft: async (previousMembershipNo: string) =>
    (await api.get<RenewalDraft>(`/api/membership/temp-registration/${encodeURIComponent(previousMembershipNo.trim())}`)).data,
}
