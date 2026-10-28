// SQLite schema + seed data. Uses Node's built-in node:sqlite (no npm install needed).
import { DatabaseSync } from 'node:sqlite';
import { randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';
import { existsSync, mkdirSync, rmSync } from 'node:fs';
import { dirname } from 'node:path';

export function hashPassword(password) {
  const salt = randomBytes(16).toString('hex');
  const hash = scryptSync(password, salt, 64).toString('hex');
  return `${salt}:${hash}`;
}

export function verifyPassword(password, stored) {
  const [salt, hash] = stored.split(':');
  const candidate = scryptSync(password, salt, 64);
  const expected = Buffer.from(hash, 'hex');
  return candidate.length === expected.length && timingSafeEqual(candidate, expected);
}

const SCHEMA = `
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  name TEXT NOT NULL,
  company TEXT,
  city TEXT,
  role TEXT NOT NULL CHECK (role IN ('admin','distributor')),
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS products (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  sku TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  line TEXT NOT NULL,
  pack TEXT NOT NULL,
  unit_eggs INTEGER NOT NULL,
  trade_price_pkr INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','pipeline'))
);
CREATE TABLE IF NOT EXISTS orders (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  ref TEXT UNIQUE NOT NULL,
  user_id INTEGER NOT NULL REFERENCES users(id),
  delivery_city TEXT NOT NULL,
  delivery_date TEXT,
  notes TEXT,
  total_pkr INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'placed' CHECK (status IN ('placed','confirmed','dispatched','delivered','cancelled')),
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS order_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  order_id INTEGER NOT NULL REFERENCES orders(id),
  product_id INTEGER NOT NULL REFERENCES products(id),
  qty INTEGER NOT NULL,
  unit_price_pkr INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS inquiries (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  ref TEXT UNIQUE NOT NULL,
  company TEXT NOT NULL,
  contact_name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT,
  country TEXT NOT NULL,
  buyer_type TEXT,
  product TEXT NOT NULL,
  volume TEXT NOT NULL,
  frequency TEXT,
  incoterm TEXT,
  port TEXT,
  message TEXT,
  status TEXT NOT NULL DEFAULT 'new' CHECK (status IN ('new','contacted','quoted','sample_sent','won','lost')),
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS batches (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  code TEXT UNIQUE NOT NULL,
  farm TEXT NOT NULL,
  flock TEXT NOT NULL,
  line TEXT NOT NULL,
  grade TEXT NOT NULL,
  laid_on TEXT NOT NULL,
  packed_on TEXT NOT NULL,
  best_before TEXT NOT NULL,
  qc_status TEXT NOT NULL DEFAULT 'passed' CHECK (qc_status IN ('passed','hold','rejected')),
  qc_notes TEXT,
  destination TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS messages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  topic TEXT NOT NULL,
  message TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
`;

function seed(db) {
  const insUser = db.prepare(
    'INSERT INTO users (email, password_hash, name, company, city, role) VALUES (?, ?, ?, ?, ?, ?)'
  );
  // Demo accounts — documented in README.md. In production, known demo passwords are never used:
  // set SEED_ADMIN_PASSWORD, or a random one is generated and printed once to the server log.
  const prod = process.env.NODE_ENV === 'production';
  const adminPw = process.env.SEED_ADMIN_PASSWORD || (prod ? randomBytes(12).toString('base64url') : 'admin123');
  if (prod && !process.env.SEED_ADMIN_PASSWORD) console.log(`[seed] generated admin password: ${adminPw}`);
  insUser.run('admin@demo.test', hashPassword(adminPw), 'Operations Admin', 'Wahdat (demo)', 'Islamabad', 'admin');
  if (!prod) {
    insUser.run('distributor@demo.test', hashPassword('dist123'), 'Ali Traders', 'Ali Traders (demo)', 'Lahore', 'distributor');
    insUser.run('karachi@demo.test', hashPassword('dist123'), 'Sea View Mart', 'Sea View Mart (demo)', 'Karachi', 'distributor');
  }

  // Trade prices are placeholders for the demo, not real price lists.
  const insProduct = db.prepare(
    'INSERT INTO products (sku, name, line, pack, unit_eggs, trade_price_pkr, status) VALUES (?, ?, ?, ?, ?, ?, ?)'
  );
  [
    ['FFE-O3-06', 'Omega-3 Enriched', 'Omega-3', 'Carton of 6', 6, 420, 'active'],
    ['FFE-O3-12', 'Omega-3 Enriched', 'Omega-3', 'Carton of 12', 12, 820, 'active'],
    ['FFE-CL-12', 'Classic White', 'Classic', 'Carton of 12', 12, 560, 'active'],
    ['FFE-CL-30', 'Classic White', 'Classic', 'Tray of 30', 30, 1350, 'active'],
    ['FFE-GD-12', 'Golden (Vitamin Enriched)', 'Golden', 'Carton of 12', 12, 700, 'active'],
    ['FFE-BR-12', 'Brown', 'Brown', 'Carton of 12', 12, 640, 'active'],
    ['FFE-HC-360', 'Classic White — HoReCa', 'Classic', 'Case of 360 (12 trays)', 360, 15600, 'active'],
    ['FFE-LQ-01', 'Pasteurised Liquid Whole Egg', 'Liquid', '1 kg Tetra pack', 0, 950, 'pipeline'],
    ['FFE-LQ-10', 'Pasteurised Liquid Whole Egg', 'Liquid', '10 kg bag-in-box', 0, 8900, 'pipeline'],
  ].forEach((p) => insProduct.run(...p));

  const insBatch = db.prepare(
    `INSERT INTO batches (code, farm, flock, line, grade, laid_on, packed_on, best_before, qc_status, qc_notes, destination)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  );
  [
    ['WPF-2610-A1', 'Layer Farm 1', 'FL-114', 'Omega-3', 'Large (63–73 g)', '2026-10-24', '2026-10-25', '2026-11-22', 'passed', 'Salmonella swab negative; shell integrity 99.4%', 'Islamabad retail'],
    ['WPF-2610-B2', 'Layer Farm 2', 'FL-207', 'Classic', 'Medium (53–63 g)', '2026-10-25', '2026-10-26', '2026-11-23', 'passed', 'Candled and UV sanitised', 'Lahore retail'],
    ['WPF-2610-EX1', 'Layer Farm 3', 'FL-305', 'Classic', 'Large (63–73 g)', '2026-10-22', '2026-10-23', '2026-11-30', 'passed', 'Export lot — reefer 4–8 °C; pre-shipment inspection booked', 'Jebel Ali, UAE (export)'],
    ['WPF-2610-C4', 'Layer Farm 4', 'FL-402', 'Golden', 'Large (63–73 g)', '2026-10-26', '2026-10-27', '2026-11-24', 'hold', 'Awaiting yolk-colour lab result', null],
  ].forEach((b) => insBatch.run(...b));

  const insInq = db.prepare(
    `INSERT INTO inquiries (ref, company, contact_name, email, phone, country, buyer_type, product, volume, frequency, incoterm, port, message, status)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  );
  insInq.run('RFQ-1001', 'Gulf Fresh Trading (demo)', 'Omar K.', 'buyer@example.com', '+971 50 000 0000', 'United Arab Emirates', 'Importer / Distributor',
    'Table eggs — Classic White', '2 × 40ft reefers', 'Monthly', 'CFR', 'Jebel Ali', 'Need Halal + health certificate. Sample shipment first.', 'quoted');
  insInq.run('RFQ-1002', 'Doha Catering Co (demo)', 'Fatima R.', 'procurement@example.com', null, 'Qatar', 'HoReCa / Catering',
    'Pasteurised liquid egg', '5 tonnes', 'Monthly', 'CIF', 'Hamad Port', 'Interested once plant is commissioned.', 'new');

  const insOrder = db.prepare(
    'INSERT INTO orders (ref, user_id, delivery_city, delivery_date, notes, total_pkr, status) VALUES (?, ?, ?, ?, ?, ?, ?)'
  );
  const insItem = db.prepare('INSERT INTO order_items (order_id, product_id, qty, unit_price_pkr) VALUES (?, ?, ?, ?)');
  if (prod) return;
  const o = insOrder.run('ORD-50001', 2, 'Lahore', '2026-10-29', 'Morning delivery please', 20*820 + 40*1350, 'confirmed');
  insItem.run(o.lastInsertRowid, 2, 20, 820);
  insItem.run(o.lastInsertRowid, 4, 40, 1350);
}

export function openDb(path, { reset = false } = {}) {
  if (reset && existsSync(path)) rmSync(path);
  mkdirSync(dirname(path), { recursive: true });
  const fresh = !existsSync(path);
  const db = new DatabaseSync(path);
  db.exec('PRAGMA foreign_keys = ON;');
  db.exec(SCHEMA);
  if (fresh) seed(db);
  return db;
}
