import { api, esc, pkr, toast } from './app.js';

const app = document.getElementById('app');
const cart = new Map(); // product_id -> qty
let products = [];
let me = null;

const STATUS_BADGE = { placed: 'badge--info', confirmed: 'badge--warn', dispatched: 'badge--warn', delivered: 'badge--ok', cancelled: 'badge--bad' };

export function loginView(target, { title, sub, role, onDone }) {
  target.innerHTML = `
    <div class="login-card form-panel" data-reveal="scale">
      <span class="eyebrow">${esc(sub)}</span>
      <h1 class="h2" style="margin:14px 0 24px">${esc(title)}</h1>
      <form class="form" id="login" style="grid-template-columns:1fr">
        <div class="field"><label for="le">Email</label><input id="le" name="email" type="email" required autocomplete="username"></div>
        <div class="field"><label for="lp">Password</label><input id="lp" name="password" type="password" required autocomplete="current-password"></div>
        <button class="btn" type="submit">Sign in <span class="arrow">→</span></button>
        <p class="form-status" role="status"></p>
      </form>
      <p class="muted" style="font-size:13px;margin-top:8px">Demo accounts are listed in the project README.</p>
    </div>`;
  requestAnimationFrame(() => target.querySelector('[data-reveal]').classList.add('is-in'));
  const f = target.querySelector('#login');
  f.addEventListener('submit', async (e) => {
    e.preventDefault();
    const st = f.querySelector('.form-status');
    try {
      const r = await api('/api/login', { method: 'POST', body: Object.fromEntries(new FormData(f)) });
      if (role && r.role !== role) {
        await api('/api/logout', { method: 'POST' });
        throw new Error(`This area is for ${role} accounts`);
      }
      onDone();
    } catch (err) { st.className = 'form-status err'; st.textContent = err.message; }
  });
}

async function boot() {
  me = await api('/api/me');
  if (me.anonymous || me.role !== 'distributor') {
    return loginView(app, { title: 'Distributor portal', sub: 'Trade partners', role: 'distributor', onDone: boot });
  }
  products = await api('/api/products');
  render();
}

function render() {
  app.innerHTML = `
    <div class="app-head">
      <div><span class="eyebrow">Distributor portal</span><h1 class="h2" style="margin-top:10px">Welcome, ${esc(me.company || me.name)}</h1></div>
      <button class="btn btn--ghost btn--sm" id="logout">Sign out</button>
    </div>
    <div class="tabs" role="tablist"><button class="on" data-tab="order">New order</button><button data-tab="history">My orders</button></div>
    <div id="pane"></div>`;
  app.querySelector('#logout').onclick = async () => { await api('/api/logout', { method: 'POST' }); location.reload(); };
  app.querySelectorAll('[data-tab]').forEach((b) => b.onclick = () => {
    app.querySelectorAll('[data-tab]').forEach((x) => x.classList.toggle('on', x === b));
    b.dataset.tab === 'order' ? orderPane() : historyPane();
  });
  orderPane();
}

