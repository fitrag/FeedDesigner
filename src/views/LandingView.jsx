import { memo, useCallback, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import {
  ArrowLeft, ArrowRight, ArrowUpRight, Bot, Check, ChevronLeft, ChevronRight, Clock, Cpu,
  Image as ImageIcon, ImageOff, Infinity as InfinityIcon, Layers, LayoutDashboard, Lock, MessageSquare,
  Palette, Rocket, Shapes, Sparkles, Store, Target, TrendingUp, Users, X, Zap,
} from 'lucide-react'
import { Brand, Kbd } from './common.jsx'
import { useToast } from './toast.jsx'
import { ThemeToggle } from './theme.jsx'
import { UserMenu, useAuth } from './auth.jsx'
import { PwaInstallButton } from './pwa.jsx'
import { API_BASE_URL, resolveApiUrl } from '../config.js'

/* ---------- data ---------- */

const NAV = [
  { href: '#how', label: 'Cara kerja' },
  { href: '#features', label: 'Fitur' },
  { href: '#showcase', label: 'Showcase' },
  { href: '#use-cases', label: 'Cocok untuk' },
  { href: '#faq', label: 'FAQ' },
]

const PAIN_POINTS = [
  'Habis 3-4 jam di Canva cuma buat 1 carousel, belum revisi.',
  'Bayar desainer Rp 500K–3Jt per carousel, masih harus brief bolak-balik.',
  'Warna, font, dan layout antar slide selalu beda — feed jadi berantakan.',
  'AI generator lain cuma bisa 1 gambar, carousel-nya nggak nyambung.',
  'Akhirnya jarang posting karena capek bikin konten visual.',
]

const PROMISES = [
  'Ketik 1 topik → carousel 10 slide jadi dalam 30 detik.',
  'Palette, font, dan layout terkunci otomatis dari slide 1 sampai akhir.',
  'AI nulis copy Bahasa Indonesia + pilih visual direction sekaligus.',
  'Generate tanpa biaya per-desain — cukup bayar provider AI kamu.',
  'Dibangun khusus untuk carousel, bukan image generator biasa.',
]

const FEATURES = [
  {
    icon: Sparkles,
    title: 'AI art director pribadi kamu',
    desc: 'Bukan cuma generate gambar. AI menyusun design brief lengkap — art style, palette hex, tipografi, layout — lalu eksekusi sendiri. Kamu tinggal approve.',
  },
  {
    icon: Layers,
    title: 'Carousel yang benar-benar konsisten',
    desc: 'Warna, font, posisi logo, dan motif visual di-lock sekali lalu dipakai identik di semua slide. Feed kamu terlihat profesional tanpa effort.',
  },
  {
    icon: MessageSquare,
    title: 'Copy Bahasa Indonesia yang natural',
    desc: 'Headline, subtext, dan bullet point langsung dalam Bahasa Indonesia yang enak dibaca — bukan terjemahan kaku dari template Inggris.',
  },
  {
    icon: Zap,
    title: '30 detik per carousel, bukan 3 jam',
    desc: 'Slide muncul real-time saat dirender. Dalam waktu kurang dari 1 menit, carousel 10 slide sudah siap download dan posting.',
  },
  {
    icon: Shapes,
    title: 'Gaya visual tanpa batas',
    desc: 'Photography, 3D render, flat illustration, editorial collage — AI memilih yang paling cocok dengan topik kamu. Tidak terkurung satu template.',
  },
  {
    icon: Lock,
    title: 'Data kamu, di mesin kamu',
    desc: 'Semua hasil tersimpan lokal di server kamu sendiri. Tidak ada cloud pihak ketiga, tidak ada watermark, tidak ada yang bisa akses desain kamu kecuali kamu sendiri.',
  },
]

const STEPS = [
  {
    n: '01',
    title: 'Ketik topik kamu',
    desc: 'Cukup satu kalimat: "Tips skincare untuk pemula". Brand, palette, audiens — semuanya opsional, AI bisa decide sendiri.',
  },
  {
    n: '02',
    title: 'AI riset & susun brief',
    desc: 'Dalam 5 detik, AI commit ke palette hex, tipografi, art style, dan menulis storyboard lengkap untuk setiap slide.',
  },
  {
    n: '03',
    title: 'Render otomatis',
    desc: 'Setiap slide dirender dengan brief yang sama — palette, layout, dan motif identik. Hasilnya konsisten tanpa kamu sentuh.',
  },
  {
    n: '04',
    title: 'Download & posting',
    desc: 'Download PNG per slide, upload ke Instagram, selesai. Dari ide ke postingan dalam waktu kurang dari 1 menit.',
  },
]

const USE_CASES = [
  {
    icon: Store,
    title: 'UMKM & brand lokal',
    desc: 'Promo mingguan, launching produk, info cabang baru — semua konsisten dengan brand kamu tanpa perlu hire desainer.',
    examples: ['Promo diskon', 'Menu baru', 'Tips produk', 'Launching'],
  },
  {
    icon: Users,
    title: 'Content creator & educator',
    desc: 'Carousel edukasi yang look-nya premium dan konsisten di feed. Fokus riset konten, visual biar AI yang handle.',
    examples: ['Carousel tips', 'Tutorial step-by-step', 'Rangkuman tren', 'Infografis'],
  },
  {
    icon: Rocket,
    title: 'Agency & social media manager',
    desc: 'Draft visual untuk klien dalam hitungan menit, bukan hari. Iterasi tanpa biaya tambahan, present lebih cepat.',
    examples: ['Pitch deck visual', 'Draft kampanye', 'Content calendar', 'A/B testing visual'],
  },
]

const COMPARE = [
  { feature: 'Waktu per carousel', manual: '2–4 jam', agency: '1–3 hari kerja', us: '< 1 menit' },
  { feature: 'Biaya per carousel', manual: 'Gratis tapi capek', agency: 'Rp 500K–3Jt', us: 'Gratis (bayar AI saja)' },
  { feature: 'Konsistensi antar slide', manual: 'Tergantung skill', agency: 'Bagus tapi lama', us: 'Otomatis dijamin' },
  { feature: 'Revisi / iterasi', manual: 'Ulangi dari awal', agency: 'Email bolak-balik', us: '1 klik, 30 detik' },
  { feature: 'Copy Bahasa Indonesia', manual: 'Tulis sendiri', agency: 'Brief dulu, tunggu', us: 'Auto, natural' },
  { feature: 'Privasi data brand', manual: 'Aman di laptop', agency: 'Shared ke tim luar', us: 'Server kamu sendiri' },
]

const FAQ = [
  {
    q: 'Apakah saya butuh skill desain atau pengalaman prompt AI?',
    a: 'Sama sekali tidak. Cukup ketik topik konten kamu dalam 1 kalimat. AI yang memutuskan palette, gaya visual, layout, tipografi, dan bahkan menulis copy-nya. Kalau kamu punya preferensi warna brand, boleh diisi — tapi bukan keharusan.',
  },
  {
    q: 'Hasilnya benar-benar konsisten antar slide? Bukan cuma mirip?',
    a: 'Benar-benar konsisten. Sebelum render slide pertama, AI commit ke satu design brief lengkap — palette hex eksak, nama font, posisi logo, motif visual. Brief itu dipakai verbatim di setiap slide, jadi slide 1 sampai 10 terasa satu seri yang utuh.',
  },
  {
    q: 'Berapa lama waktu generate 1 carousel?',
    a: 'Rata-rata 30–60 detik untuk carousel 5 slide. Slide muncul satu per satu secara real-time, jadi kamu bisa lihat progress tanpa menunggu semua selesai.',
  },
  {
    q: 'Format dan ukuran apa saja yang didukung?',
    a: 'Square 1:1 (1024×1024), Portrait 4:5 (1024×1280), dan Story 9:16 (1024×1792). Hasil disimpan dalam WebP terkompresi — ukuran file kecil, kualitas tetap tajam. Download dalam PNG juga tersedia.',
  },
  {
    q: 'Apakah data brand dan hasil desain saya aman?',
    a: 'Sangat aman. Kamu perlu daftar akun (gratis) agar desain terasosiasi dengan akun kamu. Semua hasil tersimpan di server lokal — tidak ada cloud pihak ketiga yang menyimpan data kamu. API key hanya hidup di server, tidak pernah sampai ke browser.',
  },
  {
    q: 'Berapa biayanya? Ada limit generate per hari?',
    a: 'Daftar dan menggunakan FeedDesigner 100% gratis. Biaya hanya mengalir ke provider AI yang kamu pakai (OpenAI-compatible endpoint). Admin bisa mengatur limit harian jika diperlukan, tapi secara default tidak ada batasan dari sisi aplikasi.',
  },
  {
    q: 'Bisa upload logo brand sendiri?',
    a: 'Bisa. Upload logo kamu dan AI akan menggunakannya langsung di setiap slide — tanpa menggambar ulang atau mengubahnya. Posisi dan ukuran logo konsisten di semua slide.',
  },
  {
    q: 'Bisa diintegrasikan dengan Canva, Figma, atau tool lain?',
    a: 'Hasil export dalam PNG/WebP standar, jadi bisa langsung masuk ke Canva, Figma, Photoshop, atau tool desain apapun untuk polish akhir — tanpa vendor lock-in.',
  },
]

/* ---------- small atoms ---------- */

const StatPill = memo(function StatPill({ value, label }) {
  return (
    <div className="flex items-baseline gap-2">
      <span className="text-3xl font-semibold tracking-tight text-slate-950 dark:text-slate-100">{value}</span>
      <span className="text-xs uppercase tracking-[0.14em] text-slate-500 dark:text-slate-400">{label}</span>
    </div>
  )
})

const Feature = memo(function Feature({ icon: Icon, title, desc }) {
  return (
    <div className="group relative flex flex-col overflow-hidden rounded-xl border border-slate-200 bg-white p-5 transition hover:border-slate-300 hover:shadow-[0_1px_0_rgba(15,23,42,0.04),0_8px_24px_-8px_rgba(15,23,42,0.12)] sm:p-6 dark:border-slate-800 dark:bg-slate-900 dark:hover:border-slate-700 dark:hover:shadow-[0_1px_0_rgba(255,255,255,0.04),0_8px_24px_-8px_rgba(0,0,0,0.6)]">
      <div className="mb-5 grid h-10 w-10 place-items-center rounded-lg border border-slate-200 bg-slate-50 text-slate-700 transition group-hover:border-slate-950 group-hover:bg-slate-950 group-hover:text-white dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:group-hover:border-white dark:group-hover:bg-white dark:group-hover:text-slate-900">
        <Icon size={18} strokeWidth={1.75} />
      </div>
      <h3 className="text-[15px] font-semibold tracking-tight text-slate-950 dark:text-slate-100">{title}</h3>
      <p className="mt-2 text-[13.5px] leading-6 text-slate-600 dark:text-slate-400">{desc}</p>
    </div>
  )
})

/* ---------- showcase ---------- */

function formatRelative(ts) {
  if (!ts) return ''
  const diff = Date.now() - ts
  const min = Math.floor(diff / 60_000)
  if (min < 1) return 'baru saja'
  if (min < 60) return `${min} mnt lalu`
  const hr = Math.floor(min / 60)
  if (hr < 24) return `${hr} jam lalu`
  const day = Math.floor(hr / 24)
  if (day < 7) return `${day} hari lalu`
  const wk = Math.floor(day / 7)
  if (wk < 5) return `${wk} mgg lalu`
  return new Date(ts).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })
}

