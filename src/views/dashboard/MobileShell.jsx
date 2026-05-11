import { memo, useCallback, useEffect, useRef, useState } from 'react'
import {
  ChevronLeft, Home, Images, LogOut, RefreshCw, Search, Sparkles, User,
} from 'lucide-react'
import { Brand } from '../common.jsx'
import { ThemeToggle } from '../theme.jsx'
import { UserMenu, useAuth } from '../auth.jsx'

/**
 * Native-feel mobile shell for the dashboard. Replaces the hamburger drawer
 * with a persistent bottom tab nav, uses a sticky header with an inline
 * refresh action, and adds a lightweight pull-to-refresh gesture at the top
 * of the scroll area. The Sidebar component isn't used on mobile anymore —
 * the tab nav below is the primary way to navigate between pages.
 */
export default function MobileShell({
  page,
  setPage,
  onBack,
  onGoStudio,
  items,
  filtered,
  counts,
  loading,
  loadAll,
  children,
}) {
  return (
    <div className="grid h-[100dvh] w-full grid-rows-[auto_minmax(0,1fr)_auto] overflow-hidden bg-slate-50 text-slate-950 dark:bg-slate-900 dark:text-slate-100">
      <MobileHeader
        page={page}
        onBack={onBack}
        onGoStudio={onGoStudio}
        items={items}
        filtered={filtered}
        counts={counts}
        loadAll={loadAll}
      />

      <PullToRefreshArea loading={loading} onRefresh={loadAll}>
        {children}
      </PullToRefreshArea>

      <MobileBottomNav page={page} setPage={setPage} counts={counts} />
    </div>
  )
}

/* ---------- header ---------- */

const MobileHeader = memo(function MobileHeader({
  page, onBack, onGoStudio, items, filtered, counts, loadAll,
}) {
  const [refreshing, setRefreshing] = useState(false)

  const onRefresh = useCallback(async () => {
    setRefreshing(true)
    try { await loadAll?.() } finally {
      // Keep the spinner visible briefly so the tap doesn't feel like a no-op
      // when the network was already fast.
      setTimeout(() => setRefreshing(false), 400)
    }
  }, [loadAll])

  const title = page === 'dashboard'
    ? 'Dashboard'
    : page === 'designs'
      ? 'Desain'
      : 'Akun'
  const subtitle = page === 'designs' && Array.isArray(items)
    ? `${filtered?.length ?? counts?.all ?? 0} dari ${counts?.all ?? 0}`
    : null

  return (
    <header className="z-10 border-b border-slate-200 bg-white/95 pt-[env(safe-area-inset-top)] backdrop-blur supports-[backdrop-filter]:bg-white/80 dark:border-slate-800 dark:bg-slate-950/95 dark:supports-[backdrop-filter]:bg-slate-950/80">
      {/* top row — back + brand + quick action */}
      <div className="flex h-12 items-center gap-2 px-3">
        <button
          type="button"
          onClick={onBack}
          className="grid h-9 w-9 place-items-center rounded-md text-slate-600 transition active:bg-slate-100 dark:text-slate-300 dark:active:bg-slate-800"
          aria-label="Kembali ke Home"
        >
          <ChevronLeft size={18} />
        </button>
        <div className="min-w-0 flex-1">
          <Brand compact />
        </div>
        <button
          type="button"
          onClick={onGoStudio}
          className="inline-flex shrink-0 items-center gap-1 rounded-md bg-slate-950 px-3 py-1.5 text-[12px] font-semibold text-white active:bg-slate-800 dark:bg-white dark:text-slate-950 dark:active:bg-slate-200"
          aria-label="Buka Studio"
        >
          <Sparkles size={12} /> Studio
        </button>
      </div>

      {/* big title row — iOS-style large header that collapses to a single
       * line if it's the Akun page (which has its own top block). */}
      {page !== 'account' && (
        <div className="flex items-end justify-between gap-2 px-4 pb-3 pt-1">
          <div className="min-w-0">
            <h1 className="text-[26px] font-semibold leading-tight tracking-[-0.02em] text-slate-950 dark:text-slate-100">
              {title}
            </h1>
            {subtitle && (
              <p className="mt-0.5 truncate text-[11.5px] text-slate-500 dark:text-slate-400">{subtitle}</p>
            )}
          </div>
          <button
            type="button"
            onClick={onRefresh}
            className={`grid h-9 w-9 shrink-0 place-items-center rounded-full border border-slate-200 bg-white text-slate-600 transition active:bg-slate-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:active:bg-slate-800 ${refreshing ? 'animate-spin text-slate-900 dark:text-slate-100' : ''}`}
            aria-label="Refresh data"
            disabled={refreshing}
          >
            <RefreshCw size={14} />
          </button>
        </div>
      )}
    </header>
  )
})

/* ---------- pull-to-refresh ---------- */

