import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

/**
 * Lightweight auth helpers using only Node core:
 * - Password hashing via scrypt (OWASP recommended).
 * - Stateless JWT-like HS256 tokens so we don't need a sessions table.
 * - Persistent HMAC secret loaded from env or generated once under data/.
 */

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const DATA_DIR = path.resolve(__dirname, '..', 'data')
const SECRET_FILE = path.resolve(DATA_DIR, '.auth-secret')

const TOKEN_TTL_SECONDS = Number(process.env.AUTH_TOKEN_TTL_SECONDS) || 7 * 24 * 60 * 60 // 7d
const SCRYPT_OPTS = { N: 16384, r: 8, p: 1, maxmem: 64 * 1024 * 1024 }
const KEY_LEN = 64

function loadOrCreateSecret() {
  if (process.env.AUTH_SECRET && process.env.AUTH_SECRET.trim()) {
    return process.env.AUTH_SECRET.trim()
  }
  try {
    fs.mkdirSync(DATA_DIR, { recursive: true })
    if (fs.existsSync(SECRET_FILE)) {
      return fs.readFileSync(SECRET_FILE, 'utf8').trim()
    }
    const secret = crypto.randomBytes(48).toString('hex')
    fs.writeFileSync(SECRET_FILE, secret, { mode: 0o600 })
    return secret
  } catch {
    // Fallback to a volatile secret — tokens won't survive restart but the
    // app still works in memory-only environments.
    return crypto.randomBytes(48).toString('hex')
  }
}

const SECRET = loadOrCreateSecret()

/* ---------- password ---------- */

export function hashPassword(password) {
  return new Promise((resolve, reject) => {
    const salt = crypto.randomBytes(16)
    crypto.scrypt(password, salt, KEY_LEN, SCRYPT_OPTS, (err, derived) => {
      if (err) return reject(err)
      resolve(`scrypt$${salt.toString('hex')}$${derived.toString('hex')}`)
    })
  })
}

export function verifyPassword(password, stored) {
  return new Promise((resolve) => {
    if (!stored || typeof stored !== 'string') return resolve(false)
    const [algo, saltHex, hashHex] = stored.split('$')
    if (algo !== 'scrypt' || !saltHex || !hashHex) return resolve(false)
    const salt = Buffer.from(saltHex, 'hex')
    const expected = Buffer.from(hashHex, 'hex')
    crypto.scrypt(password, salt, expected.length, SCRYPT_OPTS, (err, derived) => {
      if (err) return resolve(false)
      try { resolve(crypto.timingSafeEqual(derived, expected)) }
      catch { resolve(false) }
    })
  })
}

/* ---------- token ---------- */

function b64url(input) {
  return Buffer.from(input).toString('base64url')
}

function fromB64url(s) {
  return Buffer.from(s, 'base64url').toString('utf8')
}

export function signToken(payload, ttlSeconds = TOKEN_TTL_SECONDS) {
  const now = Math.floor(Date.now() / 1000)
  const header = { alg: 'HS256', typ: 'JWT' }
  const body = { ...payload, iat: now, exp: now + ttlSeconds }
  const hp = `${b64url(JSON.stringify(header))}.${b64url(JSON.stringify(body))}`
  const sig = crypto.createHmac('sha256', SECRET).update(hp).digest('base64url')
  return `${hp}.${sig}`
}

export function verifyToken(token) {
  if (!token || typeof token !== 'string') return null
  const parts = token.split('.')
  if (parts.length !== 3) return null
  const [h, p, sig] = parts
  const expected = crypto.createHmac('sha256', SECRET).update(`${h}.${p}`).digest('base64url')
  const sigBuf = Buffer.from(sig)
  const expBuf = Buffer.from(expected)
  if (sigBuf.length !== expBuf.length) return null
  if (!crypto.timingSafeEqual(sigBuf, expBuf)) return null
  try {
    const payload = JSON.parse(fromB64url(p))
    if (payload.exp && Date.now() / 1000 > payload.exp) return null
    return payload
  } catch {
    return null
  }
}

/* ---------- middleware ---------- */

const AUTH_COOKIE = 'fd_auth'
const CSRF_COOKIE = 'fd_csrf'

export { AUTH_COOKIE, CSRF_COOKIE }

/**
 * Attaches req.user when a valid token is present. Token source priority:
 *   1. `Authorization: Bearer <token>` header — used by legacy clients and
 *      for same-origin fetch calls that explicitly read the cookie.
 *   2. `fd_auth` httpOnly cookie — the primary path; XSS-resistant because
 *      JS cannot read it.
 * Always calls next (so anonymous routes still work).
 */
export function authMiddleware(req, _res, next) {
  let token = null
  const header = req.headers.authorization || ''
  const m = header.match(/^Bearer\s+(.+)$/i)
  if (m) token = m[1]
  if (!token && req.cookies) token = req.cookies[AUTH_COOKIE] || null

  if (token) {
    const payload = verifyToken(token)
    if (payload && payload.sub) {
      req.user = { id: payload.sub, email: payload.email, name: payload.name }
    }
  }
  next()
}

/** Rejects the request when no user is attached. */
export function requireAuth(req, res, next) {
  if (!req.user) return res.status(401).json({ error: 'Login diperlukan.' })
  next()
}

/**
 * CSRF middleware for cookie-based auth. When the auth cookie is present
 * AND the request is a state-changing method, require that a matching
 * CSRF token was sent in the `X-CSRF-Token` header. This is the classic
 * double-submit pattern: attackers cross-origin can set the cookie to
 * tag along, but cannot read it (SameSite blocks read from foreign
 * origins anyway, but belt + suspenders).
 *
 * Bearer-only requests (e.g. mobile apps) skip this check since they
 * supply credentials via a header the attacker can't forge cross-origin.
 */
const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS'])
export function requireCsrfIfCookie(req, res, next) {
  if (SAFE_METHODS.has(req.method)) return next()
  if (!req.cookies || !req.cookies[AUTH_COOKIE]) return next() // bearer-only
  const cookieToken = req.cookies[CSRF_COOKIE]
  const headerToken = req.headers['x-csrf-token']
  if (!cookieToken || !headerToken || cookieToken !== headerToken) {
    return res.status(403).json({ error: 'CSRF token tidak valid.' })
  }
  next()
}

/* ---------- cookie helpers ---------- */

/**
 * Issue both cookies in a single call. Auth cookie is httpOnly (XSS-proof),
 * csrf cookie is readable by JS (used for double-submit). Both share the
 * same max-age so they expire together. In production set `secure: true`
 * via SECURE_COOKIES env.
 */
export function setAuthCookies(res, token, ttlSeconds = TOKEN_TTL_SECONDS) {
  const csrf = crypto.randomBytes(24).toString('hex')
  const secure = process.env.SECURE_COOKIES === 'true'
  const base = {
    maxAge: ttlSeconds * 1000,
    path: '/',
    sameSite: 'lax',
    secure,
  }
  res.cookie(AUTH_COOKIE, token, { ...base, httpOnly: true })
  res.cookie(CSRF_COOKIE, csrf, { ...base, httpOnly: false })
  return csrf
}

export function clearAuthCookies(res) {
  const secure = process.env.SECURE_COOKIES === 'true'
  const base = { path: '/', sameSite: 'lax', secure }
  res.clearCookie(AUTH_COOKIE, { ...base, httpOnly: true })
  res.clearCookie(CSRF_COOKIE, { ...base, httpOnly: false })
}
