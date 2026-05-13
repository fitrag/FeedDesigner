import { createContext, memo, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { AtSign, Eye, EyeOff, LayoutDashboard, LogIn, LogOut, Lock, Shield, User, UserPlus, X } from 'lucide-react'
import { useSettings } from './settings.jsx'
import { API_BASE_URL } from '../config.js'

/* ---------- auth client state ----------
 *
 * Authentication uses httpOnly cookies set by the server, so JS can't read
 * the auth token — XSS attackers can't steal it from localStorage or
 * document.cookie. What we DO keep in memory is a CSRF token (returned as
 * a readable cookie + echoed in the login response), which we forward on
 * every state-changing request via the `X-CSRF-Token` header. The server
 * verifies the header matches the cookie (classic double-submit pattern).
 *
 * A legacy bearer token may still be present in localStorage from pre-cookie
 * sessions; we consume and clear it on first boot so those users aren't
 * signed out, but never write to localStorage again.
 */

const LEGACY_TOKEN_KEY = 'feeddesigner:token'
const CSRF_COOKIE = 'fd_csrf'

let currentCsrf = null

/** Read the CSRF value from the readable cookie set by the server. */
function readCsrfCookie() {
  if (typeof document === 'undefined') return null
  const m = document.cookie.match(new RegExp(`(?:^|; )${CSRF_COOKIE}=([^;]+)`))
  return m ? decodeURIComponent(m[1]) : null
}

function setCurrentCsrf(token) {
  currentCsrf = token || null
}

/** One-time consumption of any legacy bearer token stored before the cookie
 *  migration, so existing users don't get signed out on deploy. We never
 *  write to localStorage again. */
function takeLegacyToken() {
  try {
    if (typeof window === 'undefined') return null
    const t = window.localStorage.getItem(LEGACY_TOKEN_KEY)
    if (t) window.localStorage.removeItem(LEGACY_TOKEN_KEY)
    return t || null
  } catch { return null }
}

/**
 * fetch() wrapper that:
 * - prepends API_BASE_URL so the app works with a remote API server
 * - always includes credentials so the httpOnly auth cookie is sent
 * - attaches the CSRF header on state-changing requests when we have one
 * - auto-recovers from a stale CSRF: on 403 "CSRF token tidak valid", it
 *   refreshes the token via /api/auth/me and retries the original request
 *   once. This absorbs the race where a cookie was rotated mid-flight.
 */
export async function authedFetch(url, init = {}) {
  const fullUrl = url.startsWith('http') ? url : `${API_BASE_URL}${url}`
  const method = (init.method || 'GET').toUpperCase()
  const isStateChanging = method !== 'GET' && method !== 'HEAD' && method !== 'OPTIONS'

  const doFetch = async () => {
    const headers = new Headers(init.headers || {})
    const csrf = readCsrfCookie() || currentCsrf
    if (isStateChanging && csrf) headers.set('X-CSRF-Token', csrf)
    return fetch(fullUrl, { ...init, credentials: 'include', headers })
  }

  let res = await doFetch()

  // Auto-recover from CSRF mismatch. Only retry once, only for state-changing
  // requests, only on 403 — avoid loops and stale-auth confusion.
  if (res.status === 403 && isStateChanging) {
    try {
      const meRes = await fetch(`${API_BASE_URL}/api/auth/me`, { credentials: 'include' })
      if (meRes.ok) {
        const data = await meRes.json().catch(() => ({}))
        if (data?.csrf) setCurrentCsrf(data.csrf)
        res = await doFetch()
      }
    } catch { /* ignore, original 403 will be returned */ }
  }

  return res
}

/* ---------- context ---------- */

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [status, setStatus] = useState('idle') // idle | loading | authed | guest
  const [dialog, setDialog] = useState(null) // null | 'login' | 'register'

  // On mount, ask the server who we are. Cookies are sent automatically;
  // no token in localStorage needed. If a legacy bearer exists we pass it
  // once so the server can promote the session to cookies.
  useEffect(() => {
    let aborted = false
    const legacy = takeLegacyToken()
    const seedCsrf = readCsrfCookie()
    if (seedCsrf) setCurrentCsrf(seedCsrf)

    const init = legacy
      ? { headers: { Authorization: `Bearer ${legacy}` } }
      : {}

    setStatus('loading')
    fetch(`${API_BASE_URL}/api/auth/me`, { credentials: 'include', ...init })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error('unauth'))))
      .then((d) => {
        if (aborted) return
        if (d.csrf) setCurrentCsrf(d.csrf)
        setUser(d.user)
        setStatus('authed')
      })
      .catch(() => {
        if (aborted) return
        setCurrentCsrf(null)
        setUser(null)
        setStatus('guest')
      })
    return () => { aborted = true }
  }, [])

  const login = useCallback(async ({ email, password }) => {
    const res = await fetch(`${API_BASE_URL}/api/auth/login`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    })
    const data = await res.json().catch(() => ({}))
    if (!res.ok) throw new Error(data?.error || 'Gagal login.')
    setCurrentCsrf(data.csrf || readCsrfCookie())
    setUser(data.user)
    setStatus('authed')
    return data.user
  }, [])

  const register = useCallback(async ({ email, password, name }) => {
    const res = await fetch(`${API_BASE_URL}/api/auth/register`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password, name }),
    })
    const data = await res.json().catch(() => ({}))
    if (!res.ok) throw new Error(data?.error || 'Gagal mendaftar.')
    setCurrentCsrf(data.csrf || readCsrfCookie())
    setUser(data.user)
    setStatus('authed')
    return data.user
  }, [])

  const logout = useCallback(() => {
    // Fire-and-forget — server clears cookies and logs the event. We
    // reset local state immediately so UI doesn't wait on the network.
    authedFetch('/api/auth/logout', { method: 'POST' }).catch(() => {})
    setCurrentCsrf(null)
    setUser(null)
    setStatus('guest')
  }, [])

  const openLogin = useCallback(() => setDialog('login'), [])
  const openRegister = useCallback(() => setDialog('register'), [])
  const closeDialog = useCallback(() => setDialog(null), [])

  const api = useMemo(() => ({
    user, status, isAuthed: status === 'authed',
    login, register, logout,
    openLogin, openRegister, closeDialog,
    dialog,
  }), [user, status, login, register, logout, openLogin, openRegister, closeDialog, dialog])

  return (
    <AuthContext.Provider value={api}>
      {children}
      <AuthDialog />
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) {
    return {
      user: null, status: 'guest', isAuthed: false,
      login: async () => {}, register: async () => {}, logout: () => {},
      openLogin: () => {}, openRegister: () => {}, closeDialog: () => {}, dialog: null,
    }
  }
  return ctx
}

