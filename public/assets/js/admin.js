import { api, esc, pkr, toast } from './app.js';
import { loginView } from './portal.js';

const app = document.getElementById('app');
const STATUSES = {
  inquiries: ['new', 'contacted', 'quoted', 'sample_sent', 'won', 'lost'],
  orders: ['placed', 'confirmed', 'dispatched', 'delivered', 'cancelled'],
  batches: ['passed', 'hold', 'rejected'],
};

async function boot() {
  const me = await api('/api/me');
  if (me.anonymous || me.role !== 'admin') {
    return loginView(app, { title: 'Operations console', sub: 'Staff only', role: 'admin', onDone: boot });
  }
  app.innerHTML = `
    <div class="app-head">
      <div><span class="eyebrow">Operations console</span><h1 class="h2" style="margin-top:10px">Good day, ${esc(me.name)}</h1></div>
      <div style="display:flex;gap:8px;flex-wrap:wrap">
        <a class="btn btn--ghost btn--sm" href="/api/admin/export/inquiries.csv" download>RFQs CSV</a>
        <a class="btn btn--ghost btn--sm" href="/api/admin/export/orders.csv" download>Orders CSV</a>
        <button class="btn btn--ghost btn--sm" id="logout">Sign out</button>
      </div>
    </div>
    <div class="tabs" role="tablist">
      <button class="on" data-tab="overview">Overview</button><button data-tab="inquiries">Export RFQs</button>
      <button data-tab="orders">Trade orders</button><button data-tab="batches">Batches &amp; QC</button><button data-tab="messages">Messages</button>
    </div>
    <div id="pane"></div>`;
  app.querySelector('#logout').onclick = async () => { await api('/api/logout', { method: 'POST' }); location.reload(); };
  app.querySelectorAll('[data-tab]').forEach((b) => b.onclick = () => {
    app.querySelectorAll('[data-tab]').forEach((x) => x.classList.toggle('on', x === b));
    VIEWS[b.dataset.tab]();
  });
  VIEWS.overview();
}

const pane = () => app.querySelector('#pane');
const select = (table, id, value) => `<select class="status-select" data-table="${table}" data-id="${id}" aria-label="Status">
  ${STATUSES[table].map((s) => `<option ${s === value ? 'selected' : ''} value="${s}">${s.replace('_', ' ')}</option>`).join('')}</select>`;

function bindStatus() {
  pane().querySelectorAll('select[data-table]').forEach((s) => s.onchange = async () => {
    try { await api(`/api/admin/${s.dataset.table}/${s.dataset.id}`, { method: 'PATCH', body: { status: s.value } }); toast('Status updated'); }
    catch (e) { toast(e.message); }
  });
}

