import 'dotenv/config'
import express from 'express'
import cors from 'cors'
import compression from 'compression'
import helmet from 'helmet'
import rateLimit from 'express-rate-limit'
import cookieParser from 'cookie-parser'
import {
  compressAndStoreImage, convertStoredImageToPng, countUsers, countUserGenerations24h, createGenerationId,
  createSlideId, createUser, createUserId, deleteGeneration, deleteUser,
  getGeneration, getSetting, getUserByEmail, getUserStats, imagesDir, isGenerationOwnedBy,
  listAllAuthEvents, listAllGenerations, listAllSettings, listAuthEvents, listGenerations,
  listShowcaseSlides, listUsers, logAuthEvent, platformStats, processUploadedImage, resolveImagePath,
  saveGeneration, saveSlide, setGenerationPublic, setSetting, setUserRole, userRole,
} from './storage.js'
import {
  authMiddleware, clearAuthCookies, hashPassword, requireAdmin, requireAuth, requireCsrfIfCookie,
  setAuthCookies, signToken, verifyPassword,
} from './auth.js'
import { fileURLToPath as _toPath } from 'node:url'
import _nodePath from 'node:path'
import _nodeFs from 'node:fs'

const app = express()
const PORT = process.env.PORT || 8787

// When running behind a reverse proxy (nginx, ngrok, cloudflare), trust one
// hop so req.ip reflects the real client. Customize with TRUST_PROXY env if
// you have multiple hops.
if (process.env.TRUST_PROXY) {
  app.set('trust proxy', process.env.TRUST_PROXY === 'true' ? 1 : process.env.TRUST_PROXY)
}

const OPENAI_BASE_URL = process.env.OPENAI_BASE_URL || 'https://r5d6xug.9router.com/v1'
const OPENAI_API_KEY = process.env.OPENAI_API_KEY
const OPENAI_IMAGE_MODEL = process.env.OPENAI_IMAGE_MODEL || 'cx/gpt-5.4'
const REQUEST_TIMEOUT_MS = Number(process.env.AI_REQUEST_TIMEOUT_MS) || 180_000

// Pre-computed auth header so we are not rebuilding it on every request.
const AUTH_HEADER = OPENAI_API_KEY ? { Authorization: `Bearer ${OPENAI_API_KEY}` } : null

// ---------- Input caps (server-side defense against abuse) ----------
const FIELD_CAPS = {
  topic: 500,
  brandName: 120,
  audience: 240,
  colorPalette: 240,
  captionTone: 240,
  extraNotes: 2000,
}

/** Trim + enforce max length on a user string field. Returns '' for falsy. */
function clip(value, max) {
  if (value == null) return ''
  const s = String(value)
  return s.length > max ? s.slice(0, max) : s
}

/** Validate + normalize the brief payload so downstream logic never has to
 *  defend against monster strings or bad types. */
function sanitizeBrief(body = {}) {
  return {
    brandName:    clip(body.brandName, FIELD_CAPS.brandName).trim(),
    topic:        clip(body.topic, FIELD_CAPS.topic).trim(),
    audience:     clip(body.audience, FIELD_CAPS.audience).trim(),
    colorPalette: clip(body.colorPalette, FIELD_CAPS.colorPalette).trim(),
    captionTone:  clip(body.captionTone, FIELD_CAPS.captionTone).trim(),
    extraNotes:   clip(body.extraNotes, FIELD_CAPS.extraNotes).trim(),
    format:       clip(body.format, 40).trim(),
    // Language used for on-canvas text. Trimmed & length-capped so a
    // malicious value can't balloon the prompt or smuggle extra
    // instructions — the prompt builders quote it as a single token.
    language:     clip(body.language, 32).trim() || 'Indonesian',
    mode:         body.mode === 'carousel' ? 'carousel' : 'single',
    totalSlides:  Math.max(1, Math.min(10, Number(body.totalSlides) || 1)),
    slideIndex:   Math.max(1, Math.min(10, Number(body.slideIndex) || 1)),
  }
}

// ---------- Security middleware ----------

// helmet sets sane defaults: X-Content-Type-Options, Referrer-Policy,
// X-DNS-Prefetch-Control, X-Frame-Options, etc. We disable the CSP helper
// because the SPA inlines styles + blob imagery + lazy chunks; instead we
// set a focused CSP further down that fits this app's needs.
app.use(helmet({
  contentSecurityPolicy: false,
  crossOriginEmbedderPolicy: false,
  // Allow images/resources to be loaded cross-origin (needed when
  // VITE_API_BASE_URL points to a different domain than the frontend).
  crossOriginResourcePolicy: { policy: 'cross-origin' },
}))

// Lightweight CSP tailored for the SPA:
// - script sources: self + unsafe-eval (Vite dev uses eval); drop unsafe-eval
//   in a production build by overriding CSP_SCRIPT_SRC env.
// - style sources: inline allowed because Tailwind v4 uses inline <style>.
// - connect: allow upstream AI provider + same-origin.
const cspConnectSrc = ["'self'", OPENAI_BASE_URL.replace(/\/.*$/, '')].join(' ')
app.use((_req, res, next) => {
  res.setHeader(
    'Content-Security-Policy',
    [
      "default-src 'self'",
      `script-src 'self' 'unsafe-inline' ${process.env.CSP_SCRIPT_SRC || "'unsafe-eval'"}`,
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: blob: https:",
      "font-src 'self' data:",
      `connect-src ${cspConnectSrc}`,
      "frame-ancestors 'none'",
      "base-uri 'self'",
      "form-action 'self'",
    ].join('; '),
  )
  next()
})

app.disable('x-powered-by')
app.disable('etag')
// Compression — skip tiny payloads (<1 KB: not worth the CPU round-trip) and
// let sharp-emitted WebP/PNG bytes pass through untouched since they are
// already compressed.
app.use(compression({
  threshold: 1024,
  filter: (req, res) => {
    const type = res.getHeader('Content-Type') || ''
    if (typeof type === 'string' && /^image\//i.test(type)) return false
    return compression.filter(req, res)
  },
}))

// CORS: allow a comma-separated list of origins via env. For cookie-based
// auth we MUST reflect the request origin (wildcard doesn't work with
// `credentials: include`), so if no allowlist is configured we fall back
// to reflecting whatever origin is asking — convenient for dev + ngrok.
// In production, always set CORS_ORIGINS explicitly.
const CORS_ORIGINS = (process.env.CORS_ORIGINS || '').split(',').map((s) => s.trim()).filter(Boolean)
app.use(cors({
  origin: CORS_ORIGINS.length
    ? (origin, cb) => cb(null, !origin || CORS_ORIGINS.includes(origin))
    : (origin, cb) => cb(null, origin || true),
  credentials: true,
}))

// Body parsers: scoped per route so each endpoint has a tailored size cap.
// Default `smallJson` (auth + admin routes) is 256kb; `generateJson` for
// generation endpoints that embed designBrief + storyboard; `uploadJson`
// for base64 image data URLs.
const smallJson = express.json({ limit: '256kb' })
const generateJson = express.json({ limit: '512kb' })
const uploadJson = express.json({ limit: '14mb' })

// Cookie parser must run before authMiddleware so cookies are accessible.
app.use(cookieParser())
app.use(authMiddleware)
// CSRF guard for cookie-based auth. Bearer-only requests (no auth cookie)
// bypass this since an attacker cannot forge the Authorization header
// cross-origin.
app.use(requireCsrfIfCookie)

// Rate limiters. Key on `req.user.id` when authed, otherwise IP — that way
// a shared office IP isn't globally throttled by one busy user. All return
// JSON so the SPA can render them consistently.
const keyForUserOrIp = (req) => (req.user?.id ? `u:${req.user.id}` : `ip:${req.ip}`)

const authLimiter = rateLimit({
  windowMs: 10 * 60 * 1000, // 10 minutes
  limit: 10,                 // 10 auth attempts per window
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  keyGenerator: keyForUserOrIp,
  message: { error: 'Terlalu banyak percobaan login. Coba lagi nanti.' },
})

const uploadLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  limit: 40,                 // 40 uploads / hour
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  keyGenerator: keyForUserOrIp,
  message: { error: 'Batas upload per jam tercapai. Coba lagi nanti.' },
})

const generateLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  limit: 60,                 // 60 generations / hour per user
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  keyGenerator: keyForUserOrIp,
  message: { error: 'Batas generate per jam tercapai. Coba lagi nanti.' },
})

// Timed fetch wrapper so the Express request does not hang if the upstream AI
// provider stalls.
async function fetchWithTimeout(url, init = {}, timeoutMs = REQUEST_TIMEOUT_MS) {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  try {
    return await fetch(url, { ...init, signal: controller.signal })
  } finally {
    clearTimeout(timer)
  }
}

/**
 * Fetch with automatic retry. Retries once on 5xx (upstream overloaded) with
 * a short backoff. Does NOT retry on timeout — if the provider can't respond
 * in REQUEST_TIMEOUT_MS, a second attempt is unlikely to help and would just
 * double the user's wait time. The user can manually retry the failed slide.
 */
async function fetchWithRetry(url, init = {}, { timeoutMs = REQUEST_TIMEOUT_MS, retries = 1, backoffMs = 3000 } = {}) {
  let lastError
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const res = await fetchWithTimeout(url, init, timeoutMs)
      // Retry on 5xx (upstream overloaded) but NOT on 4xx (client error).
      if (res.status >= 500 && attempt < retries) {
        await new Promise((r) => setTimeout(r, backoffMs * (attempt + 1)))
        continue
      }
      return res
    } catch (err) {
      lastError = err
      // Only retry on network errors (ECONNRESET, etc), NOT on timeout
      // (AbortError) — retrying a timeout just doubles the wait.
      if (err.name === 'AbortError') throw err
      if (attempt < retries) {
        await new Promise((r) => setTimeout(r, backoffMs * (attempt + 1)))
        continue
      }
    }
  }
  throw lastError
}

// ---------- Tiny in-process caches ----------
//
// We use plain Maps with TTL for a handful of hot paths to avoid hammering
// SQLite on every request. Keys are small, values are small, and the caches
// are bounded by time — so there's no slow leak in long-running processes.

/** Single-value cache with TTL. */
function createTTLCache(ttlMs) {
  let value, expires = 0
  return {
    get() { return Date.now() < expires ? value : undefined },
    set(v) { value = v; expires = Date.now() + ttlMs },
    invalidate() { expires = 0 },
  }
}

/** Bounded LRU cache (insertion-order Map trick — delete then set on hit). */
function createLRU(maxEntries, ttlMs) {
  const map = new Map()
  return {
    get(key) {
      const entry = map.get(key)
      if (!entry) return undefined
      if (Date.now() > entry.expires) { map.delete(key); return undefined }
      // Refresh recency.
      map.delete(key); map.set(key, entry)
      return entry.value
    },
    set(key, value) {
      if (map.has(key)) map.delete(key)
      map.set(key, { value, expires: Date.now() + ttlMs })
      if (map.size > maxEntries) {
        // Delete the oldest (insertion-order) entry.
        map.delete(map.keys().next().value)
      }
    },
    delete(key) { map.delete(key) },
  }
}

// Feature-flag cache: settings are read on nearly every request (by the
// maintenance/registration middleware) but change rarely. A 5 s TTL keeps
// admin toggles responsive while eliminating the repeated SELECT traffic.
const SETTINGS_TTL_MS = 5000
const settingsCache = new Map()
function cachedSetting(key, fallback) {
  const entry = settingsCache.get(key)
  if (entry && Date.now() < entry.expires) return entry.value
  const value = getSetting(key, fallback)
  settingsCache.set(key, { value, expires: Date.now() + SETTINGS_TTL_MS })
  return value
}
function invalidateSettingsCache() { settingsCache.clear() }

// Showcase cache — landing page hits this on every visit. Generations opt
// in/out rarely, so a 30 s TTL is a comfortable sweet spot.
const showcaseCache = createTTLCache(30_000)
const showcaseDetailCache = createLRU(64, 30_000)

// Transcoded PNG cache. The /api/images/:file.png endpoint re-encodes on
// every hit; caching keeps the second download of the same slide ~free.
// 64 entries × <2 MB each = ~128 MB upper bound, which is fine for a
// single-box deploy and gets reclaimed on restart.
const pngCache = createLRU(64, 10 * 60 * 1000)

// Read a stored upload from disk and return as a data URL, so we can pass it
// inline to image-to-image endpoints without another fetch round-trip.
// NOTE: legacy helper — user uploads are no longer persisted, they come in
// inline on each generate call. Kept as a no-op safeguard in case a caller
// still references it; the code path that used it was removed.


app.get('/api/health', (_req, res) => {
  res.set('Cache-Control', 'no-store').json({
    ok: true,
    model: OPENAI_IMAGE_MODEL,
    configured: Boolean(OPENAI_API_KEY),
  })
})

/* ---------- auth ---------- */

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

// Comma-separated list of emails that should be promoted to admin role on
// their first registration. Empty means no auto-promotion — you can still
// flip a user to admin via the admin UI once any admin exists, or hand-edit
// the SQLite row. Matching is case-insensitive.
const ADMIN_EMAILS = new Set(
  (process.env.ADMIN_EMAILS || '')
    .split(',')
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean),
)

function publicUser(user) {
  if (!user) return null
  return {
    id: user.id,
    email: user.email,
    name: user.name || null,
    role: user.role || 'user',
    createdAt: user.created_at,
  }
}

/** Pull minimal client metadata out of a request for audit logs. */
function clientMeta(req) {
  return { ip: req.ip || null, userAgent: req.headers['user-agent'] || null }
}

app.post('/api/auth/register', authLimiter, smallJson, async (req, res) => {
  try {
    const { email, password, name } = req.body || {}
    const cleanEmail = String(email || '').trim().toLowerCase().slice(0, 200)
    const cleanName = typeof name === 'string' ? name.trim().slice(0, 80) : ''
    if (!EMAIL_RE.test(cleanEmail)) return res.status(400).json({ error: 'Format email tidak valid.' })
    if (!password || String(password).length < 6 || String(password).length > 200) {
      return res.status(400).json({ error: 'Password minimal 6 karakter.' })
    }
    if (getUserByEmail(cleanEmail)) return res.status(409).json({ error: 'Email sudah terdaftar.' })

    const hashed = await hashPassword(String(password))
    const user = createUser({ id: createUserId(), email: cleanEmail, name: cleanName, password: hashed })
    // Auto-promote to admin for seeded emails, or promote the very first user
    // (bootstrap case so the instance always has an admin available).
    const shouldPromote = ADMIN_EMAILS.has(cleanEmail) || countUsers() === 1
    if (shouldPromote) {
      setUserRole(user.id, 'admin')
      user.role = 'admin'
    }
    logAuthEvent({ userId: user.id, email: user.email, event: 'register', ...clientMeta(req) })
    const token = signToken({ sub: user.id, email: user.email, name: user.name || undefined, role: user.role || 'user' })
    const csrf = setAuthCookies(res, token)
    res.json({ token, csrf, user: publicUser(user) })
  } catch (error) {
    console.error('[register]', error); res.status(500).json({ error: 'Gagal membuat akun.' })
  }
})

// Dummy hash used to burn ~equal CPU when a login attempt hits a non-existent
// email. This hides the existence of the account from timing-based probing.
// Computed once at startup; the value itself is irrelevant.
let DUMMY_HASH = null
hashPassword('__dummy_password_for_timing_safety__').then((h) => { DUMMY_HASH = h })

app.post('/api/auth/login', authLimiter, smallJson, async (req, res) => {
  try {
    const { email, password } = req.body || {}
    const cleanEmail = String(email || '').trim().toLowerCase().slice(0, 200)
    const cleanPass = String(password || '').slice(0, 200)
    const user = EMAIL_RE.test(cleanEmail) ? getUserByEmail(cleanEmail) : null
    // Always run verifyPassword — against the real hash if the user exists,
    // otherwise against a dummy hash — so the response time doesn't leak
    // whether the email is registered.
    const ok = await verifyPassword(cleanPass, user?.password || DUMMY_HASH || '')
    if (!user || !ok) {
      logAuthEvent({ email: cleanEmail || null, event: 'login_fail', ...clientMeta(req) })
      return res.status(401).json({ error: 'Email atau password salah.' })
    }
    logAuthEvent({ userId: user.id, email: user.email, event: 'login_ok', ...clientMeta(req) })
    const token = signToken({ sub: user.id, email: user.email, name: user.name || undefined, role: user.role || 'user' })
    const csrf = setAuthCookies(res, token)
    res.json({ token, csrf, user: publicUser(user) })
  } catch (error) {
    console.error('[login]', error); res.status(500).json({ error: 'Gagal login.' })
  }
})

