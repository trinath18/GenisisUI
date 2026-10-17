import { Navigate, Route, Routes } from 'react-router-dom'
import type { ReactNode } from 'react'
import { Access, useAuth } from './auth/access'
import { AppLayout } from './components/AppLayout'
import { HomePage, NotMigratedPage } from './pages/HomePage'
import { LoginPage } from './pages/LoginPage'
import { PlanMaintenanceScreen } from './pages/maintenance/PlanMaintenanceScreen'
import { BenefitsMaintenanceScreen } from './features/maintenance/benefits/pages/BenefitsMaintenanceScreen'
import { EntityMaintenanceScreen } from './features/maintenance/entity/pages/EntityMaintenanceScreen'
import { AccountsScreen } from './features/maintenance/accounts/pages/AccountsScreen'
import { CaseEnquiryPage } from './pages/case/CaseEnquiryPage'
import { CaseRegistrationPage } from './pages/case/CaseRegistrationPage'
import { CaseAdjustmentPage } from './pages/case/CaseAdjustmentPage'
import { CaseTrackingPage } from './pages/case/CaseTrackingPage'

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
