import sharp from 'sharp'

const svg = `<svg width="512" height="512" xmlns="http://www.w3.org/2000/svg">
  <rect width="512" height="512" rx="96" fill="#0f172a"/>
  <text x="256" y="290" text-anchor="middle" font-family="system-ui,-apple-system,sans-serif" font-size="180" font-weight="900" letter-spacing="-12" fill="white">FD</text>
  <circle cx="410" cy="120" r="36" fill="#34d399"/>
</svg>`

const buf = Buffer.from(svg)

await sharp(buf).resize(512, 512).png().toFile('public/icon-512.png')
await sharp(buf).resize(192, 192).png().toFile('public/icon-192.png')
await sharp(buf).resize(180, 180).png().toFile('public/apple-touch-icon.png')
console.log('Icons generated: icon-512.png, icon-192.png, apple-touch-icon.png')
