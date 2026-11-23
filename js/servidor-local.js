// Servidor simulado que corre dentro del navegador. Reemplaza a Express + MySQL + JWT para que
// el proyecto funcione como sitio estático (GitHub Pages). Mantiene las mismas rutas, validaciones,
// permisos por rol y formas de respuesta que tenía la API original, así las vistas no cambian.
// Los datos viven en localStorage: cada visitante tiene su propia copia, que nadie más ve.
import { ZONAS, hoyISO, calcularRiesgoSolar, evaluarABCDE } from './clinica.js';

const CLAVE_BD = 'derma_bd_v1';
const HORAS_SESION = 8;

const err = (status, mensaje) => Object.assign(new Error(mensaje), { status });

// ---------- Almacenamiento ----------
let bd = null;
const leerAlmacen = () => { try { return localStorage.getItem(CLAVE_BD); } catch { return null; } };
const guardar = () => { try { localStorage.setItem(CLAVE_BD, JSON.stringify(bd)); } catch { /* sin almacenamiento: queda en memoria */ } };

// Para restablecer los datos de demostración: abrir login.html?reset=1
if (new URLSearchParams(location.search).has('reset')) {
  try { localStorage.removeItem(CLAVE_BD); } catch { /* nada */ }
}

// ---------- Utilidades de fecha ----------
const diaISO = (n = 0) => { const f = new Date(); f.setDate(f.getDate() + n); return f.toLocaleDateString('en-CA'); };
const ahoraSQL = () => `${hoyISO()} ${new Date().toLocaleTimeString('en-GB')}`;
const aUTC = (iso) => { const [y, m, d] = iso.slice(0, 10).split('-').map(Number); return Date.UTC(y, m - 1, d); };
const diasEntre = (a, b) => Math.round((aUTC(a) - aUTC(b)) / 864e5);
const sumarDias = (iso, n) => new Date(aUTC(iso) + n * 864e5).toISOString().slice(0, 10);

async function hash(txt) {
  if (globalThis.crypto?.subtle) {
    const b = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(txt));
    return [...new Uint8Array(b)].map((x) => x.toString(16).padStart(2, '0')).join('');
  }
  return 'plano:' + txt;
}

