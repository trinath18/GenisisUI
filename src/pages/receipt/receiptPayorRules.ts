// Receipt > Payor (legacy FrmReceiptPayor, "Receipt From Payor"): the criteria, the ticking of a bordx or a claim (lstBordx_ItemCheck, lstWorksheet_ItemCheck), the staging of a claim's amounts (CmdAdd_Click),
// the checks of Save, Update and Remove and the files Print OR and Print to File write. The server repeats the checks and writes the receipts.

import * as yup from 'yup'
import type { Option } from '../../components/Field'
import type { CsvColumn } from '../../lib/exportCsv'
import { formatMoney } from '../../lib/format'
import { amount, dmyDate, optionalText } from '../../lib/validation'
import { isoDmy, isoToDmy } from '../case/caseShared'

export interface BordxApiRow {
  bordxNo: string | null
  payorCode: string | null
  receiptNo: string | null
  receiptDate: string | null
  receiptAmt: number | null
  accMonth: number | null
  accYear: number | null
  chequeNo: string | null
  pvDate: string | null
  pvNo: string | null
  checkAmt: number | null
  bordxStatus: string | null
  remark: string | null
  bordxDate: string | null
  receiptPrefix: string | null
  bordxAmount: number | null
  policyNo: string | null
  groupCompany: string | null
  received: number | null
}

export interface WsApiRow {
  caseNo: string | null
  claimVersion: number
  bordxNo: string | null
  amount: number | null
  receiptNo: string | null
  receiptDate: string | null
  receiptAmt: number | null
  accMonth: number | null
  accYear: number | null
  checkAmt: number | null
  claimStatus: string | null
  bankCharge: number | null
  contraCaseNo: string | null
  contraVersionNo: string | null
  contraCaseAmt: number | null
  gainLoss: number | null
  misc: number | null
  discount: number | null
  writeOff: number | null
  medixReceipt: number | null
  payRemarks: string | null
  chequeNo: string | null
  remark: string | null
  receiptIndex: number | null
  bordxDate: string | null
  claimCloseDate: string | null
  receiptPrefix: string | null
  policyNo: string | null
  groupCompany: string | null
  memberNo: string | null
  coverId: string | null
  patientName: string | null
  received: number | null
  pvNo: string | null
  pvDate: string | null
}

export interface PayorSearchResult {
  bordx: BordxApiRow[]
  worksheets: WsApiRow[]
  totalAmount: number
  totalReceived: number
  authorised: boolean
  truncated: boolean
}

export interface OfficialLine {
  receiptNo: string | null
  receiptDate: string | null
  bordxNo: string | null
  receiptAmt: number | null
  chequeNo: string | null
  payorName: string | null
}

export type Mode = 'bordx' | 'worksheet'

/** The amounts staged for a claim, as the boxes hold them (text). */
export interface Staged {
  bankCharge: string
  contra: string
  contraAmt: string
  gainLoss: string
  misc: string
  discount: string
  writeOff: string
  medixRec: string
  casRemark: string
}

export const noStaged: Staged = { bankCharge: '', contra: '', contraAmt: '', gainLoss: '', misc: '', discount: '', writeOff: '', medixRec: '', casRemark: '' }

/** A line of the list and what the user has done to it on this screen. */
export interface Line {
  key: string
  mode: Mode
  bordx?: BordxApiRow
  ws?: WsApiRow
  /** "Full", "Partial" or "". */
  status: string
  /** Bordx Amt / Amount. */
  amount: number
  /** Receipt Amt (the check amount of this row) / Amt Receipt. */
  received: number
  /** OS Amt. */
  outstanding: number
  /** Paying. */
  paying: number
  /** OrgStatus: F, P or "". */
  orgStatus: string
  staged: Staged
  /** The receipt row Update changes (By Worksheet). */
  receiptIndex: number | null
}

export interface Tick {
  line: Line
  /** The change of the Checked Amt. */
  delta: number
  /** The desktop's message when the tick is refused. */
  refused?: string
}

