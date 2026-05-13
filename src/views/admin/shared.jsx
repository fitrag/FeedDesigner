import { memo } from 'react'
import {
  AlertTriangle, ChevronLeft, FileText, Images, LayoutDashboard, LogOut, ScrollText,
  Settings, Sparkles, Users,
} from 'lucide-react'
import { Brand } from '../common.jsx'
import { ThemeToggle } from '../theme.jsx'
import { useAuth } from '../auth.jsx'

/* ---------- format helpers ---------- */

export function formatBytes(bytes) {
  if (!bytes || bytes < 1024) return `${bytes || 0} B`
  const kb = bytes / 1024
  if (kb < 1024) return `${kb.toFixed(1)} KB`
  const mb = kb / 1024
  if (mb < 1024) return `${mb.toFixed(1)} MB`
  return `${(mb / 1024).toFixed(2)} GB`
}

export function formatAbs(ts) {
  if (!ts) return '—'
  return new Date(ts).toLocaleString('id-ID', {
    day: 'numeric', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
}

export function formatRelativeShort(ts) {
  if (!ts) return '—'
  const diff = Date.now() - ts
  const min = Math.floor(diff / 60_000)
  if (min < 1) return 'baru saja'
  if (min < 60) return `${min}m`
  const hr = Math.floor(min / 60)
  if (hr < 24) return `${hr}j`
  const day = Math.floor(hr / 24)
  if (day < 30) return `${day}h`
  return new Date(ts).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })
}

/* ---------- sidebar ---------- */

export const ADMIN_NAV = [
  { key: 'admin',           label: 'Overview',  icon: LayoutDashboard },
  { key: 'admin-users',     label: 'Users',     icon: Users },
  { key: 'admin-designs',   label: 'Desain',    icon: Images },
  { key: 'admin-audit',     label: 'Audit log', icon: ScrollText },
  { key: 'admin-settings',  label: 'Pengaturan',icon: Settings },
]

export const Sidebar = memo(function Sidebar({
  route, setRoute, onGoHome, onGoDashboard, user, onClose, inDrawer,
}) {
  const { logout } = useAuth()
  const displayName = user?.name?.trim() || (user?.email || '').split('@')[0] || 'Admin'
  const initial = (user?.name?.[0] || user?.email?.[0] || '?').toUpperCase()

  return (
    <aside
      className="relative flex h-full w-[272px] shrink-0 flex-col overflow-hidden border-r border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-950"
      aria-label="Admin sidebar"
    >
      <div className="flex h-14 shrink-0 items-center justify-between border-b border-slate-200 px-4 dark:border-slate-800">
        <div className="flex items-center gap-2">
          <Brand />
          <span className="rounded-full bg-rose-50 px-2 py-0.5 text-[9.5px] font-bold uppercase tracking-[0.14em] text-rose-700 dark:bg-rose-950/40 dark:text-rose-300">
            Admin
          </span>
        </div>
        {inDrawer && (
          <button
            type="button"
            onClick={onClose}
            className="grid h-8 w-8 place-items-center rounded-md text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800"
            aria-label="Tutup sidebar"
          >
            <ChevronLeft size={14} />
          </button>
        )}
      </div>

      <div className="space-y-2 p-3">
        <button
          type="button"
          onClick={onGoDashboard}
          className="flex w-full items-center gap-2.5 rounded-md border border-slate-200 bg-white px-2.5 py-2 text-[12.5px] font-medium text-slate-700 transition hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
        >
          <Sparkles size={13} /> Dashboard user
        </button>
        <button
          type="button"
          onClick={onGoHome}
          className="flex w-full items-center gap-2.5 rounded-md px-2.5 py-2 text-[12.5px] font-medium text-slate-600 transition hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-100"
        >
          <ChevronLeft size={13} /> Kembali ke Home
        </button>
      </div>

      <div className="mx-3 h-px bg-slate-200 dark:bg-slate-800" />

      <nav className="space-y-0.5 p-3">
        <p className="px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400 dark:text-slate-500">
          Menu admin
        </p>
        {ADMIN_NAV.map((n) => (
          <NavItem
            key={n.key}
            icon={n.icon}
            label={n.label}
            active={route === n.key}
            onClick={() => setRoute(n.key)}
          />
        ))}
      </nav>

      <div className="mt-auto" />

      <div className="shrink-0 space-y-3 border-t border-slate-200 p-3 dark:border-slate-800">
        <div className="flex items-center justify-between">
          <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400 dark:text-slate-500">Tampilan</span>
          <ThemeToggle size="sm" />
        </div>

        <div className="flex items-center gap-2.5 rounded-xl border border-slate-200 bg-gradient-to-br from-slate-50 to-white p-2.5 dark:border-slate-800 dark:from-slate-900 dark:to-slate-950">
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-gradient-to-br from-rose-600 to-rose-500 text-[12px] font-bold text-white">
            {initial}
          </span>
          <div className="min-w-0 flex-1 leading-tight">
            <p className="truncate text-[12.5px] font-semibold text-slate-900 dark:text-slate-100">{displayName}</p>
            <p className="truncate text-[10.5px] text-slate-500 dark:text-slate-400">{user?.email}</p>
          </div>
          <button
            type="button"
            onClick={logout}
            className="grid h-7 w-7 shrink-0 place-items-center rounded-md text-slate-400 transition hover:bg-white hover:text-rose-500 dark:text-slate-500 dark:hover:bg-slate-800 dark:hover:text-rose-400"
            aria-label="Keluar"
            title="Keluar"
          >
            <LogOut size={13} />
          </button>
        </div>
      </div>
    </aside>
  )
})

