import { NavLink, Outlet } from "react-router-dom";
import { Access, useAuth } from "../auth/access";

const notMigrated = [
  "Case",
  "Invoice",
  "Worksheet",
  "Claims",
  "Claim Bordx",
  "Monitoring",
];

export function AppLayout() {
  const { session, logout, hasAccess } = useAuth();
  const item = (to: string, label: string, access: number) =>
    hasAccess(access) ? (
      <NavLink to={to}>{label}</NavLink>
    ) : (
      <span className="disabled" title="Access Denied!">
        {label}
      </span>
    );

  return (
    <div className="shell">
      <header className="topbar">
        <strong>Genisis</strong>
        <span className="muted">Genisis</span>
        <span className="spacer" />
        <span>
          {session?.user.userName} ({session?.user.userCode})
        </span>
        <button className="link" onClick={logout}>
          Log out
        </button>
      </header>
      <nav className="sidebar">
        <h4>Membership</h4>
        {item(
          "/membership/registration",
          "Registration",
          Access.MembershipRegistration,
        )}
        {item(
          "/membership/adjustment",
          "Adjustment",
          Access.MembershipAdjustment,
        )}
        {item("/membership/enquiry", "Enquiry", Access.MembershipEnquiry)}
        <h4>Maintenance</h4>
        {item("/maintenance/plan", "Plan", Access.PlanMaintenance)}
        {item(
          "/maintenance/annual-limit",
          "Annual Limit",
          Access.PlanMaintenance,
        )}
        {notMigrated.map((m) => (
          <h4 key={m} className="disabled" title="Not migrated yet">
            {m}
          </h4>
        ))}
      </nav>
      <main className="content">
        <Outlet />
      </main>
    </div>
  );
}
