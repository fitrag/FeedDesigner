import { memo, useCallback, useEffect, useRef, useState } from 'react'
import {
  ChevronLeft, Clock, Copy, Cpu, FileText, History, Image as ImageIcon, ImagePlus,
  Languages, Layers, MoreHorizontal, Palette, Pencil, RefreshCw, Settings2, Share2, Square,
  StopCircle, Target, Type, Wand2, X,
} from 'lucide-react'
import { ThemeToggle } from '../theme.jsx'
import { UserMenu } from '../auth.jsx'
import { formats, languages, modeOptions, slideCountOptions } from '../../models/feedDesignerModel.js'
import { Field, Section, Select, SegmentedControl, Textarea } from './primitives.jsx'
import { Canvas, Filmstrip } from './canvas.jsx'
import { HistoryItem } from './inspector.jsx'
import { UploadsGroup } from './uploads.jsx'
import { QUICK_TEMPLATES } from './constants.js'

/**
 * Mobile layout: sticky header, tab content, bottom tab nav, FAB.
 * Takes the same state props as desktop — it's a presentational component.
 */
export default function MobileStudio({
  form, images, slideStatus, failedSlides, activeSlide, prompt, loading, generatingSlide,
  canGenerate, isCarousel, setActiveSlide, generate, retrySlide, retryFailed, reset, fileName,
  history, refreshHistory, loadHistory, deleteHistory, copyPrompt, pickTemplate,
  prevSlide, nextSlide, onBack,
  isAuthed, openLogin,
  productUpload, referenceUploads, logoUpload,
  setProductUpload, setReferenceUploads, setLogoUpload,
  setMode, setFormat, setTotalSlides, setBrandName, setTopic, setColorPalette,
  setAudience, setCaptionTone, setExtraNotes, setLanguage,
}) {
  const [tab, setTab] = useState('brief')
  const [sheetOpen, setSheetOpen] = useState(false)
  const touchStartX = useRef(null)
  const touchStartY = useRef(null)

  // Auto-switch to canvas when a new generation starts.
  const wasLoadingRef = useRef(false)
  useEffect(() => {
    if (loading && !wasLoadingRef.current) setTab('canvas')
    wasLoadingRef.current = loading
  }, [loading])

  const onCanvasTouchStart = useCallback((e) => {
    if (e.touches.length !== 1) return
    touchStartX.current = e.touches[0].clientX
    touchStartY.current = e.touches[0].clientY
  }, [])
  const onCanvasTouchEnd = useCallback((e) => {
    const sx = touchStartX.current
    const sy = touchStartY.current
    touchStartX.current = null
    touchStartY.current = null
    if (sx == null) return
    const dx = (e.changedTouches[0]?.clientX ?? sx) - sx
    const dy = Math.abs((e.changedTouches[0]?.clientY ?? sy) - sy)
    if (Math.abs(dx) < 40 || dy > 60) return
    if (dx < 0) nextSlide()
    else prevSlide()
  }, [nextSlide, prevSlide])

  const topicOk = form.topic.trim().length > 0

  return (
    <>
      {/* Sticky header */}
      <header className="sticky top-0 z-30 flex h-12 shrink-0 items-center gap-2 border-b border-slate-200 bg-white/95 px-3 backdrop-blur supports-[backdrop-filter]:bg-white/75 dark:border-slate-800 dark:bg-slate-950/95 dark:supports-[backdrop-filter]:bg-slate-950/75">
        <button
          onClick={onBack}
          className="grid h-9 w-9 place-items-center rounded-md text-slate-600 transition hover:bg-slate-100 active:bg-slate-200 dark:text-slate-300 dark:hover:bg-slate-800 dark:active:bg-slate-700"
          aria-label="Kembali"
        >
          <ChevronLeft size={18} />
        </button>
        <div className="min-w-0 flex-1">
          <p className="truncate text-[14px] font-semibold leading-tight text-slate-900 dark:text-slate-100">Studio</p>
          <p className="truncate text-[10.5px] leading-tight text-slate-500 dark:text-slate-400">{fileName}</p>
        </div>
        <div className="flex items-center gap-1">
          <UserMenu compact />
          <button
            type="button"
            onClick={() => setSheetOpen(true)}
            className="grid h-9 w-9 place-items-center rounded-md text-slate-600 transition hover:bg-slate-100 active:bg-slate-200 dark:text-slate-300 dark:hover:bg-slate-800 dark:active:bg-slate-700"
            aria-label="Menu"
          >
            <MoreHorizontal size={18} />
          </button>
        </div>
      </header>

      <main className="relative flex min-h-0 flex-1 flex-col overflow-hidden bg-slate-50 dark:bg-slate-900">
        {tab === 'brief' && (
          <BriefTab
            form={form}
            loading={loading}
            isCarousel={isCarousel}
            topicOk={topicOk}
            generate={generate}
            reset={reset}
            pickTemplate={pickTemplate}
            productUpload={productUpload}
            referenceUploads={referenceUploads}
            logoUpload={logoUpload}
            setProductUpload={setProductUpload}
            setReferenceUploads={setReferenceUploads}
            setLogoUpload={setLogoUpload}
            setMode={setMode}
            setFormat={setFormat}
            setTotalSlides={setTotalSlides}
            setBrandName={setBrandName}
            setTopic={setTopic}
            setColorPalette={setColorPalette}
            setAudience={setAudience}
            setCaptionTone={setCaptionTone}
            setExtraNotes={setExtraNotes}
            setLanguage={setLanguage}
          />
        )}

        {tab === 'canvas' && (
          <div
            className="flex min-h-0 flex-1 flex-col"
            onTouchStart={onCanvasTouchStart}
            onTouchEnd={onCanvasTouchEnd}
          >
            <div className="flex-1 min-h-0">
              <Canvas
                images={images}
                slideStatus={slideStatus}
                activeSlide={activeSlide}
                loading={loading}
                isCarousel={isCarousel}
                generatingSlide={generatingSlide}
                totalSlides={form.totalSlides}
                zoom={1}
                format={form.format}
                onPickTemplate={pickTemplate}
                onPrev={prevSlide}
                onNext={nextSlide}
                onRetrySlide={retrySlide}
              />
            </div>
            {(isCarousel || images.length > 0) && (
              <Filmstrip
                images={images}
                slideStatus={slideStatus}
                failedSlides={failedSlides}
                activeSlide={activeSlide}
                setActiveSlide={setActiveSlide}
                totalSlides={form.totalSlides}
                isCarousel={isCarousel}
                loading={loading}
                generatingSlide={generatingSlide}
                topic={form.topic}
                brand={form.brandName}
                onRetrySlide={retrySlide}
                onRetryAllFailed={retryFailed}
              />
            )}
          </div>
        )}

        {tab === 'history' && (
          <HistoryTab
            isAuthed={isAuthed}
            openLogin={openLogin}
            history={history}
            refreshHistory={refreshHistory}
            loadHistory={(it) => { loadHistory(it); setTab('brief') }}
            deleteHistory={deleteHistory}
          />
        )}

        {tab === 'account' && (
          <AccountTab prompt={prompt} copyPrompt={copyPrompt} />
        )}

        {/* "Still rendering" floating pill when not on canvas */}
        {loading && tab !== 'canvas' && (
          <button
            type="button"
            onClick={() => setTab('canvas')}
            className="pointer-events-auto absolute left-1/2 top-3 z-20 flex -translate-x-1/2 items-center gap-2 rounded-full border border-slate-200 bg-white/95 px-3 py-1.5 text-[11.5px] font-medium text-slate-700 shadow-md backdrop-blur active:bg-slate-50 dark:border-slate-700 dark:bg-slate-900/95 dark:text-slate-200"
          >
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-amber-400 opacity-75" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-amber-500" />
            </span>
            Sedang render · ketuk untuk lihat
          </button>
        )}
      </main>

      {/* Generate action bar — sibling of main so it takes its own layout slot.
       * Previously this was a floating FAB with position:absolute, which
       * covered form fields at the bottom of the brief. Putting it in the
       * document flow right above BottomNav means content always has clear
       * breathing room below and the button stays pinned anyway. */}
      {(tab === 'brief' || tab === 'canvas') && (
        <div className="shrink-0 border-t border-slate-200 bg-white/95 px-3 py-2 backdrop-blur supports-[backdrop-filter]:bg-white/80 dark:border-slate-800 dark:bg-slate-950/95 dark:supports-[backdrop-filter]:bg-slate-950/80">
          {loading ? (
            <button
              type="button"
              onClick={generate}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-rose-600 px-4 py-3 text-[14px] font-semibold text-white shadow-[0_6px_18px_-8px_rgba(190,18,60,0.6)] active:bg-rose-700"
            >
              <StopCircle size={16} /> Stop generate
            </button>
          ) : (
            <button
              type="submit"
              form="studio-form"
              onClick={(e) => { if (tab === 'canvas') { e.preventDefault(); generate() } }}
              disabled={!canGenerate}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-slate-950 px-4 py-3 text-[14px] font-semibold text-white shadow-[0_6px_18px_-8px_rgba(15,23,42,0.6)] active:bg-slate-800 disabled:bg-slate-300 disabled:shadow-none dark:bg-white dark:text-slate-950 dark:shadow-[0_6px_18px_-8px_rgba(0,0,0,0.8)] dark:active:bg-slate-200 dark:disabled:bg-slate-800 dark:disabled:text-slate-500"
            >
              <Wand2 size={16} />
              Generate {isCarousel ? 'carousel' : 'feed'}
            </button>
          )}
        </div>
      )}

      {/* Bottom tab nav */}
      <BottomNav tab={tab} setTab={setTab} historyCount={history.length} />

      {/* More actions sheet */}
      {sheetOpen && (
        <MoreSheet
          onClose={() => setSheetOpen(false)}
          reset={reset}
          copyPrompt={copyPrompt}
          loading={loading}
          hasPrompt={Boolean(prompt)}
        />
      )}
    </>
  )
}

