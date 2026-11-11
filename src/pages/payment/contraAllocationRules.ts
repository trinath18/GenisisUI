// Payment > Contra Allocation (legacy frmContraAllocation, "Contra Allocation"): search the contra rows (a claim's amount set against another claim, written by the Receipt screens), tick the ones to allocate
// and Update: they get one allocation number. The server repeats the checks.

import * as yup from 'yup'
import { dmyDate, optionalText } from '../../lib/validation'
import { isoDmy } from '../case/caseShared'
import { formatMoney } from '../../lib/format'

export interface ContraRow {
  id: number
  refNo: string | null
  caseNo: string | null
  versionNo: string | null
  caseAmt: number | null
  contraCaseNo: string | null
  contraVersionNo: string | null
  contraCaseAmt: number | null
  allocationNo: string | null
  allocationDate: string | null
  contraStatus: string | null
}

export interface SearchResult {
  rows: ContraRow[]
  truncated: boolean
}

export interface SearchValues {
  refFrom: string
  refTo: string
  status: string
  scan: boolean
  caseFrom: string
  caseTo: string
  contraFrom: string
  contraTo: string
  allocationFrom: string
  allocationTo: string
  dateFrom: string
  dateTo: string
}

export const searchDefaults: SearchValues = {
  refFrom: '',
  refTo: '',
  status: '0',
  scan: false,
  caseFrom: '',
  caseTo: '',
  contraFrom: '',
  contraTo: '',
  allocationFrom: '',
  allocationTo: '',
  dateFrom: '',
  dateTo: '',
}

const number = (label: string) => optionalText().max(15, `${label} is too long (15 characters at most).`)

export const searchSchema: yup.ObjectSchema<SearchValues> = yup.object({
  refFrom: number('Ref No'),
  refTo: number('Ref No'),
  status: optionalText(),
  scan: yup.boolean().default(false),
  caseFrom: number('Case No'),
  caseTo: number('Case No'),
  contraFrom: number('Contra Case No'),
  contraTo: number('Contra Case No'),
  allocationFrom: number('Allocation No'),
  allocationTo: number('Allocation No'),
  dateFrom: dmyDate(),
  dateTo: dmyDate(),
})

/** cboStatus. */
export const statusOptions = [
  { value: '0', label: '0 - ALL' },
  { value: '1', label: '1 - ALLOCATED' },
  { value: '2', label: '2 - NOT ALLOCATED' },
]

export const rowKey = (row: ContraRow) => String(row.id)

export const allocated = (row: ContraRow) => (row.contraStatus ?? '').trim() === 'A'

/** The two things that stop a row being ticked: it is allocated already ("Record has been allocated!"), or it has no claim to allocate (a receipt-only row). */
export const tickProblem = (row: ContraRow): string | null => {
  if (allocated(row)) return 'Record has been allocated!'
  if (!(row.caseNo ?? '').trim()) return 'The record has no claim to allocate.'
  return null
}

const claim = (no: string | null, version: string | null) => ((no ?? '').trim() ? `${(no ?? '').trim()}-${(version ?? '').trim()}` : '')

/** The cells of the list in the desktop's order (after the check box). */
export const contraColumns: { label: string; right?: boolean; value: (r: ContraRow) => string }[] = [
  { label: 'Contra Status', value: (r) => (allocated(r) ? 'ALLOCATED' : '') },
  { label: 'Claim No', value: (r) => claim(r.caseNo, r.versionNo) },
  { label: 'Claim Amount', right: true, value: (r) => (r.caseAmt == null ? '' : formatMoney(r.caseAmt)) },
  { label: 'Contra Claim No', value: (r) => claim(r.contraCaseNo, r.contraVersionNo) },
  { label: 'Contra Claim Amount', right: true, value: (r) => (r.contraCaseAmt == null ? '' : formatMoney(r.contraCaseAmt)) },
  { label: 'Allocation No', value: (r) => r.allocationNo ?? '' },
  { label: 'Allocation Date', value: (r) => (r.allocationDate ? r.allocationDate.slice(0, 10).split('-').reverse().join('/') : '') },
]

const t = (v: string) => v.trim() || undefined

/** The query of Search: in Use Scan the one claim number scanned (exact), otherwise the case range. */
export function searchParams(v: SearchValues) {
  return {
    refFrom: t(v.refFrom),
    refTo: t(v.refTo),
    status: Number(v.status || 0),
    scanCase: v.scan ? t(v.caseFrom) : undefined,
    caseFrom: v.scan ? undefined : t(v.caseFrom),
    caseTo: v.scan ? undefined : t(v.caseTo),
    contraFrom: t(v.contraFrom),
    contraTo: t(v.contraTo),
    allocationFrom: t(v.allocationFrom),
    allocationTo: t(v.allocationTo),
    dateFrom: isoDmy(v.dateFrom) ?? undefined,
    dateTo: isoDmy(v.dateTo) ?? undefined,
  }
}

/** cmdSearch_Click in Use Scan: the claim number has to be entered, and a claim already in the list is not added again ("Data has been uploaded!"). */
export function scanProblem(v: SearchValues, rows: ContraRow[]): string | null {
  if (!v.scan) return null
  const scanned = v.caseFrom.trim()
  if (!scanned) return 'Please Enter Case No'
  return rows.some((r) => (r.caseNo ?? '').trim().toLowerCase() === scanned.toLowerCase()) ? 'Data has been uploaded!' : null
}

/** What Update asks of the user: a row has to be ticked ("Please select the record"). */
export const updateProblem = (ticked: ContraRow[]) => (ticked.length === 0 ? 'Please select the record' : null)

/** Check All: every row that can be ticked. */
export const tickableKeys = (rows: ContraRow[]): Set<string> => new Set(rows.filter((r) => tickProblem(r) === null).map(rowKey))

export const doneMessage = (allocationNo: string) => `Record Updated, Your Allocation Number is : ${allocationNo}`
