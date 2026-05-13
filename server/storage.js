import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import crypto from 'node:crypto'
import Database from 'better-sqlite3'
import sharp from 'sharp'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const DATA_DIR = path.resolve(__dirname, '..', 'data')
const IMAGES_DIR = path.resolve(DATA_DIR, 'images')
const DB_PATH = path.resolve(DATA_DIR, 'feeddesigner.db')

fs.mkdirSync(IMAGES_DIR, { recursive: true })

const db = new Database(DB_PATH)
// Journaling + sync trade-offs tuned for a single-writer, many-reader app
// with acceptable durability: WAL + NORMAL syncs on checkpoint boundaries,
// which yields substantially better write throughput than the defaults.
db.pragma('journal_mode = WAL')
db.pragma('synchronous = NORMAL')
db.pragma('foreign_keys = ON')
// Extra performance pragmas:
//  - cache_size -32000  → 32 MB page cache (negative = KiB). Keeps hot
//    indexes + recent rows resident without paging to disk.
//  - temp_store = MEMORY → intermediate tables/indexes live in RAM, which
//    matters for the GROUP BY aggregates used by the admin stats queries.
//  - mmap_size 128 MB    → read path uses mmap instead of pread, cutting
//    syscall overhead for list/read queries over the slides index.
//  - busy_timeout 5 s    → wait out a transient writer lock instead of
//    bubbling a SQLITE_BUSY straight back to the HTTP handler.
db.pragma('cache_size = -32000')
db.pragma('temp_store = MEMORY')
db.pragma('mmap_size = 134217728')
db.pragma('busy_timeout = 5000')

// Sharp tuning. Cache a handful of recent decodes in memory (cheap wins when
// the same image is downloaded or re-previewed) but DON'T cap concurrency —
// Sharp's default uses the full CPU count, which is what we want so a
// 10-slide carousel compresses in parallel. Set SHARP_CONCURRENCY explicitly
// only on tiny VMs where you need to throttle.
sharp.cache({ items: 100, memory: 128 })
if (process.env.SHARP_CONCURRENCY) {
  const n = Number(process.env.SHARP_CONCURRENCY)
  if (Number.isFinite(n) && n > 0) sharp.concurrency(n)
}

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id          TEXT PRIMARY KEY,
    email       TEXT NOT NULL UNIQUE,
    name        TEXT,
    password    TEXT NOT NULL,
    role        TEXT NOT NULL DEFAULT 'user',  -- 'user' | 'admin'
    created_at  INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS generations (
    id          TEXT PRIMARY KEY,
    user_id     TEXT,
    created_at  INTEGER NOT NULL,
    mode        TEXT NOT NULL,
    topic       TEXT NOT NULL,
    brand_name  TEXT,
    purpose     TEXT,
    audience    TEXT,
    style       TEXT,
    palette     TEXT,
    format      TEXT,
    cta         TEXT,
    tone        TEXT,
    extra_notes TEXT,
    total_slides INTEGER NOT NULL,
    seed        INTEGER,
    brief_json  TEXT NOT NULL,
    is_public   INTEGER NOT NULL DEFAULT 0
  );

  CREATE TABLE IF NOT EXISTS slides (
    id             TEXT PRIMARY KEY,
    generation_id  TEXT NOT NULL,
    slide_index    INTEGER NOT NULL,
    file_name      TEXT NOT NULL,
    mime_type      TEXT NOT NULL,
    width          INTEGER,
    height         INTEGER,
    bytes_original INTEGER,
    bytes_stored   INTEGER,
    prompt         TEXT,
    role           TEXT,
    headline       TEXT,
    created_at     INTEGER NOT NULL,
    FOREIGN KEY (generation_id) REFERENCES generations(id) ON DELETE CASCADE
  );

  -- Audit trail for security-relevant events. Intentionally append-only:
  -- never UPDATE or DELETE rows here, just INSERT. Useful for forensic
  -- review after a suspicious login or data-access pattern.
  CREATE TABLE IF NOT EXISTS auth_events (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id    TEXT,
    email      TEXT,
    event      TEXT NOT NULL,          -- register | login_ok | login_fail | logout
    ip         TEXT,
    user_agent TEXT,
    created_at INTEGER NOT NULL
  );

  -- Key-value settings store for admin-controlled feature flags + config.
  -- Values are always stored as JSON strings so we can type-check on read.
  CREATE TABLE IF NOT EXISTS settings (
    key         TEXT PRIMARY KEY,
    value       TEXT NOT NULL,
    updated_at  INTEGER NOT NULL,
    updated_by  TEXT
  );
