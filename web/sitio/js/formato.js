// Números y textos con el mismo formato que el Python del tablero
// (cusf/estilo.py). Es el único archivo donde se redondea: el lint marca
// Math.round, toFixed y compañía en todos los demás.

// round() de Python: un .5 exacto va al par (12.5 → 12, 13.5 → 14).
// Math.round lo sube siempre (12.5 → 13): por eso no se usa.
export function redondear(x) {
  const piso = Math.floor(x);
  const resto = x - piso;
  if (resto !== 0.5) return resto < 0.5 ? piso : piso + 1;
  return piso % 2 === 0 ? piso : piso + 1;
}

// El mismo orden de operaciones que Python (a * 100 / b): da el mismo número.
export function pct(a, b) {
  return b ? redondear((a * 100) / b) : 0;
}

// "18 de 24 · 75%": el denominador antes que el porcentaje.
export function xdey(a, b) {
  return b ? `${a} de ${b} · ${pct(a, b)}%` : "—";
}

// html.escape(x, quote=True) de Python.
const ESCAPES = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#x27;" };
export function esc(x) {
  return String(x).replace(/[&<>"']/g, (c) => ESCAPES[c]);
}
