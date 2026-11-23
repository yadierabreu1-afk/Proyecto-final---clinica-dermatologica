import { api, sesion } from './api.js';
import { $, $$, icon, esc, ROL } from './ui.js';
import * as dashboard from './views/dashboard.js';
import * as pacientes from './views/pacientes.js';
import * as agenda from './views/agenda.js';
import * as lesiones from './views/lesiones.js';
import * as solar from './views/solar.js';

const usuario = sesion.usuario();
if (!sesion.token() || !usuario) { sesion.cerrar(); throw new Error('Sin sesión'); }

const TODOS = ['admin', 'dermatologo', 'recepcion'];
const RUTAS = {
  dashboard: { titulo: 'Panel general', icono: 'dashboard', vista: dashboard, roles: TODOS },
  pacientes: { titulo: 'Pacientes', icono: 'users', vista: pacientes, roles: TODOS },
  agenda: { titulo: 'Agenda de citas', icono: 'calendar', vista: agenda, roles: TODOS },
  lesiones: { titulo: 'Lesiones (regla ABCDE)', icono: 'scan', vista: lesiones, roles: ['admin', 'dermatologo'] },
  solar: { titulo: 'Riesgo solar', icono: 'sun', vista: solar, roles: TODOS },
};

// Menú según el rol de la persona
$('#nav').innerHTML = Object.entries(RUTAS)
  .filter(([, r]) => r.roles.includes(usuario.rol))
  .map(([k, r]) => `<a href="#/${k}" data-ruta="${k}">${icon(r.icono, 20)}<span>${r.titulo}</span></a>`).join('');

const iniciales = usuario.nombre.replace(/^(Dra?\.)\s*/, '').split(' ').slice(0, 2).map((p) => p[0]).join('');
$('#usuario').innerHTML = `<div class="avatar">${esc(iniciales)}</div><div><strong>${esc(usuario.nombre)}</strong><small>${ROL[usuario.rol]}</small></div>`;
$('#fecha').textContent = new Date().toLocaleDateString('es-DO', { weekday: 'long', day: 'numeric', month: 'long' });
$('#salir').innerHTML = `${icon('logout', 18)} Cerrar sesión`;
$('#salir').addEventListener('click', () => sesion.cerrar());

const aplicarTema = (t) => {
  document.documentElement.dataset.theme = t;
  localStorage.setItem('derma_tema', t);
  $('#tema').innerHTML = `${icon(t === 'dark' ? 'sun' : 'moon', 18)} ${t === 'dark' ? 'Modo claro' : 'Modo oscuro'}`;
};
aplicarTema(document.documentElement.dataset.theme);
$('#tema').addEventListener('click', () => aplicarTema(document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark'));

let contador = 0;
async function navegar() {
  const clave = (location.hash.replace('#/', '') || 'dashboard').split('?')[0];
  const ruta = RUTAS[clave]?.roles.includes(usuario.rol) ? clave : 'dashboard';
  if (ruta !== clave) { location.hash = '#/' + ruta; return; }

  $$('#nav a').forEach((a) => a.classList.toggle('activa', a.dataset.ruta === ruta));
  $('#titulo').textContent = RUTAS[ruta].titulo;
  const id = ++contador;
  const vista = $('#vista');
  const nueva = document.createElement('div');
  nueva.className = 'entra';
  try {
    await RUTAS[ruta].vista.render(nueva, usuario);
  } catch (e) {
    nueva.innerHTML = `<div class="card vacio">${esc(e.message)}</div>`;
  }
  if (id === contador) vista.replaceChildren(nueva); // ignora respuestas de navegaciones anteriores
}

window.addEventListener('hashchange', navegar);
api.get('/auth/perfil').then(navegar); // valida el token antes de pintar