`)

// Additive migration: older installs may predate columns/tables introduced
// later. Run these BEFORE creating indexes that depend on them so the index
// DDL has the column to reference.
try {
  const cols = db.prepare('PRAGMA table_info(generations)').all()
  if (!cols.some((c) => c.name === 'user_id')) {
    db.exec('ALTER TABLE generations ADD COLUMN user_id TEXT')
  }
  if (!cols.some((c) => c.name === 'is_public')) {
    // Default existing rows to private so we never leak pre-migration data.
    db.exec('ALTER TABLE generations ADD COLUMN is_public INTEGER NOT NULL DEFAULT 0')
  }
} catch { /* ignore */ }

try {
  const userCols = db.prepare('PRAGMA table_info(users)').all()
  if (!userCols.some((c) => c.name === 'role')) {
    db.exec("ALTER TABLE users ADD COLUMN role TEXT NOT NULL DEFAULT 'user'")
  }
} catch { /* ignore */ }

// Indexes now that all required columns are guaranteed to exist.
db.exec(`
  CREATE INDEX IF NOT EXISTS idx_slides_generation ON slides(generation_id, slide_index);
  CREATE INDEX IF NOT EXISTS idx_generations_created ON generations(created_at DESC);
  CREATE INDEX IF NOT EXISTS idx_generations_user ON generations(user_id, created_at DESC);
  CREATE INDEX IF NOT EXISTS idx_auth_events_user ON auth_events(user_id, created_at DESC);
  CREATE INDEX IF NOT EXISTS idx_auth_events_email ON auth_events(email, created_at DESC);
`)

const insertGenerationStmt = db.prepare(`
  INSERT INTO generations (
    id, user_id, created_at, mode, topic, brand_name, purpose, audience, style, palette,
    format, cta, tone, extra_notes, total_slides, seed, brief_json, is_public
  ) VALUES (
    @id, @user_id, @created_at, @mode, @topic, @brand_name, @purpose, @audience, @style, @palette,
    @format, @cta, @tone, @extra_notes, @total_slides, @seed, @brief_json, 0
  )
`)

const insertSlideStmt = db.prepare(`
  INSERT INTO slides (
    id, generation_id, slide_index, file_name, mime_type, width, height,
    bytes_original, bytes_stored, prompt, role, headline, created_at
  ) VALUES (
    @id, @generation_id, @slide_index, @file_name, @mime_type, @width, @height,
    @bytes_original, @bytes_stored, @prompt, @role, @headline, @created_at
  )
`)

const listGenerationsStmt = db.prepare(`
  SELECT g.id, g.created_at, g.mode, g.topic, g.brand_name, g.style, g.format,
         g.total_slides, COUNT(s.id) AS slide_count, SUM(s.bytes_stored) AS bytes_stored
  FROM generations g
  LEFT JOIN slides s ON s.generation_id = g.id
  WHERE g.user_id IS ?
  GROUP BY g.id
  ORDER BY g.created_at DESC
  LIMIT ?