app.post('/api/auth/logout', requireAuth, (req, res) => {
  // Stateless JWT means we can't actually revoke the token server-side, but
  // we still log the event so a user can audit their own session activity
  // and we clear any cookie set on this origin.
  logAuthEvent({ userId: req.user.id, email: req.user.email, event: 'logout', ...clientMeta(req) })
  clearAuthCookies(res)
  res.json({ ok: true })
})

app.get('/api/auth/events', requireAuth, (req, res) => {
  // Let a signed-in user review their own auth history (logins, failures,
  // logouts). Limit is capped in storage.js.
  const limit = Number(req.query.limit) || 50
  const events = listAuthEvents(req.user.id, limit).map((row) => ({
    id: row.id,
    event: row.event,
    ip: row.ip,
    userAgent: row.user_agent,
    createdAt: row.created_at,
  }))
  res.set('Cache-Control', 'no-store')
  res.json({ events })
})

app.get('/api/auth/me', requireAuth, (req, res) => {
  // Re-read role from DB so role changes take effect without requiring
  // the user to sign out and back in.
  const currentRole = userRole(req.user.id)
  req.user.role = currentRole

  // Log session resume so the audit trail captures activity even when the
  // user reconnects via an existing cookie (no login_ok event fires).
  logAuthEvent({ userId: req.user.id, email: req.user.email, event: 'session_resume', ...clientMeta(req) })

  // Only re-issue cookies when the auth cookie is missing (legacy bearer
  // migration). If both cookies are present, leave them alone — rotating
  // the CSRF token here causes race conditions where the client reads the
  // old cookie value while the new one is still in-flight.
  if (!req.cookies?.fd_auth) {
    const token = signToken({
      sub: req.user.id, email: req.user.email, name: req.user.name, role: currentRole,
    })
    const csrf = setAuthCookies(res, token)
    return res.json({ user: req.user, csrf })
  }
  res.json({ user: req.user })
})

/* ---------- uploads (product + reference images) ---------- */

const UPLOAD_KINDS = new Set(['product', 'reference', 'logo'])
const DATA_URL_RE = /^data:(image\/(?:png|jpeg|jpg|webp|gif));base64,([A-Za-z0-9+/=]+)$/
const MAX_UPLOAD_BYTES = 10 * 1024 * 1024 // 10 MB decoded

// Upload JSON bodies are base64-encoded images, which need a much bigger cap
// than the default 256kb applied globally. Keep the larger parser scoped to
// this single endpoint to limit DoS surface.
app.post('/api/uploads', requireAuth, uploadLimiter, uploadJson, async (req, res) => {
  try {
    const { image, kind } = req.body || {}
    if (!UPLOAD_KINDS.has(kind)) return res.status(400).json({ error: 'Jenis upload tidak valid.' })
    if (typeof image !== 'string' || !image) return res.status(400).json({ error: 'Gambar tidak ditemukan.' })
    const match = image.match(DATA_URL_RE)
    if (!match) return res.status(400).json({ error: 'Format gambar harus data URL (png/jpg/webp/gif).' })

    const buffer = Buffer.from(match[2], 'base64')
    if (buffer.length === 0) return res.status(400).json({ error: 'Gambar kosong.' })
    if (buffer.length > MAX_UPLOAD_BYTES) return res.status(413).json({ error: 'Ukuran gambar maksimal 10 MB.' })

    // Process the image in memory: normalize orientation, cap size, compress
    // to WebP. Nothing is written to disk or the database — the processed
    // bytes are returned to the caller as a data URL so the browser can keep
    // them in memory and ship them inline on the next generate call.
    const record = await processUploadedImage({ buffer, kind })
    res.json(record)
  } catch (error) {
    console.error('[upload]', error); res.status(500).json({ error: 'Gagal mengupload gambar.' })
  }
})

app.post('/api/create-carousel-plan', requireAuth, generateLimiter, generateJson, async (req, res) => {
  try {
    const brief = sanitizeBrief(req.body)
    const { topic, audience, brandName, colorPalette, format, captionTone, extraNotes, language } = brief
    if (!topic) return res.status(400).json({ error: 'Topik wajib diisi.' })

    const total = Math.max(2, Math.min(Number(req.body?.totalSlides) || 3, 10))
    const fallbackPlan = buildCarouselPlan({ topic, totalSlides: total })

    if (AUTH_HEADER) {
      try {
        const response = await fetchWithTimeout(`${OPENAI_BASE_URL}/chat/completions`, {
          method: 'POST',
          headers: { ...AUTH_HEADER, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            model: OPENAI_IMAGE_MODEL,
            messages: [
              { role: 'system', content: PLANNER_SYSTEM },
              { role: 'user', content: buildPlannerPrompt({ topic, audience, total, brandName, colorPalette, format, captionTone, extraNotes, language }) },
            ],
            temperature: 1.05,
          }),
        }, 60_000)

        const data = await response.json()
        const raw = data?.choices?.[0]?.message?.content
        const parsed = JSON.parse(String(raw || '').replace(/```json|```/g, '').trim())
        if (Array.isArray(parsed?.slides) && parsed.slides.length >= total) {
          return res.json({
            designBrief: validateDesignBrief(parsed.designBrief),
            slides: parsed.slides.slice(0, total).map((slide, index) => normalizeSlide(slide, fallbackPlan[index], index + 1)),
          })
        }
      } catch (_error) {
        // Deterministic fallback below.
      }
    }

    res.json({ designBrief: null, slides: fallbackPlan })
  } catch (error) {
    console.error('[plan]', error); res.status(500).json({ error: 'Gagal membuat materi carousel.' })
  }
})

