// Claim Bordx > Bor Delivery > Returned Fr Payor (Not App) (legacy FrmReturnPayorCase): the checks the desktop made before looking a worksheet up and before setting its approved status, and the
// request. The server repeats the checks.

import type { Option } from '../../components/Field'
import { isoToDmy } from '../case/caseShared'

export interface ReturnCaseRow {
  payor: string | null
  caseNo: string
  claimVersion: number
  claimNo: string
  approvedAmount: number | null
  appStatus: string | null
  bordxNo: string | null
  bordxDate: string | null
  bordxAmount: number | null
  bordxStatus: string | null
}

/** CboStatus: "N - No" and "Y - Yes", starting on No. */
export const returnCaseStatusOptions: Option[] = [
  { value: 'N', label: 'N - No' },
  { value: 'Y', label: 'Y - Yes' },
]

/** CmdSearch_Click: a case number is needed. */
export const returnCaseSearchProblem = (caseNo: string) => (caseNo.trim() === '' ? 'Please Enter Claim No' : null)

/** CmdToPayor_Click: the approved status first, then (the desktop crashed without) a worksheet looked up. */
export const returnCaseUpdateProblem = (status: string, row: ReturnCaseRow | null) =>
  status.trim() === '' ? 'Please Enter Approved Status' : row === null ? 'Please Enter Claim No' : null

/** The request of the update. */
export const returnCaseRequest = (row: Pick<ReturnCaseRow, 'caseNo' | 'claimVersion'>, status: string) => ({
  caseNo: row.caseNo,
  version: row.claimVersion,
  status: status.trim().toUpperCase(),
})

/** A date box of the screen as dd/mm/yyyy, or nothing. */
export const returnCaseDay = (value: string | null) => isoToDmy(value)
