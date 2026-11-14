// The sidebar menu, laid out like Genesis FIS (layout/MenuTree there): the desktop's top menus in their order, each a group that opens and closes, with the items of a
// sub-menu (the `group` of an item) in a nested group. Items the user has no right to are left out, and a group with nothing left disappears.

import { Access } from '../auth/access'

export interface MenuItem {
  to: string
  label: string
  access: number
  /** The desktop sub-menu the item sits in (consecutive items with the same group form one sub-menu). */
  group?: string
}

export interface MenuSection {
  label: string
  items: MenuItem[]
}

export type MenuNode = { kind: 'link'; label: string; to: string } | { kind: 'group'; label: string; children: MenuNode[] }

export const menuSections: MenuSection[] = [
  {
    label: 'Membership',
    items: [
      { to: '/membership/registration', label: 'Registration', access: Access.MembershipRegistration },
      { to: '/membership/adjustment', label: 'Adjustment', access: Access.MembershipAdjustment },
      { to: '/membership/enquiry', label: 'Enquiry', access: Access.MembershipEnquiry },
      { to: '/membership/leaflet-card', label: 'Leaflet & Card', access: Access.MembershipEnquiry },
      { to: '/membership/card-control', label: 'Card Sending Mode', access: Access.MembershipAdjustment },
      { to: '/membership/reinstatement', label: 'Member Reinstatement', access: Access.MembershipAdjustment },
      { to: '/membership/mco-pending', label: 'MCO Pending', access: Access.MembershipAdjustment },
      { to: '/membership/deletion', label: 'Deletion', access: Access.MembershipAdjustment },
      { to: '/membership/tracking', label: 'Tracking', access: Access.MembershipTracking },
      { to: '/membership/pluto-upload', label: 'Upload Membership Excel (Pluto)', access: Access.MembershipUploadBordx },
      { to: '/membership/pluto-ascii', label: 'Generate Membership ASCII (Pluto)', access: Access.MembershipUploadBordx },
      { to: '/membership/upload-bordx', label: 'Upload Bordx', access: Access.MembershipUploadBordx },
      { to: '/membership/temp-registration', label: 'Temp MBM Reg', access: Access.MembershipRegistration },
      { to: '/membership/temp-adjustment', label: 'Temp MBM Adj', access: Access.MembershipAdjustment },
    ],
  },
  {
    // Desktop order of the Contribution Billing menu (the hidden items are not Required and not shown). Generate Invoice (Endorsement) is Generate Invoice by endorsement bordx date (its form is not in the source tree); Receipt MCO/Others is Finance > Invoice Receipt (Outstanding).
    label: 'Contribution Billing',
    items: [
      { to: '/contribution-billing/generate-invoice', label: 'Generate Invoice', access: Access.ContributionInvoicing },
      { to: '/contribution-billing/generate-invoice-endorsement', label: 'Generate Invoice (Endorsement)', access: Access.ContributionInvoicing },
      { to: '/contribution-billing/mco-reinstatement', label: 'MCO Reinstatement', access: Access.ContributionInvoicing },
      { to: '/contribution-billing/refund-listing', label: 'Refund Listing', access: Access.ContributionRefundListing },
    ],
  },
  {
    label: 'Case',
    items: [
      { to: '/case/registration', label: 'Registration', access: Access.CaseRegistration, group: 'Case Workflow' },
      { to: '/case/adjustment', label: 'Adjustment', access: Access.CaseAdjustment, group: 'Case Workflow' },
      { to: '/case/enquiry', label: 'Enquiry', access: Access.CaseEnquiry, group: 'Case Workflow' },
      { to: '/case/tracking', label: 'Tracking', access: Access.CaseTracking, group: 'Case Workflow' },
      { to: '/case/listing', label: 'Inpatient Case Listing', access: Access.CaseListing, group: 'Review & Listing' },
      { to: '/case/audit-review', label: 'Audit Review', access: Access.CaseAuditReview, group: 'Review & Listing' },
      { to: '/case/pay-claim', label: 'Pay & Claim', access: Access.CasePayClaim, group: 'Review & Listing' },
      { to: '/case/non-disclosure', label: 'Non-Disclosure Info', access: Access.CaseNonDisclosure, group: 'Review & Listing' },
      { to: '/case/transfer', label: 'Case Transfer', access: Access.CaseTransfer, group: 'Transfers & Reference' },
      { to: '/case/panel-hospitals', label: 'Panel Hospitals', access: Access.PanelHospitals, group: 'Transfers & Reference' },
      { to: '/case/mma-cpt', label: 'MMA / CPT', access: Access.MmaCpt, group: 'Transfers & Reference' },
      { to: '/case/claim-ascii', label: 'Claim ASCII', access: Access.ClaimAscii, group: 'Exports' },
      { to: '/case/case-ascii', label: 'Case ASCII', access: Access.CaseAscii, group: 'Exports' },
    ],
  },
  {
    label: 'Invoice',
    items: [
      { to: '/invoice/processing', label: 'Invoice Processing', access: Access.InvoiceProcessing },
      { to: '/invoice/original-update', label: 'Original Invoice Update', access: Access.InvoiceOriginalUpdate },
      { to: '/invoice/member-accounting', label: 'Invoice MBM Accounting', access: Access.InvoiceMemberAccounting },
      { to: '/invoice/hospital-accounting', label: 'Invoice HOS Accounting', access: Access.InvoiceHospitalAccounting },
      { to: '/invoice/tracking', label: 'Invoice Tracking', access: Access.InvoiceTracking },
    ],
  },
  {
    label: 'Worksheet',
    items: [
      { to: '/worksheet/registration', label: 'Registration', access: Access.WorksheetRegistration, group: 'Worksheet Workflow' },
      { to: '/worksheet/adjustment', label: 'Adjustment', access: Access.WorksheetAdjustment, group: 'Worksheet Workflow' },
      { to: '/worksheet/enquiry', label: 'Enquiry', access: Access.WorksheetEnquiry, group: 'Worksheet Workflow' },
      { to: '/worksheet/send-to-accounts', label: 'Send to A/C', access: Access.WorksheetSendToAccounts, group: 'Accounts & Tracking' },
      { to: '/worksheet/send-to-ar', label: 'Send to A/R', access: Access.WorksheetSendToAr, group: 'Accounts & Tracking' },
      { to: '/worksheet/tracking', label: 'Tracking', access: Access.WorksheetTracking, group: 'Accounts & Tracking' },
    ],
  },
  {
    // Authorize Claims of the desktop menu: DCU Tracking > Claim Report is built (the Jupiter report is the same form); Claim Pass to A/C opens Worksheet > Send to A/C: no form has its name, and FrmWksSendToAC ("Claims Send To A/C") is the form that passes claims to accounts.
    label: 'Authorize Claims',
    items: [
      { to: '/authorize/dcu-report', label: 'Claim Report', access: Access.AuthorizeDcuReport, group: 'DCU Tracking' },
      { to: '/worksheet/send-to-accounts', label: 'Claim Pass to A/C', access: Access.WorksheetSendToAccounts },
    ],
  },
  {
    // Desktop order of the Claim Bordx menu; items still to migrate are shown disabled. Insert Worksheet is the form Case > Inpatient Case Listing opens (FrmWksBordx).
    label: 'Claim Bordx',
    items: [
      { to: '/claim-bordx/insert-worksheet', label: 'Insert Worksheet', access: Access.ClaimBordx, group: 'Worksheet' },
      { to: '/claim-bordx/remove-worksheet', label: 'Remove Worksheet', access: Access.ClaimBordx, group: 'Worksheet' },
      { to: '/claim-bordx/print-bordx', label: 'Print Bordx', access: Access.ClaimBordxPrint },
      { to: '/claim-bordx/print-recovery', label: 'Print Recovery', access: Access.ClaimBordx },
      { to: '/claim-bordx/payment-advice-bordx', label: 'Generate Bordx No', access: Access.ClaimBordx, group: 'Payment Advice' },
      { to: '/claim-bordx/hospital-report', label: 'Hospital Report', access: Access.ClaimBordx, group: 'Payment Advice' },
      { to: '/claim-bordx/update-bordx', label: 'Update Bordx', access: Access.ClaimBordx },
      { to: '/claim-bordx/bordx-send-date', label: 'Bordx Send Date', access: Access.ClaimBordx, group: 'Bor Delivery' },
      { to: '/claim-bordx/send-to-payor', label: 'Send to Payor', access: Access.ClaimBordx, group: 'Bor Delivery' },
      { to: '/claim-bordx/returned-from-payor', label: 'Returned From Payor', access: Access.ClaimBordx, group: 'Bor Delivery' },
      { to: '/claim-bordx/returned-not-approved', label: 'Returned Fr Payor (Not App)', access: Access.ClaimBordx, group: 'Bor Delivery' },
      { to: '/claim-bordx/send-to-accounts', label: 'Send to A/C', access: Access.ClaimBordx, group: 'Bor Delivery' },
      { to: '/claim-bordx/bordx-control', label: 'Bordx Control', access: Access.ClaimBordx, group: 'Monitoring' },
      { to: '/claim-bordx/outstanding-bordx', label: 'Outstanding Bordx', access: Access.ClaimBordx, group: 'Monitoring' },
      { to: '/claim-bordx/approval', label: 'Bordx Approval', access: Access.ClaimBordx },
      { to: '/claim-bordx/storage-claim-files', label: 'Claim files', access: Access.ClaimBordx, group: 'Storage' },
      { to: '/claim-bordx/storage-enquiry', label: 'Storage Enquiry', access: Access.ClaimBordx, group: 'Storage' },
      { to: '/claim-bordx/storage-document', label: 'Document', access: Access.ClaimBordx, group: 'Storage' },
    ],
  },
  {
    // Desktop order of the Finance menu; items still to migrate are shown disabled.
    label: 'Finance',
    items: [
      { to: '/finance/receipt-enquiry', label: 'Receipt Enquiry', access: Access.FinanceReceiptEnquiry },
      { to: '/finance/invoice-receipt', label: 'Invoice Receipt (Outstanding)', access: Access.FinanceInvoiceReceipt },
      { to: '/finance/short-payment', label: 'Short Payment Receipt', access: Access.FinanceShortPayment },
      { to: '/finance/reverse-receipt', label: 'Reverse Receipt', access: Access.FinanceReverseReceipt },
      { to: '/finance/receipt-manual', label: 'Notification / Suspension', access: Access.FinanceReceiptManual },
      { to: '/finance/suspend-active', label: 'Suspend / Active', access: Access.FinanceSuspendActive },
      { to: '/finance/electronic-banking', label: 'Electronic Banking', access: Access.FinanceElectronicBanking },
      { to: '/finance/sun-posting', label: 'SUN Posting', access: Access.FinanceSunPosting },
    ],
  },
  {
    // Desktop order of the Payment menu. Payment > Update Invoice is the form Invoice > Original Invoice Update (frmUpdateInvoice) and To Member > Chq. Reissue (frmPaymentMBMReissue) and Chq. Cancellation (FrmPaymentMBMReverse: a cancelled cheque is the C row Suspend / Active writes) are Finance > Suspend / Active, each listed as another door to the built screen; the forms of To Hospital, Pay2MBM,
    // Pay2MBM(Auto), Payor, Others and PV Update (Manual) are not in the source tree and are rebuilt on the data they read and wrote (the API's docs/payment-screens.md lists the assumptions).
    label: 'Payment',
    items: [
      { to: '/payment/to-hospital', label: 'To Hospital', access: Access.PaymentToHospital },
      { to: '/payment/to-member-auto', label: 'Pay2MBM(Auto)', access: Access.PaymentToMember, group: 'To Member' },
      { to: '/payment/to-member', label: 'Pay2MBM', access: Access.PaymentToMember, group: 'To Member' },
      { to: '/finance/suspend-active', label: 'Chq. Cancellation', access: Access.FinanceSuspendActive, group: 'To Member' },
      { to: '/finance/suspend-active', label: 'Chq. Reissue', access: Access.FinanceSuspendActive, group: 'To Member' },
      { to: '/payment/to-payor', label: 'Payor', access: Access.PaymentPayor },
      { to: '/payment/others', label: 'Others', access: Access.PaymentOthers },
      { to: '/payment/contra-allocation', label: 'Contra Allocation', access: Access.PaymentContraAllocation },
      { to: '/invoice/original-update', label: 'Update Invoice', access: Access.InvoiceOriginalUpdate },
      { to: '/payment/tracking', label: 'Payment Tracking', access: Access.PaymentTracking },
      { to: '/payment/enquiry-hospital', label: 'Payment To Hospital', access: Access.PaymentEnquiry, group: 'Enquiry' },
      { to: '/payment/enquiry-member', label: 'Payment To Member', access: Access.PaymentEnquiry, group: 'Enquiry' },
      { to: '/payment/pv-update', label: 'PV Update (Manual)', access: Access.PaymentPvUpdate },
    ],
  },
  {
    // Desktop order of the Receipt menu; the receipt entry forms still to migrate are shown disabled ("Payor (Manual)" is not marked Required).
    label: 'Receipt',
    items: [
      { to: '/receipt/from-member', label: 'From Member', access: Access.ReceiptMember },
      { to: '/receipt/others', label: 'Others', access: Access.ReceiptOthers },
      { to: '/receipt/from-payor', label: 'Payor', access: Access.ReceiptPayor },
      { to: '/receipt/tracking', label: 'Receipt Tracking', access: Access.ReceiptTracking },
    ],
  },
  {
    // Posting > Invoice: Hospital here; Member is Finance > SUN Posting (the same form, listed as another door).
    label: 'Posting',
    items: [
      { to: '/posting/invoice-hospital', label: 'Hospital', access: Access.PostingInvoiceHospital, group: 'Invoice' },
      { to: '/finance/sun-posting', label: 'Member', access: Access.FinanceSunPosting, group: 'Invoice' },
    ],
  },
  {
    label: 'Maintenance',
    items: [
      { to: '/maintenance/plan', label: 'Plan Maintenance', access: Access.PlanMaintenance },
      { to: '/maintenance/benefits', label: 'Benefits Maintenance', access: Access.BenefitsMaintenance },
      { to: '/maintenance/entity', label: 'Entity Maintenance', access: Access.EntityMaintenance },
      { to: '/maintenance/accounts', label: 'Accounts', access: Access.AccountsMaintenance },
      { to: '/maintenance/account-transaction', label: 'Account Transaction', access: Access.AccountTransaction },
      { to: '/maintenance/member', label: 'Member', access: Access.MemberMaintenance },
      { to: '/maintenance/panel-hospitals', label: 'Panel Hospital Maintenance', access: Access.PanelHospitalMaintenance },
      { to: '/maintenance/company-info', label: 'Company Info', access: Access.CompanyInfo },
      { to: '/maintenance/suspension', label: 'Suspension', access: Access.Suspension },
      { to: '/maintenance/surgical-schedule', label: 'Surgical Schedule', access: Access.SurgicalSchedule },
      { to: '/maintenance/mma', label: 'MMA (Procedures/OPCS)', access: Access.MmaEntry },
      { to: '/maintenance/security/department', label: 'Department', access: Access.SecurityDepartment, group: 'Security' },
      { to: '/maintenance/security/role-management', label: 'Role Management', access: Access.SecurityUsers, group: 'Security' },
      { to: '/maintenance/security/user-permission', label: 'User Permission', access: Access.SecurityUsers, group: 'Security' },
    ],
  },
]

/** The tree the user may see: each section a group, its sub-menus nested groups. */
export function visibleMenu(sections: MenuSection[], hasAccess: (position: number) => boolean): MenuNode[] {
  const tree: MenuNode[] = []
  for (const section of sections) {
    const children: MenuNode[] = []
    let sub = null as { label: string; children: MenuNode[] } | null
    for (const item of section.items.filter((i) => hasAccess(i.access))) {
      const link: MenuNode = { kind: 'link', label: item.label, to: item.to }
      if (!item.group) {
        sub = null
        children.push(link)
      } else if (sub?.label === item.group) {
        sub.children.push(link)
      } else {
        sub = { label: item.group, children: [link] }
        children.push({ kind: 'group', ...sub })
      }
    }
    if (children.length > 0) tree.push({ kind: 'group', label: section.label, children })
  }
  return tree
}

/** Whether the page shown is in the group, so the group opens itself. */
export function containsRoute(node: MenuNode, pathname: string): boolean {
  if (node.kind === 'link') return pathname === node.to || pathname.startsWith(`${node.to}/`)
  return node.children.some((c) => containsRoute(c, pathname))
}
