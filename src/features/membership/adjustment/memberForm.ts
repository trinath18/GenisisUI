import { CoveredAction, DATE_FIELDS, MALE_SALUTATION, NUMBER_FIELDS } from './constants'
import type { FormRow, FormValue } from './types'

/** Display text of a form value. */
export const text = (value: FormValue | undefined): string => (value == null ? '' : String(value))

/** ISO dates from the API become yyyy-mm-dd for date inputs. */
export function toForm(row: FormRow): FormRow {
  const result: FormRow = {}
  for (const [key, value] of Object.entries(row)) result[key] = DATE_FIELDS.has(key) && typeof value === 'string' ? value.slice(0, 10) : value
  return result
}

/** Empty strings go back as null; numeric fields as numbers. */
export function toRequest(row: FormRow): FormRow {
  const result: FormRow = {}
  for (const [key, value] of Object.entries(row)) {
    if (typeof value === 'string' && value.trim() === '') result[key] = null
    else if (NUMBER_FIELDS.has(key) && typeof value === 'string') result[key] = Number(value)
    else result[key] = value
  }
  return result
}

/** A new supplementary, starting from the principal's plan and cover period. */
export const newSupplementary = (principal: FormRow): FormRow => ({
  action: CoveredAction.Add, coverId: null, salutation: MALE_SALUTATION, name: '', icBcPp: '', dateOfBirth: '', sex: 'M', relationship: 'S',
  planCode: text(principal.planCode), effectiveDate: text(principal.payorEffectiveDate), expiryDate: text(principal.payorExpiryDate),
  allergic: '', exclusion: '', underwritingExcess: '', claimNonPayFrom: '', claimNonPayTo: '', payorPremiumNet: '', payorMcoGross: '',
  payorMcoNet: '', renewalDisc: '', policyDisc: '', familyDiscountAmount: '', renewalDiscountAmount: '', loadingPremium: '',
})

/** The desktop's required-field checks of the supplementary Add / Update buttons; returns the message or null. */
export function supplementaryError(person: FormRow, adding: boolean, endorsementBordxDate: string): string | null {
  const suffix = adding ? '!' : ''
  if (!text(person.name).trim()) return `Please Enter Covered Person Name${suffix}`
  if (!text(person.icBcPp).trim()) return `Please Enter Covered Person Identification${suffix}`
  if (!text(person.relationship)) return `Please Enter Covered Person Relationship${suffix}`
  if (!adding) return null
  if (!text(person.dateOfBirth)) return 'Please Enter Covered Person Birth Date!'
  if (!text(person.sex)) return 'Please Enter Covered Person Sex!'
  if (!endorsementBordxDate) return 'Please Enter Endt Bordx Date !'
  return null
}