app.post('/api/generate-feed', requireAuth, generateLimiter, generateJson, async (req, res) => {
  try {
    const brief = sanitizeBrief(req.body)
    const { brandName, topic, audience, colorPalette, format, captionTone, extraNotes, mode, language } = brief
    const {
      slideContent, carouselSlides, designBrief, generationId: clientGenerationId,
      productImage, referenceImages, logoImage,
    } = req.body

    if (!topic) return res.status(400).json({ error: 'Topik feed wajib diisi.' })
    if (!AUTH_HEADER) return res.status(500).json({ error: 'OPENAI_API_KEY belum diatur di file .env.' })

    const isCarousel = mode === 'carousel'
    const total = brief.totalSlides
    const current = brief.slideIndex

    // Resolve uploaded images from the request body. User images are NEVER
    // persisted server-side — the client sends them inline as data URLs on
    // every generate call, so the product/reference/logo images live only
    // in this request's memory. We sanity-check each one and drop anything
    // that doesn't match a basic data-URL shape to avoid forwarding junk
    // upstream.
    const isImageDataUrl = (v) => typeof v === 'string' && DATA_URL_RE.test(v)
    const productUpload = isImageDataUrl(productImage) ? productImage : null
    const referenceUploads = Array.isArray(referenceImages)
      ? referenceImages.filter(isImageDataUrl).slice(0, 4)
      : []
    const logoUpload = isImageDataUrl(logoImage) ? logoImage : null
    const hasLogo = Boolean(logoUpload)

    // Generation record is created on slide 1, reused across subsequent slides.
    const generationId = clientGenerationId || createGenerationId()
    const isFirstSlide = current === 1

    // Enforce the admin-configurable daily cap before we hit the upstream
    // provider. Only count against the cap on slide 1 — subsequent slides of
    // the same carousel share a generationId and shouldn't eat the budget.
    const dailyLimit = Number(getSetting('generateDailyLimit', 0)) || 0
    if (isFirstSlide && dailyLimit > 0 && req.user.role !== 'admin') {
      const used = countUserGenerations24h(req.user.id)
      if (used >= dailyLimit) {
        return res.status(429).json({
          error: `Limit generate harian tercapai (${dailyLimit}/hari). Coba lagi besok.`,
          dailyLimit,
          used,
        })
      }
    }

    let prompt
    if (isCarousel) {
      const fallbackCarouselPlan = buildCarouselPlan({ topic, totalSlides: total })
      const carouselPlan = normalizeCarouselPlan(
        Array.isArray(carouselSlides) && carouselSlides.length ? carouselSlides : fallbackCarouselPlan,
        fallbackCarouselPlan,
      )
      const slideBrief = normalizeSlide(slideContent || carouselPlan[current - 1], fallbackCarouselPlan[current - 1], current)
      prompt = buildCarouselPrompt({
        brandName, topic, audience, extraNotes, format,
        total, current, carouselPlan, slideBrief,
        designBrief: validateDesignBrief(designBrief),
        hasLogo, language,
      })
    } else {
      prompt = buildSinglePrompt({
        brandName, topic, audience, colorPalette, format,
        captionTone, extraNotes,
        hasLogo, language,
      })
    }

    const size = format === 'portrait 4:5' ? '1024x1280' : format === 'story 9:16' ? '1024x1792' : '1024x1024'

    // Quality: 'auto' lets the provider pick the best trade-off between speed
    // and fidelity. Override via AI_IMAGE_QUALITY env if you want to force
    // 'high' (slower but sharper) or 'low' (fastest, good for drafts).
    const imageQuality = process.env.AI_IMAGE_QUALITY || 'auto'

    const requestBody = {
      model: OPENAI_IMAGE_MODEL,
      prompt,
      n: 1,
      size,
      quality: imageQuality,
      background: 'auto',
      output_format: 'png',
      response_format: 'b64_json',
    }

    // Attach uploaded images inline to the upstream request. Sources are now
    // plain data-URL strings — no disk read, no upload DB lookup. Providers
    // that support image-to-image / reference conditioning will honour these;
    // others silently ignore the extra fields.
    const attachedImages = []
    if (productUpload) attachedImages.push(productUpload)
    if (logoUpload) attachedImages.push(logoUpload)
    for (const ref of referenceUploads) attachedImages.push(ref)
    if (attachedImages.length) {
      requestBody.image = attachedImages[0]
      if (attachedImages.length > 1) requestBody.reference_images = attachedImages.slice(1)
      // Preserve identity of product/reference/logo as faithfully as possible.
      // Supported by image-edit endpoints: low | high | auto | original.
      requestBody.input_fidelity = 'high'
    }

    const response = await fetchWithRetry(`${OPENAI_BASE_URL}/images/generations`, {
      method: 'POST',
      headers: { ...AUTH_HEADER, 'Content-Type': 'application/json' },
      body: JSON.stringify(requestBody),
    })

    const data = await response.json().catch(() => ({}))

    if (!response.ok) {
      // Never echo the upstream response body back to the client — it can
      // leak provider-internal metadata. Just surface a human-readable
      // message and keep the original status code.
      const message = data?.error?.message || data?.message || (
        response.status >= 500
          ? `Provider AI sedang bermasalah (HTTP ${response.status}). Coba lagi nanti.`
          : 'Gagal membuat gambar dari AI.'
      )
      return res.status(response.status >= 500 ? 502 : response.status).json({ error: String(message).slice(0, 500) })
    }

    const item = data?.data?.[0]
    if (!item?.b64_json) {
      if (item?.url) return res.json({ image: item.url, prompt, generationId, persisted: false })
      return res.status(502).json({ error: 'Respons AI tidak berisi gambar.' })
    }

    const pngBuffer = Buffer.from(item.b64_json, 'base64')

    if (isFirstSlide) {
      // When the admin has flipped `showcasePublicDefault` on, newly created
      // generations are public out of the box. Otherwise stays private and
      // the user can opt-in from the dashboard.
      const publicByDefault = getSetting('showcasePublicDefault', false) ? 1 : 0
      saveGeneration({
        id: generationId,
        user_id: req.user.id,
        created_at: Date.now(),
        mode: isCarousel ? 'carousel' : 'single',
        topic,
        brand_name: brandName || null,
        purpose: null,
        audience: audience || null,
        style: null,
        palette: colorPalette || null,
        format: format || null,
        cta: null,
        tone: captionTone || null,
        extra_notes: extraNotes || null,
        total_slides: isCarousel ? total : 1,
        seed: null,
        brief_json: JSON.stringify(brief),
      })
      if (publicByDefault) {
        // Shortest path — set via the existing helper so the update takes the
        // same row-ownership checks as the user-facing toggle.
        setGenerationPublic(generationId, req.user.id, true)
      }
    }

    const stored = await compressAndStoreImage({ generationId, slideIndex: current, pngBuffer })
    const slideId = createSlideId()
    saveSlide({
      id: slideId,
      generation_id: generationId,
      slide_index: current,
      file_name: stored.fileName,
      mime_type: stored.mimeType,
      width: stored.width,
      height: stored.height,
      bytes_original: stored.bytesOriginal,
      bytes_stored: stored.bytesStored,
      prompt,
      role: isCarousel ? (slideContent?.role || null) : null,
      headline: isCarousel ? (slideContent?.headline || null) : null,
      created_at: Date.now(),
    })

    res.json({
      image: `/api/images/${stored.fileName}`,
      prompt,
      generationId,
      slideId,
      slideIndex: current,
      bytesOriginal: stored.bytesOriginal,
      bytesStored: stored.bytesStored,
      persisted: true,
    })
  } catch (error) {
    if (error.name === 'AbortError') {
      return res.status(504).json({ error: 'Request ke AI timeout. Slide ini bisa di-retry tanpa generate ulang seluruh carousel.' })
    }
    // Log the real error server-side for debugging, but return a generic
    // message to the client so we don't leak stack traces / paths / SQL bits.
    console.error('[generate-feed]', error)
    res.status(500).json({ error: 'Server error.' })
  }
})

// ---------- Prompt builders ----------

const PLANNER_SYSTEM = 'Reply ONLY with valid JSON (no markdown fences, no commentary). Render all text in the image in the language specified by the user (field "language"). Default to Indonesian if unspecified.'

/** Build a bullet list of user-provided brief fields, skipping empties. */
function briefLines(entries) {
  return entries
    .filter(([, value]) => value != null && String(value).trim() !== '')
    .map(([label, value]) => `- ${label}: ${value}`)
    .join('\n')
}

function buildPlannerPrompt({ topic, audience, total, brandName, colorPalette, format, captionTone, extraNotes, language }) {
  const lang = language || 'Indonesian'
  const lines = briefLines([
    ['Brand', brandName],
    ['Topic', topic],
    ['Audience', audience],
    ['Copy tone', captionTone],
    ['Format', format],
    ['Slides', total],
    ['Palette preference', colorPalette],
    ['Extra notes', extraNotes],
    ['Output language', lang],
  ])

  return `Plan an Instagram carousel. You have total creative freedom — any visual direction is fair game.

USER BRIEF
${lines}

Task: fill the designBrief with concrete values, then write ${total} slides. All rendered text and copy use ${lang}.

The designBrief is the single source of truth that ${total} per-slide prompts will reuse verbatim — so commit to exact values. Pick specific colors (real hex), specific typeface names, and a specific layout. The ${total} slides differ only in their focal content; everything else is identical.

Rules for the series:
- No slide number, page indicator, "1/${total}", or pagination dots rendered in the image (Instagram handles that natively).
- The brand wordmark/logo position and typography are fixed once in the brief and reused on every slide (specify them in designBrief.layout and the designBrief.typography.brandWordmark* fields).

OUTPUT SCHEMA (strict JSON, no markdown fences, no commentary):
{
  "designBrief": {
    "artStyle": "one sentence describing the overall visual treatment",
    "referenceImagery": "one sentence describing the imagery shared across every slide",
    "mood": "one word",
    "palette": { "background": "#RRGGBB", "text": "#RRGGBB", "accent": "#RRGGBB", "accentSoft": "#RRGGBB" },
    "typography": {
      "headlineFont": "concrete typeface name",
      "headlineWeight": "numeric or keyword",
      "headlineCase": "uppercase|titlecase|sentencecase",
      "subtextFont": "concrete typeface name",
      "subtextWeight": "numeric or keyword",
      "tracking": "letter-spacing phrase",
      "feel": "short phrase",
      "brandWordmarkFont": "concrete typeface name for the brand wordmark",
      "brandWordmarkWeight": "numeric or keyword",
      "brandWordmarkCase": "uppercase|titlecase|sentencecase",
      "brandWordmarkTracking": "letter-spacing phrase"
    },
    "layout": "one sentence locking the brand wordmark/logo position (corner, size, padding) — identical on every slide",
    "graphicMotif": "one recurring element that appears on every slide"
  },
  "slides": [
    {
      "role": "free-form short tag",
      "headline": "<=7 words, in ${lang}",
      "subtext": "<=18 words, in ${lang}",
      "bullets": ["<=5 words", "<=5 words"],
      "visualNote": "imagery for this slide (English ok, be concrete)",
      "layout": "free-form short tag"
    }
  ]
}`
}