/* ---------- Auth dialog (login / register) ---------- */

function AuthDialog() {
  const { dialog, closeDialog, login, register, openLogin, openRegister } = useAuth()
  const { settings } = useSettings()
  const registrationEnabled = settings.registrationEnabled !== false
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [name, setName] = useState('')
  const [showPass, setShowPass] = useState(false)
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const emailRef = useRef(null)

  useEffect(() => {
    if (dialog) {
      setError('')
      setSubmitting(false)
      setTimeout(() => emailRef.current?.focus(), 20)
    }
  }, [dialog])

  useEffect(() => {
    if (!dialog) return
    const onKey = (e) => { if (e.key === 'Escape') closeDialog() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [dialog, closeDialog])

  if (!dialog) return null

  const isRegister = dialog === 'register'

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (submitting) return
    setError('')
    setSubmitting(true)
    try {
      if (isRegister) {
        await register({ email, password, name })
      } else {
        await login({ email, password })
      }
      closeDialog()
      // Clear form after close
      setEmail(''); setPassword(''); setName('')
    } catch (err) {
      setError(err.message || 'Terjadi kesalahan.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-[70] grid place-items-center bg-slate-950/60 p-4 backdrop-blur-sm"
      onClick={closeDialog}
    >
      <div
        className="w-full max-w-sm overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-[0_40px_80px_-20px_rgba(15,23,42,0.4)] dark:border-slate-800 dark:bg-slate-900"
        onClick={(e) => e.stopPropagation()}
      >
        {/* header */}
        <div className="relative p-6 pb-3">
          <button
            onClick={closeDialog}
            className="absolute right-3 top-3 grid h-7 w-7 place-items-center rounded-md text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800 dark:hover:text-slate-200"
            aria-label="Tutup"
          >
            <X size={14} />
          </button>
          <div className="mb-4 grid h-10 w-10 place-items-center rounded-xl bg-slate-950 text-white dark:bg-white dark:text-slate-950">
            {isRegister ? <UserPlus size={18} strokeWidth={1.9} /> : <LogIn size={18} strokeWidth={1.9} />}
          </div>
          <h2 className="text-lg font-semibold tracking-tight text-slate-900 dark:text-slate-100">
            {isRegister ? 'Buat akun baru' : 'Masuk ke akun kamu'}
          </h2>
          <p className="mt-1 text-[13px] leading-5 text-slate-500 dark:text-slate-400">
            {isRegister
              ? 'Akun disimpan lokal di server kamu. Riwayat generate akan terasosiasi dengan akun ini.'
              : 'Akses kembali riwayat desain kamu.'}
          </p>
        </div>

        {/* form */}
        <form onSubmit={handleSubmit} className="space-y-3 px-6 pb-6">
          {isRegister && (
            <div>
              <label className="block">
                <span className="mb-1 flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-[0.08em] text-slate-500 dark:text-slate-400">
                  <User size={11} /> Nama (opsional)
                </span>
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Budi Santoso"
                  autoComplete="name"
                  className="w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-[13.5px] text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-slate-900 focus:ring-2 focus:ring-slate-900/10 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 dark:placeholder:text-slate-500 dark:focus:border-slate-100 dark:focus:ring-slate-100/10"
                />
              </label>
            </div>
          )}

          <label className="block">
            <span className="mb-1 flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-[0.08em] text-slate-500 dark:text-slate-400">
              <AtSign size={11} /> Email
            </span>
            <input
              ref={emailRef}
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="kamu@brand.com"
              autoComplete={isRegister ? 'email' : 'username'}
              required
              className="w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-[13.5px] text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-slate-900 focus:ring-2 focus:ring-slate-900/10 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 dark:placeholder:text-slate-500 dark:focus:border-slate-100 dark:focus:ring-slate-100/10"
            />
          </label>

          <label className="block">
            <span className="mb-1 flex items-center justify-between text-[11px] font-medium uppercase tracking-[0.08em] text-slate-500 dark:text-slate-400">
              <span className="flex items-center gap-1.5"><Lock size={11} /> Password</span>
              {isRegister && <span className="rounded-full bg-slate-100 px-1.5 py-0.5 text-[9px] font-medium normal-case tracking-normal text-slate-500 dark:bg-slate-800 dark:text-slate-400">Min 6</span>}
            </span>
            <div className="relative">
              <input
                type={showPass ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                autoComplete={isRegister ? 'new-password' : 'current-password'}
                minLength={6}
                required
                className="w-full rounded-md border border-slate-200 bg-white px-3 py-2 pr-9 text-[13.5px] text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-slate-900 focus:ring-2 focus:ring-slate-900/10 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 dark:placeholder:text-slate-500 dark:focus:border-slate-100 dark:focus:ring-slate-100/10"
              />
              <button
                type="button"
                onClick={() => setShowPass((v) => !v)}
                className="absolute right-2 top-1/2 grid h-6 w-6 -translate-y-1/2 place-items-center rounded text-slate-400 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800 dark:hover:text-slate-200"
                aria-label={showPass ? 'Sembunyikan password' : 'Tampilkan password'}
              >
                {showPass ? <EyeOff size={13} /> : <Eye size={13} />}
              </button>
            </div>
          </label>

          {error && (
            <div className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-[12px] text-rose-700 dark:border-rose-900/50 dark:bg-rose-950/40 dark:text-rose-300">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={submitting}
            className="flex w-full items-center justify-center gap-2 rounded-md bg-slate-950 px-4 py-2.5 text-[13.5px] font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-white dark:text-slate-950 dark:hover:bg-slate-200"
          >
            {submitting ? 'Memproses…' : isRegister ? 'Daftar akun' : 'Masuk'}
          </button>

          <p className="text-center text-[12px] text-slate-500 dark:text-slate-400">
            {isRegister ? (
              <>Sudah punya akun?{' '}
                <button type="button" onClick={openLogin} className="font-medium text-slate-900 underline-offset-2 hover:underline dark:text-slate-100">
                  Masuk
                </button>
              </>
            ) : registrationEnabled ? (
              <>Belum punya akun?{' '}
                <button type="button" onClick={openRegister} className="font-medium text-slate-900 underline-offset-2 hover:underline dark:text-slate-100">
                  Daftar gratis
                </button>
              </>
            ) : (
              <span className="italic text-slate-400 dark:text-slate-500">Pendaftaran sedang ditutup.</span>
            )}
          </p>
        </form>
      </div>
    </div>
  )
}

/* ---------- UserMenu for nav / toolbar ---------- */

export const UserMenu = memo(function UserMenu({ compact = false }) {
  const { user, isAuthed, openLogin, openRegister, logout, status } = useAuth()
  const { settings } = useSettings()
  const registrationEnabled = settings.registrationEnabled !== false
  const [open, setOpen] = useState(false)
  const menuRef = useRef(null)

  useEffect(() => {
    if (!open) return
    const onClick = (e) => { if (!menuRef.current?.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', onClick)
    return () => document.removeEventListener('mousedown', onClick)
  }, [open])

  if (status === 'loading') {
    return <div className="h-8 w-20 animate-pulse rounded-md bg-slate-200 dark:bg-slate-800" />
  }

  if (!isAuthed) {
    return (
      <div className="flex items-center gap-1.5">
        <button
          type="button"
          onClick={openLogin}
          className="inline-flex items-center gap-1 rounded-md px-2.5 py-1 text-[12.5px] font-medium text-slate-600 transition hover:bg-slate-100 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-slate-100"
        >
          <LogIn size={12} /> Masuk
        </button>
        {!compact && registrationEnabled && (
          <button
            type="button"
            onClick={openRegister}
            className="inline-flex items-center gap-1 rounded-md border border-slate-200 bg-white px-2.5 py-1 text-[12.5px] font-medium text-slate-700 transition hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
          >
            <UserPlus size={12} /> Daftar
          </button>
        )}
      </div>
    )
  }

  const initial = (user?.name?.[0] || user?.email?.[0] || '?').toUpperCase()
  const displayName = user?.name?.trim() || (user?.email || '').split('@')[0]

  return (
    <div ref={menuRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="inline-flex items-center gap-2 rounded-md border border-slate-200 bg-white px-2 py-1 text-[12.5px] font-medium text-slate-700 transition hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
      >
        <span className="grid h-5 w-5 place-items-center rounded-full bg-slate-950 text-[10px] font-bold text-white dark:bg-white dark:text-slate-950">
          {initial}
        </span>
        {!compact && <span className="max-w-[100px] truncate">{displayName}</span>}
      </button>

      {open && (
        <div className="absolute right-0 top-full z-50 mt-1 w-56 overflow-hidden rounded-lg border border-slate-200 bg-white shadow-xl dark:border-slate-800 dark:bg-slate-900">
          <div className="border-b border-slate-100 px-3 py-2.5 dark:border-slate-800">
            <p className="truncate text-[12.5px] font-semibold text-slate-900 dark:text-slate-100">{displayName}</p>
            <p className="mt-0.5 truncate text-[11px] text-slate-500 dark:text-slate-400">{user?.email}</p>
          </div>
          <a
            href="/dashboard"
            onClick={(e) => {
              e.preventDefault()
              setOpen(false)
              window.history.pushState({}, '', '/dashboard')
              window.dispatchEvent(new PopStateEvent('popstate'))
            }}
            className="flex w-full items-center gap-2 px-3 py-2 text-left text-[12.5px] text-slate-700 transition hover:bg-slate-50 dark:text-slate-300 dark:hover:bg-slate-800"
          >
            <LayoutDashboard size={12} /> Dashboard
          </a>
          {user?.role === 'admin' && (
            <a
              href="/admin"
              onClick={(e) => {
                e.preventDefault()
                setOpen(false)
                window.history.pushState({}, '', '/admin')
                window.dispatchEvent(new PopStateEvent('popstate'))
              }}
              className="flex w-full items-center gap-2 border-t border-slate-100 px-3 py-2 text-left text-[12.5px] font-medium text-rose-700 transition hover:bg-rose-50 dark:border-slate-800 dark:text-rose-400 dark:hover:bg-rose-950/40"
            >
              <Shield size={12} /> Admin dashboard
            </a>
          )}
          <button
            type="button"
            onClick={() => { setOpen(false); logout() }}
            className="flex w-full items-center gap-2 border-t border-slate-100 px-3 py-2 text-left text-[12.5px] text-slate-700 transition hover:bg-slate-50 dark:border-slate-800 dark:text-slate-300 dark:hover:bg-slate-800"
          >
            <LogOut size={12} /> Keluar
          </button>
        </div>
      )}
    </div>
  )
})
