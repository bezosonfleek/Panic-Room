import express from 'express';
import pg from 'pg';
import argon2 from 'argon2';
import crypto from 'node:crypto';
import fs from 'node:fs';
import rateLimit from 'express-rate-limit';

const ORIGIN = process.env.ORIGIN || 'https://localhost', COOKIE = '__Host-pr_session', DAYS = 30, MAX_SESSIONS = 5;
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL, max: 10 });
const A2 = { type: argon2.argon2id, memoryCost: 19456, timeCost: 2, parallelism: 1 }; // OWASP minimum for argon2id
const DUMMY = await argon2.hash('dummy-password-for-timing', A2);

async function migrate() {
  await pool.query('CREATE TABLE IF NOT EXISTS schema_migrations(name text PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now())');
  for (const f of fs.readdirSync('migrations').filter(f => f.endsWith('.sql')).sort()) {
    if ((await pool.query('SELECT 1 FROM schema_migrations WHERE name=$1', [f])).rowCount) continue;
    const c = await pool.connect();
    try {
      await c.query('BEGIN');
      await c.query(fs.readFileSync('migrations/' + f, 'utf8'));
      await c.query('INSERT INTO schema_migrations(name) VALUES($1)', [f]);
      await c.query('COMMIT');
      console.log('migrated', f);
    } catch (e) { await c.query('ROLLBACK'); throw e; } finally { c.release(); }
  }
}
await migrate();

const sha = t => crypto.createHash('sha256').update(t).digest();
const cookies = h => Object.fromEntries((h || '').split(';').map(s => s.trim().split(/=(.*)/s).slice(0, 2)).filter(p => p[0] && p[1] !== undefined));
const setCookie = (res, v, age) => res.setHeader('Set-Cookie', `${COOKIE}=${v}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${age}`);
async function newSession(res, uid) {
  const token = crypto.randomBytes(32).toString('base64url');
  await pool.query("INSERT INTO sessions(token_hash,user_id,expires_at) VALUES($1,$2,now()+make_interval(days=>$3))", [sha(token), uid, DAYS]);
  await pool.query('DELETE FROM sessions WHERE user_id=$1 AND token_hash NOT IN (SELECT token_hash FROM sessions WHERE user_id=$1 ORDER BY created_at DESC LIMIT $2)', [uid, MAX_SESSIONS]);
  setCookie(res, token, DAYS * 86400);
}
const wrap = f => (req, res, next) => f(req, res, next).catch(next);
const lim = (windowMs, max, keyGenerator, skipSuccessfulRequests = false) =>
  rateLimit({ windowMs, max, keyGenerator, skipSuccessfulRequests, standardHeaders: true, legacyHeaders: false, message: { error: 'Too many attempts. Try again later.' } });
const byEmail = req => String(req.body?.email || '').toLowerCase().slice(0, 254);

const app = express();
app.disable('x-powered-by');
app.set('trust proxy', 1); // Caddy is the only proxy
app.use(express.json({ limit: '4kb' }));
app.use('/api', (req, res, next) => {
  if (req.method !== 'GET' && req.method !== 'HEAD') { // CSRF: strict Origin + JSON-only on top of SameSite=Lax
    if (req.get('origin') !== ORIGIN) return res.status(403).json({ error: 'Forbidden' });
    if (!req.is('application/json')) return res.status(415).json({ error: 'JSON only' });
  }
  res.set('Cache-Control', 'no-store');
  next();
});
app.use('/api', wrap(async (req, res, next) => {
  const t = cookies(req.headers.cookie)[COOKIE];
  if (t) req.user = (await pool.query('SELECT u.id,u.username FROM sessions s JOIN users u ON u.id=s.user_id WHERE s.token_hash=$1 AND s.expires_at>now()', [sha(t)])).rows[0];
  next();
}));

const EMAIL = /^[^\s@]{1,64}@[^\s@]{1,255}\.[^\s@]{2,}$/, USER = /^[a-z0-9_]{3,20}$/i;
app.post('/api/signup', lim(3600e3, 10), wrap(async (req, res) => {
  const { email, username, password } = req.body || {}, bad = m => res.status(400).json({ error: m });
  if ([email, username, password].some(v => typeof v !== 'string')) return bad('Fill in every field.');
  if (email.length > 254 || !EMAIL.test(email.trim())) return bad('Enter a valid email.');
  if (!USER.test(username)) return bad('Username: 3 to 20 letters, numbers or underscores.');
  if (password.length < 10 || password.length > 128) return bad('Password must be 10 to 128 characters.');
  const hash = await argon2.hash(password, A2);
  let u;
  try { u = (await pool.query('INSERT INTO users(email,username,pw_hash) VALUES($1,$2,$3) RETURNING id,username', [email.trim(), username, hash])).rows[0]; }
  catch (e) { if (e.code === '23505') return res.status(409).json({ error: 'That email or username is already taken.' }); throw e; }
  await newSession(res, u.id);
  res.status(201).json({ username: u.username });
}));

app.post('/api/login', lim(15 * 60e3, 30), lim(15 * 60e3, 8, byEmail, true), wrap(async (req, res) => {
  const { email, password } = req.body || {};
  if (typeof email !== 'string' || typeof password !== 'string' || password.length > 128) return res.status(400).json({ error: 'Enter your email and password.' });
  const row = (await pool.query('SELECT id,username,pw_hash FROM users WHERE email=$1', [email.trim()])).rows[0];
  const ok = await argon2.verify(row ? row.pw_hash : DUMMY, password).catch(() => false); // same work whether or not the user exists
  if (!row || !ok) return res.status(401).json({ error: 'Wrong email or password.' });
  await newSession(res, row.id);
  res.json({ username: row.username });
}));

app.post('/api/logout', wrap(async (req, res) => {
  const t = cookies(req.headers.cookie)[COOKIE];
  if (t) await pool.query('DELETE FROM sessions WHERE token_hash=$1', [sha(t)]);
  setCookie(res, '', 0);
  res.json({ ok: true });
}));

app.get('/api/me', (req, res) => res.json({ user: req.user ? { username: req.user.username } : null }));
app.get('/api/health', wrap(async (req, res) => { await pool.query('SELECT 1'); res.json({ ok: true }); }));

app.use((e, req, res, next) => {
  if (e.type === 'entity.parse.failed' || e.status === 400 || e.type === 'entity.too.large') return res.status(400).json({ error: 'Bad request' });
  console.error(e);
  res.status(500).json({ error: 'Something went wrong.' });
});
setInterval(() => pool.query('DELETE FROM sessions WHERE expires_at<now()').catch(() => {}), 3600e3);
app.listen(3000, () => console.log('api up'));