const round = (n: number) => Math.round(n * 100) / 100
const num = (v: unknown) => (typeof v === 'string' && v.trim() !== '' && !Number.isNaN(Number(v)) ? Number(v) : null)
const text = (v: number | null) => (v == null ? '' : String(v))
const orgOf = (v: string | null) => (v ?? '').trim()

/** ReceiptBordxListing: a bordx line. Status is Full with a receipt number, Partial when the bordx is partly received; OS Amt is the amount less what its receipt rows add up to. */
export function bordxLine(api: BordxApiRow): Line {
  const amountDue = round(api.bordxAmount ?? 0)
  const org = orgOf(api.bordxStatus)
  return {
    key: `${api.bordxNo}|${api.receiptNo ?? ''}`,
    mode: 'bordx',
    bordx: api,
    status: org === 'P' ? 'Partial' : (api.receiptNo ?? '').trim() !== '' ? 'Full' : '',
    amount: amountDue,
    received: round(api.checkAmt ?? 0),
    outstanding: round(amountDue - (api.received ?? 0)),
    paying: 0,
    orgStatus: org,
    staged: { ...noStaged },
    receiptIndex: null,
  }
}

/** ReceiptWorksheetListing: a claim line. OS Amt is the amount less what all the claim's receipt rows add up to. */
export function wsLine(api: WsApiRow): Line {
  const amountDue = round(api.amount ?? 0)
  const org = orgOf(api.claimStatus)
  return {
    key: `${api.caseNo}|${api.claimVersion}|${api.receiptIndex ?? ''}`,
    mode: 'worksheet',
    ws: api,
    status: org === 'P' ? 'Partial' : (api.receiptNo ?? '').trim() !== '' ? 'Full' : '',
    amount: amountDue,
    received: round(api.checkAmt ?? 0),
    outstanding: round(amountDue - (api.received ?? 0)),
    paying: 0,
    orgStatus: org,
    staged: {
      bankCharge: text(api.bankCharge),
      contra: api.contraCaseNo ? `${api.contraCaseNo.trim()}-${(api.contraVersionNo ?? '').trim()}` : '',
      contraAmt: text(api.contraCaseAmt),
      gainLoss: text(api.gainLoss),
      misc: text(api.misc),
      discount: text(api.discount),
      writeOff: text(api.writeOff),
      medixRec: text(api.medixReceipt),
      casRemark: api.payRemarks ?? '',
    },
    receiptIndex: api.receiptIndex,
  }
}

/**
 * lstBordx_ItemCheck / lstWorksheet_ItemCheck. A bordx fully received is refused to a user who is not authorised ("Record has been paid !"), one partly received to everybody ("Record has been Partial
 * Paid ! Please Pay by Receipt Type - Worksheet !"); a claim fully received is refused to a user who is not authorised. Ticking a bordx pays what is outstanding (what it received, when it is fully received
 * and the user is authorised); ticking a claim pays what is outstanding (the whole amount for one fully received), Full when it pays the amount and Partial otherwise. Unticking undoes it.
 */
export function tick(line: Line, ticked: boolean, authorised: boolean): Tick {
  const refuse = (refused: string): Tick => ({ line, delta: 0, refused })
  if (line.mode === 'bordx') {
    if (ticked) {
      if (line.orgStatus === 'F' && !authorised) return refuse('Record has been paid !')
      if (line.orgStatus === 'P') return refuse('Record has been Partial Paid ! \nPlease Pay by Receipt Type - Worksheet !')
      const paying = line.orgStatus === 'F' ? line.received : line.outstanding
      return { line: { ...line, status: 'Full', paying, outstanding: 0 }, delta: paying }
    }

    const status = line.orgStatus === 'F' ? 'Full' : line.orgStatus === 'P' ? 'Partial' : ''
    return { line: { ...line, status, outstanding: line.orgStatus === 'F' ? line.outstanding : line.paying, paying: 0 }, delta: -line.paying }
  }

  if (ticked) {
    if (line.orgStatus === 'F' && !authorised) return refuse('Record has been paid !')
    const paying = line.orgStatus === 'F' ? line.amount : line.outstanding
    const status = round(paying + line.received) >= line.amount ? 'Full' : 'Partial'
    return { line: { ...line, status, paying, outstanding: 0, receiptIndex: line.orgStatus === 'F' ? null : line.receiptIndex }, delta: paying }
  }

  const outstanding = round(line.amount - line.received)
  const status = outstanding <= 0 ? 'Full' : line.amount === outstanding ? '' : 'Partial'
  return { line: { ...line, status, paying: 0, outstanding, staged: { ...noStaged }, receiptIndex: line.ws?.receiptIndex ?? null }, delta: -line.paying }
}

