// Maintenance > Surgical Schedule (rebuilt: the desktop's menu item has no click handler and no form for it is in the source). The surgical schedule of a payor's plan (dbo.PLNSurgOperation): the
// percentage of the surgical fee the plan pays for each surgical category, the rows Case Registration lists on its Surgical Schedule tab. The server repeats the checks.

import type { CsvColumn } from '../../lib/exportCsv'

export interface SurgicalPayor {
  code: string
  name: string
}

export interface SurgicalRow {
  index: number
  mainCategory: string | null
  subCategory: string | null
  percentage: number | null
}

export interface SurgicalScheduleResult {
  plan: { payor: string; planCode: string; description: string | null }
  rows: SurgicalRow[]
}

export interface SurgicalKey {
  payor: string
  plan: string
}

export interface SurgicalValues {
  mainCategory: string
  subCategory: string
  percentage: string
}

export const emptyValues: SurgicalValues = { mainCategory: '', subCategory: '', percentage: '' }

/** The search's checks, in order. */
export function searchProblem(key: SurgicalKey): { field: keyof SurgicalKey; message: string } | null {
  if (key.payor.trim() === '') return { field: 'payor', message: 'Please Select Payor!' }
  if (key.plan.trim() === '') return { field: 'plan', message: 'Please Enter Plan Code!' }
  return null
}

/** The save's checks, in order. */
export function rowProblem(v: SurgicalValues): { field: keyof SurgicalValues; message: string } | null {
  if (v.mainCategory.trim() === '') return { field: 'mainCategory', message: 'Please Enter Surgical Main Category!' }
  if (v.mainCategory.trim().length > 50) return { field: 'mainCategory', message: 'Surgical Main Category can have at most 50 characters.' }
  if (v.subCategory.trim().length > 200) return { field: 'subCategory', message: 'Surgical Sub Category can have at most 200 characters.' }
  if (v.percentage.trim() === '') return { field: 'percentage', message: 'Please Enter Percentage!' }
  const n = Number(v.percentage)
  if (!/^\d{1,3}$/.test(v.percentage.trim()) || n > 100) return { field: 'percentage', message: 'Percentage must be from 0 to 100.' }
  return null
}

/** The body of an add or a change. */
export const rowRequest = (key: SurgicalKey, v: SurgicalValues) => ({
  payor: key.payor.trim().toUpperCase(),
  plan: key.plan.trim().toUpperCase(),
  mainCategory: v.mainCategory.trim(),
  subCategory: v.subCategory.trim() === '' ? null : v.subCategory.trim(),
  percentage: Number(v.percentage),
})

/** The form's values for a row of the list. */
export const valuesOf = (r: SurgicalRow): SurgicalValues => ({
  mainCategory: r.mainCategory ?? '',
  subCategory: r.subCategory ?? '',
  percentage: r.percentage == null ? '' : String(r.percentage),
})

export const listColumns: CsvColumn<SurgicalRow>[] = [
  { label: 'Surgical Main Category', value: (r) => r.mainCategory ?? '' },
  { label: 'Surgical Sub Category', value: (r) => r.subCategory ?? '' },
  { label: 'Percentage', value: (r) => (r.percentage == null ? '' : `${r.percentage}%`) },
]
