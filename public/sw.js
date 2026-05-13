/**
 * FeedDesigner Service Worker — minimal caching strategy.
 *
 * Strategy:
 * - App shell (HTML, CSS, JS) → Cache-first with network fallback.
 * - API calls → Network-first (never serve stale data for dynamic content).
 * - Images → Cache-first with long TTL (they're immutable, hashed filenames).
 *
 * This SW enables the "Add to Home Screen" / install prompt and provides
 * basic offline resilience for the app shell.
 */

const CACHE_NAME = 'fd-v1'
const SHELL_ASSETS = [
  '/',
  '/manifest.json',
]

// Install: pre-cache the app shell.
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(SHELL_ASSETS))
  )
  self.skipWaiting()
})

// Activate: clean up old caches.
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  )
  self.clients.claim()
})

// Fetch: route requests to the appropriate strategy.
self.addEventListener('fetch', (event) => {
  const { request } = event
  const url = new URL(request.url)

  // Skip non-GET requests.
  if (request.method !== 'GET') return

  // API calls: network-first, no caching.
  if (url.pathname.startsWith('/api/')) return

  // Images: cache-first (immutable filenames).
  if (url.pathname.startsWith('/api/images/') || /\.(webp|png|jpg|jpeg|svg|gif)$/i.test(url.pathname)) {
    event.respondWith(
      caches.match(request).then((cached) => {
        if (cached) return cached
        return fetch(request).then((response) => {
          if (response.ok) {
            const clone = response.clone()
            caches.open(CACHE_NAME).then((cache) => cache.put(request, clone))
          }
          return response
        }).catch(() => cached || new Response('', { status: 503 }))
      })
    )
    return
  }

  // App shell (HTML, CSS, JS): cache-first with network update.
  event.respondWith(
    caches.match(request).then((cached) => {
      const fetchPromise = fetch(request).then((response) => {
        if (response.ok) {
          const clone = response.clone()
          caches.open(CACHE_NAME).then((cache) => cache.put(request, clone))
        }
        return response
      }).catch(() => cached)

      return cached || fetchPromise
    })
  )
})
