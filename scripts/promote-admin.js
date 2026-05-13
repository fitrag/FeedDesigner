#!/usr/bin/env node
// One-shot script to promote a user to admin by email.
//
//   node scripts/promote-admin.js user@example.com
//
// Lowercases the email before matching since that's how the register endpoint
// stores it. Prints the full row after update so you can confirm the change.

import Database from 'better-sqlite3'

const email = (process.argv[2] || '').trim().toLowerCase()
if (!email) {
  console.error('Usage: node scripts/promote-admin.js <email>')
  process.exit(1)
}

const db = new Database('data/feeddesigner.db')
const user = db.prepare('SELECT id, email, role FROM users WHERE lower(email) = ?').get(email)

if (!user) {
  console.error(`User "${email}" tidak ditemukan. Pastikan akun sudah terdaftar.`)
  process.exit(2)
}

db.prepare("UPDATE users SET role = 'admin' WHERE id = ?").run(user.id)
const after = db.prepare('SELECT id, email, name, role FROM users WHERE id = ?').get(user.id)
console.log('Promoted:', after)
