import { memo, useMemo } from 'react'
import { ChevronLeft, ChevronRight, Download, Loader2, Sparkles } from 'lucide-react'
import { Kbd } from '../common.jsx'
import { useElapsedSeconds } from './hooks.js'
import { formatMs, buildDownloadName, toPngDownloadUrl } from './utils.js'
import { QUICK_TEMPLATES } from './constants.js'

/* =================== empty state =================== */

const EmptyCanvas = memo(function EmptyCanvas({ onPickTemplate }) {
  return (
    <div className="flex h-full flex-col items-center justify-center px-6 text-center">
      <div className="relative grid h-16 w-16 place-items-center rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-900">
        <div aria-hidden className="absolute inset-0 -z-10 animate-pulse rounded-2xl bg-gradient-to-br from-slate-100 to-slate-50 blur-xl dark:from-slate-800 dark:to-slate-900" />
        <Sparkles size={24} className="text-slate-400 dark:text-slate-500" strokeWidth={1.5} />
      </div>
      <h3 className="mt-6 text-[17px] font-semibold tracking-tight text-slate-900 dark:text-slate-100">Canvas siap dipakai</h3>
      <p className="mt-1.5 max-w-sm text-[13px] leading-6 text-slate-500 dark:text-slate-400">
        Ketik topik di panel kiri lalu tekan <Kbd>⌘</Kbd> <Kbd>↵</Kbd>. Atau mulai dari template:
      </p>
      <div className="mt-5 flex flex-wrap justify-center gap-2">
        {QUICK_TEMPLATES.map((t) => (
          <button
            key={t.label}
            type="button"
            onClick={() => onPickTemplate(t)}
            className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-[12px] font-medium text-slate-700 transition hover:border-slate-400 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:border-slate-500 dark:hover:bg-slate-800"
          >
            {t.label}
          </button>
        ))}
      </div>
    </div>
  )
})

/* =================== skeleton loader =================== */

