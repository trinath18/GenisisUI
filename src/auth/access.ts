import { useContext } from 'react'
import { AuthContext } from './context'

/** Menu access positions in USR.USRAccess (VB6 CheckAccess). */
export const Access = {
  MembershipRegistration: 1,
  MembershipAdjustment: 2,
  MembershipEnquiry: 3,
  MembershipUploadBordx: 4,
  MembershipTracking: 14,
  // Maintenance > Plan shares position 1 with Registration in the desktop menu.
  PlanMaintenance: 1,
  // Maintenance > Benefits also checks position 1 (mnuBenefits_Click).
  BenefitsMaintenance: 1,
  // Maintenance > Entity (mnuAgent_Click) and Accounts (MaintenanceAccounts_Click) check position 1 too.
  EntityMaintenance: 1,
  AccountsMaintenance: 1,
  // Maintenance > Account Transaction (MnuAccountTrans_Click) checks position 1 too.
  AccountTransaction: 1,
  // Maintenance > Security: the matrix's own Department (111) and User Permission (112) rights, not the desktop's CheckAccess(2).
  SecurityDepartment: 111,
  SecurityUsers: 112,
  // Maintenance > MMA (Procedures/OPCS): no desktop handler; the matrix's Maintenance MMA checkbox.
  MmaEntry: 147,
  // Case menu positions in mdiMain.frm (CaseEntry=11, CASInMBM=7, CaseAdjustment=12, CaseTracking=15).
  CaseRegistration: 11,
  CaseEnquiry: 7,
  CaseAdjustment: 12,
  CaseTracking: 15,
  // Case > Inpatient Case Listing (mnuAppCase_Click) checks position 7.
  CaseListing: 7,
  // Case > Claim ASCII (mnuClaimAscii_Click) checks position 18; Case ASCII has no click handler and is gated the same way.
  ClaimAscii: 18,
  CaseAscii: 18,
  // Menu items without a click handler in mdiMain.frm (their forms are never opened by the desktop app) are gated like
  // the closest sibling screen: Case Transfer / Pay & Claim / Audit Review / Non-Disclosure like Adjustment,
  // Panel Hospitals like Enquiry, MMA/CPT like the other fee-schedule maintenance screens.
  CaseTransfer: 12,
  CasePayClaim: 12,
  CaseAuditReview: 12,
  CaseNonDisclosure: 12,
  PanelHospitals: 7,
  MmaCpt: 1,
  // Worksheet menu. Registration (22) and Adjustment (23) are the positions the desktop's scan codes LOW001 / LOW002 checked, Tracking (24)
  // is LOW003, Enquiry (13) is mnuWSEnq_Click. Send to A/C and Send to A/R have no click handler and are gated like Tracking.
  // Keep in step with Genisis.Api/Auth/AccessRight.cs.
  WorksheetRegistration: 22,
  // Invoice > Invoice Processing is CheckAccess(22) in the desktop (mniInvoiceProcess_Click), the same position as the Worksheet Registration scan code.
  InvoiceProcessing: 22,
  // Invoice > Original Invoice Update has no click handler in the desktop and is hidden: gated like Invoice Processing, which edits the same invoices. Invoice Tracking is
  // CheckAccess(27) (mnuInvTrack_Click); the two accounting items have no handler either and are gated like Tracking. Keep in step with Genisis.Api/Auth/AccessRight.cs.
  InvoiceOriginalUpdate: 22,
  InvoiceTracking: 27,
  InvoiceHospitalAccounting: 27,
  InvoiceMemberAccounting: 27,
  WorksheetAdjustment: 23,
  WorksheetTracking: 24,
  WorksheetEnquiry: 13,
  WorksheetSendToAccounts: 24,
  WorksheetSendToAr: 24,
  // Finance menu (mdiMain.frm): Invoice Receipt / Short Payment / Reverse Receipt check 9, Notification-Suspension and Suspend-Active 12,
  // Electronic Banking 10, SUN Posting 13. Receipt Enquiry has no check in the desktop and is gated like Invoice Receipt.
  FinanceReceiptEnquiry: 9,
  FinanceInvoiceReceipt: 9,
  FinanceShortPayment: 9,
  FinanceReverseReceipt: 9,
  FinanceReceiptManual: 12,
  FinanceSuspendActive: 12,
  FinanceElectronicBanking: 10,
  FinanceSunPosting: 13,
} as const

export class MustChangePasswordError extends Error {}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider')
  return ctx
}
