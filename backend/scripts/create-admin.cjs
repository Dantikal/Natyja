// Run from backend after importing database/schema.sql. No account is created automatically.
require('dotenv').config();
const pool = require('../src/config/db');
const bcrypt = require('bcrypt');
async function main() {
  const email = process.env.ADMIN_EMAIL;
  const password = process.env.ADMIN_PASSWORD;
  const fullName = process.env.ADMIN_NAME || 'Administrator';
  if (typeof email !== 'string' || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || typeof password !== 'string' || password.length < 12 || Buffer.byteLength(password) > 72) {
    throw new Error('Set ADMIN_EMAIL and ADMIN_PASSWORD (12+ characters, max 72 UTF-8 bytes).');
  }
  const hash = await bcrypt.hash(password, 12);
  await pool.execute("INSERT INTO users (email,password_hash,full_name,role,approved) VALUES (?,?,?,'admin',1)", [email.trim().toLowerCase(), hash, fullName]);
  console.log('Administrator created. Existing accounts are never modified.');
}
main().catch(error => { console.error(error.code === '23505' ? 'Account already exists; no changes made.' : error.code || error.message); process.exitCode = 1; }).finally(() => pool.end());