// ---------- Datos de demostración (equivalente a database/seed.js) ----------
async function sembrar() {
  const usuarios = [
    ['Administrador General', 'admin@clinica.com', 'Admin123*', 'admin'],
    ['Dra. Laura Martínez', 'dra.martinez@clinica.com', 'Derma123*', 'dermatologo'],
    ['Dr. Carlos Pérez', 'dr.perez@clinica.com', 'Derma123*', 'dermatologo'],
    ['Rosa Jiménez', 'recepcion@clinica.com', 'Recep123*', 'recepcion'],
  ];
  const datos = { base: hoyISO(), seq: {}, usuarios: [], pacientes: [], citas: [], lesiones: [] };
  for (const [i, [nombre, email, pass, rol]] of usuarios.entries()) {
    datos.usuarios.push({ id: i + 1, nombre, email, password_hash: await hash(pass), rol, activo: 1 });
  }

  const pacientes = [
    ['001-1234567-8', 'María', 'Gómez', '1991-04-12', 'F', '809-555-0101', 'maria.gomez@mail.com', 2, 1, 'Ninguna conocida', 'Acné adulto persistente'],
    ['001-2345678-9', 'José', 'Ramírez', '1978-09-30', 'M', '829-555-0102', 'jose.ramirez@mail.com', 3, 0, 'Penicilina', 'Revisión de lunares en espalda'],
    ['031-3456789-0', 'Ana', 'Peña', '2001-01-22', 'F', '849-555-0103', 'ana.pena@mail.com', 4, 0, null, 'Dermatitis atópica'],
    ['402-4567890-1', 'Luis', 'Almonte', '1965-06-05', 'M', '809-555-0104', null, 1, 1, 'Látex', 'Piel muy clara, mucha exposición solar laboral'],
    ['001-5678901-2', 'Carmen', 'Santos', '1988-11-17', 'F', '829-555-0105', 'carmen.santos@mail.com', 5, 0, null, 'Manchas por melasma'],
  ];
  pacientes.forEach((p, i) => datos.pacientes.push({
    id: i + 1, cedula: p[0], nombre: p[1], apellido: p[2], fecha_nacimiento: p[3], sexo: p[4], telefono: p[5], email: p[6],
    fototipo: p[7], antecedente_familiar: p[8], alergias: p[9], notas: p[10], creado_en: `${diaISO(-30)} 09:00:00`,
  }));

  const d1 = 2, d2 = 3, P = [1, 2, 3, 4, 5];
  [
    [P[0], d1, diaISO(0), '09:00:00', 30, 'Control de acné', 'confirmada'],
    [P[1], d1, diaISO(0), '10:30:00', 30, 'Revisión de lunares', 'programada'],
    [P[2], d2, diaISO(0), '14:00:00', 60, 'Dermatitis atópica', 'programada'],
    [P[3], d2, diaISO(1), '09:30:00', 30, 'Chequeo anual de piel', 'programada'],
    [P[4], d1, diaISO(2), '11:00:00', 30, 'Consulta por manchas', 'programada'],
    [P[1], d1, diaISO(3), '15:00:00', 30, 'Seguimiento de lesión', 'programada'],
    [P[0], d1, diaISO(-7), '09:00:00', 30, 'Primera consulta', 'atendida'],
  ].forEach((c, i) => datos.citas.push({
    id: i + 1, paciente_id: c[0], dermatologo_id: c[1], fecha: c[2], hora: c[3], duracion_min: c[4], motivo: c[5], estado: c[6], demo: true,
  }));

  // [paciente, zona, descripción, A, B, colores, diámetro, evolución, hace cuántos días se registró]
  [
    [P[1], 'torso', 'Lunar oscuro en la espalda alta', 2, 2, 3, 9, 1, 10],
    [P[3], 'brazo_der', 'Mancha rugosa en el antebrazo', 1, 1, 2, 7, 0, 100],
    [P[0], 'cabeza', 'Nevus pequeño en la sien', 0, 0, 1, 3, 0, 30],
    [P[3], 'cuello', 'Lesión pigmentada de bordes irregulares', 1, 2, 2, 11, 1, 5],
    [P[4], 'mano_izq', 'Peca estable en el dorso de la mano', 0, 0, 1, 2, 0, 60],
  ].forEach(([pac, zona, desc, A, B, C, D, E, hace], i) => {
    const ev = evaluarABCDE({ asimetria: A, bordes: B, colores: C, diametro_mm: D, evolucion: E });
    datos.lesiones.push({
      id: i + 1, paciente_id: pac, zona, descripcion: desc, asimetria: A, bordes: B, colores: C, diametro_mm: D, evolucion: E,
      puntaje: ev.puntaje, nivel: ev.nivel, seguimiento_fecha: diaISO(-hace + ev.dias_seguimiento), registrada_por: d1,
      creado_en: `${diaISO(-hace)} 10:00:00`, demo: true,
    });
  });
  return datos;
}

// Las citas y lesiones de demostración se corren con el calendario para que "hoy" siempre tenga datos.
function ajustarFechas() {
  const dif = diasEntre(hoyISO(), bd.base);
  if (!dif) return;
  bd.citas.filter((c) => c.demo).forEach((c) => { c.fecha = sumarDias(c.fecha, dif); });
  bd.lesiones.filter((l) => l.demo).forEach((l) => {
    l.seguimiento_fecha = sumarDias(l.seguimiento_fecha, dif);
    l.creado_en = sumarDias(l.creado_en, dif) + l.creado_en.slice(10);
  });
  bd.base = hoyISO();
  guardar();
}

async function iniciar() {
  const crudo = leerAlmacen();
  if (crudo) { try { bd = JSON.parse(crudo); } catch { bd = null; } }
  if (!bd || !bd.usuarios) { bd = await sembrar(); guardar(); }
  ajustarFechas();
}
const listo = iniciar();