const SkeletonLoader = memo(function SkeletonLoader({ current, total, label }) {
  const elapsed = useElapsedSeconds(true, current)
  const badge = total > 0 && current > 0 ? `${current}/${total}` : total > 0 ? `—/${total}` : '…'

  return (
    <div className="relative h-full w-full overflow-hidden bg-slate-50 dark:bg-slate-900">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -translate-x-full animate-[shimmer_1.8s_ease-in-out_infinite] bg-gradient-to-r from-transparent via-white/50 to-transparent dark:via-white/[0.06]"
      />

      <div className="relative flex h-full flex-col justify-between p-[8%]">
        <div className="flex items-start justify-between">
          <div className="h-3 w-20 animate-pulse rounded-sm bg-slate-200 dark:bg-slate-800" />
          <div className="h-9 w-9 animate-pulse rounded-md bg-slate-200 dark:bg-slate-800" />
        </div>

        <div className="space-y-3">
          <div className="h-6 w-[70%] animate-pulse rounded-sm bg-slate-200 dark:bg-slate-800" />
          <div className="h-6 w-[55%] animate-pulse rounded-sm bg-slate-200 dark:bg-slate-800" />
          <div className="h-3 w-[40%] animate-pulse rounded-sm bg-slate-200/80 dark:bg-slate-800/80" />
          <div className="mt-3 h-24 w-full animate-pulse rounded-md bg-slate-200/70 dark:bg-slate-800/70" />
        </div>

        <div className="flex items-center gap-2">
          <div className="h-2 w-2 animate-pulse rounded-full bg-slate-200 dark:bg-slate-800" />
          <div className="h-2 w-12 animate-pulse rounded-sm bg-slate-200 dark:bg-slate-800" />
        </div>
      </div>

      <div className="pointer-events-none absolute inset-x-0 top-1/2 -translate-y-1/2 px-[8%]">
        <div className="mx-auto flex max-w-[80%] items-center justify-between gap-3 rounded-lg border border-slate-200 bg-white/90 px-3 py-2.5 shadow-[0_10px_30px_-15px_rgba(15,23,42,0.3)] backdrop-blur dark:border-slate-700 dark:bg-slate-900/90 dark:shadow-[0_10px_30px_-15px_rgba(0,0,0,0.6)]">
          <div className="flex items-center gap-2">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-amber-400 opacity-75" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-amber-500" />
            </span>
            <div className="min-w-0">
              <p className="truncate text-[12px] font-semibold leading-tight text-slate-900 dark:text-slate-100">{label}</p>
              <p className="mt-0.5 flex items-center gap-1 text-[10px] font-mono uppercase tracking-wider text-slate-500 dark:text-slate-400">
                <span>elapsed</span>
                <span className="tabular-nums text-slate-900 dark:text-slate-100">{formatMs(elapsed)}</span>
                <span>·</span>
                <span>slide {badge}</span>
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
})

/* =================== canvas =================== */

export const Canvas = memo(function Canvas({
  images, activeSlide, loading, isCarousel, generatingSlide, totalSlides, zoom, format,
  onPickTemplate, onPrev, onNext,
}) {
  const current = images[activeSlide]
  const showEmpty = !loading && !current
  const showLoader = loading && !current

  const aspectClass = useMemo(() => {
    if (format === 'portrait 4:5') return 'aspect-[4/5]'
    if (format === 'story 9:16') return 'aspect-[9/16]'
    return 'aspect-square'
  }, [format])

  return (
    <div className="relative flex h-full items-center justify-center overflow-auto bg-[radial-gradient(circle_at_center,#e2e8f0_1px,transparent_1px)] bg-[size:20px_20px] p-8 dark:bg-[radial-gradient(circle_at_center,#1e293b_1px,transparent_1px)]">
      {showEmpty ? (
        <EmptyCanvas onPickTemplate={onPickTemplate} />
      ) : (
        <div
          className={`relative ${aspectClass} w-[min(86vh,600px)] overflow-hidden border border-slate-200 bg-white shadow-[0_60px_120px_-60px_rgba(15,23,42,0.45),0_20px_50px_-20px_rgba(15,23,42,0.15)] transition-transform dark:border-slate-800 dark:bg-slate-900 dark:shadow-[0_60px_120px_-60px_rgba(0,0,0,0.8),0_20px_50px_-20px_rgba(0,0,0,0.5)]`}
          style={{ transform: `scale(${zoom})`, transformOrigin: 'center center' }}
        >
          {current && (
            <img
              src={current}
              alt={`Slide ${activeSlide + 1}`}
              loading="lazy"
              decoding="async"
              className="h-full w-full object-cover"
            />
          )}
          {showLoader && (
            <div className="absolute inset-0">
              <SkeletonLoader
                current={generatingSlide}
                total={isCarousel ? totalSlides : 1}
                label={isCarousel
                  ? (generatingSlide > 0 ? `Merender slide ${generatingSlide} dari ${totalSlides}` : 'Menyusun storyboard')
                  : 'Merender feed'}
              />
            </div>
          )}
          {isCarousel && current && (
            <div className="absolute right-3 top-3 rounded-md bg-black/70 px-2 py-0.5 font-mono text-[10px] font-semibold text-white backdrop-blur">
              {activeSlide + 1}/{totalSlides}
            </div>
          )}
        </div>
      )}

      {isCarousel && images.length > 1 && !showLoader && (
        <>
          <button
            type="button"
            onClick={onPrev}
            disabled={activeSlide === 0}
            className="absolute left-4 top-1/2 grid h-10 w-10 -translate-y-1/2 place-items-center rounded-full border border-slate-200 bg-white/90 text-slate-700 shadow-md backdrop-blur transition hover:bg-white disabled:opacity-30 dark:border-slate-700 dark:bg-slate-900/90 dark:text-slate-300 dark:hover:bg-slate-900"
            aria-label="Previous slide"
          >
            <ChevronLeft size={16} />
          </button>
          <button
            type="button"
            onClick={onNext}
            disabled={activeSlide >= images.length - 1}
            className="absolute right-4 top-1/2 grid h-10 w-10 -translate-y-1/2 place-items-center rounded-full border border-slate-200 bg-white/90 text-slate-700 shadow-md backdrop-blur transition hover:bg-white disabled:opacity-30 dark:border-slate-700 dark:bg-slate-900/90 dark:text-slate-300 dark:hover:bg-slate-900"
            aria-label="Next slide"
          >
            <ChevronRight size={16} />
          </button>
        </>
      )}
    </div>
  )
})

/* =================== filmstrip =================== */

export const Filmstrip = memo(function Filmstrip({
  images, activeSlide, setActiveSlide, totalSlides, isCarousel, loading, generatingSlide,
  topic, brand,
}) {
  const elapsed = useElapsedSeconds(loading, generatingSlide)
  if (!isCarousel && images.length === 0) return null
  const slots = isCarousel ? Math.max(totalSlides, images.length) : images.length

  return (
    <div className="flex h-[92px] shrink-0 items-center gap-2 border-t border-slate-200 bg-white/60 px-4 py-3 backdrop-blur dark:border-slate-800 dark:bg-slate-950/60">
      <p className="mr-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-400 dark:text-slate-500">Slides</p>
      <div className="flex flex-1 items-center gap-2 overflow-x-auto">
        {Array.from({ length: slots }).map((_, index) => {
          const image = images[index]
          const active = index === activeSlide
          const pending = !image && loading && index === images.length
          return (
            <button
              type="button"
              key={index}
              onClick={() => image && setActiveSlide(index)}
              disabled={!image}
              className={`group relative h-16 w-16 shrink-0 overflow-hidden rounded-md border transition ${
                active ? 'border-slate-900 ring-2 ring-slate-900/20 dark:border-slate-100 dark:ring-slate-100/20' : image ? 'border-slate-200 hover:border-slate-400 dark:border-slate-700 dark:hover:border-slate-500' : 'border-dashed border-slate-300 bg-white dark:border-slate-700 dark:bg-slate-900'
              } disabled:cursor-not-allowed`}
            >
              {image ? (
                <img src={image} alt={`Slide ${index + 1}`} loading="lazy" decoding="async" className="h-full w-full object-cover" />
              ) : pending ? (
                <div className="grid h-full w-full place-items-center">
                  <div className="flex flex-col items-center gap-0.5">
                    <Loader2 size={12} className="animate-spin text-slate-500 dark:text-slate-400" />
                    <span className="font-mono text-[9px] tabular-nums text-slate-600 dark:text-slate-400">{formatMs(elapsed)}</span>
                  </div>
                </div>
              ) : (
                <div className="grid h-full w-full place-items-center">
                  <span className="font-mono text-[10px] text-slate-400 dark:text-slate-500">{index + 1}</span>
                </div>
              )}
              <span className="absolute bottom-0.5 right-0.5 rounded bg-black/70 px-1 font-mono text-[9px] font-bold text-white">{index + 1}</span>
            </button>
          )
        })}
      </div>
      {images.length > 0 && (
        <a
          href={toPngDownloadUrl(images[activeSlide])}
          download={buildDownloadName({
            topic,
            brand,
            mode: isCarousel ? 'carousel' : 'single',
            slideIndex: isCarousel ? activeSlide + 1 : undefined,
            totalSlides: isCarousel ? totalSlides : undefined,
            imageUrl: images[activeSlide],
          })}
          className="ml-2 inline-flex shrink-0 items-center gap-1.5 rounded-md bg-slate-900 px-3 py-2 text-[12px] font-semibold text-white transition hover:bg-slate-800 dark:bg-white dark:text-slate-900 dark:hover:bg-slate-200"
        >
          <Download size={13} /> PNG
        </a>
      )}
    </div>
  )
})