/** What the claim boxes hold for CmdAdd_Click. */
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
  casRemark: string
}

/** CmdAdd_Click's checks, in the desktop's order. */
export function stageProblem(v: StageValues): { field: keyof StageValues; message: string } | null {
  const contraCase = v.contraCase.trim()
  const contraVersion = v.contraVersion.trim()
  if ((contraCase !== '' && contraVersion === '') || (contraCase === '' && contraVersion !== ''))
    return { field: 'contraCase', message: 'Invalid Contra Case..., Please Keyin Contra Case No. or Contra Version ' }
  if (contraCase !== '' && contraVersion !== '' && v.contraAmt.trim() === '') return { field: 'contraAmt', message: 'Please Keyin Contra Case Amount ' }
  return null
}

/** CmdAdd_Click warns "Over Paid ! " when the amount paid is above the claim's amount, and goes on. */
export const overPaid = (line: Line, v: StageValues) => (num(v.amtPaid) ?? 0) > line.amount

/** CmdAdd_Click after "Update <claim> ?": an amount paid becomes the paying amount (Full when it and what was received add up to the amount) and the boxes go to the line. */
export function stage(line: Line, v: StageValues): Tick {
  let next = line
  let delta = 0
  const paid = num(v.amtPaid)
  if (paid !== null) {
    next = {
      ...next,
      paying: paid,
      status: round(paid + (line.ws?.received ?? 0)) >= line.amount ? 'Full' : 'Partial',
      outstanding: round(line.amount - line.received - paid),
    }
    delta = paid - line.paying
  }

  const contra = `${v.contraCase.trim()}-${v.contraVersion.trim()}`
  return {
    line: {
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
        casRemark: v.casRemark.trim(),
      },
    },
    delta,
  }
}

export interface EntryValues {
  pvNo: string
  pvDate: string
  chequeNo: string
  receiptAmt: string
  remark: string
  receiptNo: string
  receiptDate: string
  accMonth: string
  accYear: string
}

/** cmdSave_Click's checks, in the desktop's order. */
export function saveProblem(v: EntryValues, ticked: number, checkedAmount: number): { field: keyof EntryValues | 'list'; message: string } | null {
  if (ticked === 0) return { field: 'list', message: 'Please select at least one record to be updated! ' }
  if (v.receiptAmt.trim() === '') return { field: 'receiptAmt', message: 'Please Enter Receipt Amt!' }
  if (v.chequeNo.trim() === '') return { field: 'chequeNo', message: 'Please Enter Cheque No!' }
  if (!isoDmy(v.receiptDate)) return { field: 'receiptDate', message: 'Please Enter Receipt Date' }
  if ((num(v.receiptAmt) ?? 0) !== checkedAmount && v.remark.trim() === '') return { field: 'remark', message: 'Please Enter Remark!' }
  return null
}

/** CmdUpdate_Click's checks, in the desktop's order. */
export function updateProblem(v: EntryValues, rows: number): { field: keyof EntryValues | 'list'; message: string } | null {
  if (rows === 0) return { field: 'list', message: 'Please select the record' }
  if (v.receiptAmt.trim() === '') return { field: 'receiptAmt', message: 'Please Enter Rec Amt!' }
  if (v.chequeNo.trim() === '') return { field: 'chequeNo', message: 'Please Enter Cheque No!' }
  if (!isoDmy(v.receiptDate)) return { field: 'receiptDate', message: 'Please Enter Receipt Date' }
  return null
}

