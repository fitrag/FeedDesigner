import { memo } from 'react'
import { ChevronRight, Layers, Sparkles, Square } from 'lucide-react'
import { formatRelative } from '../studio/utils.js'
import {
  EmptyState, GenerationCard, GridSkeleton, HeroPanel, StatCard, STAT_ICONS,
  formatAbs, formatBytes,
} from './shared.jsx'

/**
 * Overview page — hero + stats + a grid of the 8 most recent designs.
 * On mobile (variant="mobile") the layout is restructured into a scroll-
 * first, card-based stream to feel like a native app.
 */
function DashboardPage({
  user, stats, items, loading, onGoStudio, onOpen, onDelete, onSeeAll,
  variant = 'desktop',
}) {
  const recent = Array.isArray(items) ? items.slice(0, 8) : []

  if (variant === 'mobile') {
    return (
      <div className="pb-8">
        {/* greeting */}
        <MobileGreeting user={user} stats={stats} loading={loading} onGoStudio={onGoStudio} />

        {/* quick stats as a 2x2 grid — all visible at once, no scroll needed */}
        <div className="mt-5 px-4">
          <SectionHeader label="Ringkasan" />
        </div>
        <div className="mt-2 grid grid-cols-2 gap-2 px-4">
          <StatChip icon={STAT_ICONS.Images} label="Desain" value={stats?.generations ?? (loading ? '—' : 0)} />
          <StatChip icon={STAT_ICONS.Layers} label="Slide" value={stats?.slides ?? (loading ? '—' : 0)} tone="indigo" />
          <StatChip icon={STAT_ICONS.HardDrive} label="Storage" value={formatBytes(stats?.bytesStored || 0)} tone="amber" />
          <StatChip icon={STAT_ICONS.TrendingUp} label="Terakhir" value={stats?.lastAt ? formatRelative(stats.lastAt) : '—'} tone="emerald" />
        </div>

        {/* recent designs */}
        <div className="mt-6 flex items-center justify-between px-4">
          <SectionHeader label="Terbaru" />
          {Array.isArray(items) && items.length > 8 && (
            <button
              type="button"
              onClick={onSeeAll}
              className="inline-flex items-center gap-0.5 text-[12px] font-medium text-slate-600 active:text-slate-900 dark:text-slate-400 dark:active:text-slate-100"
            >
              Lihat semua <ChevronRight size={12} />
            </button>
          )}
        </div>

        <div className="mt-3 space-y-2 px-4">
          {loading ? (
            Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white p-2 dark:border-slate-800 dark:bg-slate-900">
                <div className="h-14 w-14 shrink-0 animate-pulse rounded-lg bg-slate-100 dark:bg-slate-800" />
                <div className="flex-1 space-y-1.5">
                  <div className="h-3 w-1/2 animate-pulse rounded bg-slate-100 dark:bg-slate-800" />
                  <div className="h-2 w-3/4 animate-pulse rounded bg-slate-100 dark:bg-slate-800" />
                </div>
              </div>
            ))
          ) : recent.length === 0 ? (
            <EmptyState onCreate={onGoStudio} hasFilter={false} />
          ) : (
            recent.map((it) => <MobileRecentRow key={it.id} item={it} onOpen={onOpen} />)
          )}
        </div>
      </div>
    )
  }

  /* ---------- desktop default ---------- */
  return (
    <>
      <HeroPanel user={user} stats={stats} onGoStudio={onGoStudio} loading={loading} />

      <div className="mt-5 grid gap-3 grid-cols-2 md:mt-6 lg:grid-cols-4">
        <StatCard icon={STAT_ICONS.Images} label="Total desain" value={stats?.generations ?? (loading ? '—' : 0)} sub={stats ? `${stats.carousels} carousel · ${stats.singles} single` : 'Belum ada data'} />
        <StatCard icon={STAT_ICONS.Layers} label="Total slide" value={stats?.slides ?? (loading ? '—' : 0)} sub={stats?.slides ? 'Semua mode' : ''} tone="indigo" />
        <StatCard icon={STAT_ICONS.HardDrive} label="Storage" value={formatBytes(stats?.bytesStored || 0)} sub="WebP compressed" tone="amber" />
        <StatCard icon={STAT_ICONS.TrendingUp} label="Terakhir" value={stats?.lastAt ? formatRelative(stats.lastAt) : '—'} sub={stats?.firstAt ? `Sejak ${formatAbs(stats.firstAt)}` : ''} tone="emerald" />
      </div>

      <div className="mt-8 flex items-end justify-between gap-3">
        <div>
          <h2 className="text-[15px] font-semibold tracking-tight text-slate-900 dark:text-slate-100">Desain terbaru</h2>
          <p className="mt-0.5 text-[11.5px] text-slate-500 dark:text-slate-400">8 hasil terbaru dari koleksi kamu.</p>
        </div>
        {Array.isArray(items) && items.length > 8 && (
          <button
            type="button"
            onClick={onSeeAll}
            className="inline-flex items-center gap-1 rounded-md border border-slate-200 bg-white px-3 py-1.5 text-[12px] font-medium text-slate-700 transition hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800"
          >
            Lihat semua <ChevronRight size={12} />
          </button>
        )}
      </div>

      <div className="mt-4">
        {loading ? (
          <GridSkeleton layout="grid" count={8} />
        ) : recent.length === 0 ? (
          <EmptyState onCreate={onGoStudio} hasFilter={false} />
        ) : (
          <div className="grid gap-3 sm:gap-4 grid-cols-2 md:grid-cols-3 xl:grid-cols-4">
            {recent.map((it) => (
              <GenerationCard key={it.id} item={it} onOpen={onOpen} onDelete={onDelete} />
            ))}
          </div>
        )}
      </div>
    </>
  )
}

