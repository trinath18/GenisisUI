import { useContext } from 'react'
import { AuthContext } from './context'

/** Menu access positions in USR.USRAccess (VB6 CheckAccess). */
export const Access = {
  MembershipRegistration: 1,
  MembershipAdjustment: 2,
  MembershipEnquiry: 3,
  // Maintenance > Plan shares position 1 with Registration in the desktop menu.
  PlanMaintenance: 1,
} as const

export class MustChangePasswordError extends Error {}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider')
  return ctx
}
