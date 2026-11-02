// Claim Bordx > Storage > Claim files (legacy frmStorageEntry, "Storage Entry"): the criteria, the checks the desktop made before saving, the requests and the columns of the two tabs. Cartons are
// searched with the Storage Enquiry rules (storageEnquiryRules.ts); the server repeats every check.

import * as yup from 'yup'
import type { Option } from '../../components/Field'
import type { CsvColumn } from '../../lib/exportCsv'
import { formatMoney } from '../../lib/format'
import { dmyDate, optionalText } from '../../lib/validation'
import { isoDmy, isoToDmy } from '../case/caseShared'
import type { CartonRow, FileRow } from './storageEnquiryRules'

/** A claim of the Storage Details list: the Enquiry's row with the claim's bordx date and cash type (claims that are not stored yet have no carton). */
export type EntryFileRow = FileRow & { bordxDate: string | null; cashType: string | null }

/** SearchRecord's file status list: "A - All" first, then In and Out. */
export const entryStatusOptions: Option[] = [
  { value: 'A', label: 'A - All' },
  { value: 'I', label: 'I - In' },
  { value: 'O', label: 'O - Out' },
]

/** CboCartonStatus: "M - Medix", "S - Store", "R - Return". */
export const cartonStatusChoices: Option[] = [
  { value: 'M', label: 'M - Medix' },
  { value: 'S', label: 'S - Store' },
  { value: 'R', label: 'R - Return' },
]

/** CboFileStatus2: "I - In", "O - Out". */
export const fileStatusChoices: Option[] = entryStatusOptions.slice(1)

/** ProcessItemChecked warned from the 71st ticked claim ("Files Limit Exceeded!"): a carton holds about 70 files. */
export const FILE_LIMIT = 70

export interface EntrySearchValues {
  useScan: boolean
  caseFrom: string
  caseTo: string
  carton: string
  fileStatus: string
  requestBy: string
  requestFrom: string
  requestTo: string
  deliveryFrom: string
  deliveryTo: string
  returnFrom: string
  returnTo: string
  bordxFrom: string
  bordxTo: string
}

export const entrySearchDefaults: EntrySearchValues = {
  useScan: true,
  caseFrom: '',
  caseTo: '',
  carton: '',
  fileStatus: 'A',
  requestBy: '',
  requestFrom: '',
  requestTo: '',
  deliveryFrom: '',
  deliveryTo: '',
  returnFrom: '',
  returnTo: '',
  bordxFrom: '',
  bordxTo: '',
}

const dates = (...keys: string[]) => Object.fromEntries(keys.map((k) => [k, dmyDate()]))

export const entrySearchSchema = yup.object({
  useScan: yup.boolean().default(true),
  caseFrom: optionalText(),
  caseTo: optionalText(),
  carton: optionalText(),
  fileStatus: optionalText(),
  requestBy: optionalText(),
  ...dates('requestFrom', 'requestTo', 'deliveryFrom', 'deliveryTo', 'returnFrom', 'returnTo', 'bordxFrom', 'bordxTo'),
}) as yup.ObjectSchema<EntrySearchValues>

const text = (v: string) => v.trim() || undefined
const day = (v: string) => isoDmy(v) ?? undefined

/** StorageSearchRecord's query: the carton is matched exactly (the desktop's one drop-down), "A - All" is no status, and the list includes the claims that are not stored yet. */
export const entrySearchParams = (v: EntrySearchValues) => ({
  includeUnstored: true,
  useScan: v.useScan,
  caseFrom: text(v.caseFrom),
  caseTo: v.useScan ? undefined : text(v.caseTo),
  cartonFrom: text(v.carton),
  cartonTo: text(v.carton),
  fileStatus: v.fileStatus === 'A' ? undefined : text(v.fileStatus),
  requestBy: text(v.requestBy),
  requestFrom: day(v.requestFrom),
  requestTo: day(v.requestTo),
  deliveryFrom: day(v.deliveryFrom),
  deliveryTo: day(v.deliveryTo),
  returnFrom: day(v.returnFrom),
  returnTo: day(v.returnTo),
  bordxFrom: day(v.bordxFrom),
  bordxTo: day(v.bordxTo),
})

