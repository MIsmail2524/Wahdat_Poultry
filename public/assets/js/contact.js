import { bindForm } from './app.js';

const f = document.getElementById('contact-form');
const t = new URLSearchParams(location.search).get('topic');
if (t) [...f.topic.options].forEach((o) => { if (o.text === t) o.selected = true; });
bindForm(f, '/api/contact');
