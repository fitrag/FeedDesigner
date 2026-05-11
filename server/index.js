import fs from 'node:fs'
import 'dotenv/config'
import express from 'express'
import cors from 'cors'
import compression from 'compression'
import helmet from 'helmet'
import rateLimit from 'express-rate-limit'
import cookieParser from 'cookie-parser'
import {
  compressAndStoreImage, convertStoredImageToPng, createGenerationId, createSlideId, createUser, createUserId,
  createUploadId, deleteGeneration, deleteUpload, getGeneration, getUpload, getUserByEmail, getUserStats,
  imagesDir, isGenerationOwnedBy, listAuthEvents, listGenerations, listShowcaseSlides, logAuthEvent,
  resolveImagePath, resolveUploadPath, saveGeneration, saveSlide, saveUploadedImage, setGenerationPublic,
} from './storage.js'
import {
  authMiddleware, clearAuthCookies, hashPassword, requireAuth, requireCsrfIfCookie,
  setAuthCookies, signToken, verifyPassword,
} from './auth.js'

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
const REQUEST_TIMEOUT_MS = Number(process.env.AI_REQUEST_TIMEOUT_MS) || 120_000

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
app.use(helmet({ contentSecurityPolicy: false, crossOriginEmbedderPolicy: false }))

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
app.use(compression())

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

// Read a stored upload from disk and return as a data URL, so we can pass it
// inline to image-to-image endpoints without another fetch round-trip.
async function readUploadAsDataUrl(fileName) {
  const buf = await fs.promises.readFile(resolveUploadPath(fileName))
  return `data:image/webp;base64,${buf.toString('base64')}`
}

app.get('/api/health', (_req, res) => {
  res.set('Cache-Control', 'no-store').json({
    ok: true,
    model: OPENAI_IMAGE_MODEL,
    configured: Boolean(OPENAI_API_KEY),
  })
})

/* ---------- auth ---------- */

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

function publicUser(user) {
  if (!user) return null
  return { id: user.id, email: user.email, name: user.name || null, createdAt: user.created_at }
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
    logAuthEvent({ userId: user.id, email: user.email, event: 'register', ...clientMeta(req) })
    const token = signToken({ sub: user.id, email: user.email, name: user.name || undefined })
    const csrf = setAuthCookies(res, token)
    // `token` is still returned for legacy clients but new code should rely
    // on the httpOnly cookie + csrf token instead.
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
    const token = signToken({ sub: user.id, email: user.email, name: user.name || undefined })
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
  // Transparent migration: when an old Bearer-authed client hits this route
  // and no auth cookie is set yet, issue fresh cookies so subsequent
  // requests use the XSS-resistant path. The server already validated the
  // bearer token via authMiddleware.
  if (!req.cookies?.fd_auth) {
    const token = signToken({ sub: req.user.id, email: req.user.email, name: req.user.name })
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

    const record = await saveUploadedImage({
      id: createUploadId(),
      userId: req.user.id,
      kind,
      buffer,
    })
    res.json(record)
  } catch (error) {
    console.error('[upload]', error); res.status(500).json({ error: 'Gagal mengupload gambar.' })
  }
})

app.get('/api/uploads/:fileName', (req, res) => {
  const filePath = resolveUploadPath(req.params.fileName)
  res.set('Cache-Control', 'public, max-age=31536000, immutable')
  res.set('Content-Type', 'image/webp')
  res.sendFile(filePath, (err) => {
    if (err && !res.headersSent) res.status(404).json({ error: 'Upload not found' })
  })
})

app.delete('/api/uploads/:id', requireAuth, (req, res) => {
  const ok = deleteUpload(req.params.id, req.user.id)
  if (!ok) return res.status(404).json({ error: 'Upload tidak ditemukan.' })
  res.json({ ok: true })
})

