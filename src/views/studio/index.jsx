import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  ChevronLeft, Command, Copy, History, Maximize2, RefreshCw, Sparkles, Target, Wand2,
} from 'lucide-react'
import { useStudioController } from '../../controllers/studioController.js'
import { useToast } from '../toast.jsx'
import { authedFetch, useAuth } from '../auth.jsx'
import { useIsMobile } from './hooks.js'
import { deriveStudioFileName } from './utils.js'
import { ShortcutsModal, CommandPalette } from './modals.jsx'
import DesktopStudio from './DesktopStudio.jsx'
import MobileStudio from './MobileStudio.jsx'

/**
 * Orchestrator for the Studio feature. Owns shared state, side effects, and
 * keyboard shortcuts. Delegates rendering to DesktopStudio or MobileStudio
 * based on viewport. Presentational components live in their own files so
 * this file stays focused on wiring.
 */
function StudioView({ onBack }) {
  const {
    form, images, activeSlide, prompt, loading, generatingSlide, error,
    canGenerate, isCarousel, update, generate, setActiveSlide,
    productUpload, referenceUploads, logoUpload,
    setProductUpload, setReferenceUploads, setLogoUpload, clearUploads,
  } = useStudioController()

  const [zoom, setZoom] = useState(1)
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [shortcutsOpen, setShortcutsOpen] = useState(false)
  const [paletteOpen, setPaletteOpen] = useState(false)
  const [inspectorTab, setInspectorTab] = useState('preview')
  const [history, setHistory] = useState([])
  const rootRef = useRef(null)
  const toast = useToast()
  const { isAuthed, openLogin } = useAuth()
  const isMobile = useIsMobile()

  /* ---------- setters: stable callbacks per field ---------- */
  const setMode = useCallback((v) => update('mode', v), [update])
  const setFormat = useCallback((v) => update('format', v), [update])
  const setTotalSlides = useCallback((v) => update('totalSlides', Number(v)), [update])
  const setBrandName = useCallback((v) => update('brandName', v), [update])
  const setTopic = useCallback((v) => update('topic', v), [update])
  const setColorPalette = useCallback((v) => update('colorPalette', v), [update])
  const setAudience = useCallback((v) => update('audience', v), [update])
  const setCaptionTone = useCallback((v) => update('captionTone', v), [update])
  const setExtraNotes = useCallback((v) => update('extraNotes', v), [update])

  const reset = useCallback(() => {
    ['brandName', 'topic', 'colorPalette', 'extraNotes'].forEach((k) => update(k, ''))
    clearUploads()
    toast.info('Brief direset')
  }, [update, toast, clearUploads])

  const pickTemplate = useCallback((t) => {
    update('topic', t.topic)
    if (t.brand) update('brandName', t.brand)
    toast.success(`Template "${t.label}" dimuat`)
  }, [update, toast])

  /* ---------- zoom + fullscreen ---------- */
  const zoomIn = useCallback(() => setZoom((z) => Math.min(z + 0.1, 2)), [])
  const zoomOut = useCallback(() => setZoom((z) => Math.max(z - 0.1, 0.4)), [])
  const zoomReset = useCallback(() => setZoom(1), [])

  const toggleFullscreen = useCallback(async () => {
    try {
      if (document.fullscreenElement) await document.exitFullscreen()
      else if (rootRef.current?.requestFullscreen) await rootRef.current.requestFullscreen()
    } catch { /* ignore */ }
  }, [])

  useEffect(() => {
    const onChange = () => setIsFullscreen(Boolean(document.fullscreenElement))
    document.addEventListener('fullscreenchange', onChange)
    return () => document.removeEventListener('fullscreenchange', onChange)
  }, [])

  /* ---------- carousel nav ---------- */
  const prevSlide = useCallback(() => setActiveSlide(Math.max(0, activeSlide - 1)), [activeSlide, setActiveSlide])
  const nextSlide = useCallback(() => setActiveSlide(Math.min(images.length - 1, activeSlide + 1)), [activeSlide, images.length, setActiveSlide])

  /* ---------- history (server-backed) ---------- */
  const refreshHistory = useCallback(async () => {
    if (!isAuthed) { setHistory([]); return }
    try {
      const res = await authedFetch('/api/generations?limit=30')
      if (!res.ok) return
      const data = await res.json()
      const items = Array.isArray(data.items) ? data.items : []
      setHistory(items.map((it) => ({
        id: it.id,
        topic: it.topic,
        brandName: it.brandName,
        mode: it.mode,
        slideCount: it.slideCount,
        totalSlides: it.totalSlides,
        createdAt: it.createdAt,
        cover: `/api/images/${it.id}-01.webp`,
      })))
    } catch { /* offline ok */ }
  }, [isAuthed])

  useEffect(() => { refreshHistory() }, [refreshHistory])
  useEffect(() => { if (!loading && images.length) refreshHistory() }, [loading, images.length, refreshHistory])

  /* ---------- auto-load a generation's brief from sessionStorage ----------
   * Dashboard sets this key when the user clicks "Load ke Studio". We clear
   * it immediately after consuming so refreshing Studio doesn't re-trigger.
   */
  useEffect(() => {
    if (!isAuthed) return
    let id
    try { id = sessionStorage.getItem('feeddesigner:load-generation') } catch { return }
    if (!id) return
    try { sessionStorage.removeItem('feeddesigner:load-generation') } catch { /* ignore */ }
    authedFetch(`/api/generations/${id}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (!data) return
        if (data.brandName) update('brandName', data.brandName)
        if (data.topic) update('topic', data.topic)
        if (data.palette) update('colorPalette', data.palette)
        if (data.format) update('format', data.format)
        if (data.audience) update('audience', data.audience)
        if (data.tone) update('captionTone', data.tone)
        if (data.extraNotes) update('extraNotes', data.extraNotes)
        if (data.mode) update('mode', data.mode)
        if (data.totalSlides) update('totalSlides', data.totalSlides)
        toast.success('Brief dimuat dari dashboard')
      })
      .catch(() => { /* silent */ })
  }, [isAuthed, update, toast])

  const loadHistory = useCallback(async (item) => {
    try {
      const res = await authedFetch(`/api/generations/${item.id}`)
      if (!res.ok) return
      const data = await res.json()
      if (data.brandName) update('brandName', data.brandName)
      if (data.topic) update('topic', data.topic)
      if (data.palette) update('colorPalette', data.palette)
      if (data.format) update('format', data.format)
      if (data.audience) update('audience', data.audience)
      if (data.tone) update('captionTone', data.tone)
      if (data.extraNotes) update('extraNotes', data.extraNotes)
      if (data.mode) update('mode', data.mode)
      if (data.totalSlides) update('totalSlides', data.totalSlides)
      toast.success('Brief dari riwayat dimuat')
    } catch {
      toast.error('Gagal memuat riwayat')
    }
  }, [update, toast])

  const deleteHistory = useCallback(async (id) => {
    try {
      const res = await authedFetch(`/api/generations/${id}`, { method: 'DELETE' })
      if (res.ok) {
        setHistory((h) => h.filter((x) => x.id !== id))
        toast.success('Riwayat dihapus')
      } else {
        toast.error('Gagal menghapus riwayat')
      }
    } catch { toast.error('Gagal menghapus riwayat') }
  }, [toast])

  /* ---------- generate lifecycle toasts ---------- */
  const prevLoadingRef = useRef(false)
  const prevErrorRef = useRef('')
  const lastImageCountRef = useRef(0)
  useEffect(() => {
    if (error && error !== prevErrorRef.current) {
      toast.error(error, { title: 'Generate gagal' })
    }
    prevErrorRef.current = error
  }, [error, toast])
  useEffect(() => {
    const wasLoading = prevLoadingRef.current
    prevLoadingRef.current = loading
    if (wasLoading && !loading && images.length > lastImageCountRef.current && !error) {
      toast.success(
        isCarousel ? `Carousel ${images.length} slide selesai dibuat` : 'Desain feed selesai dibuat',
        { title: 'Selesai' },
      )
    }
    lastImageCountRef.current = images.length
  }, [loading, images.length, isCarousel, error, toast])

  /* ---------- clipboard ---------- */
  const copyPrompt = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(prompt)
      toast.success('Prompt disalin ke clipboard')
    } catch { toast.error('Gagal menyalin prompt') }
  }, [prompt, toast])

  /* ---------- keyboard shortcuts ---------- */
  useEffect(() => {
    const handler = (e) => {
      const meta = e.metaKey || e.ctrlKey
      const tag = e.target?.tagName
      const inInput = tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT'

      if (meta && e.key.toLowerCase() === 'k') { e.preventDefault(); setPaletteOpen((v) => !v); return }
      if (e.key === 'Escape' && paletteOpen) { setPaletteOpen(false); return }
      if (e.key === 'Escape' && shortcutsOpen) { setShortcutsOpen(false); return }
      if (meta && e.key === 'Enter' && canGenerate) { e.preventDefault(); generate(); return }
      if (meta && (e.key === '=' || e.key === '+')) { e.preventDefault(); zoomIn(); return }
      if (meta && e.key === '-') { e.preventDefault(); zoomOut(); return }
      if (meta && e.key === '0') { e.preventDefault(); zoomReset(); return }
      if (!inInput && e.key === '?') { e.preventDefault(); setShortcutsOpen((v) => !v); return }
      if (!inInput && e.key === 'ArrowLeft' && activeSlide > 0) setActiveSlide(activeSlide - 1)
      if (!inInput && e.key === 'ArrowRight' && activeSlide < images.length - 1) setActiveSlide(activeSlide + 1)
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [canGenerate, generate, zoomIn, zoomOut, zoomReset, activeSlide, images.length, setActiveSlide, paletteOpen, shortcutsOpen])

  const fileName = useMemo(() => deriveStudioFileName(form.topic, isCarousel), [form.topic, isCarousel])

  /* ---------- command palette actions ---------- */
  const actions = useMemo(() => [
    { label: 'Generate desain', icon: Wand2, hint: 'Render brief saat ini', keys: ['⌘', '↵'], disabled: !canGenerate, run: () => generate() },
    { label: 'Reset brief', icon: RefreshCw, hint: 'Kosongkan form', run: reset },
    { label: 'Buka history', icon: History, hint: 'Lihat generate sebelumnya', run: () => setInspectorTab('history') },
    { label: 'Buka IG preview', icon: Sparkles, hint: 'Lihat hasil seperti postingan', run: () => setInspectorTab('preview') },
    { label: 'Copy prompt', icon: Copy, hint: 'Salin prompt terakhir', disabled: !prompt, run: copyPrompt },
    { label: 'Toggle fullscreen', icon: Maximize2, run: toggleFullscreen },
    { label: 'Zoom reset', icon: Target, keys: ['⌘', '0'], run: zoomReset },
    { label: 'Keyboard shortcuts', icon: Command, keys: ['?'], run: () => setShortcutsOpen(true) },
    { label: 'Kembali ke Landing', icon: ChevronLeft, run: onBack },
  ], [canGenerate, generate, reset, prompt, copyPrompt, toggleFullscreen, zoomReset, onBack])

  /* ---------- shared props shape ---------- */
  const sharedProps = {
    form, images, activeSlide, prompt, loading, generatingSlide, error,
    canGenerate, isCarousel, setActiveSlide,
    generate, reset, copyPrompt, pickTemplate, prevSlide, nextSlide,
    onBack, fileName,
    isAuthed, openLogin,
    history, refreshHistory, loadHistory, deleteHistory,
    productUpload, referenceUploads, logoUpload,
    setProductUpload, setReferenceUploads, setLogoUpload,
    setMode, setFormat, setTotalSlides, setBrandName, setTopic, setColorPalette,
    setAudience, setCaptionTone, setExtraNotes,
  }

  return (
    <div
      ref={rootRef}
      className="flex h-[100dvh] w-full flex-col overflow-hidden bg-slate-100 text-slate-950 antialiased [font-feature-settings:'cv11','ss01'] dark:bg-slate-900 dark:text-slate-100"
    >
      {isMobile ? (
        <MobileStudio {...sharedProps} />
      ) : (
        <DesktopStudio
          {...sharedProps}
          toggleFullscreen={toggleFullscreen}
          isFullscreen={isFullscreen}
          onOpenPalette={() => setPaletteOpen(true)}
          onOpenShortcuts={() => setShortcutsOpen(true)}
          zoom={zoom}
          zoomIn={zoomIn}
          zoomOut={zoomOut}
          zoomReset={zoomReset}
          inspectorTab={inspectorTab}
          setInspectorTab={setInspectorTab}
        />
      )}

      <ShortcutsModal open={shortcutsOpen} onClose={() => setShortcutsOpen(false)} />
      <CommandPalette open={paletteOpen} onClose={() => setPaletteOpen(false)} actions={actions} />
    </div>
  )
}

export default memo(StudioView)
