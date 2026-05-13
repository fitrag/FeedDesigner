import { Clock, Copy, Download, FileText, History, Info, ImagePlus, Layers, Languages, Palette, RefreshCw,
  Rocket, Settings2, Sparkles, Square, StopCircle, Target, Type, Wand2,
} from 'lucide-react'
import { Kbd } from '../common.jsx'
import { formats, languages, modeOptions, slideCountOptions } from '../../models/feedDesignerModel.js'
import { Field, Section, Select, SegmentedControl, Textarea } from './primitives.jsx'
import { Titlebar, Toolbar, StatusBar } from './chrome.jsx'
import { Canvas, Filmstrip } from './canvas.jsx'
import { HistoryItem, IGPreview } from './inspector.jsx'
import { UploadsGroup } from './uploads.jsx'
import { buildDownloadName, toPngDownloadUrl } from './utils.js'

/**
 * Desktop 3-panel layout:
 *  - Left: Brief form + sticky generate button
 *  - Center: Canvas + filmstrip
 *  - Right: Inspector tabs (preview / history / export)
 *
 * All state lives in the parent `StudioView`; this component is purely
 * presentational to keep it easy to reason about and test.
 */
export default function DesktopStudio({
  // form + results
  form, images, slideStatus, failedSlides, activeSlide, prompt, loading, generatingSlide, error,
  canGenerate, isCarousel, setActiveSlide,
  // actions
  generate, retrySlide, retryFailed, reset, copyPrompt, pickTemplate, prevSlide, nextSlide,
  // nav / chrome
  onBack, toggleFullscreen, isFullscreen, fileName, onOpenPalette,
  onOpenShortcuts,
  // zoom
  zoom, zoomIn, zoomOut, zoomReset,
  // inspector
  inspectorTab, setInspectorTab, history, refreshHistory, loadHistory, deleteHistory,
  // uploads
  productUpload, referenceUploads, logoUpload,
  setProductUpload, setReferenceUploads, setLogoUpload,
  // auth
  isAuthed, openLogin,
  // setters
  setMode, setFormat, setTotalSlides, setBrandName, setTopic, setColorPalette,
  setAudience, setCaptionTone, setExtraNotes, setLanguage,
}) {
  return (
    <>
      <Titlebar
        onBack={onBack}
        onToggleFullscreen={toggleFullscreen}
        isFullscreen={isFullscreen}
        fileName={fileName}
        onOpenPalette={onOpenPalette}
      />
      <Toolbar
        loading={loading}
        isCarousel={isCarousel}
        totalSlides={form.totalSlides}
        generatingSlide={generatingSlide}
        zoom={zoom}
        onZoomIn={zoomIn}
        onZoomOut={zoomOut}
        onZoomReset={zoomReset}
      />

      <div className="flex min-h-0 min-w-0 flex-1 overflow-hidden">
        {/* LEFT: brief panel */}
        <aside className="grid h-full w-[360px] shrink-0 grid-rows-[minmax(0,1fr)_auto] overflow-hidden border-r border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-950">
          <form id="studio-form" onSubmit={generate} className="min-h-0 overflow-y-auto">
            <Section icon={Target} title="Konsep">
              <SegmentedControl
                label="Mode konten"
                value={form.mode}
                onChange={setMode}
                options={modeOptions}
                icons={{ single: Square, carousel: Layers }}
              />
              {isCarousel && <Select label="Jumlah slide" value={String(form.totalSlides)} onChange={setTotalSlides} options={slideCountOptions} />}
              <Field
                label="Topik utama"
                value={form.topic}
                onChange={setTopic}
                placeholder="cth: promo kopi susu diskon 30%"
                hint="AI akan menentukan arah visual dari topik ini."
              />
            </Section>

            <Section icon={Palette} title="Brand" collapsible id="desktop-brand" defaultOpen>
              <Field label="Nama brand" value={form.brandName} onChange={setBrandName} placeholder="Kopi Senja" optional />
              <Field label="Palette warna" value={form.colorPalette} onChange={setColorPalette} placeholder="navy, cream, gold" hint="Kosongkan agar AI memilih palette." optional />
            </Section>

            <Section icon={ImagePlus} title="Upload (opsional)" collapsible id="desktop-upload" defaultOpen={false}>
              <UploadsGroup
                product={productUpload}
                references={referenceUploads}
                logo={logoUpload}
                onChangeProduct={setProductUpload}
                onChangeReferences={setReferenceUploads}
                onChangeLogo={setLogoUpload}
              />
            </Section>

            <Section icon={Type} title="Format" collapsible id="desktop-format" defaultOpen={false}>
              <Select label="Ukuran kanvas" value={form.format} onChange={setFormat} options={formats} />
            </Section>

            <Section icon={Languages} title="Bahasa" collapsible id="desktop-language" defaultOpen={false}>
              <label className="block">
                <span className="mb-1.5 flex items-center justify-between text-[11px] font-medium uppercase tracking-[0.08em] text-slate-500 dark:text-slate-400">
                  Bahasa hasil desain
                </span>
                <div className="relative">
                  <select
                    value={form.language || 'Indonesian'}
                    onChange={(e) => setLanguage(e.target.value)}
                    className="w-full appearance-none rounded-md border border-slate-200 bg-white px-3 py-2 pr-8 text-[13px] text-slate-900 outline-none transition focus:border-slate-900 focus:ring-2 focus:ring-slate-900/10 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:focus:border-slate-100 dark:focus:ring-slate-100/10"
                  >
                    {languages.map((l) => (
                      <option key={l.value} value={l.value}>{l.label}</option>
                    ))}
                  </select>
                </div>
                <span className="mt-1 block text-[11px] leading-4 text-slate-500 dark:text-slate-400">
                  Teks di dalam desain akan di-render dalam bahasa ini.
                </span>
              </label>
            </Section>

            <Section icon={Settings2} title="Opsional" collapsible id="desktop-optional" defaultOpen={false}>
              <Field label="Target audiens" value={form.audience} onChange={setAudience} placeholder="mahasiswa, ibu muda, UMKM" optional />
              <Field label="Tone copy" value={form.captionTone} onChange={setCaptionTone} placeholder="friendly, profesional" optional />
              <Textarea label="Catatan" value={form.extraNotes} onChange={setExtraNotes} placeholder="contoh: tonjolkan texture produk, hindari warna ungu" optional rows={3} />
            </Section>
          </form>

          {/* sticky footer action */}
          <div className="border-t border-slate-200 bg-white p-3 dark:border-slate-800 dark:bg-slate-950">
            {loading ? (
              <button
                type="button"
                onClick={generate}
                className="flex w-full items-center justify-center gap-2 rounded-md bg-rose-600 px-4 py-2.5 text-[13px] font-semibold text-white transition hover:bg-rose-700"
              >
                <StopCircle size={14} /> Stop & coba ulang
              </button>
            ) : (
              <button
                type="submit"
                form="studio-form"
                disabled={!canGenerate}
                className="group flex w-full items-center justify-between gap-2 rounded-md bg-slate-950 px-4 py-2.5 text-[13px] font-semibold text-white shadow-[0_1px_0_rgba(255,255,255,0.1)_inset,0_6px_14px_-4px_rgba(15,23,42,0.4)] transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-300 disabled:shadow-none dark:bg-white dark:text-slate-950 dark:shadow-[0_1px_0_rgba(0,0,0,0.2)_inset,0_6px_14px_-4px_rgba(0,0,0,0.6)] dark:hover:bg-slate-200 dark:disabled:bg-slate-800 dark:disabled:text-slate-500"
              >
                <span className="flex items-center gap-2">
                  <Wand2 size={14} /> Generate {isCarousel ? 'carousel' : 'feed'}
                </span>
                <span className="flex items-center gap-0.5 opacity-80">
                  <Kbd>⌘</Kbd><Kbd>↵</Kbd>
                </span>
              </button>
            )}
            <div className="mt-2 flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400">
              <button type="button" onClick={reset} disabled={loading} className="inline-flex items-center gap-1 transition hover:text-slate-900 disabled:opacity-40 dark:hover:text-slate-100">
                <RefreshCw size={11} /> Reset brief
              </button>
              <span>Topik {form.topic.trim() ? <span className="font-medium text-emerald-600 dark:text-emerald-400">✓ lengkap</span> : <span className="text-rose-500 dark:text-rose-400">belum diisi</span>}</span>
            </div>
          </div>
        </aside>

        {/* CENTER: canvas */}
        <section className="flex h-full min-h-0 min-w-0 flex-1 flex-col overflow-hidden bg-slate-50 dark:bg-slate-900">
          <div className="min-h-0 flex-1 overflow-hidden">
            <Canvas
              images={images}
              slideStatus={slideStatus}
              activeSlide={activeSlide}
              loading={loading}
              isCarousel={isCarousel}
              generatingSlide={generatingSlide}
              totalSlides={form.totalSlides}
              zoom={zoom}
              format={form.format}
              onPickTemplate={pickTemplate}
              onPrev={prevSlide}
              onNext={nextSlide}
              onRetrySlide={retrySlide}
            />
          </div>
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
        </section>

        {/* RIGHT: inspector */}
        <aside className="hidden h-full w-[340px] shrink-0 grid-rows-[auto_minmax(0,1fr)_auto] overflow-hidden border-l border-slate-200 bg-white xl:grid dark:border-slate-800 dark:bg-slate-950">
          <div className="flex border-b border-slate-200 dark:border-slate-800">
            {[
              { key: 'preview', label: 'Preview', icon: Sparkles },
              { key: 'history', label: 'Riwayat', icon: History, badge: history.length },
              { key: 'export', label: 'Export', icon: Download },
            ].map((t) => {
              const active = inspectorTab === t.key
              return (
                <button
                  key={t.key}
                  type="button"
                  onClick={() => setInspectorTab(t.key)}
                  className={`relative flex flex-1 items-center justify-center gap-1.5 py-3 text-[11.5px] font-semibold uppercase tracking-[0.08em] transition ${active ? 'text-slate-900 dark:text-slate-100' : 'text-slate-400 hover:text-slate-700 dark:text-slate-500 dark:hover:text-slate-300'}`}
                >
                  <t.icon size={12} />
                  {t.label}
                  {typeof t.badge === 'number' && t.badge > 0 && (
                    <span className="rounded-full bg-slate-900 px-1.5 py-0.5 text-[9px] font-bold text-white dark:bg-slate-100 dark:text-slate-900">{t.badge}</span>
                  )}
                  {active && <span className="absolute inset-x-4 -bottom-px h-0.5 bg-slate-900 dark:bg-slate-100" />}
                </button>
              )
            })}
          </div>

          <div className="min-h-0 overflow-y-auto">
            {inspectorTab === 'preview' && (
              <>
                <Section icon={Sparkles} title="Instagram preview">
                  <IGPreview
                    brandName={form.brandName}
                    image={images[activeSlide]}
                    isCarousel={isCarousel}
                    activeSlide={activeSlide}
                    totalSlides={form.totalSlides}
                  />
                </Section>

                <Section icon={Info} title="Detail">
                  <dl className="grid grid-cols-2 gap-y-2 text-[12px]">
                    <dt className="text-slate-500 dark:text-slate-400">Mode</dt><dd className="text-right font-medium text-slate-900 dark:text-slate-100">{isCarousel ? 'Carousel' : 'Single'}</dd>
                    <dt className="text-slate-500 dark:text-slate-400">Format</dt><dd className="text-right font-medium text-slate-900 dark:text-slate-100">{form.format}</dd>
                    <dt className="text-slate-500 dark:text-slate-400">Progress</dt><dd className="text-right font-medium text-slate-900 dark:text-slate-100">{images.filter(Boolean).length}/{isCarousel ? form.totalSlides : 1}</dd>
                    <dt className="text-slate-500 dark:text-slate-400">Slide aktif</dt><dd className="text-right font-medium text-slate-900 dark:text-slate-100">{images[activeSlide] ? activeSlide + 1 : '—'}</dd>
                  </dl>
                </Section>

                {prompt && (
                  <Section
                    icon={FileText}
                    title="Prompt log"
                    action={
                      <button type="button" onClick={copyPrompt} className="inline-flex items-center gap-1 rounded border border-slate-200 bg-white px-2 py-0.5 text-[10px] font-medium text-slate-600 transition hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800">
                        <Copy size={10} /> Copy
                      </button>
                    }
                  >
                    <pre className="max-h-56 overflow-y-auto whitespace-pre-wrap break-words rounded-md border border-slate-200 bg-slate-50 p-2.5 font-mono text-[10.5px] leading-5 text-slate-600 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-400">
                      {prompt}
                    </pre>
                  </Section>
                )}
              </>
            )}

            {inspectorTab === 'history' && (
              <div className="flex flex-col">
                <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3 dark:border-slate-800">
                  <span className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.1em] text-slate-500 dark:text-slate-400">
                    <Clock size={12} /> Riwayat lokal
                  </span>
                  <button onClick={refreshHistory} className="grid h-6 w-6 place-items-center rounded text-slate-400 hover:bg-slate-100 hover:text-slate-700 dark:text-slate-500 dark:hover:bg-slate-800 dark:hover:text-slate-300" title="Refresh">
                    <RefreshCw size={11} />
                  </button>
                </div>
                <div className="flex-1 space-y-1.5 p-3">
                  {!isAuthed ? (
                    <div className="px-2 py-8 text-center">
                      <div className="mx-auto mb-3 grid h-10 w-10 place-items-center rounded-full bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400">
                        <History size={14} />
                      </div>
                      <p className="text-[12.5px] font-medium text-slate-900 dark:text-slate-100">Masuk untuk lihat riwayat</p>
                      <p className="mt-1 text-[11px] leading-5 text-slate-500 dark:text-slate-400">
                        Riwayat generate disimpan per akun supaya data kamu tidak bercampur dengan user lain.
                      </p>
                      <button
                        type="button"
                        onClick={openLogin}
                        className="mt-3 inline-flex items-center gap-1.5 rounded-md bg-slate-950 px-3 py-1.5 text-[12px] font-medium text-white transition hover:bg-slate-800 dark:bg-white dark:text-slate-950 dark:hover:bg-slate-200"
                      >
                        Masuk sekarang
                      </button>
                    </div>
                  ) : history.length === 0 ? (
                    <p className="px-2 py-6 text-center text-[12px] text-slate-500 dark:text-slate-400">
                      Belum ada riwayat. Generate pertama kamu akan muncul di sini.
                    </p>
                  ) : (
                    history.map((it) => (
                      <HistoryItem key={it.id} item={it} onLoad={loadHistory} onDelete={deleteHistory} />
                    ))
                  )}
                </div>
              </div>
            )}

            {inspectorTab === 'export' && (
              <Section icon={Download} title="Download hasil">
                {images.filter(Boolean).length === 0 ? (
                  <p className="py-4 text-[12px] text-slate-500 dark:text-slate-400">Belum ada hasil untuk di-export.</p>
                ) : (
                  <div className="space-y-1.5">
                    {images.map((img, i) => {
                      // Skip slots that failed or are still pending — only
                      // render download links for slides we actually have.
                      if (!img) return null
                      const fname = buildDownloadName({
                        topic: form.topic,
                        brand: form.brandName,
                        mode: isCarousel ? 'carousel' : 'single',
                        slideIndex: isCarousel ? i + 1 : undefined,
                        totalSlides: isCarousel ? form.totalSlides : undefined,
                        imageUrl: img,
                      })
                      return (
                        <a
                          key={i}
                          href={toPngDownloadUrl(img)}
                          download={fname}
                          title={fname}
                          className="flex items-center justify-between rounded-md border border-slate-200 bg-white px-3 py-2 text-[12px] font-medium text-slate-700 transition hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800"
                        >
                          <span className="flex min-w-0 items-center gap-2">
                            <span className="font-mono text-[10px] text-slate-400 dark:text-slate-500">{String(i + 1).padStart(2, '0')}</span>
                            <span className="truncate">{isCarousel ? `Slide ${i + 1}` : 'Feed'}.png</span>
                          </span>
                          <Download size={12} className="text-slate-400 dark:text-slate-500" />
                        </a>
                      )
                    })}
                  </div>
                )}
              </Section>
            )}
          </div>

          <div className="border-t border-slate-200 bg-slate-50 p-3 dark:border-slate-800 dark:bg-slate-900/60">
            <div className="flex items-start gap-2 text-[11px] leading-5 text-slate-600 dark:text-slate-400">
              <div className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900">
                <Rocket size={10} />
              </div>
              <p>
                Tip: tekan <Kbd>⌘</Kbd><Kbd>K</Kbd> untuk quick actions, atau <Kbd>?</Kbd> untuk lihat semua shortcut.
              </p>
            </div>
          </div>
        </aside>
      </div>

      <StatusBar
        loading={loading}
        isCarousel={isCarousel}
        totalSlides={form.totalSlides}
        imagesCount={images.filter(Boolean).length}
        format={form.format}
        error={error}
        generatingSlide={generatingSlide}
        onOpenShortcuts={onOpenShortcuts}
      />
    </>
  )
}
