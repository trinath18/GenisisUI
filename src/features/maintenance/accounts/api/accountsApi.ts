import { api } from '../../../../api/client'

export type ScheduleDirection = 'next' | 'prev' | 'find'

/** Maintenance > Accounts endpoint: next / previous OPCS code, or the first at or after a code. */
export const accountsApi = {
  moveSchedule: async <T>(code: string | null, direction: ScheduleDirection) =>
    (await api.get<{ row: T | null; message: string | null }>('/api/maintenance/accounts/schedule', { params: { code: code || undefined, direction } })).data,
}
