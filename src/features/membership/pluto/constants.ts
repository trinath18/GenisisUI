/** Desktop cboHLTCode. */
export const HEALTH_CODES = [
  { code: 'S', name: 'S - Sihat' },
  { code: 'N', name: 'N - Non-Sihat' },
] as const

export const ACCEPTED_FILE_TYPES = '.xls,.xlsx'
export const ASCII_FALLBACK_FILE_NAME = 'MembershipASCII.txt'
export const ASCII_GENERATED_MESSAGE = 'File Generated Sucessfully...'
export const CONFIRM_UPLOAD_MESSAGE = 'Do you want to Upload the records?'
export const PAYORS_STALE_MS = 10 * 60 * 1000