`)

const userStatsStmt = db.prepare(`
  SELECT
    COUNT(DISTINCT g.id) AS generation_count,
    COALESCE(SUM(CASE WHEN g.mode = 'carousel' THEN 1 ELSE 0 END), 0) AS carousel_count,
    COALESCE(SUM(CASE WHEN g.mode = 'single'   THEN 1 ELSE 0 END), 0) AS single_count,
    COUNT(s.id) AS slide_count,
    COALESCE(SUM(s.bytes_stored), 0) AS bytes_stored,
    MIN(g.created_at) AS first_at,
    MAX(g.created_at) AS last_at
  FROM generations g
  LEFT JOIN slides s ON s.generation_id = g.id
  WHERE g.user_id IS ?
`)

const getGenerationStmt = db.prepare('SELECT * FROM generations WHERE id = ?')
const getSlidesByGenerationStmt = db.prepare('SELECT * FROM slides WHERE generation_id = ? ORDER BY slide_index ASC')
const deleteGenerationStmt = db.prepare('DELETE FROM generations WHERE id = ?')

// Showcase: one representative slide per generation (the first one), newest
// first. Only generations the user explicitly marked public are returned so
// private work never leaks to the landing page.
const listShowcaseStmt = db.prepare(`
  SELECT s.id, s.generation_id, s.slide_index, s.file_name, s.created_at,
         g.mode, g.topic, g.brand_name, g.format, g.total_slides
  FROM slides s
  INNER JOIN generations g ON g.id = s.generation_id
  WHERE s.slide_index = 1 AND g.is_public = 1
  ORDER BY s.created_at DESC
  LIMIT ?
`)

const setGenerationPublicStmt = db.prepare('UPDATE generations SET is_public = ? WHERE id = ? AND user_id = ?')

export function setGenerationPublic(id, userId, isPublic) {
  const info = setGenerationPublicStmt.run(isPublic ? 1 : 0, id, userId)
  return info.changes > 0
}

export function createGenerationId() {
  return crypto.randomUUID()
}

export function createSlideId() {
  return crypto.randomUUID()
}

export function saveGeneration(record) {
  insertGenerationStmt.run(record)
}

/**
 * Compress the raw PNG bytes to WebP and persist to disk. Returns metadata
 * suitable for DB insertion. We drop the PNG alpha channel since the design
 * system already uses solid backgrounds, shaving additional bytes.
 */
export async function compressAndStoreImage({ generationId, slideIndex, pngBuffer, quality = 82 }) {
  const pipeline = sharp(pngBuffer, { failOn: 'error', limitInputPixels: 50 * 1024 * 1024 })
    .flatten({ background: '#ffffff' })
  const { data, info } = await pipeline
    // effort: 3 trades ~5% extra bytes for a 2-3x faster encode vs effort:5.
    // On 10-slide carousels this is the difference between a snappy finish
    // and the client timing out waiting for the last WebP encode.
    .webp({ quality, effort: 3, smartSubsample: true })
    .toBuffer({ resolveWithObject: true })

  const fileName = `${generationId}-${String(slideIndex).padStart(2, '0')}.webp`
  const filePath = path.join(IMAGES_DIR, fileName)
  await fs.promises.writeFile(filePath, data)

  return {
    fileName,
    mimeType: 'image/webp',
    width: info.width,
    height: info.height,
    bytesOriginal: pngBuffer.length,
    bytesStored: data.length,
  }
}

export function saveSlide(record) {
  insertSlideStmt.run(record)
}

/**
 * Read a stored WebP image from disk and convert it to PNG bytes. Used by
 * the /api/images/:fileName.png download endpoint so users can save in a
 * format Instagram and Canva treat as first-class.
 */
export async function convertStoredImageToPng(fileName) {
  const safe = path.basename(fileName)
  const filePath = path.join(IMAGES_DIR, safe)
  const input = await fs.promises.readFile(filePath)
  return sharp(input, { failOn: 'error', limitInputPixels: 50 * 1024 * 1024 })
    // compressionLevel 6 is the zlib default — within 2-3% of level 9 on
    // photo-heavy PNGs but 3-4x faster. The browser download is the choke
    // point users feel, so we optimise for encode speed over a few extra KB.
    .png({ compressionLevel: 6, adaptiveFiltering: false })
    .toBuffer()
}

export function listGenerations(userId = null, limit = 50) {
  return listGenerationsStmt.all(userId, Math.min(Math.max(Number(limit) || 50, 1), 200))
}

export function getUserStats(userId = null) {
  return userStatsStmt.get(userId) || {
    generation_count: 0, carousel_count: 0, single_count: 0,
    slide_count: 0, bytes_stored: 0, first_at: null, last_at: null,
  }
}

export function listShowcaseSlides(limit = 24) {
  return listShowcaseStmt.all(Math.min(Math.max(Number(limit) || 24, 1), 60))
}

// Count how many generations this user created in the last 24 hours. Used
// by the admin-configurable daily limit — O(n) is fine because this is one
// row per generation, scoped by an indexed user_id.
const userGenerations24hStmt = db.prepare(`
  SELECT COUNT(*) AS n FROM generations
  WHERE user_id = ? AND created_at > ?
