import { lazy, memo, Suspense, useCallback, useEffect, useMemo, useState } from 'react'
import { ChevronLeft, LogIn } from 'lucide-react'
import { Brand } from '../common.jsx'
import { ThemeToggle } from '../theme.jsx'
import { authedFetch, UserMenu, useAuth } from '../auth.jsx'
import { useToast } from '../toast.jsx'
import { Sidebar } from './shared.jsx'
import { useIsMobile } from '../studio/hooks.js'
import DashboardPage from './DashboardPage.jsx'
import DesignsPage from './DesignsPage.jsx'
import MobileShell, { MobileAccountPage } from './MobileShell.jsx'

const GenerationDetailModal = lazy(() => import('./DetailModal.jsx'))

/**
 * Dashboard orchestrator.
 *
 * - Mobile viewports render the native-feel MobileShell with sticky header,
 *   bottom tab nav, and pull-to-refresh.
 * - Desktop viewports keep the left Sidebar + wide content layout.
 *
 * Data loading, nav state, filters, and the detail modal all live here so
 * switching between desktop/mobile layouts during a session (e.g. window
 * resize) doesn't lose state or re-fetch.
 */
function DashboardView({
  onBack,
  onGoStudio,
  route = 'dashboard',
  goDashboard,
  goDashboardDesigns,
}) {
  const { isAuthed, status, openLogin, user } = useAuth()
  const toast = useToast()
  const isMobile = useIsMobile()

  const [items, setItems] = useState(null)
  const [stats, setStats] = useState(null)
  const [query, setQuery] = useState('')
  const [mode, setMode] = useState('all')
  const [layout, setLayout] = useState('grid')
  const [openId, setOpenId] = useState(null)
  const [mobileTab, setMobileTab] = useState('dashboard') // dashboard | designs | account

  // URL-derived page (desktop only tracks two sub-pages). Mobile uses its
  // own `mobileTab` state because it has a dedicated Account tab.
  const urlPage = route === 'dashboard-designs' ? 'designs' : 'dashboard'
  const page = isMobile ? mobileTab : urlPage

  const loadAll = useCallback(async () => {
    if (!isAuthed) { setItems([]); setStats(null); return }
    try {
      const [gRes, sRes] = await Promise.all([
        authedFetch('/api/generations?limit=200'),
        authedFetch('/api/stats'),
      ])
      const gData = gRes.ok ? await gRes.json() : { items: [] }
      const sData = sRes.ok ? await sRes.json() : null
      setItems(Array.isArray(gData.items) ? gData.items : [])
      setStats(sData)
    } catch { setItems([]) }
  }, [isAuthed])

  useEffect(() => { loadAll() }, [loadAll, page])

  // Sync mobile tab with URL on init + when URL changes (browser back/forward).
  useEffect(() => {
    if (urlPage === 'designs') setMobileTab('designs')
    else setMobileTab((prev) => (prev === 'account' ? 'account' : 'dashboard'))
  }, [urlPage])

  const navigateToPage = useCallback((next) => {
    loadAll()
    if (isMobile) {
      setMobileTab(next)
      // Keep URL aligned with content so refresh lands on the right view,
      // except for the mobile-only "account" tab which doesn't have a URL.
      if (next === 'designs') goDashboardDesigns?.()
      else if (next === 'dashboard') goDashboard?.()
    } else {
      if (next === 'designs') goDashboardDesigns?.()
      else goDashboard?.()
    }
  }, [goDashboard, goDashboardDesigns, loadAll, isMobile])

  const handleDelete = useCallback(async (id) => {
    if (!confirm('Hapus generation ini dan semua slide-nya?')) return
    try {
      const res = await authedFetch(`/api/generations/${id}`, { method: 'DELETE' })
      if (res.ok) {
        toast.success('Generation dihapus')
        setItems((xs) => (xs || []).filter((x) => x.id !== id))
        loadAll()
      } else { toast.error('Gagal menghapus') }
    } catch { toast.error('Gagal menghapus') }
  }, [toast, loadAll])

  const handleDeletedFromModal = useCallback((id) => {
    setItems((xs) => (xs || []).filter((x) => x.id !== id))
    loadAll()
  }, [loadAll])

  const handleEditInStudio = useCallback((gen) => {
    try { sessionStorage.setItem('feeddesigner:load-generation', gen.id) } catch { /* ignore */ }
    setOpenId(null)
    onGoStudio()
  }, [onGoStudio])

  const counts = useMemo(() => {
    const arr = items || []
    return {
      all: arr.length,
      carousel: arr.filter((x) => x.mode === 'carousel').length,
      single: arr.filter((x) => x.mode === 'single').length,
    }
  }, [items])

  const filtered = useMemo(() => {
    if (!Array.isArray(items)) return []
    const q = query.trim().toLowerCase()
    return items.filter((it) => {
      if (mode !== 'all' && it.mode !== mode) return false
      if (!q) return true
      return (
        (it.topic || '').toLowerCase().includes(q) ||
        (it.brandName || '').toLowerCase().includes(q)
      )
    })
  }, [items, query, mode])

  const hasFilter = Boolean(query.trim() || mode !== 'all')
  const clearFilter = () => { setQuery(''); setMode('all') }

  /* ---------- unauthenticated gate ---------- */
  if (status !== 'loading' && !isAuthed) {
    return (
      <div className="min-h-[100dvh] bg-white text-slate-950 dark:bg-slate-950 dark:text-slate-100">
        <header className="sticky top-0 z-20 flex h-14 items-center justify-between border-b border-slate-200 bg-white/80 px-4 backdrop-blur lg:px-8 dark:border-slate-800 dark:bg-slate-950/80">
          <div className="flex items-center gap-3">
            <button onClick={onBack} className="flex items-center gap-1 rounded-md px-2 py-1 text-[12px] font-medium text-slate-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800">
              <ChevronLeft size={13} /> Home
            </button>
            <div className="h-4 w-px bg-slate-200 dark:bg-slate-700" />
            <Brand />
          </div>
          <div className="flex items-center gap-2">
            <ThemeToggle size="sm" />
            <UserMenu compact />
          </div>
        </header>
        <div className="mx-auto max-w-md px-5 py-24 text-center">
          <div className="mx-auto mb-4 grid h-14 w-14 place-items-center rounded-2xl bg-gradient-to-br from-slate-100 to-white shadow-sm dark:from-slate-800 dark:to-slate-900">
            <LogIn size={20} className="text-slate-600 dark:text-slate-400" />
          </div>
          <h1 className="text-[24px] font-semibold tracking-tight">Masuk untuk lihat dashboard</h1>
          <p className="mx-auto mt-2 max-w-sm text-[13.5px] leading-6 text-slate-500 dark:text-slate-400">
            Dashboard menampilkan semua desain yang pernah kamu generate — terasosiasi dengan akun kamu.
          </p>
          <button
            type="button"
            onClick={openLogin}
            className="mt-6 inline-flex items-center gap-1.5 rounded-md bg-slate-950 px-5 py-2.5 text-[13px] font-semibold text-white transition hover:bg-slate-800 dark:bg-white dark:text-slate-950 dark:hover:bg-slate-200"
          >
            Masuk sekarang
          </button>
        </div>
      </div>
    )
  }

  const loading = items === null
  const onOpenItem = (x) => setOpenId(x.id)

  const modalNode = openId ? (
    <Suspense fallback={null}>
      <GenerationDetailModal
        id={openId}
        onClose={() => setOpenId(null)}
        onDeleted={handleDeletedFromModal}
        onEdit={handleEditInStudio}
      />
    </Suspense>
  ) : null

  /* ---------- mobile shell ---------- */
  if (isMobile) {
    return (
      <>
        <MobileShell
          page={mobileTab}
          setPage={navigateToPage}
          onBack={onBack}
          onGoStudio={onGoStudio}
          items={items}
          filtered={filtered}
          counts={counts}
          loading={loading}
          loadAll={loadAll}
        >
          {mobileTab === 'dashboard' && (
            <DashboardPage
              variant="mobile"
              user={user}
              stats={stats}
              items={items}
              loading={loading}
              onGoStudio={onGoStudio}
              onOpen={onOpenItem}
              onDelete={handleDelete}
              onSeeAll={() => navigateToPage('designs')}
            />
          )}
          {mobileTab === 'designs' && (
            <DesignsPage
              variant="mobile"
              items={items}
              filtered={filtered}
              loading={loading}
              query={query}
              setQuery={setQuery}
              mode={mode}
              setMode={setMode}
              counts={counts}
              layout={layout}
              setLayout={setLayout}
              hasFilter={hasFilter}
              clearFilter={clearFilter}
              onOpen={onOpenItem}
              onDelete={handleDelete}
              onGoStudio={onGoStudio}
            />
          )}
          {mobileTab === 'account' && (
            <MobileAccountPage user={user} onBack={onBack} onGoStudio={onGoStudio} />
          )}
        </MobileShell>
        {modalNode}
      </>
    )
  }

  /* ---------- desktop shell ---------- */
  return (
    <div className="flex h-[100dvh] w-full overflow-hidden bg-slate-50 text-slate-950 dark:bg-slate-900 dark:text-slate-100">
      <Sidebar
        page={urlPage}
        setPage={navigateToPage}
        onGoHome={onBack}
        onGoStudio={onGoStudio}
        totalDesigns={counts.all}
        user={user}
      />

      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <div className="min-h-0 flex-1 overflow-y-auto">
          <div className="mx-auto max-w-6xl px-6 pb-10 pt-8 lg:px-8">
            {urlPage === 'dashboard' ? (
              <DashboardPage
                user={user}
                stats={stats}
                items={items}
                loading={loading}
                onGoStudio={onGoStudio}
                onOpen={onOpenItem}
                onDelete={handleDelete}
                onSeeAll={() => navigateToPage('designs')}
              />
            ) : (
              <DesignsPage
                items={items}
                filtered={filtered}
                loading={loading}
                query={query}
                setQuery={setQuery}
                mode={mode}
                setMode={setMode}
                counts={counts}
                layout={layout}
                setLayout={setLayout}
                hasFilter={hasFilter}
                clearFilter={clearFilter}
                onOpen={onOpenItem}
                onDelete={handleDelete}
                onGoStudio={onGoStudio}
              />
            )}
          </div>
        </div>
      </div>

      {modalNode}
    </div>
  )
}

export default memo(DashboardView)
