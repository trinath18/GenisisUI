/** A value of the member form: API values and what the inputs hold. */
export type FormValue = string | number | boolean | null

/** A member, covered person or listing row as sent by the API (camelCase DTO properties). */
export type FormRow = Record<string, FormValue>

export interface Option {
  code: string
  name: string
}

export interface AdjustmentLookups {
  healthCodes: Option[]
  payors: Option[]
  insuredTypes: Option[]
  races: Option[]
  nationalities: Option[]
  relationships: Option[]
  states: Option[]
  cities: Option[]
  endorsementTypes: Option[]
}

export interface LoadedMembership {
  member: FormRow
  covered: FormRow[]
  clinic: FormRow | null
  limit: FormRow | null
  blocked: string | null
}

export interface Recalculation {
  ageCode: string
  adultChild: string
  basicPremium: number
  premium: number
  mco: number
  annualLimit: number | null
  warnings: string[]
}

export interface SupplementaryExpiry {
  expiryDate: string | null
  overAge: boolean
  ageLimit: number
}

export interface SaveResult {
  message: string
  warnings: string[]
}

export interface SaveRequest {
  endorsementType: string
  endtBordxDate: string | null
  endtEffectiveDate: string | null
  member: FormRow
  covered: FormRow[]
  applyAnnualLimit: boolean
  annualLimit: number | null
}

/** Binds form controls to the principal being edited. */
export interface MemberForm {
  member: FormRow
  set: (key: string, value: FormValue) => void
  editable: boolean
  busy: boolean
}
