import axios, { AxiosError } from 'axios'

const SESSION_KEY = 'genisis.session'

export interface SessionUser {
  userCode: string
  userName: string
  access: string
}

export interface Session {
  token: string
  expiresUtc: string
  user: SessionUser
}

export function loadSession(): Session | null {
  const raw = localStorage.getItem(SESSION_KEY)
  if (!raw) return null
  try {
    const session = JSON.parse(raw) as Session
    return new Date(session.expiresUtc) > new Date() ? session : null
  } catch {
    return null
  }
}

export function saveSession(session: Session | null) {
  if (session) localStorage.setItem(SESSION_KEY, JSON.stringify(session))
  else localStorage.removeItem(SESSION_KEY)
}

export const api = axios.create({ baseURL: import.meta.env.VITE_API_URL ?? '' })

api.interceptors.request.use((config) => {
  const session = loadSession()
  if (session) config.headers.Authorization = `Bearer ${session.token}`
  return config
})

api.interceptors.response.use(undefined, (error: AxiosError) => {
  if (error.response?.status === 401 && !error.config?.url?.includes('/api/auth/')) {
    saveSession(null)
    window.location.assign('/login')
  }
  return Promise.reject(error)
})

export function errorMessage(error: unknown): string {
  if (error instanceof AxiosError) {
    const data = error.response?.data as { message?: string; title?: string } | undefined
    if (data?.message) return data.message
    if (data?.title) return data.title
    if (!error.response) return 'Cannot reach the Genisis API. Is it running?'
  }
  return error instanceof Error ? error.message : 'Unexpected error'
}
