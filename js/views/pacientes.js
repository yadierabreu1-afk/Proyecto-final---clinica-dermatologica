import { api } from '../api.js';
import { $, esc, icon, modal, toast, badge, edad, fmtFecha, fmtHora, hoyISO, dotFototipo, ROMANO, FOTOTIPOS, NIVEL_TIPO, ESTADO_TIPO } from '../ui.js';
import { ZONAS } from '../zonas.js';

const opciones = (obj, sel) => Object.entries(obj).map(([k, v]) => `<option value="${k}"${String(k) === String(sel) ? ' selected' : ''}>${esc(v)}</option>`).join('');

const formulario = (p = {}) => `
  <div class="row">
    <div class="field"><label>Cédula</label><input name="cedula" required value="${esc(p.cedula)}" placeholder="001-0000000-0"></div>
    <div class="field"><label>Fecha de nacimiento</label><input type="date" name="fecha_nacimiento" required max="${hoyISO()}" value="${esc(p.fecha_nacimiento)}"></div>
  </div>
  <div class="row">
    <div class="field"><label>Nombre</label><input name="nombre" required value="${esc(p.nombre)}"></div>
    <div class="field"><label>Apellido</label><input name="apellido" required value="${esc(p.apellido)}"></div>
  </div>
  <div class="row">
    <div class="field"><label>Sexo</label><select name="sexo">${opciones({ F: 'Femenino', M: 'Masculino', O: 'Otro' }, p.sexo || 'F')}</select></div>
    <div class="field"><label>Teléfono</label><input name="telefono" value="${esc(p.telefono)}" placeholder="809-000-0000"></div>
  </div>
  <div class="field"><label>Correo</label><input type="email" name="email" value="${esc(p.email)}"></div>
  <div class="field"><label>Fototipo de piel (escala de Fitzpatrick)</label>
    <select name="fototipo">${opciones(FOTOTIPOS, p.fototipo || 3)}</select></div>
  <label class="check"><input type="checkbox" name="antecedente_familiar" ${p.antecedente_familiar ? 'checked' : ''}> Antecedentes familiares de cáncer de piel</label>
  <div class="field"><label>Alergias</label><textarea name="alergias">${esc(p.alergias)}</textarea></div>
  <div class="field"><label>Notas clínicas</label><textarea name="notas">${esc(p.notas)}</textarea></div>`;

const ficha = (p, clinico) => `
  <div class="ficha">
    <div><small>Cédula</small>${esc(p.cedula)}</div>
    <div><small>Edad</small>${edad(p.fecha_nacimiento)} años</div>
    <div><small>Teléfono</small>${esc(p.telefono || '—')}</div>
    <div><small>Correo</small>${esc(p.email || '—')}</div>
    <div><small>Fototipo</small>${dotFototipo(p.fototipo)}${esc(FOTOTIPOS[p.fototipo])}</div>
    <div><small>Antecedentes familiares</small>${p.antecedente_familiar ? 'Cáncer de piel en la familia' : 'Ninguno registrado'}</div>
    <div><small>Alergias</small>${esc(p.alergias || 'Ninguna registrada')}</div>
    <div><small>Notas</small>${esc(p.notas || '—')}</div>
  </div>
  <h3>Últimas citas</h3>
  <ul class="mini">${p.citas.map((c) => `<li><span>${fmtFecha(c.fecha)}, ${fmtHora(c.hora)}. ${esc(c.motivo)}</span>${badge(c.estado, ESTADO_TIPO[c.estado])}</li>`).join('') || '<li class="muted">Sin citas registradas</li>'}</ul>
  ${clinico ? `<h3>Lesiones evaluadas</h3>
  <ul class="mini">${p.lesiones.map((l) => `<li><span>${ZONAS[l.zona] || esc(l.zona)} (${fmtFecha(l.creado_en)})</span>${badge(`${l.puntaje}/10 ${l.nivel}`, NIVEL_TIPO[l.nivel])}</li>`).join('') || '<li class="muted">Sin lesiones evaluadas</li>'}</ul>` : ''}
  <button type="button" class="btn primary" id="irSolar">${icon('sun', 16)} Calcular riesgo solar</button>`;