const ModeBadge = memo(function ModeBadge({ mode, totalSlides, compact }) {
  const isCarousel = mode === 'carousel'
  const base = compact
    ? 'inline-flex items-center gap-1 rounded-full bg-white/95 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-[0.14em] text-slate-900 backdrop-blur'
    : 'inline-flex items-center gap-1 rounded-full bg-white/95 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-900 backdrop-blur'
  return (
    <span className={base}>
      {isCarousel ? <Layers size={compact ? 9 : 10} /> : <ImageIcon size={compact ? 9 : 10} />}
      {isCarousel ? `${totalSlides} slides` : 'Single'}
    </span>
  )
})

/* Card used on the top feature grid and in the marquee lanes. */
const ShowcaseCard = memo(function ShowcaseCard({ item, onOpen, size = 'md' }) {
  const topic = (item.topic || '').toString()
  const brand = (item.brandName || '').toString().toUpperCase()
  const sizeCls = size === 'xs'
    ? 'w-[160px]'
    : size === 'sm'
      ? 'w-[200px]'
      : 'w-[260px]'
  return (
    <button
      type="button"
      onClick={() => onOpen(item)}
      className={`group relative shrink-0 overflow-hidden rounded-2xl border border-slate-200 bg-white text-left transition hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-[0_20px_40px_-18px_rgba(15,23,42,0.25)] dark:border-slate-800 dark:bg-slate-900 dark:hover:border-slate-700 dark:hover:shadow-[0_20px_40px_-18px_rgba(0,0,0,0.7)] ${sizeCls}`}
    >
      <div className="relative aspect-square overflow-hidden bg-slate-100 dark:bg-slate-800">
        <img
          src={item.image}
          alt={topic || 'Showcase'}
          loading="lazy"
          decoding="async"
          className="h-full w-full object-cover transition duration-700 group-hover:scale-[1.04]"
        />
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-slate-950/55 via-slate-950/15 to-transparent" />
        <div className="absolute left-2.5 top-2.5">
          <ModeBadge mode={item.mode} totalSlides={item.totalSlides} compact={size !== 'md'} />
        </div>
        <div className="absolute inset-x-3 bottom-2.5 flex items-end justify-between gap-2 text-white">
          <div className="min-w-0">
            {brand && size === 'md' && (
              <p className="truncate text-[9.5px] font-semibold uppercase tracking-[0.2em] text-white/80">{brand}</p>
            )}
            <p className={`truncate font-medium text-white drop-shadow-sm ${size === 'md' ? 'text-[12.5px]' : 'text-[11px]'}`}>{topic || 'Tanpa judul'}</p>
          </div>
          <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-white/95 text-slate-950 opacity-0 transition group-hover:opacity-100">
            <ArrowUpRight size={12} strokeWidth={2.2} />
          </span>
        </div>
      </div>
    </button>
  )
})

/* Large hero card on the feature grid — shows a bigger preview + more meta. */
const ShowcaseFeatureCard = memo(function ShowcaseFeatureCard({ item, onOpen }) {
  if (!item) return null
  const topic = (item.topic || '').toString()
  const brand = (item.brandName || '').toString().toUpperCase()
  const isCarousel = item.mode === 'carousel'
  return (
    <button
      type="button"
      onClick={() => onOpen(item)}
      className="group relative flex h-full w-full flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white text-left transition hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-[0_30px_60px_-20px_rgba(15,23,42,0.3)] dark:border-slate-800 dark:bg-slate-900 dark:hover:border-slate-700 dark:hover:shadow-[0_30px_60px_-20px_rgba(0,0,0,0.7)]"
    >
      <div className="relative aspect-square w-full overflow-hidden bg-slate-100 sm:aspect-[5/4] dark:bg-slate-800">
        <img
          src={item.image}
          alt={topic || 'Showcase'}
          loading="lazy"
          decoding="async"
          className="h-full w-full object-cover transition duration-700 group-hover:scale-[1.03]"
        />
        <div aria-hidden className="pointer-events-none absolute inset-0 bg-gradient-to-t from-slate-950/70 via-slate-950/10 to-transparent" />

        <div className="absolute left-4 top-4 flex items-center gap-2">
          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-400/95 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-emerald-950">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-800" /> Featured
          </span>
          <ModeBadge mode={item.mode} totalSlides={item.totalSlides} />
        </div>

        <div className="absolute inset-x-5 bottom-5 flex items-end justify-between gap-3 text-white">
          <div className="min-w-0">
            {brand && <p className="truncate text-[10px] font-semibold uppercase tracking-[0.22em] text-white/80">{brand}</p>}
            <p className="mt-1 line-clamp-2 text-[18px] font-semibold leading-[1.25] drop-shadow-sm md:text-[22px]">
              {topic || 'Tanpa judul'}
            </p>
            <p className="mt-2 flex items-center gap-2 text-[11px] text-white/70">
              <Clock size={10} /> {formatRelative(item.createdAt)}
              <span className="h-0.5 w-0.5 rounded-full bg-white/50" />
              {isCarousel ? `${item.totalSlides} slides` : 'Single feed'}
              {item.format && <><span className="h-0.5 w-0.5 rounded-full bg-white/50" />{item.format}</>}
            </p>
          </div>
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-white text-slate-950 shadow-lg transition group-hover:scale-110">
            <ArrowUpRight size={16} strokeWidth={2.2} />
          </span>
        </div>
      </div>
    </button>
  )
})

