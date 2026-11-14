import { useEffect, useState } from 'react'
import { NavLink, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from '../auth/access'
import { ThemeSwitcher } from '../theme/ThemeSwitcher'
import { Icon } from './icons'
import { ErrorBoundary } from './ErrorBoundary'
import { NotifyHost } from './notify'
import { containsRoute, menuSections, visibleMenu } from './menu'
import type { MenuNode } from './menu'

const storageKey = 'genisis.menu'
interface MenuState {
  /** Groups the user opened or closed, by path; the others follow the page shown. */
  open: Record<string, boolean>
  /** The menu panel is hidden (the hamburger in the top bar). */
  hidden: boolean
}

function loadMenuState(): MenuState {
  try {
    return { open: {}, hidden: false, ...(JSON.parse(localStorage.getItem(storageKey) ?? '{}') as Partial<MenuState>) }
  } catch {
    return { open: {}, hidden: false }
  }
}

/** The application frame, laid out like Genesis FIS: the coloured top bar, the menu of the desktop's top menus down the left, and the page. */
export function AppLayout() {
  const { session, logout, hasAccess } = useAuth()
  const { pathname } = useLocation()
  const [state, setState] = useState(loadMenuState)
  const [narrow, setNarrow] = useState(() => window.matchMedia?.('(max-width: 900px)').matches === true)
  // On a narrow screen the menu lies over the page: it is open for the page it was opened on, so choosing a page closes it.
  const [drawerFor, setDrawerFor] = useState<string | null>(null)
  const drawerOpen = drawerFor === pathname
  const setDrawerOpen = (open: boolean) => setDrawerFor(open ? pathname : null)
  const tree = visibleMenu(menuSections, hasAccess)

  const save = (next: MenuState) => {
    setState(next)
    try {
      localStorage.setItem(storageKey, JSON.stringify(next))
    } catch {
      // storage unavailable: keep the menu as it is for this page
    }
  }

  useEffect(() => {
    const query = window.matchMedia?.('(max-width: 900px)')
    if (!query) return
    const onChange = (e: MediaQueryListEvent) => setNarrow(e.matches)
    query.addEventListener('change', onChange)
    return () => query.removeEventListener('change', onChange)
  }, [])

  const menuShown = narrow ? drawerOpen : !state.hidden
  const toggleMenu = () => (narrow ? setDrawerOpen(!drawerOpen) : save({ ...state, hidden: !state.hidden }))

  const render = (node: MenuNode, path: string, depth: number) => {
    if (node.kind === 'link') {
      return (
        <NavLink key={path} to={node.to} end className={`menu-link depth-${depth}`}>
          {node.label}
        </NavLink>
      )
    }
    const isOpen = state.open[path] ?? containsRoute(node, pathname)
    return (
      <div key={path} className={`menu-group depth-${depth}`}>
        <button type="button" className="menu-group-head" aria-expanded={isOpen} onClick={() => save({ ...state, open: { ...state.open, [path]: !isOpen } })}>
          <span>{node.label}</span>
          <Icon name={isOpen ? 'chevUp' : 'chevDown'} size={16} />
        </button>
        {isOpen && <div className="menu-children">{node.children.map((c) => render(c, `${path}/${c.label}`, depth + 1))}</div>}
      </div>
    )
  }

  return (
    <div className={`shell${menuShown ? '' : ' menu-hidden'}${narrow ? ' narrow' : ''}`}>
      <header className="appbar">
        <button
          type="button"
          className="icon-button"
          onClick={toggleMenu}
          aria-label={menuShown ? 'Hide menu' : 'Show menu'}
          title={menuShown ? 'Hide menu' : 'Show menu'}
          aria-expanded={menuShown}
          aria-controls="app-menu"
        >
          <Icon name="menu" />
        </button>
        <span className="appbar-title">Genisis</span>
        <span className="appbar-subtitle">TPA Management system</span>
        <span className="spacer" />
        <ThemeSwitcher />
        <span className="appbar-user">{session?.user.userName}</span>
        <button type="button" className="appbar-logout" onClick={logout}>
          Logout
        </button>
      </header>
      {narrow && drawerOpen && <div className="menu-scrim" onClick={() => setDrawerOpen(false)} aria-hidden="true" />}
      <nav id="app-menu" className="app-menu" aria-label="Main menu" hidden={!menuShown}>
        <NavLink to="/" end className="menu-link depth-0 menu-home">
          Home
        </NavLink>
        {tree.map((n) => render(n, n.label, 0))}
      </nav>
      <main className="content">
        <ErrorBoundary resetKey={pathname}>
          <Outlet />
        </ErrorBoundary>
      </main>
      <NotifyHost />
    </div>
  )
}