export async function render(cont, usuario) {
  const clinico = usuario.rol !== 'recepcion';
  cont.innerHTML = `
    <div class="barra">
      <div class="buscar">${icon('search')}<input id="q" type="search" placeholder="Buscar por nombre o cédula" aria-label="Buscar paciente"></div>
      <button class="btn primary" id="nuevo">${icon('plus', 16)} Nuevo paciente</button>
    </div>
    <div class="card tabla-wrap" id="tabla"></div>`;
  const tabla = $('#tabla', cont);
  let datos = [];

  async function cargar(q = '') {
    datos = await api.get('/pacientes?q=' + encodeURIComponent(q));
    tabla.innerHTML = datos.length ? `<table><thead><tr><th>Paciente</th><th>Cédula</th><th>Edad</th><th>Piel</th><th>Teléfono</th><th></th></tr></thead>
      <tbody>${datos.map((p) => `<tr>
        <td><div class="persona"><span class="avatar sm">${esc(p.nombre[0] + p.apellido[0])}</span><div><strong>${esc(p.nombre)} ${esc(p.apellido)}</strong><small>${esc(p.email || 'Sin correo')}</small></div></div></td>
        <td>${esc(p.cedula)}</td><td>${edad(p.fecha_nacimiento)} años</td>
        <td>${dotFototipo(p.fototipo)}Tipo ${ROMANO[p.fototipo]} ${p.antecedente_familiar ? badge('Antecedente familiar', 'warn') : ''}</td>
        <td>${esc(p.telefono || '—')}</td>
        <td class="acciones"><button class="btn ghost sm" data-ver="${p.id}">Ficha</button>
          <button class="btn ghost sm" data-edit="${p.id}" aria-label="Editar">${icon('edit', 16)}</button>
          ${usuario.rol === 'admin' ? `<button class="btn ghost sm danger-t" data-del="${p.id}" aria-label="Eliminar">${icon('trash', 16)}</button>` : ''}</td></tr>`).join('')}</tbody></table>`
      : '<p class="vacio">No se encontraron pacientes con esa búsqueda.</p>';
  }

  function editor(p) {
    modal({
      titulo: p ? 'Editar paciente' : 'Nuevo paciente', html: formulario(p), guardar: p ? 'Guardar cambios' : 'Registrar paciente',
      onSubmit: async (d, cerrar) => {
        if (p) await api.put('/pacientes/' + p.id, d); else await api.post('/pacientes', d);
        toast(p ? 'Paciente actualizado' : 'Paciente registrado');
        cerrar(); cargar($('#q', cont).value);
      },
    });
  }

  tabla.addEventListener('click', async (e) => {
    const b = e.target.closest('button'); if (!b) return;
    try {
      if (b.dataset.edit) editor(datos.find((p) => p.id == b.dataset.edit));
      if (b.dataset.ver) {
        const p = await api.get('/pacientes/' + b.dataset.ver);
        const m = modal({ titulo: `${p.nombre} ${p.apellido}`, html: ficha(p, clinico), ancho: 660 });
        $('#irSolar', m.el).addEventListener('click', () => { m.cerrar(); location.hash = `#/solar?paciente=${p.id}`; });
      }
      if (b.dataset.del && confirm('¿Eliminar este paciente junto con sus citas y lesiones? Esta acción no se puede deshacer.')) {
        await api.del('/pacientes/' + b.dataset.del);
        toast('Paciente eliminado'); cargar($('#q', cont).value);
      }
    } catch (err) { toast(err.message, 'error'); }
  });

  let espera;
  $('#q', cont).addEventListener('input', (e) => { clearTimeout(espera); espera = setTimeout(() => cargar(e.target.value), 250); });
  $('#nuevo', cont).addEventListener('click', () => editor());
  await cargar();
}
