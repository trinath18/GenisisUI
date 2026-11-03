// Receipt > From Member (legacy FrmReceiptMember, "Receipt From Member"): the criteria, the ticking of a debit note (lstReceiptMBM_ItemCheck / ProcessCheckedItem), the staging of the amounts of a ticked claim
// (CmdAdd_Click), the checks of Save and Update, and the files Print OR and Print to File write. The server repeats the checks and writes the receipts.

import * as yup from 'yup'
import type { Option } from '../../components/Field'
import type { CsvColumn } from '../../lib/exportCsv'
import { formatMoney } from '../../lib/format'
import { amount, dmyDate, optionalText } from '../../lib/validation'
import { isoDmy, isoToDmy } from '../case/caseShared'

export interface MemberApiRow {
  debitNo: string | null
  paymentStatus: string | null
  caseNo: string | null
  claimVersion: number
  payableByMedix: number | null
  receiptAmt: number | null
  receiptIndex: number | null
  receiptNo: string | null
  receiptDate: string | null
  accMonth: number | null
  accYear: number | null
  bankCharge: number | null
  contraCaseNo: string | null
  contraVersionNo: string | null
  contraCaseAmt: number | null
  gainLoss: number | null
  misc: number | null
  discount: number | null
  amtPaid: number | null
  writeOff: number | null
  medixReceipt: number | null
  remarks: string | null
  memberNo: string | null
  memberName: string | null
  payorCode: string | null
}

export interface MemberSearchResult {
  rows: MemberApiRow[]
  receivedAmount: number
  authorised: boolean
  truncated: boolean
}

export interface OfficialLine {
  caseNo: string | null
  claimVersion: string | null
  receiptNo: string | null
  receiptDate: string | null
  healthType: string | null
  chequeNo: string | null
  receiptAmt: number | null
  debitNo: string | null
  memberName: string | null
  patientName: string | null
}

export interface ReceiptApiRow {
  receiptNo: string | null
  receiptDate: string | null
  receiptAmt: number | null
  chequeNo: string | null
  receiptRemarks: string | null
  accMonth: number | null
  accYear: number | null
  caseNo: string | null
  claimVersion: number
  bankCharge: number | null
  contraCaseNo: string | null
  contraVersionNo: string | null
  contraCaseAmt: number | null
  gainLoss: number | null
  misc: number | null
  discount: number | null
  amtPaid: number | null
  writeOff: number | null
  medixReceipt: number | null
  remarks: string | null
}

/** The amounts staged for a ticked claim, as the entry boxes hold them (text). */
export interface Staged {
  bankCharge: string
  contra: string
  contraAmt: string
  gainLoss: string
  misc: string
  discount: string
  writeOff: string
  medixRec: string
  remarks: string
}

export const noStaged: Staged = { bankCharge: '', contra: '', contraAmt: '', gainLoss: '', misc: '', discount: '', writeOff: '', medixRec: '', remarks: '' }

/** A line of the list: the debit note and what the user has done to it on this screen. */
export interface MemberRow {
  key: string
  api: MemberApiRow
  /** Amount: the debit note, positive. */
  amount: number
  /** Amt Rec'd: what this receipt row received. */
  received: number | null
  /** "Full", "Partial" or "". */
  status: string
  /** OS Amt. */
  outstanding: number | null
  /** Amt Receiving. */
  receiving: number | null
  /** Amt Paid, as the row has it (the staging box only sets the amount receiving). */
  amtPaid: number | null
  staged: Staged
}

export interface Tick {
  row: MemberRow
  /** The change of the Checked Amt. */
  delta: number
  /** The desktop's message when the tick is refused. */
  refused?: string
}

const round = (n: number) => Math.round(n * 100) / 100
const num = (v: unknown) => (typeof v === 'string' && v.trim() !== '' && !Number.isNaN(Number(v)) ? Number(v) : null)
const text = (v: number | null) => (v == null ? '' : String(v))

export const rowKey = (r: MemberApiRow) => `${r.caseNo}|${r.claimVersion}|${r.receiptIndex ?? ''}`

