import { api } from '../api.js';
import { esc, fmtHora, badge, NIVEL_TIPO, ESTADO_TIPO } from '../ui.js';
import { ZONAS, mapaCorporal } from '../zonas.js';

const DIAS = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
const saludo = () => { const h = new Date().getHours(); return h < 12 ? 'Buenos días' : h < 19 ? 'Buenas tardes' : 'Buenas noches'; };
const cuando = (d) => (d < 0 ? `Vencido hace ${-d} d` : d === 0 ? 'Hoy' : `En ${d} d`);

export async function render(cont, usuario) {
  const d = await api.get('/dashboard');
  const t = d.totales;
  const clinico = usuario.rol !== 'recepcion';

  // Citas de los próximos 7 días (rellena con 0 los días sin citas)
  const porFecha = Object.fromEntries(d.semana.map((s) => [s.fecha.slice(0, 10), s.total]));
  const dias = [...Array(7)].map((_, i) => {
    const f = new Date(); f.setDate(f.getDate() + i);
    return { dia: i ? DIAS[f.getDay()] : 'Hoy', n: porFecha[f.toLocaleDateString('en-CA')] || 0 };
  });
  const max = Math.max(1, ...dias.map((x) => x.n));
  const conteos = Object.fromEntries(d.zonas.map((z) => [z.zona, z.total]));
  const top = [...d.zonas].sort((a, b) => b.total - a.total).slice(0, 4);

  cont.innerHTML = `
  <section class="inicio">
    <h2>${saludo()}, ${esc(usuario.nombre)}</h2>
    <p class="muted">Así está la clínica en este momento.</p>
    <div class="tonos"><i></i><i></i><i></i><i></i><i></i><i></i></div>
  </section>

  <section class="card banda">
    <div><b>${t.pacientes}</b><span>Pacientes registrados</span></div>
    <div><b>${t.citas_hoy}</b><span>Citas para hoy</span></div>
    <div><b>${t.citas_pendientes}</b><span>Citas pendientes</span></div>
    ${clinico ? `<div class="alerta"><b>${t.lesiones_altas}</b><span>Lesiones de riesgo alto</span></div>` : ''}
  </section>

  <section class="grid dos">
    <div class="card"><h3>Citas de los próximos 7 días</h3>
      <div class="bars">${dias.map((x) => `<div class="bar"><span class="n">${x.n}</span>
        <div class="col"><i class="${x.n ? '' : 'cero'}" style="height:${(x.n / max) * 100}%"></i></div><small>${x.dia}</small></div>`).join('')}</div>
    </div>
    ${clinico ? `<div class="card"><h3>Mapa de lesiones por zona</h3>
      <div class="heat">${mapaCorporal({ conteos })}
        <ul class="leyenda">${top.length ? top.map((z) => `<li><span>${ZONAS[z.zona]}</span><b>${z.total}</b></li>`).join('')
          : '<li class="muted">Aún no hay lesiones registradas.</li>'}</ul></div></div>` : ''}
  </section>

  <section class="grid dos">
    <div class="card"><h3>Agenda de hoy</h3>
      ${d.hoy.length ? d.hoy.map((c) => `<div class="item"><b>${fmtHora(c.hora)}</b>
        <div><strong>${esc(c.paciente)}</strong><small>${esc(c.motivo)}. Atiende ${esc(c.dermatologo)}</small></div>
        ${badge(c.estado, ESTADO_TIPO[c.estado])}</div>`).join('') : '<p class="vacio">No hay citas programadas para hoy.</p>'}
    </div>
    ${clinico ? `<div class="card"><h3>Seguimientos de lesiones</h3>
      ${d.seguimientos.length ? d.seguimientos.map((s) => `<div class="item"><b>${cuando(s.dias)}</b>
        <div><strong>${esc(s.paciente)}</strong><small>${ZONAS[s.zona] || esc(s.zona)}</small></div>
        ${badge(s.nivel, NIVEL_TIPO[s.nivel])}</div>`).join('') : '<p class="vacio">No hay controles pendientes en los próximos 14 días.</p>'}
    </div>` : ''}
  </section>`;
}
