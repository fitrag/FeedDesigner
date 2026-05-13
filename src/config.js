/**
 * Client-side configuration.
 *
 * API_BASE_URL controls where the client sends API requests.
 * - In development: empty string (Vite proxy handles /api → localhost:8787)
 * - In production (same origin): empty string (server serves SPA + API)
 * - In production (separate origins): set VITE_API_BASE_URL in .env
 *   e.g. VITE_API_BASE_URL=https://api.feeddesigner.com
 *
 * Usage: import { API_BASE_URL } from '../config.js'
 *        fetch(`${API_BASE_URL}/api/auth/me`)
 */
export const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || '').replace(/\/$/, '')

/**
 * Resolve a server-relative URL (e.g. `/api/images/abc.webp`) to a full URL
 * the browser can fetch. In same-origin deploys this is a no-op; in cross-
 * origin deploys the API base is prepended. Safe for `null`/empty inputs.
 */
export function resolveApiUrl(url) {
  if (!url) return url
  if (url.startsWith('http://') || url.startsWith('https://')) return url
  if (url.startsWith('data:')) return url
  if (url.startsWith('/')) return `${API_BASE_URL}${url}`
  return url
}
