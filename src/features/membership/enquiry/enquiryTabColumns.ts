import type { Column } from '../../../components/DataTable'
import type { Field } from '../../../components/FieldGrid'
import { formatMoney, formatValue } from '../../../lib/format'

/** Columns and fields of the Enquiry tabs added in the web version (HIS Benefits, Acc History, Fees, Non Disclosure, Policy Terms, LT Limit, T/O Claims, WS). */

const money = (value: unknown) => formatMoney(value)

/** Cover ID of the principal; worksheet rows show the principal's name and relationship P for it. */
const PRINCIPAL_COVER_ID = '00'

export const benefitColumns: Column[] = [
  { key: 'BenefitCode', label: 'Code' },
  { key: 'Description', label: 'Description' },
  { key: 'Days', label: 'Days/Months' },
  { key: 'RatePerDay', label: 'RM / Day', format: (v) => (v != null && !Number.isNaN(Number(v)) ? formatMoney(v) : formatValue(v)) },
  { key: 'PerDisability', label: 'RM Per Disability' },
]

export const accountHistoryColumns: Column[] = [
  { key: 'MembershipNo', label: 'Membership No' },
  { key: 'EffectiveDate', label: 'Eff Date' },
  { key: 'Admitted', label: 'Admitted' },
  { key: 'Registered', label: 'Case Reg' },
  { key: 'CaseNo', label: 'Case No' },
  { key: 'DebitCreditRefNo', label: 'DN/CN No' },
  { key: 'DebitCreditDate', label: 'DN/CN Date' },
  { key: 'Payable', label: 'Payable', format: money },
  { key: 'ReceiptNo', label: 'Receipt No' },
  { key: 'ReceiptDate', label: 'Receipt Date' },
  { key: 'ReceiptAmount', label: 'Receipt Amt', format: money },
  { key: 'Balance', label: 'Balance', format: money },
]

export const feeFields: Field[] = [
  { label: 'Basic Premium', value: (r) => money(r.BasicPremium) },
  { label: 'Premium', value: (r) => money(r.Premium) },
  { label: 'Prem Refund', value: (r) => money(r.PremiumRefund) },
  { label: 'Effective Prem', value: (r) => money(r.PremiumEffective) },
  { label: 'Basic MCO', value: (r) => money(r.BasicMco) },
  { label: 'MCO Fees', value: (r) => money(r.McoFee) },
  { label: 'MCO Refund', value: (r) => money(r.McoRefund) },
  { label: 'Effective MCO Fee', value: (r) => money(r.McoEffective) },
  { label: 'Access Fee', value: (r) => money(r.AccessFee) },
  { label: 'Access Fee Refund', value: (r) => money(r.AccessFeeRefund) },
  { label: 'Effective Access Fee', value: (r) => money(r.AccessFeeEffective) },
]

export const nonDisclosureColumns: Column[] = [
  { key: 'MembershipNo', label: 'Membership No' },
  { key: 'CaseNo', label: 'Case No' },
  { key: 'CoverId', label: 'Cover ID' },
  { key: 'Admitted', label: 'Admitted' },
  { key: 'PreExistingDate', label: 'Pre-Existing Date' },
  { key: 'PreExisting', label: 'Pre-Existing' },
  { key: 'PreExistingInformedBy', label: 'Informed By' },
  { key: 'UnderlyingDate', label: 'Underlying Date' },
  { key: 'Underlying', label: 'Underlying' },
  { key: 'UnderlyingInformedBy', label: 'Informed By' },
]

export const policyTermFields: Field[] = [
  { label: 'Referral Required (Admission)', key: 'ReferralForAdmission' },
  { label: 'Referral Required (Pre-Specialist)', key: 'ReferralForSpecialist' },
  { label: 'Min. Duration of Hospitalisation', key: 'MinimumHospitalStay' },
  { label: 'Physician Visits Per Day', key: 'PhysicianVisitsPerDay' },
  { label: 'Separation Period (Principal)', key: 'SeparationPeriodPrincipal' },
  { label: 'Separation Period (Supplementary)', key: 'SeparationPeriodSupplementary' },
  { label: 'Lower Age Limit', key: 'LowerAgeLimit' },
  { label: 'Upper Age Limit', key: 'UpperAgeLimit' },
  { label: 'Student Age', key: 'StudentAge' },
  { label: 'Child Until Age', key: 'ChildUntilAge' },
]

export const lifetimeColumns: Column[] = [
  { key: 'MembershipNo', label: 'Membership No' },
  { key: 'CoverId', label: 'Cover ID' },
  { key: 'Name', label: 'Name' },
  { key: 'AnnualBalance', label: 'Annual Bal.', format: money },
  { key: 'LifetimeBalance', label: 'Lifetime Bal.', format: money },
  { key: 'Cases', label: 'Cases' },
  { key: 'CaseHistory', label: 'Case History' },
  { key: 'CaseAmount', label: 'Cases Amt', format: money },
  { key: 'HistoryAmount', label: 'History Amt', format: money },
]

export const takeoverColumns: Column[] = [
  { key: 'EffectiveDate', label: 'Eff Date' },
  { key: 'ExpiryDate', label: 'Exp Date' },
  { key: 'Patient', label: 'Patient' },
  { key: 'PatientIc', label: 'IC' },
  { key: 'Admitted', label: 'Admitted' },
  { key: 'Discharged', label: 'Discharged' },
  { key: 'Hospital', label: 'Hospital' },
  { key: 'Diagnosis', label: 'Diagnosis' },
  { key: 'Doctor', label: 'Doctor' },
  { key: 'BillAmount', label: 'Bill', format: money },
  { key: 'ApprovedAmount', label: 'Approved', format: money },
  { key: 'ExcessAmount', label: 'Excess', format: money },
]

export const worksheetColumns: Column[] = [
  { key: 'CASNumber', label: 'Case No' },
  { key: 'ClaimVersion', label: 'Version' },
  { key: 'MBMNumber', label: 'Membership No' },
  { key: 'MBMCName', label: 'Patient', format: (v, r) => formatValue(String(r.MBMPatientCovID ?? '').trim() === PRINCIPAL_COVER_ID ? r.MBMName : v) },
  { key: 'MBMCRELCode', label: 'Rel', format: (v, r) => (String(r.MBMPatientCovID ?? '').trim() === PRINCIPAL_COVER_ID ? 'P' : formatValue(v)) },
  { key: 'CASDateAdmitted', label: 'Admitted' },
  { key: 'CASDischargeDate', label: 'Discharged' },
  { key: 'CASClaimability', label: 'Claimability' },
  { key: 'DIAFinalDiag1', label: 'Final Diagnosis' },
  { key: 'CASStatus', label: 'Status' },
  { key: 'HOSName', label: 'Hospital' },
  { key: 'PAYCode', label: 'Payor' },
  { key: 'ClaimOpenDate', label: 'Claim Open' },
  { key: 'CLMTotalActual', label: 'Total Actual', format: money },
  { key: 'CLMBordxAmt', label: 'Bordx Amt', format: money },
  { key: 'CLMPrevMajorMed', label: 'Prev Major Med', format: money },
  { key: 'CLMMajorMedFee', label: 'Major Med Fee', format: money },
  { key: 'BordxRefNo', label: 'Bordx Ref' },
  { key: 'CLMBordxDate', label: 'Bordx Date' },
]