const siguienteId = (lista) => lista.reduce((m, x) => Math.max(m, x.id), 0) + 1;
const nombreCompleto = (p) => `${p.nombre} ${p.apellido}`;
const porId = (lista, id) => lista.find((x) => x.id === Number(id));

// ---------- Sesión (equivalente al JWT; sin firma real, solo para la demostración) ----------
const firmarToken = (u) => btoa(JSON.stringify({ id: u.id, rol: u.rol, exp: Date.now() + HORAS_SESION * 36e5 }));

function verificarToken(token) {
  if (!token) throw err(401, 'Debes iniciar sesión');
  try {
    const p = JSON.parse(atob(token));
    if (!p.exp || p.exp < Date.now() || !porId(bd.usuarios, p.id)) throw new Error('vencido');
    return p;
  } catch {
    throw err(401, 'Tu sesión expiró. Inicia sesión de nuevo');
  }
}

// Límite de intentos de login: 10 cada 15 minutos.
const intentos = { n: 0, desde: Date.now() };
function limitarLogin() {
  const ahora = Date.now();
  if (ahora - intentos.desde > 15 * 60 * 1000) { intentos.n = 0; intentos.desde = ahora; }
  if (intentos.n >= 10) throw err(429, 'Demasiados intentos. Espera 15 minutos e inténtalo de nuevo');
  intentos.n++;
}

