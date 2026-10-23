import { api } from '../../../../api/client'
import type { InvoiceReceiptLookups, InvoiceReceiptRequest, InvoiceReceiptResult, InvoiceSearch, InvoiceSearchResult, ReceiptRow } from '../types'

const BASE_URL = '/api/finance/invoice-receipt'

/** Only the criteria that were filled in. */
function params(search: InvoiceSearch): Record<string, string> {
  return Object.fromEntries(
    Object.entries(search)
      .filter(([, value]) => value !== undefined && String(value).trim() !== '')
      .map(([key, value]) => [key, String(value).trim()]),
  )
}

export const invoiceReceiptApi = {
  lookups: async () => (await api.get<InvoiceReceiptLookups>(`${BASE_URL}/lookups`)).data,
  invoices: async (search: InvoiceSearch) => (await api.get<InvoiceSearchResult>(`${BASE_URL}/invoices`, { params: params(search) })).data,
  receipts: async (invoiceNo: string) => (await api.get<ReceiptRow[]>(`${BASE_URL}/invoices/${encodeURIComponent(invoiceNo)}/receipts`)).data,
  /** Auto receipt number (Invoice Receipt) or the typed one (Notification / Suspension, `manual`). */
  record: async (body: InvoiceReceiptRequest, manual: boolean) =>
    (await api.post<InvoiceReceiptResult>(`${BASE_URL}/receipts${manual ? '/manual' : ''}`, body)).data,
}
