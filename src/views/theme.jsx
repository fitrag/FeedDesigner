import { createContext, memo, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { Monitor, Moon, Sun } from 'lucide-react'

/* ---------- context ---------- */

const ThemeContext = createContext(null)
const STORAGE_KEY = 'feeddesigner:theme'
const MODES = ['light', 'dark', 'system']

function getSystemIsDark() {
  return typeof window !== 'undefined' && window.matchMedia?.('(prefers-color-scheme: dark)').matches
}

function applyClass(isDark) {
  if (typeof document === 'undefined') return
  const root = document.documentElement
  root.classList.toggle('dark', isDark)
  root.style.colorScheme = isDark ? 'dark' : 'light'
}

function readInitialMode() {
  if (typeof window === 'undefined') return 'system'
  try {
    const saved = window.localStorage.getItem(STORAGE_KEY)
    if (saved && MODES.includes(saved)) return saved
  } catch { /* ignore */ }
  return 'system'
}

function resolveIsDark(mode) {
  if (mode === 'dark') return true
  if (mode === 'light') return false
  return getSystemIsDark()
}

export function ThemeProvider({ children }) {
  const [mode, setModeState] = useState(readInitialMode)
  const [isDark, setIsDark] = useState(() => resolveIsDark(readInitialMode()))

  // Apply class whenever resolved theme changes.
  useEffect(() => { applyClass(isDark) }, [isDark])

  // Recompute resolved theme when mode changes.
  useEffect(() => { setIsDark(resolveIsDark(mode)) }, [mode])

  // Watch system preference when in 'system' mode.
  useEffect(() => {
    if (mode !== 'system') return
    const mq = window.matchMedia('(prefers-color-scheme: dark)')
    const onChange = (e) => setIsDark(e.matches)
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [mode])

  const setMode = useCallback((next) => {
    if (!MODES.includes(next)) return
    setModeState(next)
    try { window.localStorage.setItem(STORAGE_KEY, next) } catch { /* ignore */ }
  }, [])

  const toggle = useCallback(() => {
    setMode(isDark ? 'light' : 'dark')
  }, [isDark, setMode])

  const api = useMemo(() => ({ mode, isDark, setMode, toggle }), [mode, isDark, setMode, toggle])
  return <ThemeContext.Provider value={api}>{children}</ThemeContext.Provider>
}

export function useTheme() {
  const ctx = useContext(ThemeContext)
  if (!ctx) return { mode: 'system', isDark: false, setMode: () => {}, toggle: () => {} }
  return ctx
}

/* ---------- ThemeToggle — three-way segmented control ---------- */

const SEGMENTS = [
  { value: 'light', icon: Sun, label: 'Light' },
  { value: 'system', icon: Monitor, label: 'System' },
  { value: 'dark', icon: Moon, label: 'Dark' },
]

export const ThemeToggle = memo(function ThemeToggle({ className = '', size = 'md' }) {
  const { mode, setMode } = useTheme()
  const h = size === 'sm' ? 'h-6' : 'h-7'
  const pad = size === 'sm' ? 'px-1.5' : 'px-2'
  const iconSize = size === 'sm' ? 11 : 12
  return (
    <div
      role="radiogroup"
      aria-label="Tema tampilan"
      className={`inline-flex items-center rounded-md border border-slate-200 bg-slate-100 p-0.5 dark:border-slate-700 dark:bg-slate-800 ${className}`}
    >
      {SEGMENTS.map((seg) => {
        const active = mode === seg.value
        const Icon = seg.icon
        return (
          <button
            key={seg.value}
            type="button"
            role="radio"
            aria-checked={active}
            aria-label={seg.label}
            onClick={() => setMode(seg.value)}
            title={seg.label}
            className={`flex items-center justify-center rounded-sm ${h} ${pad} transition ${
              active
                ? 'bg-white text-slate-900 shadow-[0_1px_0_rgba(15,23,42,0.04),0_1px_2px_rgba(15,23,42,0.06)] dark:bg-slate-950 dark:text-slate-100 dark:shadow-[0_1px_0_rgba(0,0,0,0.4)]'
                : 'text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100'
            }`}
          >
            <Icon size={iconSize} strokeWidth={2} />
          </button>
        )
      })}
    </div>
  )
})

/* ---------- Simple 2-state icon button for tight UI (hero nav on mobile) ---------- */

export const ThemeIconButton = memo(function ThemeIconButton({ className = '' }) {
  const { isDark, toggle } = useTheme()
  const Icon = isDark ? Sun : Moon
  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={isDark ? 'Mode terang' : 'Mode gelap'}
      title={isDark ? 'Mode terang' : 'Mode gelap'}
      className={`grid h-8 w-8 place-items-center rounded-md border border-slate-200 bg-white text-slate-600 transition hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800 ${className}`}
    >
      <Icon size={14} />
    </button>
  )
})
