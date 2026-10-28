# Wahdat Poultry — Corporate, Export & Trade Platform

A concept redesign and working prototype for **Wahdat Poultry Farm Limited** (PSX: WAHDAT), the producer of *Farm Fresh Eggs*.
The goal is an export-grade online presence plus the systems behind it: export lead capture, distributor ordering, and batch traceability.

> Concept proposal. Company figures are drawn from public filings and press coverage (2025–2026). Prices, batch data and demo accounts are placeholders.

## What's inside

**Public website**
| Page | Purpose |
|---|---|
| `/` | Brand story, live counters, product range, horizontal farm-to-fork journey, animated export-route map, investor snapshot |
| `/about` | Purpose, milestones timeline, leadership, commitments |
| `/products` | Omega-3, Classic, Golden, Brown, HoReCa and pasteurised liquid egg |
| `/operations` | Integrated chain, capacity rings, farm-licensing model |
| `/export` | GCC market data, route map, grade/pack specs, container calculator, process, Arabic summary, RFQ form, FAQ |
| `/quality` | Batch-code traceability lookup with carton QR, certifications, QC controls |
| `/investors` | Financial highlights, IPO summary, use of proceeds, disclosures |
| `/contact` | Routed contact form |

**Systems**
- **Export RFQ pipeline** — buyers submit enquiries; staff move them through `new → contacted → quoted → sample_sent → won/lost`.
- **Distributor portal** (`/portal`) — trade partners sign in, order from the trade catalogue and track order status.
- **Operations console** (`/admin`) — KPIs, RFQs by destination, order book by city, order fulfilment, batch registration with QC status, contact inbox.
- **Traceability** — every registered batch gets a code; the public `/quality?code=…` page (and its QR) shows farm, flock, dates, QC and destination. Batches on hold or rejected are visibly flagged.

## Tech

- Node.js ≥ 22.13, **zero npm dependencies** — HTTP server, JSON API and SQLite via built-in `node:sqlite`.
- Vanilla HTML/CSS/ES modules. Motion: IntersectionObserver reveals, scroll-linked horizontal journey, word-by-word text reveal, animated counters, magnetic buttons, 3D tilt cards, SVG route animation, page transitions. Respects `prefers-reduced-motion`.
- Security basics: scrypt password hashing, HttpOnly session cookies, role checks, input length limits, honeypot + per-IP rate limiting on public forms, path-traversal guard, HTML escaping in all rendered data.

## Run

```bash
npm start            # http://localhost:3000
npm run reset        # wipe and reseed the database
PORT=8080 npm start  # custom port
```

The SQLite file is created at `data/wahdat.db` on first run.

### Demo accounts (seed data — change before any real deployment)

| Role | Email | Password |
|---|---|---|
| Admin | `admin@demo.test` | `admin123` |
| Distributor (Lahore) | `distributor@demo.test` | `dist123` |
| Distributor (Karachi) | `karachi@demo.test` | `dist123` |

Demo batch codes: `WPF-2610-A1`, `WPF-2610-B2`, `WPF-2610-EX1`, `WPF-2610-C4` (on hold).

## API

| Method | Path | Auth |
|---|---|---|
| GET | `/api/products`, `/api/stats`, `/api/trace/:code` | public |
| POST | `/api/inquiries`, `/api/contact` | public (rate-limited) |
| POST | `/api/login`, `/api/logout` · GET `/api/me` | — |
| GET/POST | `/api/orders/mine`, `/api/orders` | distributor |
| GET | `/api/admin/stats`, `/api/admin/{inquiries,orders,batches,messages}` | admin |
| PATCH | `/api/admin/{inquiries,orders,batches}/:id` | admin |
| POST | `/api/admin/batches` | admin |

## Security

See [SECURITY.md](SECURITY.md) for the attack results and fixes. Key environment variables:

| Variable | Purpose |
|---|---|
| `NODE_ENV=production` | Secure cookies, HSTS, no demo accounts |
| `SEED_ADMIN_PASSWORD` | Admin password for first seed |
| `DB_PATH` | SQLite file location |
| `PORT` | HTTP port |

## Recently added
- CSV export of RFQs and orders from the operations console (with formula-injection guard).
- Floating WhatsApp click-to-chat on every page.
- `sitemap.xml` and print styles for spec pages.

## Production roadmap

1. Real product photography and farm video; replace SVG placeholders.
2. Full Arabic (RTL) and Chinese locales for export markets.
3. Email/WhatsApp notifications on new RFQs and order status changes.
4. Persistent session store, HTTPS, CSRF tokens, audit log; move to Postgres if multi-instance.
5. Live PSX price widget and document library for investor relations.
6. Printed QR codes on cartons linked to `/quality?code=`.
7. **Export document generator** — proforma invoice, packing list and certificate checklist as PDF from an RFQ.
8. **Reefer IoT feed** — live container temperature on the batch trace page for export buyers.
9. **Consumer subscription** — weekly Farm Fresh home delivery in Islamabad/Lahore with WhatsApp reminders.
10. **Retailer credit & route planning** — credit limits per distributor and optimised delivery routes.
11. **Recipe & nutrition hub** — SEO content for Omega-3 eggs to lift organic traffic.
12. **ESG dashboard** — feed efficiency, packaging and energy metrics for investors and Gulf retailers.

## Sources

- Profit by Pakistan Today — Wahdat IPO plan (13 Mar 2026); listing (9 May 2026)
- Business Recorder — IPO nets Rs956m; flock expansion
- aviNews / Nukta — QSR supply in Pakistan & Qatar; 1,500+ outlets
- IndexBox — GCC table-egg market overview (2025)
- Profit by Pakistan Today — Pakistan egg exports $18.25m, FY2024-25
- wahdatpoultryfarm.com — product lines, certifications, contact details
