// Shared layout, motion and form behaviour for every page.
const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
document.documentElement.classList.add('preload');

export const egg = (tone = 'white', id = Math.random().toString(36).slice(2, 7)) => {
  const fills = {
    white: ['#fffdf8', '#efe4d0', '#d9c9ab'],
    brown: ['#e9b98f', '#c98b5a', '#9a6238'],
    golden: ['#fff3cf', '#f2d596', '#d6ae5c'],
    omega: ['#f7fbf1', '#dfe9cf', '#b7c9a3'],
  }[tone] || ['#fffdf8', '#efe4d0', '#d9c9ab'];
  return `<svg viewBox="0 0 120 150" aria-hidden="true"><defs>
    <radialGradient id="g${id}" cx="35%" cy="30%" r="80%"><stop offset="0" stop-color="${fills[0]}"/><stop offset=".6" stop-color="${fills[1]}"/><stop offset="1" stop-color="${fills[2]}"/></radialGradient></defs>
    <path d="M60 4C28 4 6 62 6 96c0 30 24 50 54 50s54-20 54-50C114 62 92 4 60 4z" fill="url(#g${id})"/>
    <ellipse cx="40" cy="44" rx="11" ry="20" fill="#fff" opacity=".55" transform="rotate(-20 40 44)"/></svg>`;
};

export const brandMark = `<svg class="brand-mark" viewBox="0 0 48 48" aria-hidden="true">
  <circle cx="24" cy="24" r="23" fill="#0c2418"/>
  <path d="M24 9c-7 0-12 12-12 19.5C12 35 17.4 39 24 39s12-4 12-10.5C36 21 31 9 24 9z" fill="#fbf6ec"/>
  <circle cx="24" cy="29" r="6.5" fill="#f6b40e"/></svg>`;

const NAV = [
  ['/', 'Home'], ['/about', 'Company'], ['/products', 'Products'], ['/operations', 'Farm to Shelf'],
  ['/export', 'Export'], ['/quality', 'Quality'], ['/investors', 'Investors'],
];

function header() {
  const path = location.pathname.replace(/\.html$/, '').replace(/\/index$/, '/') || '/';
  const links = NAV.map(([href, label]) =>
    `<li><a href="${href}" ${path === href ? 'aria-current="page"' : ''}>${label}</a></li>`).join('');
  const el = document.createElement('div');
  el.innerHTML = `
  <div class="progress" aria-hidden="true"></div>
  <header class="site-header ${document.body.dataset.dark !== undefined ? 'on-dark' : ''}">
    <nav class="container nav" aria-label="Main">
      <a class="brand" href="/" aria-label="Wahdat Poultry home">${brandMark}<span>Wahdat<small>Poultry Farm Ltd</small></span></a>
      <ul class="nav-links">${links}</ul>
      <div class="nav-cta">
        <a class="btn btn--ghost btn--sm" href="/portal">Partner login</a>
        <a class="btn btn--yolk btn--sm" href="/export#rfq">Request a quote</a>
        <button class="menu-btn" aria-label="Open menu" aria-expanded="false"><span></span><span></span><span></span></button>
      </div>
    </nav>
  </header>
  <div class="mobile-menu" aria-hidden="true">
    ${NAV.map(([h, l], i) => `<a href="${h}" style="transition-delay:${0.15 + i * 0.05}s">${l}</a>`).join('')}
    <a href="/contact" style="transition-delay:.55s">Contact</a>
    <a href="/portal" style="transition-delay:.6s;font-size:22px;margin-top:18px;color:var(--yolk)">Partner login →</a>
  </div>
  <div class="page-transition" aria-hidden="true"></div>`;
  document.body.prepend(...el.children);
}

function footer() {
  const f = document.createElement('footer');
  f.className = 'site-footer';
  f.innerHTML = `
  <div class="container">
    <div class="footer-grid">
      <div>
        <a class="brand" href="/" style="color:var(--cream)">${brandMark}<span>Wahdat<small>Poultry Farm Ltd</small></span></a>
        <p style="margin-top:20px;max-width:38ch">Vertically integrated producer of enriched, packaged eggs under the Farm Fresh Eggs brand. Listed on the Pakistan Stock Exchange.</p>
        <a class="btn btn--yolk btn--sm" href="/export#rfq" style="margin-top:12px">Export enquiry <span class="arrow">→</span></a>
      </div>
      <div><h5>Company</h5><ul>
        <li><a class="link-underline" href="/about">About us</a></li>
        <li><a class="link-underline" href="/operations">Farm to shelf</a></li>
        <li><a class="link-underline" href="/quality">Quality &amp; traceability</a></li>
        <li><a class="link-underline" href="/investors">Investor relations</a></li></ul></div>
      <div><h5>Trade</h5><ul>
        <li><a class="link-underline" href="/products">Products</a></li>
        <li><a class="link-underline" href="/export">Export programme</a></li>
        <li><a class="link-underline" href="/portal">Distributor portal</a></li>
        <li><a class="link-underline" href="/contact">Contact</a></li></ul></div>
      <div><h5>Head office</h5><ul>
        <li>G-2, Shah Tower, E-11/2, Islamabad, Pakistan</li>
        <li><a class="link-underline" href="tel:+9251111924328">+92 51 111 924 328</a></li>
        <li><a class="link-underline" href="mailto:info@wahdatfarms.com">info@wahdatfarms.com</a></li></ul></div>
    </div>
    <div class="footer-word" aria-hidden="true">Farm Fresh</div>
    <div class="footer-bottom">
      <span>© ${new Date().getFullYear()} Wahdat Poultry Farm Limited. PSX: WAHDAT.</span>
      <span>Concept redesign proposal · figures from public filings &amp; press (2026)</span>
    </div>
  </div>`;
  document.body.append(f);
}

