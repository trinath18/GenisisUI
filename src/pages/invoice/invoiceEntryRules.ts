// Invoice > Invoice Processing, write side: the types of the save, the form's values, and the pure rules the entry form uses. The server repeats every check and works every total out.

import { isoDmy, isoToDmy, S } from '../case/caseShared'
import type { InvoiceCaseHeader } from './invoiceRules'

export type FieldKind = 'Money' | 'Number' | 'Text' | 'Flag'

export interface InvoiceField {
  key: string
  label: string
  section: string
  kind: FieldKind
  sumOf: string[] | null
  computed: boolean
  frame: string | null
  tax: string | null
}

export interface InvoiceOption {
  code: string
  name: string | null
}

export interface InvoiceLookups {
  stayTypes: InvoiceOption[]
  receiptModes: InvoiceOption[]
  roomTypes: string[]
  hospitals: InvoiceOption[]
}

/** What the server saves and loads: dates as ISO text, amounts as numbers. */
export interface InvoiceFormDto {
  caseNo: string
  index: number | null
  invoiceNo: string | null
  invoiceDate: string | null
  payTo: string | null
  payee: string | null
  stayType: string | null
  roomType: string | null
  receiptMode: string | null
  receiptDate: string | null
  followUpDate: string | null
  excessAmount: number | null
  initialAmount: number | null
  uhcNo: string | null
  amounts: Record<string, number | null>
  texts: Record<string, string | null>
  remarks: string | null
  confirmDifferentHospital: boolean
}

export interface InvoiceCalculation {
  amounts: Record<string, number | null>
  invoiceAmount: number
  payAmount: number
}

export interface InvoiceFormData {
  form: InvoiceFormDto
  calculation: InvoiceCalculation
  inWorksheet: boolean
  bordxed: boolean
}

export interface InvoiceSaveResult {
  index: number | null
  confirm: string | null
  warning: string | null
  calculation: InvoiceCalculation | null
}

/** What the form holds while it is filled in: every entry is text, dates are dd/mm/yyyy. */
export interface InvoiceValues {
  invoiceNo: string
  invoiceDate: string
  payTo: string
  payee: string
  stayType: string
  roomType: string
  receiptMode: string
  receiptDate: string
  followUpDate: string
  excessAmount: string
  initialAmount: string
  uhcNo: string
  amounts: Record<string, string>
  texts: Record<string, string>
  remarks: string
}

/** The messages of the desktop's SaveClaim (the server words them the same). */
export const messages = {
  noCase: 'Please select a record before proceeding! ',
  noDischarge: 'Please Enter Date of Discharge! ',
  noPayTo: 'Please select who to be paid (Member / Hospital )! ',
  noStayType: 'Please select a Stay Type! ',
  noPayee: 'Please key in the person/hospital to be paid! ',
  noInvoiceNo: 'Please key in Invoice No.! ',
  noInvoiceDate: 'Please key in Invoice date! ',
  badInvoiceDate: 'Please key in correct Invoice date! ',
  noReceiptDate: 'Please key in Invoice Receipt date! ',
  noReceiptMode: 'Please key in Invoice Receipt Mode! ',
  noExcess: 'Please key in Excess Amount! ',
  noInitialAmount: 'Please key in Initial Invoice Amount! ',
  noProviderName: 'Please Enter Hospital Name or Clinic Name!',
  differentHospital: 'Different Hospital. Do you want to Proceed? ',
  selectCaseFirst: 'Please select the case number first!',
  removeSure: 'Are you sure?',
} as const

/** Provider names that stand for a kind of provider: the actual provider's name has to be typed beside them. */
export const genericProviders = [
  'DENTAL CLINIC',
  'DIALYSIS CENTRE',
  'FOREIGN HOSPITAL',
  'GENERAL PRACTITIONER',
  'GOVERNMENT HOSPITAL',
  'NON-PANEL HOSPITAL',
  'SPECIALIST CLINIC',
]

const amountText = (v: number | null | undefined) => (v == null ? '' : String(v))

/** An invoice loaded from the server as the form's values; with the form's fields given, money is shown with two decimals as the totals are. */
export function valuesOf(form: InvoiceFormDto, fields: readonly Pick<InvoiceField, 'key' | 'kind'>[] = []): InvoiceValues {
  const kinds = new Map(fields.map((f) => [f.key, f.kind]))
  return {
    invoiceNo: S(form.invoiceNo),
    invoiceDate: isoToDmy(form.invoiceDate),
    payTo: S(form.payTo),
    payee: S(form.payee),
    stayType: S(form.stayType),
    roomType: S(form.roomType),
    receiptMode: S(form.receiptMode),
    receiptDate: isoToDmy(form.receiptDate),
    followUpDate: isoToDmy(form.followUpDate),
    excessAmount: amountText(form.excessAmount),
    initialAmount: amountText(form.initialAmount),
    uhcNo: S(form.uhcNo),
    amounts: Object.fromEntries(Object.entries(form.amounts).map(([k, v]) => [k, kinds.has(k) ? shown(v, kinds.get(k) as FieldKind) : amountText(v)])),
    texts: Object.fromEntries(Object.entries(form.texts).map(([k, v]) => [k, S(v)])),
    remarks: S(form.remarks),
  }
}

/** A new invoice: the case's stay type and remark are the ones to start from (the remark is saved with the invoice, so it must not start empty); who is paid is left to be chosen. */
export function emptyValues(header: Pick<InvoiceCaseHeader, 'stayType' | 'remarks'>): InvoiceValues {
  return {
    invoiceNo: '',
    invoiceDate: '',
    payTo: '',
    payee: '',
    stayType: S(header.stayType),
    roomType: '',
    receiptMode: '',
    receiptDate: '',
    followUpDate: '',
    excessAmount: '',
    initialAmount: '',
    uhcNo: '',
    amounts: {},
    texts: {},
    remarks: S(header.remarks),
  }
}

