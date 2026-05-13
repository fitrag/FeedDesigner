import { memo, useEffect, useState } from 'react'
import { AlertCircle, HardDrive, Images, Layers, Loader2, ShieldAlert, Users } from 'lucide-react'
import { authedFetch } from '../auth.jsx'
import { PageHeader, StatTile, formatAbs, formatBytes, formatRelativeShort } from './shared.jsx'

/**
 * Platform overview — high-level counters and a few health signals. Fetches
 * /api/admin/overview on mount. Intentionally lightweight; drill-down is on
 * the dedicated Users / Designs / Audit pages.
 */
function OverviewPage() {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let aborted = false
    setLoading(true)
    authedFetch('/api/admin/overview')
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error('fail'))))
      .then((d) => { if (!aborted) { setData(d); setLoading(false) } })
      .catch(() => { if (!aborted) { setError('Gagal memuat overview'); setLoading(false) } })
    return () => { aborted = true }
  }, [])

  if (loading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <Loader2 className="animate-spin text-slate-400" size={22} />
      </div>
    )
  }

  if (error || !data) {
    return <EmptyError message={error || 'Data tidak tersedia'} />
  }

  const hasLoginFails = data.loginFails24h > 0

  return (
    <>
      <PageHeader
        title="Overview"
        subtitle="Ringkasan platform & sinyal kesehatan singkat."
      />

      <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
        <StatTile icon={Users} label="Total user" value={data.users} sub={`${data.admins} admin`} />
        <StatTile icon={Images} label="Generasi" value={data.generations} sub={`${data.publicGenerations} publik`} tone="indigo" />
        <StatTile icon={Layers} label="Total slide" value={data.slides} tone="emerald" />
        <StatTile icon={HardDrive} label="Storage" value={formatBytes(data.bytesStored)} sub="slide WebP" tone="amber" />
      </div>

      <div className="mt-6 grid gap-4 md:grid-cols-2">
        <div className={`rounded-2xl border p-5 ${hasLoginFails ? 'border-amber-200 bg-amber-50/60 dark:border-amber-900/50 dark:bg-amber-950/20' : 'border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900'}`}>
          <div className="flex items-start gap-3">
            <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-lg ${hasLoginFails ? 'bg-amber-500 text-white' : 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200'}`}>
              <ShieldAlert size={16} />
            </span>
            <div className="min-w-0">
              <p className="text-[13px] font-semibold text-slate-900 dark:text-slate-100">Login gagal 24 jam</p>
              <p className="mt-0.5 text-[11.5px] text-slate-500 dark:text-slate-400">
                Indikator kasar brute-force. Cek Audit log untuk detail per-IP.
              </p>
              <p className="mt-3 text-[32px] font-semibold tabular-nums text-slate-950 dark:text-slate-100">
                {data.loginFails24h}
              </p>
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
          <div className="flex items-start gap-3">
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200">
              <Images size={16} />
            </span>
            <div className="min-w-0">
              <p className="text-[13px] font-semibold text-slate-900 dark:text-slate-100">Generasi terakhir</p>
              <p className="mt-0.5 text-[11.5px] text-slate-500 dark:text-slate-400">
                Timestamp generate terakhir di seluruh platform.
              </p>
              <p className="mt-3 text-[18px] font-semibold tabular-nums text-slate-950 dark:text-slate-100">
                {data.lastGenerationAt ? formatRelativeShort(data.lastGenerationAt) : '—'} lalu
              </p>
              {data.lastGenerationAt && (
                <p className="text-[11px] text-slate-500 dark:text-slate-400">{formatAbs(data.lastGenerationAt)}</p>
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  )
}

const EmptyError = memo(function EmptyError({ message }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-rose-200 bg-rose-50 p-8 text-center dark:border-rose-900/50 dark:bg-rose-950/20">
      <AlertCircle className="text-rose-500" size={18} />
      <p className="mt-2 text-[13px] font-medium text-rose-700 dark:text-rose-300">{message}</p>
    </div>
  )
})

export default memo(OverviewPage)