// ---------- Agenda ----------
const INICIO = 8 * 60, FIN = 17 * 60, ALMUERZO = [12 * 60, 13 * 60], PASO = 30;
const aMin = (h) => { const [H, M] = h.split(':').map(Number); return H * 60 + M; };
const aHora = (m) => `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
const enAlmuerzo = (ini, fin) => ini < ALMUERZO[1] && fin > ALMUERZO[0];
const choca = (ini, fin, ocupados) => ocupados.some((o) => ini < o.fin && fin > o.ini);
const ocupadosDe = (dermatologoId, fecha) => bd.citas
  .filter((c) => c.dermatologo_id === Number(dermatologoId) && c.fecha === fecha && c.estado !== 'cancelada')
  .map((c) => ({ ini: aMin(c.hora), fin: aMin(c.hora) + c.duracion_min }));

// ---------- Controladores ----------
const auth = {
  async login({ body }) {
    limitarLogin();
    const email = String(body.email || '').trim().toLowerCase();
    const password = String(body.password || '');
    if (!email || !password) throw err(400, 'Ingresa tu correo y tu contraseña');
    const u = bd.usuarios.find((x) => x.email === email && x.activo);
    if (!u || u.password_hash !== await hash(password)) throw err(401, 'Correo o contraseña incorrectos');
    return { token: firmarToken(u), usuario: { id: u.id, nombre: u.nombre, email: u.email, rol: u.rol } };
  },
  perfil({ usuario }) {
    const u = porId(bd.usuarios, usuario.id);
    if (!u || !u.activo) throw err(401, 'Usuario no encontrado');
    return { id: u.id, nombre: u.nombre, email: u.email, rol: u.rol };
  },
};

function validarPaciente(b) {
  const e = [];
  if (!/^[\d-]{9,13}$/.test(b.cedula || '')) e.push('La cédula debe tener entre 9 y 13 dígitos');
  if (!b.nombre?.trim()) e.push('El nombre es obligatorio');
  if (!b.apellido?.trim()) e.push('El apellido es obligatorio');
  if (!b.fecha_nacimiento) e.push('La fecha de nacimiento es obligatoria');
  if (!Number.isInteger(Number(b.fototipo)) || b.fototipo < 1 || b.fototipo > 6) e.push('El fototipo debe estar entre I y VI');
  if (b.email && !/^\S+@\S+\.\S+$/.test(b.email)) e.push('El correo no es válido');
  if (e.length) throw err(400, e.join('. '));
}
const camposPaciente = (b) => ({
  cedula: b.cedula.trim(), nombre: b.nombre.trim(), apellido: b.apellido.trim(), fecha_nacimiento: b.fecha_nacimiento,
  sexo: ['M', 'F', 'O'].includes(b.sexo) ? b.sexo : 'O', telefono: b.telefono || null, email: b.email || null,
  fototipo: Number(b.fototipo), antecedente_familiar: b.antecedente_familiar ? 1 : 0, alergias: b.alergias || null, notas: b.notas || null,
});
const errDuplicado = () => err(409, 'Ya existe un registro con esos datos (cédula o correo duplicado)');
const esClinico = (u) => ['admin', 'dermatologo'].includes(u.rol);

const pacientes = {
  listar({ query }) {
    const q = String(query.q || '').toLowerCase();
    return bd.pacientes
      .filter((p) => nombreCompleto(p).toLowerCase().includes(q) || p.cedula.toLowerCase().includes(q))
      .sort((a, b) => a.apellido.localeCompare(b.apellido, 'es') || a.nombre.localeCompare(b.nombre, 'es'))
      .slice(0, 200);
  },
  obtener({ params, usuario }) {
    const p = porId(bd.pacientes, params.id);
    if (!p) throw err(404, 'Paciente no encontrado');
    const citas = bd.citas.filter((c) => c.paciente_id === p.id)
      .sort((a, b) => b.fecha.localeCompare(a.fecha) || b.hora.localeCompare(a.hora)).slice(0, 8)
      .map((c) => ({ id: c.id, fecha: c.fecha, hora: c.hora, motivo: c.motivo, estado: c.estado, dermatologo: porId(bd.usuarios, c.dermatologo_id)?.nombre }));
    const lesiones = esClinico(usuario)
      ? bd.lesiones.filter((l) => l.paciente_id === p.id).sort((a, b) => b.creado_en.localeCompare(a.creado_en)).slice(0, 8)
        .map((l) => ({ id: l.id, zona: l.zona, puntaje: l.puntaje, nivel: l.nivel, creado_en: l.creado_en }))
      : [];
    return { ...p, citas, lesiones };
  },
  crear({ body }) {
    validarPaciente(body);
    const d = camposPaciente(body);
    if (bd.pacientes.some((p) => p.cedula === d.cedula)) throw errDuplicado();
    const p = { id: siguienteId(bd.pacientes), ...d, creado_en: ahoraSQL() };
    bd.pacientes.push(p); guardar();
    return { id: p.id, mensaje: 'Paciente registrado' };
  },
  actualizar({ params, body }) {
    validarPaciente(body);
    const p = porId(bd.pacientes, params.id);
    if (!p) throw err(404, 'Paciente no encontrado');
    const d = camposPaciente(body);
    if (bd.pacientes.some((o) => o.id !== p.id && o.cedula === d.cedula)) throw errDuplicado();
    Object.assign(p, d); guardar();
    return { mensaje: 'Paciente actualizado' };
  },
  eliminar({ params }) {
    const p = porId(bd.pacientes, params.id);
    if (!p) throw err(404, 'Paciente no encontrado');
    bd.pacientes = bd.pacientes.filter((x) => x.id !== p.id);
    bd.citas = bd.citas.filter((c) => c.paciente_id !== p.id);       // ON DELETE CASCADE
    bd.lesiones = bd.lesiones.filter((l) => l.paciente_id !== p.id);
    guardar();
    return { mensaje: 'Paciente eliminado' };
  },
};

const citas = {
  dermatologos() {
    return bd.usuarios.filter((u) => u.rol === 'dermatologo' && u.activo)
      .sort((a, b) => a.nombre.localeCompare(b.nombre, 'es')).map((u) => ({ id: u.id, nombre: u.nombre }));
  },
  disponibilidad({ query }) {
    const { fecha, dermatologo_id } = query;
    const duracion = Number(query.duracion) || 30;
    if (!fecha || !dermatologo_id) throw err(400, 'Indica la fecha y el dermatólogo');
    const ocup = ocupadosDe(dermatologo_id, fecha);
    const ahora = new Date();
    const minutosAhora = ahora.getHours() * 60 + ahora.getMinutes();
    const esHoy = fecha === hoyISO();
    const libres = [];
    for (let m = INICIO; m + duracion <= FIN; m += PASO) {
      if (enAlmuerzo(m, m + duracion) || choca(m, m + duracion, ocup) || (esHoy && m <= minutosAhora)) continue;
      libres.push(aHora(m));
    }
    return { fecha, duracion, libres };
  },
  listar({ query }) {
    const { fecha, dermatologo_id } = query;
    return bd.citas
      .filter((c) => (!fecha || c.fecha === fecha) && (!dermatologo_id || c.dermatologo_id === Number(dermatologo_id)))
      .sort((a, b) => a.fecha.localeCompare(b.fecha) || a.hora.localeCompare(b.hora))
      .map((c) => {
        const p = porId(bd.pacientes, c.paciente_id);
        return { id: c.id, fecha: c.fecha, hora: c.hora, duracion_min: c.duracion_min, motivo: c.motivo, estado: c.estado,
          paciente_id: c.paciente_id, paciente: nombreCompleto(p), fototipo: p.fototipo, dermatologo: porId(bd.usuarios, c.dermatologo_id).nombre };
      });
  },
  crear({ body }) {
    const { paciente_id, dermatologo_id, fecha, hora, motivo } = body;
    const duracion = Number(body.duracion_min) || 30;
    if (!paciente_id || !dermatologo_id || !fecha || !hora || !motivo?.trim()) throw err(400, 'Completa paciente, dermatólogo, fecha, horario y motivo');
    if (fecha < hoyISO()) throw err(400, 'No se puede agendar una cita en una fecha pasada');
    const ini = aMin(hora), fin = ini + duracion;
    if (ini < INICIO || fin > FIN || enAlmuerzo(ini, fin)) {
      throw err(400, 'Horario fuera de atención (8:00 a. m. a 5:00 p. m., almuerzo de 12:00 a 1:00 p. m.)');
    }
    if (choca(ini, fin, ocupadosDe(dermatologo_id, fecha))) throw err(409, 'El dermatólogo ya tiene una cita en ese horario');
    if (!porId(bd.pacientes, paciente_id) || !porId(bd.usuarios, dermatologo_id)) throw err(400, 'El paciente o dermatólogo indicado no existe');
    const c = { id: siguienteId(bd.citas), paciente_id: Number(paciente_id), dermatologo_id: Number(dermatologo_id), fecha,
      hora: `${aHora(ini)}:00`, duracion_min: duracion, motivo: motivo.trim(), estado: 'programada' };
    bd.citas.push(c); guardar();
    return { id: c.id, mensaje: 'Cita agendada' };
  },
  cambiarEstado({ params, body }) {
    if (!['programada', 'confirmada', 'atendida', 'cancelada'].includes(body.estado)) throw err(400, 'Estado no válido');
    const c = porId(bd.citas, params.id);
    if (!c) throw err(404, 'Cita no encontrada');
    c.estado = body.estado; guardar();
    return { mensaje: 'Estado actualizado' };
  },
};

function leerCriterios(b) {
  const d = { asimetria: Number(b.asimetria), bordes: Number(b.bordes), colores: Number(b.colores),
    diametro_mm: Number(b.diametro_mm), evolucion: b.evolucion ? 1 : 0 };
  if (![0, 1, 2].includes(d.asimetria) || ![0, 1, 2].includes(d.bordes)) throw err(400, 'Asimetría y bordes deben valer 0, 1 o 2');
  if (!(d.colores >= 1 && d.colores <= 6)) throw err(400, 'El número de colores debe estar entre 1 y 6');
  if (!(d.diametro_mm > 0 && d.diametro_mm <= 100)) throw err(400, 'El diámetro debe estar entre 0.1 y 100 mm');
  return d;
}

const lesiones = {
  evaluar: ({ body }) => evaluarABCDE(leerCriterios(body)),
  listar({ query }) {
    const { nivel, paciente_id } = query;
    return bd.lesiones
      .filter((l) => (!['bajo', 'moderado', 'alto'].includes(nivel) || l.nivel === nivel) && (!paciente_id || l.paciente_id === Number(paciente_id)))
      .sort((a, b) => b.creado_en.localeCompare(a.creado_en) || b.id - a.id).slice(0, 100)
      .map((l) => ({ id: l.id, zona: l.zona, descripcion: l.descripcion, diametro_mm: Number(l.diametro_mm).toFixed(1), puntaje: l.puntaje,
        nivel: l.nivel, seguimiento_fecha: l.seguimiento_fecha, creado_en: l.creado_en, paciente_id: l.paciente_id,
        paciente: nombreCompleto(porId(bd.pacientes, l.paciente_id)), registrada_por: porId(bd.usuarios, l.registrada_por)?.nombre ?? null }));
  },
  crear({ body, usuario }) {
    const { paciente_id, zona, descripcion } = body;
    if (!paciente_id || !ZONAS.includes(zona)) throw err(400, 'Selecciona el paciente y la zona del cuerpo');
    const d = leerCriterios(body);
    const ev = evaluarABCDE(d);
    if (!porId(bd.pacientes, paciente_id)) throw err(400, 'El paciente o dermatólogo indicado no existe');
    const l = { id: siguienteId(bd.lesiones), paciente_id: Number(paciente_id), zona, descripcion: descripcion || null, ...d,
      puntaje: ev.puntaje, nivel: ev.nivel, seguimiento_fecha: diaISO(ev.dias_seguimiento), registrada_por: usuario.id, creado_en: ahoraSQL() };
    bd.lesiones.push(l); guardar();
    return { id: l.id, ...ev };
  },
  eliminar({ params }) {
    const l = porId(bd.lesiones, params.id);
    if (!l) throw err(404, 'Evaluación no encontrada');
    bd.lesiones = bd.lesiones.filter((x) => x.id !== l.id); guardar();
    return { mensaje: 'Evaluación eliminada' };
  },
};

const dashboard = {
  resumen({ usuario }) {
    const hoy = hoyISO();
    const activas = bd.citas.filter((c) => c.estado !== 'cancelada');
    const totales = {
      pacientes: bd.pacientes.length,
      citas_hoy: activas.filter((c) => c.fecha === hoy).length,
      citas_pendientes: bd.citas.filter((c) => c.fecha >= hoy && ['programada', 'confirmada'].includes(c.estado)).length,
      lesiones_altas: bd.lesiones.filter((l) => l.nivel === 'alto').length,
    };
    const limite = sumarDias(hoy, 6);
    const porFecha = {};
    activas.filter((c) => c.fecha >= hoy && c.fecha <= limite).forEach((c) => { porFecha[c.fecha] = (porFecha[c.fecha] || 0) + 1; });
    const semana = Object.entries(porFecha).sort(([a], [b]) => a.localeCompare(b)).map(([fecha, total]) => ({ fecha, total }));

    const porZona = {};
    bd.lesiones.forEach((l) => {
      const z = porZona[l.zona] ||= { zona: l.zona, total: 0, altas: 0 };
      z.total++; if (l.nivel === 'alto') z.altas++;
    });
    const seguimientos = bd.lesiones.filter((l) => l.seguimiento_fecha <= sumarDias(hoy, 14))
      .sort((a, b) => a.seguimiento_fecha.localeCompare(b.seguimiento_fecha)).slice(0, 6)
      .map((l) => ({ id: l.id, zona: l.zona, nivel: l.nivel, seguimiento_fecha: l.seguimiento_fecha,
        dias: diasEntre(l.seguimiento_fecha, hoy), paciente: nombreCompleto(porId(bd.pacientes, l.paciente_id)) }));
    const deHoy = activas.filter((c) => c.fecha === hoy).sort((a, b) => a.hora.localeCompare(b.hora)).slice(0, 8)
      .map((c) => ({ id: c.id, hora: c.hora, motivo: c.motivo, estado: c.estado,
        paciente: nombreCompleto(porId(bd.pacientes, c.paciente_id)), dermatologo: porId(bd.usuarios, c.dermatologo_id).nombre }));

    const clinico = esClinico(usuario); // Recepción no ve datos clínicos de lesiones
    return { totales, semana, zonas: clinico ? Object.values(porZona) : [], seguimientos: clinico ? seguimientos : [], hoy: deHoy };
  },
};

const riesgoSolar = {
  calcular({ body }) {
    const b = { fototipo: Number(body.fototipo), horas_sol: Number(body.horas_sol), indice_uv: Number(body.indice_uv),
      spf: Number(body.spf) || 0, quemaduras: !!body.quemaduras, antecedente_familiar: !!body.antecedente_familiar };
    if (!Number.isInteger(b.fototipo) || b.fototipo < 1 || b.fototipo > 6) throw err(400, 'El fototipo debe estar entre I y VI');
    if (!(b.horas_sol >= 0 && b.horas_sol <= 24)) throw err(400, 'Las horas de sol deben estar entre 0 y 24');
    if (!(b.indice_uv >= 0 && b.indice_uv <= 15)) throw err(400, 'El índice UV debe estar entre 0 y 15');
    return calcularRiesgoSolar(b);
  },
};

// ---------- Tabla de rutas (igual a backend/routes) ----------
const CLINICO = ['admin', 'dermatologo'];
const rutas = [];
const ruta = (metodo, patron, fn, { sesion = true, roles } = {}) => rutas.push({
  metodo, fn, sesion, roles, re: new RegExp('^' + patron.replace(/:(\w+)/g, '(?<$1>[^/]+)') + '/?$'),
});

ruta('POST', '/auth/login', auth.login, { sesion: false });
ruta('GET', '/auth/perfil', auth.perfil);
ruta('GET', '/dashboard', dashboard.resumen);
ruta('GET', '/pacientes', pacientes.listar);
ruta('GET', '/pacientes/:id', pacientes.obtener);
ruta('POST', '/pacientes', pacientes.crear);
ruta('PUT', '/pacientes/:id', pacientes.actualizar);
ruta('DELETE', '/pacientes/:id', pacientes.eliminar, { roles: ['admin'] });
ruta('GET', '/citas/dermatologos', citas.dermatologos);
ruta('GET', '/citas/disponibilidad', citas.disponibilidad);
ruta('GET', '/citas', citas.listar);
ruta('POST', '/citas', citas.crear);
ruta('PATCH', '/citas/:id/estado', citas.cambiarEstado);
ruta('POST', '/lesiones/evaluar', lesiones.evaluar, { roles: CLINICO });
ruta('GET', '/lesiones', lesiones.listar, { roles: CLINICO });
ruta('POST', '/lesiones', lesiones.crear, { roles: CLINICO });
ruta('DELETE', '/lesiones/:id', lesiones.eliminar, { roles: CLINICO });
ruta('POST', '/riesgo-solar', riesgoSolar.calcular);

const clonar = (x) => (x === undefined ? undefined : JSON.parse(JSON.stringify(x)));

// Punto de entrada: misma firma conceptual que una petición HTTP.
export async function solicitar(metodo, url, cuerpo, token) {
  await listo;
  await new Promise((r) => setTimeout(r, 40)); // pequeña pausa para que se sienta como una petición real
  const u = new URL(url, 'http://local');
  for (const r of rutas) {
    const m = r.metodo === metodo && r.re.exec(u.pathname);
    if (!m) continue;
    const usuario = r.sesion ? verificarToken(token) : null;
    if (r.roles && !r.roles.includes(usuario.rol)) throw err(403, 'No tienes permiso para realizar esta acción');
    return clonar(await r.fn({ params: m.groups || {}, query: Object.fromEntries(u.searchParams), body: clonar(cuerpo) || {}, usuario }));
  }
  throw err(404, 'Ruta no encontrada');
}
