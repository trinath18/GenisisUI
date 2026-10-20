import { api } from '../../../../api/client'
import type { AccountTransactionQuery, AccountTransactionResult } from '../types'

const BASE_URL = '/api/maintenance/account-transaction'

/** Only the criteria that were filled in. */
function params(query: AccountTransactionQuery): Record<string, string> {
  return Object.fromEntries(
    Object.entries(query)
      .filter(([, value]) => value.trim() !== '')
      .map(([key, value]) => [key, value.trim()]),
  )
}

export const accountTransactionApi = {
  search: async (query: AccountTransactionQuery) => (await api.get<AccountTransactionResult>(BASE_URL, { params: params(query) })).data,
}

export const accountTransactionKeys = {
  search: (query: AccountTransactionQuery | null) => ['account-transaction', query] as const,
}
