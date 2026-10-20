import { api } from '../../../../api/client'
import type { ReinstatementRequest, ReinstatementResult, ReinstatementView } from '../types'

const BASE_URL = '/api/membership/reinstatement'
const memberUrl = (membershipNo: string) => `${BASE_URL}/${encodeURIComponent(membershipNo.trim())}`

export const reinstatementApi = {
  get: async (membershipNo: string) => (await api.get<ReinstatementView>(memberUrl(membershipNo))).data,

  reinstate: async (membershipNo: string, body: ReinstatementRequest) => (await api.post<ReinstatementResult>(memberUrl(membershipNo), body)).data,
}

export const reinstatementKeys = {
  member: (membershipNo: string | null) => ['reinstatement', membershipNo] as const,
}