function buildCarouselPrompt({
  brandName, topic, audience, extraNotes, format,
  total, current, carouselPlan, slideBrief, designBrief,
  hasLogo, language,
}) {
  const lang = language || 'Indonesian'
  const storyboard = carouselPlan
    .map((item) => `  ${item.index}/${total} [${item.role}] ${item.headline}`)
    .join('\n')
  const bullets = slideBrief.bullets.join(' • ') || ''

  const briefJson = designBrief ? JSON.stringify(designBrief, null, 2) : ''
  const briefBlock = briefJson
    ? `SERIES DESIGN BRIEF (shared across all slides — apply verbatim):\n${briefJson}`
    : ''

  const contextLines = briefLines([
    ['Brand', brandName],
    ['Topic', topic],
    ['Audience', audience],
    ['Format', format],
    ['Extra notes', extraNotes],
    ['Output language', lang],
  ])

  const brandRule = hasLogo
    ? 'Use the uploaded logo image as the brand logo. Do NOT redraw or generate any other logo.'
    : (brandName ? `Render the brand name "${brandName}" as plain text only — no logo, no monogram.` : '')

  // Lock the brand wordmark typography to whatever the planner committed to,
  // echoed verbatim so AI has no wiggle room between slides.
  const bTypo = designBrief?.typography || {}
  const brandTypoLock = (brandName && !hasLogo && bTypo.brandWordmarkFont)
    ? `Render the brand wordmark "${brandName}" in EXACTLY "${bTypo.brandWordmarkFont}"${bTypo.brandWordmarkWeight ? `, weight ${bTypo.brandWordmarkWeight}` : ''}${bTypo.brandWordmarkCase ? `, case ${bTypo.brandWordmarkCase}` : ''}${bTypo.brandWordmarkTracking ? `, letter-spacing ${bTypo.brandWordmarkTracking}` : ''}. Must be visually identical to the wordmark on every other slide.`
    : ''

  const positionLock = (brandName || hasLogo)
    ? (current === 1
        ? 'Pick ONE corner for the brand wordmark/logo based on the designBrief.layout. Remember this position — subsequent slides must use it exactly.'
        : `The brand wordmark/logo MUST be in the EXACT same corner, size, and padding as slide 1. Only the focal content changes.`)
    : ''

  return `${briefBlock}

This is slide ${current} of ${total} in the carousel above. Apply the shared design brief verbatim — palette, typography, layout, motif, overall density are all identical to sibling slides. Only the focal content changes.

${contextLines ? `CONTEXT\n${contextLines}\n\n` : ''}STORYBOARD (context only — do NOT draw other slides)
${storyboard}

THIS SLIDE (${current}/${total})
- Headline (in ${lang}, render verbatim as the largest text): ${slideBrief.headline}
- Subtext (in ${lang}, render verbatim): ${slideBrief.subtext}
${bullets ? `- Supporting points (in ${lang}): ${bullets}\n` : ''}- Imagery: ${slideBrief.visualNote}
- Do NOT render any slide number, page indicator, "1/${total}", pagination dots, or any visual cue that this is part of a carousel.
${brandRule ? `- ${brandRule}\n` : ''}${positionLock ? `- ${positionLock}\n` : ''}${brandTypoLock ? `- ${brandTypoLock}\n` : ''}
All rendered text on this slide is in ${lang}.`
}

function buildSinglePrompt({
  brandName, topic, audience, colorPalette, format,
  captionTone, extraNotes,
  hasLogo, language,
}) {
  const lang = language || 'Indonesian'
  const lines = briefLines([
    ['Brand', brandName],
    ['Topic', topic],
    ['Audience', audience],
    ['Copy tone', captionTone],
    ['Palette preference', colorPalette],
    ['Format', format],
    ['Extra notes', extraNotes],
    ['Output language', lang],
  ])

  const brandRule = hasLogo
    ? 'Use the uploaded logo image as the brand logo. Do NOT redraw or generate any other logo.'
    : (brandName ? `Render the brand name "${brandName}" as plain text only — no logo, no monogram.` : '')

  return `Design ONE Instagram feed post. You have total creative freedom on style, layout, composition, colors, typography, imagery, and any visual direction. All rendered text on the canvas is in ${lang}.

USER BRIEF
${lines}${brandRule ? `\n- ${brandRule}` : ''}`
}

// ---------- Plan builders ----------

function buildCarouselPlan({ topic, totalSlides }) {
  const total = Math.max(2, Math.min(Number(totalSlides) || 3, 10))
  const plan = new Array(total)

  for (let i = 1; i <= total; i += 1) {
    const role = getSlideRole(i, total, DEFAULT_FRAMEWORK)
    plan[i - 1] = {
      index: i,
      role: role.role,
      headline: role.headline(topic),
      subtext: role.subtext(topic),
      bullets: role.bullets?.(topic) || [],
      visualNote: role.visualNote?.(topic) || role.description,
      layout: role.layout,
      continuity: role.continuity,
      description: role.description,
    }
  }

  return plan
}

function normalizeCarouselPlan(slides, fallbackPlan) {
  return slides.map((slide, index) => normalizeSlide(slide, fallbackPlan[index], index + 1))
}

function normalizeSlide(slide = {}, fallback = {}, index = 1) {
  return {
    index,
    role: slide.role || fallback.role || (index === 1 ? 'cover' : 'insight'),
    headline: slide.headline || fallback.headline || `Slide ${index}`,
    subtext: slide.subtext || slide.content || fallback.subtext || '',
    bullets: Array.isArray(slide.bullets) ? slide.bullets.slice(0, 3) : (fallback.bullets || []),
    visualNote: slide.visualNote || slide.description || fallback.visualNote || fallback.description || 'Gunakan visual sederhana yang mendukung pesan utama.',
    layout: slide.layout || fallback.layout || 'split',
    continuity: slide.continuity || fallback.continuity || 'Gunakan header kecil, nomor slide, aksen warna, dan footer brand yang konsisten.',
    description: slide.description || fallback.description || slide.visualNote || '',
  }
}

const HEX_RE = /^#[0-9a-fA-F]{6}$/