/** The key of a claim of the list. */
export const fileKey = (r: EntryFileRow) => `${r.caseNo}-${r.claimVersion}`

/** ProcessItemChecked: a claim that is in a carton already cannot be ticked. */
export const fileTickProblem = (r: EntryFileRow) => (r.cartonNo ? 'Claim has been stored!' : null)

/** cmdAdd_Click: at least one claim has to be ticked. */
export const addProblem = (ticked: number) => (ticked === 0 ? 'Please checked at least 1 Claim !' : null)

// ---------------------------------------------------------------- Storage Details form

export interface StoreValues {
  carton: string
  fileStatus: string
  requestBy: string
  requestDate: string
  deliveryDate: string
  returnDate: string
  remarks: string
}

export const storeDefaults: StoreValues = { carton: '', fileStatus: '', requestBy: '', requestDate: '', deliveryDate: '', returnDate: '', remarks: '' }

export const storeSchema = yup.object({
  carton: optionalText(),
  fileStatus: optionalText(),
  requestBy: optionalText(),
  ...dates('requestDate', 'deliveryDate', 'returnDate'),
  remarks: optionalText(),
}) as yup.ObjectSchema<StoreValues>

/** cmdSave_Click's checks in the desktop's order; null when the save may go ahead. Without a Request By the dates are not looked at (and not kept). */
export const storeProblem = (v: StoreValues) => {
  if (v.carton.trim() === '') return { field: 'carton' as const, message: 'Please Enter Carton Number' }
  if (v.fileStatus.trim() === '') return { field: 'fileStatus' as const, message: 'Please Enter File Status' }
  if (v.requestBy.trim() === '') return null
  const request = isoDmy(v.requestDate)
  if (!request) return { field: 'requestDate' as const, message: 'Please Enter Date Of Request' }
  const delivery = isoDmy(v.deliveryDate)
  if (delivery && delivery < request) return { field: 'deliveryDate' as const, message: 'Invalid Date ! Date of Delivery must greater than Date of Request' }
  const back = isoDmy(v.returnDate)
  if (back && (!delivery || back < delivery))
    return { field: 'returnDate' as const, message: 'Invalid Date ! Date of Return must greater than Date of Delivery' }
  return null
}

/** The storage form filled from a stored claim (Lststr_Click). */
export const storeFromFile = (r: EntryFileRow): StoreValues => ({
  carton: r.cartonNo ?? '',
  fileStatus: r.fileStatus ?? '',
  requestBy: r.requestBy ?? '',
  requestDate: isoToDmy(r.requestDate),
  deliveryDate: isoToDmy(r.deliveryDate),
  returnDate: isoToDmy(r.returnDate),
  remarks: r.remarks ?? '',
})

/** The request of the save. */
export const fileSaveRequest = (files: readonly EntryFileRow[], v: StoreValues, edit: boolean) => ({
  files: files.map((f) => ({ caseNo: f.caseNo, version: f.claimVersion })),
  carton: v.carton.trim(),
  fileStatus: v.fileStatus,
  requestBy: v.requestBy.trim(),
  requestDate: isoDmy(v.requestDate),
  deliveryDate: isoDmy(v.deliveryDate),
  returnDate: isoDmy(v.returnDate),
  remarks: v.remarks.trim(),
  edit,
})

// ---------------------------------------------------------------- Carton Details form

export interface CartonFormValues {
  cartonNo: string
  status: string
  sendDate: string
  requestDate: string
  deliveryDate: string
  returnDate: string
  destroyDate: string
  remarks: string
}

export const cartonFormDefaults: CartonFormValues = {
  cartonNo: '',
  status: '',
  sendDate: '',
  requestDate: '',
  deliveryDate: '',
  returnDate: '',
  destroyDate: '',
  remarks: '',
}