function PullToRefreshArea({ children, onRefresh, loading }) {
  const scrollRef = useRef(null)
  const startY = useRef(null)
  const [pull, setPull] = useState(0)
  const [refreshing, setRefreshing] = useState(false)

  // Only activate when scrolled to the very top and the user drags down.
  const onTouchStart = useCallback((e) => {
    const el = scrollRef.current
    if (!el || el.scrollTop > 0) { startY.current = null; return }
    startY.current = e.touches[0].clientY
  }, [])

  const onTouchMove = useCallback((e) => {
    if (startY.current == null) return
    const dy = e.touches[0].clientY - startY.current
    if (dy <= 0) { setPull(0); return }
    // Rubber-band resistance — feels natural instead of 1:1 drag.
    setPull(Math.min(100, Math.sqrt(dy * 12)))
  }, [])

  const onTouchEnd = useCallback(async () => {
    const triggered = pull >= 60
    startY.current = null
    setPull(0)
    if (!triggered) return
    setRefreshing(true)
    try { await onRefresh?.() } finally {
      setTimeout(() => setRefreshing(false), 400)
    }
  }, [pull, onRefresh])

  const showIndicator = pull > 0 || refreshing || loading
  const progress = Math.min(100, (pull / 60) * 100)

  return (
    <div
      ref={scrollRef}
      className="relative min-h-0 overflow-y-auto overscroll-contain"
      onTouchStart={onTouchStart}
      onTouchMove={onTouchMove}
      onTouchEnd={onTouchEnd}
    >
      {showIndicator && (
        <div
          className="pointer-events-none absolute inset-x-0 top-0 z-10 flex justify-center transition"
          style={{ transform: `translateY(${Math.min(pull, 48)}px)` }}
        >
          <div className="mt-2 grid h-8 w-8 place-items-center rounded-full bg-white/95 shadow-md backdrop-blur dark:bg-slate-900/95">
            <RefreshCw
              size={14}
              className={`text-slate-700 dark:text-slate-200 ${refreshing || loading ? 'animate-spin' : ''}`}
              style={{ transform: refreshing || loading ? undefined : `rotate(${progress * 3.6}deg)` }}
            />
          </div>
        </div>
      )}
      {children}
    </div>
  )
}

/* ---------- bottom tab nav ---------- */

const TABS = [
  { key: 'dashboard', label: 'Beranda', icon: Home },
  { key: 'designs', label: 'Desain', icon: Images, badgeKey: 'all' },
  { key: 'account', label: 'Akun', icon: User },
]

const MobileBottomNav = memo(function MobileBottomNav({ page, setPage, counts }) {
  return (
    <nav
      className="z-10 border-t border-slate-200 bg-white/95 pb-[env(safe-area-inset-bottom)] backdrop-blur supports-[backdrop-filter]:bg-white/80 dark:border-slate-800 dark:bg-slate-950/95 dark:supports-[backdrop-filter]:bg-slate-950/80"
      aria-label="Dashboard sections"
    >
      <div className="grid grid-cols-3">
        {TABS.map((t) => {
          const active = page === t.key
          const badge = t.badgeKey && counts ? counts[t.badgeKey] : null
          return (
            <button
              key={t.key}
              type="button"
              onClick={() => setPage(t.key)}
              className={`relative flex flex-col items-center justify-center gap-1 py-2.5 text-[10.5px] font-medium transition ${
                active
                  ? 'text-slate-900 dark:text-slate-100'
                  : 'text-slate-400 active:text-slate-700 dark:text-slate-500 dark:active:text-slate-200'
              }`}
              aria-current={active ? 'page' : undefined}
            >
              <div className="relative">
                <t.icon size={18} strokeWidth={active ? 2.2 : 1.7} />
                {typeof badge === 'number' && badge > 0 && (
                  <span className="absolute -right-2.5 -top-1 grid h-3.5 min-w-[14px] place-items-center rounded-full bg-slate-900 px-1 text-[9px] font-bold text-white dark:bg-white dark:text-slate-900">
                    {badge > 99 ? '99+' : badge}
                  </span>
                )}
              </div>
              {t.label}
              {active && <span className="absolute left-1/2 top-0 h-0.5 w-8 -translate-x-1/2 rounded-full bg-slate-900 dark:bg-slate-100" />}
            </button>
          )
        })}
      </div>
    </nav>
  )
})

/* ---------- account page ---------- */