/* =================== tab panes =================== */

const BriefTab = memo(function BriefTab({
  form, loading, isCarousel, topicOk, generate, reset, pickTemplate,
  productUpload, referenceUploads, logoUpload,
  setProductUpload, setReferenceUploads, setLogoUpload,
  setMode, setFormat, setTotalSlides, setBrandName, setTopic, setColorPalette,
  setAudience, setCaptionTone, setExtraNotes, setLanguage,
}) {
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <form id="studio-form" onSubmit={generate} className="min-h-0 flex-1 overflow-y-auto pb-6">
        <div className="border-b border-slate-200 bg-white px-4 py-5 dark:border-slate-800 dark:bg-slate-950">
          <label className="block">
            <span className="mb-1.5 flex items-center gap-1 text-[11px] font-semibold uppercase tracking-[0.1em] text-slate-500 dark:text-slate-400">
              <Target size={11} /> Topik utama
            </span>
            <textarea
              rows={2}
              value={form.topic}
              onChange={(e) => setTopic(e.target.value)}
              placeholder="cth: promo kopi susu diskon 30%"
              className="w-full resize-none rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 text-[15px] text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-slate-900 focus:bg-white focus:ring-2 focus:ring-slate-900/10 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:placeholder:text-slate-500 dark:focus:border-slate-100 dark:focus:bg-slate-950 dark:focus:ring-slate-100/10"
            />
            <p className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">AI menentukan gaya visual dari topik ini.</p>
          </label>

          <div className="mt-4 grid grid-cols-2 gap-2">
            <SegmentedControl
              value={form.mode}
              onChange={setMode}
              options={modeOptions}
              icons={{ single: Square, carousel: Layers }}
            />
            {isCarousel ? (
              <Select label={undefined} value={String(form.totalSlides)} onChange={setTotalSlides} options={slideCountOptions} />
            ) : (
              <Select label={undefined} value={form.format} onChange={setFormat} options={formats} />
            )}
          </div>
        </div>

        <Section icon={Palette} title="Brand" collapsible id="mobile-brand" defaultOpen>
          <Field label="Nama brand" value={form.brandName} onChange={setBrandName} placeholder="Kopi Senja" optional />
          <Field label="Palette warna" value={form.colorPalette} onChange={setColorPalette} placeholder="navy, cream, gold" hint="Kosongkan agar AI memilih palette." optional />
        </Section>

        <Section icon={ImagePlus} title="Upload (opsional)" collapsible id="mobile-upload" defaultOpen={false}>
          <UploadsGroup
            product={productUpload}
            references={referenceUploads}
            logo={logoUpload}
            onChangeProduct={setProductUpload}
            onChangeReferences={setReferenceUploads}
            onChangeLogo={setLogoUpload}
          />
        </Section>

        {isCarousel && (
          <Section icon={Type} title="Format kanvas" collapsible id="mobile-format" defaultOpen={false}>
            <Select label="Ukuran kanvas" value={form.format} onChange={setFormat} options={formats} />
          </Section>
        )}

        <Section icon={Languages} title="Bahasa" collapsible id="mobile-language" defaultOpen={false}>
          <label className="block">
            <span className="mb-1.5 flex items-center justify-between text-[11px] font-medium uppercase tracking-[0.08em] text-slate-500 dark:text-slate-400">
              Bahasa hasil desain
            </span>
            <select
              value={form.language || 'Indonesian'}
              onChange={(e) => setLanguage(e.target.value)}
              className="w-full appearance-none rounded-md border border-slate-200 bg-white px-3 py-2 pr-8 text-[13px] text-slate-900 outline-none transition focus:border-slate-900 focus:ring-2 focus:ring-slate-900/10 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:focus:border-slate-100 dark:focus:ring-slate-100/10"
            >
              {languages.map((l) => (
                <option key={l.value} value={l.value}>{l.label}</option>
              ))}
            </select>
            <span className="mt-1 block text-[11px] leading-4 text-slate-500 dark:text-slate-400">
              Teks di dalam desain akan di-render dalam bahasa ini.
            </span>
          </label>
        </Section>

        <Section icon={Settings2} title="Opsional" collapsible id="mobile-optional" defaultOpen={false}>
          <Field label="Target audiens" value={form.audience} onChange={setAudience} placeholder="mahasiswa, ibu muda, UMKM" optional />
          <Field label="Tone copy" value={form.captionTone} onChange={setCaptionTone} placeholder="friendly, profesional" optional />
          <Textarea label="Catatan" value={form.extraNotes} onChange={setExtraNotes} placeholder="tonjolkan texture produk" optional rows={3} />
        </Section>

        <div className="border-b border-slate-200 bg-white px-4 py-4 dark:border-slate-800 dark:bg-slate-950">
          <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.1em] text-slate-500 dark:text-slate-400">Template cepat</p>
          <div className="flex flex-wrap gap-2">
            {QUICK_TEMPLATES.map((t) => (
              <button
                key={t.label}
                type="button"
                onClick={() => pickTemplate(t)}
                className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-[12px] font-medium text-slate-700 active:bg-slate-200 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:active:bg-slate-800"
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>

        <div className="flex items-center justify-between px-4 py-3">
          <button type="button" onClick={reset} disabled={loading} className="inline-flex items-center gap-1.5 text-[12px] font-medium text-slate-600 active:text-slate-900 disabled:opacity-40 dark:text-slate-400 dark:active:text-slate-100">
            <RefreshCw size={12} /> Reset brief
          </button>
          <span className="text-[11px] text-slate-500 dark:text-slate-400">
            {topicOk ? <span className="text-emerald-600 dark:text-emerald-400">✓ Topik lengkap</span> : 'Topik belum diisi'}
          </span>
        </div>
      </form>
    </div>
  )
})

const HistoryTab = memo(function HistoryTab({ isAuthed, openLogin, history, refreshHistory, loadHistory, deleteHistory }) {
  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-y-auto pb-[96px]">
      <div className="flex items-center justify-between border-b border-slate-200 bg-white px-4 py-3 dark:border-slate-800 dark:bg-slate-950">
        <p className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.1em] text-slate-500 dark:text-slate-400">
          <Clock size={12} /> Riwayat
        </p>
        <button onClick={refreshHistory} className="grid h-7 w-7 place-items-center rounded-md text-slate-500 active:bg-slate-100 dark:text-slate-400 dark:active:bg-slate-800" aria-label="Refresh">
          <RefreshCw size={13} />
        </button>
      </div>
      <div className="flex-1 space-y-1.5 p-3">
        {!isAuthed ? (
          <div className="px-2 py-14 text-center">
            <div className="mx-auto mb-3 grid h-12 w-12 place-items-center rounded-full bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400">
              <History size={16} />
            </div>
            <p className="text-[14px] font-medium text-slate-900 dark:text-slate-100">Masuk untuk lihat riwayat</p>
            <p className="mx-auto mt-1 max-w-[250px] text-[12.5px] leading-5 text-slate-500 dark:text-slate-400">
              Riwayat generate disimpan per akun supaya data kamu tidak bercampur.
            </p>
            <button
              type="button"
              onClick={openLogin}
              className="mt-4 inline-flex items-center gap-1.5 rounded-md bg-slate-950 px-4 py-2 text-[13px] font-semibold text-white active:bg-slate-800 dark:bg-white dark:text-slate-950 dark:active:bg-slate-200"
            >
              Masuk sekarang
            </button>
          </div>
        ) : history.length === 0 ? (
          <p className="px-2 py-12 text-center text-[13px] text-slate-500 dark:text-slate-400">
            Belum ada riwayat. Generate pertama kamu akan muncul di sini.
          </p>
        ) : (
          history.map((it) => (
            <HistoryItem key={it.id} item={it} onLoad={loadHistory} onDelete={deleteHistory} />
          ))
        )}
      </div>
    </div>
  )
})

