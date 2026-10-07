import { Link } from 'react-router-dom'
import { Access, useAuth } from '../auth/access'

export function HomePage() {
  const { session, hasAccess } = useAuth()
  return (
    <section>
      <h2>Welcome, {session?.user.userName}</h2>
      <p>Membership is the first module migrated from the MedixHIS desktop application.</p>
      {hasAccess(Access.MembershipEnquiry) && <Link to="/membership/enquiry">Open Membership Enquiry</Link>}
    </section>
  )
}

export function NotMigratedPage({ title }: { title: string }) {
  return (
    <section>
      <h2>{title}</h2>
      <p className="muted">This screen has not been migrated yet.</p>
    </section>
  )
}
