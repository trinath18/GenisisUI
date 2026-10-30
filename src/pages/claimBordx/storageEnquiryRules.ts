// Claim Bordx > Storage > Enquiry (legacy frmStorageEnq, "Storage Enquiry"): the form values of the Carton Details and Storage Details tabs, the checks the desktop made before searching, the
// requests and the files "Print to File" and "Listing" write. The server repeats the checks.

import * as yup from 'yup'
import type { Option } from '../../components/Field'
import type { CsvColumn } from '../../lib/exportCsv'
import { formatMoney } from '../../lib/format'
import { dmyDate, optionalText } from '../../lib/validation'
import { isoDmy, isoToDmy } from '../case/caseShared'
import { payorCode } from '../worksheet/worksheetRules'

export interface CartonRow {
  cartonNo: string
  status: string | null
  registerDate: string | null
  sendDate: string | null
  requestDate: string | null
  deliveryDate: string | null
  returnDate: string | null
  destroyDate: string | null
  remarks: string | null
}

export interface FileRow {
  caseNo: string
  claimVersion: number
  cartonNo: string | null
  cartonStatus: string | null
  fileStatus: string | null
  billAmount: number | null
  sendDate: string | null
  registerDate: string | null
  requestBy: string | null
  requestDate: string | null
  deliveryDate: string | null
  returnDate: string | null
  duration: number | null
  remarks: string | null
}

export interface CartonFile {
  caseNo: string
  claimVersion: string | null
  fileStatus: string | null
}

export interface StorageLookups {
  cartons: string[]
  users: string[]
}

export interface CartonValues {
  cartonFrom: string
  cartonTo: string
  status: string
  sendFrom: string
  sendTo: string
  requestFrom: string
  requestTo: string
  deliveryFrom: string
  deliveryTo: string
  returnFrom: string
  returnTo: string
  destroyFrom: string
  destroyTo: string
}

export interface FileValues {
  useScan: boolean
  caseFrom: string
  caseTo: string
  cartonFrom: string
  cartonTo: string
  fileStatus: string
  requestBy: string
  requestFrom: string
  requestTo: string
  deliveryFrom: string
  deliveryTo: string
  returnFrom: string
  returnTo: string
  registerFrom: string
  registerTo: string
  sentFrom: string
  sentTo: string
  payorFrom: string
  payorTo: string
}

export const cartonDefaults: CartonValues = {
  cartonFrom: '',
  cartonTo: '',
  status: '',
  sendFrom: '',
  sendTo: '',
  requestFrom: '',
  requestTo: '',
  deliveryFrom: '',
  deliveryTo: '',
  returnFrom: '',
  returnTo: '',
  destroyFrom: '',
  destroyTo: '',
}

export const fileDefaults: FileValues = {
  useScan: true,
  caseFrom: '',
  caseTo: '',
  cartonFrom: '',
  cartonTo: '',
  fileStatus: '',
  requestBy: '',
  requestFrom: '',
  requestTo: '',
  deliveryFrom: '',
  deliveryTo: '',
  returnFrom: '',
  returnTo: '',
  registerFrom: '',
  registerTo: '',
  sentFrom: '',
  sentTo: '',
  payorFrom: '',
  payorTo: '',
}

/** CboCartonStatus: "M - Medix", "S - Store", "R - Return". */
export const cartonStatusOptions: Option[] = [
  { value: 'M', label: 'M - Medix' },
  { value: 'S', label: 'S - Store' },
  { value: 'R', label: 'R - Return' },
]

/** CboFileStatus: "I - In", "O - Out". */
export const fileStatusOptions: Option[] = [
  { value: 'I', label: 'I - In' },
  { value: 'O', label: 'O - Out' },
]

const dates = (...keys: string[]) => Object.fromEntries(keys.map((k) => [k, dmyDate()]))

export const cartonSchema = yup.object({
  cartonFrom: optionalText(),
  cartonTo: optionalText(),
  status: optionalText(),
  ...dates('sendFrom', 'sendTo', 'requestFrom', 'requestTo', 'deliveryFrom', 'deliveryTo', 'returnFrom', 'returnTo', 'destroyFrom', 'destroyTo'),
}) as yup.ObjectSchema<CartonValues>

export const fileSchema = yup.object({
  useScan: yup.boolean().default(true),
  caseFrom: optionalText(),
  caseTo: optionalText(),
  cartonFrom: optionalText(),
  cartonTo: optionalText(),
  fileStatus: optionalText(),
  requestBy: optionalText(),
  payorFrom: optionalText(),
  payorTo: optionalText(),
  ...dates('requestFrom', 'requestTo', 'deliveryFrom', 'deliveryTo', 'returnFrom', 'returnTo', 'registerFrom', 'registerTo', 'sentFrom', 'sentTo'),
}) as yup.ObjectSchema<FileValues>

const text = (v: string) => v.trim() || undefined
const day = (v: string) => isoDmy(v) ?? undefined

