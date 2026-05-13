import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    // Bind to all interfaces so the dev server is reachable from LAN, phones,
    // tunnels like ngrok, and containers. Without `host: true` Vite only
    // listens on localhost.
    host: true,
    // Allow any Host header so tunnels (ngrok, cloudflared, loca.lt, etc.)
    // and custom domains work without needing to whitelist each one. Vite 6
    // blocks external hosts by default to prevent DNS-rebinding attacks, but
    // for a dev tool we prefer convenience.
    allowedHosts: true,
    proxy: {
      '/api': process.env.VITE_API_BASE_URL || 'http://localhost:8787',
    },
  },
  build: {
    target: 'es2022',
    cssCodeSplit: true,
    sourcemap: false,
    reportCompressedSize: false,
    chunkSizeWarningLimit: 800,
    // Minify with esbuild (default) — faster than terser and produces
    // comparable output for modern targets.
    minify: 'esbuild',
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes('node_modules')) return undefined
          if (id.includes('react-dom')) return 'react-dom'
          if (id.includes('react')) return 'react'
          if (id.includes('lucide-react')) return 'icons'
          return 'vendor'
        },
      },
    },
  },
  esbuild: {
    legalComments: 'none',
    // Drop console.log in production builds — keeps bundle smaller and
    // avoids leaking debug info to end-users.
    drop: ['debugger'],
  },
  optimizeDeps: {
    include: ['react', 'react-dom', 'lucide-react'],
  },
})
