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
}

function getRouteFromLocation() {
  if (typeof window === 'undefined') return 'landing'
  const path = window.location.pathname
  if (path === ROUTES.studio) return 'studio'
  if (path === ROUTES['dashboard-designs']) return 'dashboard-designs'
  if (path === ROUTES.dashboard || path.startsWith(`${ROUTES.dashboard}/`)) return 'dashboard'
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
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }, [])

  const goLanding = useCallback(() => navigate('landing'), [navigate])
  const goStudio = useCallback(() => navigate('studio'), [navigate])
  const goDashboard = useCallback(() => navigate('dashboard'), [navigate])
  const goDashboardDesigns = useCallback(() => navigate('dashboard-designs'), [navigate])

  // True whenever any dashboard page is active — useful for AppView routing.
  const isDashboard = useMemo(
    () => route === 'dashboard' || route === 'dashboard-designs',
    [route],
  )

  return {
    route,
    isDashboard,
    goLanding,
    goStudio,
    goDashboard,
    goDashboardDesigns,
  }
}
