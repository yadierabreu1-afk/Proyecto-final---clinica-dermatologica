// Utilidades de interfaz compartidas por todas las vistas.
export const $ = (s, r = document) => r.querySelector(s);
export const $$ = (s, r = document) => [...r.querySelectorAll(s)];

// Escapa texto del usuario antes de insertarlo en HTML (evita XSS).
export const esc = (s) => String(s ?? '').replace(/[&<>"']/g,
  (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

const ICONOS = {
  dashboard: '<rect x="3" y="3" width="7" height="9" rx="1.5"/><rect x="14" y="3" width="7" height="5" rx="1.5"/><rect x="14" y="12" width="7" height="9" rx="1.5"/><rect x="3" y="16" width="7" height="5" rx="1.5"/>',
  users: '<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20c0-3.6 2.9-6 6.5-6s6.5 2.4 6.5 6"/><path d="M16 4.5a3.5 3.5 0 0 1 0 7M18 14.3c2 .7 3.5 2.6 3.5 5.7"/>',
  calendar: '<rect x="3" y="5" width="18" height="16" rx="2.5"/><path d="M8 3v4M16 3v4M3 10h18"/>',
  scan: '<circle cx="12" cy="12" r="4"/><path d="M4 8V6a2 2 0 0 1 2-2h2M16 4h2a2 2 0 0 1 2 2v2M20 16v2a2 2 0 0 1-2 2h-2M8 20H6a2 2 0 0 1-2-2v-2"/>',
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',
  moon: '<path d="M21 13A9 9 0 1 1 11 3a7 7 0 0 0 10 10z"/>',
  logout: '<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  trash: '<path d="M3 6h18M8 6V4h8v2M6 6l1 14h10l1-14"/>',
  edit: '<path d="M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"/>',
  search: '<circle cx="11" cy="11" r="7"/><path d="M21 21l-4.3-4.3"/>',
};
export const icon = (n, s = 18) => `<svg width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONOS[n] || ''}</svg>`;

export function toast(msg, tipo = 'ok') {
  let c = $('#toasts');
  if (!c) { c = document.createElement('div'); c.id = 'toasts'; c.setAttribute('role', 'status'); document.body.append(c); }
  const t = document.createElement('div');
  t.className = `toast ${tipo}`; t.textContent = msg; c.append(t);
  setTimeout(() => t.classList.add('out'), 3200);
  setTimeout(() => t.remove(), 3600);
}

// Ventana modal. Si recibe onSubmit, muestra botones Cancelar/Guardar y entrega los datos del formulario.
export function modal({ titulo, html, guardar = 'Guardar', onSubmit, ancho = 560 }) {
  const ov = document.createElement('div');
  ov.className = 'overlay';
  ov.innerHTML = `<div class="modal" style="max-width:${ancho}px" role="dialog" aria-modal="true" aria-label="${esc(titulo)}">
    <header><h3>${esc(titulo)}</h3><button class="btn ghost sm" data-x aria-label="Cerrar">Cerrar</button></header>
    <form class="body">${html}${onSubmit ? `<footer><button type="button" class="btn ghost" data-x>Cancelar</button><button class="btn primary">${esc(guardar)}</button></footer>` : ''}</form></div>`;
  const cerrar = () => { ov.remove(); document.removeEventListener('keydown', tecla); };
  const tecla = (e) => { if (e.key === 'Escape') cerrar(); };
  document.addEventListener('keydown', tecla);
  ov.addEventListener('click', (e) => { if (e.target === ov || e.target.closest('[data-x]')) cerrar(); });
  const form = $('form', ov);
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!onSubmit) return;
    const datos = Object.fromEntries(new FormData(form));
    $$('input[type=checkbox][name]', form).forEach((c) => { datos[c.name] = c.checked; });
    const btn = $('footer .primary', form);
    btn.disabled = true;
    try { await onSubmit(datos, cerrar); } catch (err) { toast(err.message, 'error'); btn.disabled = false; }
  });
  document.body.append(ov);
  return { el: ov, form, cerrar };
}

const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
export const fmtFecha = (f) => { if (!f) return '—'; const [y, m, d] = f.slice(0, 10).split('-'); return `${+d} ${MESES[m - 1]} ${y}`; };
export const fmtHora = (h) => { const [H, M] = h.split(':').map(Number); return `${H % 12 || 12}:${String(M).padStart(2, '0')} ${H < 12 ? 'a. m.' : 'p. m.'}`; };
export const hoyISO = () => new Date().toLocaleDateString('en-CA');
export const edad = (f) => {
  const [y, m, d] = f.slice(0, 10).split('-').map(Number);
  const h = new Date(); let e = h.getFullYear() - y;
  if (h < new Date(h.getFullYear(), m - 1, d)) e--;
  return e;
};
export const badge = (t, tipo = 'info') => `<span class="badge ${tipo}">${esc(t)}</span>`;
export const NIVEL_TIPO = { bajo: 'ok', moderado: 'warn', alto: 'danger', 'muy alto': 'danger' };
export const ESTADO_TIPO = { programada: 'warn', confirmada: 'ok', atendida: 'muted', cancelada: 'danger' };
export const ROL = { admin: 'Administración', dermatologo: 'Dermatología', recepcion: 'Recepción' };
export const ROMANO = ['', 'I', 'II', 'III', 'IV', 'V', 'VI'];
export const FOTOTIPOS = {
  1: 'Tipo I: piel muy clara, siempre se quema',
  2: 'Tipo II: piel clara, se quema con facilidad',
  3: 'Tipo III: piel media, a veces se quema',
  4: 'Tipo IV: piel morena clara, rara vez se quema',
  5: 'Tipo V: piel morena, muy rara vez se quema',
  6: 'Tipo VI: piel oscura, nunca se quema',
};
export const dotFototipo = (n) => `<i class="dot" style="background:var(--f${n})"></i>`;