/** The account period is the month and year of the receipt date until it is changed. */
export function periodOf(receiptDate: string): { month: string; year: string } | null {
  const iso = isoDmy(receiptDate)
  return iso ? { month: String(Number(iso.slice(5, 7))), year: iso.slice(0, 4) } : null
}

const t = (v: string) => v.trim() || undefined
const n = (v: string) => num(v) ?? undefined

/** The contra case of a staged line: "case-version", cut at the first dash. */
export function splitContra(contra: string): { contraCase: string | undefined; contraVersion: string | undefined } {
  const at = contra.indexOf('-')
  const contraCase = (at < 0 ? contra : contra.slice(0, at)).trim()
  const contraVersion = at < 0 ? '' : contra.slice(at + 1).trim()
  return { contraCase: contraCase || undefined, contraVersion: contraVersion || undefined }
}

const itemOf = (l: Line) => ({
  caseNo: l.ws?.caseNo,
  version: l.ws?.claimVersion,
  bordxNo: l.ws?.bordxNo,
  status: l.status.startsWith('F') ? 'F' : 'P',
  paymentAmt: l.paying,
  bankCharge: n(l.staged.bankCharge),
  gainLoss: n(l.staged.gainLoss),
  misc: n(l.staged.misc),
  discount: n(l.staged.discount),
  writeOff: n(l.staged.writeOff),
  medixReceipt: n(l.staged.medixRec),
  payRemarks: t(l.staged.casRemark),
  ...splitContra(l.staged.contra),
  contraAmt: n(l.staged.contraAmt),
  receiptIndex: l.receiptIndex ?? undefined,
})

/** The request of Save (and, with the receipt number, of Update): the receipt boxes and the ticked bordx or claims. */
export function saveRequest(mode: Mode, v: EntryValues, ticked: Line[], checkedAmount: number, receiptNo?: string) {
  return {
    mode,
    receiptAmt: n(v.receiptAmt),
    chequeNo: v.chequeNo.trim(),
    receiptDate: isoDmy(v.receiptDate) ?? undefined,
    accMonth: n(v.accMonth),
    accYear: n(v.accYear),
    pvNo: t(v.pvNo),
    pvDate: isoDmy(v.pvDate) ?? undefined,
    remark: t(v.remark),
    checkedAmount,
    receiptNo,
    bordxNos: mode === 'bordx' ? ticked.map((l) => l.bordx!.bordxNo) : [],
    items: mode === 'worksheet' ? ticked.map(itemOf) : [],
  }
}

/**
 * The request of Update: the receipt boxes and the one bordx (every claim's row of the receipt number is changed) or the one claim with its receipt row. A claim is Full when the amount paid less what its row
 * received reaches the amount (CmdUpdate_Click), Partial otherwise.
 */
export function updateRequest(mode: Mode, v: EntryValues & StageValues, line: Line) {
  const head = saveRequest(mode, v, [], 0, v.receiptNo.trim())
  if (mode === 'bordx') return { ...head, bordxNos: [line.bordx!.bordxNo] }
  const paid = n(v.amtPaid) ?? 0
  return {
    ...head,
    items: [
      {
        caseNo: line.ws?.caseNo,
        version: line.ws?.claimVersion,
        bordxNo: line.ws?.bordxNo,
        status: round(paid - line.received) >= line.amount ? 'F' : 'P',
        paymentAmt: paid,
        bankCharge: n(v.bankCharge),
        gainLoss: n(v.gainLoss),
        misc: n(v.misc),
        discount: n(v.discount),
        writeOff: n(v.writeOff),
        medixReceipt: n(v.medixRec),
        payRemarks: t(v.casRemark),
        contraCase: t(v.contraCase),
        contraVersion: t(v.contraVersion),
        contraAmt: n(v.contraAmt),
        receiptIndex: line.ws?.receiptIndex ?? undefined,
      },
    ],
  }
}