// Validate and normalize the AI-authored design brief. Missing or malformed
// fields fall back to neutral defaults so downstream prompts never break.
function validateDesignBrief(brief) {
  if (!brief || typeof brief !== 'object') return null
  const pal = brief.palette || {}
  const hex = (v, fallback) => (typeof v === 'string' && HEX_RE.test(v.trim()) ? v.trim() : fallback)
  const str = (v, fallback) => (typeof v === 'string' && v.trim() ? v.trim() : fallback)

  // Typography can arrive as an object (new schema) or a free-form string
  // (legacy / fallback). Normalize to the object shape with safe defaults.
  const tp = brief.typography
  let typography
  if (tp && typeof tp === 'object') {
    typography = {
      headlineFont: str(tp.headlineFont, 'Inter'),
      headlineWeight: str(tp.headlineWeight, 'bold'),
      headlineCase: ['uppercase', 'titlecase', 'sentencecase'].includes(tp.headlineCase) ? tp.headlineCase : 'sentencecase',
      subtextFont: str(tp.subtextFont, 'Inter'),
      subtextWeight: str(tp.subtextWeight, 'regular'),
      tracking: str(tp.tracking, 'neutral 0'),
      feel: str(tp.feel, 'neutral'),
      // Dedicated brand wordmark typography so every slide can render the
      // brand with identical face/weight/case. Falls back to the subtext
      // face if the planner forgot to pick a distinct one.
      brandWordmarkFont: str(tp.brandWordmarkFont, str(tp.subtextFont, 'Inter')),
      brandWordmarkWeight: str(tp.brandWordmarkWeight, 'medium'),
      brandWordmarkCase: ['uppercase', 'titlecase', 'sentencecase'].includes(tp.brandWordmarkCase) ? tp.brandWordmarkCase : 'uppercase',
      brandWordmarkTracking: str(tp.brandWordmarkTracking, 'wide +8%'),
    }
  } else {
    typography = {
      headlineFont: 'Inter',
      headlineWeight: 'bold',
      headlineCase: 'sentencecase',
      subtextFont: 'Inter',
      subtextWeight: 'regular',
      tracking: 'neutral 0',
      feel: typeof tp === 'string' && tp.trim() ? tp.trim() : 'neutral',
      brandWordmarkFont: 'Inter',
      brandWordmarkWeight: 'medium',
      brandWordmarkCase: 'uppercase',
      brandWordmarkTracking: 'wide +8%',
    }
  }

  return {
    artStyle: str(brief.artStyle, 'shared across every slide'),
    referenceImagery: str(brief.referenceImagery, 'consistent imagery shared across every slide'),
    mood: str(brief.mood, 'neutral'),
    palette: {
      background: hex(pal.background, '#F7F5F0'),
      text: hex(pal.text, '#141414'),
      accent: hex(pal.accent, '#2563EB'),
      accentSoft: hex(pal.accentSoft, '#DBEAFE'),
    },
    typography,
    layout: str(brief.layout, 'brand wordmark in one fixed corner, identical size and padding across every slide'),
    graphicMotif: str(brief.graphicMotif, 'none'),
  }
}

function getSlideRole(index, total, framework) {
  if (index === 1) return framework.opening
  if (index === total) return framework.closing
  const middle = framework.middle
  return middle[(index - 2) % middle.length]
}

// Cached fallback framework used only when the AI planner response is unusable.
const DEFAULT_FRAMEWORK = Object.freeze({
  opening: {
    role: 'cover',
    description: 'Slide cover untuk memperkenalkan tema materi dan membuat audiens ingin swipe.',
    headline: (topic) => `Mengenal ${topic}`,
    subtext: () => 'Swipe untuk memahami poin pentingnya satu per satu.',
    bullets: () => ['Mulai dari dasar'],
    visualNote: () => 'Cover editorial dengan headline besar dan visual konsep utama.',
    layout: 'cover',
    continuity: 'Gunakan header brand kecil, nomor slide, dan aksen visual yang berulang.',
  },
  middle: [
    { role: 'definition', description: 'Slide definisi/pengantar konsep.', headline: () => 'Apa itu?', subtext: (topic) => `Definisi sederhana tentang ${topic}.`, bullets: () => ['Definisi', 'Konteks'], visualNote: () => 'Diagram sederhana atau objek konseptual sebagai anchor visual.', layout: 'split', continuity: 'Pakai gaya ilustrasi dan nomor slide yang sama.' },
    { role: 'insight', description: 'Slide alasan mengapa topik ini penting.', headline: () => 'Kenapa penting?', subtext: (topic) => `Alasan ${topic} relevan atau bermanfaat untuk audiens.`, bullets: () => ['Relevan', 'Bermanfaat'], visualNote: () => 'Visual penekanan berupa angka besar, ikon, atau callout.', layout: 'quote', continuity: 'Pertahankan margin, footer, dan aksen warna.' },
    { role: 'insight', description: 'Slide poin/fakta pertama.', headline: () => 'Poin utama #1', subtext: (topic) => `Satu fakta, tips, atau insight penting tentang ${topic}.`, bullets: () => ['Satu fokus', 'Mudah diingat'], visualNote: () => 'Layout satu insight besar dengan ilustrasi pendukung minimal.', layout: 'split', continuity: 'Gunakan pola heading yang sama.' },
    { role: 'insight', description: 'Slide poin/fakta kedua.', headline: () => 'Poin utama #2', subtext: (topic) => `Poin lanjutan yang berbeda tentang ${topic}.`, bullets: () => ['Lanjutan', 'Lebih praktis'], visualNote: () => 'Layout lanjutan yang mirip tapi tidak identik dengan slide sebelumnya.', layout: 'checklist', continuity: 'Ulangi bentuk aksen dan posisi nomor.' },
    { role: 'example', description: 'Slide contoh penerapan.', headline: () => 'Contoh penerapan', subtext: (topic) => `Contoh sederhana agar audiens memahami ${topic}.`, bullets: () => ['Contoh', 'Aplikasi'], visualNote: () => 'Mini skenario atau diagram langkah sederhana.', layout: 'steps', continuity: 'Gunakan sistem ikon yang sama.' },
    { role: 'warning', description: 'Slide kesalahan atau hal yang perlu dihindari.', headline: () => 'Yang perlu dihindari', subtext: (topic) => `Kesalahan umum yang perlu diperhatikan tentang ${topic}.`, bullets: () => ['Hindari ini', 'Lebih teliti'], visualNote: () => 'Visual warning yang tetap premium dan tidak terlalu ramai.', layout: 'checklist', continuity: 'Gunakan warna aksen secara hemat.' },
  ],
  closing: {
    role: 'conclusion',
    description: 'Slide penutup berisi kesimpulan.',
    headline: () => 'Kesimpulan',
    subtext: () => 'Ringkas pesan utama dan ajak audiens menyimpan atau membagikan carousel ini.',
    bullets: () => ['Simpan', 'Bagikan'],
    visualNote: () => 'Penutup bersih dengan ringkasan satu kalimat dan elemen brand.',
    layout: 'conclusion',
    continuity: 'Tutup dengan komposisi yang menggemakan slide cover.',
  },
})

// ---------- Library endpoints ----------

// On-demand PNG export. We keep WebP on disk (smaller, faster) and transcode
// to PNG only when users actually click download, so they get a format that
// every downstream tool (Instagram, Canva, Figma, Photoshop) accepts natively.
// Registered BEFORE the generic webp route so Express matches this first.
// Results are LRU-cached so repeated downloads of the same slide are instant.
app.get(/^\/api\/images\/(.+)\.png$/, async (req, res) => {
  try {
    const stem = req.params[0] // filename without extension
    const webpName = stem.endsWith('.webp') ? stem : `${stem}.webp`

    let pngBuffer = pngCache.get(webpName)
    if (!pngBuffer) {
      pngBuffer = await convertStoredImageToPng(webpName)
      pngCache.set(webpName, pngBuffer)
    }

    res.set('Cache-Control', 'public, max-age=31536000, immutable')
    res.set('Content-Type', 'image/png')
    res.set('Content-Length', pngBuffer.length)
    res.end(pngBuffer)
  } catch {
    res.status(404).json({ error: 'Image not found' })
  }
})

// Serve compressed images from disk with long-term caching.
app.get('/api/images/:fileName', (req, res) => {
  // Defensive: any accidental .png requests that reach here (shouldn't —
  // the regex route above catches them first) fall through with 404.
  if (req.params.fileName.endsWith('.png')) {
    return res.status(404).json({ error: 'Image not found' })
  }
  const filePath = resolveImagePath(req.params.fileName)
  res.set('Cache-Control', 'public, max-age=31536000, immutable')
  res.set('Content-Type', 'image/webp')
  res.sendFile(filePath, (err) => {
    if (err && !res.headersSent) res.status(404).json({ error: 'Image not found' })
  })
})

app.get('/api/generations', requireAuth, (req, res) => {
  const items = listGenerations(req.user.id, Number(req.query.limit) || 50).map((row) => ({
    id: row.id,
    createdAt: row.created_at,
    mode: row.mode,
    topic: row.topic,
    brandName: row.brand_name,
    style: row.style,
    format: row.format,
    totalSlides: row.total_slides,
    slideCount: row.slide_count,
    bytesStored: row.bytes_stored,
  }))
  res.json({ items })
})

app.get('/api/stats', requireAuth, (req, res) => {
  const s = getUserStats(req.user.id)
  res.json({
    generations: s.generation_count,
    carousels: s.carousel_count,
    singles: s.single_count,
    slides: s.slide_count,
    bytesStored: s.bytes_stored,
    firstAt: s.first_at,
    lastAt: s.last_at,
  })
})