/** The query of the carton search. */
export const cartonParams = (v: CartonValues) => ({
  cartonFrom: text(v.cartonFrom),
  cartonTo: text(v.cartonTo),
  status: text(v.status),
  sendFrom: day(v.sendFrom),
  sendTo: day(v.sendTo),
  requestFrom: day(v.requestFrom),
  requestTo: day(v.requestTo),
  deliveryFrom: day(v.deliveryFrom),
  deliveryTo: day(v.deliveryTo),
  returnFrom: day(v.returnFrom),
  returnTo: day(v.returnTo),
  destroyFrom: day(v.destroyFrom),
  destroyTo: day(v.destroyTo),
})

/** The query of the storage search (the payor drop-downs hold "CODE - Name"; the desktop took the first two letters). */
export const fileParams = (v: FileValues) => ({
  useScan: v.useScan,
  caseFrom: text(v.caseFrom),
  caseTo: v.useScan ? undefined : text(v.caseTo),
  cartonFrom: text(v.cartonFrom),
  cartonTo: text(v.cartonTo),
  fileStatus: text(v.fileStatus),
  requestBy: text(v.requestBy),
  requestFrom: day(v.requestFrom),
  requestTo: day(v.requestTo),
  deliveryFrom: day(v.deliveryFrom),
  deliveryTo: day(v.deliveryTo),
  returnFrom: day(v.returnFrom),
  returnTo: day(v.returnTo),
  registerFrom: day(v.registerFrom),
  registerTo: day(v.registerTo),
  sentFrom: day(v.sentFrom),
  sentTo: day(v.sentTo),
  payorFrom: text(payorCode(v.payorFrom)),
  payorTo: text(payorCode(v.payorTo)),
})

/** cmdSearch_Click on the Storage Details tab: a scan needs a case number. */
export const fileSearchProblem = (v: Pick<FileValues, 'useScan' | 'caseFrom'>) => (v.useScan && v.caseFrom.trim() === '' ? 'Please Enter Case No' : null)

/** CaseNoCheck: scanning a case that is already in the list is refused ("Data has been uploaded!"). */
export const isCaseListed = (rows: readonly { caseNo: string }[], caseNo: string) => {
  const wanted = caseNo.trim().toUpperCase()
  return rows.some((r) => r.caseNo.trim().toUpperCase() === wanted)
}

/** CmdListing_Click: a carton number is needed. */
export const listingProblem = (carton: string) => (carton.trim() === '' ? 'Please select Carton No.' : null)

const d = (value: string | null) => isoToDmy(value)

export const cartonColumns: CsvColumn<CartonRow>[] = [
  { label: 'Carton No', value: (r) => r.cartonNo },
  { label: 'Status', value: (r) => r.status ?? '' },
  { label: 'Date Register', value: (r) => d(r.registerDate) },
  { label: 'Date Send', value: (r) => d(r.sendDate) },
  { label: 'Date Request', value: (r) => d(r.requestDate) },
  { label: 'Date Delivery', value: (r) => d(r.deliveryDate) },
  { label: 'Date Return', value: (r) => d(r.returnDate) },
  { label: 'Date Destroy', value: (r) => d(r.destroyDate) },
  { label: 'Remarks', value: (r) => r.remarks ?? '' },
]

export const fileColumns: CsvColumn<FileRow>[] = [
  { label: 'CaseNo', value: (r) => r.caseNo },
  { label: 'Version', value: (r) => String(r.claimVersion) },
  { label: 'CartonNo', value: (r) => r.cartonNo ?? '' },
  { label: 'Carton Status', value: (r) => r.cartonStatus ?? '' },
  { label: 'File Status', value: (r) => r.fileStatus ?? '' },
  { label: 'Bill Amt', value: (r) => (r.billAmount == null ? '' : formatMoney(r.billAmount)) },
  { label: 'Date Sent', value: (r) => d(r.sendDate) },
  { label: 'Date Register', value: (r) => d(r.registerDate) },
  { label: 'Request By', value: (r) => r.requestBy ?? '' },
  { label: 'Date Request', value: (r) => d(r.requestDate) },
  { label: 'Date Delivery', value: (r) => d(r.deliveryDate) },
  { label: 'Date Return', value: (r) => d(r.returnDate) },
  { label: 'Duration', value: (r) => (r.duration == null ? '' : String(r.duration)) },
  { label: 'Remarks', value: (r) => r.remarks ?? '' },
]

/** The check sheet of a carton: a running number, the file (case-version) and its file status ("Checking"), as StorageTracking.xlt held them. */
export const checkSheetRows = (files: readonly CartonFile[]) =>
  files.map((f, i) => ({ no: i + 1, caseNo: `${f.caseNo}-${f.claimVersion ?? ''}`, checking: f.fileStatus ?? '' }))

export const checkSheetColumns: CsvColumn<ReturnType<typeof checkSheetRows>[number]>[] = [
  { label: 'No', value: (r) => String(r.no) },
  { label: 'Case No', value: (r) => r.caseNo },
  { label: 'Checking', value: (r) => r.checking },
]