const number = (s: string): number | null => {
  const t = s.replace(/,/g, '').trim()
  if (t === '' || t === '-') return null
  const n = Number(t)
  return Number.isNaN(n) ? null : n
}

/** The form's values as the request the server takes. */
export function toRequest(values: InvoiceValues, caseNo: string, index: number | null, confirmDifferentHospital: boolean): InvoiceFormDto {
  const amounts: Record<string, number | null> = {}
  for (const [key, text] of Object.entries(values.amounts)) amounts[key] = number(text)
  const texts: Record<string, string | null> = {}
  for (const [key, text] of Object.entries(values.texts)) texts[key] = text
  return {
    caseNo,
    index,
    invoiceNo: values.invoiceNo.trim() || null,
    invoiceDate: isoDmy(values.invoiceDate),
    payTo: values.payTo || null,
    payee: values.payee.trim() || null,
    stayType: values.stayType.trim() || null,
    roomType: values.roomType.trim() || null,
    receiptMode: values.receiptMode.trim() || null,
    receiptDate: isoDmy(values.receiptDate),
    followUpDate: isoDmy(values.followUpDate),
    excessAmount: number(values.excessAmount),
    initialAmount: number(values.initialAmount),
    uhcNo: values.uhcNo.trim() || null,
    amounts,
    texts,
    remarks: values.remarks,
    confirmDifferentHospital,
  }
}

/** SaveClaim's checks in the desktop's order; the first that fails, or null. `payeeName` is the payee hospital's name when the hospital is paid. */
export function firstProblem(
  values: InvoiceValues,
  header: Pick<InvoiceCaseHeader, 'memberName' | 'discharged'> | undefined,
  payeeName: string | null,
): string | null {
  const hospital = values.payTo === 'H'
  if (!header || !S(header.memberName)) return messages.noCase
  if (!header.discharged) return messages.noDischarge
  if (values.payTo !== 'H' && values.payTo !== 'M') return messages.noPayTo
  if (!values.stayType.trim()) return messages.noStayType
  if (!values.payee.trim()) return messages.noPayee
  if (!values.invoiceNo.trim()) return messages.noInvoiceNo
  if (!values.invoiceDate.trim()) return messages.noInvoiceDate
  if (isoDmy(values.invoiceDate) === null) return messages.badInvoiceDate
  if (!hospital && !values.receiptDate.trim()) return messages.noReceiptDate
  if (!hospital && !values.receiptMode.trim()) return messages.noReceiptMode
  if (hospital && !values.excessAmount.trim()) return messages.noExcess
  if (!values.initialAmount.trim()) return messages.noInitialAmount
  if (hospital && payeeName && genericProviders.includes(payeeName.trim().toUpperCase()) && !(values.texts.INVHospName ?? '').trim())
    return messages.noProviderName
  return null
}

/** Whether the user has to be asked: the hospital to be paid is not the case's. */
export const needsHospitalConfirmation = (values: Pick<InvoiceValues, 'payTo' | 'payee'>, header: Pick<InvoiceCaseHeader, 'hospitalCode'>): boolean =>
  values.payTo === 'H' && values.payee.trim().toUpperCase() !== S(header.hospitalCode).toUpperCase()

/** The tax era of the case's plan: plans 2 to 5 use the new tax entries and the others the old ones (cmdAdd_Click). */
export const taxEra = (planCode: string | null | undefined): 'new' | 'old' => ('2345'.includes(S(planCode).charAt(0)) && S(planCode) !== '' ? 'new' : 'old')

/** Whether a field of the form can be typed in, given the case and what is typed. */
export function isEditable(field: InvoiceField, header: Pick<InvoiceCaseHeader, 'planCode' | 'modality'>, amounts: Record<string, string>): boolean {
  if (field.computed) return false
  if (field.tax && field.tax !== taxEra(header.planCode)) return false
  const modality = S(header.modality).toUpperCase()
  if (field.frame === 'S' && modality === 'N') return false
  if (field.frame === 'N' && modality === 'S') return false
  // a sum is typed only while none of its parts has a value; otherwise it is the parts added up
  if (field.sumOf && field.sumOf.some((k) => (amounts[k] ?? '').trim() !== '')) return false
  return true
}

/** The fields grouped by their section, in the order the form lists them. */
export function bySection(fields: readonly InvoiceField[]): { section: string; fields: InvoiceField[] }[] {
  const groups: { section: string; fields: InvoiceField[] }[] = []
  for (const f of fields) {
    const last = groups.find((g) => g.section === f.section)
    if (last) last.fields.push(f)
    else groups.push({ section: f.section, fields: [f] })
  }
  return groups
}

/** Amounts as the form shows them: two decimals for money, as typed for days. */
export const shown = (v: number | null | undefined, kind: FieldKind): string => (v == null ? '' : kind === 'Money' ? v.toFixed(2) : String(v))

/** A typed amount: digits, one decimal point and an optional leading minus (credits exist). */
export const cleanAmount = (v: string): string => {
  const negative = v.trimStart().startsWith('-')
  const body = v.replace(/[^\d.]/g, '')
  const dot = body.indexOf('.')
  const one = dot === -1 ? body : body.slice(0, dot + 1) + body.slice(dot + 1).replace(/\./g, '')
  return (negative ? '-' : '') + one
}