const ShowcaseSkeletonCard = memo(function ShowcaseSkeletonCard({ size = 'md' }) {
  const sizeCls = size === 'sm' ? 'w-[200px]' : 'w-[260px]'
  return (
    <div className={`shrink-0 overflow-hidden rounded-2xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900 ${sizeCls}`}>
      <div className="aspect-square animate-pulse bg-slate-100 dark:bg-slate-800" />
    </div>
  )
})

/* Infinite-marquee lane. Duplicates the list so the translate animation loops
 * seamlessly. Pauses on hover/focus for easier browsing. */
const MarqueeLane = memo(function MarqueeLane({ items, direction = 'left', duration = 60, onOpen, cardSize = 'sm' }) {
  if (!items || items.length === 0) return null
  const reversed = direction === 'right'
  const loop = [...items, ...items]
  return (
    <div
      className="group/lane relative overflow-hidden"
      style={{ maskImage: 'linear-gradient(90deg, transparent, #000 6%, #000 94%, transparent)', WebkitMaskImage: 'linear-gradient(90deg, transparent, #000 6%, #000 94%, transparent)' }}
    >
      <div
        className="flex w-max gap-4 will-change-transform group-hover/lane:[animation-play-state:paused] focus-within:[animation-play-state:paused]"
        style={{
          animation: `marquee-${reversed ? 'right' : 'left'} ${duration}s linear infinite`,
        }}
      >
        {loop.map((it, idx) => (
          <ShowcaseCard key={`${it.id}-${idx}`} item={it} onOpen={onOpen} size={cardSize} />
        ))}
      </div>
    </div>
  )
})

