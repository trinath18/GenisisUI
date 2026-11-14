// Claim Bordx > Bor Delivery > Bordx Send Date (legacy frmUploadApproval, "Upload Send/Approval/Return"; the menu item has no click handler and frmUploadBordxSentDate is a copy of this form
// without code). Three uploads of an Excel sheet: Send Date, App Date (the payor's approval) and Return Date. Each is verified first; the upload button works only after a clean verification of
// the same file, as the desktop enabled it. The server checks the file again before it writes.

import type { CsvColumn } from '../../lib/exportCsv'

export type SendDateKind = 'send' | 'approval' | 'return'

export interface SendDateLine {
  line: number
  bordxNo: string
  amount: string
  appCode: string | null
  appDate: string | null
  date: string | null
  problems: string[]
}

export interface SendDateResult {
  kind: SendDateKind
  rows: SendDateLine[]
  errors: number
  updated: number
  message: string
}

export const kindOptions: { value: SendDateKind; label: string }[] = [
  { value: 'send', label: 'Send Date' },
  { value: 'approval', label: 'App Date (payor approval)' },
  { value: 'return', label: 'Return Date' },
]

/** Which columns of the first sheet each upload reads (row 1 is the header; the rows stop at the first empty column A). */
export const layoutHint: Record<SendDateKind, string> = {
  send: 'Column B bordx no, C bordx amount, T send date. Sets the date the bordx was sent to the payor and to accounts (and to MNRB for an S bordx).',
  approval:
    'Column A bordx no, H approval code (12 characters), I approval date, J bordx amount. Sets the payor approval code and date on the claims of the bordx.',
  return:
    'Column B bordx no, C bordx amount, R approval code, S approval date, T return date. Sets the date the claims came back from the payor and adds a remark to the cases.',
}

/** The upload button's caption (the desktop's buttons). */
export const uploadLabel: Record<SendDateKind, string> = { send: 'Send Date', approval: 'App Date', return: 'Return Date' }

export const fileRequired = 'Please select file to upload!'

export const confirmText = 'Do you want to Upload the records?'

/** The accepted files. */
export const acceptedFiles = '.xls,.xlsx'

/** The upload works only after a verification of this file and upload with no error (cmdVerify* enabled the upload button). */
export function canUpload(verified: SendDateResult | null, kind: SendDateKind, verifiedFile: File | null, file: File | null) {
  return (
    verified !== null &&
    verified.kind === kind &&
    verified.updated === 0 &&
    verified.rows.length > 0 &&
    verified.errors === 0 &&
    file !== null &&
    verifiedFile === file
  )
}

/** The columns of the list for an upload. */
export function lineColumns(kind: SendDateKind): CsvColumn<SendDateLine>[] {
  const columns: CsvColumn<SendDateLine>[] = [
    { label: 'Line No', value: (r) => r.line },
    { label: 'Bordx No', value: (r) => r.bordxNo },
  ]
  if (kind !== 'send') {
    columns.push({ label: 'Approval Code', value: (r) => r.appCode ?? '' }, { label: 'Approval Date', value: (r) => r.appDate ?? '' })
  }
  columns.push({ label: 'Bordx Amount', value: (r) => r.amount })
  if (kind !== 'approval') columns.push({ label: kind === 'send' ? 'Send Date' : 'Return Date', value: (r) => r.date ?? '' })
  columns.push({ label: 'Problem', value: (r) => r.problems.join(' ') })
  return columns
}
