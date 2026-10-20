import { useState } from 'react'
import { NavLink, Outlet, useLocation } from 'react-router-dom'
import { Access, useAuth } from '../auth/access'
import { Icon, type IconName } from './icons'
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

const sections: { label: string; prefix: string; items: { to: string; label: string; access: number }[] }[] = [
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
    ],
  },
  {
    label: 'Case',
    prefix: '/case',
    items: [
      { to: '/case/registration', label: 'Registration', access: Access.CaseRegistration },
      { to: '/case/adjustment', label: 'Adjustment', access: Access.CaseAdjustment },
      { to: '/case/enquiry', label: 'Enquiry', access: Access.CaseEnquiry },
      { to: '/case/tracking', label: 'Tracking', access: Access.CaseTracking },
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
    ],
  },
]

export function AppLayout() {
  const { session, logout, hasAccess } = useAuth()
  const { pathname } = useLocation()
  const [collapsed, setCollapsed] = useState(() => localStorage.getItem('nav-collapsed') === '1')
  const section = sections.find((s) => pathname.startsWith(s.prefix))

  function toggleNav() {
    setCollapsed((c) => {
      localStorage.setItem('nav-collapsed', c ? '0' : '1')
      return !c
    })
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
    <div className={`shell${section ? '' : ' no-sidebar'}${collapsed && section ? ' nav-collapsed' : ''}`}>
      <header className="topbar">
        <span className="brand-mark">
          <Icon name="cross" size={14} />
        </span>
        <strong>Genisis</strong>
        <span className="muted">Healthcare Information System</span>
        <span className="spacer" />
        <span>
          {session?.user.userName} ({session?.user.userCode})
        </span>
        <button className="link" onClick={logout}>
          Log out
        </button>
      </header>
      <nav className="rail" aria-label="Modules">
        {rail.map((r) =>
          r.to && (r.access === undefined || hasAccess(r.access)) ? (
            <NavLink
              key={r.label}
              to={r.to}
              end={r.prefix === '/'}
              title={r.label}
              aria-label={r.label}
              className={r.prefix === '/' ? (pathname === '/' ? 'active' : '') : r.prefix && pathname.startsWith(r.prefix) ? 'active' : ''}
            >
              <Icon name={r.icon} />
            </NavLink>
          ) : (
            <span key={r.label} className="disabled" title={r.to ? 'Access Denied!' : `${r.label} — not migrated yet`} aria-label={r.label}>
              <Icon name={r.icon} />
            </span>
          ),
        )}
        <button
          type="button"
          className="rail-toggle"
          onClick={toggleNav}
          title={collapsed ? 'Show sidebar' : 'Hide sidebar'}
          aria-label={collapsed ? 'Show sidebar' : 'Hide sidebar'}
          aria-expanded={!collapsed}
        >
          <Icon name={collapsed ? 'chevRight' : 'chevLeft'} />
        </button>
      </nav>
      {section && (
        <nav className="sidebar" aria-label="Pages">
          <h4>{section.label}</h4>
          {section.items.map((i) => item(i.to, i.label, i.access))}
        </nav>
      )}
      <main className="content">
        <Outlet />
      </main>
      <NotifyHost />
    </div>
  )
}