export const MobileAccountPage = memo(function MobileAccountPage({ user, onBack, onGoStudio }) {
  const { logout } = useAuth()
  const displayName = user?.name?.trim() || (user?.email || '').split('@')[0] || 'Guest'
  const initial = (user?.name?.[0] || user?.email?.[0] || '?').toUpperCase()

  return (
    <div className="pb-8">
      {/* big profile card */}
      <div className="relative mx-4 mt-4 overflow-hidden rounded-2xl border border-slate-200 bg-gradient-to-br from-slate-950 to-slate-800 p-5 text-white shadow-[0_20px_60px_-30px_rgba(15,23,42,0.8)] dark:border-slate-800 dark:from-white dark:to-slate-200 dark:text-slate-950">
        <div aria-hidden className="pointer-events-none absolute -right-10 -top-10 h-36 w-36 rounded-full bg-gradient-to-br from-indigo-500/40 to-fuchsia-500/20 blur-3xl" />
        <div className="relative flex items-center gap-3">
          <span className="grid h-12 w-12 place-items-center rounded-full bg-white/15 text-[16px] font-bold uppercase backdrop-blur dark:bg-slate-950/15">
            {initial}
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-[15px] font-semibold tracking-tight">{displayName}</p>
            {user?.email && (
              <p className="mt-0.5 truncate text-[12px] text-white/70 dark:text-slate-700">{user.email}</p>
            )}
          </div>
        </div>
      </div>

      {/* actions list */}
      <div className="mx-4 mt-4 overflow-hidden rounded-2xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
        <AccountRow
          icon={Sparkles}
          label="Buka Studio"
          hint="Buat desain baru"
          onClick={onGoStudio}
        />
        <RowDivider />
        <AccountRow
          icon={Home}
          label="Kembali ke Home"
          hint="Landing page"
          onClick={onBack}
        />
      </div>

      {/* preferences */}
      <div className="mx-4 mt-4 overflow-hidden rounded-2xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
        <div className="flex items-center justify-between gap-3 px-4 py-3">
          <div>
            <p className="text-[13px] font-medium text-slate-900 dark:text-slate-100">Tema tampilan</p>
            <p className="mt-0.5 text-[11.5px] text-slate-500 dark:text-slate-400">Light · Sistem · Dark</p>
          </div>
          <ThemeToggle size="sm" />
        </div>
        <RowDivider />
        <div className="flex items-center justify-between gap-3 px-4 py-3">
          <div>
            <p className="text-[13px] font-medium text-slate-900 dark:text-slate-100">Akun</p>
            <p className="mt-0.5 text-[11.5px] text-slate-500 dark:text-slate-400">Masuk / daftar</p>
          </div>
          <UserMenu compact />
        </div>
      </div>

      {/* logout */}
      <div className="mx-4 mt-4 overflow-hidden rounded-2xl border border-rose-200/70 bg-white dark:border-rose-900/50 dark:bg-slate-900">
        <button
          type="button"
          onClick={logout}
          className="flex w-full items-center gap-3 px-4 py-3 text-left transition active:bg-rose-50 dark:active:bg-rose-950/40"
        >
          <span className="grid h-8 w-8 place-items-center rounded-md bg-rose-100 text-rose-600 dark:bg-rose-950/40 dark:text-rose-400">
            <LogOut size={14} />
          </span>
          <span className="flex-1">
            <span className="block text-[13px] font-medium text-rose-600 dark:text-rose-400">Keluar</span>
            <span className="block text-[11px] text-slate-500 dark:text-slate-400">Sign out dari akun ini</span>
          </span>
        </button>
      </div>

      <p className="mt-6 text-center text-[10.5px] text-slate-400 dark:text-slate-600">
        FeedDesigner v0.3.0
      </p>
    </div>
  )
})

const AccountRow = memo(function AccountRow({ icon: Icon, label, hint, onClick, danger }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full items-center gap-3 px-4 py-3 text-left transition active:bg-slate-50 dark:active:bg-slate-800/50"
    >
      <span className={`grid h-8 w-8 place-items-center rounded-md ${danger ? 'bg-rose-100 text-rose-600 dark:bg-rose-950/40 dark:text-rose-400' : 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200'}`}>
        <Icon size={14} />
      </span>
      <span className="flex-1">
        <span className={`block text-[13px] font-medium ${danger ? 'text-rose-600 dark:text-rose-400' : 'text-slate-900 dark:text-slate-100'}`}>{label}</span>
        {hint && <span className="block text-[11px] text-slate-500 dark:text-slate-400">{hint}</span>}
      </span>
      <Search size={14} className="invisible" aria-hidden />
    </button>
  )
})

const RowDivider = memo(function RowDivider() {
  return <div className="h-px bg-slate-100 dark:bg-slate-800" />
})

/* ---------- search bar shown on the designs mobile page ---------- */

export const MobileSearchBar = memo(function MobileSearchBar({ query, setQuery }) {
  return (
    <div className="px-4">
      <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 focus-within:border-slate-900 focus-within:ring-2 focus-within:ring-slate-900/10 dark:border-slate-700 dark:bg-slate-900 dark:focus-within:border-slate-100 dark:focus-within:ring-slate-100/10">
        <Search size={14} className="text-slate-400" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Cari topik atau brand"
          className="flex-1 bg-transparent text-[14px] text-slate-900 outline-none placeholder:text-slate-400 dark:text-slate-100 dark:placeholder:text-slate-500"
        />
      </div>
    </div>
  )
})
