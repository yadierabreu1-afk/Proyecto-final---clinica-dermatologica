import { api } from '../api.js';
import { $, esc, icon, modal, toast, badge, fmtHora, hoyISO, dotFototipo, ESTADO_TIPO } from '../ui.js';

const sumarDias = (iso, n) => { const [y, m, d] = iso.split('-').map(Number); return new Date(y, m - 1, d + n).toLocaleDateString('en-CA'); };
const ACCIONES = {
  programada: [['confirmada', 'Confirmar'], ['cancelada', 'Cancelar']],
  confirmada: [['atendida', 'Marcar atendida'], ['cancelada', 'Cancelar']],
  atendida: [], cancelada: [],
};

export async function render(cont, usuario) {
  const dermas = await api.get('/citas/dermatologos');
  const est = { fecha: hoyISO(), derm: usuario.rol === 'dermatologo' ? String(usuario.id) : '' };
  const opcionesDerm = (sel) => dermas.map((d) => `<option value="${d.id}"${String(d.id) === String(sel) ? ' selected' : ''}>${esc(d.nombre)}</option>`).join('');

  cont.innerHTML = `
    <div class="barra">
      <div class="filtros">
        <button class="btn ghost sm" id="ant" aria-label="Día anterior">Anterior</button>
        <input type="date" id="fecha" value="${est.fecha}" aria-label="Fecha">
        <button class="btn ghost sm" id="sig" aria-label="Día siguiente">Siguiente</button>
        <button class="btn ghost sm" id="hoy">Hoy</button>
        <select id="derm" aria-label="Dermatólogo"><option value="">Todos los dermatólogos</option>${opcionesDerm(est.derm)}</select>
      </div>
      <button class="btn primary" id="nueva">${icon('plus', 16)} Nueva cita</button>
    </div>
    <p class="hueco" id="hueco"></p>
    <div id="linea"></div>`;

  const tarjeta = (c) => `<article class="cita e-${c.estado}">
    <div class="hora">${fmtHora(c.hora)}<small>${c.duracion_min} min</small></div>
    <div><strong>${dotFototipo(c.fototipo)}${esc(c.paciente)}</strong>
      <small style="display:block">${esc(c.motivo)}. Atiende ${esc(c.dermatologo)}</small></div>
    <div class="btns">${badge(c.estado, ESTADO_TIPO[c.estado])}
      ${ACCIONES[c.estado].map(([e, t]) => `<button class="btn ghost sm" data-id="${c.id}" data-estado="${e}">${t}</button>`).join('')}</div></article>`;

  async function cargar() {
    const qs = new URLSearchParams({ fecha: est.fecha });
    if (est.derm) qs.set('dermatologo_id', est.derm);
    const citas = await api.get('/citas?' + qs);
    $('#linea', cont).innerHTML = citas.length ? citas.map(tarjeta).join('')
      : '<div class="card vacio">No hay citas para este día. Usa «Nueva cita» para agendar una.</div>';

    const h = $('#hueco', cont);
    if (!est.derm) h.textContent = 'Elige un dermatólogo para ver su próximo espacio libre.';
    else if (est.fecha < hoyISO()) h.textContent = '';
    else {
      const r = await api.get(`/citas/disponibilidad?fecha=${est.fecha}&dermatologo_id=${est.derm}`);
      h.textContent = r.libres.length
        ? `Próximo espacio libre: ${fmtHora(r.libres[0] + ':00')}. Quedan ${r.libres.length} horarios de 30 minutos.`
        : 'Este día ya no quedan horarios libres.';
    }
  }
  const ir = (f) => { est.fecha = f; $('#fecha', cont).value = f; cargar().catch((e) => toast(e.message, 'error')); };

  $('#fecha', cont).addEventListener('change', (e) => e.target.value && ir(e.target.value));
  $('#ant', cont).addEventListener('click', () => ir(sumarDias(est.fecha, -1)));
  $('#sig', cont).addEventListener('click', () => ir(sumarDias(est.fecha, 1)));
  $('#hoy', cont).addEventListener('click', () => ir(hoyISO()));
  $('#derm', cont).addEventListener('change', (e) => { est.derm = e.target.value; cargar(); });

  $('#linea', cont).addEventListener('click', async (e) => {
    const b = e.target.closest('[data-estado]'); if (!b) return;
    if (b.dataset.estado === 'cancelada' && !confirm('¿Cancelar esta cita?')) return;
    try { await api.patch(`/citas/${b.dataset.id}/estado`, { estado: b.dataset.estado }); toast('Cita actualizada'); cargar(); }
    catch (err) { toast(err.message, 'error'); }
  });

  $('#nueva', cont).addEventListener('click', async () => {
    const pacientes = await api.get('/pacientes');
    const m = modal({
      titulo: 'Agendar nueva cita', guardar: 'Agendar cita',
      html: `
        <div class="field"><label>Paciente</label><select name="paciente_id" required><option value="">Selecciona un paciente</option>
          ${pacientes.map((p) => `<option value="${p.id}">${esc(p.nombre)} ${esc(p.apellido)} (${esc(p.cedula)})</option>`).join('')}</select></div>
        <div class="row">
          <div class="field"><label>Dermatólogo</label><select name="dermatologo_id" required><option value="">Selecciona</option>${opcionesDerm(est.derm)}</select></div>
          <div class="field"><label>Duración</label><select name="duracion_min"><option value="30">30 minutos</option><option value="60">60 minutos</option></select></div>
        </div>
        <div class="field"><label>Fecha</label><input type="date" name="fecha" required min="${hoyISO()}" value="${est.fecha < hoyISO() ? hoyISO() : est.fecha}"></div>
        <div class="field"><label>Horarios disponibles</label><div class="slots" id="slots"></div></div>
        <div class="field"><label>Motivo de la consulta</label><input name="motivo" required maxlength="200" placeholder="Ejemplo: control de acné, revisión de lunares"></div>`,
      onSubmit: async (d, cerrar) => {
        if (!d.hora) throw new Error('Elige uno de los horarios disponibles');
        await api.post('/citas', d);
        toast('Cita agendada'); cerrar(); cargar();
      },
    });
    const f = m.form;
    async function slots() {
      const box = $('#slots', f);
      if (!f.dermatologo_id.value || !f.fecha.value) { box.innerHTML = '<small>Elige dermatólogo y fecha para ver los horarios.</small>'; return; }
      try {
        const r = await api.get(`/citas/disponibilidad?fecha=${f.fecha.value}&dermatologo_id=${f.dermatologo_id.value}&duracion=${f.duracion_min.value}`);
        box.innerHTML = r.libres.length
          ? r.libres.map((h) => `<label class="slot"><input type="radio" name="hora" value="${h}"><span>${fmtHora(h + ':00')}</span></label>`).join('')
          : '<small>No quedan horarios libres ese día. Prueba con otra fecha.</small>';
      } catch (err) { box.innerHTML = `<small>${esc(err.message)}</small>`; }
    }
    ['dermatologo_id', 'fecha', 'duracion_min'].forEach((n) => f[n].addEventListener('change', slots));
    slots();
  });

  await cargar();
}
