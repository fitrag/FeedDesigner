import { memo } from 'react'

export const Brand = memo(function Brand({ compact = false }) {
  return (
    <div className="flex items-center gap-2 select-none">
      <div className="relative grid h-7 w-7 place-items-center rounded-md bg-slate-950 text-white dark:bg-white dark:text-slate-950">
        <span className="text-[11px] font-black tracking-tighter">FD</span>
        <span className="absolute -right-0.5 -top-0.5 h-2 w-2 rounded-full bg-emerald-400 ring-2 ring-white dark:ring-slate-950" />
      </div>
      {!compact && (
        <div className="leading-none">
          <p className="text-[13px] font-semibold tracking-tight text-slate-950 dark:text-slate-100">FeedDesigner</p>
          <p className="mt-0.5 text-[10px] uppercase tracking-[0.14em] text-slate-500 dark:text-slate-400">AI Studio</p>
        </div>
      )}
    </div>
  )
})

export function FullPageFallback() {
  return (
    <div className="grid min-h-screen place-items-center bg-white dark:bg-slate-950">
      <div className="flex flex-col items-center gap-3">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-slate-200 border-t-slate-950 dark:border-slate-700 dark:border-t-slate-100" />
        <p className="text-xs uppercase tracking-[0.2em] text-slate-400 dark:text-slate-500">Loading</p>
      </div>
    </div>
  )
}

export const Kbd = memo(function Kbd({ children }) {
  return (
    <kbd className="inline-flex min-h-[18px] min-w-[18px] items-center justify-center rounded border border-slate-200 bg-white px-1.5 text-[10px] font-semibold text-slate-600 shadow-[inset_0_-1px_0_rgba(15,23,42,0.06)] dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:shadow-[inset_0_-1px_0_rgba(0,0,0,0.3)]">
      {children}
    </kbd>
  )
})
