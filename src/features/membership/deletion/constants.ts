/** Desktop cboDeleteOption. */
export const DELETE_OPTIONS = [
  { code: 'D', name: 'D - Bordx Date' },
  { code: 'B', name: 'B - Batch' },
  { code: 'M', name: 'M - Membership' },
] as const

export const DELETE_OPTION = { bordxDate: 'D', batch: 'B', membership: 'M' } as const

export const LIST_LIMIT = 5000
export const LOOKUPS_STALE_MS = 10 * 60 * 1000

export const confirmDeleteMessage = (memberships: number, principals: number, supplementaries: number) =>
  `Are you sure? This archives and permanently deletes ${memberships} membership(s) (${principals} principal, ${supplementaries} supplementary) ` +
  'from MBM, MBMOthers and MBMCoveredPersons.'
