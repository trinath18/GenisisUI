import { useAuth } from '../auth/access'

export function HomePage() {
  const { session } = useAuth()
  return (
    <section>
      <h2>Welcome, {session?.user.userName}</h2>
      <p>Choose a module from the bar on the left. Screens that are not migrated yet are greyed out.</p>
    </section>
  )
}

export function NotMigratedPage({
  title,
  message = 'This screen has not been migrated yet.',
}: {
  title: string
  message?: string
}) {
  return (
    <section>
      <h2>{title}</h2>
      <p className="muted">{message}</p>
    </section>
  )
}
