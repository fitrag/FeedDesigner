import { lazy, memo, Suspense, useCallback, useEffect, useState } from 'react'
import { Globe, Images, Layers, Loader2, Lock, Square, Trash2 } from 'lucide-react'
import { authedFetch } from '../auth.jsx'
import { useToast } from '../toast.jsx'
import { EmptyHint, PageHeader, formatAbs, formatBytes } from './shared.jsx'
import { resolveApiUrl } from '../../config.js'

const AdminDetailModal = lazy(() => import('./DetailModal.jsx'))

/**
 * Admin designs page — every generation on the platform. Lets admin remove
 * offensive content even if they don't own it. Grid-first since covers are
 * the main thing admins want to scan.
 */
function DesignsPage() {
  const [items, setItems] = useState(null)
  const [loading, setLoading] = useState(true)
  const [busyId, setBusyId] = useState(null)
  const [openId, setOpenId] = useState(null)
  const toast = useToast()

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await authedFetch('/api/admin/generations?limit=200')
      if (!res.ok) throw new Error('fail')
      const data = await res.json()
      setItems(data.items || [])
    } catch {
      toast.error('Gagal memuat desain')
    } finally { setLoading(false) }
  }, [toast])

  useEffect(() => { load() }, [load])

  const remove = useCallback(async (item) => {
    if (!confirm(`Hapus "${item.topic}" dan semua slide-nya?`)) return
    setBusyId(item.id)
    try {
      const res = await authedFetch(`/api/admin/generations/${item.id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error('fail')
      toast.success('Desain dihapus')
      setItems((xs) => (xs || []).filter((x) => x.id !== item.id))
    } catch { toast.error('Gagal menghapus') }
    finally { setBusyId(null) }
  }, [toast])

  if (loading && !items) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <Loader2 className="animate-spin text-slate-400" size={22} />
      </div>
    )
  }

  return (
    <>
      <PageHeader
        title="Desain"
        subtitle={`${items?.length || 0} generasi tersimpan`}
      />

      {!items?.length ? (
        <EmptyHint icon={Images} title="Belum ada desain" body="Hasil generate user akan muncul di sini." />
      ) : (
        <div className="grid gap-3 grid-cols-2 sm:gap-4 md:grid-cols-3 xl:grid-cols-4">
          {items.map((g) => {
            const isCarousel = g.mode === 'carousel'
            const cover = resolveApiUrl(`/api/images/${g.id}-01.webp`)
            return (
              <article key={g.id} className="group relative flex flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white transition hover:-translate-y-0.5 hover:border-slate-300 dark:border-slate-800 dark:bg-slate-900 dark:hover:border-slate-700">
                <button type="button" onClick={() => setOpenId(g.id)} className="block text-left">
                <div className="relative aspect-square overflow-hidden bg-slate-100 dark:bg-slate-800">
                  <img
                    src={cover}
                    alt={g.topic || 'Cover'}
                    loading="lazy"
                    decoding="async"
                    className="h-full w-full object-cover transition duration-700 group-hover:scale-[1.03]"
                  />
                  <div aria-hidden className="pointer-events-none absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-slate-950/50 via-slate-950/0 to-transparent" />
                  <div className="absolute left-2.5 top-2.5 flex items-center gap-1.5">
                    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider backdrop-blur ${isCarousel ? 'bg-indigo-500/90 text-white' : 'bg-slate-900/80 text-white'}`}>
                      {isCarousel ? <Layers size={10} /> : <Square size={10} />}
                      {isCarousel ? `${g.totalSlides}` : '1'}
                    </span>
                    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider backdrop-blur ${g.isPublic ? 'bg-emerald-500/90 text-white' : 'bg-slate-700/80 text-white'}`}>
                      {g.isPublic ? <Globe size={10} /> : <Lock size={10} />}
                      {g.isPublic ? 'Publik' : 'Privat'}
                    </span>
                  </div>
                </div>
                </button>
                <div className="flex flex-col gap-1.5 p-3">
                  {g.brandName && (
                    <p className="truncate text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500 dark:text-slate-400">
                      {g.brandName}
                    </p>
                  )}
                  <p className="line-clamp-2 text-[12.5px] font-medium leading-5 text-slate-900 dark:text-slate-100">
                    {g.topic || 'Tanpa judul'}
                  </p>
                  <div className="flex items-center justify-between gap-2 text-[10.5px] text-slate-500 dark:text-slate-500">
                    <span className="truncate">{g.user?.email || '— (anon)'}</span>
                    <span className="shrink-0">{formatBytes(g.bytesStored || 0)}</span>
                  </div>
                  <div className="mt-1 flex items-center justify-between text-[10px] text-slate-500 dark:text-slate-500">
                    <span>{formatAbs(g.createdAt)}</span>
                    <button
                      type="button"
                      onClick={() => remove(g)}
                      disabled={busyId === g.id}
                      className="grid h-7 w-7 place-items-center rounded-md text-slate-400 transition hover:bg-rose-50 hover:text-rose-600 disabled:opacity-40 dark:text-slate-500 dark:hover:bg-rose-950/40 dark:hover:text-rose-400"
                      title="Hapus desain"
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>
                </div>
              </article>
            )
          })}
        </div>
      )}

      {openId && (
        <Suspense fallback={null}>
          <AdminDetailModal
            id={openId}
            onClose={() => setOpenId(null)}
            onDeleted={(deletedId) => {
              setItems((xs) => (xs || []).filter((x) => x.id !== deletedId))
              setOpenId(null)
            }}
          />
        </Suspense>
      )}
    </>
  )
}

export default memo(DesignsPage)