/** lstBordx_Click / lstWorksheet_Click: the boxes filled from a line. */
export function entryOf(l: Line): { entry: EntryValues; stage: StageValues; claim: string } {
  if (l.mode === 'bordx') {
    const b = l.bordx!
    return {
      entry: {
        pvNo: b.pvNo ?? '',
        pvDate: isoToDmy(b.pvDate),
        chequeNo: b.chequeNo ?? '',
        receiptAmt: text(b.receiptAmt),
        remark: b.remark ?? '',
        receiptNo: b.receiptNo ?? '',
        receiptDate: isoToDmy(b.receiptDate),
        accMonth: text(b.accMonth),
        accYear: text(b.accYear),
      },
      stage: {
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
        casRemark: '',
      },
      claim: '',
    }
  }

  const w = l.ws!
  const contra = splitContra(l.staged.contra)
  return {
    entry: {
      pvNo: w.pvNo ?? '',
      pvDate: isoToDmy(w.pvDate),
      chequeNo: w.chequeNo ?? '',
      receiptAmt: text(w.receiptAmt),
      remark: w.remark ?? '',
      receiptNo: w.receiptNo ?? '',
      receiptDate: isoToDmy(w.receiptDate),
      accMonth: text(w.accMonth),
      accYear: text(w.accYear),
    },
    stage: {
      bankCharge: l.staged.bankCharge,
      contraCase: contra.contraCase ?? '',
      contraVersion: contra.contraVersion ?? '',
      contraAmt: l.staged.contraAmt,
      gainLoss: l.staged.gainLoss,
      misc: l.staged.misc,
      discount: l.staged.discount,
      amtPaid: l.paying ? String(l.paying) : text(w.checkAmt),
      writeOff: l.staged.writeOff,
      medixRec: l.staged.medixRec,
      casRemark: l.staged.casRemark,
    },
    claim: `${(w.caseNo ?? '').trim()}-${w.claimVersion}`,
  }
}

export const entryDefaults: EntryValues = {
  pvNo: '',
  pvDate: '',
  chequeNo: '',
  receiptAmt: '',
  remark: '',
  receiptNo: '',
  receiptDate: '',
  accMonth: '',
  accYear: '',
}
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
  casRemark: '',
}

export const entrySchema = yup.object({
  pvNo: optionalText(),
  pvDate: dmyDate(),
  chequeNo: optionalText(),
  receiptAmt: amount(),
  remark: optionalText(),
  receiptNo: optionalText(),
  receiptDate: dmyDate(),
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
  casRemark: optionalText(),
})

export interface SearchValues {
  mode: Mode
  scan: boolean
  payor: string
  bordxFrom: string
  bordxTo: string
  wsFrom: string
  wsTo: string
  wsStatus: string
  status: string
  recFrom: string
  recTo: string
  recDateFrom: string
  recDateTo: string
  mthFrom: string
  mthTo: string
  yrFrom: string
  yrTo: string
  bordxDateFrom: string
  bordxDateTo: string
  closeFrom: string
  closeTo: string
  groupCompany: string
  policy: string
}

export const searchDefaults: SearchValues = {
  mode: 'bordx',
  scan: false,
  payor: '',
  bordxFrom: '',
  bordxTo: '',
  wsFrom: '',
  wsTo: '',
  wsStatus: '0',
  status: '0',
  recFrom: '',
  recTo: '',
  recDateFrom: '',
  recDateTo: '',
  mthFrom: '',
  mthTo: '',
  yrFrom: '',
  yrTo: '',
  bordxDateFrom: '',
  bordxDateTo: '',
  closeFrom: '',
  closeTo: '',
  groupCompany: '',
  policy: '',
}

export const searchSchema = yup.object({
  mode: yup.mixed<Mode>().oneOf(['bordx', 'worksheet']).default('bordx'),
  scan: yup.boolean().default(false),
  payor: optionalText(),
  bordxFrom: optionalText(),
  bordxTo: optionalText(),
  wsFrom: optionalText(),
  wsTo: optionalText(),
  wsStatus: optionalText(),
  status: optionalText(),
  recFrom: optionalText(),
  recTo: optionalText(),
  recDateFrom: dmyDate(),
  recDateTo: dmyDate(),
  mthFrom: optionalText(),
  mthTo: optionalText(),
  yrFrom: optionalText(),
  yrTo: optionalText(),
  bordxDateFrom: dmyDate(),
  bordxDateTo: dmyDate(),
  closeFrom: dmyDate(),
  closeTo: dmyDate(),
  groupCompany: optionalText(),
  policy: optionalText(),
}) as yup.ObjectSchema<SearchValues>

