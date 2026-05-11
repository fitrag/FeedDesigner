import { memo, useEffect, useMemo, useRef, useState } from 'react'
import { Search, X } from 'lucide-react'
import { Kbd } from '../common.jsx'
import { SHORTCUTS } from './constants.js'

export const ShortcutsModal = memo(function ShortcutsModal({ open, onClose }) {
  if (!open) return null
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/50 p-4 backdrop-blur-sm" onClick={onClose}>
      <div className="w-full max-w-md overflow-hidden rounded-xl border border-slate-200 bg-white shadow-2xl dark:border-slate-800 dark:bg-slate-900" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3 dark:border-slate-800">
          <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">Keyboard shortcuts</h3>
          <button onClick={onClose} className="grid h-7 w-7 place-items-center rounded-md hover:bg-slate-100 dark:hover:bg-slate-800"><X size={14} className="dark:text-slate-300" /></button>
        </div>
        <ul className="divide-y divide-slate-100 dark:divide-slate-800">
          {SHORTCUTS.map((item) => (
            <li key={item.desc} className="flex items-center justify-between px-4 py-2.5 text-[13px]">
              <span className="text-slate-700 dark:text-slate-300">{item.desc}</span>
              <span className="flex items-center gap-1">
                {item.keys.map((k) => <Kbd key={k}>{k}</Kbd>)}
              </span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
})

export function CommandPalette({ open, onClose, actions }) {
  const [query, setQuery] = useState('')
  const inputRef = useRef(null)

  useEffect(() => {
    if (open) {
      setQuery('')
      setTimeout(() => inputRef.current?.focus(), 10)
    }
  }, [open])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return actions
    return actions.filter((a) => a.label.toLowerCase().includes(q) || a.hint?.toLowerCase().includes(q))
  }, [query, actions])

  if (!open) return null
  return (
    <div className="fixed inset-0 z-50 grid place-items-start bg-slate-950/50 p-4 pt-[20vh] backdrop-blur-sm" onClick={onClose}>
      <div className="mx-auto w-full max-w-lg overflow-hidden rounded-xl border border-slate-200 bg-white shadow-2xl dark:border-slate-800 dark:bg-slate-900" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center gap-2 border-b border-slate-200 px-3 dark:border-slate-800">
          <Search size={14} className="text-slate-400" />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Cari aksi atau ketik perintah…"
            className="flex-1 bg-transparent py-3 text-[13.5px] text-slate-900 outline-none placeholder:text-slate-400 dark:text-slate-100 dark:placeholder:text-slate-500"
          />
          <span className="text-[10px] text-slate-400 dark:text-slate-500">ESC</span>
        </div>
        <ul className="max-h-[50vh] overflow-y-auto py-1">
          {filtered.length === 0 && (
            <li className="px-4 py-6 text-center text-[13px] text-slate-500 dark:text-slate-400">Tidak ada hasil.</li>
          )}
          {filtered.map((a) => (
            <li key={a.label}>
              <button
                type="button"
                onClick={() => { a.run(); onClose() }}
                disabled={a.disabled}
                className="flex w-full items-center gap-3 px-3 py-2.5 text-left transition hover:bg-slate-50 disabled:opacity-40 dark:hover:bg-slate-800"
              >
                <span className="grid h-7 w-7 place-items-center rounded-md bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300">
                  {a.icon && <a.icon size={13} strokeWidth={1.9} />}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[13px] font-medium text-slate-900 dark:text-slate-100">{a.label}</p>
                  {a.hint && <p className="mt-0.5 truncate text-[11px] text-slate-500 dark:text-slate-400">{a.hint}</p>}
                </div>
                {a.keys && (
                  <span className="flex items-center gap-0.5">
                    {a.keys.map((k) => <Kbd key={k}>{k}</Kbd>)}
                  </span>
                )}
              </button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}
