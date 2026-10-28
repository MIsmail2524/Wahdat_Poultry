import { bindForm } from './app.js';

// ---- container calculator (indicative loading assumptions) ----
const CASES = { 20: 700, 40: 1600 };
const EGGS_PER_CASE = 360;
const DAILY_OUTPUT = 400000;
let container = 40;

const $ = (id) => document.getElementById(id);
const fmt = (n, d = 0) => n.toLocaleString('en-US', { maximumFractionDigits: d, minimumFractionDigits: d });

function calc() {
  const n = Number($('cpm').value);
  const grams = Number($('grade').value);
  const cases = CASES[container] * n;
  const eggs = cases * EGGS_PER_CASE;
  $('cpmv').textContent = n;
  $('o-eggs').textContent = fmt(eggs);
  $('o-cases').textContent = fmt(cases);
  $('o-tonnes').textContent = `${fmt((eggs * grams) / 1e6, 1)} t`;
  $('o-days').textContent = fmt(eggs / DAILY_OUTPUT, 1);
  $('calc-cta').dataset.volume = `${n} × ${container}ft reefer${n > 1 ? 's' : ''} / month`;
}

document.querySelectorAll('[data-container]').forEach((b) => b.addEventListener('click', () => {
  container = Number(b.dataset.container);
  document.querySelectorAll('[data-container]').forEach((x) => x.classList.toggle('on', x === b));
  calc();
}));
$('cpm').addEventListener('input', calc);
$('grade').addEventListener('change', calc);
$('calc-cta').addEventListener('click', () => {
  $('volume').value = $('calc-cta').dataset.volume;
  $('frequency').value = 'Monthly';
});
calc();

bindForm(document.getElementById('rfq-form'), '/api/inquiries',
  (out) => `Thank you — your reference is ${out.ref}. Our export desk will reply within one business day.`);
