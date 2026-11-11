// Maintenance > Company Info (legacy FrmMaintenanceComInfo, "Company Information"): the form values, the checks the desktop made before saving and the request. The server repeats the checks.

import * as yup from 'yup'
import { optionalText } from '../../lib/validation'

/** What the API answers: whether the table is there, whether it has a row, and the row. */
export interface CompanyInfoRow {
  tableExists: boolean
  found: boolean
  code: string | null
  name: string | null
  address: string | null
  phone: string | null
  fax: string | null
  email: string | null
  homepage: string | null
  currentYear: string | null
}

export interface CompanyInfoValues {
  code: string
  name: string
  address: string
  phone: string
  fax: string
  email: string
  homepage: string
  currentYear: string
}

export const companyInfoDefaults: CompanyInfoValues = { code: '', name: '', address: '', phone: '', fax: '', email: '', homepage: '', currentYear: '' }

/** KeyNumber: the number boxes took digits, "-" and "."; the year is four digits. */
const numberBox = (label: string) => optionalText().matches(/^[-.0-9]*$/, `${label} must be a number.`)

export const companyInfoSchema: yup.ObjectSchema<CompanyInfoValues> = yup.object({
  code: optionalText().max(50, 'Company Code is too long.'),
  name: optionalText().max(150, 'Company Name is too long.'),
  address: optionalText().max(200, 'Address is too long.'),
  phone: numberBox('Phone No').max(15, 'Phone No is too long.'),
  fax: numberBox('Fax No').max(15, 'Fax No is too long.'),
  email: optionalText().max(150, 'Email is too long.'),
  homepage: optionalText().max(150, 'Homepage is too long.'),
  currentYear: optionalText().matches(/^[0-9]{0,4}$/, 'Company Current Year must be a year of four digits.'),
})

/** The three boxes the desktop required, in the order it checked them. */
const required: { field: keyof CompanyInfoValues; message: string }[] = [
  { field: 'code', message: 'Please Enter Company Code' },
  { field: 'name', message: 'Please Enter Company Name' },
  { field: 'currentYear', message: 'Please Enter Company Current Year' },
]

/** cmdUpdate_Click: the first required box that is empty, one message at a time; null when the save may go ahead. */
export const companyInfoProblem = (v: CompanyInfoValues) => required.find((r) => v[r.field].trim() === '') ?? null

/** The saved row as the boxes show it. */
export const companyInfoFromRow = (row: CompanyInfoRow): CompanyInfoValues => ({
  code: row.code ?? '',
  name: row.name ?? '',
  address: row.address ?? '',
  phone: row.phone ?? '',
  fax: row.fax ?? '',
  email: row.email ?? '',
  homepage: row.homepage ?? '',
  currentYear: row.currentYear ?? '',
})

/** The request of Update: every box trimmed. */
export const companyInfoRequest = (v: CompanyInfoValues): CompanyInfoValues => ({
  code: v.code.trim(),
  name: v.name.trim(),
  address: v.address.trim(),
  phone: v.phone.trim(),
  fax: v.fax.trim(),
  email: v.email.trim(),
  homepage: v.homepage.trim(),
  currentYear: v.currentYear.trim(),
})