export default memo(DashboardPage)

/* ---------- mobile subcomponents ---------- */

const MobileGreeting = memo(function MobileGreeting({ user, stats, loading, onGoStudio }) {
  const name = (user?.name?.trim() || (user?.email || '').split('@')[0] || 'Creator').split(' ')[0]
  const hasAny = stats && stats.generations > 0
  return (
    <div className="relative mx-4 mt-2 overflow-hidden rounded-2xl border border-slate-200 bg-gradient-to-br from-slate-950 via-slate-900 to-slate-800 p-5 text-white shadow-[0_20px_60px_-30px_rgba(15,23,42,0.8)] dark:border-slate-800">
      <div aria-hidden className="pointer-events-none absolute -right-8 -top-10 h-32 w-32 rounded-full bg-gradient-to-br from-indigo-500/40 to-fuchsia-500/20 blur-3xl" />
      <div aria-hidden className="pointer-events-none absolute -bottom-10 -left-10 h-32 w-32 rounded-full bg-gradient-to-tr from-emerald-400/30 to-cyan-400/10 blur-3xl" />
      <div className="relative">
        <p className="text-[10.5px] font-semibold uppercase tracking-[0.14em] text-white/60">Hai,</p>
        <h2 className="mt-0.5 text-[22px] font-semibold tracking-[-0.02em]">{name} 👋</h2>
        <p className="mt-2 text-[12.5px] leading-5 text-slate-300">
          {loading
            ? 'Memuat ringkasan kamu…'
            : hasAny
              ? `Kamu punya ${stats.generations} desain, ${stats.slides} slide total.`
              : 'Mulai generate desain pertama kamu hari ini.'}
        </p>
        <button
          type="button"
          onClick={onGoStudio}
          className="mt-4 inline-flex items-center gap-1.5 rounded-md bg-white px-3.5 py-2 text-[12.5px] font-semibold text-slate-950 transition active:bg-slate-100"
        >
          <Sparkles size={12} /> Generate baru
        </button>
      </div>
    </div>
  )
})

const StatChip = memo(function StatChip({ icon: Icon, label, value, tone = 'slate' }) {
  const dotTone = {
    slate: 'bg-slate-950 dark:bg-white',
    indigo: 'bg-indigo-500',
    amber: 'bg-amber-500',
    emerald: 'bg-emerald-500',
  }[tone]
  return (
    <div className="min-w-0 rounded-xl border border-slate-200 bg-white px-3 py-2.5 dark:border-slate-800 dark:bg-slate-900">
      <div className="flex items-center gap-1.5">
        <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${dotTone}`} />
        <p className="truncate text-[10px] font-semibold uppercase tracking-[0.1em] text-slate-500 dark:text-slate-400">{label}</p>
      </div>
      <div className="mt-1 flex items-center gap-2">
        <Icon size={14} className="shrink-0 text-slate-500 dark:text-slate-400" />
        <p className="truncate text-[14px] font-semibold tabular-nums text-slate-900 dark:text-slate-100">{value}</p>
      </div>
    </div>
  )
})

const SectionHeader = memo(function SectionHeader({ label }) {
  return (
    <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500 dark:text-slate-400">
      {label}
    </p>
  )
})

const MobileRecentRow = memo(function MobileRecentRow({ item, onOpen }) {
  const isCarousel = item.mode === 'carousel'
  const cover = `/api/images/${item.id}-01.webp`
  return (
    <button
      type="button"
      onClick={() => onOpen(item)}
      className="flex w-full items-center gap-3 rounded-xl border border-slate-200 bg-white p-2 text-left transition active:bg-slate-50 dark:border-slate-800 dark:bg-slate-900 dark:active:bg-slate-800/50"
    >
      <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-lg bg-slate-100 dark:bg-slate-800">
        <img src={cover} alt="" loading="lazy" className="h-full w-full object-cover" />
        {isCarousel && (
          <span className="absolute bottom-0.5 right-0.5 rounded bg-black/70 px-1 font-mono text-[8px] font-bold text-white">
            {item.totalSlides}
          </span>
        )}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <span className={`inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wider ${isCarousel ? 'bg-indigo-50 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300' : 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300'}`}>
            {isCarousel ? <Layers size={9} /> : <Square size={9} />}
            {isCarousel ? `${item.totalSlides}` : '1'}
          </span>
          {item.brandName && (
            <span className="truncate text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-500 dark:text-slate-400">
              {item.brandName}
            </span>
          )}
        </div>
        <p className="mt-0.5 truncate text-[13px] font-medium text-slate-900 dark:text-slate-100">
          {item.topic || 'Tanpa judul'}
        </p>
        <p className="mt-0.5 text-[10.5px] text-slate-500 dark:text-slate-500">{formatRelative(item.createdAt)}</p>
      </div>
      <ChevronRight size={14} className="shrink-0 text-slate-400" />
    </button>
  )
})