/** ReceiptFrMBMListing: a line of the list. Amount is the debit note as a positive; OS Amt is the amount less this row's receipt for a partial payment, nothing for a full one, the whole amount for none. */
export function toRow(api: MemberApiRow): MemberRow {
  const amountDue = round(-(api.payableByMedix ?? 0))
  const received = api.receiptAmt ?? 0
  const paid = (api.paymentStatus ?? '').trim()
  return {
    key: rowKey(api),
    api,
    amount: amountDue,
    received,
    status: paid === 'F' ? 'Full' : paid === 'P' ? 'Partial' : '',
    outstanding: paid === 'P' ? round(amountDue - received) : paid === 'F' ? 0 : amountDue,
    receiving: null,
    amtPaid: api.amtPaid,
    staged: {
      bankCharge: text(api.bankCharge),
      contra: api.contraCaseNo ? `${api.contraCaseNo.trim()}-${(api.contraVersionNo ?? '').trim()}` : '',
      contraAmt: text(api.contraCaseAmt),
      gainLoss: text(api.gainLoss),
      misc: text(api.misc),
      discount: text(api.discount),
      writeOff: text(api.writeOff),
      medixRec: text(api.medixReceipt),
      remarks: api.remarks ?? '',
    },
  }
}

export const hasReceipt = (r: MemberRow) => r.api.receiptIndex != null

/**
 * ProcessCheckedItem. Ticking: a user who is not authorised cannot tick a row that is paid in full ("Payment has been made!"); a partly paid row becomes Full for what is outstanding; a row with no
 * receipt becomes Full for the whole amount. An authorised user can tick a full row again (Full for the whole amount, nothing outstanding). Unticking puts the row back as it was listed and clears what was
 * staged. The Checked Amt moves by the amount receiving.
 */
export function tick(row: MemberRow, ticked: boolean, authorised: boolean): Tick {
  const paid = (row.api.paymentStatus ?? '').trim()
  const receipt = hasReceipt(row)
  if (ticked) {
    if (receipt && paid === 'F' && !authorised) return { row, delta: 0, refused: 'Payment has been made!' }
    if (receipt && paid === 'P') {
      const receiving = row.outstanding ?? 0
      return { row: { ...row, status: 'Full', receiving, outstanding: 0 }, delta: receiving }
    }
    if (receipt && paid === 'F') return { row: { ...row, status: 'Full', receiving: row.amount, outstanding: null, received: null }, delta: row.amount }
    return { row: { ...row, status: 'Full', receiving: row.amount, outstanding: 0 }, delta: row.amount }
  }

  const back = toRow(row.api)
  const cleared = { ...back, receiving: null, staged: { ...noStaged } }
  if (receipt && paid === 'F') return { row: { ...cleared, outstanding: null }, delta: -row.amount }
  return { row: cleared, delta: -(row.receiving ?? 0) }
}

/** What a staged claim is told to the entry boxes for CmdAdd_Click. */
export interface StageValues {
  bankCharge: string
  contraCase: string
  contraVersion: string
  contraAmt: string
  gainLoss: string
  misc: string
  discount: string
  amtPaid: string
  writeOff: string
  medixRec: string
  remarks: string
}

/** CmdAdd_Click's checks, in the desktop's order. */
export function stageProblem(row: MemberRow, v: StageValues): { field: keyof StageValues; message: string } | null {
  const contraCase = v.contraCase.trim()
  const contraVersion = v.contraVersion.trim()
  if ((contraCase !== '' && contraVersion === '') || (contraCase === '' && contraVersion !== ''))
    return { field: 'contraCase', message: 'Invalid Contra Case..., Please Keyin Contra Case No. or Contra Version ' }
  if (contraCase !== '' && contraVersion !== '' && v.contraAmt.trim() === '') return { field: 'contraAmt', message: 'Please Keyin Contra Case Amount ' }
  if ((num(v.amtPaid) ?? 0) > row.amount) return { field: 'amtPaid', message: 'Invalid Amount Paid ! ' }
  return null
}