`)

export function countUserGenerations24h(userId) {
  return userGenerations24hStmt.get(userId, Date.now() - 24 * 60 * 60 * 1000).n
}

export function getGeneration(id) {
  const generation = getGenerationStmt.get(id)
  if (!generation) return null
  const slides = getSlidesByGenerationStmt.all(id)
  return { generation, slides }
}

export function isGenerationOwnedBy(id, userId) {
  const gen = getGenerationStmt.get(id)
  if (!gen) return false
  // Orphaned generations (user_id NULL from before auth) are accessible only
  // when unauthenticated; authenticated users get their own rows only.
  if (userId) return gen.user_id === userId
  return !gen.user_id
}

export function deleteGeneration(id) {
  const { generation, slides } = getGeneration(id) || {}
  if (!generation) return false
  for (const slide of slides) {
    const filePath = path.join(IMAGES_DIR, slide.file_name)
    fs.promises.unlink(filePath).catch(() => {})
  }
  deleteGenerationStmt.run(id)
  return true
}

export function resolveImagePath(fileName) {
  // Prevent path traversal.
  const safe = path.basename(fileName)
  return path.join(IMAGES_DIR, safe)
}

export function imagesDir() {
  return IMAGES_DIR
}

/* ---------- user auth ---------- */

const insertUserStmt = db.prepare(`
  INSERT INTO users (id, email, name, password, created_at)
  VALUES (@id, @email, @name, @password, @created_at)
`)
const getUserByEmailStmt = db.prepare('SELECT * FROM users WHERE email = ?')
const getUserByIdStmt = db.prepare('SELECT * FROM users WHERE id = ?')

export function createUserId() {
  return crypto.randomUUID()
}

export function createUser({ id, email, name, password }) {
  insertUserStmt.run({ id, email, name: name || null, password, created_at: Date.now() })
  return getUserByIdStmt.get(id)
}

export function getUserByEmail(email) {
  return getUserByEmailStmt.get(email)
}

/* ---------- uploads (in-memory, never persisted) ----------
 *
 * Uploads are processed server-side for compression + safety hardening then
 * returned to the client as a data URL. Nothing is written to disk or the
 * database — the browser keeps the bytes in memory and ships them inline
 * with the next generate request. This keeps the server storage-free and
 * avoids storing user-supplied imagery we don't actually need to retain.
 */

/**
 * Compress an uploaded image to WebP in memory WITHOUT persisting it.
 * Hardens against zip-bomb images (pixel cap, failOn, dimension reject)
 * and auto-orients based on EXIF. Returns a data URL + dimensions.
 */
export async function processUploadedImage({ buffer, kind, maxSize = 1600, quality = 85 }) {
  const MAX_PIXELS = 50 * 1024 * 1024

  const probe = sharp(buffer, { failOn: 'error', limitInputPixels: MAX_PIXELS })
  const meta = await probe.metadata().catch(() => null)
  if (!meta || !meta.width || !meta.height) {
    throw new Error('File tidak dikenali sebagai gambar.')
  }
  if (meta.width * meta.height > MAX_PIXELS) {
    throw new Error('Resolusi gambar terlalu besar.')
  }

  const pipeline = sharp(buffer, { failOn: 'error', limitInputPixels: MAX_PIXELS })
    .rotate()
    .resize({ width: maxSize, height: maxSize, fit: 'inside', withoutEnlargement: true })

  const { data, info } = await pipeline
    // effort 3 for uploads — they're in-memory passthrough, we want them
    // ready for the very next generate call, not maximally compressed.
    .webp({ quality, effort: 3 })
    .toBuffer({ resolveWithObject: true })

  return {
    kind,
    dataUrl: `data:image/webp;base64,${data.toString('base64')}`,
    width: info.width,
    height: info.height,
    bytes: data.length,
    createdAt: Date.now(),
  }
}

/* ---------- audit log ---------- */

const insertAuthEventStmt = db.prepare(`
  INSERT INTO auth_events (user_id, email, event, ip, user_agent, created_at)
  VALUES (@user_id, @email, @event, @ip, @user_agent, @created_at)
