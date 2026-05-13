import { memo, useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import {
  ChevronLeft, ChevronRight, Download, Globe, Layers, Loader2, Lock, Share2, Sparkles, Square, Trash2, X,
} from 'lucide-react'
import { authedFetch } from '../auth.jsx'
import { useToast } from '../toast.jsx'
import { buildDownloadName, toPngDownloadUrl } from '../studio/utils.js'
import { formatAbs } from './shared.jsx'
import { resolveApiUrl } from '../../config.js'

/**
 * Generation detail modal.
 *
 * Layout strategy:
 * - Mobile: full-screen sheet with header, scrollable body (preview + filmstrip
 *   + info + downloads stacked), and sticky bottom action bar. Uses `100dvh`
 *   so it plays nicely with the iOS safe area.
 * - Desktop (lg+): centered dialog, two-column grid (preview left, info rail
 *   right), header spans both columns. All panes are bounded so the page
 *   never double-scrolls.
 */
export default function GenerationDetailModal({ id, onClose, onDeleted, onEdit }) {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [activeSlide, setActiveSlide] = useState(0)
  const toast = useToast()

  useEffect(() => {
    if (!id) return
    let aborted = false
    setLoading(true); setError(''); setActiveSlide(0); setData(null)
    authedFetch(`/api/generations/${id}`)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error('not_found'))))
      .then((d) => {
        if (aborted) return
        // Resolve relative image URLs so they work in cross-origin deploys.
        if (d?.slides) d.slides = d.slides.map((s) => ({ ...s, image: resolveApiUrl(s.image) }))
        setData(d); setLoading(false)
      })
      .catch(() => { if (!aborted) { setError('Gagal memuat detail'); setLoading(false) } })
    return () => { aborted = true }
  }, [id])

  useEffect(() => {
    if (!id) return
    const onKey = (e) => {
      if (e.key === 'Escape') onClose()
      if (!data?.slides?.length) return
      if (e.key === 'ArrowLeft') setActiveSlide((i) => Math.max(0, i - 1))
      if (e.key === 'ArrowRight') setActiveSlide((i) => Math.min(data.slides.length - 1, i + 1))
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [id, data, onClose])

  useEffect(() => {
    if (!id) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = prev }
  }, [id])

  const handleDelete = async () => {
    if (!data?.id) return
    if (!confirm('Hapus generation ini dan semua slide-nya?')) return
    try {
      const res = await authedFetch(`/api/generations/${data.id}`, { method: 'DELETE' })
      if (res.ok) {
        toast.success('Generation dihapus')
        onDeleted(data.id)
        onClose()
      } else { toast.error('Gagal menghapus') }
    } catch { toast.error('Gagal menghapus') }
  }

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(`${window.location.origin}/dashboard?id=${data.id}`)
      toast.success('Link dashboard disalin')
    } catch { toast.error('Gagal menyalin link') }
  }

  const handleTogglePublic = async () => {
    if (!data?.id) return
    const next = !data.isPublic
    // Optimistic update so the toggle feels instant.
    setData((d) => (d ? { ...d, isPublic: next } : d))
    try {
      const res = await authedFetch(`/api/generations/${data.id}/visibility`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isPublic: next }),
      })
      if (!res.ok) throw new Error('fail')
      toast.success(next ? 'Dipublikasikan ke showcase' : 'Dijadikan privat')
    } catch {
      setData((d) => (d ? { ...d, isPublic: !next } : d))
      toast.error('Gagal mengubah visibility')
    }
  }

  if (!id) return null

  const current = data?.slides?.[activeSlide]
  const canPrev = activeSlide > 0
  const canNext = data?.slides && activeSlide < data.slides.length - 1
  const isCarousel = data?.mode === 'carousel'
  const slideCount = data?.slides?.length || 0

  // Render into document.body so the modal escapes any parent stacking
  // context (e.g. the dashboard sticky top bar on mobile). Without a portal,
  // those sticky headers can visually cover the modal even when z-index wins.
  if (typeof document === 'undefined') return null

  return createPortal(
    <div
      className="fixed inset-0 z-[100] flex items-end justify-center bg-slate-950/70 backdrop-blur-md sm:items-center sm:p-4 animate-[fade-in_180ms_ease-out]"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
    >
      <div
        className="grid h-[95dvh] w-full overflow-hidden border-slate-200 bg-white shadow-[0_40px_80px_-20px_rgba(15,23,42,0.5)] grid-rows-[auto_minmax(0,1fr)] sm:h-auto sm:max-h-[92vh] sm:max-w-6xl sm:rounded-2xl sm:border lg:grid-cols-[minmax(0,1fr)_340px] animate-[modal-in_240ms_cubic-bezier(0.21,1,0.32,1)] dark:border-slate-800 dark:bg-slate-950"
        onClick={(e) => e.stopPropagation()}
      >
        {/* HEADER — spans both columns on lg */}
        <header className="relative flex min-w-0 shrink-0 items-center gap-2 border-b border-slate-200 bg-white/80 px-3 py-2.5 backdrop-blur sm:px-4 sm:py-3 lg:col-span-2 dark:border-slate-800 dark:bg-slate-950/80">
          <div className="min-w-0 flex-1 overflow-hidden">
            {loading ? (
              <div className="space-y-1.5">
                <div className="h-2.5 w-24 animate-pulse rounded bg-slate-200 dark:bg-slate-800" />
                <div className="h-3.5 w-40 animate-pulse rounded bg-slate-200 sm:w-56 dark:bg-slate-800" />
              </div>
            ) : (
              <>
                {data?.brandName && (
                  <p className="truncate text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500 dark:text-slate-400">
                    {data.brandName}
                  </p>
                )}
                <p className="truncate text-[14px] font-semibold tracking-tight text-slate-900 sm:text-[15px] dark:text-slate-100">
                  {data?.topic || 'Tanpa judul'}
                </p>
              </>
            )}
          </div>
          <div className="flex shrink-0 items-center gap-0.5 sm:gap-1">
            {data && (
              <>
                <button
                  type="button"
                  onClick={handleCopyLink}
                  className="hidden h-8 w-8 place-items-center rounded-md text-slate-500 transition hover:bg-slate-100 hover:text-slate-900 sm:grid dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-100"
                  aria-label="Salin link"
                  title="Salin link"
                >
                  <Share2 size={14} />
                </button>
                <button
                  type="button"
                  onClick={() => onEdit(data)}
                  className="hidden items-center gap-1.5 rounded-md border border-slate-200 bg-white px-3 py-1.5 text-[12.5px] font-medium text-slate-700 transition hover:bg-slate-50 md:inline-flex dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800"
                >
                  <Sparkles size={12} /> Load ke Studio
                </button>
                <button
                  type="button"
                  onClick={handleDelete}
                  className="grid h-8 w-8 place-items-center rounded-md text-slate-500 transition hover:bg-rose-50 hover:text-rose-600 dark:text-slate-400 dark:hover:bg-rose-950/40 dark:hover:text-rose-400"
                  aria-label="Hapus"
                >
                  <Trash2 size={14} />
                </button>
              </>
            )}
            <button
              type="button"
              onClick={onClose}
              className="grid h-8 w-8 place-items-center rounded-md text-slate-500 transition hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800"
              aria-label="Tutup"
            >
              <X size={14} />
            </button>
          </div>
        </header>

        {/* PREVIEW COLUMN */}
        <div className="grid min-h-0 overflow-hidden grid-rows-[minmax(0,1fr)_auto] lg:border-r lg:border-slate-200 lg:dark:border-slate-800">
          {/* stage */}
          <div className="relative flex min-h-0 items-center justify-center overflow-hidden bg-gradient-to-br from-slate-100 to-white p-3 sm:p-4 lg:p-8 dark:from-slate-900 dark:to-slate-950">
            <div aria-hidden className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_center,#cbd5e1_1px,transparent_1px)] bg-[size:18px_18px] opacity-40 dark:bg-[radial-gradient(circle_at_center,#334155_1px,transparent_1px)] dark:opacity-30" />

            {loading ? (
              <div className="relative flex flex-col items-center gap-3">
                <Loader2 size={22} className="animate-spin text-slate-400" />
                <p className="text-[11.5px] text-slate-500 dark:text-slate-400">Memuat detail…</p>
              </div>
            ) : error ? (
              <p className="relative text-sm text-rose-600 dark:text-rose-400">{error}</p>
            ) : current ? (
              <img
                src={current.image}
                alt={`Slide ${current.slideIndex}`}
                className="relative block max-h-full max-w-full rounded-lg object-contain shadow-[0_20px_40px_-12px_rgba(15,23,42,0.3)] dark:shadow-[0_20px_40px_-12px_rgba(0,0,0,0.6)]"
                loading="eager"
                decoding="async"
              />
            ) : (
              <p className="relative text-sm text-slate-500">Tidak ada slide</p>
            )}

            {slideCount > 1 && (
              <>
                <button
                  type="button"
                  onClick={() => setActiveSlide((i) => Math.max(0, i - 1))}
                  disabled={!canPrev}
                  className="absolute left-2 top-1/2 grid h-9 w-9 -translate-y-1/2 place-items-center rounded-full border border-slate-200 bg-white/95 text-slate-700 shadow-md backdrop-blur transition hover:bg-white disabled:opacity-30 sm:left-3 dark:border-slate-700 dark:bg-slate-900/95 dark:text-slate-300 dark:hover:bg-slate-900"
                  aria-label="Slide sebelumnya"
                >
                  <ChevronLeft size={15} />
                </button>
                <button
                  type="button"
                  onClick={() => setActiveSlide((i) => Math.min(slideCount - 1, i + 1))}
                  disabled={!canNext}
                  className="absolute right-2 top-1/2 grid h-9 w-9 -translate-y-1/2 place-items-center rounded-full border border-slate-200 bg-white/95 text-slate-700 shadow-md backdrop-blur transition hover:bg-white disabled:opacity-30 sm:right-3 dark:border-slate-700 dark:bg-slate-900/95 dark:text-slate-300 dark:hover:bg-slate-900"
                  aria-label="Slide berikutnya"
                >
                  <ChevronRight size={15} />
                </button>
                <div className="absolute bottom-3 left-1/2 -translate-x-1/2 rounded-full bg-slate-950/80 px-2.5 py-0.5 font-mono text-[10px] font-semibold text-white backdrop-blur">
                  {activeSlide + 1} / {slideCount}
                </div>
              </>
            )}
          </div>

          {/* filmstrip */}
          {slideCount > 1 && (
            <div className="shrink-0 border-t border-slate-200 bg-white/70 px-3 py-2 backdrop-blur sm:px-4 sm:py-2.5 dark:border-slate-800 dark:bg-slate-950/70">
              <div className="flex gap-1.5 overflow-x-auto sm:gap-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                {data.slides.map((s, i) => (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => setActiveSlide(i)}
                    className={`relative h-12 w-12 shrink-0 overflow-hidden rounded-md border transition sm:h-14 sm:w-14 ${
                      i === activeSlide
                        ? 'border-slate-900 ring-2 ring-slate-900/20 dark:border-slate-100 dark:ring-slate-100/20'
                        : 'border-slate-200 opacity-60 hover:opacity-100 dark:border-slate-700'
                    }`}
                    aria-label={`Slide ${s.slideIndex}`}
                  >
                    <img src={s.image} alt="" loading="lazy" className="h-full w-full object-cover" />
                    <span className="absolute bottom-0 right-0 rounded-tl bg-black/70 px-1 font-mono text-[8px] font-bold text-white">
                      {s.slideIndex}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* INFO RAIL — bottom sheet on mobile, side column on lg */}
        <aside className="grid min-h-0 overflow-hidden border-t border-slate-200 bg-slate-50 grid-rows-[minmax(0,1fr)_auto] lg:border-l-0 lg:border-t-0 lg:bg-white dark:border-slate-800 dark:bg-slate-900 dark:lg:bg-slate-950">
          <div className="min-h-0 space-y-3 overflow-y-auto p-3 sm:p-4">
            {loading ? (
              <>
                <div className="h-24 animate-pulse rounded-xl bg-slate-200 dark:bg-slate-800" />
                <div className="h-36 animate-pulse rounded-xl bg-slate-200 dark:bg-slate-800" />
              </>
            ) : data && (
              <>
                {/* Meta card */}
                <div className="rounded-xl border border-slate-200 bg-white p-3 sm:p-4 dark:border-slate-800 dark:bg-slate-900">
                  <div className="mb-3 flex flex-wrap items-center gap-2">
                    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[9.5px] font-semibold uppercase tracking-wider ${isCarousel ? 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300' : 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300'}`}>
                      {isCarousel ? <Layers size={9} /> : <Square size={9} />}
                      {isCarousel ? 'Carousel' : 'Single'}
                    </span>
                    <span className="rounded-full bg-slate-100 px-2 py-0.5 font-mono text-[9.5px] font-semibold text-slate-700 dark:bg-slate-800 dark:text-slate-300">
                      {data.format}
                    </span>
                  </div>
                  <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-[12px] lg:grid-cols-1">
                    <MetaRow label="Slides" value={`${slideCount}/${data.totalSlides}`} />
                    <MetaRow label="Dibuat" value={formatAbs(data.createdAt)} />
                    {data.palette && <MetaRow label="Palette" value={data.palette} />}
                    {data.audience && <MetaRow label="Audiens" value={data.audience} />}
                    {data.tone && <MetaRow label="Tone" value={data.tone} />}
                  </dl>

                  {/* Visibility toggle — controls showcase publication. Default
                   * private; user explicitly flips this to list on landing. */}
                  <button
                    type="button"
                    onClick={handleTogglePublic}
                    className={`mt-3 flex w-full items-center gap-3 rounded-lg border px-3 py-2 text-left transition ${
                      data.isPublic
                        ? 'border-emerald-200 bg-emerald-50 text-emerald-900 hover:bg-emerald-100 dark:border-emerald-900/50 dark:bg-emerald-950/30 dark:text-emerald-200'
                        : 'border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800'
                    }`}
                    aria-pressed={data.isPublic}
                  >
                    <span className={`grid h-8 w-8 shrink-0 place-items-center rounded-md ${data.isPublic ? 'bg-emerald-500 text-white' : 'bg-white text-slate-600 dark:bg-slate-800 dark:text-slate-300'}`}>
                      {data.isPublic ? <Globe size={14} /> : <Lock size={14} />}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-[12.5px] font-semibold">
                        {data.isPublic ? 'Publik di showcase' : 'Privat'}
                      </span>
                      <span className="mt-0.5 block text-[10.5px] leading-4 opacity-75">
                        {data.isPublic ? 'Muncul di landing page. Ketuk untuk hide.' : 'Hanya kamu yang lihat. Ketuk untuk publikasikan.'}
                      </span>
                    </span>
                  </button>
                </div>

                {/* Downloads card */}
                <div className="rounded-xl border border-slate-200 bg-white p-3 sm:p-4 dark:border-slate-800 dark:bg-slate-900">
                  <div className="mb-2 flex items-center justify-between">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-500 dark:text-slate-400">
                      Download (PNG)
                    </p>
                    <span className="rounded-full bg-slate-100 px-1.5 py-0.5 font-mono text-[9.5px] text-slate-600 dark:bg-slate-800 dark:text-slate-400">
                      {slideCount} file
                    </span>
                  </div>
                  <div className="space-y-1.5">
                    {data.slides?.map((s, i) => {
                      const fname = buildDownloadName({
                        topic: data.topic,
                        brand: data.brandName,
                        mode: data.mode,
                        slideIndex: data.mode === 'carousel' ? i + 1 : undefined,
                        totalSlides: data.mode === 'carousel' ? data.totalSlides : undefined,
                        imageUrl: s.image,
                      })
                      return (
                        <a
                          key={s.id}
                          href={toPngDownloadUrl(s.image)}
                          download={fname}
                          title={fname}
                          className="group flex items-center gap-2.5 rounded-md border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-[12px] font-medium text-slate-700 transition hover:border-slate-300 hover:bg-white dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:border-slate-600 dark:hover:bg-slate-800"
                        >
                          <span className="grid h-7 w-7 shrink-0 place-items-center overflow-hidden rounded bg-slate-200 dark:bg-slate-800">
                            <img src={s.image} alt="" loading="lazy" className="h-full w-full object-cover" />
                          </span>
                          <span className="min-w-0 flex-1 truncate">
                            {data.mode === 'carousel' ? `Slide ${i + 1}` : 'Feed'}.png
                          </span>
                          <Download size={11} className="shrink-0 text-slate-400 transition group-hover:text-slate-900 dark:group-hover:text-slate-100" />
                        </a>
                      )
                    })}
                  </div>
                </div>
              </>
            )}
          </div>

          {/* sticky bottom action — shows on mobile only (desktop uses header button) */}
          {data && (
            <div className="shrink-0 border-t border-slate-200 bg-white p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] md:hidden dark:border-slate-800 dark:bg-slate-950">
              <button
                type="button"
                onClick={() => onEdit(data)}
                className="flex w-full items-center justify-center gap-1.5 rounded-md bg-slate-950 px-3 py-2.5 text-[13px] font-semibold text-white transition hover:bg-slate-800 dark:bg-white dark:text-slate-950 dark:hover:bg-slate-200"
              >
                <Sparkles size={13} /> Load ke Studio
              </button>
            </div>
          )}
        </aside>
      </div>
    </div>,
    document.body,
  )
}

const MetaRow = memo(function MetaRow({ label, value }) {
  return (
    <div className="flex items-start justify-between gap-3">
      <dt className="shrink-0 text-slate-500 dark:text-slate-400">{label}</dt>
      <dd className="min-w-0 text-right font-medium text-slate-900 dark:text-slate-100 break-words">{value}</dd>
    </div>
  )
})
