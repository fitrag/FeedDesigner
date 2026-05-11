import { memo, useCallback, useEffect, useState } from 'react'
import { ChevronDown } from 'lucide-react'

/* Shared form primitives used by both Desktop and Mobile Studio layouts. */

export const Field = memo(function Field({ label, value, onChange, placeholder, hint, optional }) {
  const handleChange = useCallback((e) => onChange(e.target.value), [onChange])
  return (
    <label className="block">
      <span className="mb-1.5 flex items-center justify-between text-[11px] font-medium uppercase tracking-[0.08em] text-slate-500 dark:text-slate-400">
        {label}
        {optional && <span className="rounded-full bg-slate-100 px-1.5 py-0.5 text-[9px] font-medium normal-case tracking-normal text-slate-500 dark:bg-slate-800 dark:text-slate-400">Opsional</span>}
      </span>
      <input
        value={value}
        onChange={handleChange}
        placeholder={placeholder}
        className="w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-[13px] text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-slate-900 focus:ring-2 focus:ring-slate-900/10 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:placeholder:text-slate-500 dark:focus:border-slate-100 dark:focus:ring-slate-100/10"
      />
      {hint && <span className="mt-1 block text-[11px] leading-4 text-slate-500 dark:text-slate-400">{hint}</span>}
    </label>
  )
})

export const Textarea = memo(function Textarea({ label, value, onChange, placeholder, optional, rows = 2 }) {
  const handleChange = useCallback((e) => onChange(e.target.value), [onChange])
  return (
    <label className="block">
      <span className="mb-1.5 flex items-center justify-between text-[11px] font-medium uppercase tracking-[0.08em] text-slate-500 dark:text-slate-400">
        {label}
        {optional && <span className="rounded-full bg-slate-100 px-1.5 py-0.5 text-[9px] font-medium normal-case tracking-normal text-slate-500 dark:bg-slate-800 dark:text-slate-400">Opsional</span>}
      </span>
      <textarea
        rows={rows}
        value={value}
        onChange={handleChange}
        placeholder={placeholder}
        className="w-full resize-none rounded-md border border-slate-200 bg-white px-3 py-2 text-[13px] leading-5 text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-slate-900 focus:ring-2 focus:ring-slate-900/10 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:placeholder:text-slate-500 dark:focus:border-slate-100 dark:focus:ring-slate-100/10"
      />
    </label>
  )
})

export const Select = memo(function Select({ label, value, onChange, options }) {
  const handleChange = useCallback((e) => onChange(e.target.value), [onChange])
  return (
    <label className="block">
      <span className="mb-1.5 flex items-center justify-between text-[11px] font-medium uppercase tracking-[0.08em] text-slate-500 dark:text-slate-400">{label}</span>
      <div className="relative">
        <select
          value={value}
          onChange={handleChange}
          className="w-full appearance-none rounded-md border border-slate-200 bg-white px-3 py-2 pr-8 text-[13px] text-slate-900 outline-none transition focus:border-slate-900 focus:ring-2 focus:ring-slate-900/10 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:focus:border-slate-100 dark:focus:ring-slate-100/10"
        >
          {options.map((opt) => <option key={opt}>{opt}</option>)}
        </select>
        <ChevronDown size={13} className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
      </div>
    </label>
  )
})

export const SegmentedControl = memo(function SegmentedControl({ label, value, onChange, options, icons }) {
  return (
    <div>
      {label && <p className="mb-1.5 text-[11px] font-medium uppercase tracking-[0.08em] text-slate-500 dark:text-slate-400">{label}</p>}
      <div className="grid grid-cols-2 rounded-md border border-slate-200 bg-slate-100 p-0.5 dark:border-slate-700 dark:bg-slate-800">
        {options.map((opt) => {
          const Icon = icons?.[opt]
          const active = value === opt
          return (
            <button
              key={opt}
              type="button"
              onClick={() => onChange(opt)}
              className={`flex items-center justify-center gap-1.5 rounded-sm px-2 py-1.5 text-[12px] font-medium capitalize transition ${active ? 'bg-white text-slate-950 shadow-[0_1px_0_rgba(15,23,42,0.04),0_1px_2px_rgba(15,23,42,0.06)] dark:bg-slate-950 dark:text-slate-100 dark:shadow-[0_1px_0_rgba(0,0,0,0.4)]' : 'text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100'}`}
            >
              {Icon && <Icon size={13} strokeWidth={1.9} />}
              {opt}
            </button>
          )
        })}
      </div>
    </div>
  )
})

export const Section = memo(function Section({ icon: Icon, title, children, badge, action, collapsible = false, id, defaultOpen = true }) {
  const storageKey = collapsible && id ? `feeddesigner:section:${id}` : null
  const [open, setOpen] = useState(() => {
    if (!collapsible) return true
    if (!storageKey || typeof window === 'undefined') return defaultOpen
    try {
      const saved = window.localStorage.getItem(storageKey)
      if (saved === '0') return false
      if (saved === '1') return true
    } catch { /* ignore */ }
    return defaultOpen
  })

  useEffect(() => {
    if (!storageKey || typeof window === 'undefined') return
    try { window.localStorage.setItem(storageKey, open ? '1' : '0') } catch { /* ignore */ }
  }, [open, storageKey])

  const toggle = useCallback(() => setOpen((v) => !v), [])

  const header = (
    <>
      <span className="flex min-w-0 items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.1em] text-slate-500 dark:text-slate-400">
        {collapsible && (
          <ChevronDown
            size={12}
            className={`shrink-0 transition-transform duration-200 ${open ? 'rotate-0' : '-rotate-90'}`}
          />
        )}
        <Icon size={12} className="shrink-0" />
        <span className="truncate">{title}</span>
        {badge && <span className="rounded-full bg-slate-900 px-1.5 py-0.5 text-[9px] font-bold text-white dark:bg-slate-100 dark:text-slate-900">{badge}</span>}
      </span>
      {action && <span className="shrink-0">{action}</span>}
    </>
  )

  return (
    <div className="border-b border-slate-200 last:border-b-0 dark:border-slate-800">
      {collapsible ? (
        <button
          type="button"
          onClick={toggle}
          aria-expanded={open}
          className="flex w-full items-center justify-between gap-2 px-4 py-3 text-left transition hover:bg-slate-50 dark:hover:bg-slate-900"
        >
          {header}
        </button>
      ) : (
        <div className="flex items-center justify-between gap-2 px-4 py-3">{header}</div>
      )}
      {(!collapsible || open) && (
        <div className="space-y-3 px-4 pb-4">{children}</div>
      )}
    </div>
  )
})
