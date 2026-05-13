import { memo, useCallback, useEffect, useState } from 'react'
import { Loader2, Save, Settings, TriangleAlert } from 'lucide-react'
import { authedFetch } from '../auth.jsx'
import { useToast } from '../toast.jsx'
import { PageHeader, formatAbs } from './shared.jsx'

const LABELS = {
  registrationEnabled:   { title: 'Registrasi aktif',        hint: 'Kalau dimatikan, pengguna baru tidak bisa daftar. Admin bypass.' },
  uploadsEnabled:        { title: 'Upload gambar aktif',     hint: 'Matikan kalau disk hampir penuh atau sedang investigasi abuse.' },
  showcasePublicDefault: { title: 'Publik default',          hint: 'Kalau aktif, desain baru otomatis tampil di showcase.' },
  generateDailyLimit:    { title: 'Limit generate harian',   hint: '0 = tanpa cap. Dihitung per user per 24 jam.' },
  maintenanceMode:       { title: 'Maintenance mode',        hint: 'Semua endpoint non-auth akan return 503. Admin bypass.' },
  maintenanceMessage:    { title: 'Pesan maintenance',       hint: 'Muncul di response ketika maintenance mode aktif.' },
}

/**
 * Admin settings page. Pulls current + default values + metadata, renders a
 * form tailored per type (boolean / number / string), and PATCHes changed
 * values back. Saving is deliberately "save all dirty fields" to keep the
 * interaction model simple.
 */
function SettingsPage() {
  const [data, setData] = useState(null)
  const [draft, setDraft] = useState({})
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const toast = useToast()

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await authedFetch('/api/admin/settings')
      if (!res.ok) throw new Error('fail')
      const d = await res.json()
      setData(d)
      setDraft(d.settings)
    } catch {
      toast.error('Gagal memuat pengaturan')
    } finally { setLoading(false) }
  }, [toast])

  useEffect(() => { load() }, [load])

  const dirty = data && Object.keys(draft).some((k) => !Object.is(draft[k], data.settings[k]))

  const save = useCallback(async () => {
    if (!data || !dirty) return
    const patch = {}
    for (const k of Object.keys(draft)) {
      if (!Object.is(draft[k], data.settings[k])) patch[k] = draft[k]
    }
    setSaving(true)
    try {
      const res = await authedFetch('/api/admin/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ settings: patch }),
      })
      if (!res.ok) throw new Error('fail')
      toast.success('Pengaturan disimpan')
      await load()
    } catch {
      toast.error('Gagal menyimpan pengaturan')
    } finally { setSaving(false) }
  }, [data, dirty, draft, load, toast])

  if (loading && !data) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <Loader2 className="animate-spin text-slate-400" size={22} />
      </div>
    )
  }

  if (!data) return null

  const keys = Object.keys(data.schema)
  return (
    <>
      <PageHeader
        title="Pengaturan"
        subtitle="Feature flag & konfigurasi platform."
        action={(
          <button
            type="button"
            onClick={save}
            disabled={!dirty || saving}
            className="inline-flex items-center gap-1.5 rounded-md bg-slate-950 px-3.5 py-2 text-[12.5px] font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-300 dark:bg-white dark:text-slate-950 dark:hover:bg-slate-200 dark:disabled:bg-slate-800 dark:disabled:text-slate-500"
          >
            {saving ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />}
            {saving ? 'Menyimpan…' : 'Simpan perubahan'}
          </button>
        )}
      />

      {draft.maintenanceMode && (
        <div className="mb-5 flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 p-3.5 dark:border-amber-900/50 dark:bg-amber-950/30">
          <TriangleAlert size={16} className="mt-0.5 shrink-0 text-amber-600 dark:text-amber-400" />
          <div className="min-w-0 text-[12.5px] text-amber-900 dark:text-amber-200">
            <p className="font-semibold">Maintenance mode aktif</p>
            <p className="mt-0.5">Semua endpoint non-auth kembali 503. Kamu sebagai admin tidak terdampak.</p>
          </div>
        </div>
      )}

      <div className="space-y-3">
        {keys.map((key) => {
          const current = draft[key]
          const schema = data.schema[key]
          const meta = data.meta[key]
          const label = LABELS[key] || { title: key, hint: '' }
          return (
            <div key={key} className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="text-[13px] font-semibold text-slate-900 dark:text-slate-100">{label.title}</p>
                    <span className="rounded-full bg-slate-100 px-1.5 py-0.5 font-mono text-[9.5px] text-slate-600 dark:bg-slate-800 dark:text-slate-400">
                      {key}
                    </span>
                    {!schema.public && (
                      <span className="rounded-full bg-rose-100 px-1.5 py-0.5 text-[9.5px] font-semibold uppercase tracking-[0.1em] text-rose-700 dark:bg-rose-950/40 dark:text-rose-300">
                        private
                      </span>
                    )}
                  </div>
                  {label.hint && <p className="mt-1 text-[11.5px] leading-5 text-slate-500 dark:text-slate-400">{label.hint}</p>}
                  {meta?.updatedAt && (
                    <p className="mt-1.5 text-[10.5px] text-slate-400 dark:text-slate-500">
                      Diubah {formatAbs(meta.updatedAt)}
                    </p>
                  )}
                </div>
                <div className="shrink-0">
                  {typeof schema.default === 'boolean' ? (
                    <Toggle
                      value={Boolean(current)}
                      onChange={(v) => setDraft((d) => ({ ...d, [key]: v }))}
                    />
                  ) : typeof schema.default === 'number' ? (
                    <input
                      type="number"
                      min={0}
                      value={Number(current ?? 0)}
                      onChange={(e) => setDraft((d) => ({ ...d, [key]: Number(e.target.value) || 0 }))}
                      className="w-28 rounded-md border border-slate-200 bg-white px-3 py-1.5 text-right text-[13px] tabular-nums outline-none focus:border-slate-900 focus:ring-2 focus:ring-slate-900/10 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 dark:focus:border-slate-100 dark:focus:ring-slate-100/10"
                    />
                  ) : (
                    <input
                      type="text"
                      value={String(current ?? '')}
                      onChange={(e) => setDraft((d) => ({ ...d, [key]: e.target.value }))}
                      placeholder="—"
                      className="w-64 rounded-md border border-slate-200 bg-white px-3 py-1.5 text-[13px] outline-none placeholder:text-slate-400 focus:border-slate-900 focus:ring-2 focus:ring-slate-900/10 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 dark:placeholder:text-slate-500 dark:focus:border-slate-100 dark:focus:ring-slate-100/10"
                    />
                  )}
                </div>
              </div>
            </div>
          )
        })}
      </div>

      <p className="mt-6 flex items-center gap-1.5 text-[11px] text-slate-400 dark:text-slate-500">
        <Settings size={11} /> Pengaturan disimpan di tabel <span className="font-mono">settings</span> dan langsung berlaku.
      </p>
    </>
  )
}

const Toggle = memo(function Toggle({ value, onChange }) {
  return (
    <button
      type="button"
      onClick={() => onChange(!value)}
      aria-pressed={value}
      className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition ${
        value ? 'bg-emerald-500' : 'bg-slate-300 dark:bg-slate-700'
      }`}
    >
      <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition ${value ? 'translate-x-6' : 'translate-x-1'}`} />
    </button>
  )
})

export default memo(SettingsPage)