`)

const listAuthEventsStmt = db.prepare(`
  SELECT id, user_id, email, event, ip, user_agent, created_at
  FROM auth_events
  WHERE user_id IS ?
  ORDER BY created_at DESC
  LIMIT ?
`)

/**
 * Append-only audit logger for auth events. `ip` and `user_agent` are
 * optional; the caller will typically pass req.ip and req.headers['user-agent'].
 * Values are truncated defensively to avoid unbounded row growth.
 */
export function logAuthEvent({ userId = null, email = null, event, ip = null, userAgent = null }) {
  insertAuthEventStmt.run({
    user_id: userId,
    email: email ? String(email).slice(0, 200) : null,
    event: String(event).slice(0, 32),
    ip: ip ? String(ip).slice(0, 64) : null,
    user_agent: userAgent ? String(userAgent).slice(0, 300) : null,
    created_at: Date.now(),
  })
}

export function listAuthEvents(userId, limit = 50) {
  return listAuthEventsStmt.all(userId, Math.min(Math.max(Number(limit) || 50, 1), 200))
}

/* ---------- admin helpers ---------- */

const listUsersStmt = db.prepare(`
  SELECT u.id, u.email, u.name, u.role, u.created_at,
         COUNT(DISTINCT g.id) AS generation_count,
         COALESCE(SUM(s.bytes_stored), 0) AS bytes_stored
  FROM users u
  LEFT JOIN generations g ON g.user_id = u.id
  LEFT JOIN slides s ON s.generation_id = g.id
  GROUP BY u.id
  ORDER BY u.created_at DESC
  LIMIT ? OFFSET ?
`)

const countUsersStmt = db.prepare('SELECT COUNT(*) AS n FROM users')

const setUserRoleStmt = db.prepare("UPDATE users SET role = ? WHERE id = ?")

const deleteUserStmt = db.prepare('DELETE FROM users WHERE id = ?')

// Platform-wide stats for the admin overview card.
const platformStatsStmt = db.prepare(`
  SELECT
    (SELECT COUNT(*) FROM users)                              AS users_count,
    (SELECT COUNT(*) FROM users WHERE role = 'admin')         AS admins_count,
    (SELECT COUNT(*) FROM generations)                        AS generations_count,
    (SELECT COUNT(*) FROM generations WHERE is_public = 1)    AS public_count,
    (SELECT COUNT(*) FROM slides)                             AS slides_count,
    (SELECT COALESCE(SUM(bytes_stored), 0) FROM slides)       AS bytes_stored,
    (SELECT COUNT(*) FROM auth_events WHERE event = 'login_fail'
       AND created_at > (strftime('%s','now') * 1000 - 86400000))
                                                              AS recent_login_fails,
    (SELECT MAX(created_at) FROM generations)                 AS last_generation_at
