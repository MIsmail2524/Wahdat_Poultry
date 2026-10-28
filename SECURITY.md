# Security review — Wahdat platform

Black-box and code review run against a local instance. Every finding below was reproduced, fixed, and re-tested.

| # | Attack | Before | Fix | After |
|---|---|---|---|---|
| 1 | Malformed URL `/%E0%A4%A` | **Process crash (unauthenticated DoS)** — `decodeURIComponent` threw outside any try/catch | Decoding guarded; whole request pipeline wrapped in a last-resort catch | `400`, server stays up |
| 2 | Malformed session cookie | Same crash path via cookie decoding | Cookie value must match the 48-hex session-id format | Ignored, `200` |
| 3 | CSRF via HTML form (`text/plain` JSON body) | Accepted — body parsed regardless of content type | API only accepts `application/json`; cookies `SameSite=Strict` | `415` |
| 4 | Cross-origin POST (`Origin: evil`) | Accepted | Origin must match Host for every non-GET API call | `403` |
| 5 | Login user enumeration (timing) | Unknown emails answered ~300× faster (no hash run) | Dummy scrypt hash verified for unknown users | Equal timing |
| 6 | Password brute force | Only a loose per-IP limit | Per-account lockout (5 fails → 15 min) + per-IP login bucket | `429` |
| 7 | Session fixation | Old session kept on re-login | Old session destroyed, new 192-bit id issued | Fixed |
| 8 | Clickjacking / XSS impact | No security headers | CSP, `X-Frame-Options: DENY`, `frame-ancestors 'none'`, Referrer-Policy, Permissions-Policy, COOP, HSTS (prod) | Headers present |
| 9 | Inline script blocked by CSP | Contact page used inline module | Moved to `/assets/js/contact.js` | No CSP violations |
| 10 | Path traversal (`..%2f`, `%2e%2e`, `%5c`, `%00`) | Prefix check `startsWith(PUBLIC)` would also match a sibling folder such as `public2` | Separator-aware check, null-byte rejection | `400/403/404` |
| 11 | CSV/formula injection in exports | n/a (new feature) | Cells starting `= + - @ \t \r` prefixed with `'`, all cells quoted | Neutralised |
| 12 | Known default passwords in production | Demo passwords always seeded | In `NODE_ENV=production`: no demo distributors, admin password from `SEED_ADMIN_PASSWORD` or random | Fixed |
| 13 | Slowloris / oversized bodies | Node defaults | `headersTimeout 20s`, `requestTimeout 30s`, 64 KB JSON limit | `413` on large bodies |
| 14 | Unbounded memory in rate-limit/session maps | Grew forever | Periodic cleanup | Fixed |
| 15 | API responses cached by proxies | Default caching | `Cache-Control: no-store` on JSON | Fixed |

Already safe on test: stored XSS (all rendered data HTML-escaped), SQL injection (parameterised queries; table names whitelisted by regex), role escalation (distributor → admin endpoints return `403`).

## Production checklist
- Run behind HTTPS with `NODE_ENV=production` (enables `__Host-` cookie, `Secure`, HSTS).
- Set `SEED_ADMIN_PASSWORD` before first start; rotate after first login.
- Persist sessions in Redis/Postgres if running more than one instance.
- Add email verification / 2FA for admin accounts.
- Ship logs to a central store and alert on repeated `429`/`403`.
