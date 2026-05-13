import { memo, useCallback, useRef, useState } from 'react'
import { ImagePlus, Loader2, Upload, X } from 'lucide-react'
import { authedFetch } from '../auth.jsx'
import { useToast } from '../toast.jsx'
import { useSettings } from '../settings.jsx'

const ACCEPTED = 'image/png,image/jpeg,image/webp,image/gif'
const MAX_BYTES = 10 * 1024 * 1024 // 10 MB

function readAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result)
    reader.onerror = () => reject(new Error('Gagal membaca file'))
    reader.readAsDataURL(file)
  })
}

async function uploadFile(file, kind) {
  const dataUrl = await readAsDataUrl(file)
  const res = await authedFetch('/api/uploads', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ kind, image: dataUrl }),
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(data?.error || 'Gagal upload')
  // Server returns the compressed WebP as a data URL. Attach a client-side
  // UUID so React can key it in lists without relying on a server id.
  const id = typeof crypto !== 'undefined' && crypto.randomUUID
    ? crypto.randomUUID()
    : `u-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
  return { id, ...data }
}

/**
 * Shared uploader surface — single-thumb for product (one image),
 * multi-thumbs for references (up to N).
 */
export function ImageUploader({ label, hint, kind, value, onChange, multiple = false, max = 4 }) {
  const inputRef = useRef(null)
  const [busy, setBusy] = useState(false)
  const [dragOver, setDragOver] = useState(false)
  const toast = useToast()
  const { settings } = useSettings()
  const uploadsEnabled = settings.uploadsEnabled !== false

  const current = multiple ? (value || []) : (value ? [value] : [])
  const canAddMore = uploadsEnabled && (multiple ? current.length < max : current.length === 0)

  const handleFiles = useCallback(async (fileList) => {
    const files = Array.from(fileList || []).filter(Boolean)
    if (!files.length) return
    const remainingSlots = multiple ? max - current.length : 1
    const toUpload = files.slice(0, remainingSlots)
    for (const f of toUpload) {
      if (f.size > MAX_BYTES) {
        toast.error(`${f.name}: ukuran maksimal 10 MB.`)
        continue
      }
      if (!['image/png', 'image/jpeg', 'image/webp', 'image/gif'].includes(f.type)) {
        toast.error(`${f.name}: format tidak didukung.`)
        continue
      }
      setBusy(true)
      try {
        const rec = await uploadFile(f, kind)
        if (multiple) {
          onChange([...(value || []), rec])
        } else {
          onChange(rec)
        }
      } catch (err) {
        toast.error(err.message || 'Gagal upload')
      } finally {
        setBusy(false)
      }
    }
  }, [current.length, kind, max, multiple, onChange, toast, value])

  const onPick = () => inputRef.current?.click()
  const onInputChange = (e) => {
    handleFiles(e.target.files)
    e.target.value = '' // reset so same file re-picks
  }

  const onDrop = useCallback((e) => {
    e.preventDefault()
    e.stopPropagation()
    setDragOver(false)
    handleFiles(e.dataTransfer?.files)
  }, [handleFiles])

  const remove = useCallback((rec) => {
    // Uploads aren't persisted server-side anymore, so removing is purely
    // local — just drop the record from state and let GC reclaim the bytes.
    if (multiple) {
      onChange((value || []).filter((x) => x.id !== rec.id))
    } else {
      onChange(null)
    }
  }, [multiple, onChange, value])

  return (
    <div>
      <p className="mb-1.5 text-[11px] font-medium uppercase tracking-[0.08em] text-slate-500 dark:text-slate-400">
        {label}
        {multiple && <span className="ml-1.5 rounded-full bg-slate-100 px-1.5 py-0.5 text-[9px] font-medium normal-case tracking-normal text-slate-500 dark:bg-slate-800 dark:text-slate-400">{current.length}/{max}</span>}
      </p>

      <input
        ref={inputRef}
        type="file"
        accept={ACCEPTED}
        multiple={multiple}
        className="sr-only"
        onChange={onInputChange}
      />

      {current.length > 0 && (
        <div className={`mb-2 grid gap-2 ${multiple ? 'grid-cols-3 sm:grid-cols-4' : 'grid-cols-1'}`}>
          {current.map((rec) => (
            <Thumb key={rec.id} rec={rec} onRemove={() => remove(rec)} featured={!multiple} />
          ))}
        </div>
      )}

      {canAddMore && (
        <button
          type="button"
          onClick={onPick}
          onDragEnter={(e) => { e.preventDefault(); setDragOver(true) }}
          onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
          onDragLeave={() => setDragOver(false)}
          onDrop={onDrop}
          disabled={busy}
          className={`flex w-full flex-col items-center justify-center gap-1 rounded-md border border-dashed px-3 py-5 text-[12px] font-medium transition ${
            dragOver
              ? 'border-slate-900 bg-slate-50 text-slate-900 dark:border-slate-100 dark:bg-slate-800 dark:text-slate-100'
              : 'border-slate-300 bg-white text-slate-600 hover:border-slate-400 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-400 dark:hover:border-slate-600 dark:hover:bg-slate-800'
          } disabled:cursor-wait disabled:opacity-60`}
        >
          {busy ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />}
          <span>{busy ? 'Mengupload…' : 'Tarik & letakkan atau klik untuk pilih'}</span>
          {hint && <span className="text-[10.5px] font-normal text-slate-500 dark:text-slate-500">{hint}</span>}
        </button>
      )}
      {!uploadsEnabled && current.length === 0 && (
        <div className="rounded-md border border-dashed border-slate-300 bg-slate-50 px-3 py-4 text-center text-[11.5px] text-slate-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-400">
          Upload gambar sedang dinonaktifkan oleh admin.
        </div>
      )}
    </div>
  )
}

const Thumb = memo(function Thumb({ rec, onRemove, featured }) {
  return (
    <div className={`group relative overflow-hidden rounded-md border border-slate-200 bg-slate-100 dark:border-slate-700 dark:bg-slate-800 ${featured ? 'aspect-[4/3]' : 'aspect-square'}`}>
      <img src={rec.dataUrl} alt="" loading="lazy" className="h-full w-full object-cover" />
      <button
        type="button"
        onClick={onRemove}
        className="absolute right-1 top-1 grid h-6 w-6 place-items-center rounded-full bg-slate-950/75 text-white opacity-0 transition group-hover:opacity-100 hover:bg-rose-600"
        aria-label="Hapus"
      >
        <X size={12} />
      </button>
    </div>
  )
})

/**
 * Compact group of uploaders shown inside the Studio brief:
 *  - product (single image) — used verbatim on the canvas
 *  - logo    (single image) — used as the brand logo (replaces AI-generated text wordmark)
 *  - references (multi image) — used as a mood board
 */
export function UploadsGroup({
  product, references, logo,
  onChangeProduct, onChangeReferences, onChangeLogo,
}) {
  return (
    <div className="space-y-3">
      <ImageUploader
        label="Foto produk (1)"
        hint="Dipakai persis di desain"
        kind="product"
        value={product}
        onChange={onChangeProduct}
      />
      <ImageUploader
        label="Logo brand (1)"
        hint="Dipakai sebagai logo di desain, AI tidak bikin logo sendiri"
        kind="logo"
        value={logo}
        onChange={onChangeLogo}
      />
      <ImageUploader
        label="Referensi desain"
        hint="Mood board (maks 4)"
        kind="reference"
        value={references}
        onChange={onChangeReferences}
        multiple
        max={4}
      />
    </div>
  )
}