/** cmdSearch_Click's check for Use Scan. */
export function searchProblem(v: SearchValues): { field: 'wsFrom' | 'bordxFrom'; message: string } | null {
  if (!v.scan) return null
  if (v.mode === 'worksheet' && v.wsFrom.trim() === '') return { field: 'wsFrom', message: 'Please Enter Worksheet No' }
  if (v.mode === 'bordx' && v.bordxFrom.trim() === '') return { field: 'bordxFrom', message: 'Please Enter Bordx No' }
  return null
}

/** Bordx Status (CboBordxStatus). */
export const statusOptions: Option[] = [
  { value: '0', label: '0 - All' },
  { value: '1', label: '1 - Received' },
  { value: '2', label: '2 - Not Received' },
  { value: '3', label: '3 - Partial Received' },
  { value: '4', label: '4 - Received & Partial Received' },
  { value: '5', label: '5 - Not Received & Partial Received' },
]

/** WS Status (CboWSStatus). */
export const wsStatusOptions: Option[] = [
  { value: '0', label: '0 - All' },
  { value: '1', label: '1 - Received' },
  { value: '2', label: '2 - Not Received' },
]

export const monthOptions: Option[] = Array.from({ length: 12 }, (_, i) => ({ value: String(i + 1), label: String(i + 1) }))

/** The scan search keeps the list and adds to it; a bordx or worksheet in the list already is "Data has been uploaded!". */
export const alreadyListed = (lines: Line[], mode: Mode, scanned: string) =>
  lines.some((l) => (mode === 'bordx' ? (l.bordx?.bordxNo ?? '') : (l.ws?.caseNo ?? '')).trim().toUpperCase() === scanned.trim().toUpperCase())

/** The query of the search. */
export const searchParams = (v: SearchValues) => ({
  mode: v.mode,
  scan: v.scan,
  payor: t(v.payor),
  bordxFrom: t(v.bordxFrom),
  bordxTo: v.scan && v.mode === 'bordx' ? undefined : t(v.bordxTo),
  wsFrom: t(v.wsFrom),
  wsTo: v.scan ? undefined : t(v.wsTo),
  wsStatus: Number(v.wsStatus || 0),
  status: Number(v.status || 0),
  recFrom: t(v.recFrom),
  recTo: t(v.recTo),
  recDateFrom: isoDmy(v.recDateFrom) ?? undefined,
  recDateTo: isoDmy(v.recDateTo) ?? undefined,
  mthFrom: n(v.mthFrom),
  mthTo: n(v.mthTo),
  yrFrom: n(v.yrFrom),
  yrTo: n(v.yrTo),
  bordxDateFrom: isoDmy(v.bordxDateFrom) ?? undefined,
  bordxDateTo: isoDmy(v.bordxDateTo) ?? undefined,
  closeFrom: isoDmy(v.closeFrom) ?? undefined,
  closeTo: isoDmy(v.closeTo) ?? undefined,
  groupCompany: t(v.groupCompany),
  policy: t(v.policy),
})

const m = (value: number | null | undefined) => (value == null ? '' : formatMoney(value))
const d = (value: string | null | undefined) => isoToDmy(value ?? null)
const period = (month: number | null, year: number | null) => (month == null && year == null ? '' : `${month ?? ''}-${year ?? ''}`)