const VIEWS = {
  async overview() {
    const s = await api('/api/admin/stats');
    const maxC = Math.max(1, ...s.byCountry.map((r) => r.n));
    const maxT = Math.max(1, ...s.ordersByCity.map((r) => r.total));
    pane().innerHTML = `
      <div class="kpis">
        <div class="kpi"><b>${s.inquiriesOpen}</b><span>Open export RFQs (of ${s.inquiriesTotal})</span></div>
        <div class="kpi"><b>${s.ordersPending}</b><span>Trade orders to fulfil</span></div>
        <div class="kpi"><b>${pkr(s.revenuePipelinePKR)}</b><span>Order book value</span></div>
        <div class="kpi"><b>${s.batchesOnHold}</b><span>Batches on QC hold</span></div>
      </div>
      <div class="admin-grid">
        <div class="card"><h3 class="h4">RFQs by destination</h3>
          ${s.byCountry.map((r) => `<div class="bar-row"><span>${esc(r.country)}</span><div class="bar"><i style="width:${(r.n / maxC) * 100}%"></i></div><b>${r.n}</b></div>`).join('') || '<p class="muted">No RFQs yet.</p>'}</div>
        <div class="card"><h3 class="h4">Order value by city</h3>
          ${s.ordersByCity.map((r) => `<div class="bar-row"><span>${esc(r.city)}</span><div class="bar"><i style="width:${(r.total / maxT) * 100}%;background:var(--yolk-deep)"></i></div><b>${pkr(r.total)}</b></div>`).join('') || '<p class="muted">No orders yet.</p>'}</div>
      </div>`;
  },

  async inquiries() {
    const rows = await api('/api/admin/inquiries');
    pane().innerHTML = rows.length ? `<div class="table-wrap"><table>
      <thead><tr><th>Ref</th><th>Buyer</th><th>Destination</th><th>Product &amp; volume</th><th>Terms</th><th>Notes</th><th>Status</th></tr></thead>
      <tbody>${rows.map((r) => `<tr>
        <td><b>${esc(r.ref)}</b><br><span class="muted" style="font-size:13px">${esc(r.created_at.slice(0, 10))}</span></td>
        <td><b>${esc(r.company)}</b><br>${esc(r.contact_name)}<br><a class="link-underline" href="mailto:${esc(r.email)}">${esc(r.email)}</a>${r.phone ? `<br>${esc(r.phone)}` : ''}</td>
        <td>${esc(r.country)}${r.port ? `<br><span class="muted">${esc(r.port)}</span>` : ''}</td>
        <td>${esc(r.product)}<br><b>${esc(r.volume)}</b> ${r.frequency ? `· ${esc(r.frequency)}` : ''}</td>
        <td>${esc(r.incoterm || '—')}<br><span class="muted">${esc(r.buyer_type || '')}</span></td>
        <td style="max-width:260px">${esc(r.message || '')}</td>
        <td>${select('inquiries', r.id, r.status)}</td></tr>`).join('')}</tbody></table></div>` : '<div class="empty">No RFQs yet.</div>';
    bindStatus();
  },

  async orders() {
    const rows = await api('/api/admin/orders');
    pane().innerHTML = rows.length ? `<div class="table-wrap"><table>
      <thead><tr><th>Ref</th><th>Customer</th><th>Delivery</th><th>Total</th><th>Notes</th><th>Status</th></tr></thead>
      <tbody>${rows.map((r) => `<tr><td><b>${esc(r.ref)}</b><br><span class="muted" style="font-size:13px">${esc(r.created_at.slice(0, 10))}</span></td>
        <td>${esc(r.company)}</td><td>${esc(r.delivery_city)}${r.delivery_date ? `<br><span class="muted">${esc(r.delivery_date)}</span>` : ''}</td>
        <td>${pkr(r.total_pkr)}</td><td>${esc(r.notes || '')}</td><td>${select('orders', r.id, r.status)}</td></tr>`).join('')}</tbody></table></div>` : '<div class="empty">No orders yet.</div>';
    bindStatus();
  },

  async batches() {
    const rows = await api('/api/admin/batches');
    const today = new Date().toISOString().slice(0, 10);
    const plus = (d) => new Date(Date.now() + d * 864e5).toISOString().slice(0, 10);
    pane().innerHTML = `
      <form class="form form-panel batch-form" id="batch-form">
        <h2 class="h4 field--full">Register a packed batch</h2>
        <div class="field"><label>Farm</label><select name="farm"><option>Layer Farm 1</option><option>Layer Farm 2</option><option>Layer Farm 3</option><option>Layer Farm 4</option></select></div>
        <div class="field"><label>Flock ID</label><input name="flock" required placeholder="FL-118"></div>
        <div class="field"><label>Line</label><select name="line"><option>Omega-3</option><option>Classic</option><option>Golden</option><option>Brown</option></select></div>
        <div class="field"><label>Grade</label><select name="grade"><option>Medium (53–63 g)</option><option selected>Large (63–73 g)</option><option>Extra large (≥73 g)</option></select></div>
        <div class="field"><label>Laid on</label><input type="date" name="laid_on" value="${today}" required></div>
        <div class="field"><label>Packed on</label><input type="date" name="packed_on" value="${today}" required></div>
        <div class="field"><label>Best before</label><input type="date" name="best_before" value="${plus(28)}" required></div>
        <div class="field"><label>QC status</label><select name="qc_status"><option>passed</option><option>hold</option><option>rejected</option></select></div>
        <div class="field" style="grid-column:span 2"><label>QC notes</label><input name="qc_notes"></div>
        <div class="field" style="grid-column:span 2"><label>Destination</label><input name="destination" placeholder="e.g. Jebel Ali, UAE (export)"></div>
        <div class="field--full"><button class="btn" type="submit">Create batch &amp; code <span class="arrow">→</span></button></div>
      </form>
      <div class="table-wrap"><table>
        <thead><tr><th>Code</th><th>Farm / flock</th><th>Line &amp; grade</th><th>Laid → packed</th><th>Best before</th><th>Destination</th><th>QC</th></tr></thead>
        <tbody>${rows.map((r) => `<tr><td><a class="link-underline" style="font-weight:800" href="/quality?code=${encodeURIComponent(r.code)}" target="_blank" rel="noopener">${esc(r.code)}</a></td>
          <td>${esc(r.farm)}<br><span class="muted">${esc(r.flock)}</span></td><td>${esc(r.line)}<br><span class="muted">${esc(r.grade)}</span></td>
          <td>${esc(r.laid_on)} → ${esc(r.packed_on)}</td><td>${esc(r.best_before)}</td><td>${esc(r.destination || '—')}</td>
          <td>${select('batches', r.id, r.qc_status)}</td></tr>`).join('')}</tbody></table></div>`;
    bindStatus();
    pane().querySelector('#batch-form').onsubmit = async (e) => {
      e.preventDefault();
      try { const r = await api('/api/admin/batches', { method: 'POST', body: Object.fromEntries(new FormData(e.target)) }); toast(`Batch ${r.code} created`); VIEWS.batches(); }
      catch (err) { toast(err.message); }
    };
  },

  async messages() {
    const rows = await api('/api/admin/messages');
    pane().innerHTML = rows.length ? `<div class="table-wrap"><table>
      <thead><tr><th>Received</th><th>From</th><th>Topic</th><th>Message</th></tr></thead>
      <tbody>${rows.map((r) => `<tr><td>${esc(r.created_at.slice(0, 16))}</td><td><b>${esc(r.name)}</b><br><a class="link-underline" href="mailto:${esc(r.email)}">${esc(r.email)}</a></td>
        <td><span class="badge">${esc(r.topic)}</span></td><td style="max-width:420px">${esc(r.message)}</td></tr>`).join('')}</tbody></table></div>` : '<div class="empty">No messages yet.</div>';
  },
};

boot();
