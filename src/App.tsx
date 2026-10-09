import { Navigate, Route, Routes } from 'react-router-dom'
import type { ReactNode } from 'react'
import { Access, useAuth } from './auth/access'
import { AppLayout } from './components/AppLayout'
import { HomePage, NotMigratedPage } from './pages/HomePage'
import { LoginPage } from './pages/LoginPage'
import { EnquiryPage } from './pages/membership/EnquiryPage'
import { RegistrationPage } from './pages/membership/RegistrationPage'
import { PlanMaintenancePage } from './pages/maintenance/PlanMaintenancePage'
import { AnnualLimitPage } from './pages/maintenance/AnnualLimitPage'
import { PremiumPage } from './pages/maintenance/PremiumPage'

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
              <NotMigratedPage title="Membership Adjustment" />
            </RequireAccess>
          }
        />
        <Route
          path="maintenance/plan"
          element={
            <RequireAccess position={Access.PlanMaintenance}>
              <PlanMaintenancePage />
            </RequireAccess>
          }
        />
        <Route
          path="maintenance/annual-limit"
          element={
            <RequireAccess position={Access.PlanMaintenance}>
              <AnnualLimitPage />
            </RequireAccess>
          }
        />
        <Route
          path="maintenance/premium"
          element={
            <RequireAccess position={Access.PlanMaintenance}>
              <PremiumPage />
            </RequireAccess>
          }
        />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  )
}