// Public showcase feed for the Landing page — returns one cover slide per
// generation, newest first. Cached in-memory (30 s TTL) so landing hits
// don't hammer the DB on every visitor.
app.get('/api/showcase', (req, res) => {
  const limit = Number(req.query.limit) || 24
  let items = showcaseCache.get()
  if (!items || items._limit !== limit) {
    items = listShowcaseSlides(limit).map((row) => ({
      id: row.id,
      generationId: row.generation_id,
      image: `/api/images/${row.file_name}`,
      mode: row.mode,
      topic: row.topic,
      brandName: row.brand_name,
      format: row.format,
      totalSlides: row.total_slides,
      createdAt: row.created_at,
    }))
    items._limit = limit
    showcaseCache.set(items)
  }
  res.set('Cache-Control', 'public, max-age=60')
  res.json({ items })
})

// Public showcase detail — returns a single generation with all its slides so
// the landing-page modal can step through the full carousel without auth.
// LRU-cached (30 s) to avoid repeated DB hits from the same visitor.
app.get('/api/showcase/:generationId', (req, res) => {
  const gid = req.params.generationId
  let payload = showcaseDetailCache.get(gid)
  if (!payload) {
    const record = getGeneration(gid)
    if (!record) return res.status(404).json({ error: 'Not found' })
    const { generation, slides } = record
    if (!generation.is_public) return res.status(404).json({ error: 'Not found' })
    payload = {
      id: generation.id,
      mode: generation.mode,
      topic: generation.topic,
      brandName: generation.brand_name,
      format: generation.format,
      totalSlides: generation.total_slides,
      createdAt: generation.created_at,
      slides: slides.map((s) => ({
        index: s.slide_index,
        image: `/api/images/${s.file_name}`,
        role: s.role,
        headline: s.headline,
      })),
    }
    showcaseDetailCache.set(gid, payload)
  }
  res.set('Cache-Control', 'public, max-age=60')
  res.json(payload)
})

app.get('/api/generations/:id', requireAuth, (req, res) => {
  if (!isGenerationOwnedBy(req.params.id, req.user.id)) {
    return res.status(404).json({ error: 'Generation not found' })
  }
  const record = getGeneration(req.params.id)
  if (!record) return res.status(404).json({ error: 'Generation not found' })
  const { generation, slides } = record
  res.json({
    id: generation.id,
    createdAt: generation.created_at,
    mode: generation.mode,
    topic: generation.topic,
    brandName: generation.brand_name,
    purpose: generation.purpose,
    audience: generation.audience,
    style: generation.style,
    palette: generation.palette,
    format: generation.format,
    cta: generation.cta,
    tone: generation.tone,
    extraNotes: generation.extra_notes,
    totalSlides: generation.total_slides,
    seed: generation.seed,
    isPublic: Boolean(generation.is_public),
    slides: slides.map((s) => ({
      id: s.id,
      slideIndex: s.slide_index,
      image: `/api/images/${s.file_name}`,
      width: s.width,
      height: s.height,
      bytesOriginal: s.bytes_original,
      bytesStored: s.bytes_stored,
      role: s.role,
      headline: s.headline,
      prompt: s.prompt,
      createdAt: s.created_at,
    })),
  })
})

app.patch('/api/generations/:id/visibility', requireAuth, smallJson, (req, res) => {
  if (!isGenerationOwnedBy(req.params.id, req.user.id)) {
    return res.status(404).json({ error: 'Generation not found' })
  }
  const ok = setGenerationPublic(req.params.id, req.user.id, Boolean(req.body?.isPublic))
  if (!ok) return res.status(404).json({ error: 'Generation not found' })
  // Invalidate showcase caches so the landing page reflects the change.
  showcaseCache.invalidate()
  showcaseDetailCache.delete(req.params.id)
  res.json({ ok: true, isPublic: Boolean(req.body?.isPublic) })
})

app.delete('/api/generations/:id', requireAuth, (req, res) => {
  if (!isGenerationOwnedBy(req.params.id, req.user.id)) {
    return res.status(404).json({ error: 'Generation not found' })
  }
  const ok = deleteGeneration(req.params.id)
  if (!ok) return res.status(404).json({ error: 'Generation not found' })
  res.json({ ok: true })
})

/* ---------- admin endpoints ---------- */

/** Platform overview — high-level counters + recent activity summary. */
app.get('/api/admin/overview', requireAuth, requireAdmin, (_req, res) => {
  const s = platformStats()
  res.set('Cache-Control', 'no-store').json({
    users: s.users_count,
    admins: s.admins_count,
    generations: s.generations_count,
    publicGenerations: s.public_count,
    slides: s.slides_count,
    bytesStored: s.bytes_stored,
    loginFails24h: s.recent_login_fails,
    lastGenerationAt: s.last_generation_at,
  })
})

/** Paginated user list with per-user usage stats. */
app.get('/api/admin/users', requireAuth, requireAdmin, (req, res) => {
  const limit = Number(req.query.limit) || 50
  const offset = Number(req.query.offset) || 0
  const items = listUsers(limit, offset).map((u) => ({
    id: u.id,
    email: u.email,
    name: u.name,
    role: u.role,
    createdAt: u.created_at,
    generationCount: u.generation_count,
    bytesStored: u.bytes_stored,
  }))
  res.json({ items, total: countUsers() })
})

/** Change a user's role. The admin cannot demote their own last-admin self. */
app.patch('/api/admin/users/:id/role', requireAuth, requireAdmin, smallJson, (req, res) => {
  const { id } = req.params
  const nextRole = req.body?.role
  if (nextRole !== 'admin' && nextRole !== 'user') {
    return res.status(400).json({ error: 'Role harus "admin" atau "user".' })
  }
  if (id === req.user.id && nextRole === 'user') {
    // Prevent self-lockout: refuse to demote when this is the only admin.
    const s = platformStats()
    if (s.admins_count <= 1) {
      return res.status(400).json({ error: 'Tidak bisa mendemosi admin terakhir.' })
    }
  }
  const ok = setUserRole(id, nextRole)
  if (!ok) return res.status(404).json({ error: 'User tidak ditemukan.' })
  res.json({ ok: true, id, role: nextRole })
})

/** Hard-delete a user account. Their generations/uploads stay (user_id
 * becomes NULL) so we don't accidentally purge images that are public. */
app.delete('/api/admin/users/:id', requireAuth, requireAdmin, (req, res) => {
  if (req.params.id === req.user.id) {
    return res.status(400).json({ error: 'Tidak bisa menghapus akun sendiri.' })
  }
  const ok = deleteUser(req.params.id)
  if (!ok) return res.status(404).json({ error: 'User tidak ditemukan.' })
  res.json({ ok: true })
})

/** Every generation across all users, paginated. */
app.get('/api/admin/generations', requireAuth, requireAdmin, (req, res) => {
  const limit = Number(req.query.limit) || 50
  const offset = Number(req.query.offset) || 0
  const items = listAllGenerations(limit, offset).map((g) => ({
    id: g.id,
    createdAt: g.created_at,
    mode: g.mode,
    topic: g.topic,
    brandName: g.brand_name,
    format: g.format,
    totalSlides: g.total_slides,
    slideCount: g.slide_count,
    bytesStored: g.bytes_stored,
    isPublic: Boolean(g.is_public),
    user: g.user_id ? { id: g.user_id, email: g.user_email, name: g.user_name } : null,
  }))
  res.json({ items })
})

/** Admin override: force-delete any generation regardless of owner. */
app.delete('/api/admin/generations/:id', requireAuth, requireAdmin, (req, res) => {
  const ok = deleteGeneration(req.params.id)
  if (!ok) return res.status(404).json({ error: 'Generation tidak ditemukan.' })
  res.json({ ok: true })
})

/** Admin: get full detail of any generation (regardless of owner). */
app.get('/api/admin/generations/:id', requireAuth, requireAdmin, (req, res) => {
  const record = getGeneration(req.params.id)
  if (!record) return res.status(404).json({ error: 'Generation tidak ditemukan.' })
  const { generation, slides } = record
  res.json({
    id: generation.id,
    createdAt: generation.created_at,
    mode: generation.mode,
    topic: generation.topic,
    brandName: generation.brand_name,
    audience: generation.audience,
    palette: generation.palette,
    format: generation.format,
    tone: generation.tone,
    extraNotes: generation.extra_notes,
    totalSlides: generation.total_slides,
    isPublic: Boolean(generation.is_public),
    userId: generation.user_id,
    slides: slides.map((s) => ({
      id: s.id,
      slideIndex: s.slide_index,
      image: `/api/images/${s.file_name}`,
      width: s.width,
      height: s.height,
      bytesOriginal: s.bytes_original,
      bytesStored: s.bytes_stored,
      role: s.role,
      headline: s.headline,
      createdAt: s.created_at,
    })),
  })
})

