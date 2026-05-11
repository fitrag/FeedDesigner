import { memo } from 'react'
import {
  ChevronLeft, ChevronRight, Clock, Eye, HardDrive, Image as ImageIcon, ImagePlus,
  Images, Layers, LayoutDashboard, LogOut, Sparkles, Square, Trash2, TrendingUp, X,
} from 'lucide-react'
import { Brand } from '../common.jsx'
import { ThemeToggle } from '../theme.jsx'
import { useAuth } from '../auth.jsx'
import { formatRelative } from '../studio/utils.js'

/* ---------- format helpers ---------- */

export function formatBytes(bytes) {
  if (!bytes || bytes < 1024) return `${bytes || 0} B`
  const kb = bytes / 1024
  if (kb < 1024) return `${kb.toFixed(1)} KB`
  const mb = kb / 1024
  if (mb < 1024) return `${mb.toFixed(1)} MB`
  return `${(mb / 1024).toFixed(2)} GB`
}

export function formatAbs(ts) {
  if (!ts) return '—'
  return new Date(ts).toLocaleString('id-ID', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

function firstName(user) {
  const n = user?.name?.trim() || (user?.email || '').split('@')[0] || 'Creator'
  return n.split(' ')[0].charAt(0).toUpperCase() + n.split(' ')[0].slice(1)
}

/* ---------- sidebar ---------- */

export const SIDEBAR_NAV = [
  { key: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { key: 'designs', label: 'Desain', icon: Images },
]

export const Sidebar = memo(function Sidebar({
  page, setPage, onGoHome, onGoStudio, totalDesigns, user, onClose, inDrawer,
}) {
  const { logout } = useAuth()
  const displayName = user?.name?.trim() || (user?.email || '').split('@')[0] || 'Guest'
  const initial = (user?.name?.[0] || user?.email?.[0] || '?').toUpperCase()

  return (
    <aside
      className="relative flex h-full w-[272px] shrink-0 flex-col overflow-hidden border-r border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-950"
      aria-label="Dashboard sidebar"
    >
      <div className="flex h-14 shrink-0 items-center justify-between border-b border-slate-200 px-4 dark:border-slate-800">
        <Brand />
        {inDrawer && (
          <button
            type="button"
            onClick={onClose}
            className="grid h-8 w-8 place-items-center rounded-md text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800"
            aria-label="Tutup sidebar"
          >
            <X size={14} />
          </button>
        )}
      </div>

      {/* primary actions */}
      <div className="space-y-2 p-3">
        <button
          type="button"
          onClick={onGoStudio}
          className="group relative flex w-full items-center gap-2.5 overflow-hidden rounded-lg bg-gradient-to-br from-slate-950 to-slate-800 px-3 py-2.5 text-left text-[13px] font-semibold text-white shadow-[0_1px_0_rgba(255,255,255,0.1)_inset,0_8px_20px_-8px_rgba(15,23,42,0.4)] transition hover:from-slate-900 hover:to-slate-700 dark:from-white dark:to-slate-200 dark:text-slate-950 dark:hover:from-slate-100 dark:hover:to-slate-300"
        >
          <span className="grid h-8 w-8 place-items-center rounded-md bg-white/10 backdrop-blur dark:bg-slate-900/20">
            <Sparkles size={14} />
          </span>
          <span className="flex-1">
            <span className="block">Generate baru</span>
            <span className="block text-[10.5px] font-normal text-slate-300 dark:text-slate-700">Buka Studio</span>
          </span>
          <ChevronRight size={14} className="opacity-60 transition group-hover:translate-x-0.5 group-hover:opacity-100" />
        </button>

        <button
          type="button"
          onClick={onGoHome}
          className="flex w-full items-center gap-2.5 rounded-md px-2.5 py-2 text-[12.5px] font-medium text-slate-600 transition hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-100"
        >
          <ChevronLeft size={13} /> Kembali ke Home
        </button>
      </div>

      <div className="mx-3 h-px bg-slate-200 dark:bg-slate-800" />

      <nav className="space-y-0.5 p-3">
        <p className="px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400 dark:text-slate-500">
          Menu
        </p>
        {SIDEBAR_NAV.map((n) => (
          <NavItem
            key={n.key}
            icon={n.icon}
            label={n.label}
            active={page === n.key}
            onClick={() => setPage(n.key)}
            badge={n.key === 'designs' ? totalDesigns : undefined}
          />
        ))}
      </nav>

      <div className="mt-auto" />

      <div className="shrink-0 space-y-3 border-t border-slate-200 p-3 dark:border-slate-800">
        <div className="flex items-center justify-between">
          <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400 dark:text-slate-500">
            Tampilan
          </span>
          <ThemeToggle size="sm" />
        </div>

        <div className="flex items-center gap-2.5 rounded-xl border border-slate-200 bg-gradient-to-br from-slate-50 to-white p-2.5 dark:border-slate-800 dark:from-slate-900 dark:to-slate-950">
          <span className="relative grid h-9 w-9 shrink-0 place-items-center overflow-hidden rounded-full bg-gradient-to-br from-slate-950 to-slate-700 text-[12px] font-bold text-white dark:from-white dark:to-slate-300 dark:text-slate-950">
            {initial}
            <span className="absolute inset-0 bg-gradient-to-tr from-white/0 to-white/10 dark:from-slate-950/0 dark:to-slate-950/10" />
          </span>
          <div className="min-w-0 flex-1 leading-tight">
            <p className="truncate text-[12.5px] font-semibold text-slate-900 dark:text-slate-100">{displayName}</p>
            <p className="truncate text-[10.5px] text-slate-500 dark:text-slate-400">{user?.email}</p>
          </div>
          <button
            type="button"
            onClick={logout}
            className="grid h-7 w-7 shrink-0 place-items-center rounded-md text-slate-400 transition hover:bg-white hover:text-rose-500 dark:text-slate-500 dark:hover:bg-slate-800 dark:hover:text-rose-400"
            aria-label="Keluar"
            title="Keluar"
          >
            <LogOut size={13} />
          </button>
        </div>
      </div>
    </aside>
  )
})

const NavItem = memo(function NavItem({ icon: Icon, label, active, onClick, badge }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`group flex w-full items-center gap-2.5 rounded-md px-2.5 py-2 text-[13px] font-medium transition ${
        active
          ? 'bg-slate-950 text-white shadow-[0_1px_0_rgba(255,255,255,0.08)_inset] dark:bg-white dark:text-slate-950 dark:shadow-[0_1px_0_rgba(0,0,0,0.15)_inset]'
          : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-100'
      }`}
    >
      <Icon size={14} strokeWidth={active ? 2.2 : 1.8} />
      <span className="flex-1 text-left">{label}</span>
      {typeof badge === 'number' && (
        <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-semibold tabular-nums ${active ? 'bg-white/15 text-white dark:bg-slate-950/10 dark:text-slate-950' : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300'}`}>
          {badge}
        </span>
      )}
    </button>
  )
})

/* ---------- hero + stats ---------- */

export const StatCard = memo(function StatCard({ icon: Icon, label, value, sub, tone = 'slate' }) {
  const toneMap = {
    slate: { bg: 'from-slate-100 to-white dark:from-slate-800/50 dark:to-slate-900', dot: 'bg-slate-950 dark:bg-white' },
    indigo: { bg: 'from-indigo-50 to-white dark:from-indigo-950/30 dark:to-slate-900', dot: 'bg-indigo-500' },
    amber: { bg: 'from-amber-50 to-white dark:from-amber-950/30 dark:to-slate-900', dot: 'bg-amber-500' },
    emerald: { bg: 'from-emerald-50 to-white dark:from-emerald-950/30 dark:to-slate-900', dot: 'bg-emerald-500' },
  }
  const t = toneMap[tone] || toneMap.slate
  return (
    <div className={`relative overflow-hidden rounded-2xl border border-slate-200 bg-gradient-to-br ${t.bg} p-4 transition hover:-translate-y-0.5 hover:shadow-[0_12px_28px_-12px_rgba(15,23,42,0.14)] dark:border-slate-800`}>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${t.dot}`} />
            <p className="truncate text-[10.5px] font-semibold uppercase tracking-[0.12em] text-slate-500 dark:text-slate-400">{label}</p>
          </div>
          <p className="mt-2 text-[24px] font-semibold tracking-[-0.02em] text-slate-950 md:text-[28px] dark:text-slate-100">
            {value}
          </p>
          {sub && <p className="mt-0.5 truncate text-[11px] text-slate-500 dark:text-slate-400">{sub}</p>}
        </div>
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg border border-slate-200/70 bg-white/60 text-slate-700 backdrop-blur dark:border-slate-700/70 dark:bg-slate-900/60 dark:text-slate-200">
          <Icon size={15} strokeWidth={1.9} />
        </span>
      </div>
    </div>
  )
})

export const STAT_ICONS = { Images, Layers, HardDrive, TrendingUp }

export const HeroPanel = memo(function HeroPanel({ user, stats, onGoStudio, loading }) {
  const name = firstName(user)
  const hasAny = stats && stats.generations > 0
  return (
    <div className="relative overflow-hidden rounded-2xl border border-slate-200 bg-gradient-to-br from-slate-950 via-slate-900 to-slate-800 p-5 text-white shadow-[0_20px_60px_-30px_rgba(15,23,42,0.8)] md:p-7 dark:border-slate-800">
      <div aria-hidden className="pointer-events-none absolute -right-10 -top-10 h-48 w-48 rounded-full bg-gradient-to-br from-indigo-500/40 to-fuchsia-500/20 blur-3xl" />
      <div aria-hidden className="pointer-events-none absolute -bottom-12 -left-12 h-48 w-48 rounded-full bg-gradient-to-tr from-emerald-400/30 to-cyan-400/10 blur-3xl" />

      <div className="relative flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
        <div className="min-w-0">
          <div className="mb-2 inline-flex items-center gap-1.5 rounded-full bg-white/10 px-2.5 py-0.5 text-[10.5px] font-semibold uppercase tracking-[0.14em] text-white/80 backdrop-blur">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
            Dashboard
          </div>
          <h1 className="text-[24px] font-semibold tracking-[-0.02em] md:text-[32px]">
            Hai, {name} 👋
          </h1>
          <p className="mt-1.5 max-w-md text-[13px] leading-6 text-slate-300 md:text-[14px]">
            {loading
              ? 'Memuat ringkasan koleksi desain kamu…'
              : hasAny
                ? `Kamu sudah punya ${stats.generations} desain, total ${stats.slides} slide. Lanjutkan membuat atau review yang sudah ada.`
                : 'Mulai generate desain pertama kamu. Hasil akan otomatis muncul di dashboard ini.'}
          </p>
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={onGoStudio}
              className="inline-flex items-center gap-1.5 rounded-md bg-white px-3.5 py-2 text-[13px] font-semibold text-slate-950 transition hover:bg-slate-100"
            >
              <Sparkles size={13} /> Generate baru
            </button>
            {hasAny && stats?.lastAt && (
              <span className="inline-flex items-center gap-1.5 rounded-md border border-white/15 bg-white/5 px-3 py-2 text-[11.5px] text-slate-300 backdrop-blur">
                <Clock size={11} /> Terakhir {formatRelative(stats.lastAt)}
              </span>
            )}
          </div>
        </div>

        {hasAny && (
          <div className="shrink-0 rounded-xl border border-white/15 bg-white/5 p-4 backdrop-blur md:min-w-[220px]">
            <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-white/60">Quick stats</p>
            <div className="mt-2 grid grid-cols-2 gap-3">
              <div>
                <p className="text-[22px] font-semibold tabular-nums">{stats.carousels}</p>
                <p className="text-[11px] text-white/70">Carousel</p>
              </div>
              <div>
                <p className="text-[22px] font-semibold tabular-nums">{stats.singles}</p>
                <p className="text-[11px] text-white/70">Single</p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
})

/* ---------- gallery items ---------- */

const MODE_BADGE = {
  carousel: 'bg-indigo-500/90 text-white',
  single: 'bg-slate-900/80 text-white',
}

export const GenerationCard = memo(function GenerationCard({ item, onOpen, onDelete }) {
  const isCarousel = item.mode === 'carousel'
  const cover = `/api/images/${item.id}-01.webp`
  return (
    <article className="group relative flex flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white transition hover:-translate-y-1 hover:border-slate-300 hover:shadow-[0_18px_40px_-20px_rgba(15,23,42,0.35)] dark:border-slate-800 dark:bg-slate-900 dark:hover:border-slate-700 dark:hover:shadow-[0_18px_40px_-20px_rgba(0,0,0,0.8)]">
      <button type="button" onClick={() => onOpen(item)} className="block text-left">
        <div className="relative aspect-square overflow-hidden bg-slate-100 dark:bg-slate-800">
          <img
            src={cover}
            alt={item.topic || 'Generation cover'}
            loading="lazy"
            decoding="async"
            className="h-full w-full object-cover transition duration-700 ease-out group-hover:scale-[1.04]"
          />
          <div aria-hidden className="pointer-events-none absolute inset-x-0 bottom-0 h-20 bg-gradient-to-t from-slate-950/55 via-slate-950/15 to-transparent" />

          <div className={`absolute left-2.5 top-2.5 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider backdrop-blur ${MODE_BADGE[item.mode] || MODE_BADGE.single}`}>
            {isCarousel ? <Layers size={10} /> : <Square size={10} />}
            {isCarousel ? `${item.totalSlides} slides` : 'Single'}
          </div>
          <div className="absolute right-2.5 top-2.5 rounded-full bg-black/60 px-2 py-0.5 font-mono text-[9px] font-semibold text-white backdrop-blur">
            {item.format}
          </div>

          <div className="pointer-events-none absolute bottom-2.5 left-2.5 right-2.5 flex items-center justify-between opacity-0 transition duration-300 group-hover:opacity-100">
            <span className="inline-flex items-center gap-1 rounded-full bg-white/95 px-2.5 py-1 text-[10.5px] font-semibold text-slate-900 shadow-sm backdrop-blur dark:bg-slate-950/95 dark:text-slate-100">
              <Eye size={11} /> Buka detail
            </span>
          </div>
        </div>
      </button>

      <div className="flex items-start justify-between gap-2 p-3.5">
        <button type="button" onClick={() => onOpen(item)} className="min-w-0 flex-1 text-left">
          {item.brandName && (
            <p className="truncate text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500 dark:text-slate-400">
              {item.brandName}
            </p>
          )}
          <p className="mt-0.5 line-clamp-2 text-[13px] font-medium leading-5 text-slate-900 dark:text-slate-100">
            {item.topic || 'Tanpa judul'}
          </p>
          <p className="mt-1 text-[10.5px] text-slate-500 dark:text-slate-500">{formatRelative(item.createdAt)}</p>
        </button>
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); onDelete(item.id) }}
          className="grid h-7 w-7 shrink-0 place-items-center rounded-md text-slate-400 transition hover:bg-rose-50 hover:text-rose-600 dark:text-slate-500 dark:hover:bg-rose-950/40 dark:hover:text-rose-400"
          aria-label="Hapus"
        >
          <Trash2 size={12} />
        </button>
      </div>
    </article>
  )
})

export const GenerationRow = memo(function GenerationRow({ item, onOpen, onDelete }) {
  const isCarousel = item.mode === 'carousel'
  const cover = `/api/images/${item.id}-01.webp`
  return (
    <div className="group flex items-center gap-3 rounded-xl border border-slate-200 bg-white p-2.5 transition hover:-translate-y-px hover:border-slate-300 hover:shadow-sm dark:border-slate-800 dark:bg-slate-900 dark:hover:border-slate-700">
      <button type="button" onClick={() => onOpen(item)} className="contents">
        <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-lg bg-slate-100 dark:bg-slate-800">
          <img src={cover} alt="" loading="lazy" className="h-full w-full object-cover" />
          {isCarousel && (
            <span className="absolute bottom-0.5 right-0.5 rounded bg-black/70 px-1 font-mono text-[8px] font-bold text-white">
              {item.totalSlides}
            </span>
          )}
        </div>
        <div className="min-w-0 flex-1 text-left">
          <div className="flex items-center gap-2">
            {item.brandName && <span className="truncate text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500 dark:text-slate-400">{item.brandName}</span>}
            <span className={`inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wider ${isCarousel ? 'bg-indigo-50 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300' : 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300'}`}>
              {isCarousel ? <Layers size={9} /> : <Square size={9} />}
              {isCarousel ? `${item.totalSlides} slides` : 'single'}
            </span>
          </div>
          <p className="mt-0.5 truncate text-[13px] font-medium text-slate-900 dark:text-slate-100">{item.topic || 'Tanpa judul'}</p>
          <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[10.5px] text-slate-500 dark:text-slate-500">
            <span>{formatAbs(item.createdAt)}</span>
            <span className="hidden sm:inline">·</span>
            <span>{item.format}</span>
            {item.bytesStored != null && <><span className="hidden sm:inline">·</span><span>{formatBytes(item.bytesStored)}</span></>}
          </div>
        </div>
      </button>
      <button
        type="button"
        onClick={() => onDelete(item.id)}
        className="grid h-8 w-8 shrink-0 place-items-center rounded-md text-slate-400 transition hover:bg-rose-50 hover:text-rose-600 dark:text-slate-500 dark:hover:bg-rose-950/40 dark:hover:text-rose-400"
        aria-label="Hapus"
      >
        <Trash2 size={13} />
      </button>
    </div>
  )
})

export const EmptyState = memo(function EmptyState({ onCreate, hasFilter, onClearFilter }) {
  return (
    <div className="relative overflow-hidden rounded-2xl border border-dashed border-slate-300 bg-gradient-to-br from-slate-50 via-white to-slate-50 px-6 py-16 text-center dark:border-slate-700 dark:from-slate-900/60 dark:via-slate-900/40 dark:to-slate-900/60">
      <div aria-hidden className="pointer-events-none absolute inset-x-0 -top-10 mx-auto h-40 w-40 rounded-full bg-gradient-to-br from-indigo-300/30 to-fuchsia-300/20 blur-3xl dark:from-indigo-500/10 dark:to-fuchsia-500/5" />
      <div className="relative mx-auto grid h-14 w-14 place-items-center rounded-2xl border border-slate-200 bg-white text-slate-400 shadow-sm dark:border-slate-700 dark:bg-slate-800 dark:text-slate-500">
        <ImagePlus size={22} strokeWidth={1.5} />
      </div>
      <h3 className="relative mt-5 text-[17px] font-semibold tracking-tight text-slate-900 dark:text-slate-100">
        {hasFilter ? 'Tidak ada hasil yang cocok' : 'Kanvas kamu masih bersih'}
      </h3>
      <p className="relative mx-auto mt-1.5 max-w-md text-[13px] leading-6 text-slate-500 dark:text-slate-400">
        {hasFilter
          ? 'Coba ubah filter atau kata kunci pencarian kamu.'
          : 'Mulai dari satu topik, AI akan menyusun storyboard dan merender carousel lengkap dalam hitungan detik.'}
      </p>
      <div className="relative mt-6 flex flex-wrap items-center justify-center gap-2">
        {hasFilter && (
          <button
            type="button"
            onClick={onClearFilter}
            className="inline-flex items-center gap-1.5 rounded-md border border-slate-200 bg-white px-3.5 py-2 text-[12.5px] font-medium text-slate-700 transition hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800"
          >
            Reset filter
          </button>
        )}
        <button
          type="button"
          onClick={onCreate}
          className="inline-flex items-center gap-1.5 rounded-md bg-slate-950 px-3.5 py-2 text-[12.5px] font-semibold text-white transition hover:bg-slate-800 dark:bg-white dark:text-slate-950 dark:hover:bg-slate-200"
        >
          <Sparkles size={13} /> Buka Studio
        </button>
      </div>
    </div>
  )
})

/* ---------- skeletons for pages ---------- */

export const GridSkeleton = memo(function GridSkeleton({ layout = 'grid', count = 8 }) {
  return (
    <div className={layout === 'grid' ? 'grid gap-3 sm:gap-4 grid-cols-2 md:grid-cols-3 xl:grid-cols-4' : 'space-y-2'}>
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className={layout === 'grid' ? 'overflow-hidden rounded-2xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900' : 'flex items-center gap-3 rounded-xl border border-slate-200 p-2.5 dark:border-slate-800 dark:bg-slate-900'}>
          {layout === 'grid' ? (
            <>
              <div className="aspect-square animate-pulse bg-slate-100 dark:bg-slate-800" />
              <div className="space-y-1.5 p-3.5">
                <div className="h-2 w-16 animate-pulse rounded bg-slate-100 dark:bg-slate-800" />
                <div className="h-3 w-full animate-pulse rounded bg-slate-100 dark:bg-slate-800" />
                <div className="h-2 w-1/3 animate-pulse rounded bg-slate-100 dark:bg-slate-800" />
              </div>
            </>
          ) : (
            <>
              <div className="h-14 w-14 animate-pulse rounded-lg bg-slate-100 dark:bg-slate-800" />
              <div className="flex-1 space-y-1.5">
                <div className="h-3 w-1/3 animate-pulse rounded bg-slate-100 dark:bg-slate-800" />
                <div className="h-3 w-2/3 animate-pulse rounded bg-slate-100 dark:bg-slate-800" />
                <div className="h-2 w-1/4 animate-pulse rounded bg-slate-100 dark:bg-slate-800" />
              </div>
            </>
          )}
        </div>
      ))}
    </div>
  )
})