// ---------- motion ----------
function initHeader() {
  const h = document.querySelector('.site-header');
  const bar = document.querySelector('.progress');
  let last = 0;
  const onScroll = () => {
    const y = scrollY;
    h.classList.toggle('is-scrolled', y > 30);
    h.classList.toggle('is-hidden', y > 400 && y > last && !document.body.classList.contains('menu-open'));
    last = y;
    const max = document.documentElement.scrollHeight - innerHeight;
    bar.style.transform = `scaleX(${max > 0 ? y / max : 0})`;
  };
  addEventListener('scroll', onScroll, { passive: true }); onScroll();

  const btn = document.querySelector('.menu-btn');
  btn.addEventListener('click', () => {
    const open = document.body.classList.toggle('menu-open');
    btn.setAttribute('aria-expanded', open);
    document.querySelector('.mobile-menu').setAttribute('aria-hidden', !open);
    document.body.style.overflow = open ? 'hidden' : '';
  });
}

function initReveal() {
  const els = document.querySelectorAll('[data-reveal], .clip-reveal');
  if (reduceMotion || !('IntersectionObserver' in window)) { els.forEach((e) => e.classList.add('is-in')); return; }
  const io = new IntersectionObserver((entries) => entries.forEach((e) => {
    if (e.isIntersecting) { e.target.classList.add('is-in'); io.unobserve(e.target); }
  }), { threshold: 0.14, rootMargin: '0px 0px -40px 0px' });
  els.forEach((e) => io.observe(e));
  document.querySelectorAll('[data-stagger]').forEach((g) => {
    [...g.children].forEach((c, i) => { c.setAttribute('data-reveal', c.dataset.reveal || ''); c.style.setProperty('--d', `${i * 0.09}s`); io.observe(c); });
  });
}

