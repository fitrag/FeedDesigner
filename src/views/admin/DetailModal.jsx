import { memo, useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import {
  ChevronLeft, ChevronRight, Download, Globe, Layers, Loader2, Lock, Square, Trash2, User, X,
} from 'lucide-react'
import { authedFetch } from '../auth.jsx'
import { useToast } from '../toast.jsx'
import { resolveApiUrl } from '../../config.js'
import { buildDownloadName, toPngDownloadUrl } from '../studio/utils.js'
import { formatAbs, formatBytes } from './shared.jsx'

/**
 * Admin generation detail modal. Similar to the dashboard DetailModal but
 * fetches via the admin endpoint (no ownership check) and shows extra
 * metadata like user info.
 */
function AdminDetailModal({ id, onClose, onDeleted }) {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [activeSlide, setActiveSlide] = useState(0)
  const toast = useToast()

  useEffect(() => {
    if (!id) return
    let aborted = false
    setLoading(true); setError(''); setActiveSlide(0); setData(null)
    authedFetch(`/api/admin/generations/${id}`)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error('not_found'))))
      .then((d) => {
        if (aborted) return
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
      if (e.key === 'ArrowLeft') setActiveSlide((a) => Math.max(0, a - 1))
      if (e.key === 'ArrowRight') setActiveSlide((a) => Math.min((data?.slides?.length || 1) - 1, a + 1))
    }
    window.addEventListener('keydown', onKey)
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { window.removeEventListener('keydown', onKey); document.body.style.overflow = prev }
  }, [id, data, onClose])

  const handleDelete = async () => {
    if (!data) return
    if (!confirm(`Hapus "${data.topic}" dan semua slide-nya?`)) return
    try {
      const res = await authedFetch(`/api/admin/generations/${data.id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error('fail')
      toast.success('Desain dihapus')
      onDeleted?.(data.id)
      onClose()
    } catch { toast.error('Gagal menghapus') }
  }

  if (!id) return null

  const slides = data?.slides || []
  const current = slides[activeSlide] || null

  return createPortal(
    <div
      className="fixed inset-0 z-[100] flex items-end justify-center bg-slate-950/70 backdrop-blur-md sm:items-center sm:p-4"
      style={{ animation: 'fade-in 200ms ease-out' }}
      onClick={onClose}
      role="dialog"
      aria-modal="true"
    >
      <div
        className="relative grid h-[92dvh] w-full overflow-hidden border-slate-200 bg-white shadow-[0_40px_80px_-20px_rgba(15,23,42,0.5)] grid-rows-[auto_minmax(0,1fr)_auto] sm:h-auto sm:max-h-[92vh] sm:max-w-5xl sm:rounded-2xl sm:border lg:grid-cols-[minmax(0,1fr)_340px] lg:grid-rows-[auto_minmax(0,1fr)] dark:border-slate-800 dark:bg-slate-950"
        style={{ animation: 'modal-in 260ms cubic-bezier(0.21, 1, 0.32, 1)' }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* HEADER */}
        <div className="relative flex min-w-0 shrink-0 items-center gap-3 border-b border-slate-200 bg-white/80 px-4 py-3 backdrop-blur sm:px-5 lg:col-span-2 dark:border-slate-800 dark:bg-slate-950/80">
          <div className="min-w-0 flex-1">
            {loading ? (
              <div className="h-4 w-48 animate-pulse rounded bg-slate-200 dark:bg-slate-800" />
            ) : (
              <>
                {data?.brandName && (
                  <p className="truncate text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">
                    {data.brandName}
                  </p>
                )}
                <h3 className="truncate text-[14px] font-semibold tracking-tight text-slate-950 sm:text-[15px] dark:text-slate-100">
                  {data?.topic || 'Tanpa judul'}
                </h3>
              </>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="grid h-8 w-8 shrink-0 place-items-center rounded-md text-slate-500 transition hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-100"
            aria-label="Tutup"
          >
            <X size={14} />
          </button>
        </div>

        {/* PREVIEW */}
        <div className="relative flex min-h-0 items-center justify-center overflow-hidden bg-slate-100 p-3 sm:p-4 lg:p-6 dark:bg-slate-900">
          <div aria-hidden className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_center,#cbd5e1_1px,transparent_1px)] bg-[size:18px_18px] opacity-40 dark:bg-[radial-gradient(circle_at_center,#334155_1px,transparent_1px)] dark:opacity-30" />

          {loading ? (
            <Loader2 className="relative animate-spin text-slate-400" size={24} />
          ) : error ? (
            <p className="relative text-sm text-rose-500">{error}</p>
          ) : current ? (
            <img
              src={current.image}
              alt={`Slide ${current.slideIndex}`}
              className="relative block max-h-full max-w-full rounded-lg object-contain shadow-[0_20px_40px_-12px_rgba(15,23,42,0.3)] dark:shadow-[0_20px_40px_-12px_rgba(0,0,0,0.6)]"
            />
          ) : (
            <p className="relative text-sm text-slate-500">Tidak ada slide</p>
          )}

          {slides.length > 1 && (
            <>
              <button
                type="button"
                onClick={() => setActiveSlide((a) => Math.max(0, a - 1))}
                disabled={activeSlide === 0}
                className="absolute left-2 top-1/2 grid h-9 w-9 -translate-y-1/2 place-items-center rounded-full border border-slate-200 bg-white/95 text-slate-800 shadow-lg transition hover:bg-white disabled:opacity-30 sm:left-3 dark:border-slate-700 dark:bg-slate-900/95 dark:text-slate-100"
                aria-label="Sebelumnya"
              >
                <ChevronLeft size={16} />
              </button>
              <button
                type="button"
                onClick={() => setActiveSlide((a) => Math.min(slides.length - 1, a + 1))}
                disabled={activeSlide === slides.length - 1}
                className="absolute right-2 top-1/2 grid h-9 w-9 -translate-y-1/2 place-items-center rounded-full border border-slate-200 bg-white/95 text-slate-800 shadow-lg transition hover:bg-white disabled:opacity-30 sm:right-3 dark:border-slate-700 dark:bg-slate-900/95 dark:text-slate-100"
                aria-label="Berikutnya"
              >
                <ChevronRight size={16} />
              </button>
              <div className="absolute bottom-3 left-1/2 -translate-x-1/2 rounded-full bg-slate-950/80 px-2.5 py-0.5 font-mono text-[10px] font-semibold text-white backdrop-blur">
                {activeSlide + 1} / {slides.length}
              </div>
            </>
          )}
        </div>

        {/* INFO SIDEBAR */}
        <aside className="flex min-h-0 flex-col border-t border-slate-200 bg-white lg:border-l lg:border-t-0 dark:border-slate-800 dark:bg-slate-950">
          <div className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-5">
            {data && (
              <>
                <dl className="grid grid-cols-2 gap-x-4 gap-y-2.5 text-[12px] lg:grid-cols-1">
                  <div className="flex items-center justify-between gap-2">
                    <dt className="text-slate-500 dark:text-slate-400">Mode</dt>
                    <dd className="flex items-center gap-1 font-medium text-slate-900 dark:text-slate-100">
                      {data.mode === 'carousel' ? <Layers size={11} /> : <Square size={11} />}
                      {data.mode === 'carousel' ? 'Carousel' : 'Single'}
                    </dd>
                  </div>
                  {data.format && (
                    <div className="flex items-center justify-between gap-2">
                      <dt className="text-slate-500 dark:text-slate-400">Format</dt>
                      <dd className="font-mono text-[11px] font-medium text-slate-900 dark:text-slate-100">{data.format}</dd>
                    </div>
                  )}
                  <div className="flex items-center justify-between gap-2">
                    <dt className="text-slate-500 dark:text-slate-400">Slides</dt>
                    <dd className="font-medium text-slate-900 dark:text-slate-100">{data.totalSlides}</dd>
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <dt className="text-slate-500 dark:text-slate-400">Visibility</dt>
                    <dd className="flex items-center gap-1 font-medium text-slate-900 dark:text-slate-100">
                      {data.isPublic ? <Globe size={11} className="text-emerald-500" /> : <Lock size={11} />}
                      {data.isPublic ? 'Publik' : 'Privat'}
                    </dd>
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <dt className="text-slate-500 dark:text-slate-400">Dibuat</dt>
                    <dd className="text-[11px] font-medium text-slate-900 dark:text-slate-100">{formatAbs(data.createdAt)}</dd>
                  </div>
                  {data.userId && (
                    <div className="flex items-center justify-between gap-2">
                      <dt className="text-slate-500 dark:text-slate-400">User</dt>
                      <dd className="flex items-center gap-1 truncate text-[11px] font-medium text-slate-900 dark:text-slate-100">
                        <User size={10} /> <span className="truncate">{data.userId.slice(0, 8)}…</span>
                      </dd>
                    </div>
                  )}
                </dl>

                {(data.audience || data.palette || data.tone || data.extraNotes) && (
                  <div className="mt-4 border-t border-slate-100 pt-4 dark:border-slate-800">
                    <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500 dark:text-slate-400">Brief</p>
                    <div className="space-y-1.5 text-[11.5px] text-slate-600 dark:text-slate-400">
                      {data.audience && <p><span className="font-medium text-slate-800 dark:text-slate-200">Audience:</span> {data.audience}</p>}
                      {data.palette && <p><span className="font-medium text-slate-800 dark:text-slate-200">Palette:</span> {data.palette}</p>}
                      {data.tone && <p><span className="font-medium text-slate-800 dark:text-slate-200">Tone:</span> {data.tone}</p>}
                      {data.extraNotes && <p><span className="font-medium text-slate-800 dark:text-slate-200">Notes:</span> {data.extraNotes}</p>}
                    </div>
                  </div>
                )}

                {/* Slide thumbnails */}
                {slides.length > 1 && (
                  <div className="mt-4 border-t border-slate-100 pt-4 dark:border-slate-800">
                    <p className="mb-2.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500 dark:text-slate-400">
                      Semua slide
                    </p>
                    <div className="grid grid-cols-5 gap-1.5 sm:grid-cols-6 lg:grid-cols-4">
                      {slides.map((s, i) => (
                        <button
                          key={s.id}
                          type="button"
                          onClick={() => setActiveSlide(i)}
                          className={`relative aspect-square overflow-hidden rounded-md border transition ${
                            i === activeSlide
                              ? 'border-slate-900 ring-2 ring-slate-900 dark:border-slate-100 dark:ring-slate-100'
                              : 'border-slate-200 hover:border-slate-400 dark:border-slate-800 dark:hover:border-slate-600'
                          }`}
                        >
                          <img src={s.image} alt="" loading="lazy" className="h-full w-full object-cover" />
                          <span className="absolute bottom-0 right-0 bg-white/90 px-1 font-mono text-[9px] text-slate-900 dark:bg-slate-900/90 dark:text-slate-100">
                            {String(i + 1).padStart(2, '0')}
                          </span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Downloads */}
                <div className="mt-4 border-t border-slate-100 pt-4 dark:border-slate-800">
                  <p className="mb-2.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500 dark:text-slate-400">
                    Download
                  </p>
                  <div className="space-y-1.5">
                    {slides.map((s, i) => {
                      const fname = buildDownloadName({
                        topic: data.topic,
                        brandName: data.brandName,
                        slideIndex: data.mode === 'carousel' ? i + 1 : undefined,
                        totalSlides: data.mode === 'carousel' ? data.totalSlides : undefined,
                        imageUrl: s.image,
                      })
                      return (
                        <a
                          key={s.id}
                          href={toPngDownloadUrl(s.image)}
                          download={fname}
                          className="flex items-center gap-2 rounded-md border border-slate-200 px-2.5 py-1.5 text-[11.5px] font-medium text-slate-700 transition hover:bg-slate-50 dark:border-slate-800 dark:text-slate-300 dark:hover:bg-slate-800"
                        >
                          <Download size={11} />
                          <span className="min-w-0 flex-1 truncate">{fname}</span>
                          <span className="shrink-0 text-[10px] text-slate-400">{formatBytes(s.bytesStored || 0)}</span>
                        </a>
                      )
                    })}
                  </div>
                </div>
              </>
            )}
          </div>

          {/* Bottom action bar */}
          <div className="shrink-0 border-t border-slate-200 bg-slate-50 p-3 sm:p-4 dark:border-slate-800 dark:bg-slate-900/60">
            <button
              type="button"
              onClick={handleDelete}
              className="flex w-full items-center justify-center gap-2 rounded-md border border-rose-200 bg-rose-50 px-4 py-2 text-[12.5px] font-semibold text-rose-700 transition hover:bg-rose-100 dark:border-rose-900/50 dark:bg-rose-950/40 dark:text-rose-400 dark:hover:bg-rose-950/60"
            >
              <Trash2 size={13} /> Hapus desain ini
            </button>
          </div>
        </aside>
      </div>
    </div>,
    document.body,
  )
}

export default memo(AdminDetailModal)