/* Modal detail — lets visitors step through all slides of the chosen work. */
function ShowcaseModal({ item, onClose, onStart }) {
  const [detail, setDetail] = useState(null)
  const [active, setActive] = useState(0)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!item) return
    setActive(0)
    setLoading(true)
    const ctl = new AbortController()
    fetch(`${API_BASE_URL}/api/showcase/${item.generationId}`, { signal: ctl.signal })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error('load'))))
      .then((d) => {
        if (d?.slides) d.slides = d.slides.map((s) => ({ ...s, image: resolveApiUrl(s.image) }))
        setDetail(d)
      })
      .catch(() => setDetail(null))
      .finally(() => setLoading(false))
    return () => ctl.abort()
  }, [item])

  useEffect(() => {
    if (!item) return
    const onKey = (e) => {
      if (e.key === 'Escape') onClose()
      if (e.key === 'ArrowLeft') setActive((a) => Math.max(0, a - 1))
      if (e.key === 'ArrowRight') setActive((a) => {
        const max = detail?.slides?.length ? detail.slides.length - 1 : 0
        return Math.min(max, a + 1)
      })
    }
    window.addEventListener('keydown', onKey)
    // Lock background scroll while the modal is open.
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      window.removeEventListener('keydown', onKey)
      document.body.style.overflow = prev
    }
  }, [item, detail, onClose])

  if (!item) return null

  const slides = detail?.slides || []
  const activeSlide = slides[active] || null
  const cover = activeSlide?.image || item.image
  const topic = detail?.topic || item.topic
  const brand = detail?.brandName || item.brandName
  const mode = detail?.mode || item.mode
  const total = detail?.totalSlides || item.totalSlides
  const format = detail?.format || item.format
  const createdAt = detail?.createdAt || item.createdAt

  // Render into document.body so the modal escapes any parent stacking
  // context (the sticky Landing header creates one via backdrop-blur). Without
  // a portal the header can visually cover the modal on desktop even when the
  // modal's z-index is higher.
  if (typeof document === 'undefined') return null

  return createPortal(
    <div
      className="fixed inset-0 z-[100] flex items-end justify-center bg-slate-950/70 backdrop-blur-md sm:items-center sm:p-4"
      style={{ animation: 'fade-in 200ms ease-out' }}
      onClick={onClose}
      role="dialog"
      aria-modal="true"
    >
      <div
        className="relative grid h-[92dvh] w-full overflow-hidden border-slate-200 bg-white shadow-[0_40px_80px_-20px_rgba(15,23,42,0.5)] grid-rows-[auto_minmax(0,1fr)_auto] sm:h-auto sm:max-h-[92vh] sm:max-w-5xl sm:rounded-2xl sm:border lg:grid-cols-[minmax(0,1fr)_340px] lg:grid-rows-[auto_minmax(0,1fr)] dark:border-slate-800 dark:bg-slate-950"
        style={{ animation: 'modal-in 260ms cubic-bezier(0.21, 1, 0.32, 1)' }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* HEADER — spans both columns on lg */}
        <div className="relative flex min-w-0 shrink-0 items-center gap-3 border-b border-slate-200 bg-white/80 px-4 py-3 backdrop-blur sm:px-5 lg:col-span-2 dark:border-slate-800 dark:bg-slate-950/80">
          <div className="min-w-0 flex-1 overflow-hidden">
            {loading && !detail ? (
              <div className="space-y-1.5">
                <div className="h-2.5 w-20 animate-pulse rounded bg-slate-200 dark:bg-slate-800" />
                <div className="h-4 w-48 animate-pulse rounded bg-slate-200 dark:bg-slate-800" />
              </div>
            ) : (
              <>
                {brand && (
                  <p className="truncate text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">
                    {brand.toUpperCase()}
                  </p>
                )}
                <h3 className="truncate text-[14px] font-semibold tracking-tight text-slate-950 sm:text-[15px] dark:text-slate-100">
                  {topic || 'Tanpa judul'}
                </h3>
              </>
            )}
          </div>
          <div className="flex shrink-0 items-center gap-1">
            <ModeBadge mode={mode} totalSlides={total} compact />
            <button
              type="button"
              onClick={onClose}
              className="grid h-8 w-8 place-items-center rounded-md text-slate-500 transition hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-100"
              aria-label="Tutup"
            >
              <X size={14} />
            </button>
          </div>
        </div>

        {/* PREVIEW PANE */}
        <div className="relative flex min-h-0 items-center justify-center overflow-hidden bg-slate-100 p-3 sm:p-4 lg:p-6 dark:bg-slate-900">
          {/* grid pattern background */}
          <div aria-hidden className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_center,#cbd5e1_1px,transparent_1px)] bg-[size:18px_18px] opacity-40 dark:bg-[radial-gradient(circle_at_center,#334155_1px,transparent_1px)] dark:opacity-30" />

          {cover ? (
            <img
              src={cover}
              alt={topic || 'Preview'}
              className="relative block max-h-full max-w-full rounded-lg object-contain shadow-[0_20px_40px_-12px_rgba(15,23,42,0.3)] dark:shadow-[0_20px_40px_-12px_rgba(0,0,0,0.6)]"
              loading="eager"
              decoding="async"
            />
          ) : (
            <p className="relative text-sm text-slate-500">Tidak ada slide</p>
          )}

          {loading && (
            <div className="absolute inset-0 grid place-items-center bg-white/40 backdrop-blur-sm dark:bg-slate-950/40">
              <div className="flex items-center gap-2 rounded-full bg-white/90 px-3 py-1.5 text-[11px] font-medium text-slate-700 shadow dark:bg-slate-900/90 dark:text-slate-200">
                <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-500" />
                Memuat detail…
              </div>
            </div>
          )}

          {slides.length > 1 && (
            <>
              <button
                type="button"
                onClick={() => setActive((a) => Math.max(0, a - 1))}
                disabled={active === 0}
                className="absolute left-2 top-1/2 grid h-9 w-9 -translate-y-1/2 place-items-center rounded-full border border-slate-200 bg-white/95 text-slate-800 shadow-lg backdrop-blur transition hover:bg-white disabled:opacity-30 sm:left-3 dark:border-slate-700 dark:bg-slate-900/95 dark:text-slate-100"
                aria-label="Slide sebelumnya"
              >
                <ChevronLeft size={16} />
              </button>
              <button
                type="button"
                onClick={() => setActive((a) => Math.min(slides.length - 1, a + 1))}
                disabled={active === slides.length - 1}
                className="absolute right-2 top-1/2 grid h-9 w-9 -translate-y-1/2 place-items-center rounded-full border border-slate-200 bg-white/95 text-slate-800 shadow-lg backdrop-blur transition hover:bg-white disabled:opacity-30 sm:right-3 dark:border-slate-700 dark:bg-slate-900/95 dark:text-slate-100"
                aria-label="Slide berikutnya"
              >
                <ChevronRight size={16} />
              </button>
              <div className="absolute bottom-3 left-1/2 -translate-x-1/2 rounded-full bg-slate-950/80 px-2.5 py-0.5 font-mono text-[10px] font-semibold text-white backdrop-blur">
                {active + 1} / {slides.length}
              </div>
            </>
          )}
        </div>

        {/* INFO PANE — bottom sheet on mobile, side column on lg */}
        <aside className="flex min-h-0 flex-col border-t border-slate-200 bg-white lg:border-l lg:border-t-0 dark:border-slate-800 dark:bg-slate-950">
          <div className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-5">
            <p className="text-[11.5px] text-slate-500 dark:text-slate-400">
              {formatRelative(createdAt)}
            </p>

            <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-2.5 border-t border-slate-100 pt-4 text-[12px] lg:grid-cols-1 dark:border-slate-800">
              <div className="flex items-center justify-between gap-2">
                <dt className="shrink-0 text-slate-500 dark:text-slate-400">Mode</dt>
                <dd className="truncate text-right font-medium text-slate-900 dark:text-slate-100">{mode === 'carousel' ? 'Carousel' : 'Single'}</dd>
              </div>
              {format && (
                <div className="flex items-center justify-between gap-2">
                  <dt className="shrink-0 text-slate-500 dark:text-slate-400">Format</dt>
                  <dd className="truncate text-right font-mono text-[11px] font-medium text-slate-900 dark:text-slate-100">{format}</dd>
                </div>
              )}
              {total && (
                <div className="flex items-center justify-between gap-2">
                  <dt className="shrink-0 text-slate-500 dark:text-slate-400">Slides</dt>
                  <dd className="truncate text-right font-medium text-slate-900 dark:text-slate-100">{total}</dd>
                </div>
              )}
            </dl>

            {slides.length > 1 && (
              <div className="mt-4 border-t border-slate-100 pt-4 dark:border-slate-800">
                <p className="mb-2.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500 dark:text-slate-400">
                  Semua slide
                </p>
                <div className="grid grid-cols-5 gap-1.5 sm:grid-cols-6 lg:grid-cols-4">
                  {slides.map((s, i) => (
                    <button
                      key={s.index}
                      type="button"
                      onClick={() => setActive(i)}
                      className={`relative aspect-square overflow-hidden rounded-md border transition ${
                        i === active
                          ? 'border-slate-900 ring-2 ring-slate-900 dark:border-slate-100 dark:ring-slate-100'
                          : 'border-slate-200 hover:border-slate-400 dark:border-slate-800 dark:hover:border-slate-600'
                      }`}
                      aria-label={`Slide ${i + 1}`}
                    >
                      <img src={s.image} alt="" loading="lazy" className="h-full w-full object-cover" />
                      <span className="absolute bottom-0 right-0 bg-white/90 px-1 font-mono text-[9px] text-slate-900 dark:bg-slate-900/90 dark:text-slate-100">
                        {String(i + 1).padStart(2, '0')}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div className="shrink-0 border-t border-slate-200 bg-slate-50 p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:p-4 dark:border-slate-800 dark:bg-slate-900/60">
            <button
              type="button"
              onClick={onStart}
              className="flex w-full items-center justify-center gap-2 rounded-md bg-slate-950 px-4 py-2.5 text-[13px] font-semibold text-white transition hover:bg-slate-800 dark:bg-white dark:text-slate-950 dark:hover:bg-slate-200"
            >
              <Sparkles size={14} /> Buat versi kamu sendiri
            </button>
            <p className="mt-2 text-center text-[10.5px] text-slate-500 dark:text-slate-400">
              Buka Studio, isi brief, dan biarkan AI yang rancang.
            </p>
          </div>
        </aside>
      </div>
    </div>,
    document.body,
  )
}

function ShowcaseSection({ onStart }) {
  const [items, setItems] = useState(null)
  const [error, setError] = useState(false)
  const [filter, setFilter] = useState('all') // all | carousel | single
  const [active, setActive] = useState(null)
  const toast = useToast()

  useEffect(() => {
    const ctl = new AbortController()
    fetch(`${API_BASE_URL}/api/showcase?limit=30`, { signal: ctl.signal })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error('load'))))
      .then((d) => setItems(Array.isArray(d.items) ? d.items.map((it) => ({ ...it, image: resolveApiUrl(it.image) })) : []))
      .catch((e) => {
        if (e.name !== 'AbortError') {
          setError(true)
          toast.error('Tidak bisa memuat showcase. Coba refresh halaman.', { title: 'Offline?' })
        }
      })
    return () => ctl.abort()
  }, [toast])

  const loading = items === null && !error
  const all = Array.isArray(items) ? items : []
  const filtered = filter === 'all' ? all : all.filter((it) => it.mode === filter)
  const hasItems = filtered.length > 0
  const total = all.length
  const carouselCount = all.filter((x) => x.mode === 'carousel').length
  const singleCount = total - carouselCount

  // Feature = most recent, rest fills the grid and marquee.
  const feature = filtered[0] || null
  const gridItems = filtered.slice(1, 7)   // next 6 for the side grid
  const marqueeA = filtered.slice(0, Math.min(filtered.length, 14))
  const marqueeB = [...filtered].reverse().slice(0, Math.min(filtered.length, 14))

  const filters = [
    { key: 'all', label: 'Semua', count: total },
    { key: 'carousel', label: 'Carousel', count: carouselCount, icon: Layers },
    { key: 'single', label: 'Single', count: singleCount, icon: ImageIcon },
  ]

  return (
    <section id="showcase" className="relative z-10 mx-auto max-w-6xl px-4 py-16 sm:px-5 sm:py-24 lg:px-8">
      {/* header */}
      <div className="mb-10 flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
        <div>
          <div className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white/80 px-3 py-1 text-[10.5px] font-semibold uppercase tracking-[0.18em] text-slate-700 backdrop-blur dark:border-slate-800 dark:bg-slate-900/80 dark:text-slate-300">
            <span className="relative flex h-1.5 w-1.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-500 opacity-60" />
              <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-500" />
            </span>
            Showcase live
            {total > 0 && (
              <span className="rounded-full bg-slate-900 px-1.5 py-0.5 text-[9px] font-bold text-white dark:bg-white dark:text-slate-900">{total}</span>
            )}
          </div>
          <h2 className="mt-4 max-w-2xl text-[30px] font-semibold leading-[1.08] tracking-[-0.03em] sm:text-4xl text-slate-950 md:text-5xl dark:text-slate-100">
            Desain nyata,<br className="hidden sm:inline" /> dibuat dalam detik.
          </h2>
          <p className="mt-4 max-w-xl text-[15px] leading-7 text-slate-600 dark:text-slate-400">
            {hasItems
              ? 'Karya terbaru dari studio — klik kartu mana saja untuk lihat detail lengkap dan step-through tiap slide.'
              : 'Showcase akan terisi otomatis setelah kamu generate desain pertama.'}
          </p>
        </div>

        {/* filters */}
        {total > 0 && (
          <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden md:mx-0 md:px-0 md:pb-0">
            <div className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-white p-1 dark:border-slate-800 dark:bg-slate-900">
            {filters.map((f) => {
              const isActive = filter === f.key
              const Icon = f.icon
              return (
                <button
                  key={f.key}
                  type="button"
                  onClick={() => setFilter(f.key)}
                  className={`inline-flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-[12px] font-medium transition ${
                    isActive
                      ? 'bg-slate-950 text-white dark:bg-white dark:text-slate-950'
                      : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100'
                  }`}
                >
                  {Icon && <Icon size={12} />}
                  {f.label}
                  <span className={`rounded-full px-1.5 py-0.5 text-[9px] font-bold ${
                    isActive
                      ? 'bg-white/20 text-white dark:bg-slate-900/20 dark:text-slate-950'
                      : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300'
                  }`}>
                    {f.count}
                  </span>
                </button>
              )
            })}
            </div>
          </div>
        )}
      </div>

      {/* feature grid */}
      {loading && (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-5 md:gap-5">
          <div className="md:col-span-3">
            <div className="aspect-[5/4] animate-pulse rounded-2xl bg-slate-100 dark:bg-slate-800" />
          </div>
          <div className="grid grid-cols-2 gap-3 md:col-span-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="aspect-square animate-pulse rounded-2xl bg-slate-100 dark:bg-slate-800" />
            ))}
          </div>
        </div>
      )}

      {!loading && !hasItems && (
        <div className="flex min-h-[320px] flex-col items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-6 text-center dark:border-slate-800 dark:bg-slate-900/50">
          <div className="mb-4 grid h-14 w-14 place-items-center rounded-2xl bg-white text-slate-400 shadow-sm dark:bg-slate-800 dark:text-slate-500">
            <ImageOff size={22} />
          </div>
          <p className="text-[15px] font-semibold text-slate-900 dark:text-slate-100">Belum ada desain di showcase</p>
          <p className="mt-2 max-w-sm text-[13px] leading-6 text-slate-500 dark:text-slate-400">
            Generate desain pertama kamu di Studio — hasilnya langsung tampil di sini sebagai portofolio hidup.
          </p>
          <button
            onClick={onStart}
            className="mt-6 inline-flex items-center gap-1.5 rounded-md bg-slate-950 px-4 py-2 text-[13px] font-medium text-white transition hover:bg-slate-800 dark:bg-white dark:text-slate-950 dark:hover:bg-slate-200"
          >
            Buka Studio <ArrowUpRight size={13} />
          </button>
        </div>
      )}

      {hasItems && (
        <>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-5 md:gap-5">
            {feature && (
              <div className="md:col-span-3">
                <ShowcaseFeatureCard item={feature} onOpen={setActive} />
              </div>
            )}

            {gridItems.length > 0 && (
              <div className="grid grid-cols-2 gap-3 md:col-span-2">
                {gridItems.map((it) => (
                  <button
                    key={it.id}
                    type="button"
                    onClick={() => setActive(it)}
                    className="group relative aspect-square overflow-hidden rounded-2xl border border-slate-200 bg-slate-100 transition hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-[0_20px_40px_-18px_rgba(15,23,42,0.25)] dark:border-slate-800 dark:bg-slate-800 dark:hover:border-slate-700 dark:hover:shadow-[0_20px_40px_-18px_rgba(0,0,0,0.7)]"
                    title={it.topic || ''}
                  >
                    <img
                      src={it.image}
                      alt={it.topic || 'Showcase'}
                      loading="lazy"
                      decoding="async"
                      className="h-full w-full object-cover transition duration-500 group-hover:scale-[1.05]"
                    />
                    <div aria-hidden className="pointer-events-none absolute inset-0 bg-gradient-to-t from-slate-950/55 via-transparent" />
                    <div className="absolute left-2.5 top-2.5">
                      <ModeBadge mode={it.mode} totalSlides={it.totalSlides} compact />
                    </div>
                    <div className="absolute inset-x-2.5 bottom-2.5">
                      <p className="truncate text-[11px] font-medium text-white drop-shadow-sm">{it.topic || 'Tanpa judul'}</p>
                    </div>
                    <span className="absolute right-2.5 top-2.5 grid h-7 w-7 place-items-center rounded-full bg-white/95 text-slate-950 opacity-0 shadow transition group-hover:opacity-100">
                      <ArrowUpRight size={11} strokeWidth={2.3} />
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* marquee rows */}
          {filtered.length > 6 && (
            <div className="mt-6 space-y-4">
              <MarqueeLane items={marqueeA} direction="left" duration={60} onOpen={setActive} cardSize="sm" />
              {filtered.length > 10 && (
                <MarqueeLane items={marqueeB} direction="right" duration={72} onOpen={setActive} cardSize="xs" />
              )}
            </div>
          )}
        </>
      )}

      {/* detail modal */}
      {active && <ShowcaseModal item={active} onClose={() => setActive(null)} onStart={() => { setActive(null); onStart?.() }} />}
    </section>
  )
}

/* ---------- Landing ---------- */

function Landing({ onStart, onHoverStudio, onGoDashboard, onHoverDashboard }) {
  const handleHover = useCallback(() => onHoverStudio?.(), [onHoverStudio])
  const handleHoverDash = useCallback(() => onHoverDashboard?.(), [onHoverDashboard])
  const { isAuthed } = useAuth()

  return (
    <main className="min-h-screen bg-white text-slate-950 antialiased [font-feature-settings:'cv11','ss01'] dark:bg-slate-950 dark:text-slate-100">
      <div aria-hidden className="pointer-events-none fixed inset-0 z-0 bg-[linear-gradient(to_right,rgba(15,23,42,0.04)_1px,transparent_1px),linear-gradient(to_bottom,rgba(15,23,42,0.04)_1px,transparent_1px)] bg-[size:56px_56px] [mask-image:radial-gradient(ellipse_at_top,#000_30%,transparent_75%)] dark:bg-[linear-gradient(to_right,rgba(255,255,255,0.04)_1px,transparent_1px),linear-gradient(to_bottom,rgba(255,255,255,0.04)_1px,transparent_1px)]" />

      {/* NAV */}
      <header className="sticky top-0 z-40 border-b border-slate-200/70 bg-white/80 backdrop-blur-xl dark:border-slate-800/70 dark:bg-slate-950/80">
        <nav className="mx-auto flex h-14 max-w-6xl items-center justify-between gap-2 px-4 sm:px-5 lg:px-8">
          <Brand />
          <div className="hidden items-center gap-1 text-sm lg:flex">
            {NAV.map((item) => (
              <a key={item.href} href={item.href} className="rounded-md px-3 py-1.5 text-slate-600 transition hover:bg-slate-100 hover:text-slate-950 dark:text-slate-400 dark:hover:bg-slate-800/70 dark:hover:text-slate-100">{item.label}</a>
            ))}
          </div>
          <div className="flex items-center gap-1.5 sm:gap-2">
            <PwaInstallButton />
            <ThemeToggle size="sm" />
            <UserMenu compact />
            {isAuthed && (
              <button
                type="button"
                onClick={onGoDashboard}
                onMouseEnter={handleHoverDash}
                onFocus={handleHoverDash}
                className="inline-flex items-center gap-1.5 rounded-md border border-slate-200 bg-white px-2.5 py-1.5 text-[12.5px] font-medium text-slate-700 transition hover:bg-slate-50 sm:px-3 sm:text-sm dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
              >
                <LayoutDashboard size={13} />
                <span className="hidden sm:inline">Dashboard</span>
              </button>
            )}
            {!isAuthed && (
              <button
                onClick={onStart}
                onMouseEnter={handleHover}
                onFocus={handleHover}
                className="group inline-flex items-center gap-1 rounded-md bg-slate-950 px-2.5 py-1.5 text-[12.5px] font-medium text-white transition hover:bg-slate-800 sm:gap-1.5 sm:px-3.5 sm:text-sm dark:bg-white dark:text-slate-950 dark:hover:bg-slate-200"
              >
                <span className="sm:hidden">Mulai</span>
                <span className="hidden sm:inline">Coba gratis</span>
                <ArrowUpRight size={14} className="transition group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
              </button>
            )}
          </div>
        </nav>
      </header>

      {/* HERO */}
      <section className="relative z-10 mx-auto max-w-6xl px-4 pb-16 pt-12 sm:px-5 sm:pb-20 sm:pt-20 lg:px-8 lg:pt-28">
        <div className="mx-auto max-w-3xl text-center">
          <a href="#showcase" className="group mx-auto mb-6 inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white/80 px-2.5 py-1 text-[11px] backdrop-blur sm:mb-7 sm:px-3 sm:text-xs dark:border-slate-800 dark:bg-slate-900/80">
            <span className="flex h-4 items-center rounded-full bg-emerald-500/10 px-1.5 text-[9px] font-semibold uppercase tracking-wider text-emerald-700 dark:text-emerald-400">Live</span>
            <span className="hidden text-slate-600 xs:inline sm:inline dark:text-slate-300">Lihat desain yang baru saja dibuat user lain</span>
            <span className="text-slate-600 xs:hidden sm:hidden dark:text-slate-300">Desain user lain</span>
            <ChevronRight size={12} className="text-slate-400 transition group-hover:translate-x-0.5 dark:text-slate-500" />
          </a>

          <h1 className="text-balance text-[40px] font-semibold leading-[1.02] tracking-[-0.04em] text-slate-950 sm:text-5xl sm:tracking-[-0.055em] md:text-[76px] md:leading-[0.98] dark:text-slate-100">
            Carousel Instagram<br />
            <span className="text-slate-400 dark:text-slate-600">dalam 30 detik, bukan 3 jam.</span>
          </h1>

          <p className="mx-auto mt-5 max-w-xl text-pretty text-[14.5px] leading-7 text-slate-600 sm:mt-6 sm:text-[17px] sm:leading-8 dark:text-slate-400">
            Ketik topik → AI menyusun copy, memilih visual, dan merender carousel 10 slide yang konsisten. Siap posting tanpa Canva, tanpa desainer, tanpa revisi bolak-balik.
          </p>

          <div className="mt-7 flex flex-col items-center justify-center gap-3 sm:mt-8 sm:flex-row">
            <button
              onClick={onStart}
              onMouseEnter={handleHover}
              onFocus={handleHover}
              className="group inline-flex w-full items-center justify-center gap-2 rounded-md bg-slate-950 px-5 py-3 text-sm font-medium text-white shadow-[0_1px_0_rgba(255,255,255,0.1)_inset,0_4px_12px_-4px_rgba(15,23,42,0.4)] transition hover:bg-slate-800 sm:w-auto dark:bg-white dark:text-slate-950 dark:shadow-[0_1px_0_rgba(0,0,0,0.2)_inset,0_4px_12px_-4px_rgba(0,0,0,0.6)] dark:hover:bg-slate-200"
            >
              <span className="sm:hidden">Mulai gratis</span>
              <span className="hidden sm:inline">Mulai gratis — daftar 10 detik</span>
              <ArrowRight size={15} className="transition group-hover:translate-x-0.5" />
            </button>
            <a href="#showcase" className="inline-flex w-full items-center justify-center gap-2 rounded-md border border-slate-200 bg-white px-5 py-3 text-sm font-medium text-slate-800 transition hover:bg-slate-50 sm:w-auto dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800">
              Lihat contoh hasil
            </a>
          </div>

          <div className="mt-5 flex flex-wrap items-center justify-center gap-x-4 gap-y-1.5 text-[11px] text-slate-500 sm:gap-x-5 sm:gap-y-2 sm:text-xs dark:text-slate-400">
            <span className="flex items-center gap-1.5"><Check size={12} className="text-emerald-500" /> Daftar gratis</span>
            <span className="flex items-center gap-1.5"><Check size={12} className="text-emerald-500" /> Data lokal</span>
            <span className="flex items-center gap-1.5"><Check size={12} className="text-emerald-500" /> Tanpa watermark</span>
            <span className="hidden items-center gap-1.5 sm:flex"><Kbd>⌘</Kbd><Kbd>↵</Kbd> generate cepat</span>
          </div>
        </div>

        <div className="mx-auto mt-12 grid max-w-4xl grid-cols-2 gap-y-6 border-y border-slate-200 py-6 sm:mt-16 sm:gap-y-8 sm:py-8 md:grid-cols-4 dark:border-slate-800">
          <StatPill value="30s" label="Per carousel" />
          <StatPill value="10" label="Slide max" />
          <StatPill value="15" label="Bahasa" />
          <StatPill value="Gratis" label="Daftar & pakai" />
        </div>
      </section>

      {/* PAIN vs PROMISE */}
      <section aria-label="Kenapa FeedDesigner" className="relative z-10 mx-auto max-w-6xl px-4 pb-16 sm:px-5 sm:pb-24 lg:px-8">
        <div className="mb-12 text-center">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">Kenapa FeedDesigner</p>
          <h2 className="mt-3 text-[30px] font-semibold leading-[1.08] tracking-[-0.03em] sm:text-4xl text-slate-950 md:text-5xl dark:text-slate-100">
            Berhenti buang waktu di Canva.
          </h2>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          {/* PAIN */}
          <div className="rounded-2xl border border-rose-200/70 bg-rose-50/40 p-5 sm:p-6 dark:border-rose-900/50 dark:bg-rose-950/20">
            <div className="mb-4 flex items-center gap-2">
              <div className="grid h-8 w-8 place-items-center rounded-lg bg-white text-rose-500 shadow-sm dark:bg-slate-900 dark:text-rose-400">
                <X size={16} />
              </div>
              <p className="text-[12px] font-semibold uppercase tracking-[0.12em] text-rose-700 sm:text-[13px] dark:text-rose-400">Sebelum</p>
            </div>
            <ul className="space-y-3">
              {PAIN_POINTS.map((p) => (
                <li key={p} className="flex items-start gap-2.5 text-[13.5px] leading-6 text-slate-700 sm:text-[14px] dark:text-slate-300">
                  <X size={14} className="mt-1 shrink-0 text-rose-400" />
                  <span>{p}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* PROMISE */}
          <div className="rounded-2xl border border-emerald-200/70 bg-emerald-50/40 p-5 sm:p-6 dark:border-emerald-900/50 dark:bg-emerald-950/20">
            <div className="mb-4 flex items-center gap-2">
              <div className="grid h-8 w-8 place-items-center rounded-lg bg-white text-emerald-600 shadow-sm dark:bg-slate-900 dark:text-emerald-400">
                <Sparkles size={16} />
              </div>
              <p className="text-[12px] font-semibold uppercase tracking-[0.12em] text-emerald-700 sm:text-[13px] dark:text-emerald-400">Dengan FeedDesigner</p>
            </div>
            <ul className="space-y-3">
              {PROMISES.map((p) => (
                <li key={p} className="flex items-start gap-2.5 text-[13.5px] leading-6 text-slate-700 sm:text-[14px] dark:text-slate-300">
                  <Check size={14} className="mt-1 shrink-0 text-emerald-500" />
                  <span>{p}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      {/* HOW IT WORKS */}
      <section id="how" aria-label="Cara kerja" className="relative z-10 border-y border-slate-200 bg-slate-50/60 dark:border-slate-800 dark:bg-slate-900/40">
        <div className="mx-auto max-w-6xl px-4 py-16 sm:px-5 sm:py-24 lg:px-8">
          <div className="mb-12 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">Cara kerja</p>
              <h2 className="mt-3 max-w-2xl text-[30px] font-semibold leading-[1.08] tracking-[-0.03em] sm:text-4xl text-slate-950 md:text-5xl dark:text-slate-100">
                Dari ide ke postingan dalam 4 langkah.
              </h2>
            </div>
            <p className="max-w-md text-[15px] leading-7 text-slate-600 dark:text-slate-400">
              Tidak perlu prompt engineering. Tidak perlu riset moodboard. Tidak perlu revisi manual. AI handle semuanya.
            </p>
          </div>

          <ol className="grid gap-px overflow-hidden rounded-xl border border-slate-200 bg-slate-200 sm:grid-cols-2 lg:grid-cols-4 dark:border-slate-800 dark:bg-slate-800">
            {STEPS.map((item) => (
              <li key={item.n} className="group flex flex-col gap-3 bg-white p-5 transition hover:bg-slate-50 sm:p-6 dark:bg-slate-900 dark:hover:bg-slate-800/60">
                <div className="flex items-center justify-between">
                  <span className="font-mono text-xs text-slate-400 dark:text-slate-500">{item.n}</span>
                  <div className="h-1.5 w-1.5 rounded-full bg-emerald-400 transition group-hover:scale-110" />
                </div>
                <h3 className="text-[15px] font-semibold tracking-tight text-slate-950 dark:text-slate-100">{item.title}</h3>
                <p className="text-[13px] leading-6 text-slate-600 dark:text-slate-400">{item.desc}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* FEATURES */}
      <section id="features" aria-label="Fitur unggulan" className="relative z-10 mx-auto max-w-6xl px-4 py-16 sm:px-5 sm:py-24 lg:px-8">
        <div className="mb-12 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">Fitur unggulan</p>
            <h2 className="mt-3 max-w-2xl text-[30px] font-semibold leading-[1.08] tracking-[-0.03em] sm:text-4xl text-slate-950 md:text-5xl dark:text-slate-100">
              Bukan sekadar AI image generator.
            </h2>
          </div>
          <p className="max-w-md text-[15px] leading-7 text-slate-600 dark:text-slate-400">
            Dibangun dari nol untuk kebutuhan carousel Instagram brand Indonesia — bukan tool serba guna yang setengah-setengah.
          </p>
        </div>

        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map((f) => <Feature key={f.title} {...f} />)}
        </div>
      </section>

      {/* SHOWCASE */}
      <ShowcaseSection onStart={onStart} />

      {/* USE CASES */}
      <section id="use-cases" aria-label="Cocok untuk siapa" className="relative z-10 border-t border-slate-200 bg-slate-50/60 dark:border-slate-800 dark:bg-slate-900/40">
        <div className="mx-auto max-w-6xl px-4 py-16 sm:px-5 sm:py-24 lg:px-8">
          <div className="mb-12 text-center">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">Cocok untuk siapa</p>
            <h2 className="mt-3 mx-auto max-w-2xl text-[30px] font-semibold leading-[1.08] tracking-[-0.03em] sm:text-4xl text-slate-950 md:text-5xl dark:text-slate-100">
              Siapapun yang posting di Instagram.
            </h2>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-3">
            {USE_CASES.map((uc) => (
              <div key={uc.title} className="flex flex-col rounded-2xl border border-slate-200 bg-white p-5 sm:p-6 dark:border-slate-800 dark:bg-slate-900">
                <div className="mb-4 grid h-11 w-11 place-items-center rounded-xl bg-slate-950 text-white sm:mb-5 dark:bg-white dark:text-slate-950">
                  <uc.icon size={18} strokeWidth={1.8} />
                </div>
                <h3 className="text-[15px] font-semibold text-slate-950 sm:text-[16px] dark:text-slate-100">{uc.title}</h3>
                <p className="mt-2 text-[13px] leading-6 text-slate-600 sm:text-[13.5px] dark:text-slate-400">{uc.desc}</p>
                <div className="mt-4 flex flex-wrap gap-1.5 sm:mt-5">
                  {uc.examples.map((ex) => (
                    <span key={ex} className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-medium text-slate-700 dark:bg-slate-800 dark:text-slate-300">{ex}</span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* COMPARE */}
      <section className="relative z-10 mx-auto max-w-6xl px-4 py-16 sm:px-5 sm:py-24 lg:px-8">
        <div className="mb-10 text-center sm:mb-12">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">Perbandingan</p>
          <h2 className="mt-3 mx-auto max-w-2xl text-[30px] font-semibold leading-[1.08] tracking-[-0.03em] sm:text-4xl text-slate-950 md:text-5xl dark:text-slate-100">
            Lebih cepat, lebih murah, lebih konsisten.
          </h2>
        </div>

        {/* mobile: stacked cards */}
        <div className="space-y-3 md:hidden">
          {COMPARE.map((row) => (
            <div key={row.feature} className="overflow-hidden rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
              <div className="border-b border-slate-200 bg-slate-50/70 px-4 py-2.5 text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-600 dark:border-slate-800 dark:bg-slate-800/70 dark:text-slate-300">
                {row.feature}
              </div>
              <dl className="divide-y divide-slate-100 text-[13px] dark:divide-slate-800">
                <div className="flex items-start justify-between gap-3 px-4 py-2.5">
                  <dt className="shrink-0 text-[11px] font-medium uppercase tracking-wider text-slate-400 dark:text-slate-500">Manual</dt>
                  <dd className="text-right text-slate-700 dark:text-slate-300">{row.manual}</dd>
                </div>
                <div className="flex items-start justify-between gap-3 px-4 py-2.5">
                  <dt className="shrink-0 text-[11px] font-medium uppercase tracking-wider text-slate-400 dark:text-slate-500">Agency</dt>
                  <dd className="text-right text-slate-700 dark:text-slate-300">{row.agency}</dd>
                </div>
                <div className="flex items-start justify-between gap-3 bg-slate-950 px-4 py-2.5 text-white dark:bg-white dark:text-slate-950">
                  <dt className="shrink-0 text-[11px] font-medium uppercase tracking-wider text-emerald-400 dark:text-emerald-600">FeedDesigner</dt>
                  <dd className="flex items-center gap-1.5 text-right font-medium">
                    <Check size={13} className="shrink-0 text-emerald-400 dark:text-emerald-600" />
                    {row.us}
                  </dd>
                </div>
              </dl>
            </div>
          ))}
        </div>

        {/* md+: full table */}
        <div className="hidden overflow-hidden rounded-2xl border border-slate-200 bg-white md:block dark:border-slate-800 dark:bg-slate-900">
          <div className="grid grid-cols-4 border-b border-slate-200 bg-slate-50/70 text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500 dark:border-slate-800 dark:bg-slate-800/70 dark:text-slate-400">
            <div className="px-4 py-3">Kriteria</div>
            <div className="px-4 py-3">Desain manual</div>
            <div className="px-4 py-3">Agency / freelancer</div>
            <div className="bg-slate-950 px-4 py-3 text-white dark:bg-white dark:text-slate-950">FeedDesigner</div>
          </div>
          {COMPARE.map((row, i) => (
            <div
              key={row.feature}
              className={`grid grid-cols-4 text-[13px] ${i !== COMPARE.length - 1 ? 'border-b border-slate-100 dark:border-slate-800' : ''}`}
            >
              <div className="px-4 py-3 font-medium text-slate-900 dark:text-slate-100">{row.feature}</div>
              <div className="px-4 py-3 text-slate-600 dark:text-slate-400">{row.manual}</div>
              <div className="px-4 py-3 text-slate-600 dark:text-slate-400">{row.agency}</div>
              <div className="flex items-center gap-2 bg-slate-950 px-4 py-3 font-medium text-white dark:bg-white dark:text-slate-950">
                <Check size={13} className="shrink-0 text-emerald-400 dark:text-emerald-600" />
                {row.us}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* PRICING (teaser) */}
      <section className="relative z-10 mx-auto max-w-6xl px-4 pb-16 sm:px-5 sm:pb-24 lg:px-8">
        <div className="mx-auto max-w-3xl rounded-2xl border border-slate-200 bg-gradient-to-br from-white to-slate-50 p-6 text-center sm:p-8 md:p-12 dark:border-slate-800 dark:from-slate-900 dark:to-slate-950">
          <div className="mx-auto mb-4 inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-[11px] font-medium text-emerald-700 sm:text-xs dark:border-emerald-900/50 dark:bg-emerald-950/40 dark:text-emerald-400">
            <InfinityIcon size={12} /> Gratis dipakai, bayar AI provider saja
          </div>
          <h2 className="text-[30px] font-semibold leading-[1.08] tracking-[-0.03em] sm:text-4xl text-slate-950 md:text-5xl dark:text-slate-100">
            Daftar gratis. Generate sepuasnya.
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-[14px] leading-7 text-slate-600 sm:mt-5 sm:text-[15px] dark:text-slate-400">
            Tidak ada paywall, tidak ada watermark. FeedDesigner berjalan di server kamu sendiri — biaya hanya mengalir ke provider AI yang kamu pilih, dan itu pun bisa pakai yang termurah.
          </p>
          <div className="mt-6 flex flex-col justify-center gap-3 sm:mt-7 sm:flex-row">
            <button
              onClick={onStart}
              onMouseEnter={handleHover}
              onFocus={handleHover}
              className="inline-flex items-center justify-center gap-2 rounded-md bg-slate-950 px-5 py-3 text-sm font-medium text-white transition hover:bg-slate-800 dark:bg-white dark:text-slate-950 dark:hover:bg-slate-200"
            >
              Generate carousel pertama <ArrowRight size={15} />
            </button>
          </div>
          <div className="mt-6 flex flex-wrap items-center justify-center gap-x-4 gap-y-1.5 text-[11px] text-slate-500 sm:gap-x-5 sm:gap-y-2 dark:text-slate-400">
            <span className="flex items-center gap-1"><Check size={11} className="text-emerald-500" /> Daftar gratis</span>
            <span className="flex items-center gap-1"><Check size={11} className="text-emerald-500" /> Tanpa watermark</span>
            <span className="flex items-center gap-1"><Check size={11} className="text-emerald-500" /> Generate sepuasnya</span>
            <span className="flex items-center gap-1"><Check size={11} className="text-emerald-500" /> Export WebP/PNG</span>
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section id="faq" aria-label="Pertanyaan yang sering ditanyakan" className="relative z-10 border-t border-slate-200 bg-slate-50/60 dark:border-slate-800 dark:bg-slate-900/40">
        <div className="mx-auto max-w-4xl px-4 py-16 sm:px-5 sm:py-24 lg:px-8">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">FAQ</p>
          <h2 className="mt-3 text-[30px] font-semibold leading-[1.08] tracking-[-0.03em] sm:text-4xl text-slate-950 md:text-5xl dark:text-slate-100">
            Pertanyaan yang sering ditanyakan.
          </h2>

          <div className="mt-8 divide-y divide-slate-200 overflow-hidden rounded-xl border border-slate-200 bg-white sm:mt-10 dark:divide-slate-800 dark:border-slate-800 dark:bg-slate-900">
            {FAQ.map((item, i) => (
              <details key={i} className="group" {...(i === 0 ? { open: true } : {})}>
                <summary className="flex cursor-pointer list-none items-center justify-between gap-4 p-4 transition hover:bg-slate-50 sm:gap-6 sm:p-5 dark:hover:bg-slate-800/50">
                  <span className="text-[14px] font-medium text-slate-950 sm:text-[15px] dark:text-slate-100">{item.q}</span>
                  <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full border border-slate-200 text-slate-500 transition group-open:rotate-45 group-open:border-slate-950 group-open:bg-slate-950 group-open:text-white dark:border-slate-700 dark:text-slate-400 dark:group-open:border-white dark:group-open:bg-white dark:group-open:text-slate-950">
                    <span className="text-lg leading-none">+</span>
                  </span>
                </summary>
                <div className="px-4 pb-4 text-[13.5px] leading-7 text-slate-600 sm:px-5 sm:pb-5 sm:text-[14px] dark:text-slate-400">{item.a}</div>
              </details>
            ))}
          </div>
        </div>
      </section>

      {/* FINAL CTA */}
      <section className="relative z-10 mx-auto max-w-6xl px-4 py-16 sm:px-5 sm:py-24 lg:px-8">
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-gradient-to-br from-slate-950 via-slate-900 to-slate-800 p-6 text-white sm:p-10 md:p-16">
          <div className="relative">
            <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.18em] text-slate-400 sm:text-xs">
              <TrendingUp size={13} /> <span className="truncate">Untuk brand yang serius soal konsistensi feed</span>
            </div>
            <h2 className="mt-4 max-w-2xl text-[30px] font-semibold leading-[1.08] tracking-[-0.03em] sm:text-4xl md:text-5xl">
              Kompetitor kamu posting tiap hari.<br />
              <span className="text-slate-400">Kamu kapan?</span>
            </h2>
            <p className="mt-5 max-w-lg text-[14px] leading-7 text-slate-300 sm:text-[15px]">
              Dengan FeedDesigner, kamu bisa generate carousel berkualitas agency dalam 30 detik. Daftar gratis, langsung pakai. Tidak ada alasan lagi untuk jarang posting.
            </p>
            <div className="mt-7 flex flex-col gap-3 sm:mt-8 sm:flex-row">
              <button onClick={onStart} onMouseEnter={handleHover} onFocus={handleHover} className="group inline-flex items-center justify-center gap-2 rounded-md bg-white px-5 py-3 text-sm font-medium text-slate-950 transition hover:bg-slate-100">
                Generate carousel pertama saya
                <ArrowRight size={15} className="transition group-hover:translate-x-0.5" />
              </button>
              <a href="#showcase" className="inline-flex items-center justify-center gap-2 rounded-md border border-white/20 bg-white/5 px-5 py-3 text-sm font-medium text-white transition hover:bg-white/10">
                Intip hasil lain dulu
              </a>
            </div>
            <div className="mt-7 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[11px] text-slate-400 sm:mt-8 sm:gap-x-5 sm:gap-y-2 sm:text-xs">
              <span className="flex items-center gap-1.5"><Clock size={11} /> Siap dalam &lt; 60 detik</span>
              <span className="flex items-center gap-1.5"><Lock size={11} /> Data tidak dibagikan</span>
              <span className="flex items-center gap-1.5"><Target size={11} /> Sekali setup, pakai selamanya</span>
            </div>
          </div>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="relative z-10 border-t border-slate-200 dark:border-slate-800">
        <div className="mx-auto flex max-w-6xl flex-col gap-4 px-4 py-8 sm:gap-6 sm:px-5 sm:py-10 lg:flex-row lg:items-center lg:justify-between lg:px-8">
          <div className="flex items-center gap-3">
            <Brand />
            <span className="hidden text-xs text-slate-500 md:inline dark:text-slate-400">— AI studio carousel Instagram untuk brand Indonesia</span>
          </div>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[11px] text-slate-500 sm:gap-x-6 sm:gap-y-2 sm:text-xs dark:text-slate-400">
            <span className="flex items-center gap-1.5"><Palette size={11} /> Design system locked</span>
            <span className="flex items-center gap-1.5"><Cpu size={11} /> OpenAI-compatible</span>
            <span className="flex items-center gap-1.5"><ImageIcon size={11} /> WebP output</span>
            <span className="flex items-center gap-1.5"><Bot size={11} /> v0.3.0</span>
          </div>
        </div>
      </footer>
    </main>
  )
}

export default memo(Landing)