app.post('/api/create-carousel-plan', requireAuth, generateLimiter, generateJson, async (req, res) => {
  try {
    const brief = sanitizeBrief(req.body)
    const { topic, audience, brandName, colorPalette, format, captionTone, extraNotes } = brief
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
              { role: 'user', content: buildPlannerPrompt({ topic, audience, total, brandName, colorPalette, format, captionTone, extraNotes }) },
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
    const { brandName, topic, audience, colorPalette, format, captionTone, extraNotes, mode } = brief
    const {
      slideContent, carouselSlides, designBrief, generationId: clientGenerationId,
      productUploadId, referenceUploadIds, logoUploadId,
    } = req.body

    if (!topic) return res.status(400).json({ error: 'Topik feed wajib diisi.' })
    if (!AUTH_HEADER) return res.status(500).json({ error: 'OPENAI_API_KEY belum diatur di file .env.' })

    const isCarousel = mode === 'carousel'
    const total = brief.totalSlides
    const current = brief.slideIndex

    // Resolve uploaded images from DB (client only sends IDs). Ownership is
    // enforced: the uploaded image must belong to the caller (or be orphan).
    const ownsUpload = (u) => !!u && (!u.user_id || u.user_id === req.user.id)
    const productUpload = productUploadId ? getUpload(productUploadId) : null
    if (productUpload && !ownsUpload(productUpload)) {
      return res.status(403).json({ error: 'Akses upload ditolak.' })
    }
    const referenceIds = Array.isArray(referenceUploadIds) ? referenceUploadIds.slice(0, 4) : []
    const referenceUploads = referenceIds
      .map((id) => getUpload(id))
      .filter((u) => ownsUpload(u))
    const logoUpload = logoUploadId ? getUpload(logoUploadId) : null
    if (logoUpload && !ownsUpload(logoUpload)) {
      return res.status(403).json({ error: 'Akses upload ditolak.' })
    }
    const hasLogo = Boolean(logoUpload)

    // Generation record is created on slide 1, reused across subsequent slides.
    const generationId = clientGenerationId || createGenerationId()
    const isFirstSlide = current === 1

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
        hasLogo,
      })
    } else {
      prompt = buildSinglePrompt({
        brandName, topic, audience, colorPalette, format,
        captionTone, extraNotes,
        hasLogo,
      })
    }

    const size = format === 'portrait 4:5' ? '1024x1280' : format === 'story 9:16' ? '1024x1792' : '1024x1024'

    const requestBody = {
      model: OPENAI_IMAGE_MODEL,
      prompt,
      n: 1,
      size,
      quality: 'high',
      background: 'auto',
      output_format: 'png',
      response_format: 'b64_json',
    }

    // If the user uploaded images, attach them to the request so providers
    // that support image-to-image / reference conditioning can use them. Most
    // OpenAI-compatible endpoints ignore unknown fields safely.
    const attachedImages = []
    if (productUpload) attachedImages.push(await readUploadAsDataUrl(productUpload.file_name))
    if (logoUpload) attachedImages.push(await readUploadAsDataUrl(logoUpload.file_name))
    for (const ref of referenceUploads) attachedImages.push(await readUploadAsDataUrl(ref.file_name))
    if (attachedImages.length) {
      requestBody.image = attachedImages[0]
      if (attachedImages.length > 1) requestBody.reference_images = attachedImages.slice(1)
      // Preserve identity of the uploaded product/reference/logo as faithfully
      // as possible. Supported by image-edit endpoints: low | high | auto | original.
      requestBody.input_fidelity = 'high'
    }

    const response = await fetchWithTimeout(`${OPENAI_BASE_URL}/images/generations`, {
      method: 'POST',
      headers: { ...AUTH_HEADER, 'Content-Type': 'application/json' },
      body: JSON.stringify(requestBody),
    })

    const data = await response.json().catch(() => ({}))

    if (!response.ok) {
      // Never echo the upstream response body back to the client — it can
      // leak provider-internal metadata. Just surface a human-readable
      // message and keep the original status code.
      const message = data?.error?.message || data?.message || 'Gagal membuat gambar dari AI.'
      return res.status(response.status).json({ error: String(message).slice(0, 500) })
    }

    const item = data?.data?.[0]
    if (!item?.b64_json) {
      if (item?.url) return res.json({ image: item.url, prompt, generationId, persisted: false })
      return res.status(502).json({ error: 'Respons AI tidak berisi gambar.' })
    }

    const pngBuffer = Buffer.from(item.b64_json, 'base64')

    if (isFirstSlide) {
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
      return res.status(504).json({ error: 'Request ke AI timeout. Coba lagi.' })
    }
    // Log the real error server-side for debugging, but return a generic
    // message to the client so we don't leak stack traces / paths / SQL bits.
    console.error('[generate-feed]', error)
    res.status(500).json({ error: 'Server error.' })
  }
})

