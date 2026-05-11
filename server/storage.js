import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import crypto from 'node:crypto'
import Database from 'better-sqlite3'
import sharp from 'sharp'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const DATA_DIR = path.resolve(__dirname, '..', 'data')
const IMAGES_DIR = path.resolve(DATA_DIR, 'images')
const UPLOADS_DIR = path.resolve(DATA_DIR, 'uploads')
const DB_PATH = path.resolve(DATA_DIR, 'feeddesigner.db')

fs.mkdirSync(IMAGES_DIR, { recursive: true })
fs.mkdirSync(UPLOADS_DIR, { recursive: true })

const db = new Database(DB_PATH)
db.pragma('journal_mode = WAL')
db.pragma('synchronous = NORMAL')
db.pragma('foreign_keys = ON')

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id          TEXT PRIMARY KEY,
    email       TEXT NOT NULL UNIQUE,
    name        TEXT,
    password    TEXT NOT NULL,
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

  CREATE TABLE IF NOT EXISTS uploads (
    id           TEXT PRIMARY KEY,
    user_id      TEXT,
    kind         TEXT NOT NULL,
    file_name    TEXT NOT NULL,
    mime_type    TEXT NOT NULL,
    width        INTEGER,
    height       INTEGER,
    bytes        INTEGER,
    created_at   INTEGER NOT NULL
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

// Indexes now that all required columns are guaranteed to exist.
db.exec(`
  CREATE INDEX IF NOT EXISTS idx_slides_generation ON slides(generation_id, slide_index);
  CREATE INDEX IF NOT EXISTS idx_generations_created ON generations(created_at DESC);
  CREATE INDEX IF NOT EXISTS idx_generations_user ON generations(user_id, created_at DESC);
  CREATE INDEX IF NOT EXISTS idx_uploads_user ON uploads(user_id, created_at DESC);
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
    .webp({ quality, effort: 5, smartSubsample: true })
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
    .png({ compressionLevel: 9, adaptiveFiltering: true })
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

/* ---------- uploads (product / reference photos) ---------- */

const insertUploadStmt = db.prepare(`
  INSERT INTO uploads (id, user_id, kind, file_name, mime_type, width, height, bytes, created_at)
  VALUES (@id, @user_id, @kind, @file_name, @mime_type, @width, @height, @bytes, @created_at)
`)
const getUploadStmt = db.prepare('SELECT * FROM uploads WHERE id = ?')
const deleteUploadStmt = db.prepare('DELETE FROM uploads WHERE id = ? AND (user_id IS ? OR ? IS NULL)')

export function createUploadId() {
  return crypto.randomUUID()
}

/**
 * Accept a raw image buffer (from any format supported by sharp), normalize to
 * WebP at a reasonable max dimension, persist under data/uploads/, and write a
 * row to the uploads table. Returns both the DB record and the stored bytes.
 */
/**
 * Accept a raw image buffer (from any format supported by sharp), normalize to
 * WebP at a reasonable max dimension, persist under data/uploads/, and write a
 * row to the uploads table. Returns both the DB record and the stored bytes.
 *
 * Hardening: sharp defaults allow decoded pixel counts in the hundreds of
 * millions, which a tiny malicious file can balloon into hundreds of MB of
 * RSS. We cap both pixel count and input dimensions defensively.
 */
export async function saveUploadedImage({ id, userId, kind, buffer, maxSize = 1600, quality = 85 }) {
  // Cap decoded pixels to ~50 megapixels (roughly 7000×7000). A typical
  // camera photo is 12–48 MP, so we still accept normal uploads but reject
  // zip-bomb-style images that would OOM the process.
  const MAX_PIXELS = 50 * 1024 * 1024

  // Peek at metadata on a disposable pipeline first so we can reject wrong
  // files before the expensive resize step.
  const probe = sharp(buffer, { failOn: 'error', limitInputPixels: MAX_PIXELS })
  const meta = await probe.metadata().catch(() => null)
  if (!meta || !meta.width || !meta.height) {
    throw new Error('File tidak dikenali sebagai gambar.')
  }
  if (meta.width * meta.height > MAX_PIXELS) {
    throw new Error('Resolusi gambar terlalu besar.')
  }

  const pipeline = sharp(buffer, { failOn: 'error', limitInputPixels: MAX_PIXELS })
    .rotate() // auto-orient based on EXIF
    .resize({
      width: maxSize,
      height: maxSize,
      fit: 'inside',
      withoutEnlargement: true,
    })
  const { data, info } = await pipeline
    .webp({ quality, effort: 5 })
    .toBuffer({ resolveWithObject: true })

  const fileName = `${id}.webp`
  const filePath = path.join(UPLOADS_DIR, fileName)
  await fs.promises.writeFile(filePath, data)

  const now = Date.now()
  insertUploadStmt.run({
    id,
    user_id: userId || null,
    kind,
    file_name: fileName,
    mime_type: 'image/webp',
    width: info.width || meta.width || null,
    height: info.height || meta.height || null,
    bytes: data.length,
    created_at: now,
  })

  return {
    id,
    kind,
    fileName,
    url: `/api/uploads/${fileName}`,
    width: info.width,
    height: info.height,
    bytes: data.length,
    createdAt: now,
  }
}

export function getUpload(id) {
  return getUploadStmt.get(id)
}

export function resolveUploadPath(fileName) {
  const safe = path.basename(fileName)
  return path.join(UPLOADS_DIR, safe)
}

export function deleteUpload(id, userId = null) {
  const row = getUploadStmt.get(id)
  if (!row) return false
  // Ownership check: if row has user_id, require matching user
  if (row.user_id && row.user_id !== userId) return false
  const filePath = path.join(UPLOADS_DIR, row.file_name)
  fs.promises.unlink(filePath).catch(() => {})
  deleteUploadStmt.run(id, userId, userId)
  return true
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
