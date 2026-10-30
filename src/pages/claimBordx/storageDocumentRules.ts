// Claim Bordx > Storage > Document (legacy frmStorageDoc, "Storage / Cartons"): the form values of the search and of the storage form, the checks the desktop made before adding, saving and
// ticking, the requests and the file "Print File" writes. The server repeats the checks.

import * as yup from 'yup'
import type { Option } from '../../components/Field'
import type { CsvColumn } from '../../lib/exportCsv'
import { dmyDate, optionalText } from '../../lib/validation'
import { isoDmy, isoToDmy } from '../case/caseShared'

export interface DocumentRow {
  documentNo: string
  cartonNo: string | null
  docType: string | null
  fileStatus: string | null
  registerDate: string | null
  requestBy: string | null
  requestDate: string | null
  deliveryDate: string | null
  returnDate: string | null
  remarks: string | null
  department: string | null
}

export interface DocumentLookups {
  cartons: string[]
  users: string[]
  departments: string[]
}

export interface DocumentSearchValues {
  docType: string
  docFrom: string
  docTo: string
  carton: string
  fileStatus: string
  requestBy: string
  requestDate: string
  deliveryDate: string
  returnDate: string
}

export interface DocumentStoreValues {
  docType: string
  carton: string
  department: string
  fileStatus: string
  requestBy: string
  requestDate: string
  deliveryDate: string
  returnDate: string
  remarks: string
}

export const searchDefaults: DocumentSearchValues = {
  docType: 'B',
  docFrom: '',
  docTo: '',
  carton: '',
  fileStatus: 'A',
  requestBy: '',
  requestDate: '',
  deliveryDate: '',
  returnDate: '',
}

export const storeDefaults: DocumentStoreValues = {
  docType: '',
  carton: '',
  department: '',
  fileStatus: '',
  requestBy: '',
  requestDate: '',
  deliveryDate: '',
  returnDate: '',
  remarks: '',
}

/** cboDOCType: "B - Bordx", "P - Payment Voucher", "R - Receipt". */
export const docTypeOptions: Option[] = [
  { value: 'B', label: 'B - Bordx' },
  { value: 'P', label: 'P - Payment Voucher' },
  { value: 'R', label: 'R - Receipt' },
]

/** CboFileStatus1: "A - All", "I - In", "O - Out" (the storage form has no "All"). */
export const searchStatusOptions: Option[] = [
  { value: 'A', label: 'A - All' },
  { value: 'I', label: 'I - In' },
  { value: 'O', label: 'O - Out' },
]
export const storeStatusOptions: Option[] = searchStatusOptions.slice(1)

export const searchSchema = yup.object({
  docType: yup.string().default('B'),
  docFrom: optionalText(),
  docTo: optionalText(),
  carton: optionalText(),
  fileStatus: optionalText(),
  requestBy: optionalText(),
  requestDate: dmyDate(),
  deliveryDate: dmyDate(),
  returnDate: dmyDate(),
}) as yup.ObjectSchema<DocumentSearchValues>

export const storeSchema = yup.object({
  docType: optionalText(),
  carton: optionalText(),
  department: optionalText(),
  fileStatus: optionalText(),
  requestBy: optionalText(),
  requestDate: dmyDate(),
  deliveryDate: dmyDate(),
  returnDate: dmyDate(),
  remarks: optionalText(),
}) as yup.ObjectSchema<DocumentStoreValues>

const text = (v: string) => v.trim() || undefined
const day = (v: string) => isoDmy(v) ?? undefined

/** The query of the document search. */
export const searchParams = (v: DocumentSearchValues) => ({
  docType: v.docType,
  docFrom: text(v.docFrom),
  docTo: text(v.docTo),
  carton: text(v.carton),
  fileStatus: v.fileStatus === 'A' ? undefined : text(v.fileStatus),
  requestBy: text(v.requestBy),
  requestDate: day(v.requestDate),
  deliveryDate: day(v.deliveryDate),
  returnDate: day(v.returnDate),
})

/** The key of a row. */
export const documentKey = (r: DocumentRow) => r.documentNo

/** ProcessItemChecked: a document that is in a carton already cannot be ticked. */
export const documentTickProblem = (r: DocumentRow) => (r.docType ? 'Claim has been stored!' : null)

/** cmdAdd_Click: at least one document has to be ticked. */
export const addProblem = (ticked: number) => (ticked === 0 ? 'Please checked at least 1 Claim !' : null)

/** cmdSave_Click's checks in the desktop's order; null when the save may go ahead. */
export const storeProblem = (v: DocumentStoreValues) => {
  if (v.docType.trim() === '') return { field: 'docType' as const, message: 'Please Enter Document Type' }
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

/** The storage form filled from a stored row (Lststr_Click). */
export const storeFromRow = (r: DocumentRow): DocumentStoreValues => ({
  docType: r.docType ?? '',
  carton: r.cartonNo ?? '',
  department: r.department ?? '',
  fileStatus: r.fileStatus ?? '',
  requestBy: r.requestBy ?? '',
  requestDate: isoToDmy(r.requestDate),
  deliveryDate: isoToDmy(r.deliveryDate),
  returnDate: isoToDmy(r.returnDate),
  remarks: r.remarks ?? '',
})

/** The request of the save. */
export const saveRequest = (documents: readonly string[], v: DocumentStoreValues, edit: boolean) => ({
  documents,
  docType: v.docType,
  carton: v.carton.trim(),
  fileStatus: v.fileStatus,
  requestBy: v.requestBy.trim(),
  department: v.department.trim(),
  requestDate: isoDmy(v.requestDate),
  deliveryDate: isoDmy(v.deliveryDate),
  returnDate: isoDmy(v.returnDate),
  remarks: v.remarks.trim(),
  edit,
})

const d = (value: string | null) => isoToDmy(value)

export const documentColumns: CsvColumn<DocumentRow>[] = [
  { label: 'Doc. No', value: (r) => r.documentNo },
  { label: 'CartonNo', value: (r) => r.cartonNo ?? '' },
  { label: 'Doc Type', value: (r) => r.docType ?? '' },
  { label: 'File Status', value: (r) => r.fileStatus ?? '' },
  { label: 'Date Register', value: (r) => d(r.registerDate) },
  { label: 'RequestBy', value: (r) => r.requestBy ?? '' },
  { label: 'Date Request', value: (r) => d(r.requestDate) },
  { label: 'Date Delivery', value: (r) => d(r.deliveryDate) },
  { label: 'Date Return', value: (r) => d(r.returnDate) },
  { label: 'Remarks', value: (r) => r.remarks ?? '' },
  { label: 'Dept', value: (r) => r.department ?? '' },
]
