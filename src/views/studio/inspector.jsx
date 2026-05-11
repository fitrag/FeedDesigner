import { memo } from 'react'
import { BookmarkPlus, Heart, ImagePlus, MessageCircle, MoreHorizontal, Send, Trash2 } from 'lucide-react'
import { formatRelative } from './utils.js'

/* Small building blocks for the right inspector rail and history list. */

export const IGPreview = memo(function IGPreview({ brandName, image, isCarousel, activeSlide, totalSlides }) {
  const displayName = brandName?.trim() || 'yourbrand'
  return (
    <div className="overflow-hidden rounded-lg border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
      <div className="flex items-center gap-2 px-3 py-2">
        <div className="flex-1 leading-tight">
          <p className="text-[12px] font-semibold uppercase tracking-[0.1em] text-slate-950 dark:text-slate-100">{displayName}</p>
          <p className="text-[10px] text-slate-500 dark:text-slate-400">Sponsored · Instagram</p>
        </div>
        <MoreHorizontal size={14} className="text-slate-500 dark:text-slate-400" />
      </div>
      <div className="relative aspect-square bg-slate-100 dark:bg-slate-800">
        {image ? (
          <img src={image} alt="preview" loading="lazy" decoding="async" className="h-full w-full object-cover" />
        ) : (
          <div className="grid h-full place-items-center text-slate-400 dark:text-slate-500"><ImagePlus size={24} /></div>
        )}
        {isCarousel && image && (
          <div className="absolute right-2 top-2 rounded bg-black/70 px-1.5 py-0.5 font-mono text-[9px] font-semibold text-white">{activeSlide + 1}/{totalSlides}</div>
        )}
      </div>
      <div className="px-3 py-2">
        <div className="mb-1 flex items-center justify-between text-slate-900 dark:text-slate-100">
          <div className="flex gap-3"><Heart size={16} /><MessageCircle size={16} /><Send size={16} /></div>
          <BookmarkPlus size={16} />
        </div>
        <p className="text-[11px] font-semibold dark:text-slate-100">{image ? '1,248 likes' : '— likes'}</p>
        <p className="mt-0.5 text-[11px] leading-5 text-slate-600 dark:text-slate-400">
          <span className="font-semibold uppercase tracking-wider text-slate-900 dark:text-slate-100">{displayName}</span>{' '}
          {image ? 'Ready to post ✨' : 'Belum ada hasil.'}
        </p>
      </div>
    </div>
  )
})

export const HistoryItem = memo(function HistoryItem({ item, onLoad, onDelete }) {
  return (
    <div className="group relative flex items-center gap-3 rounded-md border border-slate-200 bg-white p-2 transition hover:border-slate-300 hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900 dark:hover:border-slate-700 dark:hover:bg-slate-800/60">
      <div className="h-12 w-12 shrink-0 overflow-hidden rounded-md bg-slate-100 dark:bg-slate-800">
        {item.cover && <img src={item.cover} alt="" loading="lazy" className="h-full w-full object-cover" />}
      </div>
      <button type="button" onClick={() => onLoad(item)} className="min-w-0 flex-1 text-left">
        <p className="truncate text-[12px] font-medium text-slate-900 dark:text-slate-100">{item.topic || 'Tanpa judul'}</p>
        <p className="mt-0.5 flex items-center gap-1.5 text-[10px] text-slate-500 dark:text-slate-400">
          <span>{item.mode === 'carousel' ? `${item.slideCount}/${item.totalSlides} slides` : 'Single'}</span>
          <span>·</span>
          <span>{formatRelative(item.createdAt)}</span>
        </p>
      </button>
      <button
        type="button"
        onClick={() => onDelete(item.id)}
        className="opacity-0 transition group-hover:opacity-100"
        title="Hapus"
      >
        <Trash2 size={12} className="text-slate-400 hover:text-rose-500 dark:text-slate-500 dark:hover:text-rose-400" />
      </button>
    </div>
  )
})