/** Platform-wide auth audit log for incident investigation. */
app.get('/api/admin/auth-events', requireAuth, requireAdmin, (req, res) => {
  const limit = Number(req.query.limit) || 100
  const offset = Number(req.query.offset) || 0
  const events = listAllAuthEvents(limit, offset).map((row) => ({
    id: row.id,
    userId: row.user_id,
    email: row.email,
    userEmail: row.user_email, // may differ if email changed or account deleted
    event: row.event,
    ip: row.ip,
    userAgent: row.user_agent,
    createdAt: row.created_at,
  }))
  res.set('Cache-Control', 'no-store').json({ events })
})

/* ---------- settings (admin-editable feature flags) ----------
 *
 * Settings are exposed at two endpoints:
 *  - GET /api/settings — public, returns only the subset of settings marked
 *    as publicly readable so the SPA can gate features without exposing
 *    sensitive ops flags.
 *  - GET /api/admin/settings — admin-only, returns every setting with
 *    metadata (when + by whom it was last updated).
 */

// Default feature flags + their visibility level. Edit this list whenever
// you add a new setting.
const SETTINGS_SCHEMA = {
  registrationEnabled:   { default: true,  public: true  },
  uploadsEnabled:        { default: true,  public: true  },
  showcasePublicDefault: { default: false, public: true  },
  generateDailyLimit:    { default: 0,     public: true  }, // 0 = no cap
  maintenanceMode:       { default: false, public: true  },
  maintenanceMessage:    { default: '',    public: true  },
}

function effectiveSettings(publicOnly = false) {
  const out = {}
  for (const [key, meta] of Object.entries(SETTINGS_SCHEMA)) {
    if (publicOnly && !meta.public) continue
    out[key] = getSetting(key, meta.default)
  }
  return out
}

// Enforce a few settings at request-time instead of inside every handler.
// Placed after authMiddleware so req.user is populated; admins always bypass
// maintenance mode + registration lockouts for recovery.
// Uses cachedSetting() to avoid a DB round-trip on every single request.
app.use((req, res, next) => {
  const isAdmin = req.user?.role === 'admin'
  if (!isAdmin && req.method === 'POST' && req.path === '/api/auth/register') {
    if (!cachedSetting('registrationEnabled', true)) {
      return res.status(403).json({ error: 'Pendaftaran sedang ditutup.' })
    }
  }
  if (!isAdmin && req.path === '/api/uploads' && req.method === 'POST') {
    if (!cachedSetting('uploadsEnabled', true)) {
      return res.status(403).json({ error: 'Upload sedang dinonaktifkan.' })
    }
  }
  if (!isAdmin && cachedSetting('maintenanceMode', false)) {
    // Only block API routes during maintenance — SPA routes still need to
    // serve index.html so the client can render the maintenance banner.
    if (req.path.startsWith('/api/') && !req.path.startsWith('/api/auth/') && !req.path.startsWith('/api/health') && !req.path.startsWith('/api/settings')) {
      return res.status(503).json({
        error: cachedSetting('maintenanceMessage', '') || 'Maintenance mode aktif.',
        maintenance: true,
      })
    }
  }
  next()
})

app.get('/api/settings', (_req, res) => {
  res.set('Cache-Control', 'no-store').json({ settings: effectiveSettings(true) })
})

app.get('/api/admin/settings', requireAuth, requireAdmin, (_req, res) => {
  const all = effectiveSettings(false)
  const meta = listAllSettings().reduce((acc, row) => {
    acc[row.key] = { updatedAt: row.updatedAt, updatedBy: row.updatedBy }
    return acc
  }, {})
  res.set('Cache-Control', 'no-store').json({
    settings: all,
    schema: Object.fromEntries(
      Object.entries(SETTINGS_SCHEMA).map(([k, v]) => [k, { default: v.default, public: v.public }]),
    ),
    meta,
  })
})

app.patch('/api/admin/settings', requireAuth, requireAdmin, smallJson, (req, res) => {
  const patch = req.body?.settings
  if (!patch || typeof patch !== 'object') {
    return res.status(400).json({ error: 'Body harus { settings: { key: value } }.' })
  }
  const updated = {}
  for (const [key, value] of Object.entries(patch)) {
    if (!(key in SETTINGS_SCHEMA)) continue
    setSetting(key, value, req.user.id)
    updated[key] = value
  }
  invalidateSettingsCache()
  res.json({ ok: true, updated })
})

/* ---------- SPA static serving (production) ----------
 *
 * In production (`npm run build` then `npm run server`), serve the Vite-built
 * dist/ folder. Any route that doesn't match an API endpoint or a physical
 * file in dist/ falls through to index.html so client-side routing works.
 * In dev mode Vite handles this via its own dev server + proxy.
 */

const __server_dirname = _nodePath.dirname(_toPath(import.meta.url))
const DIST_DIR = _nodePath.resolve(__server_dirname, '..', 'dist')
const DIST_INDEX = _nodePath.join(DIST_DIR, 'index.html')
const HAS_DIST = _nodeFs.existsSync(DIST_INDEX)

if (!HAS_DIST) {
  // Only warn if this looks like a same-origin setup (no VITE_API_BASE_URL).
  // In cross-origin deploys the dist/ lives on a separate static host.
  if (!process.env.VITE_API_BASE_URL) {
    console.warn(`[WARN] dist/index.html not found at: ${DIST_INDEX}`)
    console.warn(`       __server_dirname = ${__server_dirname}`)
    console.warn(`       cwd = ${process.cwd()}`)
    console.warn('       Run "npm run build" in the project root to generate the production bundle.')
  }
  const cwdDist = _nodePath.resolve(process.cwd(), 'dist', 'index.html')
  if (_nodeFs.existsSync(cwdDist)) {
    console.log(`[INFO] Found dist at cwd: ${cwdDist}`)
  }
}

// Use whichever dist path exists
const RESOLVED_DIST = HAS_DIST
  ? DIST_DIR
  : _nodeFs.existsSync(_nodePath.resolve(process.cwd(), 'dist', 'index.html'))
    ? _nodePath.resolve(process.cwd(), 'dist')
    : null
const RESOLVED_INDEX = RESOLVED_DIST ? _nodePath.join(RESOLVED_DIST, 'index.html') : null

if (RESOLVED_DIST) {
  // Serve built assets with long-term caching (hashed filenames).
  app.use(express.static(RESOLVED_DIST, {
    maxAge: '1y',
    immutable: true,
    index: false,
    fallthrough: true,
  }))

  // SPA fallback: any GET/HEAD that didn't match an API route or a static
  // file in dist/ gets index.html so the client-side router can handle it.
  app.use((req, res, next) => {
    if (req.method !== 'GET' && req.method !== 'HEAD') return next()
    if (req.path.startsWith('/api/')) return res.status(404).json({ error: 'Not found' })
    res.set('Content-Type', 'text/html')
    res.set('Cache-Control', 'no-cache')
    res.sendFile(RESOLVED_INDEX, (err) => {
      if (err && !res.headersSent) {
        console.error('[SPA fallback] sendFile error:', err.message)
        res.status(500).send('Failed to serve app')
      }
    })
  })
} else {
  // No dist found — add a catch-all that explains the situation
  app.use((req, res, next) => {
    if (req.method !== 'GET' && req.method !== 'HEAD') return next()
    if (req.path.startsWith('/api/')) return res.status(404).json({ error: 'Not found' })
    res.status(503).send('FeedDesigner: dist/ not found. Run "npm run build" first.')
  })
}

app.listen(PORT, () => {
  console.log(`FeedDesigner API running on http://localhost:${PORT}`)
  console.log(`Images dir: ${imagesDir()}`)
  if (RESOLVED_DIST) {
    console.log(`Serving SPA from: ${RESOLVED_DIST}`)
  }
})
