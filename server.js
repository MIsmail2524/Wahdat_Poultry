// Wahdat Poultry platform — zero-dependency Node server (static site + JSON API + SQLite).
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { join, extname, normalize, sep } from 'node:path';
import { randomBytes } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { openDb, verifyPassword, hashPassword } from './db.js';

const ROOT = fileURLToPath(new URL('.', import.meta.url));
const PUBLIC = join(ROOT, 'public');
const PORT = Number(process.env.PORT) || 3000;
const PROD = process.env.NODE_ENV === 'production';
const db = openDb(process.env.DB_PATH || join(ROOT, 'data', 'wahdat.db'), { reset: process.argv.includes('--reset-db') });
const COOKIE = PROD ? '__Host-sid' : 'sid'; // __Host- prefix forces Secure + Path=/ + no Domain

// Security headers applied to every response.
const SECURITY_HEADERS = {
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=(), payment=()',
  'Cross-Origin-Opener-Policy': 'same-origin',
  'Content-Security-Policy': [
    "default-src 'self'",
    "script-src 'self' https://cdnjs.cloudflare.com",
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "font-src 'self' https://fonts.gstatic.com",
    "img-src 'self' data:",
    "connect-src 'self'",
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "object-src 'none'",
  ].join('; '),
  ...(PROD ? { 'Strict-Transport-Security': 'max-age=31536000; includeSubDomains' } : {}),
};

const MIME = {
  '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg',
  '.webp': 'image/webp', '.ico': 'image/x-icon', '.woff2': 'font/woff2', '.txt': 'text/plain; charset=utf-8', '.xml': 'application/xml; charset=utf-8',
};

// ---------- sessions (in-memory; fine for a single-instance prototype) ----------
const sessions = new Map(); // sid -> { userId, expires }
const SESSION_MS = 1000 * 60 * 60 * 8;

function getCookie(req, name) {
  const raw = req.headers.cookie || '';
  for (const part of raw.split(';')) {
    const [k, ...v] = part.trim().split('=');
    if (k === name) {
      const val = v.join('=');
      return /^[a-f0-9]{48}$/.test(val) ? val : null; // session ids are 24 random bytes hex; reject anything else
    }
  }
  return null;
}

function currentUser(req) {
  const sid = getCookie(req, COOKIE);
  const s = sid && sessions.get(sid);
  if (!s || s.expires < Date.now()) { if (sid) sessions.delete(sid); return null; }
  return db.prepare('SELECT id, email, name, company, city, role FROM users WHERE id = ?').get(s.userId) || null;
}

// ---------- helpers ----------
function send(res, status, body, headers = {}) {
  const isObj = typeof body === 'object' && !Buffer.isBuffer(body);
  res.writeHead(status, {
    'Content-Type': isObj ? 'application/json; charset=utf-8' : 'text/plain; charset=utf-8',
    ...SECURITY_HEADERS,
    ...(isObj ? { 'Cache-Control': 'no-store' } : {}),
    ...headers,
  });
  res.end(isObj ? JSON.stringify(body) : body);
}

