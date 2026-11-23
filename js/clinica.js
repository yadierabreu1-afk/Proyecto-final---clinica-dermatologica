// Lógica clínica propia del proyecto: riesgo solar (Fitzpatrick) y puntaje ABCDE de lesiones.

export const ZONAS = ['cabeza', 'cuello', 'torso', 'brazo_der', 'brazo_izq', 'mano_der', 'mano_izq',
  'pierna_der', 'pierna_izq', 'pie_der', 'pie_izq'];

export const hoyISO = () => new Date().toLocaleDateString('en-CA'); // YYYY-MM-DD en hora local

// Por fototipo: puntos base de riesgo y dosis mínima de eritema (MED, J/m²) aproximada.
const FOTOTIPOS = {
  1: { base: 50, med: 200 }, 2: { base: 40, med: 250 }, 3: { base: 30, med: 350 },
  4: { base: 20, med: 450 }, 5: { base: 12, med: 600 }, 6: { base: 8, med: 1000 },
};

export function calcularRiesgoSolar({ fototipo, horas_sol, indice_uv, spf, quemaduras, antecedente_familiar }) {
  const f = FOTOTIPOS[fototipo];
  let puntos = f.base + Math.min(horas_sol, 10) * 2;
  puntos += indice_uv >= 11 ? 12 : indice_uv >= 8 ? 9 : indice_uv >= 6 ? 6 : indice_uv >= 3 ? 3 : 0;
  if (quemaduras) puntos += 10;
  if (antecedente_familiar) puntos += 10;
  if (spf >= 50) puntos -= 15; else if (spf >= 30) puntos -= 12; else if (spf >= 15) puntos -= 7;
  puntos = Math.max(0, Math.min(100, Math.round(puntos)));

  const nivel = puntos < 30 ? 'bajo' : puntos < 55 ? 'moderado' : puntos < 75 ? 'alto' : 'muy alto';

  // 1 punto de índice UV = 25 mW/m² → minutos hasta el eritema = MED / (UV × 1.5)
  const sin = indice_uv > 0 ? Math.round(f.med / (1.5 * indice_uv)) : null;
  const con = sin && spf > 0 ? Math.round(sin * spf * 0.5) : null; // 50 % de eficacia real

  const recs = [];
  if (indice_uv >= 6) recs.push('Evita la exposición directa entre las 10:00 a. m. y las 4:00 p. m.');
  recs.push(spf >= 30
    ? `Reaplica tu SPF ${spf} cada 2 horas, y después de nadar o sudar.`
    : 'Usa protector solar de amplio espectro SPF 30 o más y reaplícalo cada 2 horas.');
  if (fototipo <= 2) recs.push('Tu piel es muy sensible: usa gorra, lentes con filtro UV y ropa con protección UPF.');
  if (quemaduras) recs.push('Las quemaduras solares previas elevan el riesgo: agenda un chequeo dermatológico anual.');
  if (antecedente_familiar) recs.push('Con antecedentes familiares de cáncer de piel, revisa tus lunares una vez al mes.');
  if (horas_sol >= 4) recs.push('Busca sombra en pausas o reduce las horas de exposición continua.');

  return { puntos, nivel, minutos_sin_proteccion: sin, minutos_con_proteccion: con, recomendaciones: recs };
}

// Regla ABCDE: Asimetría, Bordes, Color, Diámetro, Evolución → puntaje de 0 a 10.
export function evaluarABCDE({ asimetria, bordes, colores, diametro_mm, evolucion }) {
  const C = colores >= 3 ? 2 : colores === 2 ? 1 : 0;
  const D = diametro_mm > 10 ? 2 : diametro_mm >= 6 ? 1 : 0;
  const E = evolucion ? 2 : 0;
  const puntaje = asimetria + bordes + C + D + E;

  let nivel = puntaje >= 6 ? 'alto' : puntaje >= 3 ? 'moderado' : 'bajo';
  if (evolucion && nivel === 'bajo') nivel = 'moderado'; // un cambio reciente nunca es "bajo"

  const info = {
    bajo: { dias: 365, mensaje: 'Probablemente benigna. Control anual y autoexamen mensual.' },
    moderado: { dias: 90, mensaje: 'Requiere vigilancia: dermatoscopía y control en 3 meses.' },
    alto: { dias: 15, mensaje: 'Alta sospecha: valorar biopsia y derivación prioritaria.' },
  }[nivel];

  return { puntaje, nivel, dias_seguimiento: info.dias, mensaje: info.mensaje,
    desglose: { A: asimetria, B: bordes, C, D, E } };
}

