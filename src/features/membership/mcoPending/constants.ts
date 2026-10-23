/** MCOPending.Status. */
export const MCO_PENDING_STATUS = {
  billed: 'B',
  pending: 'P',
  release: 'R',
} as const

/** Desktop cboSearchStatus (the desktop spells it "Realease"). */
export const SEARCH_STATUSES = [
  { code: MCO_PENDING_STATUS.billed, name: 'B - Billed' },
  { code: MCO_PENDING_STATUS.pending, name: 'P - Pending' },
  { code: MCO_PENDING_STATUS.release, name: 'R - Release' },
] as const

/** Desktop cboStatus: the statuses Update can set. */
export const UPDATE_STATUSES = [
  { code: MCO_PENDING_STATUS.pending, name: 'P - Pending' },
  { code: MCO_PENDING_STATUS.release, name: 'R - Release' },
] as const

export const MESSAGES = {
  noRecord: 'No record found!',
  noRecordToPrint: 'There is no record on listing!',
  billed: 'This Bordx has been billed',
  confirmUpdate: 'Do you want to update the record?',
} as const

export const EXPORT_FILE_NAME = 'MCOPending.csv'
export const SEARCH_LIMIT = 2000
