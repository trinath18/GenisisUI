import { useCallback, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { api, loadSession, saveSession } from '../api/client'
import type { Session } from '../api/client'
import { MustChangePasswordError } from './access'
import { AuthContext } from './context'
import type { AuthState } from './context'

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(loadSession)

  const apply = useCallback((s: Session | null) => {
    saveSession(s)
    setSession(s)
  }, [])

  const login = useCallback(
    async (userCode: string, password: string) => {
      try {
        const { data } = await api.post<Session>('/api/auth/login', { userCode, password })
        apply(data)
      } catch (error) {
        const data = (error as { response?: { data?: { mustChangePassword?: boolean; message?: string } } }).response?.data
        if (data?.mustChangePassword) throw new MustChangePasswordError(data.message)
        throw error
      }
    },
    [apply],
  )

  const changePassword = useCallback(
    async (userCode: string, password: string, newPassword: string) => {
      const { data } = await api.post<Session>('/api/auth/change-password', { userCode, password, newPassword })
      apply(data)
    },
    [apply],
  )

  const value = useMemo<AuthState>(
    () => ({
      session,
      login,
      changePassword,
      logout: () => apply(null),
      hasAccess: (position) => session?.user.access.charAt(position - 1) === '1',
    }),
    [session, login, changePassword, apply],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