// ---------- Prompt builders ----------

const PLANNER_SYSTEM = 'Reply ONLY with valid JSON (no markdown fences, no commentary). All text rendered in the image must be in Indonesian.'

/** Build a bullet list of user-provided brief fields, skipping empties. */
function briefLines(entries) {
  return entries
    .filter(([, value]) => value != null && String(value).trim() !== '')
    .map(([label, value]) => `- ${label}: ${value}`)
    .join('\n')
}

function buildPlannerPrompt({ topic, audience, total, brandName, colorPalette, format, captionTone, extraNotes }) {
  const lines = briefLines([
    ['Brand', brandName],
    ['Topic', topic],
    ['Audience', audience],
    ['Copy tone', captionTone],
    ['Format', format],
    ['Slides', total],
    ['Palette preference', colorPalette],
    ['Extra notes', extraNotes],
  ])

  return `Plan an Instagram carousel. Brainstorm freely.

USER BRIEF
${lines}

Fill the designBrief so every slide can share the same look, then write ${total} slides in Indonesian.

OUTPUT SCHEMA (strict JSON, no markdown):
{
  "designBrief": {
    "artStyle": "...",
    "referenceImagery": "...",
    "mood": "...",
    "palette": { "background": "#RRGGBB", "text": "#RRGGBB", "accent": "#RRGGBB", "accentSoft": "#RRGGBB" },
    "typography": {
      "headlineFont": "...",
      "headlineWeight": "...",
      "headlineCase": "uppercase|titlecase|sentencecase",
      "subtextFont": "...",
      "subtextWeight": "...",
      "tracking": "...",
      "feel": "..."
    },
    "layout": "...",
    "graphicMotif": "..."
  },
  "slides": [
    {
      "role": "cover|problem|insight|solution|proof|conclusion",
      "headline": "<=7 words, Indonesian",
      "subtext": "<=18 words, Indonesian",
      "bullets": ["<=5 words", "<=5 words"],
      "visualNote": "imagery for this slide (English ok)",
      "layout": "cover|split|checklist|quote|steps|conclusion"
    }
  ]
}`
}

function buildCarouselPrompt({
  brandName, topic, audience, extraNotes, format,
  total, current, carouselPlan, slideBrief, designBrief,
  hasLogo,
}) {
  const storyboard = carouselPlan
    .map((item) => `  ${item.index}/${total} [${item.role}] ${item.headline}`)
    .join('\n')
  const bullets = slideBrief.bullets.join(' • ') || ''

  const briefJson = designBrief ? JSON.stringify(designBrief, null, 2) : ''
  const briefBlock = briefJson
    ? `SERIES DESIGN BRIEF (shared across all slides):\n${briefJson}`
    : ''

  const contextLines = briefLines([
    ['Brand', brandName],
    ['Topic', topic],
    ['Audience', audience],
    ['Format', format],
    ['Extra notes', extraNotes],
  ])

  const brandRule = hasLogo
    ? 'Use the uploaded logo image as the brand logo on this slide. Do NOT redraw or generate any other logo.'
    : (brandName ? `Render the brand name "${brandName}" as plain text only — no logo, no monogram.` : '')

  return `${briefBlock}

This is slide ${current} of ${total}. Match the series design brief above so it feels like the same series as the other slides.

${contextLines ? `CONTEXT\n${contextLines}\n\n` : ''}STORYBOARD (context only)
${storyboard}

THIS SLIDE (${current}/${total})
- Headline (Indonesian): ${slideBrief.headline}
- Subtext (Indonesian): ${slideBrief.subtext}
${bullets ? `- Supporting points (Indonesian): ${bullets}\n` : ''}- Imagery: ${slideBrief.visualNote}
${brandRule ? `- ${brandRule}\n` : ''}
All rendered text is Indonesian.`
}

