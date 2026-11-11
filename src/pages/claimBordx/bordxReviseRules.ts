// Claim Bordx > Worksheet > Remove Worksheet (legacy FrmBordxRevise, "Bordereaux Revise"): the checks the desktop made before looking a bordx up and before removing worksheets from it,
// the list and the request. The server repeats the checks.

import { isoToDmy } from '../case/caseShared'
import { worksheetKey } from '../worksheet/worksheetRules'

export interface ReviseRow {
  caseNo: string
  claimVersion: number
  claimNo: string
  claimOpenDate: string | null
  mbmNumber: string | null
  patientName: string | null
  dateAdmitted: string | null
  dischargeDate: string | null
  totalApproved: number | null
  caseStatus: string | null
}

/** What the lookup answers: the dates, the count and the approved total of the worksheets and whether the bordx can still be revised. */
export interface ReviseResult {
  bordxNo: string
  bordxDate: string | null
  printedDate: string | null
  items: number
  totalApproved: number
  sentOut: boolean
  rows: ReviseRow[]
}

export const reviseKey = worksheetKey

/** CmdGo_Click: a bordx number is needed. */
export const reviseLookupProblem = (bordxNo: string) => (bordxNo.trim() === '' ? 'Please select a Bordx No' : null)

/** CmdReject_Click: something has to be ticked (the desktop did nothing without a tick; the web says so). */
export const reviseRemoveProblem = (ticked: number) => (ticked === 0 ? 'Please select at least one record to be removed!' : null)

/** The question before the removal. */
export const reviseConfirmText = 'You are going to remove a worksheet from current Bordereaux.\nAre you sure?'

/** The request of the removal. */
export const reviseRequest = (bordxNo: string, ticked: readonly Pick<ReviseRow, 'caseNo' | 'claimVersion'>[]) => ({
  bordxNo: bordxNo.trim(),
  items: ticked.map((r) => ({ caseNo: r.caseNo, claimVersion: r.claimVersion })),
})

/** A date label of the screen as dd/mm/yyyy, or nothing. */
export const reviseDay = (value: string | null) => isoToDmy(value)
