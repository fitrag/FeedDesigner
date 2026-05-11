# FeedDesigner AI

Tool React + Tailwind CSS v4 untuk membuat desain feed Instagram dengan AI image model OpenAI-compatible.

## Menjalankan

```bash
npm install
npm run dev
```

Buka URL Vite yang muncul, biasanya `http://localhost:5173`.

## Konfigurasi API

Buat file `.env` dari `.env.example`:

```bash
cp .env.example .env
```

Isi:

```env
OPENAI_BASE_URL=https://r5d6xug.9router.com/v1
OPENAI_API_KEY=isi_api_key_anda
OPENAI_IMAGE_MODEL=cx/gpt-5.4
PORT=8787
```

> Catatan keamanan: jangan commit API key asli ke GitHub. Server Express dipakai supaya API key tidak terekspos di browser.

## Fitur

- UI modern glassmorphism dengan React.
- Tailwind CSS v4 via `@tailwindcss/vite`.
- Form brief brand/topik/audiens/style/warna/format.
- Generate gambar via endpoint `/images/generations` OpenAI-compatible.
- Preview dan download hasil desain.
