import { memo } from 'react'
import { ChevronLeft, Clock, Cpu, Maximize2, Minimize2, Search, ZoomIn, ZoomOut } from 'lucide-react'
import { Brand, Kbd } from '../common.jsx'
import { ThemeToggle } from '../theme.jsx'
import { UserMenu } from '../auth.jsx'
import { useElapsedSeconds } from './hooks.js'
import { formatMs } from './utils.js'

/* Desktop chrome: Titlebar, Toolbar, StatusBar. */

export const Titlebar = memo(function Titlebar({ onBack, onToggleFullscreen, isFullscreen, fileName, onOpenPalette }) {
  return (
    <div className="flex h-10 shrink-0 items-center gap-0 border-b border-slate-200 bg-white px-3 dark:border-slate-800 dark:bg-slate-950">
      <button
        onClick={onBack}
        className="shrink-0 flex items-center gap-1 rounded-md px-2 py-1 text-[12px] font-medium text-slate-600 transition hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-100"
        title="Back to landing"
      >
        <ChevronLeft size={13} /> Home
      </button>
      <div className="mx-2 h-4 w-px shrink-0 bg-slate-200 dark:bg-slate-700" />
      <div className="shrink-0"><Brand compact /></div>
      <span className="ml-2 shrink-0 text-[11px] text-slate-400 dark:text-slate-600">/</span>
      <span className="ml-2 min-w-0 flex-1 truncate text-[12px] font-medium text-slate-700 dark:text-slate-300">{fileName}</span>

      <div className="ml-2 flex shrink-0 items-center gap-1.5">
        <UserMenu compact />
        <ThemeToggle size="sm" />
        <button
          onClick={onOpenPalette}
          className="group hidden items-center gap-2 rounded-md border border-slate-200 bg-slate-50 px-2.5 py-1 text-[11.5px] text-slate-500 transition hover:border-slate-300 hover:bg-white hover:text-slate-900 md:flex dark:border-slate-700 dark:bg-slate-900 dark:text-slate-400 dark:hover:border-slate-600 dark:hover:bg-slate-800 dark:hover:text-slate-100"
        >
          <Search size={12} />
          <span>Quick actions</span>
          <span className="flex items-center gap-0.5">
            <Kbd>⌘</Kbd><Kbd>K</Kbd>
          </span>
        </button>
        <button
          onClick={onToggleFullscreen}
          className="grid h-7 w-7 place-items-center rounded-md text-slate-500 transition hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-100"
          title={isFullscreen ? 'Exit fullscreen' : 'Enter fullscreen'}
        >
          {isFullscreen ? <Minimize2 size={13} /> : <Maximize2 size={13} />}
        </button>
      </div>
    </div>
  )
})

export const Toolbar = memo(function Toolbar({
  loading, isCarousel, totalSlides, generatingSlide,
  zoom, onZoomIn, onZoomOut, onZoomReset,
}) {
  const elapsed = useElapsedSeconds(loading, generatingSlide)
  return (
    <div className="flex h-11 shrink-0 items-center gap-2 border-b border-slate-200 bg-white px-3 dark:border-slate-800 dark:bg-slate-950">
      <div className="flex min-w-0 flex-1 items-center gap-2 text-[12.5px] text-slate-600 dark:text-slate-300">
        {loading ? (
          <span className="flex min-w-0 items-center gap-2">
            <span className="relative flex h-2 w-2 shrink-0">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-amber-400 opacity-75" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-amber-500" />
            </span>
            <span className="truncate font-medium text-slate-900 dark:text-slate-100">
              {isCarousel
                ? (generatingSlide > 0 ? `Merender slide ${generatingSlide}/${totalSlides}` : 'Menyusun storyboard')
                : 'Merender feed'}
            </span>
            <span className="hidden shrink-0 items-center gap-1 rounded-md border border-slate-200 bg-slate-50 px-1.5 py-0.5 font-mono text-[10.5px] tabular-nums text-slate-600 md:inline-flex dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300">
              <Clock size={10} />
              {formatMs(elapsed)}
            </span>
            <span className="hidden shrink-0 text-slate-400 dark:text-slate-500 md:inline">— AI sedang bekerja</span>
          </span>
        ) : (
          <span className="flex min-w-0 items-center gap-2">
            <span className="h-2 w-2 shrink-0 rounded-full bg-emerald-500" />
            <span className="shrink-0 font-medium text-slate-900 dark:text-slate-100">Siap</span>
            <span className="truncate text-slate-400 dark:text-slate-500">— isi brief, lalu generate</span>
          </span>
        )}
      </div>

      <div className="ml-auto flex shrink-0 items-center gap-1">
        <button type="button" onClick={onZoomOut} className="grid h-7 w-7 place-items-center rounded-md border border-slate-200 bg-white text-slate-600 transition hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800" title="Zoom out"><ZoomOut size={13} /></button>
        <button type="button" onClick={onZoomReset} className="min-w-[52px] rounded-md border border-slate-200 bg-white px-2 py-1 text-[11px] font-mono text-slate-600 transition hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800" title="Reset zoom">{Math.round(zoom * 100)}%</button>
        <button type="button" onClick={onZoomIn} className="grid h-7 w-7 place-items-center rounded-md border border-slate-200 bg-white text-slate-600 transition hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800" title="Zoom in"><ZoomIn size={13} /></button>
      </div>
    </div>
  )
})

export const StatusBar = memo(function StatusBar({ loading, isCarousel, totalSlides, imagesCount, format, error, onOpenShortcuts, generatingSlide }) {
  const elapsed = useElapsedSeconds(loading, generatingSlide)
  return (
    <div className="flex h-7 shrink-0 items-center justify-between border-t border-slate-200 bg-slate-950 px-3 font-mono text-[10.5px] text-slate-400">
      <div className="flex items-center gap-4">
        <span className="flex items-center gap-1.5">
          <span className={`h-1.5 w-1.5 rounded-full ${loading ? 'bg-amber-400 animate-pulse' : error ? 'bg-rose-400' : 'bg-emerald-400'}`} />
          <span className="font-semibold tracking-wider text-slate-200">{loading ? 'BUSY' : error ? 'ERROR' : 'READY'}</span>
        </span>
        {loading && (
          <span className="flex items-center gap-1 tabular-nums text-slate-200">
            <Clock size={10} /> {formatMs(elapsed)}
          </span>
        )}
        <span className="hidden sm:inline">mode: <span className="text-slate-200">{isCarousel ? 'carousel' : 'single'}</span></span>
        <span className="hidden sm:inline">format: <span className="text-slate-200">{format}</span></span>
        <span className="hidden md:inline">slides: <span className="text-slate-200">{imagesCount}/{isCarousel ? totalSlides : 1}</span></span>
      </div>
      <div className="flex items-center gap-4">
        <button onClick={onOpenShortcuts} className="hidden items-center gap-1 transition hover:text-slate-200 md:flex">
          <kbd className="inline-flex min-h-[14px] min-w-[14px] items-center justify-center rounded border border-slate-700 bg-slate-800 px-1 text-[9px] font-semibold text-slate-300">?</kbd>
          shortcuts
        </button>
        <span className="flex items-center gap-1.5"><Cpu size={10} /> Studio v0.3.0</span>
      </div>
    </div>
  )
})