function initCounters() {
  const els = document.querySelectorAll('[data-count]');
  const fmt = (n, dec) => n.toLocaleString('en-US', { minimumFractionDigits: dec, maximumFractionDigits: dec });
  const run = (el) => {
    const target = parseFloat(el.dataset.count); const dec = Number(el.dataset.dec || 0);
    const suffix = el.dataset.suffix ? `<sup>${el.dataset.suffix}</sup>` : '';
    if (reduceMotion) { el.innerHTML = fmt(target, dec) + suffix; return; }
    const t0 = performance.now(); const dur = 2000;
    const tick = (t) => {
      const p = Math.min(1, (t - t0) / dur); const e = 1 - Math.pow(1 - p, 4);
      el.innerHTML = fmt(target * e, dec) + suffix;
      if (p < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  };
  const io = new IntersectionObserver((en) => en.forEach((e) => { if (e.isIntersecting) { run(e.target); io.unobserve(e.target); } }), { threshold: 0.5 });
  els.forEach((e) => io.observe(e));
}

function initMagnetic() {
  if (reduceMotion || matchMedia('(hover: none)').matches) return;
  document.querySelectorAll('.btn').forEach((b) => {
    b.addEventListener('mousemove', (e) => {
      const r = b.getBoundingClientRect();
      b.style.transform = `translate(${(e.clientX - r.left - r.width / 2) * 0.18}px, ${(e.clientY - r.top - r.height / 2) * 0.3}px)`;
    });
    b.addEventListener('mouseleave', () => { b.style.transform = ''; });
  });
}

function initTilt() {
  if (reduceMotion || matchMedia('(hover: none)').matches) return;
  document.querySelectorAll('[data-tilt]').forEach((c) => {
    c.addEventListener('mousemove', (e) => {
      const r = c.getBoundingClientRect();
      const x = (e.clientX - r.left) / r.width - 0.5; const y = (e.clientY - r.top) / r.height - 0.5;
      c.style.transform = `perspective(900px) rotateY(${x * 10}deg) rotateX(${-y * 10}deg) translateY(-6px)`;
    });
    c.addEventListener('mouseleave', () => { c.style.transform = ''; });
  });
}

function initParallax() {
  const items = document.querySelectorAll('[data-depth]');
  if (!items.length || reduceMotion) return;
  addEventListener('mousemove', (e) => {
    const x = e.clientX / innerWidth - 0.5; const y = e.clientY / innerHeight - 0.5;
    items.forEach((el) => { const d = Number(el.dataset.depth); el.style.transform = `translate(${x * d}px, ${y * d}px)`; });
  }, { passive: true });
}

function initJourney() {
  const sec = document.querySelector('.journey');
  if (!sec || reduceMotion) return;
  const track = sec.querySelector('.journey-track'); const bar = sec.querySelector('.journey-bar i');
  const update = () => {
    const r = sec.getBoundingClientRect();
    const total = sec.offsetHeight - innerHeight;
    const p = Math.min(1, Math.max(0, -r.top / total));
    const dist = track.scrollWidth - innerWidth;
    track.style.transform = `translate3d(${-dist * p}px,0,0)`;
    if (bar) bar.style.transform = `scaleX(${p})`;
  };
  const fit = () => { sec.style.height = `${Math.max(innerHeight * 1.5, track.scrollWidth - innerWidth + innerHeight)}px`; update(); };
  addEventListener('scroll', update, { passive: true }); addEventListener('resize', fit); fit();
}

function initWordReveal() {
  document.querySelectorAll('[data-words]').forEach((el) => {
    el.innerHTML = el.textContent.trim().split(/\s+/).map((w) => `<span class="w">${w}</span>`).join(' ');
    const words = el.querySelectorAll('.w');
    if (reduceMotion) { words.forEach((w) => w.classList.add('on')); return; }
    const update = () => {
      const r = el.getBoundingClientRect();
      const p = Math.min(1, Math.max(0, (innerHeight * 0.85 - r.top) / (r.height + innerHeight * 0.35)));
      const n = Math.round(p * words.length);
      words.forEach((w, i) => w.classList.toggle('on', i < n));
    };
    addEventListener('scroll', update, { passive: true }); update();
  });
}

function initPageTransitions() {
  const veil = document.querySelector('.page-transition');
  document.addEventListener('click', (e) => {
    const a = e.target.closest('a');
    if (!a || reduceMotion) return;
    const url = new URL(a.href, location.href);
    if (url.origin !== location.origin || a.target || e.metaKey || e.ctrlKey || e.shiftKey || url.hash && url.pathname === location.pathname) return;
    if (a.hasAttribute('download') || url.pathname.startsWith('/api/')) return;
    e.preventDefault();
    veil.classList.add('out');
    setTimeout(() => { location.href = url.href; }, 520);
  });
  addEventListener('pageshow', (e) => { if (e.persisted) veil.classList.remove('out'); });
}

// ---------- utilities ----------
export function toast(msg) {
  let t = document.querySelector('.toast');
  if (!t) { t = document.createElement('div'); t.className = 'toast'; t.setAttribute('role', 'status'); document.body.append(t); }
  t.textContent = msg; t.classList.add('show');
  clearTimeout(t._h); t._h = setTimeout(() => t.classList.remove('show'), 3200);
}

export async function api(path, opts = {}) {
  const res = await fetch(path, {
    method: opts.method || 'GET',
    headers: opts.body ? { 'Content-Type': 'application/json' } : {},
    body: opts.body ? JSON.stringify(opts.body) : undefined,
    credentials: 'same-origin',
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw Object.assign(new Error(data.error || `Request failed (${res.status})`), { status: res.status });
  return data;
}

export function bindForm(form, endpoint, onDone) {
  const status = form.querySelector('.form-status');
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = form.querySelector('[type=submit]');
    const body = Object.fromEntries(new FormData(form));
    btn.disabled = true; status.className = 'form-status'; status.textContent = 'Sending…';
    try {
      const out = await api(endpoint, { method: 'POST', body });
      form.reset(); status.classList.add('ok');
      status.textContent = onDone ? onDone(out) : 'Thank you — we will be in touch.';
    } catch (err) { status.classList.add('err'); status.textContent = err.message; }
    finally { btn.disabled = false; }
  });
}

export const pkr = (n) => `Rs ${Number(n).toLocaleString('en-PK')}`;
export const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

// ---------- boot ----------
header(); footer();
document.querySelectorAll('[data-egg]').forEach((el) => { el.innerHTML = egg(el.dataset.egg); });
initHeader(); initReveal(); initCounters(); initMagnetic(); initTilt(); initParallax(); initJourney(); initWordReveal(); initPageTransitions();
setTimeout(() => {
  document.documentElement.classList.remove('preload');
  document.documentElement.classList.add('is-loaded');
}, 60);
