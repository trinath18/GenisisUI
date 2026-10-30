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
  { icon: 'wallet', label: 'Finance', to: '/finance/sun-posting', prefix: '/finance', access: Access.FinanceSunPosting },
  { icon: 'file', label: 'Invoice', to: '/invoice/processing', prefix: '/invoice', access: Access.InvoiceProcessing },
  { icon: 'grid', label: 'Worksheet', to: '/worksheet/tracking', prefix: '/worksheet', access: Access.WorksheetTracking },
  { icon: 'shield', label: 'Claims', prefix: '#claims' },
  { icon: 'list', label: 'Claim Bordx', to: '/claim-bordx/insert-worksheet', prefix: '/claim-bordx', access: Access.ClaimBordx },
  { icon: 'calendar', label: 'Receipt', to: '/receipt/tracking', prefix: '/receipt', access: Access.ReceiptTracking },
  { icon: 'activity', label: 'Monitoring', prefix: '#monitoring' },
]

const sections: { label: string; prefix: string; note?: string; items: { to: string; label: string; access: number; group?: string; pending?: boolean }[] }[] =
  [
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
        { to: '/maintenance/member', label: 'Member', access: Access.MemberMaintenance },
        { to: '/maintenance/suspension', label: 'Suspension', access: Access.Suspension },
        { to: '/maintenance/mma', label: 'MMA (Procedures/OPCS)', access: Access.MmaEntry },
        { to: '/maintenance/security/department', label: 'Department', access: Access.SecurityDepartment, group: 'Security' },
        { to: '/maintenance/security/role-management', label: 'Role Management', access: Access.SecurityUsers, group: 'Security' },
        { to: '/maintenance/security/user-permission', label: 'User Permission', access: Access.SecurityUsers, group: 'Security' },
      ],
    },
    {
      label: 'Invoice',
      prefix: '/invoice',
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
      prefix: '/worksheet',
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
      // Authorize Claims of the desktop menu: nothing is migrated yet, so its entries are shown disabled.
      label: 'Claims',
      prefix: '#claims',
      items: [
        { to: '#', label: 'Claim Report', access: 0, group: 'DCU Tracking', pending: true },
        { to: '#', label: 'Claim Pass to A/C', access: 0, pending: true },
      ],
    },
    {
      // Desktop order of the Receipt menu; the receipt entry forms still to migrate are shown disabled ("Payor (Manual)" is not marked Required).
      label: 'Receipt',
      prefix: '/receipt',
      items: [
        { to: '#', label: 'From Member', access: Access.ReceiptTracking, pending: true },
        { to: '#', label: 'Others', access: Access.ReceiptTracking, pending: true },
        { to: '#', label: 'Payor', access: Access.ReceiptTracking, pending: true },
        { to: '/receipt/tracking', label: 'Receipt Tracking', access: Access.ReceiptTracking },
      ],
    },
    {
      label: 'Monitoring',
      prefix: '#monitoring',
      note: 'Not migrated yet.',
      items: [],
    },
    {
      // Desktop order of the Claim Bordx menu; items still to migrate are shown disabled. Insert Worksheet is the form Case > Inpatient Case Listing opens (FrmWksBordx).
      label: 'Claim Bordx',
      prefix: '/claim-bordx',
      items: [
        { to: '/claim-bordx/insert-worksheet', label: 'Insert Worksheet', access: Access.ClaimBordx, group: 'Worksheet' },
        { to: '/claim-bordx/remove-worksheet', label: 'Remove Worksheet', access: Access.ClaimBordx, group: 'Worksheet' },
        { to: '#', label: 'Print Bordx', access: Access.ClaimBordx, pending: true },
        { to: '/claim-bordx/print-recovery', label: 'Print Recovery', access: Access.ClaimBordx },
        { to: '#', label: 'Generate Bordx No', access: Access.ClaimBordx, group: 'Payment Advice', pending: true },
        { to: '#', label: 'Hospital Report', access: Access.ClaimBordx, group: 'Payment Advice', pending: true },
        { to: '#', label: 'Update Bordx', access: Access.ClaimBordx, pending: true },
        { to: '#', label: 'Bordx Send Date', access: Access.ClaimBordx, group: 'Bor Delivery', pending: true },
        { to: '/claim-bordx/send-to-payor', label: 'Send to Payor', access: Access.ClaimBordx, group: 'Bor Delivery' },
        { to: '/claim-bordx/returned-from-payor', label: 'Returned From Payor', access: Access.ClaimBordx, group: 'Bor Delivery' },
        { to: '/claim-bordx/returned-not-approved', label: 'Returned Fr Payor (Not App)', access: Access.ClaimBordx, group: 'Bor Delivery' },
        { to: '/claim-bordx/send-to-accounts', label: 'Send to A/C', access: Access.ClaimBordx, group: 'Bor Delivery' },
        { to: '/claim-bordx/bordx-control', label: 'Bordx Control', access: Access.ClaimBordx, group: 'Monitoring' },
        { to: '/claim-bordx/outstanding-bordx', label: 'Outstanding Bordx', access: Access.ClaimBordx, group: 'Monitoring' },
        { to: '/claim-bordx/approval', label: 'Bordx Approval', access: Access.ClaimBordx },
        { to: '#', label: 'Claim files', access: Access.ClaimBordx, group: 'Storage', pending: true },
        { to: '/claim-bordx/storage-enquiry', label: 'Storage Enquiry', access: Access.ClaimBordx, group: 'Storage' },
        { to: '/claim-bordx/storage-document', label: 'Document', access: Access.ClaimBordx, group: 'Storage' },
      ],
    },
    {
      // Desktop order of the Finance menu; items still to migrate are shown disabled.
      label: 'Finance',
      prefix: '/finance',
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
  ]

export function AppLayout() {
  const { session, logout, hasAccess } = useAuth()
  const { pathname } = useLocation()
  const [open, setOpen] = useState(() => localStorage.getItem('nav-collapsed') !== '1')
  const [hoverSection, setHoverSection] = useState<string | null>(null)
  const routeSection = sections.find((s) => pathname.startsWith(s.prefix))
  const section = hoverSection === null ? routeSection : sections.find((s) => s.prefix === hoverSection)

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

  const item = (to: string, label: string, access: number, pending?: boolean) =>
    pending ? (
      <span className="disabled" title={`${label} — not migrated yet`}>
        {label}
      </span>
    ) : hasAccess(access) ? (
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
              onMouseEnter={() => setHoverSection(r.prefix ?? null)}
            >
              <Icon name={r.icon} />
            </NavLink>
          ) : (
            <span
              key={r.label}
              className="disabled"
              title={r.to ? 'Access Denied!' : `${r.label} — not migrated yet`}
              aria-label={r.label}
              onMouseEnter={() => setHoverSection(r.prefix ?? null)}
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
            <Fragment key={`${section.prefix}|${i.group ?? ''}|${i.label}`}>
              {i.group && i.group !== section.items[n - 1]?.group && <h5 className="nav-group">{i.group}</h5>}
              {item(i.to, i.label, i.access, i.pending)}
            </Fragment>
          ))}
          {section.note && <p className="muted nav-note">{section.note}</p>}
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
