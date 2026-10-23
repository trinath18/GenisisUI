import { api } from '../../../../api/client'
import type { Department, PermissionUserRequest, RoleUserRequest, SecurityLookups, UserDetail, UserSummary } from '../types'

const BASE_URL = '/api/maintenance/security'
const enc = encodeURIComponent

/** Empty strings become null so optional fields (password, date) are omitted rather than sent blank. */
function body<T extends object>(request: T) {
  return Object.fromEntries(Object.entries(request).map(([k, v]) => [k, typeof v === 'string' && v.trim() === '' ? null : v]))
}

export const securityApi = {
  departments: async () => (await api.get<Department[]>(`${BASE_URL}/departments`)).data,
  createDepartment: (code: string, description: string) => api.post(`${BASE_URL}/departments`, { code, description }),
  updateDepartment: (code: string, description: string) => api.put(`${BASE_URL}/departments/${enc(code)}`, { code, description }),
  deleteDepartment: (code: string) => api.delete(`${BASE_URL}/departments/${enc(code)}`),

  users: async (search: string) => (await api.get<UserSummary[]>(`${BASE_URL}/users`, { params: search.trim() ? { search: search.trim() } : {} })).data,
  user: async (code: string) => (await api.get<UserDetail>(`${BASE_URL}/users/${enc(code)}`)).data,
  lookups: async () => (await api.get<SecurityLookups>(`${BASE_URL}/users/lookups`)).data,
  deleteUser: (code: string) => api.delete(`${BASE_URL}/users/${enc(code)}`),

  saveRole: (request: RoleUserRequest, isNew: boolean) =>
    isNew ? api.post(`${BASE_URL}/users`, body(request)) : api.put(`${BASE_URL}/users/${enc(request.code)}`, body(request)),
  savePermission: (request: PermissionUserRequest, isNew: boolean) =>
    isNew ? api.post(`${BASE_URL}/permissions`, body(request)) : api.put(`${BASE_URL}/permissions/${enc(request.code)}`, body(request)),
}

export const securityKeys = {
  departments: ['security', 'departments'] as const,
  users: (search: string) => ['security', 'users', search] as const,
  user: (code: string | null) => ['security', 'user', code] as const,
  lookups: ['security', 'lookups'] as const,
}
