import type { ReactNode } from 'react'
import { useAuth } from '../auth/access'
import { ThemeProvider } from './ThemeProvider'

/** The theme of the signed-in user (the browser's last choice before sign-in). */
export function UserTheme({ children }: { children: ReactNode }) {
  const { session } = useAuth()
  return <ThemeProvider user={session?.user.userCode ?? null}>{children}</ThemeProvider>
}
