// Maintenance > Suspension (legacy frmSuspensionDetail, "Suspension Detail"): the checks the desktop made before saving or deleting a suspension category or a suspended member / agent, and the
// requests. The server repeats the checks. ChkStr (trim, upper case) is applied before anything is sent.

import type { Option } from '../../../components/Field'
import { payorCode } from '../../../pages/worksheet/worksheetRules'

export interface CategoryRow {
  code: string
  description: string | null
}

export interface DetailRow {
  selection: string
  keyCode: string | null
  description: string | null
  payorCode: string | null
  payorName: string | null
  payor: string
}

export interface CategoryValues {
  code: string
  description: string
}

export interface DetailValues {
  selection: string
  key: string
  description: string
  payor: string
}

export const emptyCategory: CategoryValues = { code: '', description: '' }
export const emptyDetail: DetailValues = { selection: '', key: '', description: '', payor: '' }

/** cboSelection: "01 - Member" and "02 - Agent". */
export const selectionOptions: Option[] = [
  { value: '01', label: '01 - Member' },
  { value: '02', label: '02 - Agent' },
]

/** ChkStr: trimmed and upper-cased. */
export const clean = (text: string) => text.trim().toUpperCase()

/** SaveCAT's checks, in the desktop's order; null when the save may go ahead. */
export const categoryProblem = (v: CategoryValues) =>
  v.code.trim() === ''
    ? { field: 'code' as const, message: 'Please Enter Code' }
    : v.description.trim() === ''
      ? { field: 'description' as const, message: 'Please Enter Description' }
      : null

/** SaveDetail's checks, in the desktop's order (the member number has to start with the payor's code). */
export const detailProblem = (v: DetailValues) => {
  if (v.selection.trim() === '') return { field: 'selection' as const, message: 'Please Enter Selection' }
  if (v.key.trim() === '') return { field: 'key' as const, message: 'Please Enter Member Number/Agent Code' }
  if (v.description.trim() === '') return { field: 'description' as const, message: 'Please Enter Description' }
  if (v.payor.trim() === '') return { field: 'payor' as const, message: 'Please Enter Payor' }
  if (v.selection.startsWith('01') && clean(v.key).slice(0, 2) !== clean(v.payor).slice(0, 2)) return { field: 'payor' as const, message: 'Payor Code Not Match' }
  return null
}

/** cmdDelete_Click on the Suspension Category tab: a code, then a searched list. */
export const categoryDeleteProblem = (code: string, listed: number) => (code.trim() === '' ? 'Please Enter Category Code' : listed === 0 ? 'Please search the record' : null)

/** cmdDelete_Click on the Suspension Details tab: a selection, a member number or agent code, then a searched list. */
export const detailDeleteProblem = (v: Pick<DetailValues, 'selection' | 'key'>, listed: number) =>
  v.selection.trim() === '' ? 'Please Enter Selection' : v.key.trim() === '' ? 'Please Enter Member Number or Agent Code' : listed === 0 ? 'Please search the record' : null

/** txtAGTCode_LostFocus: the payor a member number belongs to (the option whose code the number starts with), or undefined ("Invalid MembershipNumber"). */
export const payorOfMember = (key: string, payors: readonly Option[]) => {
  const two = clean(key).slice(0, 2)
  return payors.find((p) => payorCode(p.value).toUpperCase() === two)?.value
}

export const categoryRequest = (v: CategoryValues) => ({ code: clean(v.code), description: clean(v.description) })

export const detailRequest = (v: DetailValues) => ({ selection: v.selection, key: clean(v.key), description: clean(v.description), payor: v.payor })

/** The Suspension Details tab's key is the member number for 01 and the agent code for 02. */
export const keyLabel = (selection: string) => (selection.startsWith('02') ? 'Agent Code' : 'Member Number')
