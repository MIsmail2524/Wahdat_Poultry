import { api, esc } from './app.js';

const form = document.getElementById('trace-form');
const input = document.getElementById('code');
const wrap = document.getElementById('result-wrap');
const out = document.getElementById('trace-result');

const QC = { passed: ['badge--ok', 'QC passed'], hold: ['badge--warn', 'On hold'], rejected: ['badge--bad', 'Rejected'] };
const date = (d) => new Date(`${d}T00:00:00`).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });

async function trace(code) {
  wrap.hidden = false;
  out.innerHTML = '<p class="muted">Looking up batch…</p>';
  try {
    const b = await api(`/api/trace/${encodeURIComponent(code)}`);
    const [cls, label] = QC[b.qc_status] || ['', b.qc_status];
    out.innerHTML = `
      <div class="split split--top">
        <div class="form-panel">
          <span class="badge ${cls}">${label}</span>
          <h2 class="h2" style="margin:14px 0 6px">${esc(b.code)}</h2>
          <p class="muted" style="margin:0">${esc(b.line)} · ${esc(b.grade)}</p>
          <ol class="timeline">
            <li style="animation-delay:.05s"><b>Laid</b>${esc(b.farm)} · flock ${esc(b.flock)} · ${date(b.laid_on)}</li>
            <li style="animation-delay:.2s"><b>Graded &amp; packed</b>${date(b.packed_on)}</li>
            <li style="animation-delay:.35s"><b>Quality check</b>${esc(b.qc_notes || label)}</li>
            ${b.destination ? `<li style="animation-delay:.5s"><b>Dispatched to</b>${esc(b.destination)}</li>` : ''}
            <li style="animation-delay:.65s"><b>Best before</b>${date(b.best_before)}</li>
          </ol>
        </div>
        <div class="card center" style="padding:36px">
          <h3 class="h4" style="margin-bottom:18px">Carton QR</h3>
          <div id="qr" style="display:grid;place-items:center;min-height:200px"></div>
          <p class="muted" style="font-size:14px;margin-top:16px">Printed on each pack; opens this page for the batch.</p>
        </div>
      </div>`;
    renderQr(`${location.origin}/quality?code=${encodeURIComponent(b.code)}`);
    history.replaceState(null, '', `?code=${encodeURIComponent(b.code)}`);
    wrap.scrollIntoView({ behavior: 'smooth', block: 'start' });
  } catch (e) {
    out.innerHTML = `<div class="form-panel"><span class="badge badge--bad">Not found</span><p style="margin-top:14px">${esc(e.message)}. Check the code on the side of your carton and try again.</p></div>`;
  }
}

function renderQr(text) {
  const el = document.getElementById('qr');
  const draw = () => { el.innerHTML = ''; new window.QRCode(el, { text, width: 180, height: 180, colorDark: '#0c2418', colorLight: '#ffffff' }); };
  if (window.QRCode) return draw();
  const s = document.createElement('script');
  s.src = 'https://cdnjs.cloudflare.com/ajax/libs/qrcodejs/1.0.0/qrcode.min.js';
  s.onload = draw;
  s.onerror = () => { el.textContent = text; };
  document.head.append(s);
}

form.addEventListener('submit', (e) => { e.preventDefault(); if (input.value.trim()) trace(input.value.trim()); });
const initial = new URLSearchParams(location.search).get('code');
if (initial) { input.value = initial; trace(initial); }