const AccountTab = memo(function AccountTab({ prompt, copyPrompt }) {
  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-y-auto pb-[96px]">
      <div className="border-b border-slate-200 bg-white px-4 py-5 dark:border-slate-800 dark:bg-slate-950">
        <p className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.1em] text-slate-500 dark:text-slate-400">
          <Settings2 size={12} /> Preferensi
        </p>
        <div className="mt-3 flex items-center justify-between rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 dark:border-slate-700 dark:bg-slate-900">
          <p className="text-[13px] font-medium text-slate-900 dark:text-slate-100">Tema tampilan</p>
          <ThemeToggle size="sm" />
        </div>
      </div>

      <div className="border-b border-slate-200 bg-white px-4 py-5 dark:border-slate-800 dark:bg-slate-950">
        <p className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.1em] text-slate-500 dark:text-slate-400">
          <Cpu size={12} /> Akun
        </p>
        <div className="mt-3"><UserMenu /></div>
        <p className="mt-3 text-[11.5px] leading-5 text-slate-500 dark:text-slate-400">
          Login agar riwayat generate tersimpan dan bisa diakses di perangkat lain.
        </p>
      </div>

      {prompt && (
        <div className="px-4 py-5">
          <div className="mb-2 flex items-center justify-between">
            <p className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.1em] text-slate-500 dark:text-slate-400">
              <FileText size={12} /> Prompt log
            </p>
            <button onClick={copyPrompt} className="inline-flex items-center gap-1 rounded-md border border-slate-200 bg-white px-2 py-1 text-[11px] font-medium text-slate-700 active:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300">
              <Copy size={11} /> Copy
            </button>
          </div>
          <pre className="max-h-64 overflow-y-auto whitespace-pre-wrap break-words rounded-lg border border-slate-200 bg-slate-50 p-3 font-mono text-[10.5px] leading-5 text-slate-600 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-400">
            {prompt}
          </pre>
        </div>
      )}

      <div className="px-4 py-5 text-center text-[10.5px] text-slate-400 dark:text-slate-600">
        FeedDesigner Studio v0.3.0
      </div>
    </div>
  )
})

