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
import { CaseEnquiryPage } from './pages/case/CaseEnquiryPage'
import { CaseRegistrationPage } from './pages/case/CaseRegistrationPage'
import { CaseAdjustmentPage } from './pages/case/CaseAdjustmentPage'
import { CaseTrackingPage } from './pages/case/CaseTrackingPage'
import { CaseListingPage } from './pages/case/CaseListingPage'
import { CaseTransferPage } from './pages/case/CaseTransferPage'
import { PanelHospitalsPage } from './pages/case/PanelHospitalsPage'
import { CaseAuditReviewPage } from './pages/case/CaseAuditReviewPage'
import { MmaCptPage } from './pages/case/MmaCptPage'
import { CasePayClaimPage } from './pages/case/CasePayClaimPage'
import { CaseNonDisclosurePage } from './pages/case/CaseNonDisclosurePage'
import { CaseAsciiPage, ClaimAsciiPage } from './pages/case/AsciiExportPages'

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
          path="membership/tracking"
          element={
            <RequireAccess position={Access.MembershipTracking}>
              <TrackingPage />
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
