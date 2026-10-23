// Invoice > Original Invoice Update (legacy frmUpdateInvoice): the types of the server's answer and the small pure rules the page uses: the checks of Go and
// Update with the desktop's messages and order, and the request an Update sends.

import * as yup from 'yup'
import { dmyDate } from '../../lib/validation'
import { isoDmy, isoToDmy, S } from '../case/caseShared'

export interface OriginalInvoice {
  id: number
  caseNo: string
  version: string
  invoiceNo: string | null
  invoiceDate: string | null
  originalReceivedDate: string | null
  originalStatus: string | null
  payTo: string | null
  hospitalCode: string | null
  hospitalAccCode: string | null
  hospitalName: string | null
}

export interface OriginalValues {
  caseNo: string
  version: string
  invoiceNo: string
  /** "OIR Date": when the original invoice was received. */
  originalDate: string
  invoiceDate: string
  hospital: string
}

export const originalDefaults: OriginalValues = { caseNo: '', version: '', invoiceNo: '', originalDate: '', invoiceDate: '', hospital: '' }

export const originalSchema: yup.ObjectSchema<OriginalValues> = yup.object({
  caseNo: yup.string().trim().default(''),
  version: yup.string().trim().default(''),
  invoiceNo: yup.string().trim().default(''),
  originalDate: dmyDate('Invalid Date Format! '),
  invoiceDate: dmyDate('Invalid Date Format! '),
  hospital: yup.string().default(''),
})

export interface Problem {
  field: keyof OriginalValues
  message: string
}

/** cmdShow_Click's checks. */
export function showProblem(v: OriginalValues): Problem | null {
  if (!v.caseNo.trim()) return { field: 'caseNo', message: 'Please Enter Case No' }
  if (!v.version.trim()) return { field: 'version', message: 'Please Enter Case Version' }
  return null
}

/** cmdUpdate_Click's checks, in the desktop's order; its "Please Enter Invoice Date!" is about the OIR date. */
export function updateProblem(v: OriginalValues): Problem | null {
  if (!v.caseNo.trim()) return { field: 'caseNo', message: 'Please Enter Case No!' }
  if (!v.invoiceNo.trim()) return { field: 'invoiceNo', message: 'Please Enter Invoice No!' }
  if (!v.originalDate.trim() || !isoDmy(v.originalDate)) return { field: 'originalDate', message: 'Please Enter Invoice Date!' }
  return null
}

/** The form's values for an invoice: dates as dd/mm/yyyy, the hospital by code (empty when the invoice has none). */
export function valuesOf(invoice: OriginalInvoice): OriginalValues {
  return {
    caseNo: invoice.caseNo,
    version: invoice.version,
    invoiceNo: S(invoice.invoiceNo),
    originalDate: isoToDmy(invoice.originalReceivedDate),
    invoiceDate: isoToDmy(invoice.invoiceDate),
    hospital: S(invoice.hospitalCode),
  }
}

/** The body of the update request. */
export function updateRequest(v: OriginalValues) {
  return {
    invoiceNo: v.invoiceNo.trim(),
    invoiceDate: isoDmy(v.invoiceDate),
    originalReceivedDate: isoDmy(v.originalDate),
    hospitalCode: v.hospital.trim() || null,
  }
}

/** The hospital drop-down is enabled only for an invoice that is paid to a hospital the database knows (the desktop enabled it only then). */
export const hospitalEnabled = (invoice: OriginalInvoice | undefined): boolean => !!invoice?.hospitalName

/** The text a version's invoice shows in the picker that appears when it has more than one. */
export const invoiceLabel = (invoice: OriginalInvoice, position: number): string =>
  `${position}. ${S(invoice.invoiceNo) || '(no number)'}${invoice.invoiceDate ? ` · ${isoToDmy(invoice.invoiceDate)}` : ''}`
