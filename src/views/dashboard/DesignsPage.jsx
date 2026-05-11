import { memo } from 'react'
import { Grid3x3, Layers, LayoutDashboard, Rows3, Search, Square, X } from 'lucide-react'
import {
  EmptyState, GenerationCard, GenerationRow, GridSkeleton,
} from './shared.jsx'

const MODE_FILTERS = [
  { k: 'all', label: 'Semua', icon: LayoutDashboard },
  { k: 'carousel', label: 'Carousel', icon: Layers },
  { k: 'single', label: 'Single', icon: Square },
]

/**
 * Full gallery of every generation the user owns. Mobile variant uses a
 * sticky search + horizontal filter chips above a 2-col grid with no
 * redundant header (the native header is already shown by MobileShell).
 */
function DesignsPage({
  items, filtered, loading, query, setQuery, mode, setMode, counts,
  layout, setLayout, hasFilter, clearFilter, onOpen, onDelete, onGoStudio,
  variant = 'desktop',
}) {
  if (variant === 'mobile') {
    return (
      <div className="pb-8">
        {/* sticky search + filters — stays within the scroll area so the big
         * title above can still scroll away, iOS-style. */}
        <div className="sticky top-0 z-10 bg-slate-50/80 backdrop-blur supports-[backdrop-filter]:bg-slate-50/70 dark:bg-slate-900/80 dark:supports-[backdrop-filter]:bg-slate-900/70">
          <div className="space-y-2 px-4 py-3">
            <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 focus-within:border-slate-900 focus-within:ring-2 focus-within:ring-slate-900/10 dark:border-slate-700 dark:bg-slate-900 dark:focus-within:border-slate-100 dark:focus-within:ring-slate-100/10">
              <Search size={14} className="text-slate-400" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Cari topik atau brand"
                className="flex-1 bg-transparent text-[14px] text-slate-900 outline-none placeholder:text-slate-400 dark:text-slate-100 dark:placeholder:text-slate-500"
              />
              {query && (
                <button type="button" onClick={() => setQuery('')} className="rounded p-0.5 text-slate-400 active:bg-slate-100 dark:active:bg-slate-800" aria-label="Hapus pencarian">
                  <X size={12} />
                </button>
              )}
            </div>

            {/* horizontal filter chips */}
            <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              {MODE_FILTERS.map((f) => {
                const isActive = mode === f.k
                return (
                  <button
                    key={f.k}
                    type="button"
                    onClick={() => setMode(f.k)}
                    className={`inline-flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 text-[12px] font-medium transition ${
                      isActive
                        ? 'border-slate-950 bg-slate-950 text-white dark:border-white dark:bg-white dark:text-slate-950'
                        : 'border-slate-200 bg-white text-slate-600 active:bg-slate-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:active:bg-slate-800'
                    }`}
                  >
                    <f.icon size={12} />
                    {f.label}
                    <span className={`rounded-full px-1 text-[9px] font-bold tabular-nums ${isActive ? 'bg-white/20 text-white dark:bg-slate-900/15 dark:text-slate-950' : 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400'}`}>
                      {counts[f.k] ?? 0}
                    </span>
                  </button>
                )
              })}
            </div>
          </div>
        </div>

        {/* gallery */}
        <div className="px-4 pt-2">
          {loading ? (
            <div className="grid grid-cols-2 gap-3">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="overflow-hidden rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
                  <div className="aspect-square animate-pulse bg-slate-100 dark:bg-slate-800" />
                </div>
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <EmptyState onCreate={onGoStudio} hasFilter={hasFilter} onClearFilter={clearFilter} />
          ) : (
            <div className="grid grid-cols-2 gap-3">
              {filtered.map((it) => (
                <GenerationCard key={it.id} item={it} onOpen={onOpen} onDelete={onDelete} />
              ))}
            </div>
          )}
        </div>

        {!loading && filtered.length > 0 && items && (
          <p className="mt-6 text-center text-[11px] text-slate-500 dark:text-slate-400">
            {filtered.length} dari {items.length} desain
          </p>
        )}
      </div>
    )
  }

  /* ---------- desktop default ---------- */
  return (
    <>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-[22px] font-semibold tracking-[-0.02em] text-slate-900 md:text-[26px] dark:text-slate-100">Semua Desain</h1>
          <p className="mt-1 text-[12.5px] text-slate-500 dark:text-slate-400">
            {loading ? 'Memuat koleksi…' : `${counts.all} desain tersimpan — ${counts.carousel} carousel, ${counts.single} single.`}
          </p>
        </div>
      </div>

      <div className="mt-5 flex flex-wrap items-center gap-2">
        <div className="flex min-w-0 flex-1 items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 shadow-[0_1px_0_rgba(15,23,42,0.03)] transition focus-within:border-slate-900 focus-within:ring-2 focus-within:ring-slate-900/10 md:max-w-md dark:border-slate-700 dark:bg-slate-900 dark:focus-within:border-slate-100 dark:focus-within:ring-slate-100/10">
          <Search size={14} className="text-slate-400" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Cari topik atau brand…"
            className="flex-1 bg-transparent text-[13px] text-slate-900 outline-none placeholder:text-slate-400 dark:text-slate-100 dark:placeholder:text-slate-500"
          />
          {query && (
            <button type="button" onClick={() => setQuery('')} className="rounded p-0.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800 dark:hover:text-slate-200" aria-label="Hapus pencarian">
              <X size={12} />
            </button>
          )}
        </div>

        <div className="flex items-center rounded-lg border border-slate-200 bg-white p-0.5 dark:border-slate-700 dark:bg-slate-900">
          {MODE_FILTERS.map((s) => (
            <button
              key={s.k}
              type="button"
              onClick={() => setMode(s.k)}
              className={`inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-[12px] font-medium transition ${mode === s.k ? 'bg-slate-950 text-white dark:bg-white dark:text-slate-950' : 'text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100'}`}
            >
              <s.icon size={11} />
              <span className="hidden sm:inline">{s.label}</span>
              <span className={`rounded-full px-1 py-0 text-[9px] font-bold tabular-nums ${mode === s.k ? 'bg-white/20 text-white dark:bg-slate-900/15 dark:text-slate-950' : 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400'}`}>
                {counts[s.k] ?? 0}
              </span>
            </button>
          ))}
        </div>

        <div className="ml-auto flex items-center rounded-lg border border-slate-200 bg-white p-0.5 dark:border-slate-700 dark:bg-slate-900">
          <button
            type="button"
            onClick={() => setLayout('grid')}
            className={`grid h-7 w-7 place-items-center rounded-md transition ${layout === 'grid' ? 'bg-slate-950 text-white dark:bg-white dark:text-slate-950' : 'text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100'}`}
            aria-label="Grid view"
          >
            <Grid3x3 size={13} />
          </button>
          <button
            type="button"
            onClick={() => setLayout('list')}
            className={`grid h-7 w-7 place-items-center rounded-md transition ${layout === 'list' ? 'bg-slate-950 text-white dark:bg-white dark:text-slate-950' : 'text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100'}`}
            aria-label="List view"
          >
            <Rows3 size={13} />
          </button>
        </div>
      </div>

      <div className="mt-4">
        {loading ? (
          <GridSkeleton layout={layout} count={8} />
        ) : filtered.length === 0 ? (
          <EmptyState onCreate={onGoStudio} hasFilter={hasFilter} onClearFilter={clearFilter} />
        ) : layout === 'grid' ? (
          <div className="grid gap-3 sm:gap-4 grid-cols-2 md:grid-cols-3 xl:grid-cols-4">
            {filtered.map((it) => (
              <GenerationCard key={it.id} item={it} onOpen={onOpen} onDelete={onDelete} />
            ))}
          </div>
        ) : (
          <div className="space-y-2">
            {filtered.map((it) => (
              <GenerationRow key={it.id} item={it} onOpen={onOpen} onDelete={onDelete} />
            ))}
          </div>
        )}
      </div>

      {!loading && filtered.length > 0 && items && (
        <p className="mt-6 text-center text-[11px] text-slate-500 dark:text-slate-400">
          Menampilkan {filtered.length} dari {items.length} desain
        </p>
      )}
    </>
  )
}

export default memo(DesignsPage)