`)

const listAllGenerationsStmt = db.prepare(`
  SELECT g.id, g.user_id, g.created_at, g.mode, g.topic, g.brand_name, g.format,
         g.total_slides, g.is_public,
         u.email AS user_email, u.name AS user_name,
         COUNT(s.id) AS slide_count, COALESCE(SUM(s.bytes_stored), 0) AS bytes_stored
  FROM generations g
  LEFT JOIN users u ON u.id = g.user_id
  LEFT JOIN slides s ON s.generation_id = g.id
  GROUP BY g.id
  ORDER BY g.created_at DESC
  LIMIT ? OFFSET ?
`)

const listAllAuthEventsStmt = db.prepare(`
  SELECT e.id, e.user_id, e.email, e.event, e.ip, e.user_agent, e.created_at,
         u.email AS user_email
  FROM auth_events e
  LEFT JOIN users u ON u.id = e.user_id
  ORDER BY e.created_at DESC
  LIMIT ? OFFSET ?
`)

export function listUsers(limit = 50, offset = 0) {
  return listUsersStmt.all(
    Math.min(Math.max(Number(limit) || 50, 1), 200),
    Math.max(Number(offset) || 0, 0),
  )
}

export function countUsers() {
  return countUsersStmt.get().n
}

export function setUserRole(userId, role) {
  if (role !== 'admin' && role !== 'user') return false
  const info = setUserRoleStmt.run(role, userId)
  return info.changes > 0
}

export function deleteUser(userId) {
  // CASCADE: generations of this user keep their rows but get user_id=NULL
  // so their images stay discoverable through admin tools; if you want full
  // delete, call deleteGeneration first. Right here we just drop the user row.
  const info = deleteUserStmt.run(userId)
  return info.changes > 0
}

export function platformStats() {
  return platformStatsStmt.get()
}

export function listAllGenerations(limit = 50, offset = 0) {
  return listAllGenerationsStmt.all(
    Math.min(Math.max(Number(limit) || 50, 1), 200),
    Math.max(Number(offset) || 0, 0),
  )
}

export function listAllAuthEvents(limit = 100, offset = 0) {
  return listAllAuthEventsStmt.all(
    Math.min(Math.max(Number(limit) || 100, 1), 500),
    Math.max(Number(offset) || 0, 0),
  )
}

/* ---------- settings store ---------- */

const getSettingStmt = db.prepare('SELECT value FROM settings WHERE key = ?')
const upsertSettingStmt = db.prepare(`
  INSERT INTO settings (key, value, updated_at, updated_by)
  VALUES (@key, @value, @updated_at, @updated_by)
  ON CONFLICT(key) DO UPDATE SET
    value = excluded.value,
    updated_at = excluded.updated_at,
    updated_by = excluded.updated_by
`)
const listSettingsStmt = db.prepare('SELECT key, value, updated_at, updated_by FROM settings')

/**
 * Get a setting value parsed from JSON. Returns `fallback` when the key
 * doesn't exist or when the stored blob is unparseable — callers can
 * rely on a sensible default without extra defensive code at each site.
 */
export function getSetting(key, fallback = null) {
  const row = getSettingStmt.get(key)
  if (!row) return fallback
  try { return JSON.parse(row.value) }
  catch { return fallback }
}

export function setSetting(key, value, updatedBy = null) {
  upsertSettingStmt.run({
    key,
    value: JSON.stringify(value),
    updated_at: Date.now(),
    updated_by: updatedBy,
  })
}

export function listAllSettings() {
  return listSettingsStmt.all().map((row) => ({
    key: row.key,
    value: safeJson(row.value),
    updatedAt: row.updated_at,
    updatedBy: row.updated_by,
  }))
}

function safeJson(s) {
  try { return JSON.parse(s) } catch { return null }
}

const userRoleStmt = db.prepare('SELECT role FROM users WHERE id = ?')

export function userRole(userId) {
  const row = userRoleStmt.get(userId)
  return row?.role || 'user'
}
