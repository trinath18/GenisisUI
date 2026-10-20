import type { CardControlRow, CardControlSearch } from './types'

/** Desktop cbosendingmode / cboSendCat. */
export const SENDING_MODES = ['By Hand', 'By Post', 'Courier'] as const

export const EMPTY_SEARCH: CardControlSearch = {
  payorCode: '',
  numberFrom: '',
  numberTo: '',
  bordxDateFrom: '',
  bordxDateTo: '',
  batchFrom: '',
  batchTo: '',
  sentDateFrom: '',
  sentDateTo: '',
  sendingMode: '',
}

export const MESSAGES = {
  notFound: 'Record Not Found!',
  nothingToPrint: 'Report cannot be printed without any record.',
  confirmUpdate: 'Do you want to update the record?',
} as const

export const SEARCH_LIMIT = 2000
export const DOC_REFERENCE_MAX_LENGTH = 50
export const EXPORT_FILE_NAME = 'MembershipCardControl.csv'
export const LOOKUPS_STALE_MS = 10 * 60 * 1000

/** A list row's identity: membership number and cover ID (00 = principal). */
export const rowKey = (row: Pick<CardControlRow, 'membershipNo' | 'coverId'>) => `${row.membershipNo}|${row.coverId}`
