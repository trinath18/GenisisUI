import { api } from '../../../../api/client'
import type { ReceiptDetail, ReceiptEnquiryLookups, ReceiptSearch, ReceiptSearchResult } from '../types'

const BASE_URL = '/api/finance/receipt-enquiry'

/** Only the criteria that were filled in. */
function params(search: ReceiptSearch): Record<string, string> {
  return Object.fromEntries(
    Object.entries(search)
      .filter(([, value]) => value !== undefined && String(value).trim() !== '')
      .map(([key, value]) => [key, String(value).trim()]),
  )
}

export const receiptEnquiryApi = {
  lookups: async () => (await api.get<ReceiptEnquiryLookups>(`${BASE_URL}/lookups`)).data,
  search: async (search: ReceiptSearch) => (await api.get<ReceiptSearchResult>(`${BASE_URL}/search`, { params: params(search) })).data,
  get: async (id: number) => (await api.get<ReceiptDetail>(`${BASE_URL}/${id}`)).data,
}
