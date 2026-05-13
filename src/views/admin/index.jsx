import { memo, useCallback, useState } from 'react'
import { Menu, X } from 'lucide-react'
import { useAuth } from '../auth.jsx'
import { ForbiddenGate, Sidebar } from './shared.jsx'
import OverviewPage from './OverviewPage.jsx'
import UsersPage from './UsersPage.jsx'
import DesignsPage from './DesignsPage.jsx'
import AuditPage from './AuditPage.jsx'
import SettingsPage from './SettingsPage.jsx'

/**
 * Admin orchestrator.
 *
 * - Guards the whole area with a role check — non-admin users see a
 *   friendly "access required" page, not a 404.
 * - Sidebar is URL-driven via the top-level router (`route` prop).
 * - Each sub-page is a self-contained module that fetches its own data.
 */
function AdminView({
  onBack,
  onGoDashboard,
  route = 'admin',
  goAdmin,
  goAdminUsers,
  goAdminDesigns,
  goAdminAudit,
  goAdminSettings,
}) {
  const { isAuthed, status, user } = useAuth()
  const [drawerOpen, setDrawerOpen] = useState(false)

  const navigateToRoute = useCallback((key) => {
    setDrawerOpen(false)
    switch (key) {
      case 'admin-users':    return goAdminUsers?.()
      case 'admin-designs':  return goAdminDesigns?.()
      case 'admin-audit':    return goAdminAudit?.()
      case 'admin-settings': return goAdminSettings?.()
      default:               return goAdmin?.()
    }
  }, [goAdmin, goAdminUsers, goAdminDesigns, goAdminAudit, goAdminSettings])

  if (status === 'loading') return null
  if (!isAuthed || user?.role !== 'admin') {
    return <ForbiddenGate onGoHome={onBack} />
  }

  return (
    <div className="flex h-[100dvh] w-full overflow-hidden bg-slate-50 text-slate-950 dark:bg-slate-900 dark:text-slate-100">
      <div className="hidden lg:flex">
        <Sidebar
          route={route}
          setRoute={navigateToRoute}
          onGoHome={onBack}
          onGoDashboard={onGoDashboard}
          user={user}
        />
      </div>

      {drawerOpen && (
        <div className="fixed inset-0 z-50 lg:hidden" onClick={() => setDrawerOpen(false)}>
          <div className="absolute inset-0 bg-slate-950/50 backdrop-blur-sm animate-[fade-in_180ms_ease-out]" />
          <div
            className="absolute left-0 top-0 h-full animate-[drawer-in_240ms_cubic-bezier(0.21,1,0.32,1)]"
            onClick={(e) => e.stopPropagation()}
          >
            <Sidebar
              route={route}
              setRoute={navigateToRoute}
              onGoHome={() => { setDrawerOpen(false); onBack() }}
              onGoDashboard={() => { setDrawerOpen(false); onGoDashboard?.() }}
              user={user}
              onClose={() => setDrawerOpen(false)}
              inDrawer
            />
          </div>
        </div>
      )}

      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        {/* mobile header */}
        <header className="flex h-14 shrink-0 items-center gap-2 border-b border-slate-200 bg-white/90 px-3 backdrop-blur lg:hidden dark:border-slate-800 dark:bg-slate-950/90">
          <button
            type="button"
            onClick={() => setDrawerOpen(true)}
            className="grid h-9 w-9 place-items-center rounded-md text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
            aria-label="Buka menu"
          >
            <Menu size={16} />
          </button>
          <div className="min-w-0 flex-1">
            <p className="text-[10.5px] font-semibold uppercase tracking-[0.14em] text-rose-600 dark:text-rose-400">Admin</p>
            <p className="truncate text-[13.5px] font-semibold text-slate-900 dark:text-slate-100">
              {routeLabel(route)}
            </p>
          </div>
          <button
            type="button"
            onClick={onBack}
            className="grid h-9 w-9 place-items-center rounded-md text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
            aria-label="Tutup admin"
          >
            <X size={16} />
          </button>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto">
          <div className="mx-auto max-w-6xl px-4 pb-10 pt-5 md:px-6 md:pt-6 lg:px-8 lg:pt-8">
            {route === 'admin-users' && <UsersPage currentUserId={user?.id} />}
            {route === 'admin-designs' && <DesignsPage />}
            {route === 'admin-audit' && <AuditPage />}
            {route === 'admin-settings' && <SettingsPage />}
            {route === 'admin' && <OverviewPage />}
          </div>
        </div>
      </div>
    </div>
  )
}

function routeLabel(route) {
  switch (route) {
    case 'admin-users':    return 'Users'
    case 'admin-designs':  return 'Desain'
    case 'admin-audit':    return 'Audit log'
    case 'admin-settings': return 'Pengaturan'
    default:               return 'Overview'
  }
}

export default memo(AdminView)
