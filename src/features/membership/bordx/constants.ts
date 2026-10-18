import type { CodeOption } from '../../../components/common/CodeSelect'

/** Bordx type (API FileTypes). */
export const FileType = { New: 'N', Endorsement: 'E' } as const

export const FILE_TYPES: CodeOption[] = [
  { code: FileType.New, name: 'New File' },
  { code: FileType.Endorsement, name: 'Endorsement File' },
]

/** File version the desktop shows for each Bordx type. */
export const fileVersion = (fileType: string) => (fileType === FileType.Endorsement ? 'Version 4830' : 'Version 4800')

export const YES_NO: CodeOption[] = [
  { code: 'Y', name: 'Yes' },
  { code: 'N', name: 'No' },
]
export const YES = 'Y'
export const NO = 'N'

export const ASCII_VERSIONS: CodeOption[] = [
  { code: '01', name: 'Version 185' },
  { code: '02', name: 'Version 195' },
  { code: '03', name: 'Version 300' },
]

/** Generate ASCII export option (API AsciiExportOptions). */
export const ExportOption = { DateRange: 'D', Batch: 'B' } as const

export const EXPORT_OPTIONS: CodeOption[] = [
  { code: ExportOption.DateRange, name: 'Bordx Range' },
  { code: ExportOption.Batch, name: 'Batch Bordx' },
]

/** The desktop pre-selects the second health type (cboHLTCode1.ListIndex = 1). */
export const DEFAULT_HEALTH_INDEX = 1

export const ERRORS_FILE_NAME = 'bordx-errors.csv'
export const ASCII_FALLBACK_FILE_NAME = 'bordx.txt'
export const LOOKUPS_STALE_MS = 10 * 60_000

export const Messages = {
  fileRequired: 'Please Enter Filename',
  typeRequired: 'Please Select Bordx Type',
  confirmUpload: 'Do you want to upload this file?',
  confirmGenerate: 'Are you sure?',
  verified: 'Verified Sucessfully...',
  generated: 'File Generated Sucessfully...',
} as const
