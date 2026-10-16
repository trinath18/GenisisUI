import type { Column } from '../../../components/DataTable'
import { formatMoney } from '../../../lib/format'

/** Columns of the read-only Adjustment tabs (API column names). */
const money = (value: unknown) => formatMoney(value)

export const historyColumns: Column[] = [
  { key: 'MBMAEndtBordxDate', label: 'Bordx Date' },
  { key: 'MBMAEndtBatchNo', label: 'Batch No' },
  { key: 'MBMAmendDate', label: 'Amend Date' },
  { key: 'MBMAmendEdtType', label: 'Endt Type' },
  { key: 'MBMAENDtEffDate', label: 'Endt Eff Date' },
  { key: 'MBMAmendUser', label: 'User' },
]

export const feeColumns: Column[] = [
  { key: 'name', label: 'Name' },
  { key: 'relationship', label: 'Rel' },
  { key: 'coverId', label: 'Cover' },
  { key: 'status', label: 'Status' },
  { key: 'planCode', label: 'Plan' },
  { key: 'effectiveDate', label: 'Eff' },
  { key: 'expiryDate', label: 'Exp' },
  { key: 'cancelDate', label: 'Cancel' },
  { key: 'annualLimit', label: 'Annual', format: money },
  { key: 'availableLimit', label: 'Available', format: money },
  { key: 'disabilityLimit', label: 'Per Disability', format: money },
  { key: 'basicPremium', label: 'Basic Prem', format: money },
  { key: 'premium', label: 'Premium', format: money },
  { key: 'basicMco', label: 'Basic MCO', format: money },
  { key: 'mco', label: 'MCO', format: money },
  { key: 'invoiceNo', label: 'Invoice No' },
  { key: 'invoiceDate', label: 'Invoice Date' },
  { key: 'creditNote', label: 'CR Note' },
  { key: 'creditNoteDate', label: 'CR Date' },
  { key: 'mcoEffective', label: 'MCO Effective', format: money },
  { key: 'mcoRefund', label: 'MCO Refund', format: money },
  { key: 'premiumEffective', label: 'Prem Effective', format: money },
  { key: 'premiumReduction', label: 'Prem Reduction', format: money },
  { key: 'reinstatement', label: 'Reinstated', format: (v) => (v ? 'Yes' : '') },
]

export const memberHistoryColumns: Column[] = [
  { key: 'MembershipNo', label: 'Membership No' },
  { key: 'TopupInd', label: 'Top-up' },
  { key: 'TopupNumber', label: 'Top-up No' },
  { key: 'PolicyNo', label: 'Policy No' },
  { key: 'EffectiveDate', label: 'Eff Date' },
  { key: 'ExpiryDate', label: 'Exp Date' },
  { key: 'CancelDate', label: 'Cancel Date' },
  { key: 'DataStatus', label: 'Data Status' },
  { key: 'Status', label: 'Status' },
  { key: 'BordxDate', label: 'Bordx Date' },
  { key: 'EndtBordxDate', label: 'Endt Bordx' },
  { key: 'ValueDate', label: 'Value Date' },
]
