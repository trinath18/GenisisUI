import { Fragment, useState, type MouseEvent } from 'react'
import { NavLink, Outlet, useLocation } from 'react-router-dom'
import { Access, useAuth } from '../auth/access'
import { Icon, type IconName } from './icons'
import { ErrorBoundary } from './ErrorBoundary'
import { NotifyHost } from './notify'

const rail: { icon: IconName; label: string; prefix?: string; to?: string; access?: number }[] = [
  { icon: 'home', label: 'Home', to: '/', prefix: '/' },
  { icon: 'users', label: 'Membership', to: '/membership/enquiry', prefix: '/membership', access: Access.MembershipEnquiry },
  { icon: 'folder', label: 'Case', to: '/case/registration', prefix: '/case', access: Access.CaseRegistration },
  { icon: 'tool', label: 'Maintenance', to: '/maintenance/plan', prefix: '/maintenance', access: Access.PlanMaintenance },
  { icon: 'file', label: 'Invoice' },
  { icon: 'grid', label: 'Worksheet' },
  { icon: 'shield', label: 'Claims' },
  { icon: 'list', label: 'Claim Bordx' },
  { icon: 'activity', label: 'Monitoring' },
]

const sections: { label: string; prefix: string; items: { to: string; label: string; access: number; group?: string }[] }[] = [
  {
    label: 'Membership',
    prefix: '/membership',
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
    label: 'Case',
    prefix: '/case',
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
    label: 'Maintenance',
    prefix: '/maintenance',
    items: [
      { to: '/maintenance/plan', label: 'Plan Maintenance', access: Access.PlanMaintenance },
      { to: '/maintenance/benefits', label: 'Benefits Maintenance', access: Access.BenefitsMaintenance },
      { to: '/maintenance/entity', label: 'Entity Maintenance', access: Access.EntityMaintenance },
      { to: '/maintenance/accounts', label: 'Accounts', access: Access.AccountsMaintenance },
      { to: '/maintenance/account-transaction', label: 'Account Transaction', access: Access.AccountTransaction },
      { to: '/maintenance/mma', label: 'MMA (Procedures/OPCS)', access: Access.MmaEntry },
      { to: '/maintenance/security/department', label: 'Department', access: Access.SecurityDepartment, group: 'Security' },
      { to: '/maintenance/security/role-management', label: 'Role Management', access: Access.SecurityUsers, group: 'Security' },
      { to: '/maintenance/security/user-permission', label: 'User Permission', access: Access.SecurityUsers, group: 'Security' },
    ],
  },
]

export function AppLayout() {
  const { session, logout, hasAccess } = useAuth()
  const { pathname } = useLocation()
  const [open, setOpen] = useState(() => localStorage.getItem('nav-collapsed') !== '1')
  const [hoverSection, setHoverSection] = useState<string | null>(null)
  const routeSection = sections.find((s) => pathname.startsWith(s.prefix))
  const section = (hoverSection && sections.find((s) => s.prefix === hoverSection)) ?? routeSection

  function toggleNav() {
    setOpen((o) => {
      localStorage.setItem('nav-collapsed', o ? '1' : '0')
      return !o
    })
  }

  /** Hide when the pointer leaves the rail + sidebar (but not when moving between them). */
  function navLeave(e: MouseEvent) {
    if (!(e.relatedTarget instanceof Element && e.relatedTarget.closest('.rail, .sidebar'))) {
      setOpen(false)
      setHoverSection(null)
    }
  }

  const item = (to: string, label: string, access: number) =>
    hasAccess(access) ? (
      <NavLink to={to}>{label}</NavLink>
    ) : (
      <span className="disabled" title="Access Denied!">
        {label}
      </span>
    )

  return (
    <div className={`shell${section ? '' : ' no-sidebar'}${!open && section ? ' nav-collapsed' : ''}`}>
      <header className="topbar">
        <button
          type="button"
          className="nav-toggle"
          onClick={toggleNav}
          title={open ? 'Hide sidebar' : 'Show sidebar'}
          aria-label={open ? 'Hide sidebar' : 'Show sidebar'}
          aria-expanded={open}
        >
          <Icon name={open ? 'chevLeft' : 'chevRight'} />
        </button>
        <span className="brand-mark">
          <Icon name="cross" size={14} />
        </span>
        <strong>Genisis</strong>
        <span className="muted">TPA Management system</span>
        <span className="spacer" />
        <span>
          {session?.user.userName} ({session?.user.userCode})
        </span>
        <button className="link" onClick={logout}>
          Log out
        </button>
      </header>
      <nav className="rail" aria-label="Modules" onMouseEnter={() => setOpen(true)} onMouseLeave={navLeave}>
        {rail.map((r) =>
          r.to && (r.access === undefined || hasAccess(r.access)) ? (
            <NavLink
              key={r.label}
              to={r.to}
              end={r.prefix === '/'}
              title={r.label}
              aria-label={r.label}
              className={r.prefix === '/' ? (pathname === '/' ? 'active' : '') : r.prefix && pathname.startsWith(r.prefix) ? 'active' : ''}
              onMouseEnter={() => r.prefix && r.prefix !== '/' && setHoverSection(r.prefix)}
            >
              <Icon name={r.icon} />
            </NavLink>
          ) : (
            <span
              key={r.label}
              className="disabled"
              title={r.to ? 'Access Denied!' : `${r.label} — not migrated yet`}
              aria-label={r.label}
              onMouseEnter={() => r.prefix && r.prefix !== '/' && setHoverSection(r.prefix)}
            >
              <Icon name={r.icon} />
            </span>
          ),
        )}
      </nav>
      {section && (
        <nav className="sidebar" aria-label="Pages" onMouseEnter={() => setOpen(true)} onMouseLeave={navLeave}>
          <h4>{section.label}</h4>
          {section.items.map((i, n) => (
            <Fragment key={i.to}>
              {i.group && i.group !== section.items[n - 1]?.group && <h5 className="nav-group">{i.group}</h5>}
              {item(i.to, i.label, i.access)}
            </Fragment>
          ))}
        </nav>
      )}
      <main className="content">
        <ErrorBoundary resetKey={pathname}>
          <Outlet />
        </ErrorBoundary>
      </main>
      <NotifyHost />
    </div>
  )
}
