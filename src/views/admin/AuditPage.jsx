import { memo, useCallback, useEffect, useState } from 'react'
import { CheckCircle2, LogIn, LogOut, ScrollText, ShieldAlert, UserPlus } from 'lucide-react'
import { authedFetch } from '../auth.jsx'
import { useToast } from '../toast.jsx'
import { EmptyHint, PageHeader, TableShell, formatAbs } from './shared.jsx'

const EVENT_META = {
  register:       { icon: UserPlus,      tone: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-950/40 dark:text-indigo-300',    label: 'Register' },
  login_ok:       { icon: CheckCircle2,  tone: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300', label: 'Login OK' },
  login_fail:     { icon: ShieldAlert,   tone: 'bg-rose-100 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300',            label: 'Login fail' },
  logout:         { icon: LogOut,        tone: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300',           label: 'Logout' },
  session_resume: { icon: LogIn,         tone: 'bg-sky-100 text-sky-700 dark:bg-sky-950/40 dark:text-sky-300',                label: 'Resume' },
}

/**
 * Platform-wide auth audit log. Useful for post-incident forensics — who
 * logged in from where, spike of failed attempts, etc. Rows are never
 * mutated server-side, only appended.
 */
function AuditPage() {
  const [events, setEvents] = useState(null)
  const [loading, setLoading] = useState(true)
  const toast = useToast()

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await authedFetch('/api/admin/auth-events?limit=200')
      if (!res.ok) throw new Error('fail')
      const data = await res.json()
      setEvents(data.events || [])
    } catch {
      toast.error('Gagal memuat audit log')
    } finally { setLoading(false) }
  }, [toast])

  useEffect(() => { load() }, [load])

  return (
    <>
      <PageHeader
        title="Audit log"
        subtitle={events ? `${events.length} event terakhir` : 'Memuat…'}
      />

      {loading ? (
        <div className="h-32 animate-pulse rounded-xl bg-slate-100 dark:bg-slate-800" />
      ) : !events?.length ? (
        <EmptyHint icon={ScrollText} title="Audit log kosong" body="Event auth baru akan muncul di sini setelah user register/login." />
      ) : (
        <TableShell>
          <thead className="bg-slate-50 text-[10.5px] font-semibold uppercase tracking-[0.12em] text-slate-500 dark:bg-slate-800 dark:text-slate-400">
            <tr>
              <th className="px-3 py-2.5 text-left">Event</th>
              <th className="px-3 py-2.5 text-left">User</th>
              <th className="px-3 py-2.5 text-left">IP</th>
              <th className="px-3 py-2.5 text-left">User agent</th>
              <th className="px-3 py-2.5 text-left">Waktu</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 text-slate-700 dark:divide-slate-800 dark:text-slate-300">
            {events.map((e) => {
              const meta = EVENT_META[e.event] || { icon: LogIn, tone: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300', label: e.event }
              return (
                <tr key={e.id}>
                  <td className="px-3 py-2.5">
                    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${meta.tone}`}>
                      <meta.icon size={10} /> {meta.label}
                    </span>
                  </td>
                  <td className="px-3 py-2.5">
                    <p className="truncate font-medium text-slate-900 dark:text-slate-100">{e.userEmail || e.email || '—'}</p>
                    {e.userId && <p className="truncate font-mono text-[10px] text-slate-400">{e.userId.slice(0, 8)}…</p>}
                  </td>
                  <td className="px-3 py-2.5 font-mono text-[11px]">{e.ip || '—'}</td>
                  <td className="px-3 py-2.5 text-[11px] text-slate-500 dark:text-slate-400">
                    <span className="line-clamp-1 max-w-[280px]" title={e.userAgent || ''}>{e.userAgent || '—'}</span>
                  </td>
                  <td className="px-3 py-2.5 text-[11px] text-slate-500 dark:text-slate-400">{formatAbs(e.createdAt)}</td>
                </tr>
              )
            })}
          </tbody>
        </TableShell>
      )}
    </>
  )
}

export default memo(AuditPage)