function orderPane() {
  const pane = app.querySelector('#pane');
  const active = products.filter((p) => p.status === 'active');
  const pipeline = products.filter((p) => p.status === 'pipeline');
  pane.innerHTML = `
    <div class="split split--top order-grid">
      <div class="table-wrap"><table>
        <thead><tr><th>Product</th><th>Pack</th><th>Trade price</th><th>Qty</th></tr></thead>
        <tbody>${active.map((p) => `
          <tr><td><b>${esc(p.name)}</b><br><span class="muted" style="font-size:13px">${esc(p.sku)}</span></td>
          <td>${esc(p.pack)}</td><td>${pkr(p.trade_price_pkr)}</td>
          <td><div class="qty"><button type="button" data-dec="${p.id}" aria-label="Decrease">−</button><input inputmode="numeric" data-qty="${p.id}" value="${cart.get(p.id) || 0}" aria-label="Quantity"><button type="button" data-inc="${p.id}" aria-label="Increase">+</button></div></td></tr>`).join('')}
          ${pipeline.map((p) => `<tr style="opacity:.55"><td><b>${esc(p.name)}</b><br><span class="muted" style="font-size:13px">${esc(p.sku)}</span></td><td>${esc(p.pack)}</td><td colspan="2"><span class="badge badge--info">Coming soon</span></td></tr>`).join('')}
        </tbody></table></div>
      <form class="form-panel" id="checkout" style="position:sticky;top:100px">
        <h2 class="h3" style="margin-bottom:16px">Order summary</h2>
        <div id="lines"></div>
        <div class="cart-line" style="border:0;font-weight:800;font-size:18px"><span>Total</span><span id="total">Rs 0</span></div>
        <div class="form" style="grid-template-columns:1fr;margin-top:12px">
          <div class="field"><label for="city">Delivery city</label><input id="city" name="delivery_city" value="${esc(me.city || '')}" required></div>
          <div class="field"><label for="dd">Preferred delivery date</label><input id="dd" name="delivery_date" type="date"></div>
          <div class="field"><label for="notes">Notes</label><input id="notes" name="notes" placeholder="Dock timing, contact person…"></div>
          <button class="btn btn--yolk" type="submit">Place order <span class="arrow">→</span></button>
        </div>
        <p class="muted" style="font-size:12px;margin:12px 0 0">Demo trade prices — not a live price list.</p>
      </form>
    </div>`;
  const tomorrow = new Date(Date.now() + 864e5).toISOString().slice(0, 10);
  pane.querySelector('#dd').min = tomorrow;

  const set = (id, q) => { q = Math.max(0, Math.min(10000, Math.floor(Number(q) || 0))); q ? cart.set(id, q) : cart.delete(id); pane.querySelector(`[data-qty="${id}"]`).value = q; summary(); };
  pane.querySelectorAll('[data-inc]').forEach((b) => b.onclick = () => set(+b.dataset.inc, (cart.get(+b.dataset.inc) || 0) + 1));
  pane.querySelectorAll('[data-dec]').forEach((b) => b.onclick = () => set(+b.dataset.dec, (cart.get(+b.dataset.dec) || 0) - 1));
  pane.querySelectorAll('[data-qty]').forEach((i) => i.onchange = () => set(+i.dataset.qty, i.value));

  function summary() {
    let total = 0;
    pane.querySelector('#lines').innerHTML = [...cart].map(([id, q]) => {
      const p = products.find((x) => x.id === id); total += p.trade_price_pkr * q;
      return `<div class="cart-line"><span>${q} × ${esc(p.name)} <span class="muted">(${esc(p.pack)})</span></span><b>${pkr(p.trade_price_pkr * q)}</b></div>`;
    }).join('') || '<p class="muted">No items yet.</p>';
    pane.querySelector('#total').textContent = pkr(total);
  }
  summary();

  pane.querySelector('#checkout').onsubmit = async (e) => {
    e.preventDefault();
    const fd = Object.fromEntries(new FormData(e.target));
    try {
      const r = await api('/api/orders', { method: 'POST', body: { ...fd, items: [...cart].map(([product_id, qty]) => ({ product_id, qty })) } });
      cart.clear(); toast(`Order ${r.ref} placed — ${pkr(r.total_pkr)}`);
      app.querySelector('[data-tab="history"]').click();
    } catch (err) { toast(err.message); }
  };
}

async function historyPane() {
  const pane = app.querySelector('#pane');
  pane.innerHTML = '<p class="muted">Loading orders…</p>';
  const orders = await api('/api/orders/mine');
  pane.innerHTML = orders.length ? `<div class="table-wrap"><table>
    <thead><tr><th>Ref</th><th>Placed</th><th>Items</th><th>Delivery</th><th>Total</th><th>Status</th></tr></thead>
    <tbody>${orders.map((o) => `<tr><td><b>${esc(o.ref)}</b></td><td>${esc(o.created_at.slice(0, 10))}</td>
      <td>${o.items.map((i) => `${i.qty} × ${esc(i.name)} (${esc(i.pack)})`).join('<br>')}</td>
      <td>${esc(o.delivery_city)}${o.delivery_date ? `<br><span class="muted">${esc(o.delivery_date)}</span>` : ''}</td>
      <td>${pkr(o.total_pkr)}</td><td><span class="badge ${STATUS_BADGE[o.status]}">${esc(o.status)}</span></td></tr>`).join('')}
    </tbody></table></div>` : '<div class="empty">No orders yet.</div>';
}

if (document.getElementById('app') && location.pathname.startsWith('/portal')) boot();
