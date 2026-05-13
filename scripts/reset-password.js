import crypto from 'node:crypto'
import Database from 'better-sqlite3'

const email = 'fadilafitrakusumajaya@gmail.com'
const newPassword = 'admin123'

const SCRYPT_OPTS = { N: 16384, r: 8, p: 1, maxmem: 64 * 1024 * 1024 }

const salt = crypto.randomBytes(16)
crypto.scrypt(newPassword, salt, 64, SCRYPT_OPTS, (err, derived) => {
  if (err) { console.error(err); process.exit(1) }
  const hash = `scrypt$${salt.toString('hex')}$${derived.toString('hex')}`
  const db = new Database('data/feeddesigner.db')
  const result = db.prepare('UPDATE users SET password = ? WHERE email = ?').run(hash, email)
  console.log(`Updated ${result.changes} row(s) for ${email}`)
  db.close()
})