export const cartonFormSchema = yup.object({
  cartonNo: optionalText(),
  status: optionalText(),
  ...dates('sendDate', 'requestDate', 'deliveryDate', 'returnDate', 'destroyDate'),
  remarks: optionalText(),
}) as yup.ObjectSchema<CartonFormValues>

/**
 * SaveCarton's checks in the desktop's order; null when the save may go ahead. The desktop compared the dates as text, so a request without a send date, a return without a delivery date and a
 * destroy without a return date failed too; each date has to come after the one before it.
 */
export const cartonProblem = (v: CartonFormValues, edit: boolean) => {
  if (!edit && v.cartonNo.trim() === '') return { field: 'cartonNo' as const, message: 'Please Enter Carton Number' }
  if (v.status.trim() === '') return { field: 'status' as const, message: 'Please Enter Carton Status' }
  const [send, request, delivery, back, destroy] = [v.sendDate, v.requestDate, v.deliveryDate, v.returnDate, v.destroyDate].map((x) => isoDmy(x))
  if (request && (!send || request < send)) return { field: 'requestDate' as const, message: 'Invalid Date ! Date of Request must greater than Date of Send ' }
  if (back && (!delivery || back < delivery))
    return { field: 'returnDate' as const, message: 'Invalid Date ! Date of Return must greater than Date of Delivery ' }
  if (destroy && (!back || destroy < back))
    return { field: 'destroyDate' as const, message: 'Invalid Date ! Date of Destroy must greater than Date of Return ' }
  if (v.status === 'R' && !back) return { field: 'returnDate' as const, message: "Date Return cannot be null when the status is 'R' !" }
  return null
}

/** The carton form filled from a carton of the list (Lstcrt_Click). */
export const cartonFromRow = (r: CartonRow): CartonFormValues => ({
  cartonNo: r.cartonNo,
  status: r.status ?? '',
  sendDate: isoToDmy(r.sendDate),
  requestDate: isoToDmy(r.requestDate),
  deliveryDate: isoToDmy(r.deliveryDate),
  returnDate: isoToDmy(r.returnDate),
  destroyDate: isoToDmy(r.destroyDate),
  remarks: r.remarks ?? '',
})

/** The request of the save: the one new carton, or the cartons to change (every checked carton gets the same status, dates and remarks). */
export const cartonSaveRequest = (cartons: readonly string[], v: CartonFormValues, edit: boolean) => ({
  cartons,
  status: v.status,
  sendDate: isoDmy(v.sendDate),
  requestDate: isoDmy(v.requestDate),
  deliveryDate: isoDmy(v.deliveryDate),
  returnDate: isoDmy(v.returnDate),
  destroyDate: isoDmy(v.destroyDate),
  remarks: v.remarks.trim(),
  edit,
})

const d = (value: string | null) => isoToDmy(value)

/** The columns of "Print to File" on the Storage Details tab. */
export const entryFileColumns: CsvColumn<EntryFileRow>[] = [
  { label: 'CaseNo', value: (r) => r.caseNo },
  { label: 'Version', value: (r) => String(r.claimVersion) },
  { label: 'CartonNo', value: (r) => r.cartonNo ?? '' },
  { label: 'Carton Status', value: (r) => r.cartonStatus ?? '' },
  { label: 'File Status', value: (r) => r.fileStatus ?? '' },
  { label: 'Bill Amt', value: (r) => (r.billAmount == null ? '' : formatMoney(r.billAmount)) },
  { label: 'Date Register', value: (r) => d(r.registerDate) },
  { label: 'Request By', value: (r) => r.requestBy ?? '' },
  { label: 'Date Request', value: (r) => d(r.requestDate) },
  { label: 'Date Delivery', value: (r) => d(r.deliveryDate) },
  { label: 'Date Return', value: (r) => d(r.returnDate) },
  { label: 'Duration', value: (r) => (r.duration == null ? '' : String(r.duration)) },
  { label: 'Remarks', value: (r) => r.remarks ?? '' },
  { label: 'Bordx Date', value: (r) => d(r.bordxDate) },
  { label: 'Cash Type', value: (r) => r.cashType ?? '' },
]
