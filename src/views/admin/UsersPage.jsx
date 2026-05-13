import { memo, useCallback, useEffect, useState } from 'react'
import { Loader2, Shield, ShieldOff, Trash2, User } from 'lucide-react'
import { authedFetch } from '../auth.jsx'
import { useToast } from '../toast.jsx'
import { EmptyHint, PageHeader, TableShell, formatAbs, formatBytes } from './shared.jsx'

/**
 * Users admin page. Paginated list, role toggle (user ↔ admin), and a hard
 * delete action. The server refuses to demote the last admin or let admins
 * delete their own account; the UI just surfaces those errors via toast.
 */
function UsersPage({ currentUserId }) {
  const [items, setItems] = useState(null)
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [busyId, setBusyId] = useState(null)
  const toast = useToast()

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await authedFetch('/api/admin/users?limit=200')
      if (!res.ok) throw new Error('fail')
      const data = await res.json()
      setItems(data.items || [])
      setTotal(data.total || 0)
    } catch {
      toast.error('Gagal memuat user')
    } finally { setLoading(false) }
  }, [toast])

  useEffect(() => { load() }, [load])

  const setRole = useCallback(async (user, nextRole) => {
    setBusyId(user.id)
    try {
      const res = await authedFetch(`/api/admin/users/${user.id}/role`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role: nextRole }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data?.error || 'fail')
      toast.success(`Role ${user.email} → ${nextRole}`)
      setItems((xs) => (xs || []).map((x) => x.id === user.id ? { ...x, role: nextRole } : x))
    } catch (err) {
      toast.error(err.message || 'Gagal ubah role')
    } finally { setBusyId(null) }
  }, [toast])

  const remove = useCallback(async (user) => {
    if (!confirm(`Hapus user ${user.email}? Generasi mereka tetap ada tapi tidak berasosiasi lagi.`)) return
    setBusyId(user.id)
    try {
      const res = await authedFetch(`/api/admin/users/${user.id}`, { method: 'DELETE' })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data?.error || 'fail')
      toast.success('User dihapus')
      setItems((xs) => (xs || []).filter((x) => x.id !== user.id))
      setTotal((n) => Math.max(0, n - 1))
    } catch (err) {
      toast.error(err.message || 'Gagal menghapus user')
    } finally { setBusyId(null) }
  }, [toast])

  if (loading && !items) {
    return <LoadingShell />
  }

  return (
    <>
      <PageHeader
        title="Users"
        subtitle={`${total} akun terdaftar`}
      />

      {!items?.length ? (
        <EmptyHint icon={User} title="Belum ada user" body="Akun user akan muncul di sini setelah ada yang mendaftar." />
      ) : (
        <TableShell>
          <thead className="bg-slate-50 text-[10.5px] font-semibold uppercase tracking-[0.12em] text-slate-500 dark:bg-slate-800 dark:text-slate-400">
            <tr>
              <th className="px-3 py-2.5 text-left">Akun</th>
              <th className="px-3 py-2.5 text-left">Role</th>
              <th className="px-3 py-2.5 text-right">Desain</th>
              <th className="px-3 py-2.5 text-right">Storage</th>
              <th className="px-3 py-2.5 text-left">Dibuat</th>
              <th className="px-3 py-2.5 text-right">Aksi</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
            {items.map((u) => {
              const isSelf = u.id === currentUserId
              const isAdmin = u.role === 'admin'
              return (
                <tr key={u.id} className="text-slate-700 dark:text-slate-300">
                  <td className="px-3 py-3">
                    <div className="flex items-center gap-2.5">
                      <span className={`grid h-8 w-8 shrink-0 place-items-center rounded-full text-[11px] font-bold text-white ${isAdmin ? 'bg-rose-600' : 'bg-slate-700'}`}>
                        {(u.name?.[0] || u.email?.[0] || '?').toUpperCase()}
                      </span>
                      <div className="min-w-0">
                        <p className="truncate text-[12.5px] font-medium text-slate-900 dark:text-slate-100">{u.name || '—'}</p>
                        <p className="truncate text-[11px] text-slate-500 dark:text-slate-400">{u.email}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-3 py-3">
                    <RoleBadge role={u.role} />
                  </td>
                  <td className="px-3 py-3 text-right tabular-nums">{u.generationCount || 0}</td>
                  <td className="px-3 py-3 text-right tabular-nums text-slate-500 dark:text-slate-400">{formatBytes(u.bytesStored || 0)}</td>
                  <td className="px-3 py-3 text-[11px] text-slate-500 dark:text-slate-400">{formatAbs(u.createdAt)}</td>
                  <td className="px-3 py-3">
                    <div className="flex items-center justify-end gap-1">
                      <button
                        type="button"
                        onClick={() => setRole(u, isAdmin ? 'user' : 'admin')}
                        disabled={busyId === u.id}
                        title={isAdmin ? 'Demosi ke user' : 'Promosi ke admin'}
                        className={`grid h-8 w-8 place-items-center rounded-md transition ${
                          isAdmin
                            ? 'text-amber-600 hover:bg-amber-50 dark:text-amber-400 dark:hover:bg-amber-950/30'
                            : 'text-emerald-600 hover:bg-emerald-50 dark:text-emerald-400 dark:hover:bg-emerald-950/30'
                        } disabled:opacity-40`}
                      >
                        {isAdmin ? <ShieldOff size={13} /> : <Shield size={13} />}
                      </button>
                      <button
                        type="button"
                        onClick={() => remove(u)}
                        disabled={busyId === u.id || isSelf}
                        title={isSelf ? 'Tidak bisa hapus akun sendiri' : 'Hapus user'}
                        className="grid h-8 w-8 place-items-center rounded-md text-slate-400 transition hover:bg-rose-50 hover:text-rose-600 disabled:opacity-40 dark:text-slate-500 dark:hover:bg-rose-950/40 dark:hover:text-rose-400"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </TableShell>
      )}
    </>
  )
}

const RoleBadge = memo(function RoleBadge({ role }) {
  const isAdmin = role === 'admin'
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.12em] ${
      isAdmin
        ? 'bg-rose-100 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300'
        : 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300'
    }`}>
      {isAdmin && <Shield size={9} />}
      {role}
    </span>
  )
})

const LoadingShell = memo(function LoadingShell() {
  return (
    <div className="flex min-h-[40vh] items-center justify-center">
      <Loader2 className="animate-spin text-slate-400" size={22} />
    </div>
  )
})

export default memo(UsersPage)
