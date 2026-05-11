import { createContext, memo, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { AlertCircle, AlertTriangle, CheckCircle2, Info, Loader2, X } from 'lucide-react'

/* ------------- context ------------- */

const ToastContext = createContext(null)

/**
 * Variants map to a colored accent stripe on the left of each toast to match
 * the overall Studio theme: slate base with semantic accent dots.
 */
const VARIANT_META = {
  success: { Icon: CheckCircle2, accent: 'bg-emerald-400', accentFg: 'text-emerald-400' },
  error:   { Icon: AlertCircle,  accent: 'bg-rose-400',    accentFg: 'text-rose-400' },
  warning: { Icon: AlertTriangle,accent: 'bg-amber-400',   accentFg: 'text-amber-400' },
  info:    { Icon: Info,         accent: 'bg-sky-400',     accentFg: 'text-sky-400' },
  loading: { Icon: Loader2,      accent: 'bg-slate-400',   accentFg: 'text-slate-300' },
}

const DEFAULT_DURATION = 3200
let idCounter = 0

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([])
  const timersRef = useRef(new Map())

  const dismiss = useCallback((id) => {
    setToasts((current) => current.filter((t) => t.id !== id))
    const timer = timersRef.current.get(id)
    if (timer) { clearTimeout(timer); timersRef.current.delete(id) }
  }, [])

  const show = useCallback((message, opts = {}) => {
    const id = opts.id ?? ++idCounter
    const next = {
      id,
      message,
      title: opts.title,
      variant: opts.variant || 'info',
      duration: opts.duration ?? DEFAULT_DURATION,
      action: opts.action,
      persistent: opts.variant === 'loading' || opts.duration === 0,
    }
    setToasts((current) => {
      // Deduplicate by id — allows updating a loading toast into success/error.
      const without = current.filter((t) => t.id !== id)
      return [...without, next]
    })
    const prevTimer = timersRef.current.get(id)
    if (prevTimer) clearTimeout(prevTimer)
    if (!next.persistent) {
      const timer = setTimeout(() => dismiss(id), next.duration)
      timersRef.current.set(id, timer)
    }
    return id
  }, [dismiss])

  const api = useMemo(() => ({
    show,
    dismiss,
    success: (msg, opts) => show(msg, { ...opts, variant: 'success' }),
    error:   (msg, opts) => show(msg, { ...opts, variant: 'error' }),
    warning: (msg, opts) => show(msg, { ...opts, variant: 'warning' }),
    info:    (msg, opts) => show(msg, { ...opts, variant: 'info' }),
    loading: (msg, opts) => show(msg, { ...opts, variant: 'loading' }),
  }), [show, dismiss])

  useEffect(() => () => {
    timersRef.current.forEach(clearTimeout)
    timersRef.current.clear()
  }, [])

  return (
    <ToastContext.Provider value={api}>
      {children}
      <Toaster toasts={toasts} onDismiss={dismiss} />
    </ToastContext.Provider>
  )
}

export function useToast() {
  const ctx = useContext(ToastContext)
  if (!ctx) {
    // Fallback no-op in case a component renders outside the provider during
    // hot reload — prevents hard crashes in dev.
    return { show: () => {}, dismiss: () => {}, success: () => {}, error: () => {}, warning: () => {}, info: () => {}, loading: () => {} }
  }
  return ctx
}

/* ------------- renderer ------------- */

const ToastCard = memo(function ToastCard({ toast, onDismiss }) {
  const meta = VARIANT_META[toast.variant] || VARIANT_META.info
  const Icon = meta.Icon
  const isLoading = toast.variant === 'loading'

  return (
    <div
      role="status"
      aria-live="polite"
      className="pointer-events-auto group relative flex w-[320px] items-start gap-3 overflow-hidden rounded-xl border border-slate-800/60 bg-slate-950/95 p-3 pr-9 text-white shadow-[0_18px_40px_-12px_rgba(15,23,42,0.45)] backdrop-blur data-[state=enter]:animate-toast-in"
      data-state="enter"
    >
      {/* accent stripe */}
      <span aria-hidden className={`absolute inset-y-2 left-1.5 w-[3px] rounded-full ${meta.accent}`} />

      <span className={`mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-md bg-slate-900 ${meta.accentFg}`}>
        <Icon size={14} className={isLoading ? 'animate-spin' : ''} strokeWidth={2} />
      </span>

      <div className="min-w-0 flex-1">
        {toast.title && <p className="truncate text-[12.5px] font-semibold leading-tight text-white">{toast.title}</p>}
        <p className={`${toast.title ? 'mt-0.5' : ''} text-[12.5px] leading-5 text-slate-200`}>{toast.message}</p>
        {toast.action && (
          <button
            type="button"
            onClick={() => { toast.action.onClick?.(); onDismiss(toast.id) }}
            className="mt-1.5 inline-flex items-center gap-1 rounded-md bg-white/10 px-2 py-0.5 text-[11px] font-medium text-white transition hover:bg-white/20"
          >
            {toast.action.label}
          </button>
        )}
      </div>

      <button
        type="button"
        onClick={() => onDismiss(toast.id)}
        className="absolute right-1.5 top-1.5 grid h-6 w-6 place-items-center rounded-md text-slate-400 transition hover:bg-white/10 hover:text-white"
        aria-label="Tutup notifikasi"
      >
        <X size={12} />
      </button>
    </div>
  )
})

const Toaster = memo(function Toaster({ toasts, onDismiss }) {
  if (typeof document === 'undefined') return null
  return (
    <div
      className="pointer-events-none fixed inset-x-0 bottom-4 z-[60] flex flex-col items-center gap-2 px-4 sm:bottom-6"
      aria-live="polite"
      aria-atomic="false"
    >
      {toasts.map((t) => <ToastCard key={t.id} toast={t} onDismiss={onDismiss} />)}
    </div>
  )
})
