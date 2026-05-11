import { lazy, Suspense, useCallback, useRef } from 'react'
import { useRouterController } from '../controllers/routerController.js'
import { FullPageFallback } from './common.jsx'
import { ToastProvider } from './toast.jsx'
import { ThemeProvider } from './theme.jsx'
import { AuthProvider } from './auth.jsx'

const LandingView = lazy(() => import('./LandingView.jsx'))
const StudioView = lazy(() => import('./StudioView.jsx'))
const DashboardView = lazy(() => import('./DashboardView.jsx'))

// Prefetch helpers — loading on intent (hover/focus) feels instant on click.
const prefetchStudio = () => import('./StudioView.jsx')
const prefetchDashboard = () => import('./DashboardView.jsx')

function App() {
  const router = useRouterController()
  const prefetchedStudio = useRef(false)
  const prefetchedDashboard = useRef(false)

  const handleHoverStudio = useCallback(() => {
    if (prefetchedStudio.current) return
    prefetchedStudio.current = true
    prefetchStudio()
  }, [])

  const handleHoverDashboard = useCallback(() => {
    if (prefetchedDashboard.current) return
    prefetchedDashboard.current = true
    prefetchDashboard()
  }, [])

  return (
    <ThemeProvider>
      <ToastProvider>
        <AuthProvider>
          <Suspense fallback={<FullPageFallback />}>
            {router.route === 'studio' ? (
              <StudioView onBack={router.goLanding} />
            ) : router.isDashboard ? (
              <DashboardView
                onBack={router.goLanding}
                onGoStudio={router.goStudio}
                route={router.route}
                goDashboard={router.goDashboard}
                goDashboardDesigns={router.goDashboardDesigns}
              />
            ) : (
              <LandingView
                onStart={router.goStudio}
                onHoverStudio={handleHoverStudio}
                onGoDashboard={router.goDashboard}
                onHoverDashboard={handleHoverDashboard}
              />
            )}
          </Suspense>
        </AuthProvider>
      </ToastProvider>
    </ThemeProvider>
  )
}

export default App