/**
 * CmdAdd_Click after "Update ...?": an amount paid replaces the amount receiving (the Checked Amt follows); the claim is Full when it equals the amount, or when it equals what was being received, and
 * Partial otherwise with the difference outstanding. The other boxes are copied to the row.
 */
export function stage(row: MemberRow, v: StageValues): Tick {
  let next: MemberRow = row
  let delta = 0
  const paid = num(v.amtPaid)
  if (paid !== null) {
    const before = row.receiving ?? 0
    let status = 'Full'
    let outstanding = row.outstanding
    if (round(row.amount) !== round(paid)) {
      status = 'Partial'
      outstanding = round(before - paid)
      if (before === paid) status = 'Full'
    }
    next = { ...next, receiving: paid, status, outstanding }
    delta = paid - before
  }

  const contra = `${v.contraCase.trim()}-${v.contraVersion.trim()}`
  return {
    row: {
      ...next,
      staged: {
        bankCharge: v.bankCharge,
        contra: contra === '-' ? '' : contra,
        contraAmt: v.contraAmt,
        gainLoss: v.gainLoss,
        misc: v.misc,
        discount: v.discount,
        writeOff: v.writeOff,
        medixRec: v.medixRec,
        remarks: v.remarks,
      },
    },
    delta,
  }
}

export interface EntryValues {
  receiptNo: string
  receiptDate: string
  amount: string
  chequeNo: string
  receiptRemarks: string
  accMonth: string
  accYear: string
}

/** cmdSave_Click's checks, in the desktop's order. */
export function saveProblem(v: EntryValues): { field: keyof EntryValues; message: string } | null {
  if (v.receiptNo.trim() === '') return { field: 'receiptNo', message: 'Please Enter Receipt No' }
  if (!isoDmy(v.receiptDate)) return { field: 'receiptDate', message: 'Please Enter Receipt Date' }
  if (v.amount.trim() === '') return { field: 'amount', message: 'Please Enter Amount' }
  if (v.chequeNo.trim() === '') return { field: 'chequeNo', message: 'Please Enter Cheque No' }
  return null
}

/** CmdUpdate_Click's checks, in the desktop's order. */
export function updateProblem(v: EntryValues, rows: number): { field: keyof EntryValues | 'list'; message: string } | null {
  if (rows === 0) return { field: 'list', message: 'Please select the record' }
  if (v.receiptNo.trim() === '') return { field: 'receiptNo', message: 'Please Enter Receipt No!' }
  if (v.receiptDate.trim() !== '' && v.receiptDate !== '__/__/____' && !isoDmy(v.receiptDate)) return { field: 'receiptDate', message: 'Invalid Receipt Date!' }
  if (!isoDmy(v.receiptDate)) return { field: 'receiptDate', message: 'Please Enter Receipt Date' }
  if (v.chequeNo.trim() === '') return { field: 'chequeNo', message: 'Please Enter Cheque No!' }
  if (v.amount.trim() === '') return { field: 'amount', message: 'Please Enter Cheque Amt!' }
  return null
}

/** txtReceiptDate_LostFocus: the account period is the month and year of the receipt date. */
export function periodOf(receiptDate: string): { month: string; year: string } | null {
  const iso = isoDmy(receiptDate)
  return iso ? { month: String(Number(iso.slice(5, 7))), year: iso.slice(0, 4) } : null
}

const textOrUndefined = (v: string) => v.trim() || undefined
const amountOrUndefined = (v: string) => num(v) ?? undefined

/** The contra case of a staged line: "case-version", cut at the first dash. */
export function splitContra(contra: string): { contraCase: string | undefined; contraVersion: string | undefined } {
  const at = contra.indexOf('-')
  const contraCase = (at < 0 ? contra : contra.slice(0, at)).trim()
  const contraVersion = at < 0 ? '' : contra.slice(at + 1).trim()
  return { contraCase: contraCase || undefined, contraVersion: contraVersion || undefined }
}