const NavItem = memo(function NavItem({ icon: Icon, label, active, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`group flex w-full items-center gap-2.5 rounded-md px-2.5 py-2 text-[13px] font-medium transition ${
        active
          ? 'bg-slate-950 text-white dark:bg-white dark:text-slate-950'
          : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-100'
      }`}
    >
      <Icon size={14} strokeWidth={active ? 2.2 : 1.8} />
      <span className="flex-1 text-left">{label}</span>
    </button>
  )
})

/* ---------- page chrome ---------- */

export function PageHeader({ title, subtitle, action }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="text-[22px] font-semibold tracking-[-0.02em] text-slate-900 md:text-[26px] dark:text-slate-100">{title}</h1>
        {subtitle && <p className="mt-1 text-[12.5px] text-slate-500 dark:text-slate-400">{subtitle}</p>}
      </div>
      {action}
    </div>
  )
}

export function Card({ children, className = '' }) {
  return (
    <div className={`rounded-2xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900 ${className}`}>
      {children}
    </div>
  )
}

export const StatTile = memo(function StatTile({ icon: Icon, label, value, sub, tone = 'slate' }) {
  const toneMap = {
    slate: 'from-slate-100 to-white dark:from-slate-800/50 dark:to-slate-900',
    indigo: 'from-indigo-50 to-white dark:from-indigo-950/30 dark:to-slate-900',
    amber: 'from-amber-50 to-white dark:from-amber-950/30 dark:to-slate-900',
    emerald: 'from-emerald-50 to-white dark:from-emerald-950/30 dark:to-slate-900',
    rose: 'from-rose-50 to-white dark:from-rose-950/30 dark:to-slate-900',
  }
  return (
    <div className={`overflow-hidden rounded-2xl border border-slate-200 bg-gradient-to-br ${toneMap[tone]} p-4 transition hover:-translate-y-0.5 hover:shadow-[0_12px_28px_-12px_rgba(15,23,42,0.14)] dark:border-slate-800`}>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <p className="truncate text-[10.5px] font-semibold uppercase tracking-[0.12em] text-slate-500 dark:text-slate-400">{label}</p>
          <p className="mt-2 text-[24px] font-semibold tracking-[-0.02em] text-slate-950 md:text-[28px] dark:text-slate-100">{value}</p>
          {sub && <p className="mt-0.5 truncate text-[11px] text-slate-500 dark:text-slate-400">{sub}</p>}
        </div>
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg border border-slate-200/70 bg-white/60 text-slate-700 backdrop-blur dark:border-slate-700/70 dark:bg-slate-900/60 dark:text-slate-200">
          <Icon size={15} />
        </span>
      </div>
    </div>
  )
})

export function ForbiddenGate({ onGoHome }) {
  return (
    <div className="grid min-h-[100dvh] place-items-center bg-slate-50 px-4 dark:bg-slate-900">
      <div className="max-w-md text-center">
        <div className="mx-auto mb-4 grid h-14 w-14 place-items-center rounded-2xl bg-rose-100 text-rose-600 dark:bg-rose-950/40 dark:text-rose-400">
          <AlertTriangle size={22} />
        </div>
        <h1 className="text-[22px] font-semibold tracking-tight text-slate-900 dark:text-slate-100">
          Akses admin diperlukan
        </h1>
        <p className="mx-auto mt-2 max-w-sm text-[13.5px] leading-6 text-slate-500 dark:text-slate-400">
          Halaman ini hanya tersedia untuk admin. Hubungi owner aplikasi kalau kamu perlu akses.
        </p>
        <button
          type="button"
          onClick={onGoHome}
          className="mt-6 inline-flex items-center gap-1.5 rounded-md bg-slate-950 px-5 py-2.5 text-[13px] font-semibold text-white transition hover:bg-slate-800 dark:bg-white dark:text-slate-950 dark:hover:bg-slate-200"
        >
          Kembali ke Home
        </button>
      </div>
    </div>
  )
}

export const TableShell = memo(function TableShell({ children }) {
  return (
    <div className="overflow-hidden rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
      <div className="overflow-x-auto">
        <table className="min-w-full border-collapse text-[12.5px]">
          {children}
        </table>
      </div>
    </div>
  )
})

export const SectionLabel = memo(function SectionLabel({ icon: Icon, children }) {
  return (
    <p className="mb-3 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500 dark:text-slate-400">
      {Icon && <Icon size={12} />}
      {children}
    </p>
  )
})

export const EmptyHint = memo(function EmptyHint({ icon: Icon = FileText, title, body }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-slate-300 bg-white py-16 text-center dark:border-slate-700 dark:bg-slate-900">
      <div className="mb-3 grid h-10 w-10 place-items-center rounded-xl bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400">
        <Icon size={16} />
      </div>
      <p className="text-[13.5px] font-medium text-slate-900 dark:text-slate-100">{title}</p>
      {body && <p className="mt-1 max-w-sm text-[12px] text-slate-500 dark:text-slate-400">{body}</p>}
    </div>
  )
})