async function readJson(req, limit = 64 * 1024) {
  // Only accept real JSON requests: blocks HTML-form CSRF (text/plain, urlencoded, multipart).
  if (!/^application\/json\b/i.test(req.headers['content-type'] || ''))
    throw Object.assign(new Error('Content-Type must be application/json'), { status: 415 });
  let size = 0; const chunks = [];
  for await (const c of req) {
    size += c.length;
    if (size > limit) throw Object.assign(new Error('Payload too large'), { status: 413 });
    chunks.push(c);
  }
  if (!chunks.length) return {};
  try { return JSON.parse(Buffer.concat(chunks).toString('utf8')); }
  catch { throw Object.assign(new Error('Invalid JSON'), { status: 400 }); }
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
function str(v, max = 500) { return typeof v === 'string' ? v.trim().slice(0, max) : ''; }
function required(obj, fields) {
  const missing = fields.filter((f) => !str(obj[f]));
  if (missing.length) throw Object.assign(new Error(`Missing: ${missing.join(', ')}`), { status: 422 });
}
function makeRef(prefix) {
  return `${prefix}-${Date.now().toString(36).slice(-5).toUpperCase()}${randomBytes(1).toString('hex').toUpperCase()}`;
}

// per-IP + per-bucket rate limit
const hits = new Map();
function rateLimited(req, max = 20, windowMs = 10 * 60 * 1000, bucket = 'public') {
  const key = `${bucket}:${req.socket.remoteAddress || 'x'}`;
  const now = Date.now();
  const list = (hits.get(key) || []).filter((t) => now - t < windowMs);
  list.push(now); hits.set(key, list);
  return list.length > max;
}

// per-account lockout after repeated failed logins
const failures = new Map(); // email -> { n, until }
const MAX_FAILS = 5, LOCK_MS = 15 * 60 * 1000;
const DUMMY_HASH = hashPassword(randomBytes(12).toString('hex')); // equalises timing for unknown emails

// periodic cleanup so maps cannot grow without bound
setInterval(() => {
  const now = Date.now();
  for (const [k, s] of sessions) if (s.expires < now) sessions.delete(k);
  for (const [k, l] of hits) if (!l.length || now - l[l.length - 1] > 60 * 60 * 1000) hits.delete(k);
  for (const [k, f] of failures) if (f.until && f.until < now) failures.delete(k);
}, 10 * 60 * 1000).unref();

function sameOrigin(req) {
  const origin = req.headers.origin;
  if (!origin) return true; // non-browser clients / same-origin GET navigations
  try { return new URL(origin).host === req.headers.host; } catch { return false; }
}

function requireRole(req, role) {
  const u = currentUser(req);
  if (!u) throw Object.assign(new Error('Sign in required'), { status: 401 });
  if (role && u.role !== role) throw Object.assign(new Error('Forbidden'), { status: 403 });
  return u;
}

// ---------- API routes ----------
const routes = [];
const SENT = Symbol('sent'); // handler already wrote the response
const route = (method, pattern, handler) => routes.push({ method, re: new RegExp(`^${pattern}$`), handler });

route('GET', '/api/products', () => db.prepare('SELECT * FROM products ORDER BY status, line, unit_eggs').all());

route('GET', '/api/stats', () => ({
  // Public, sourced company figures (prospectus / press, Mar–May 2026)
  birds: 430000, eggsPerDay: 400000, farms: 4, outlets: 1500, founded: 2006,
  revenueFY25_PKR_bn: 2.79, ipoRaised_PKR_m: 956,
}));

route('GET', '/api/trace/([A-Za-z0-9-]{3,32})', (req, [code]) => {
  const b = db.prepare(`SELECT code, farm, flock, line, grade, laid_on, packed_on, best_before, qc_status, qc_notes, destination
                        FROM batches WHERE code = ? COLLATE NOCASE`).get(code);
  if (!b) throw Object.assign(new Error('Batch code not found'), { status: 404 });
  return b;
});

route('POST', '/api/inquiries', async (req) => {
  if (rateLimited(req)) throw Object.assign(new Error('Too many requests'), { status: 429 });
  const b = await readJson(req);
  if (str(b.website)) return { ok: true }; // honeypot
  required(b, ['company', 'contact_name', 'email', 'country', 'product', 'volume']);
  if (!EMAIL_RE.test(str(b.email))) throw Object.assign(new Error('Invalid email'), { status: 422 });
  const ref = makeRef('RFQ');
  db.prepare(`INSERT INTO inquiries (ref, company, contact_name, email, phone, country, buyer_type, product, volume, frequency, incoterm, port, message)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
    .run(ref, str(b.company, 120), str(b.contact_name, 120), str(b.email, 160), str(b.phone, 40) || null, str(b.country, 80),
      str(b.buyer_type, 60) || null, str(b.product, 120), str(b.volume, 80), str(b.frequency, 40) || null,
      str(b.incoterm, 10) || null, str(b.port, 80) || null, str(b.message, 2000) || null);
  return { ok: true, ref };
});

route('POST', '/api/contact', async (req) => {
  if (rateLimited(req)) throw Object.assign(new Error('Too many requests'), { status: 429 });
  const b = await readJson(req);
  if (str(b.website)) return { ok: true };
  required(b, ['name', 'email', 'topic', 'message']);
  if (!EMAIL_RE.test(str(b.email))) throw Object.assign(new Error('Invalid email'), { status: 422 });
  db.prepare('INSERT INTO messages (name, email, topic, message) VALUES (?, ?, ?, ?)')
    .run(str(b.name, 120), str(b.email, 160), str(b.topic, 60), str(b.message, 3000));
  return { ok: true };
});

// --- auth ---
route('POST', '/api/login', async (req, _m, res) => {
  if (rateLimited(req, 30, 10 * 60 * 1000, 'login')) throw Object.assign(new Error('Too many attempts'), { status: 429 });
  const b = await readJson(req);
  const email = str(b.email, 160).toLowerCase();
  const f = failures.get(email);
  if (f?.until > Date.now()) throw Object.assign(new Error('Account temporarily locked. Try again later.'), { status: 429 });
  const row = db.prepare('SELECT * FROM users WHERE email = ? COLLATE NOCASE').get(email);
  const ok = verifyPassword(str(b.password, 200), row ? row.password_hash : DUMMY_HASH) && !!row;
  if (!ok) {
    const n = (f?.n || 0) + 1;
    failures.set(email, { n, until: n >= MAX_FAILS ? Date.now() + LOCK_MS : 0 });
    throw Object.assign(new Error('Wrong email or password'), { status: 401 });
  }
  failures.delete(email);
  const old = getCookie(req, COOKIE); if (old) sessions.delete(old); // no session fixation
  const sid = randomBytes(24).toString('hex');
  sessions.set(sid, { userId: row.id, expires: Date.now() + SESSION_MS });
  res.setHeader('Set-Cookie', `${COOKIE}=${sid}; HttpOnly; SameSite=Strict; Path=/; Max-Age=${SESSION_MS / 1000}${PROD ? '; Secure' : ''}`);
  return { ok: true, role: row.role, name: row.name };
});

route('POST', '/api/logout', (req, _m, res) => {
  const sid = getCookie(req, COOKIE); if (sid) sessions.delete(sid);
  res.setHeader('Set-Cookie', `${COOKIE}=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0${PROD ? '; Secure' : ''}`);
  return { ok: true };
});

route('GET', '/api/me', (req) => currentUser(req) || { anonymous: true });

// --- distributor portal ---
route('GET', '/api/orders/mine', (req) => {
  const u = requireRole(req, 'distributor');
  const orders = db.prepare('SELECT * FROM orders WHERE user_id = ? ORDER BY id DESC').all(u.id);
  const items = db.prepare(`SELECT oi.*, p.name, p.pack FROM order_items oi JOIN products p ON p.id = oi.product_id WHERE oi.order_id = ?`);
  return orders.map((o) => ({ ...o, items: items.all(o.id) }));
});

route('POST', '/api/orders', async (req) => {
  const u = requireRole(req, 'distributor');
  const b = await readJson(req);
  const lines = Array.isArray(b.items) ? b.items : [];
  if (!lines.length) throw Object.assign(new Error('Cart is empty'), { status: 422 });
  if (!str(b.delivery_city)) throw Object.assign(new Error('Delivery city required'), { status: 422 });
  const getP = db.prepare("SELECT * FROM products WHERE id = ? AND status = 'active'");
  const priced = lines.map((l) => {
    const p = getP.get(Number(l.product_id));
    const qty = Math.floor(Number(l.qty));
    if (!p || !(qty > 0 && qty <= 10000)) throw Object.assign(new Error('Invalid line item'), { status: 422 });
    return { p, qty };
  });
  const total = priced.reduce((s, { p, qty }) => s + p.trade_price_pkr * qty, 0);
  const ref = makeRef('ORD');
  db.exec('BEGIN');
  try {
    const o = db.prepare('INSERT INTO orders (ref, user_id, delivery_city, delivery_date, notes, total_pkr) VALUES (?, ?, ?, ?, ?, ?)')
      .run(ref, u.id, str(b.delivery_city, 60), str(b.delivery_date, 10) || null, str(b.notes, 500) || null, total);
    const ins = db.prepare('INSERT INTO order_items (order_id, product_id, qty, unit_price_pkr) VALUES (?, ?, ?, ?)');
    for (const { p, qty } of priced) ins.run(o.lastInsertRowid, p.id, qty, p.trade_price_pkr);
    db.exec('COMMIT');
  } catch (e) { db.exec('ROLLBACK'); throw e; }
  return { ok: true, ref, total_pkr: total };
});

// --- admin ---
route('GET', '/api/admin/stats', (req) => {
  requireRole(req, 'admin');
  const one = (sql) => db.prepare(sql).get();
  return {
    inquiriesOpen: one("SELECT COUNT(*) n FROM inquiries WHERE status NOT IN ('won','lost')").n,
    inquiriesTotal: one('SELECT COUNT(*) n FROM inquiries').n,
    ordersPending: one("SELECT COUNT(*) n FROM orders WHERE status IN ('placed','confirmed')").n,
    revenuePipelinePKR: one("SELECT COALESCE(SUM(total_pkr),0) s FROM orders WHERE status != 'cancelled'").s,
    batchesOnHold: one("SELECT COUNT(*) n FROM batches WHERE qc_status = 'hold'").n,
    messages: one('SELECT COUNT(*) n FROM messages').n,
    byCountry: db.prepare('SELECT country, COUNT(*) n FROM inquiries GROUP BY country ORDER BY n DESC').all(),
    ordersByCity: db.prepare("SELECT delivery_city city, SUM(total_pkr) total FROM orders WHERE status != 'cancelled' GROUP BY delivery_city ORDER BY total DESC").all(),
  };
});

route('GET', '/api/admin/inquiries', (req) => { requireRole(req, 'admin'); return db.prepare('SELECT * FROM inquiries ORDER BY id DESC').all(); });
route('GET', '/api/admin/messages', (req) => { requireRole(req, 'admin'); return db.prepare('SELECT * FROM messages ORDER BY id DESC').all(); });
route('GET', '/api/admin/orders', (req) => {
  requireRole(req, 'admin');
  return db.prepare(`SELECT o.*, u.company, u.name AS customer FROM orders o JOIN users u ON u.id = o.user_id ORDER BY o.id DESC`).all();
});
route('GET', '/api/admin/batches', (req) => { requireRole(req, 'admin'); return db.prepare('SELECT * FROM batches ORDER BY id DESC').all(); });

// CSV export for RFQs / orders. Cells are quoted and formula-prefixed values neutralised (CSV injection).
function toCsv(rows) {
  if (!rows.length) return '';
  const cols = Object.keys(rows[0]);
  const cell = (v) => {
    let t = v == null ? '' : String(v);
    if (/^[=+\-@\t\r]/.test(t)) t = `'${t}`;
    return `"${t.replace(/"/g, '""')}"`;
  };
  return [cols.join(','), ...rows.map((r) => cols.map((c) => cell(r[c])).join(','))].join('\r\n');
}
route('GET', '/api/admin/export/(inquiries|orders)\\.csv', (req, [table], res) => {
  requireRole(req, 'admin');
  const rows = table === 'orders'
    ? db.prepare('SELECT o.ref, u.company, o.delivery_city, o.delivery_date, o.total_pkr, o.status, o.notes, o.created_at FROM orders o JOIN users u ON u.id = o.user_id ORDER BY o.id DESC').all()
    : db.prepare('SELECT ref, company, contact_name, email, phone, country, buyer_type, product, volume, frequency, incoterm, port, message, status, created_at FROM inquiries ORDER BY id DESC').all();
  res.writeHead(200, { ...SECURITY_HEADERS, 'Content-Type': 'text/csv; charset=utf-8', 'Cache-Control': 'no-store',
    'Content-Disposition': `attachment; filename="wahdat-${table}-${new Date().toISOString().slice(0, 10)}.csv"` });
  res.end('\uFEFF' + toCsv(rows));
  return SENT;
});

const STATUS = {
  inquiries: ['new', 'contacted', 'quoted', 'sample_sent', 'won', 'lost'],
  orders: ['placed', 'confirmed', 'dispatched', 'delivered', 'cancelled'],
  batches: ['passed', 'hold', 'rejected'],
};
route('PATCH', '/api/admin/(inquiries|orders|batches)/(\\d+)', async (req, [table, id]) => {
  requireRole(req, 'admin');
  const b = await readJson(req);
  const col = table === 'batches' ? 'qc_status' : 'status';
  if (!STATUS[table].includes(b.status)) throw Object.assign(new Error('Invalid status'), { status: 422 });
  const r = db.prepare(`UPDATE ${table} SET ${col} = ? WHERE id = ?`).run(b.status, Number(id));
  if (!r.changes) throw Object.assign(new Error('Not found'), { status: 404 });
  return { ok: true };
});

route('POST', '/api/admin/batches', async (req) => {
  requireRole(req, 'admin');
  const b = await readJson(req);
  required(b, ['farm', 'flock', 'line', 'grade', 'laid_on', 'packed_on', 'best_before']);
  const d = new Date(str(b.packed_on));
  const yymm = isNaN(d) ? '0000' : `${String(d.getFullYear()).slice(2)}${String(d.getMonth() + 1).padStart(2, '0')}`;
  const code = `WPF-${yymm}-${randomBytes(2).toString('hex').toUpperCase()}`;
  db.prepare(`INSERT INTO batches (code, farm, flock, line, grade, laid_on, packed_on, best_before, qc_status, qc_notes, destination)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
    .run(code, str(b.farm, 60), str(b.flock, 30), str(b.line, 30), str(b.grade, 40), str(b.laid_on, 10), str(b.packed_on, 10),
      str(b.best_before, 10), STATUS.batches.includes(b.qc_status) ? b.qc_status : 'passed', str(b.qc_notes, 300) || null,
      str(b.destination, 80) || null);
  return { ok: true, code };
});

// ---------- static files ----------
async function serveStatic(req, res, pathname) {
  let rel;
  try { rel = decodeURIComponent(pathname); } catch { return send(res, 400, 'Bad request'); }
  if (rel.includes('\0')) return send(res, 400, 'Bad request');
  if (rel.endsWith('/')) rel += 'index.html';
  let file = normalize(join(PUBLIC, rel));
  if (file !== PUBLIC && !file.startsWith(PUBLIC + sep)) return send(res, 403, 'Forbidden');
  try {
    let s = await stat(file).catch(() => null);
    if (!s && !extname(file)) { file += '.html'; s = await stat(file).catch(() => null); }
    if (!s || !s.isFile()) {
      const nf = await readFile(join(PUBLIC, '404.html'));
      return send(res, 404, nf, { 'Content-Type': MIME['.html'] });
    }
    const body = await readFile(file);
    const ext = extname(file);
    send(res, 200, body, {
      'Content-Type': MIME[ext] || 'application/octet-stream',
      'Cache-Control': process.env.NODE_ENV === 'production' && ext !== '.html' ? 'public, max-age=3600' : 'no-cache',
    });
  } catch { send(res, 500, 'Server error'); }
}

async function handle(req, res) {
  let url;
  try { url = new URL(req.url, 'http://localhost'); } catch { return send(res, 400, 'Bad request'); }
  if (url.pathname.startsWith('/api/')) {
    const r = routes.find((x) => x.method === req.method && x.re.test(url.pathname));
    if (!r) return send(res, 404, { error: 'Not found' });
    if (req.method !== 'GET' && !sameOrigin(req)) return send(res, 403, { error: 'Cross-origin request blocked' });
    try {
      const m = url.pathname.match(r.re).slice(1);
      const out = await r.handler(req, m, res);
      if (out === SENT) return;
      return send(res, 200, out);
    } catch (e) {
      if (!e.status) console.error(e);
      return send(res, e.status || 500, { error: e.status ? e.message : 'Server error' });
    }
  }
  if (req.method !== 'GET' && req.method !== 'HEAD') return send(res, 405, 'Method not allowed');
  return serveStatic(req, res, url.pathname);
}

const server = createServer((req, res) => {
  // Last-resort guard: a single bad request must never take the process down.
  handle(req, res).catch((e) => {
    console.error(e);
    if (!res.headersSent) send(res, 500, { error: 'Server error' }); else res.destroy();
  });
});
server.headersTimeout = 20_000;
server.requestTimeout = 30_000;
server.listen(PORT, () => console.log(`Wahdat platform running → http://localhost:${PORT}`));
