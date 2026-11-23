// Mapa corporal SVG (vista frontal). "der" es el lado derecho del paciente, a la izquierda de la imagen.
export const ZONAS = {
  cabeza: 'Cabeza y rostro', cuello: 'Cuello', torso: 'Tronco',
  brazo_der: 'Brazo derecho', brazo_izq: 'Brazo izquierdo', mano_der: 'Mano derecha', mano_izq: 'Mano izquierda',
  pierna_der: 'Pierna derecha', pierna_izq: 'Pierna izquierda', pie_der: 'Pie derecho', pie_izq: 'Pie izquierdo',
};

const FORMAS = {
  cabeza: '<circle cx="100" cy="34" r="26"/>',
  cuello: '<rect x="90" y="58" width="20" height="16" rx="6"/>',
  torso: '<rect x="62" y="74" width="76" height="120" rx="24"/>',
  brazo_der: '<rect x="30" y="78" width="26" height="112" rx="13"/>',
  brazo_izq: '<rect x="144" y="78" width="26" height="112" rx="13"/>',
  mano_der: '<ellipse cx="43" cy="204" rx="13" ry="14"/>',
  mano_izq: '<ellipse cx="157" cy="204" rx="13" ry="14"/>',
  pierna_der: '<rect x="66" y="200" width="30" height="170" rx="15"/>',
  pierna_izq: '<rect x="104" y="200" width="30" height="170" rx="15"/>',
  pie_der: '<ellipse cx="80" cy="392" rx="18" ry="11"/>',
  pie_izq: '<ellipse cx="120" cy="392" rx="18" ry="11"/>',
};

// conteos: { zona: cantidad } pinta un mapa de calor en tono eosina. pick: permite elegir una zona.
export function mapaCorporal({ conteos = {}, sel = '', pick = false } = {}) {
  const max = Math.max(1, ...Object.values(conteos));
  const zonas = Object.entries(FORMAS).map(([z, forma]) => {
    const n = conteos[z] || 0;
    const estilo = n ? ` style="--zona:rgba(229,98,143,${(0.3 + 0.65 * n / max).toFixed(2)})"` : '';
    return `<g class="zona${sel === z ? ' sel' : ''}" data-zona="${z}"${estilo}><title>${ZONAS[z]}${n ? ` (${n})` : ''}</title>${forma}</g>`;
  }).join('');
  return `<svg class="mapa${pick ? ' pick' : ''}" viewBox="0 0 200 410" role="img" aria-label="Mapa corporal">${zonas}</svg>`;
}
