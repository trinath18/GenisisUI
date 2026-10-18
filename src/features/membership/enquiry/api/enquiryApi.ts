import { api } from '../../../../api/client'

export interface PolicyWordingList {
  wording: string | null
  files: string[]
  folderFound: boolean
}

const memberUrl = (membershipNo: string, suffix: string) => `/api/membership/${encodeURIComponent(membershipNo)}${suffix}`

export const enquiryApi = {
  getPolicyWording: async (membershipNo: string) => (await api.get<PolicyWordingList>(memberUrl(membershipNo, '/policy-wording'))).data,

  getPolicyWordingFile: async (membershipNo: string, fileName: string) =>
    (await api.get<Blob>(memberUrl(membershipNo, `/policy-wording/${encodeURIComponent(fileName)}`), { responseType: 'blob' })).data,
}

export const enquiryKeys = {
  policyWording: (membershipNo: string) => ['membership', membershipNo, 'policy-wording'] as const,
}
