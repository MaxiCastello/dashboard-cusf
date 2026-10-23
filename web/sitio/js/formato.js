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

// f"{x:.{n}f}" de Python. toFixed redondea igual (el número exacto que
// guardó la compu) salvo en un empate justo: 0.25 con 1 decimal, toFixed
// sube (0.3) y Python va al par (0.2). Un empate justo sólo puede pasar si
// el número es exacto, y entonces sus 30 decimales siguientes lo muestran:
// "…5000…0". Si no es empate, toFixed ya da lo mismo que Python.
export function fijo(x, n) {
  // sin número (una división por 0): en el Python eso se cae antes
  if (!Number.isFinite(x)) throw new RangeError(`fijo(): ${x} no es un número`);
  // desde 1e21 toFixed escribe "1e+21"; Python, todas las cifras (y ya no hay decimales)
  if (Math.abs(x) >= 1e21) return BigInt(x).toString() + (n ? `.${"0".repeat(n)}` : "");
  const largo = Math.abs(x).toFixed(n + 30);
  const coma = largo.indexOf(".");
  const resto = largo.slice(coma + 1 + n);
  if (resto !== "5".padEnd(30, "0")) return x.toFixed(n);
  // empate: se corta y se sube sólo si la última cifra es impar
  const cortado = largo.slice(0, n ? coma + 1 + n : coma);
  const ultima = Number(cortado.at(-1));
  const abajo = Number(cortado.replace(".", ""));
  const cifras = String(ultima % 2 ? abajo + 1 : abajo).padStart(n + 1, "0");
  const s = n ? `${cifras.slice(0, -n)}.${cifras.slice(-n)}` : cifras;
  return x < 0 ? `-${s}` : s;
}

// f"{x:.1f}".replace(".", ","): "2,5", "3,0".
export const unDecimal = (x) => fijo(x, 1).replace(".", ",");

// _coma() de vistas.py: un decimal, sin el ",0" (3,0 → 3; 2,5 queda).
export const coma = (x) => unDecimal(x).replaceAll(",0", "");

// f"{n:+d}": "+5", "-3", "+0".
export const conSigno = (n) => (n < 0 ? String(n) : `+${n}`);

// html.escape(x, quote=True) de Python.
const ESCAPES = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#x27;" };
export function esc(x) {
  return String(x).replace(/[&<>"']/g, (c) => ESCAPES[c]);
}
