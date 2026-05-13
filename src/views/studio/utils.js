/**
 * Small pure utilities shared across Studio files. Kept dependency-free so
 * they can be imported anywhere without pulling React or UI libs.
 */

export function formatMs(seconds) {
  const mm = String(Math.floor(seconds / 60)).padStart(2, '0')
  const ss = String(seconds % 60).padStart(2, '0')
  return `${mm}:${ss}`
}

export function formatRelative(ts) {
  if (!ts) return ''
  const diff = Date.now() - ts
  const min = Math.floor(diff / 60_000)
  if (min < 1) return 'baru saja'
  if (min < 60) return `${min}m lalu`
  const hr = Math.floor(min / 60)
  if (hr < 24) return `${hr}j lalu`
  const day = Math.floor(hr / 24)
  if (day < 7) return `${day}h lalu`
  return new Date(ts).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })
}

export function slugify(value, maxLen = 28) {
  if (!value) return ''
  return String(value)
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, maxLen)
}

function timestampStamp(d = new Date()) {
  const p = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`
}

function randomTag() {
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    const buf = new Uint8Array(3)
    crypto.getRandomValues(buf)
    return Array.from(buf).map((b) => b.toString(16).padStart(2, '0')).join('')
  }
  return Math.random().toString(36).slice(2, 8)
}

/**
 * Build a unique, descriptive download filename for a generated slide.
 * Format: feeddesigner_<topic>_<brand>_<mode>_slide-NN_<yyyymmdd-hhmmss>_<id>.<ext>
 * Empty fields are skipped gracefully so the filename stays readable.
 */
export function buildDownloadName({ topic, brand, mode, slideIndex, totalSlides, imageUrl, ext = 'png' }) {
  const parts = ['feeddesigner']
  const topicSlug = slugify(topic)
  if (topicSlug) parts.push(topicSlug)
  const brandSlug = slugify(brand, 16)
  if (brandSlug) parts.push(brandSlug)
  parts.push(mode === 'carousel' ? 'carousel' : 'feed')
  if (mode === 'carousel' && typeof slideIndex === 'number') {
    const pad = String(slideIndex).padStart(2, '0')
    parts.push(totalSlides ? `slide-${pad}-of-${String(totalSlides).padStart(2, '0')}` : `slide-${pad}`)
  }
  parts.push(timestampStamp())

  // Prefer an id embedded in the image URL (generation UUID) when available.
  let idTag = ''
  if (typeof imageUrl === 'string') {
    const match = imageUrl.match(/\/([0-9a-f]{8})-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}-\d+\.webp/i)
    if (match) idTag = match[1]
  }
  parts.push(idTag || randomTag())

  return `${parts.join('_')}.${ext}`
}

/**
 * Derive a short filename for the titlebar from the current topic + mode.
 */
export function deriveStudioFileName(topic, isCarousel) {
  const t = (topic || '').trim()
  const safe = t ? t.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 32) : 'untitled'
  return `${safe}.${isCarousel ? 'carousel' : 'feed'}`
}

import { API_BASE_URL, resolveApiUrl } from '../../config.js'

/**
 * Convert a stored-WebP URL into the on-demand PNG export URL served by the
 * backend. Pass-through for data URLs or external URLs so downloads still
 * work when images haven't been persisted (e.g. remote-URL-only providers).
 */
export function toPngDownloadUrl(imageUrl) {
  if (typeof imageUrl !== 'string' || !imageUrl) return imageUrl
  if (imageUrl.startsWith('data:')) return imageUrl
  // Strip any existing API base so we can match the stored path, then
  // append .png + re-resolve against the current base.
  const stripped = API_BASE_URL && imageUrl.startsWith(API_BASE_URL)
    ? imageUrl.slice(API_BASE_URL.length)
    : imageUrl
  if (stripped.startsWith('/api/images/') && stripped.endsWith('.webp')) {
    return resolveApiUrl(`${stripped}.png`)
  }
  return imageUrl
}
