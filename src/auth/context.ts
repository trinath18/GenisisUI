import { createContext } from 'react'
import type { Session } from '../api/client'

export interface AuthState {
  session: Session | null
  login: (userCode: string, password: string) => Promise<void>
  changePassword: (userCode: string, password: string, newPassword: string) => Promise<void>
  logout: () => void
  hasAccess: (position: number) => boolean
}

export const AuthContext = createContext<AuthState | null>(null)
