// Worksheet > Worksheet Registration, the Register tab (legacy frmWorksheetRegGST2015 cmdApprove_Click): the types of the server's form and result, the starting values of the
// payment fields and the request. The server runs the desktop's checks in their order and answers with the question "Are you sure?"; nothing is checked twice here.

import { isoToDmy, S } from '../case/caseShared'
import { toUpdateRequest } from './adjustmentRules'
import type { PaymentValues } from './adjustmentRules'
import type { CalculationLine, CalculationSummary } from './registrationRules'

export interface RegisterInvoice {
  index: number
  invoiceNo: string | null
  invoiceDate: string | null
  amount: number
  payAmount: number
  payTo: string | null
  stayType: string | null
  used: boolean
}

export interface RegisterCase {
  caseNo: string
  memberNo: string | null
  memberName: string | null
  patientId: string | null
  patientName: string | null
  planCode: string | null
  payorCode: string | null
  hospitalCode: string | null
  hospitalName: string | null
  claimability: string | null
  admissionDate: string | null
  dischargeDate: string | null
}

export interface RegisterStatus {
  code: string
  name: string
  text: string
}

export interface RegisterDefaults {
  lastDocumentDate: string | null
  payTo: string | null
  gpName: string | null
  bank: string | null
  accountNo: string | null
  paymentMode: string | null
  attention: string | null
  address1: string | null
  address2: string | null
  address3: string | null
  postCode: string | null
  city: string | null
  state: string | null
  note: string | null
  worksheetRemarks: string | null
  creditDebitNoteRemarks: string | null
}

export interface RegisterForm {
  case: RegisterCase
  version: number
  invoices: RegisterInvoice[]
  payTo: string | null
  roomDays: number
  icuDays: number
  lines: CalculationLine[]
  summary: CalculationSummary | null
  dueToMember: number
  notes: string[]
  defaultStatus: string
  defaults: RegisterDefaults
  statuses: RegisterStatus[]
  banks: string[]
  states: string[]
  paymentModes: string[]
  blocked: string | null
}

export interface RegisterResult {
  saved: boolean
  confirm: string | null
  version: number | null
  excessNumber: string | null
  excessLetterAdded: boolean
  memberBalance: { reason: string | null; record: string | null; before: number | null; after: number | null; applied: boolean } | null
  notes: string[]
}

/** What the payment fields start with: the member's details for a member-paid worksheet, the latest invoice as the last document. */
export function registerValuesOf(d: RegisterDefaults): PaymentValues {
  return {
    lastDocumentDate: isoToDmy(d.lastDocumentDate),
    payTo: S(d.payTo),
    gpName: S(d.gpName),
    bank: S(d.bank),
    accountNo: S(d.accountNo),
    paymentMode: S(d.paymentMode),
    attention: S(d.attention),
    address1: S(d.address1),
    address2: S(d.address2),
    address3: S(d.address3),
    postCode: S(d.postCode),
    city: S(d.city),
    state: S(d.state),
    note: S(d.note),
    worksheetRemarks: S(d.worksheetRemarks),
    creditDebitNoteRemarks: S(d.creditDebitNoteRemarks),
  }
}

/** The request body of the Register button: the status chosen, the payment details and whether the user has answered "Are you sure?" with yes. */
export function toRegisterRequest(status: string, v: PaymentValues, confirmed: boolean) {
  return { worksheetStatus: status, payment: toUpdateRequest(v), confirmed }
}

/** What to tell the user after the save: the worksheet, the excess letter and the member's limit when something was done to them. */
export function savedMessages(result: RegisterResult, caseNo: string): string[] {
  const lines = [`Record Save: ${caseNo}-${result.version}`]
  if (result.excessNumber) lines.push(`Excess letter ${result.excessNumber}${result.excessLetterAdded ? ' was made' : ' keeps the number of the first'}.`)
  const b = result.memberBalance
  if (b?.applied && b.before !== null && b.after !== null) lines.push(`The member's available limit went from ${b.before.toFixed(2)} to ${b.after.toFixed(2)}.`)
  return [...lines, ...result.notes]
}
