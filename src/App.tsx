import { Navigate, Route, Routes } from 'react-router-dom'
import type { ReactNode } from 'react'
import { Access, useAuth } from './auth/access'
import { AppLayout } from './components/AppLayout'
import { HomePage, NotMigratedPage } from './pages/HomePage'
import { LoginPage } from './pages/LoginPage'
import { EnquiryPage } from './pages/membership/EnquiryPage'
import { RegistrationPage } from './pages/membership/RegistrationPage'
import { AdjustmentPage } from './features/membership/adjustment/pages/AdjustmentPage'
import { UploadBordxPage } from './features/membership/bordx/pages/UploadBordxPage'
import { TrackingPage } from './features/membership/tracking/pages/TrackingPage'
import { TempAdjustmentPage } from './features/membership/tempAdjustment/pages/TempAdjustmentPage'
import { TempRegistrationPage } from './features/membership/tempRegistration/pages/TempRegistrationPage'
import { LeafletCardPage } from './features/membership/leafletCard/pages/LeafletCardPage'
import { DeletionPage } from './features/membership/deletion/pages/DeletionPage'
import { CardControlPage } from './features/membership/cardControl/pages/CardControlPage'
import { PlutoAsciiPage } from './features/membership/pluto/pages/PlutoAsciiPage'
import { PlutoUploadPage } from './features/membership/pluto/pages/PlutoUploadPage'
import { McoPendingPage } from './features/membership/mcoPending/pages/McoPendingPage'
import { ReinstatementPage } from './features/membership/reinstatement/pages/ReinstatementPage'
import { PlanMaintenanceScreen } from './pages/maintenance/PlanMaintenanceScreen'
import { BenefitsMaintenanceScreen } from './features/maintenance/benefits/pages/BenefitsMaintenanceScreen'
import { EntityMaintenanceScreen } from './features/maintenance/entity/pages/EntityMaintenanceScreen'
import { AccountsScreen } from './features/maintenance/accounts/pages/AccountsScreen'
import { AccountTransactionScreen } from './features/maintenance/accountTransaction/pages/AccountTransactionScreen'
import { MemberDatesScreen } from './features/maintenance/memberDates/pages/MemberDatesScreen'
import { SuspensionScreen } from './features/maintenance/suspension/pages/SuspensionScreen'
import { DepartmentScreen } from './features/maintenance/security/pages/DepartmentScreen'
import { UserSecurityScreen } from './features/maintenance/security/pages/UserSecurityScreen'
import { MmaEntryScreen } from './features/maintenance/mmaEntry/pages/MmaEntryScreen'
import { CaseEnquiryPage } from './pages/case/CaseEnquiryPage'
import { CaseRegistrationPage } from './pages/case/CaseRegistrationPage'
import { CaseAdjustmentPage } from './pages/case/CaseAdjustmentPage'
import { CaseTrackingPage } from './pages/case/CaseTrackingPage'
import { CaseListingPage } from './pages/case/CaseListingPage'
import { BordxDeliveryPage } from './pages/claimBordx/BordxDeliveryPage'
import { BordxReturnCasePage } from './pages/claimBordx/BordxReturnCasePage'
import { BordxControlPage } from './pages/claimBordx/BordxControlPage'
import { BordxRevisePage } from './pages/claimBordx/BordxRevisePage'
import { GenerateInvoicePage } from './pages/contributionBilling/GenerateInvoicePage'
import { McoReinstatementPage } from './pages/contributionBilling/McoReinstatementPage'
import { RefundListingPage } from './pages/contributionBilling/RefundListingPage'
import { StorageEntryPage } from './pages/claimBordx/StorageEntryPage'
import { UpdateBordxPage } from './pages/claimBordx/UpdateBordxPage'
import { DcuReportPage } from './pages/authorize/DcuReportPage'
import { InvoiceHospitalPage } from './pages/posting/InvoiceHospitalPage'
import { ReceiptMemberPage } from './pages/receipt/ReceiptMemberPage'
import { ReceiptPayorPage } from './pages/receipt/ReceiptPayorPage'
import { ReceiptTrackingPage } from './pages/receipt/ReceiptTrackingPage'
import { PrintRecoveryPage } from './pages/claimBordx/PrintRecoveryPage'
import { OutstandingBordxPage } from './pages/claimBordx/OutstandingBordxPage'
import { HospitalReportPage } from './pages/claimBordx/HospitalReportPage'
import { PaymentAdviceBordxPage } from './pages/claimBordx/PaymentAdviceBordxPage'
import { PrintBordxPage } from './pages/claimBordx/PrintBordxPage'
import { StorageDocumentPage } from './pages/claimBordx/StorageDocumentPage'
import { StorageEnquiryPage } from './pages/claimBordx/StorageEnquiryPage'
import { CaseTransferPage } from './pages/case/CaseTransferPage'
import { PanelHospitalsPage } from './pages/case/PanelHospitalsPage'
import { CaseAuditReviewPage } from './pages/case/CaseAuditReviewPage'
import { MmaCptPage } from './pages/case/MmaCptPage'
import { CasePayClaimPage } from './pages/case/CasePayClaimPage'
import { CaseNonDisclosurePage } from './pages/case/CaseNonDisclosurePage'
import { CaseAsciiPage, ClaimAsciiPage } from './pages/case/AsciiExportPages'
import { SunPostingPage } from './features/finance/sunPosting/pages/SunPostingPage'
import { ReceiptEnquiryPage } from './features/finance/receiptEnquiry/pages/ReceiptEnquiryPage'
import { InvoiceReceiptPage } from './features/finance/invoiceReceipt/pages/InvoiceReceiptPage'
import { ReverseReceiptPage } from './features/finance/reverseReceipt/pages/ReverseReceiptPage'
import { SuspendActivePage } from './features/finance/suspendActive/pages/SuspendActivePage'
import { ElectronicBankingPage } from './features/finance/electronicBanking/pages/ElectronicBankingPage'
import { WorksheetRegistrationPage } from './pages/worksheet/WorksheetRegistrationPage'
import { InvoiceProcessingPage } from './pages/invoice/InvoiceProcessingPage'
import { InvoiceOriginalUpdatePage } from './pages/invoice/InvoiceOriginalUpdatePage'
import { InvoiceHospitalAccountingPage } from './pages/invoice/InvoiceHospitalAccountingPage'
import { InvoiceMemberAccountingPage } from './pages/invoice/InvoiceMemberAccountingPage'
import { InvoiceTrackingPage } from './pages/invoice/InvoiceTrackingPage'
import { WorksheetAdjustmentPage } from './pages/worksheet/WorksheetAdjustmentPage'
import { WorksheetEnquiryPage } from './pages/worksheet/WorksheetEnquiryPage'
import { WorksheetTrackingPage } from './pages/worksheet/WorksheetTrackingPage'
import { WorksheetSendToAccountsPage } from './pages/worksheet/WorksheetSendToAccountsPage'
import { WorksheetSendToArPage } from './pages/worksheet/WorksheetSendToArPage'

