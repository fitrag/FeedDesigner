import { createContext, memo, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { Download, Smartphone, X } from 'lucide-react'

/**
 * PWA Install Provider + Banner.
 *
 * Captures the `beforeinstallprompt` event from the browser, stores it, and
 * exposes an install API to the rest of the app. The banner is shown once
 * per session (dismissed state stored in sessionStorage) and only when the
 * browser signals the app is installable.
 *
 * On iOS (which doesn't fire beforeinstallprompt), we show a manual
 * instruction banner instead.
 */

const DISMISSED_KEY = 'fd:pwa-dismissed'

const PwaContext = createContext({
  canInstall: false,
  isInstalled: false,
  install: () => {},
})

export function usePwa() {
  return useContext(PwaContext)
}

export function PwaProvider({ children }) {
  const [deferredPrompt, setDeferredPrompt] = useState(null)
  const [isInstalled, setIsInstalled] = useState(false)

  useEffect(() => {
    // Check if already installed (standalone mode).
    if (window.matchMedia('(display-mode: standalone)').matches) {
      setIsInstalled(true)
      return
    }
    // Also check iOS standalone.
    if (navigator.standalone === true) {
      setIsInstalled(true)
      return
    }

    const handler = (e) => {
      e.preventDefault()
      setDeferredPrompt(e)
    }
    window.addEventListener('beforeinstallprompt', handler)

    const installedHandler = () => setIsInstalled(true)
    window.addEventListener('appinstalled', installedHandler)

    return () => {
      window.removeEventListener('beforeinstallprompt', handler)
      window.removeEventListener('appinstalled', installedHandler)
    }
  }, [])

  const install = useCallback(async () => {
    if (!deferredPrompt) return false
    deferredPrompt.prompt()
    const { outcome } = await deferredPrompt.userChoice
    setDeferredPrompt(null)
    if (outcome === 'accepted') {
      setIsInstalled(true)
      return true
    }
    return false
  }, [deferredPrompt])

  const canInstall = Boolean(deferredPrompt) && !isInstalled

  const api = useMemo(() => ({ canInstall, isInstalled, install }), [canInstall, isInstalled, install])

  return (
    <PwaContext.Provider value={api}>
      {children}
    </PwaContext.Provider>
  )
}

/* ---------- Install Banner ---------- */

function isIos() {
  if (typeof navigator === 'undefined') return false
  return /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream
}

export const PwaInstallBanner = memo(function PwaInstallBanner() {
  const { canInstall, isInstalled, install } = usePwa()
  const [dismissed, setDismissed] = useState(() => {
    try { return sessionStorage.getItem(DISMISSED_KEY) === '1' } catch { return false }
  })
  const [showIosHint, setShowIosHint] = useState(false)
  const bannerRef = useRef(null)

  // On iOS, show manual instruction if not installed and not dismissed.
  useEffect(() => {
    if (isIos() && !isInstalled && !dismissed) {
      setShowIosHint(true)
    }
  }, [isInstalled, dismissed])

  const dismiss = useCallback(() => {
    setDismissed(true)
    setShowIosHint(false)
    try { sessionStorage.setItem(DISMISSED_KEY, '1') } catch { /* ignore */ }
  }, [])

  const handleInstall = useCallback(async () => {
    const ok = await install()
    if (ok) dismiss()
  }, [install, dismiss])

  // Don't show if already installed or dismissed.
  if (isInstalled || dismissed) return null

  // Show native install prompt banner (Chrome/Edge/Samsung/etc).
  if (canInstall) {
    return (
      <div
        ref={bannerRef}
        className={[
          // Position: full-width on mobile, fixed-width card on desktop.
          'fixed z-[60] animate-[slide-up_300ms_ease-out]',
          // Mobile: bottom sheet style, edge-to-edge with small margin.
          'inset-x-3 bottom-3',
          // Tablet+: card pinned to bottom-right corner.
          'sm:inset-x-auto sm:bottom-5 sm:right-5 sm:w-[380px]',
          // Large desktop: slightly more breathing room.
          'lg:bottom-6 lg:right-6 lg:w-[400px]',
          // Shared styling.
          'overflow-hidden rounded-2xl border border-slate-200 bg-white',
          'shadow-[0_20px_60px_-12px_rgba(15,23,42,0.35)]',
          'dark:border-slate-700 dark:bg-slate-900',
          'dark:shadow-[0_20px_60px_-12px_rgba(0,0,0,0.7)]',
        ].join(' ')}
        style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
        role="alert"
      >
        <div className="flex items-start gap-3 p-3.5 sm:gap-4 sm:p-4">
          {/* Icon */}
          <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-slate-900 to-slate-700 text-white shadow-sm sm:h-11 sm:w-11 dark:from-white dark:to-slate-200 dark:text-slate-900">
            <Download size={16} strokeWidth={2} className="sm:hidden" />
            <Download size={18} strokeWidth={2} className="hidden sm:block" />
          </div>

          {/* Content */}
          <div className="min-w-0 flex-1">
            <p className="text-[13px] font-semibold leading-tight text-slate-900 sm:text-[14px] dark:text-slate-100">
              Install FeedDesigner
            </p>
            <p className="mt-1 text-[11.5px] leading-[1.45] text-slate-500 sm:text-[12px] sm:leading-5 dark:text-slate-400">
              Akses lebih cepat dari home screen. Offline-ready, tanpa browser bar.
            </p>

            {/* Action buttons */}
            <div className="mt-2.5 flex items-center gap-2 sm:mt-3">
              <button
                type="button"
                onClick={handleInstall}
                className="inline-flex items-center gap-1.5 rounded-lg bg-slate-950 px-3 py-1.5 text-[11.5px] font-semibold text-white transition hover:bg-slate-800 sm:px-3.5 sm:py-2 sm:text-[12px] dark:bg-white dark:text-slate-950 dark:hover:bg-slate-200"
              >
                <Download size={11} className="sm:hidden" />
                <Download size={12} className="hidden sm:block" />
                Install
              </button>
              <button
                type="button"
                onClick={dismiss}
                className="rounded-lg px-2.5 py-1.5 text-[11.5px] font-medium text-slate-500 transition hover:bg-slate-100 hover:text-slate-700 sm:px-3 sm:py-2 sm:text-[12px] dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-200"
              >
                Nanti
              </button>
            </div>
          </div>

          {/* Close button */}
          <button
            type="button"
            onClick={dismiss}
            className="grid h-6 w-6 shrink-0 place-items-center rounded-md text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 sm:h-7 sm:w-7 dark:hover:bg-slate-800 dark:hover:text-slate-200"
            aria-label="Tutup"
          >
            <X size={13} className="sm:hidden" />
            <X size={14} className="hidden sm:block" />
          </button>
        </div>

        {/* Accent bar */}
        <div className="h-0.5 bg-gradient-to-r from-emerald-400 via-emerald-500 to-teal-500 sm:h-1" />
      </div>
    )
  }

  // iOS manual instruction banner.
  if (showIosHint) {
    return (
      <div
        ref={bannerRef}
        className={[
          'fixed z-[60] animate-[slide-up_300ms_ease-out]',
          'inset-x-3 bottom-3',
          'sm:inset-x-auto sm:bottom-5 sm:right-5 sm:w-[380px]',
          'lg:bottom-6 lg:right-6 lg:w-[400px]',
          'overflow-hidden rounded-2xl border border-slate-200 bg-white',
          'shadow-[0_20px_60px_-12px_rgba(15,23,42,0.35)]',
          'dark:border-slate-700 dark:bg-slate-900',
          'dark:shadow-[0_20px_60px_-12px_rgba(0,0,0,0.7)]',
        ].join(' ')}
        style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
        role="alert"
      >
        <div className="flex items-start gap-3 p-3.5 sm:gap-4 sm:p-4">
          {/* Icon */}
          <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-blue-500 to-blue-600 text-white shadow-sm sm:h-11 sm:w-11">
            <Smartphone size={16} strokeWidth={2} className="sm:hidden" />
            <Smartphone size={18} strokeWidth={2} className="hidden sm:block" />
          </div>

          {/* Content */}
          <div className="min-w-0 flex-1">
            <p className="text-[13px] font-semibold leading-tight text-slate-900 sm:text-[14px] dark:text-slate-100">
              Install di iPhone/iPad
            </p>
            <p className="mt-1 text-[11.5px] leading-[1.45] text-slate-500 sm:text-[12px] sm:leading-5 dark:text-slate-400">
              Ketuk{' '}
              <span className="inline-flex items-center gap-0.5 rounded bg-slate-100 px-1 py-0.5 font-mono text-[10px] dark:bg-slate-800">
                Share <span className="text-blue-500">↑</span>
              </span>{' '}
              lalu pilih <strong className="text-slate-700 dark:text-slate-200">"Add to Home Screen"</strong>
            </p>

            {/* Dismiss button for iOS */}
            <div className="mt-2.5 sm:mt-3">
              <button
                type="button"
                onClick={dismiss}
                className="rounded-lg bg-slate-100 px-3 py-1.5 text-[11.5px] font-medium text-slate-600 transition hover:bg-slate-200 sm:px-3.5 sm:py-2 sm:text-[12px] dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
              >
                Mengerti
              </button>
            </div>
          </div>

          {/* Close button */}
          <button
            type="button"
            onClick={dismiss}
            className="grid h-6 w-6 shrink-0 place-items-center rounded-md text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 sm:h-7 sm:w-7 dark:hover:bg-slate-800 dark:hover:text-slate-200"
            aria-label="Tutup"
          >
            <X size={13} className="sm:hidden" />
            <X size={14} className="hidden sm:block" />
          </button>
        </div>

        {/* Accent bar */}
        <div className="h-0.5 bg-gradient-to-r from-blue-400 via-blue-500 to-indigo-500 sm:h-1" />
      </div>
    )
  }

  return null
})

/* ---------- Install Button (for nav/header) ---------- */

export const PwaInstallButton = memo(function PwaInstallButton() {
  const { canInstall, install } = usePwa()

  if (!canInstall) return null

  return (
    <button
      type="button"
      onClick={install}
      className="inline-flex items-center gap-1 rounded-md border border-emerald-200 bg-emerald-50 px-2 py-1 text-[11px] font-medium text-emerald-700 transition hover:bg-emerald-100 sm:gap-1.5 sm:px-2.5 sm:py-1.5 sm:text-[12px] dark:border-emerald-900/50 dark:bg-emerald-950/40 dark:text-emerald-400 dark:hover:bg-emerald-950/60"
      title="Install FeedDesigner di device kamu"
    >
      <Download size={11} className="sm:hidden" />
      <Download size={12} className="hidden sm:block" />
      <span className="hidden xs:inline sm:inline">Install</span>
    </button>
  )
})
