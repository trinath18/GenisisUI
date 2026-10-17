import type { CodeOption } from '../../../components/common/CodeSelect'

/** "MBM Type" (API MemberTypeSelection). */
export const MemberType = { Both: 'B', Principal: 'P', Supplementary: 'S' } as const

export const MEMBER_TYPES: CodeOption[] = [
  { code: MemberType.Both, name: 'Both' },
  { code: MemberType.Principal, name: 'Principal' },
  { code: MemberType.Supplementary, name: 'Supplementary' },
]

/** "Principal Type" (API PrincipalTypeSelection). */
export const PrincipalType = { Both: 'Both', CombinedLimit: 'C', SeparateLimit: 'S' } as const

export const PRINCIPAL_TYPES: CodeOption[] = [
  { code: PrincipalType.Both, name: 'Both' },
  { code: PrincipalType.CombinedLimit, name: 'Combined Limit' },
  { code: PrincipalType.SeparateLimit, name: 'Separated Limit' },
]

/** Filter keys the screen treats specially. */
export const FieldKey = { Payor: 'payor', Health: 'health' } as const

/** Rows the server returns to the screen (API TrackingLimits.ScreenRows). */
export const SCREEN_ROW_LIMIT = 5000
export const META_STALE_MS = 10 * 60_000
export const EXPORT_FALLBACK_FILE_NAME = 'tracking.csv'

/** Columns shown as money (by name). */
export const MONEY_COLUMN = /(MCO|Prem|Fee|Amount|Paid|Amt|Gross|Net)/i