function RequireAuth({ children }: { children: ReactNode }) {
  const { session } = useAuth()
  return session ? children : <Navigate to="/login" replace />
}

function RequireAccess({ position, children }: { position: number; children: ReactNode }) {
  const { hasAccess } = useAuth()
  return hasAccess(position) ? children : <NotMigratedPage title="Access Denied!" message="You do not have access to this screen. Ask your administrator to grant it." />
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route
        element={
          <RequireAuth>
            <AppLayout />
          </RequireAuth>
        }
      >
        <Route index element={<HomePage />} />
        <Route
          path="membership/enquiry"
          element={
            <RequireAccess position={Access.MembershipEnquiry}>
              <EnquiryPage />
            </RequireAccess>
          }
        />
        <Route
          path="membership/registration"
          element={
            <RequireAccess position={Access.MembershipRegistration}>
              <RegistrationPage />
            </RequireAccess>
          }
        />
        <Route
          path="membership/adjustment"
          element={
            <RequireAccess position={Access.MembershipAdjustment}>
              <AdjustmentPage />
            </RequireAccess>
          }
        />
        <Route
          path="membership/upload-bordx"
          element={
            <RequireAccess position={Access.MembershipUploadBordx}>
              <UploadBordxPage />
            </RequireAccess>
          }
        />
        <Route
          path="case/registration"
          element={
            <RequireAccess position={Access.CaseRegistration}>
              <CaseRegistrationPage />
            </RequireAccess>
          }
        />
        <Route
          path="case/adjustment"
          element={
            <RequireAccess position={Access.CaseAdjustment}>
              <CaseAdjustmentPage />
            </RequireAccess>
          }
        />
        <Route
          path="case/enquiry"
          element={
            <RequireAccess position={Access.CaseEnquiry}>
              <CaseEnquiryPage />
            </RequireAccess>
          }
        />
        <Route
          path="case/tracking"
          element={
            <RequireAccess position={Access.CaseTracking}>
              <CaseTrackingPage />
            </RequireAccess>
          }
        />
        <Route
          path="case/listing"
          element={
            <RequireAccess position={Access.CaseListing}>
              <CaseListingPage />
            </RequireAccess>
          }
        />
        <Route
          path="case/audit-review"
          element={
            <RequireAccess position={Access.CaseAuditReview}>
              <CaseAuditReviewPage />
            </RequireAccess>
          }
        />
        <Route
          path="case/pay-claim"
          element={
            <RequireAccess position={Access.CasePayClaim}>
              <CasePayClaimPage />
            </RequireAccess>
          }
        />
        <Route
          path="case/non-disclosure"
          element={
            <RequireAccess position={Access.CaseNonDisclosure}>
              <CaseNonDisclosurePage />
            </RequireAccess>
          }
        />
        <Route
          path="case/transfer"
          element={
            <RequireAccess position={Access.CaseTransfer}>
              <CaseTransferPage />
            </RequireAccess>
          }
        />
        <Route
          path="case/panel-hospitals"
          element={
            <RequireAccess position={Access.PanelHospitals}>
              <PanelHospitalsPage />
            </RequireAccess>
          }
        />
        <Route
          path="case/mma-cpt"
          element={
            <RequireAccess position={Access.MmaCpt}>
              <MmaCptPage />
            </RequireAccess>
          }
        />
        <Route
          path="case/claim-ascii"
          element={
            <RequireAccess position={Access.ClaimAscii}>
              <ClaimAsciiPage />
            </RequireAccess>
          }
        />
        <Route
          path="case/case-ascii"
          element={
            <RequireAccess position={Access.CaseAscii}>
              <CaseAsciiPage />
            </RequireAccess>
          }
        />
        <Route
          path="invoice/processing"
          element={
            <RequireAccess position={Access.InvoiceProcessing}>
              <InvoiceProcessingPage />
            </RequireAccess>
          }
        />
        <Route
          path="invoice/original-update"
          element={
            <RequireAccess position={Access.InvoiceOriginalUpdate}>
              <InvoiceOriginalUpdatePage />
            </RequireAccess>
          }
        />
        <Route
          path="invoice/member-accounting"
          element={
            <RequireAccess position={Access.InvoiceMemberAccounting}>
              <InvoiceMemberAccountingPage />
            </RequireAccess>
          }
        />
        <Route
          path="invoice/hospital-accounting"
          element={
            <RequireAccess position={Access.InvoiceHospitalAccounting}>
              <InvoiceHospitalAccountingPage />
            </RequireAccess>
          }
        />
        <Route
          path="invoice/tracking"
          element={
            <RequireAccess position={Access.InvoiceTracking}>
              <InvoiceTrackingPage />
            </RequireAccess>
          }
        />
        <Route
          path="worksheet/registration"
          element={
            <RequireAccess position={Access.WorksheetRegistration}>
              <WorksheetRegistrationPage />
            </RequireAccess>
          }
        />
        <Route
          path="worksheet/adjustment"
          element={
            <RequireAccess position={Access.WorksheetAdjustment}>
              <WorksheetAdjustmentPage />
            </RequireAccess>
          }
        />
        <Route
          path="worksheet/enquiry"
          element={
            <RequireAccess position={Access.WorksheetEnquiry}>
              <WorksheetEnquiryPage />
            </RequireAccess>
          }
        />
        <Route
          path="claim-bordx/insert-worksheet"
          element={
            <RequireAccess position={Access.ClaimBordx}>
              <CaseListingPage />
            </RequireAccess>
          }
        />
        <Route
          path="claim-bordx/remove-worksheet"
          element={
            <RequireAccess position={Access.ClaimBordx}>
              <BordxRevisePage />
            </RequireAccess>
          }
        />
        <Route
          path="contribution-billing/generate-invoice"
          element={
            <RequireAccess position={Access.ContributionInvoicing}>
              <GenerateInvoicePage />
            </RequireAccess>
          }
        />
        <Route
          path="contribution-billing/mco-reinstatement"
          element={
            <RequireAccess position={Access.ContributionInvoicing}>
              <McoReinstatementPage />
            </RequireAccess>
          }
        />
        <Route
          path="contribution-billing/refund-listing"
          element={
            <RequireAccess position={Access.ContributionRefundListing}>
              <RefundListingPage />
            </RequireAccess>
          }
        />
        <Route
          path="authorize/dcu-report"
          element={
            <RequireAccess position={Access.AuthorizeDcuReport}>
              <DcuReportPage />
            </RequireAccess>
          }
        />
        <Route
          path="posting/invoice-hospital"
          element={
            <RequireAccess position={Access.PostingInvoiceHospital}>
              <InvoiceHospitalPage />
            </RequireAccess>
          }
        />
        <Route
          path="receipt/from-member"
          element={
            <RequireAccess position={Access.ReceiptMember}>
              <ReceiptMemberPage />
            </RequireAccess>
          }
        />
        <Route
          path="receipt/from-payor"
          element={
            <RequireAccess position={Access.ReceiptPayor}>
              <ReceiptPayorPage />
            </RequireAccess>
          }
        />
        <Route
          path="receipt/tracking"
          element={
            <RequireAccess position={Access.ReceiptTracking}>
              <ReceiptTrackingPage />
            </RequireAccess>
          }
        />
        <Route
          path="claim-bordx/hospital-report"
          element={
            <RequireAccess position={Access.ClaimBordx}>
              <HospitalReportPage />
            </RequireAccess>
          }
        />
        <Route
          path="claim-bordx/payment-advice-bordx"
          element={
            <RequireAccess position={Access.ClaimBordx}>
              <PaymentAdviceBordxPage />
            </RequireAccess>
          }
        />
        <Route
          path="claim-bordx/print-bordx"
          element={
            <RequireAccess position={Access.ClaimBordxPrint}>
              <PrintBordxPage />
            </RequireAccess>
          }
        />
        <Route
          path="claim-bordx/update-bordx"
          element={
            <RequireAccess position={Access.ClaimBordx}>
              <UpdateBordxPage />
            </RequireAccess>
          }
        />
        <Route
          path="claim-bordx/storage-claim-files"
          element={
            <RequireAccess position={Access.ClaimBordx}>
              <StorageEntryPage />
            </RequireAccess>
          }
        />
        <Route
          path="claim-bordx/print-recovery"
          element={
            <RequireAccess position={Access.ClaimBordx}>
              <PrintRecoveryPage />
            </RequireAccess>
          }
        />
        <Route
          path="claim-bordx/outstanding-bordx"
          element={
            <RequireAccess position={Access.ClaimBordx}>
              <OutstandingBordxPage />
            </RequireAccess>
          }
        />
        <Route
          path="claim-bordx/bordx-control"
          element={
            <RequireAccess position={Access.ClaimBordx}>
              <BordxControlPage />
            </RequireAccess>
          }
        />
        <Route
          path="claim-bordx/storage-document"
          element={
            <RequireAccess position={Access.ClaimBordx}>
              <StorageDocumentPage />
            </RequireAccess>
          }
        />
        <Route
          path="claim-bordx/storage-enquiry"
          element={
            <RequireAccess position={Access.ClaimBordx}>
              <StorageEnquiryPage />
            </RequireAccess>
          }
        />
        <Route
          path="claim-bordx/send-to-payor"
          element={
            <RequireAccess position={Access.ClaimBordx}>
              <BordxDeliveryPage kind="to-payor" />
            </RequireAccess>
          }
        />
        <Route
          path="claim-bordx/returned-from-payor"
          element={
            <RequireAccess position={Access.ClaimBordx}>
              <BordxDeliveryPage kind="from-payor" />
            </RequireAccess>
          }
        />
        <Route
          path="claim-bordx/returned-not-approved"
          element={
            <RequireAccess position={Access.ClaimBordx}>
              <BordxReturnCasePage />
            </RequireAccess>
          }
        />
        <Route
          path="claim-bordx/approval"
          element={
            <RequireAccess position={Access.ClaimBordx}>
              <BordxDeliveryPage kind="approval" />
            </RequireAccess>
          }
        />
        <Route
          path="claim-bordx/send-to-accounts"
          element={
            <RequireAccess position={Access.ClaimBordx}>
              <BordxDeliveryPage kind="to-accounts" />
            </RequireAccess>
          }
        />
        <Route
          path="worksheet/send-to-accounts"
          element={
            <RequireAccess position={Access.WorksheetSendToAccounts}>
              <WorksheetSendToAccountsPage />
            </RequireAccess>
          }
        />
        <Route
          path="worksheet/send-to-ar"
          element={
            <RequireAccess position={Access.WorksheetSendToAr}>
              <WorksheetSendToArPage />
            </RequireAccess>
          }
        />
        <Route
          path="worksheet/tracking"
          element={
            <RequireAccess position={Access.WorksheetTracking}>
              <WorksheetTrackingPage />
            </RequireAccess>
          }
        />
        <Route
          path="membership/tracking"
          element={
            <RequireAccess position={Access.MembershipTracking}>
              <TrackingPage />
            </RequireAccess>
          }
        />
        <Route
          path="membership/temp-adjustment"
          element={
            <RequireAccess position={Access.MembershipAdjustment}>
              <TempAdjustmentPage />
            </RequireAccess>
          }
        />
        <Route
          path="membership/temp-registration"
          element={
            <RequireAccess position={Access.MembershipRegistration}>
              <TempRegistrationPage />
            </RequireAccess>
          }
        />
        <Route
          path="membership/leaflet-card"
          element={
            <RequireAccess position={Access.MembershipEnquiry}>
              <LeafletCardPage />
            </RequireAccess>
          }
        />
        <Route
          path="membership/deletion"
          element={
            <RequireAccess position={Access.MembershipAdjustment}>
              <DeletionPage />
            </RequireAccess>
          }
        />
        <Route
          path="membership/card-control"
          element={
            <RequireAccess position={Access.MembershipAdjustment}>
              <CardControlPage />
            </RequireAccess>
          }
        />
        <Route
          path="membership/pluto-ascii"
          element={
            <RequireAccess position={Access.MembershipUploadBordx}>
              <PlutoAsciiPage />
            </RequireAccess>
          }
        />
        <Route
          path="membership/pluto-upload"
          element={
            <RequireAccess position={Access.MembershipUploadBordx}>
              <PlutoUploadPage />
            </RequireAccess>
          }
        />
        <Route
          path="membership/mco-pending"
          element={
            <RequireAccess position={Access.MembershipAdjustment}>
              <McoPendingPage />
            </RequireAccess>
          }
        />
        <Route
          path="membership/reinstatement"
          element={
            <RequireAccess position={Access.MembershipAdjustment}>
              <ReinstatementPage />
            </RequireAccess>
          }
        />
        <Route
          path="finance/receipt-enquiry"
          element={
            <RequireAccess position={Access.FinanceReceiptEnquiry}>
              <ReceiptEnquiryPage />
            </RequireAccess>
          }
        />
        <Route
          path="finance/invoice-receipt"
          element={
            <RequireAccess position={Access.FinanceInvoiceReceipt}>
              <InvoiceReceiptPage />
            </RequireAccess>
          }
        />
        <Route
          path="finance/short-payment"
          element={
            <RequireAccess position={Access.FinanceShortPayment}>
              <InvoiceReceiptPage key="short" shortPayment />
            </RequireAccess>
          }
        />
        <Route
          path="finance/reverse-receipt"
          element={
            <RequireAccess position={Access.FinanceReverseReceipt}>
              <ReverseReceiptPage />
            </RequireAccess>
          }
        />
        <Route
          path="finance/receipt-manual"
          element={
            <RequireAccess position={Access.FinanceReceiptManual}>
              <InvoiceReceiptPage key="manual" manual />
            </RequireAccess>
          }
        />
        <Route
          path="finance/suspend-active"
          element={
            <RequireAccess position={Access.FinanceSuspendActive}>
              <SuspendActivePage />
            </RequireAccess>
          }
        />
        <Route
          path="finance/electronic-banking"
          element={
            <RequireAccess position={Access.FinanceElectronicBanking}>
              <ElectronicBankingPage />
            </RequireAccess>
          }
        />
        <Route
          path="finance/sun-posting"
          element={
            <RequireAccess position={Access.FinanceSunPosting}>
              <SunPostingPage />
            </RequireAccess>
          }
        />
        <Route
          path="maintenance/plan"
          element={
            <RequireAccess position={Access.PlanMaintenance}>
              <PlanMaintenanceScreen />
            </RequireAccess>
          }
        />
        <Route
          path="maintenance/benefits"
          element={
            <RequireAccess position={Access.BenefitsMaintenance}>
              <BenefitsMaintenanceScreen />
            </RequireAccess>
          }
        />
        <Route
          path="maintenance/entity"
          element={
            <RequireAccess position={Access.EntityMaintenance}>
              <EntityMaintenanceScreen />
            </RequireAccess>
          }
        />
        <Route
          path="maintenance/accounts"
          element={
            <RequireAccess position={Access.AccountsMaintenance}>
              <AccountsScreen />
            </RequireAccess>
          }
        />
        <Route
          path="maintenance/account-transaction"
          element={
            <RequireAccess position={Access.AccountTransaction}>
              <AccountTransactionScreen />
            </RequireAccess>
          }
        />
        <Route
          path="maintenance/member"
          element={
            <RequireAccess position={Access.MemberMaintenance}>
              <MemberDatesScreen />
            </RequireAccess>
          }
        />
        <Route
          path="maintenance/suspension"
          element={
            <RequireAccess position={Access.Suspension}>
              <SuspensionScreen />
            </RequireAccess>
          }
        />
        <Route
          path="maintenance/mma"
          element={
            <RequireAccess position={Access.MmaEntry}>
              <MmaEntryScreen />
            </RequireAccess>
          }
        />
        <Route
          path="maintenance/security/department"
          element={
            <RequireAccess position={Access.SecurityDepartment}>
              <DepartmentScreen />
            </RequireAccess>
          }
        />
        <Route
          path="maintenance/security/role-management"
          element={
            <RequireAccess position={Access.SecurityUsers}>
              <UserSecurityScreen mode="role" />
            </RequireAccess>
          }
        />
        <Route
          path="maintenance/security/user-permission"
          element={
            <RequireAccess position={Access.SecurityUsers}>
              <UserSecurityScreen mode="permission" />
            </RequireAccess>
          }
        />
        <Route
          path="maintenance/annual-limit"
          element={<Navigate to="/maintenance/plan?tab=annual-limit" replace />}
        />
        <Route
          path="maintenance/premium"
          element={<Navigate to="/maintenance/plan?tab=premium" replace />}
        />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  )
}
