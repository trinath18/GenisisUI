import type { Option } from './types'

/** Endorsement type codes (API EndorsementTypes). */
export const EndorsementType = {
  Amendment: 'A',
  Cancellation: 'C',
  AddSupplementary: 'S',
  CancelSupplementary: 'K',
  DeleteSupplementary: 'T',
  Suspend: 'X',
  DeletePolicy: 'D',
  PlanChange: 'P',
} as const

/** Types that edit the principal's details. */
export const editsPrincipal = (type: string) => type === EndorsementType.Amendment || type === EndorsementType.PlanChange

/** Types that end the membership (refused for clinical-only members). */
export const endsMembership = (type: string) =>
  type === EndorsementType.Cancellation || type === EndorsementType.Suspend || type === EndorsementType.DeletePolicy

/** Types that work on the Supplementary tab. */
export const worksOnSupplementaries = (type: string) =>
  type === EndorsementType.AddSupplementary || type === EndorsementType.DeleteSupplementary || type === EndorsementType.CancelSupplementary

/** What happens to a covered person on save (API CoveredActions, case-insensitive). */
export const CoveredAction = {
  Add: 'add',
  Remove: 'remove',
  Cancel: 'cancel',
} as const

export const MemberStatus = { Active: 'A' } as const
export const FAMILY_INSURED_TYPES = ['F', 'H']
export const SALUTATIONS = ['MR', 'MS', 'MRS', 'MDM']
export const MALE_SALUTATION = 'MR'
export const SEARCH_MINIMUM_LENGTH = 3
export const NOTES_MAXIMUM_LENGTH = 2000

export const TABS = ['Principal Details', 'Others Details', 'Supplementary', 'Adjustment History', 'Fees', 'MBM History', 'Mgmt Note'] as const
export type AdjustmentTab = (typeof TABS)[number]

export const SEARCH_FIELDS: Option[] = [
  { code: 'number', name: 'Membership No' },
  { code: 'name', name: 'Name' },
  { code: 'ic', name: 'IC No' },
  { code: 'policy', name: 'Policy No' },
]

const options = (values: [string, string][]): Option[] => values.map(([code, name]) => ({ code, name }))

export const OPTIONS = {
  takeOver: options([['N', 'None'], ['Y', 'Take Over'], ['C', 'Conversion']]),
  renewal: options([['R', 'Renew'], ['N', 'New'], ['T', 'Timely'], ['P', 'Partial']]),
  dataStatus: options([['A', 'Active'], ['D', 'Deleted']]),
  installmentMode: options([['A', 'Annually'], ['Q', 'Quarterly'], ['S', 'Semi Annual'], ['M', 'Monthly']]),
  sex: options([['M', 'Male'], ['F', 'Female']]),
  maritalStatus: options([['S', 'Single'], ['M', 'Married']]),
  adultChild: options([['A', 'Adult'], ['C', 'Child']]),
  policyCondition: options([['X', 'Black Listed'], ['O', 'Red Flagged']]),
  noYes: options([['N', 'No'], ['Y', 'Yes']]),
  yesNo: options([['Y', 'Yes'], ['N', 'No']]),
  bloodTypes: ['A', 'B', 'AB', 'O'].map((b) => ({ code: b, name: b })),
  salutations: SALUTATIONS.map((s) => ({ code: s, name: s })),
}

/** Member fields holding dates (ISO from the API, yyyy-mm-dd in date inputs). */
export const DATE_FIELDS = new Set([
  'dateOfBirth', 'payorEffectiveDate', 'payorExpiryDate', 'bordxDate', 'valueDate', 'finalExpiryDate', 'nextDueDate', 'cardSentDate',
  'cancelDate', 'dateJoined', 'claimNonPayFrom', 'claimNonPayTo', 'newPolicyEffectiveDate', 'invoiceDate', 'creditNoteDate',
  'generalWaitingEnd', 'preExistingWaitingEnd', 'specificIllnessWaitingEnd', 'topupJoinDate', 'effectiveDate', 'expiryDate',
])

/** Member fields sent as numbers. */
export const NUMBER_FIELDS = new Set([
  'mcoFee', 'basicMco', 'basicPremium', 'premium', 'policyDisc', 'renewalDisc', 'underwritingExcess', 'rbAmount', 'generalWaitingDays',
  'preExistingWaitingDays', 'specificIllnessWaitingDays', 'payorPremiumGross', 'payorPremiumNet', 'payorMcoGross', 'payorMcoNet',
  'familyDiscountAmount', 'renewalDiscountAmount', 'loadingPremium', 'availableLimit', 'annualLimit', 'mco', 'batchNo',
])

/** Messages the desktop shows before saving. */
export const Messages = {
  noSupplementary: 'This Plan does not have supplementary',
  noPlanToChange: 'No Plan to Change !',
  clinicalMember: 'This is Clinical Member, pls use Clinical Adjustment !',
  enterEndtBordx: 'Please Enter Endt Bordx Date !',
  confirm: 'Are you sure?',
} as const
