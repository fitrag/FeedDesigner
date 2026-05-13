import { useCallback, useEffect, useMemo, useState } from 'react'

/**
 * Minimal client-side router. Route keys are strings; `ROUTES` maps them to
 * URL paths. Dashboard has sub-pages exposed as separate route keys so the
 * URL reflects current sub-page and browser back/forward work naturally.
 */
const ROUTES = {
  landing: '/',
  studio: '/studio',
  dashboard: '/dashboard',
  'dashboard-designs': '/dashboard/designs',
  admin: '/admin',
  'admin-users': '/admin/users',
  'admin-designs': '/admin/designs',
  'admin-audit': '/admin/audit',
  'admin-settings': '/admin/settings',
}

function getRouteFromLocation() {
  if (typeof window === 'undefined') return 'landing'
  const path = window.location.pathname
  if (path === ROUTES.studio) return 'studio'
  if (path === ROUTES['dashboard-designs']) return 'dashboard-designs'
  if (path === ROUTES.dashboard || path.startsWith(`${ROUTES.dashboard}/`)) return 'dashboard'
  if (path === ROUTES['admin-users']) return 'admin-users'
  if (path === ROUTES['admin-designs']) return 'admin-designs'
  if (path === ROUTES['admin-audit']) return 'admin-audit'
  if (path === ROUTES['admin-settings']) return 'admin-settings'
  if (path === ROUTES.admin || path.startsWith(`${ROUTES.admin}/`)) return 'admin'
  return 'landing'
}

export function useRouterController() {
  const [route, setRoute] = useState(getRouteFromLocation)

  useEffect(() => {
    const handlePopState = () => setRoute(getRouteFromLocation())
    window.addEventListener('popstate', handlePopState)
    return () => window.removeEventListener('popstate', handlePopState)
  }, [])

  const navigate = useCallback((nextRoute) => {
    const path = ROUTES[nextRoute] || ROUTES.landing
    if (window.location.pathname !== path) {
      window.history.pushState({}, '', path)
    }
    setRoute(nextRoute)
    // Instant scroll — smooth scrolling adds perceived latency on nav.
    window.scrollTo(0, 0)
  }, [])

  const goLanding = useCallback(() => navigate('landing'), [navigate])
  const goStudio = useCallback(() => navigate('studio'), [navigate])
  const goDashboard = useCallback(() => navigate('dashboard'), [navigate])
  const goDashboardDesigns = useCallback(() => navigate('dashboard-designs'), [navigate])
  const goAdmin = useCallback(() => navigate('admin'), [navigate])
  const goAdminUsers = useCallback(() => navigate('admin-users'), [navigate])
  const goAdminDesigns = useCallback(() => navigate('admin-designs'), [navigate])
  const goAdminAudit = useCallback(() => navigate('admin-audit'), [navigate])
  const goAdminSettings = useCallback(() => navigate('admin-settings'), [navigate])

  const isDashboard = useMemo(
    () => route === 'dashboard' || route === 'dashboard-designs',
    [route],
  )

  const isAdmin = useMemo(
    () => route === 'admin'
      || route === 'admin-users'
      || route === 'admin-designs'
      || route === 'admin-audit'
      || route === 'admin-settings',
    [route],
  )

  return {
    route,
    isDashboard,
    isAdmin,
    goLanding,
    goStudio,
    goDashboard,
    goDashboardDesigns,
    goAdmin,
    goAdminUsers,
    goAdminDesigns,
    goAdminAudit,
    goAdminSettings,
  }
}