/** The request of Save: the receipt and each ticked claim with what is received for it. */
export function saveRequest(v: EntryValues, ticked: MemberRow[]) {
  return {
    receiptNo: v.receiptNo.trim(),
    receiptDate: isoDmy(v.receiptDate) ?? undefined,
    amount: amountOrUndefined(v.amount),
    chequeNo: v.chequeNo.trim(),
    remarks: textOrUndefined(v.receiptRemarks),
    accMonth: amountOrUndefined(v.accMonth),
    accYear: amountOrUndefined(v.accYear),
    items: ticked.map((r) => ({
      caseNo: r.api.caseNo,
      version: r.api.claimVersion,
      status: r.status.startsWith('F') ? 'F' : 'P',
      paymentAmt: r.receiving ?? undefined,
      bankCharge: amountOrUndefined(r.staged.bankCharge),
      gainLoss: amountOrUndefined(r.staged.gainLoss),
      misc: amountOrUndefined(r.staged.misc),
      discount: amountOrUndefined(r.staged.discount),
      amtPaid: r.amtPaid ?? undefined,
      writeOff: amountOrUndefined(r.staged.writeOff),
      medixReceipt: amountOrUndefined(r.staged.medixRec),
      remarks: textOrUndefined(r.staged.remarks),
      ...splitContra(r.staged.contra),
      contraAmt: amountOrUndefined(r.staged.contraAmt),
    })),
  }
}

/** The request of Update (Edit): the receipt row with the entry boxes' values; an empty box stores nothing. */
export function updateRequest(v: EntryValues, s: StageValues, receiptIndex: number) {
  return {
    receiptIndex,
    receiptNo: v.receiptNo.trim(),
    receiptDate: isoDmy(v.receiptDate) ?? undefined,
    amount: amountOrUndefined(v.amount),
    chequeNo: v.chequeNo.trim(),
    receiptRemarks: textOrUndefined(v.receiptRemarks),
    accMonth: amountOrUndefined(v.accMonth),
    accYear: amountOrUndefined(v.accYear),
    bankCharge: amountOrUndefined(s.bankCharge),
    gainLoss: amountOrUndefined(s.gainLoss),
    misc: amountOrUndefined(s.misc),
    discount: amountOrUndefined(s.discount),
    amtPaid: amountOrUndefined(s.amtPaid),
    writeOff: amountOrUndefined(s.writeOff),
    medixReceipt: amountOrUndefined(s.medixRec),
    remarks: textOrUndefined(s.remarks),
    contraCase: textOrUndefined(s.contraCase),
    contraVersion: textOrUndefined(s.contraVersion),
    contraAmt: amountOrUndefined(s.contraAmt),
  }
}

/** lstReceiptMBM_Click (Edit): the boxes filled from a receipt row. */
export function entryOf(r: ReceiptApiRow): { entry: EntryValues; stage: StageValues; claim: string } {
  return {
    entry: {
      receiptNo: r.receiptNo ?? '',
      receiptDate: isoToDmy(r.receiptDate),
      amount: text(r.receiptAmt),
      chequeNo: r.chequeNo ?? '',
      receiptRemarks: r.receiptRemarks ?? '',
      accMonth: text(r.accMonth),
      accYear: text(r.accYear),
    },
    stage: {
      bankCharge: text(r.bankCharge),
      contraCase: r.contraCaseNo ?? '',
      contraVersion: r.contraVersionNo ?? '',
      contraAmt: text(r.contraCaseAmt),
      gainLoss: text(r.gainLoss),
      misc: text(r.misc),
      discount: text(r.discount),
      amtPaid: text(r.amtPaid),
      writeOff: text(r.writeOff),
      medixRec: text(r.medixReceipt),
      remarks: r.remarks ?? '',
    },
    claim: `${(r.caseNo ?? '').trim()}-${r.claimVersion}`,
  }
}

