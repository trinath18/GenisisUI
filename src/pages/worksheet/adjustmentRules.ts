// Pure rules of Worksheet > Worksheet Adjustment's Update button (legacy frmWorksheetAdj2013 cmdUpdate_Click / SaveOtherInfo): the form values, the checks the
// desktop made before saving (the server repeats them), and the request. The payment details and remarks of one worksheet version are all that is edited here.

import * as yup from 'yup'
import { dmyDate, optionalText } from '../../lib/validation'
import { isoDmy, isoToDmy, S } from '../case/caseShared'
import type { EnquiryInvoice, EnquiryResult } from './enquiryRules'

export interface AdjustmentLookups {
  banks: string[]
  states: string[]
  paymentModes: string[]
}

export interface PaymentValues {
  lastDocumentDate: string
  payTo: string
  gpName: string
  bank: string
  accountNo: string
  paymentMode: string
  attention: string
  address1: string
  address2: string
  address3: string
  postCode: string
  city: string
  state: string
  note: string
  worksheetRemarks: string
  creditDebitNoteRemarks: string
}

/** The text-box limits: what the database columns hold. */
export const limits = {
  payTo: 50,
  gpName: 50,
  bank: 40,
  accountNo: 30,
  attention: 60,
  address1: 50,
  address2: 50,
  address3: 50,
  postCode: 6,
  city: 50,
  state: 50,
  note: 100,
  worksheetRemarks: 200,
  creditDebitNoteRemarks: 200,
} as const

const max = (name: string, length: number) => optionalText().max(length, `${name} can have at most ${length} characters.`)

export const paymentSchema: yup.ObjectSchema<PaymentValues> = yup.object({
  lastDocumentDate: dmyDate().default(''),
  payTo: max('Pay To', limits.payTo),
  gpName: max('GP', limits.gpName),
  bank: max('Bank', limits.bank),
  accountNo: max('A/C No', limits.accountNo),
  paymentMode: optionalText().oneOf(['', 'BY POST', 'BANK-IN'], 'Payment Mode must be BY POST or BANK-IN.'),
  attention: max('Attention', limits.attention),
  address1: max('Address 1', limits.address1),
  address2: max('Address 2', limits.address2),
  address3: max('Address 3', limits.address3),
  postCode: max('Post Code', limits.postCode),
  city: max('City', limits.city),
  state: max('State', limits.state),
  note: max('Note', limits.note),
  worksheetRemarks: max('Worksheet remarks', limits.worksheetRemarks),
  creditDebitNoteRemarks: max('Credit/Debit Note Remarks', limits.creditDebitNoteRemarks),
})

/** The pay-to of the last invoice of the version: MBMHosStatus in the desktop (H hospital, M member). */
export function lastPayTo(invoices: readonly Pick<EnquiryInvoice, 'invIndex' | 'payTo'>[]): string {
  const last = [...invoices].sort((a, b) => b.invIndex - a.invIndex)[0]
  return S(last?.payTo)
}

/** cmdUpdate_Click's checks, in the desktop's order. They apply only to a worksheet paid to the member (M). */
export function paymentProblem(payTo: string, v: Pick<PaymentValues, 'bank' | 'accountNo' | 'address1' | 'postCode' | 'city' | 'state'>): string | null {
  if (payTo.trim().toUpperCase() !== 'M') return null
  const bank = v.bank.trim()
  const account = v.accountNo.trim()
  if (bank !== '' && account === '') return 'Please Enter Bank Account Number'
  if (bank === '' && account !== '') return 'Please Enter Bank Name'
  if (v.address1.trim() === '') return "Please Enter Member's Address"
  if (v.postCode.trim() === '') return 'Please Enter Post Code'
  if (v.city.trim() === '') return 'Please Enter City'
  if (v.state.trim() === '') return 'Please Enter State'
  return null
}

/** What the screen shows for the version: the saved payment details, remarks and the member's address. */
export function paymentValuesOf(result: EnquiryResult): PaymentValues {
  const h = result.header
  const o = result.others
  return {
    lastDocumentDate: isoToDmy(h.lastDocumentDate),
    payTo: S(h.payTo),
    gpName: S(h.gpName),
    bank: S(h.bank),
    accountNo: S(h.accountNo),
    paymentMode: S(o?.paymentMode),
    attention: S(o?.attention),
    address1: S(o?.address1),
    address2: S(o?.address2),
    address3: S(o?.address3),
    postCode: S(o?.postCode),
    city: S(o?.city),
    state: S(o?.state),
    note: S(o?.note),
    worksheetRemarks: S(o?.worksheetRemarks),
    creditDebitNoteRemarks: S(o?.creditDebitRemarks),
  }
}

/** The request body: dates go as ISO days, empty text as empty text. */
export function toUpdateRequest(v: PaymentValues) {
  return { ...v, lastDocumentDate: v.lastDocumentDate.trim() === '' ? null : isoDmy(v.lastDocumentDate) }
}

/** The Update button works on one saved version: Master and the cumulative views (M1, M2 ...) are not versions. */
export const isSingleVersion = (version: string) => /^\d+$/.test(version)
