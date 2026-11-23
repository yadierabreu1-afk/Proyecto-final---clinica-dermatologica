import { api } from '../api.js';
import { $, $$, esc, icon, toast, badge, fmtFecha, NIVEL_TIPO } from '../ui.js';
import { ZONAS, mapaCorporal } from '../zonas.js';

export async function render(cont) {
  const pacientes = await api.get('/pacientes');

  cont.innerHTML = `
  <div class="split">
    <form class="card" id="form">
      <h3>Nueva evaluación</h3>
      <div class="field"><label>Paciente</label><select name="paciente_id" required><option value="">Selecciona un paciente</option>
        ${pacientes.map((p) => `<option value="${p.id}">${esc(p.nombre)} ${esc(p.apellido)}</option>`).join('')}</select></div>
      <div class="field"><label>Zona del cuerpo: <span id="zonaTxt" class="muted">toca el mapa para elegir</span></label>
        <div class="mapa-wrap">${mapaCorporal({ pick: true })}</div><input type="hidden" name="zona"></div>
      <div class="abcde">
        <div class="field"><label>A. Asimetría</label><select name="asimetria">
          <option value="0">Simétrica</option><option value="1">Ligeramente asimétrica</option><option value="2">Marcadamente asimétrica</option></select></div>
        <div class="field"><label>B. Bordes</label><select name="bordes">
          <option value="0">Regulares y definidos</option><option value="1">Algo irregulares</option><option value="2">Muy irregulares o difusos</option></select></div>
        <div class="row">
          <div class="field"><label>C. Colores distintos</label><input type="number" name="colores" min="1" max="6" value="1"></div>
          <div class="field"><label>D. Diámetro (mm)</label><input type="number" name="diametro_mm" min="0.5" max="100" step="0.5" value="4"></div>
        </div>
        <label class="check"><input type="checkbox" name="evolucion"> E. Ha cambiado de tamaño, forma o color</label>
      </div>
      <div class="field"><label>Descripción clínica</label><textarea name="descripcion" placeholder="Ejemplo: lunar oscuro en la espalda alta"></textarea></div>
      <div id="res"></div>
      <button class="btn primary block">Guardar evaluación</button>
    </form>

    <div class="card">
      <div class="barra" style="margin-bottom:.5rem"><h3 style="margin:0">Historial de evaluaciones</h3>
        <select id="fnivel" aria-label="Filtrar por nivel" style="width:auto">
          <option value="">Todos los niveles</option><option value="alto">Riesgo alto</option><option value="moderado">Riesgo moderado</option><option value="bajo">Riesgo bajo</option></select></div>
      <div class="tabla-wrap" id="lista"></div>
    </div>
  </div>`;

  const form = $('#form', cont);
  const svg = $('.mapa', cont);

  // Elegir zona en el mapa
  svg.addEventListener('click', (e) => {
    const g = e.target.closest('.zona'); if (!g) return;
    $$('.zona', svg).forEach((z) => z.classList.remove('sel'));
    g.classList.add('sel');
    form.zona.value = g.dataset.zona;
    $('#zonaTxt', cont).textContent = ZONAS[g.dataset.zona];
  });

  const criterios = () => ({
    asimetria: form.asimetria.value, bordes: form.bordes.value, colores: form.colores.value,
    diametro_mm: form.diametro_mm.value, evolucion: form.evolucion.checked,
  });

  // Puntaje en vivo: lo calcula el servidor con la misma regla que usa al guardar
  async function evaluar() {
    const caja = $('#res', cont);
    try {
      const r = await api.post('/lesiones/evaluar', criterios());
      const tipo = NIVEL_TIPO[r.nivel];
      caja.innerHTML = `<div class="semaforo ${tipo}">
        <div class="luces"><i class="${r.nivel === 'bajo' ? 'on' : ''}"></i><i class="${r.nivel === 'moderado' ? 'on' : ''}"></i><i class="${r.nivel === 'alto' ? 'on' : ''}"></i></div>
        <div><strong>${r.puntaje} de 10. Riesgo ${r.nivel}</strong><p>${esc(r.mensaje)}</p>
          <div class="chips">${Object.entries(r.desglose).map(([k, v]) => `<span>${k}<b>${v}</b></span>`).join('')}</div>
          <small>Control sugerido en ${r.dias_seguimiento} días. Herramienta de apoyo: no reemplaza el diagnóstico médico.</small></div></div>`;
    } catch (e) { caja.innerHTML = `<p class="error">${esc(e.message)}</p>`; }
  }
  let t;
  form.addEventListener('input', () => { clearTimeout(t); t = setTimeout(evaluar, 200); });

  async function cargarLista() {
    const nivel = $('#fnivel', cont).value;
    const filas = await api.get('/lesiones' + (nivel ? `?nivel=${nivel}` : ''));
    $('#lista', cont).innerHTML = filas.length ? `<table><thead><tr><th>Paciente</th><th>Zona</th><th>Resultado</th><th>Control</th><th></th></tr></thead><tbody>
      ${filas.map((l) => `<tr><td><strong>${esc(l.paciente)}</strong><small style="display:block">${fmtFecha(l.creado_en)}, ${Number(l.diametro_mm)} mm</small></td>
        <td>${ZONAS[l.zona] || esc(l.zona)}</td><td>${badge(`${l.puntaje}/10 ${l.nivel}`, NIVEL_TIPO[l.nivel])}</td>
        <td>${fmtFecha(l.seguimiento_fecha)}</td>
        <td class="acciones"><button class="btn ghost sm danger-t" data-del="${l.id}" aria-label="Eliminar evaluación">${icon('trash', 16)}</button></td></tr>`).join('')}</tbody></table>`
      : '<p class="vacio">Todavía no hay evaluaciones con ese filtro.</p>';
  }

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!form.zona.value) return toast('Elige la zona del cuerpo en el mapa', 'error');
    try {
      await api.post('/lesiones', { paciente_id: form.paciente_id.value, zona: form.zona.value, descripcion: form.descripcion.value, ...criterios() });
      toast('Evaluación guardada');
      form.reset(); form.zona.value = '';
      $$('.zona', svg).forEach((z) => z.classList.remove('sel'));
      $('#zonaTxt', cont).textContent = 'toca el mapa para elegir';
      evaluar(); cargarLista();
    } catch (err) { toast(err.message, 'error'); }
  });

  $('#fnivel', cont).addEventListener('change', cargarLista);
  $('#lista', cont).addEventListener('click', async (e) => {
    const b = e.target.closest('[data-del]');
    if (!b || !confirm('¿Eliminar esta evaluación?')) return;
    try { await api.del('/lesiones/' + b.dataset.del); toast('Evaluación eliminada'); cargarLista(); }
    catch (err) { toast(err.message, 'error'); }
  });

  evaluar();
  await cargarLista();
}