export const entryDefaults: EntryValues = { receiptNo: '', receiptDate: '', amount: '', chequeNo: '', receiptRemarks: '', accMonth: '', accYear: '' }
export const stageDefaults: StageValues = {
  bankCharge: '',
  contraCase: '',
  contraVersion: '',
  contraAmt: '',
  gainLoss: '',
  misc: '',
  discount: '',
  amtPaid: '',
  writeOff: '',
  medixRec: '',
  remarks: '',
}

export const entrySchema = yup.object({
  receiptNo: optionalText(),
  receiptDate: dmyDate('Invalid Date Format!'),
  amount: amount(),
  chequeNo: optionalText(),
  receiptRemarks: optionalText(),
  accMonth: optionalText(),
  accYear: optionalText(),
  bankCharge: amount(),
  contraCase: optionalText(),
  contraVersion: optionalText(),
  contraAmt: amount(),
  gainLoss: amount(),
  misc: amount(),
  discount: amount(),
  amtPaid: amount(),
  writeOff: amount(),
  medixRec: amount(),
  remarks: optionalText(),
})

export interface SearchValues {
  scan: boolean
  caseFrom: string
  caseTo: string
  memberNo: string
  memberName: string
  payor: string
  status: string
  recFrom: string
  recTo: string
  recEmpty: boolean
  recDateFrom: string
  recDateTo: string
  drFrom: string
  drTo: string
  drEmpty: boolean
  amtFrom: string
  amtTo: string
  amtEmpty: boolean
  mthFrom: string
  mthTo: string
  mthEmpty: boolean
  yrFrom: string
  yrTo: string
  yrEmpty: boolean
}

export const searchDefaults: SearchValues = {
  scan: true,
  caseFrom: '',
  caseTo: '',
  memberNo: '',
  memberName: '',
  payor: '',
  status: '0',
  recFrom: '',
  recTo: '',
  recEmpty: false,
  recDateFrom: '',
  recDateTo: '',
  drFrom: '',
  drTo: '',
  drEmpty: false,
  amtFrom: '',
  amtTo: '',
  amtEmpty: false,
  mthFrom: '',
  mthTo: '',
  mthEmpty: false,
  yrFrom: '',
  yrTo: '',
  yrEmpty: false,
}

export const searchSchema = yup.object({
  scan: yup.boolean().default(true),
  caseFrom: optionalText(),
  caseTo: optionalText(),
  memberNo: optionalText(),
  memberName: optionalText(),
  payor: optionalText(),
  status: optionalText(),
  recFrom: optionalText(),
  recTo: optionalText(),
  recEmpty: yup.boolean().default(false),
  recDateFrom: dmyDate(),
  recDateTo: dmyDate(),
  drFrom: optionalText(),
  drTo: optionalText(),
  drEmpty: yup.boolean().default(false),
  amtFrom: amount(),
  amtTo: amount(),
  amtEmpty: yup.boolean().default(false),
  mthFrom: optionalText(),
  mthTo: optionalText(),
  mthEmpty: yup.boolean().default(false),
  yrFrom: optionalText(),
  yrTo: optionalText(),
  yrEmpty: yup.boolean().default(false),
}) as yup.ObjectSchema<SearchValues>

/** Payment Status (CboPayment). */
export const statusOptions: Option[] = [
  { value: '0', label: '0 - All' },
  { value: '1', label: '1 - Paid' },
  { value: '2', label: '2 - Unpaid' },
  { value: '3', label: '3 - Partial Paid' },
  { value: '4', label: '4 - Paid & Partial Paid' },
  { value: '5', label: '5 - Unpaid & Partial Paid' },
]

export const monthOptions: Option[] = Array.from({ length: 12 }, (_, i) => ({ value: String(i + 1), label: String(i + 1) }))

/** The scan search keeps the list and adds to it; the desktop refused a worksheet that is in the list already ("Data has been uploaded!"). */
export const alreadyListed = (rows: MemberRow[], scanned: string) => rows.some((r) => (r.api.caseNo ?? '').trim() === scanned.trim().toUpperCase())

const t = (v: string) => v.trim() || undefined
const n = (v: string) => num(v) ?? undefined