function buildSinglePrompt({
  brandName, topic, audience, colorPalette, format,
  captionTone, extraNotes,
  hasLogo,
}) {
  const lines = briefLines([
    ['Brand', brandName],
    ['Topic', topic],
    ['Audience', audience],
    ['Copy tone', captionTone],
    ['Palette preference', colorPalette],
    ['Format', format],
    ['Extra notes', extraNotes],
  ])

  const brandRule = hasLogo
    ? 'Use the uploaded logo image as the brand logo in the design. Do NOT redraw or generate any other logo.'
    : (brandName ? `Render the brand name "${brandName}" as plain text only — no logo, no monogram.` : '')

  return `Design ONE Instagram feed post. Brainstorm freely. All rendered text is Indonesian.

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
      feel: str(tp.feel, 'modern clean'),
    }
  } else {
    typography = {
      headlineFont: 'Inter',
      headlineWeight: 'bold',
      headlineCase: 'sentencecase',
      subtextFont: 'Inter',
      subtextWeight: 'regular',
      tracking: 'neutral 0',
      feel: typeof tp === 'string' && tp.trim() ? tp.trim() : 'modern clean',
    }
  }

  return {
    artStyle: str(brief.artStyle, 'modern editorial, clean and intentional'),
    referenceImagery: str(brief.referenceImagery, 'consistent imagery treatment that matches the art style and backdrop on every slide'),
    mood: str(brief.mood, 'premium'),
    palette: {
      background: hex(pal.background, '#F7F5F0'),
      text: hex(pal.text, '#141414'),
      accent: hex(pal.accent, '#2563EB'),
      accentSoft: hex(pal.accentSoft, '#DBEAFE'),
    },
    typography,
    layout: str(brief.layout, 'headline centered with generous margins, slide number in the top-right corner, brand wordmark in the bottom-left footer'),
    graphicMotif: str(brief.graphicMotif, 'a thin horizontal accent line near the headline'),
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
app.get(/^\/api\/images\/(.+)\.png$/, async (req, res) => {
  try {
    const stem = req.params[0] // filename without extension
    const webpName = stem.endsWith('.webp') ? stem : `${stem}.webp`
    const pngBuffer = await convertStoredImageToPng(webpName)
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
// generation, newest first. Cached briefly so landing hits don't hammer the DB.
app.get('/api/showcase', (req, res) => {
  const items = listShowcaseSlides(Number(req.query.limit) || 24).map((row) => ({
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
  res.set('Cache-Control', 'public, max-age=60')
  res.json({ items })
})

// Public showcase detail — returns a single generation with all its slides so
// the landing-page modal can step through the full carousel without auth. We
// intentionally do NOT expose the brief text / notes here, only the visuals
// and minimal metadata, so it is safe as a public endpoint.
app.get('/api/showcase/:generationId', (req, res) => {
  const record = getGeneration(req.params.generationId)
  if (!record) return res.status(404).json({ error: 'Not found' })
  const { generation, slides } = record
  // Only serve details for generations the owner explicitly published. This
  // endpoint is public (no auth) so private briefs must never leak through it.
  if (!generation.is_public) return res.status(404).json({ error: 'Not found' })
  res.set('Cache-Control', 'public, max-age=60')
  res.json({
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
  })
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

app.listen(PORT, () => {
  console.log(`FeedDesigner API running on http://localhost:${PORT}`)
  console.log(`Images dir: ${imagesDir()}`)
})
