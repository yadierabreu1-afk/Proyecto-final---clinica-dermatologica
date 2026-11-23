import { api } from '../api.js';
import { $, esc, ROMANO, FOTOTIPOS } from '../ui.js';

const COLOR = { bajo: 'var(--ok)', moderado: 'var(--warn)', alto: 'var(--danger)', 'muy alto': 'var(--danger)' };
const tiempo = (m) => (m == null ? 'No aplica' : m >= 90 ? `${(m / 60).toFixed(1)} horas` : `${m} min`);

export async function render(cont) {
  const pacientes = await api.get('/pacientes');
  const previo = new URLSearchParams(location.hash.split('?')[1] || '').get('paciente') || '';

  cont.innerHTML = `
  <div class="split">
    <form class="card" id="form">
      <h3>Calculadora de riesgo solar</h3>
      <p class="muted" style="margin-bottom:1.2rem">Combina el fototipo de piel, la exposición y la protección para estimar cuánto sol tolera una persona.</p>
      <div class="field"><label>Paciente (opcional)</label><select name="paciente_id"><option value="">Sin paciente</option>
        ${pacientes.map((p) => `<option value="${p.id}"${String(p.id) === previo ? ' selected' : ''}>${esc(p.nombre)} ${esc(p.apellido)}</option>`).join('')}</select></div>
      <div class="field"><label>Fototipo de piel</label>
        <div class="tipos" role="radiogroup">${[1, 2, 3, 4, 5, 6].map((n) => `<label class="tipo" title="${esc(FOTOTIPOS[n])}"><input type="radio" name="fototipo" value="${n}"${n === 3 ? ' checked' : ''}>
          <span style="--c:var(--f${n});--t:${n <= 3 ? '#2b1d12' : '#fff'}">${ROMANO[n]}</span></label>`).join('')}</div>
        <small id="tipoDesc"></small></div>
      <div class="field"><label>Horas de sol al día: <b id="vh">2</b></label><input type="range" name="horas_sol" min="0" max="10" step="0.5" value="2"></div>
      <div class="field"><label>Índice UV: <b id="vu">8</b></label><input type="range" name="indice_uv" min="0" max="12" step="1" value="8"></div>
      <div class="field"><label>Protector solar</label><select name="spf">
        <option value="0">No uso protector</option><option value="15">SPF 15</option><option value="30" selected>SPF 30</option><option value="50">SPF 50 o más</option></select></div>
      <label class="check"><input type="checkbox" name="quemaduras"> Ha tenido quemaduras solares graves</label>
      <label class="check"><input type="checkbox" name="antecedente_familiar"> Antecedentes familiares de cáncer de piel</label>
    </form>
    <div class="card resultado-solar" id="res"></div>
  </div>`;

  const f = $('#form', cont);
  const descripcion = () => { $('#tipoDesc', cont).textContent = FOTOTIPOS[f.fototipo.value]; };

  // Si se elige un paciente, toma su fototipo y sus antecedentes
  function usarPaciente() {
    const p = pacientes.find((x) => String(x.id) === f.paciente_id.value);
    if (!p) return;
    f.fototipo.value = String(p.fototipo);
    f.antecedente_familiar.checked = !!p.antecedente_familiar;
  }

  async function calcular() {
    $('#vh', cont).textContent = `${f.horas_sol.value} h`;
    $('#vu', cont).textContent = f.indice_uv.value;
    descripcion();
    try {
      const r = await api.post('/riesgo-solar', {
        fototipo: f.fototipo.value, horas_sol: f.horas_sol.value, indice_uv: f.indice_uv.value, spf: f.spf.value,
        quemaduras: f.quemaduras.checked, antecedente_familiar: f.antecedente_familiar.checked,
      });
      $('#res', cont).innerHTML = `
        <div class="gauge" style="--v:${r.puntos};--c:${COLOR[r.nivel]}"><div class="in"><b>${r.puntos}</b><small>de 100</small></div></div>
        <h3>Riesgo ${r.nivel}</h3>
        <div class="tiempos">
          <div><small>Tiempo hasta enrojecer sin protector</small><b>${tiempo(r.minutos_sin_proteccion)}</b></div>
          <div><small>Tiempo estimado con protector</small><b>${tiempo(r.minutos_con_proteccion)}</b></div>
        </div>
        <ul class="recs">${r.recomendaciones.map((x) => `<li>${esc(x)}</li>`).join('')}</ul>`;
    } catch (e) { $('#res', cont).innerHTML = `<p class="error">${esc(e.message)}</p>`; }
  }

  f.addEventListener('input', calcular);
  f.paciente_id.addEventListener('change', () => { usarPaciente(); calcular(); });
  usarPaciente();
  await calcular();
}