/** The columns of the By Bordx list after the tick box, headed as the desktop headed them. */
export const bordxColumns: CsvColumn<Line>[] = [
  { label: 'Status', value: (l) => l.status },
  { label: 'Bordx No', value: (l) => l.bordx?.bordxNo ?? '' },
  { label: 'Bordx Amt', value: (l) => m(l.amount) },
  { label: 'Receipt Amt', value: (l) => m(l.received) },
  { label: 'OS Amt', value: (l) => m(l.outstanding) },
  { label: 'Paying', value: (l) => (l.paying ? m(l.paying) : '') },
  { label: 'OrgStatus', value: (l) => l.orgStatus },
  { label: 'PVNo', value: (l) => l.bordx?.pvNo ?? '' },
  { label: 'PVDate', value: (l) => d(l.bordx?.pvDate) },
  { label: 'ReceiptNo', value: (l) => l.bordx?.receiptNo ?? '' },
  { label: 'ReceiptDate', value: (l) => d(l.bordx?.receiptDate) },
  { label: 'AC Period', value: (l) => period(l.bordx?.accMonth ?? null, l.bordx?.accYear ?? null) },
  { label: 'ReceiptChq', value: (l) => l.bordx?.chequeNo ?? '' },
  { label: 'PVRemark', value: (l) => l.bordx?.remark ?? '' },
  { label: 'ChqAmt', value: (l) => m(l.bordx?.receiptAmt) },
  { label: 'BordxDate', value: (l) => d(l.bordx?.bordxDate) },
  { label: 'RecInd', value: (l) => l.bordx?.receiptPrefix ?? '' },
  { label: 'Group Company', value: (l) => l.bordx?.groupCompany ?? '' },
  { label: 'Policy Number', value: (l) => l.bordx?.policyNo ?? '' },
]

/** The columns of the By Worksheet list after the tick box. */
export const wsColumns: CsvColumn<Line>[] = [
  { label: 'Status', value: (l) => l.status },
  { label: 'Bordx No', value: (l) => l.ws?.bordxNo ?? '' },
  { label: 'Worksheet No', value: (l) => `${(l.ws?.caseNo ?? '').trim()}-${l.ws?.claimVersion}` },
  { label: 'Amount', value: (l) => m(l.amount) },
  { label: 'Amt Receipt', value: (l) => m(l.received) },
  { label: 'OS Amt', value: (l) => m(l.outstanding) },
  { label: 'Paying', value: (l) => (l.paying ? m(l.paying) : '') },
  { label: 'Patient Name', value: (l) => l.ws?.patientName ?? '' },
  { label: 'MBM Number', value: (l) => l.ws?.memberNo ?? '' },
  { label: 'Cover ID', value: (l) => l.ws?.coverId ?? '' },
  { label: 'Receipt No', value: (l) => l.ws?.receiptNo ?? '' },
  { label: 'Receipt Date', value: (l) => d(l.ws?.receiptDate) },
  { label: 'OrgStatus', value: (l) => l.orgStatus },
  { label: 'Bank Charge', value: (l) => l.staged.bankCharge },
  { label: 'Contra Case No', value: (l) => l.staged.contra },
  { label: 'Contra Case Amt', value: (l) => l.staged.contraAmt },
  { label: 'Gain Loss', value: (l) => l.staged.gainLoss },
  { label: 'Misc Diff', value: (l) => l.staged.misc },
  { label: 'Discount', value: (l) => l.staged.discount },
  { label: 'Write Off Amt', value: (l) => l.staged.writeOff },
  { label: 'Medix Receipt', value: (l) => l.staged.medixRec },
  { label: 'Remarks', value: (l) => l.staged.casRemark },
  { label: "TotRec'd Amt", value: (l) => m(l.ws?.received) },
  { label: 'WSDate', value: (l) => d(l.ws?.claimCloseDate) },
]

/** Print OR: the official receipt as the lines of a CSV file (the desktop filled the OR-PayN Excel template). */
export function officialReceiptRows(lines: OfficialLine[]): string[][] {
  const first = lines[0]
  return [
    ['Official Receipt'],
    ['Receipt No', first.receiptNo ?? ''],
    ['Received from', first.payorName ?? ''],
    ['Receipt Date', isoToDmy(first.receiptDate)],
    ['Amount', m(first.receiptAmt)],
    ['Cheque No', first.chequeNo ?? ''],
    [],
    ['No', 'Bordx No'],
    ...lines.map((l, i) => [String(i + 1), l.bordxNo ?? '']),
  ]
}
