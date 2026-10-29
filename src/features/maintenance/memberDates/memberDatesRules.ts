// Maintenance > Member (legacy frmMaintenanceMembers, "Members Maintenance": the Valid Date Range tab): the form values, the checks the desktop made before saving and the request.
// The server repeats the checks.

import * as yup from 'yup'
import { dmyDate } from '../../../lib/validation'
import { isoDmy, isoToDmy } from '../../../pages/case/caseShared'

/** What the API answers: whether the table has a row, and its six dates (ISO). */
export interface MemberDatesRow {
  found: boolean
  effectiveStart: string | null
  effectiveEnd: string | null
  expiryStart: string | null
  expiryEnd: string | null
  birthStart: string | null
  birthEnd: string | null
  updatedBy: string | null
  updatedOn: string | null
}

export interface MemberDatesValues {
  effectiveStart: string
  effectiveEnd: string
  expiryStart: string
  expiryEnd: string
  birthStart: string
  birthEnd: string
}

export const memberDatesDefaults: MemberDatesValues = { effectiveStart: '', effectiveEnd: '', expiryStart: '', expiryEnd: '', birthStart: '', birthEnd: '' }

/** LostFocus: a date that is typed has to be a real dd/mm/yyyy day ("Invalid Date Format!"). */
export const memberDatesSchema: yup.ObjectSchema<MemberDatesValues> = yup.object({
  effectiveStart: dmyDate(),
  effectiveEnd: dmyDate(),
  expiryStart: dmyDate(),
  expiryEnd: dmyDate(),
  birthStart: dmyDate(),
  birthEnd: dmyDate(),
})

/** The six boxes in the order the desktop checked them. */
const required: { field: keyof MemberDatesValues; message: string }[] = [
  { field: 'effectiveStart', message: 'Please Enter Effective Start Date' },
  { field: 'effectiveEnd', message: 'Please Enter Effective End Date' },
  { field: 'expiryStart', message: 'Please Enter Expiry Start Date' },
  { field: 'expiryEnd', message: 'Please Enter Expiry End Date' },
  { field: 'birthStart', message: 'Please Enter DOB Start Date' },
  { field: 'birthEnd', message: 'Please Enter DOB End Date' },
]

/** cmdUpdate_Click: the first date that is missing, one message at a time; null when the save may go ahead. */
export const memberDatesProblem = (v: MemberDatesValues) => required.find((r) => v[r.field].trim() === '') ?? null

/** The saved row as the boxes show it. */
export const memberDatesFromRow = (row: MemberDatesRow): MemberDatesValues => ({
  effectiveStart: isoToDmy(row.effectiveStart),
  effectiveEnd: isoToDmy(row.effectiveEnd),
  expiryStart: isoToDmy(row.expiryStart),
  expiryEnd: isoToDmy(row.expiryEnd),
  birthStart: isoToDmy(row.birthStart),
  birthEnd: isoToDmy(row.birthEnd),
})

/** The request of the save: every date as an ISO day. */
export const memberDatesRequest = (v: MemberDatesValues) => ({
  effectiveStart: isoDmy(v.effectiveStart),
  effectiveEnd: isoDmy(v.effectiveEnd),
  expiryStart: isoDmy(v.expiryStart),
  expiryEnd: isoDmy(v.expiryEnd),
  birthStart: isoDmy(v.birthStart),
  birthEnd: isoDmy(v.birthEnd),
})