/** The query of the search. */
export const searchParams = (v: SearchValues) => ({
  scan: v.scan,
  caseFrom: t(v.caseFrom),
  caseTo: v.scan ? undefined : t(v.caseTo),
  memberNo: t(v.memberNo),
  memberName: t(v.memberName),
  payor: t(v.payor),
  status: Number(v.status || 0),
  recFrom: t(v.recFrom),
  recTo: t(v.recTo),
  recEmpty: v.recEmpty,
  recDateFrom: isoDmy(v.recDateFrom) ?? undefined,
  recDateTo: isoDmy(v.recDateTo) ?? undefined,
  drFrom: t(v.drFrom),
  drTo: t(v.drTo),
  drEmpty: v.drEmpty,
  amtFrom: n(v.amtFrom),
  amtTo: n(v.amtTo),
  amtEmpty: v.amtEmpty,
  mthFrom: n(v.mthFrom),
  mthTo: n(v.mthTo),
  mthEmpty: v.mthEmpty,
  yrFrom: n(v.yrFrom),
  yrTo: n(v.yrTo),
  yrEmpty: v.yrEmpty,
})

const m = (value: number | null) => (value == null ? '' : formatMoney(value))

/** The columns of the list after the tick box, headed as the desktop headed them. */
export const memberColumns: CsvColumn<MemberRow>[] = [
  { label: 'Reference No', value: (r) => r.api.debitNo ?? '' },
  { label: 'Pymt Status', value: (r) => r.status },
  { label: 'WKS No', value: (r) => `${(r.api.caseNo ?? '').trim()}-${r.api.claimVersion}` },
  { label: 'Amount', value: (r) => m(r.amount) },
  { label: "Amt Rec'd", value: (r) => m(r.received) },
  { label: 'OS Amt', value: (r) => m(r.outstanding) },
  { label: 'Amt Receiving', value: (r) => m(r.receiving) },
  { label: 'ReceiptIndex', value: (r) => (r.api.receiptIndex == null ? '' : String(r.api.receiptIndex)) },
  { label: 'Rept No', value: (r) => r.api.receiptNo ?? '' },
  { label: 'Rept Date', value: (r) => isoToDmy(r.api.receiptDate) },
  { label: 'Acc Period', value: (r) => (r.api.accMonth == null && r.api.accYear == null ? '' : `${r.api.accMonth ?? ''}/${r.api.accYear ?? ''}`) },
  { label: 'Bank Charge', value: (r) => r.staged.bankCharge },
  { label: 'Contra Case No', value: (r) => r.staged.contra },
  { label: 'Contra Amt', value: (r) => r.staged.contraAmt },
  { label: 'Clm Gain Loss', value: (r) => r.staged.gainLoss },
  { label: 'Misc Diff', value: (r) => r.staged.misc },
  { label: 'Discount', value: (r) => r.staged.discount },
  { label: 'Amt Paid', value: (r) => text(r.amtPaid) },
  { label: 'Write Off', value: (r) => r.staged.writeOff },
  { label: 'Medix Receipt', value: (r) => r.staged.medixRec },
  { label: 'Remarks', value: (r) => r.staged.remarks },
]

/** Print OR: the official receipt as the lines of a CSV file (the desktop filled the OR-MBMS or OR-MBMN Excel template by the health type). */
export function officialReceiptRows(lines: OfficialLine[]): string[][] {
  const first = lines[0]
  return [
    [(first.healthType ?? '').trim() === 'S' ? 'Official Receipt (Sihat)' : 'Official Receipt'],
    ['Receipt No', first.receiptNo ?? ''],
    ['Received from', first.memberName ?? ''],
    ['Receipt Date', isoToDmy(first.receiptDate)],
    ['Amount', m(first.receiptAmt)],
    ['Cheque No', first.chequeNo ?? ''],
    [],
    ['Patient', 'DR No', 'Claim No'],
    ...lines.map((l) => [l.patientName ?? '', l.debitNo ?? '', `${(l.caseNo ?? '').trim()}-${l.claimVersion ?? ''}`]),
  ]
}