/* =================== bottom nav + sheet =================== */

const MOBILE_TABS = [
  { key: 'brief', label: 'Brief', icon: Pencil },
  { key: 'canvas', label: 'Canvas', icon: ImageIcon },
  { key: 'history', label: 'Riwayat', icon: History, badgeKey: 'historyCount' },
  { key: 'account', label: 'Akun', icon: Settings2 },
]

const BottomNav = memo(function BottomNav({ tab, setTab, historyCount }) {
  return (
    <nav className="shrink-0 border-t border-slate-200 bg-white/95 pb-[env(safe-area-inset-bottom)] backdrop-blur supports-[backdrop-filter]:bg-white/80 dark:border-slate-800 dark:bg-slate-950/95 dark:supports-[backdrop-filter]:bg-slate-950/80">
      <div className="grid grid-cols-4">
        {MOBILE_TABS.map((t) => {
          const active = tab === t.key
          const badge = t.badgeKey === 'historyCount' ? historyCount : null
          return (
            <button
              key={t.key}
              type="button"
              onClick={() => setTab(t.key)}
              className={`relative flex flex-col items-center justify-center gap-1 py-2.5 text-[10.5px] font-medium transition ${
                active ? 'text-slate-900 dark:text-slate-100' : 'text-slate-400 active:text-slate-700 dark:text-slate-500 dark:active:text-slate-200'
              }`}
            >
              <div className="relative">
                <t.icon size={18} strokeWidth={active ? 2.2 : 1.7} />
                {typeof badge === 'number' && badge > 0 && (
                  <span className="absolute -right-2 -top-1 grid h-3.5 min-w-[14px] place-items-center rounded-full bg-slate-900 px-1 text-[9px] font-bold text-white dark:bg-white dark:text-slate-900">{badge}</span>
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

const MoreSheet = memo(function MoreSheet({ onClose, reset, copyPrompt, loading, hasPrompt }) {
  return (
    <div className="fixed inset-0 z-40 bg-slate-950/50 backdrop-blur-sm" onClick={onClose}>
      <div
        className="absolute inset-x-0 bottom-0 rounded-t-2xl border-t border-slate-200 bg-white pb-[env(safe-area-inset-bottom)] dark:border-slate-800 dark:bg-slate-950"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mx-auto mt-2 h-1 w-10 rounded-full bg-slate-300 dark:bg-slate-700" />
        <div className="p-4">
          <p className="mb-3 text-[11px] font-semibold uppercase tracking-[0.1em] text-slate-500 dark:text-slate-400">Aksi</p>
          <div className="space-y-1">
            <SheetItem icon={RefreshCw} label="Reset brief" onClick={() => { reset(); onClose() }} disabled={loading} />
            <SheetItem icon={Copy} label="Copy prompt" onClick={() => { copyPrompt(); onClose() }} disabled={!hasPrompt} />
            <SheetItem icon={Share2} label="Share link" onClick={async () => {
              try {
                if (navigator.share) await navigator.share({ title: 'FeedDesigner', url: window.location.origin })
              } catch { /* ignore */ }
              onClose()
            }} />
            <SheetItem icon={X} label="Tutup" onClick={onClose} muted />
          </div>
        </div>
      </div>
    </div>
  )
})

const SheetItem = memo(function SheetItem({ icon: Icon, label, onClick, disabled, muted }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-[13.5px] transition active:bg-slate-100 disabled:opacity-40 dark:active:bg-slate-800 ${muted ? 'text-slate-500 dark:text-slate-400' : 'text-slate-900 dark:text-slate-100'}`}
    >
      <span className={`grid h-8 w-8 place-items-center rounded-md ${muted ? 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400' : 'bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900'}`}>
        <Icon size={14} />
      </span>
      {label}
    </button>
  )
})
