// Lo que hace el Python del tablero y JS hace distinto, escrito para que dé
// lo mismo. Las cuentas (calculos.js) usan esto en vez de lo de JS cuando la
// diferencia cambia un resultado. Lo prueban contra el Python, en todas las
// letras de Unicode, pruebas/python_letras.py, y con miles de partidos al
// azar, pruebas/fuzz_cuentas.py.
//
// - [] y {} son verdaderos en JS y falsos en Python: esVerdad() / o().
// - `a < b` entre textos compara unidades UTF-16; Python, letras: menor().
// - str() de Python escribe True, None, 1e-05, ['a']: str().
// - split() / strip() de Python no toman los mismos espacios que \s de JS.
// - int("٣") de Python vale 3 (acepta las cifras de cualquier escritura).
// - capitalize() de Python usa la mayúscula "de título" (ǅ, no Ǆ; Ss, no SS).
// - sum() de Python compensa el error de los decimales: suma().

import { DIGITOS, NUEVAS } from "./unicode.js";

export class ErrorDatos extends Error {}

// Las letras que Python 3.13 (Unicode 15.1) todavía no conoce y el navegador
// sí (unicode.js): para Python no tienen mayúscula ni minúscula ni son
// marcas. comoPython(s, f) aplica f a s con esas letras tapadas por U+0378
// (que no existe en ninguna versión de Unicode: f no la toca) y las vuelve a
// poner en su lugar.
const HAY_NUEVAS = new RegExp(`[${NUEVAS}]`, "u");
const TAPAR = new RegExp(`[${NUEVAS}\\u0378]`, "gu");
export function comoPython(s, f) {
  if (!HAY_NUEVAS.test(s)) return f(s);
  const tapadas = s.match(TAPAR);
  let i = 0;
  return f(s.replace(TAPAR, "͸")).replace(/͸/g, () => tapadas[i++]);
}

// Donde el Python se cae (un dato con una forma imposible, ej. `data` que es
// un número), acá se corta: nunca se muestra un número que el Python no
// mostraría.
export function caer(que) {
  throw new ErrorDatos(`Hay un dato con un formato inesperado (${que}).`);
}

// bool(x) de Python.
export function esVerdad(x) {
  if (Array.isArray(x)) return x.length > 0;
  if (x instanceof Map || x instanceof Set) return x.size > 0;
  if (x && typeof x === "object") return Object.keys(x).length > 0;
  return Boolean(x) || Number.isNaN(x);   // NaN es verdadero en Python
}

// `a or b or c` de Python: el primero verdadero, o el último.
export const o = (...vs) => vs.find(esVerdad) ?? vs.at(-1);

export const esDict = (x) => x !== null && typeof x === "object" && !Array.isArray(x) && !(x instanceof Map);

export const nulo = (x) => x === null || x === undefined;

// d.get(k) de Python: undefined si no está (como None). Sólo claves propias
// ("toString" o "constructor" no son claves de un dato). Si d no es un
// diccionario, el Python se cae (AttributeError).
export function g(d, k, que = "dato") {
  if (!esDict(d)) caer(que);
  return Object.hasOwn(d, k) ? d[k] : undefined;
}

// El orden de las claves. Python recorre un diccionario en el orden en que
// llegó; JS pone primero las claves que parecen números ("12", "8", "9" →
// "8", "9", "12"), y JSON.parse también. leerJson() guarda el orden de
// llegada en ORDEN cuando JS lo cambió, y entradas() lo respeta.
export const ORDEN = Symbol("orden");
export const entradas = (d) => (d[ORDEN] ?? Object.keys(d)).map((k) => [k, d[k]]);

// JSON.parse() sin perder el orden de las claves (lo que manda Supabase o
// un archivo). Cada clave se lee con una marca adelante (así ninguna parece
// un número) y después se saca.
export function leerJson(texto) {
  // se recorren todos los textos de punta a punta (así nunca se empieza a
  // leer en el medio de uno) y se marcan los que van seguidos de ":". La
  // marca va escrita "\u0001" (en un JSON no puede ir la letra suelta) y
  // JSON.parse la lee como una sola letra.
  const dosPuntos = /\s*:/y;
  // (escrita "[^"\\]*(?:\\.[^"\\]*)*" y no "(?:[^"\\]|\\.)*": la segunda
  // agota la pila con un texto largo, como una imagen guardada en base64)
  const marcado = texto.replace(/"[^"\\]*(?:\\.[^"\\]*)*"/g, (s, i) => {
    dosPuntos.lastIndex = i + s.length;
    return dosPuntos.test(texto) ? `"\\u0001${s.slice(1)}` : s;
  });
  const sacar = (x) => {
    if (Array.isArray(x)) return x.map(sacar);
    if (x === null || typeof x !== "object") return x;
    const orden = Object.keys(x).map((k) => k.slice(1));
    // fromEntries y no d[k] = v: una clave "__proto__" queda como clave
    const d = Object.fromEntries(Object.entries(x).map(([k, v]) => [k.slice(1), sacar(v)]));
    if (Object.keys(d).some((k, i) => k !== orden[i])) Object.defineProperty(d, ORDEN, { value: orden });
    return d;
  };
  return sacar(JSON.parse(marcado));
}

// sum() de Python (3.12 en adelante): mientras son enteros suma exacto; desde
// el primer número con decimales, suma con compensación (Neumaier), así
// 0.1 + 0.2 + ... no arrastra el error de cada suma como `+` de JS. Un
// número sin decimales cuenta como entero (las apps de UNI, en JS, nunca
// guardan 5.0).
export function suma(valores) {
  let f = 0, c = 0, decimales = false;
  for (const x of valores) {
    if (!decimales && Number.isInteger(x)) {
      f += x;
    } else if (!decimales) {
      decimales = true;
      f += x;     // el primero se suma común, como en Python
    } else if (Number.isInteger(x)) {
      f += x;     // un entero, ya sumando con decimales: también común
    } else {
      const t = f + x;
      c += Math.abs(f) >= Math.abs(x) ? (f - t) + x : (x - t) + f;
      f = t;
    }
  }
  return decimales && c && Number.isFinite(c) ? f + c : f;
}

// d.get(k, defecto): el defecto sólo si la clave no está (si está en null,
// es None: str() da "None").
export const conDefecto = (d, k, defecto) => (Object.hasOwn(d, k) ? d[k] : defecto);

// Los espacios de str.split() / str.strip() de Python (str.isspace). No son
// los de \s de JS: Python suma U+001C–U+001F y U+0085, y no toma U+FEFF.
const ESP = "\\t\\n\\v\\f\\r\\x1c-\\x1f \\x85\\xa0\\u1680\\u2000-\\u200a\\u2028\\u2029\\u202f\\u205f\\u3000";
const ESPACIOS = new RegExp(`[${ESP}]+`, "u");
const BORDES = new RegExp(`^[${ESP}]+|[${ESP}]+$`, "gu");
export const partir = (s) => s.split(ESPACIOS).filter(Boolean);   // s.split()
export const recortar = (s) => s.replace(BORDES, "");             // s.strip()

// Las letras de un texto (Python cuenta letras; JS, unidades UTF-16: un
// emoji ocupa 2).
export const letras = (s) => Array.from(s);

// `a < b` de Python entre textos: compara letra por letra.
export function menor(a, b) {
  const x = letras(a), y = letras(b);
  for (let i = 0; i < Math.min(x.length, y.length); i++) {
    if (x[i] !== y[i]) return x[i].codePointAt(0) < y[i].codePointAt(0);
  }
  return x.length < y.length;
}
export const comparar = (a, b) => (menor(a, b) ? -1 : menor(b, a) ? 1 : 0);

// repr() de un float de Python: las mismas cifras que JS, pero con
// exponente desde 1e-05 (JS recién desde 1e-7) y escrito "1e-05".
function reprFloat(x) {
  const [mant, exp] = x.toExponential().split("e");
  const e = Number(exp);
  if (e < -4 || e >= 16) return `${mant}e${e < 0 ? "-" : "+"}${String(Math.abs(e)).padStart(2, "0")}`;
  return String(x);
}

// Lo que repr() de Python escapa en un texto: lo que no es "imprimible"
// (str.isprintable: controles, formatos, sin asignar, separadores salvo el
// espacio).
const NO_IMPRIMIBLE = new RegExp(`[\\p{Cc}\\p{Cf}\\p{Cs}\\p{Co}\\p{Cn}\\p{Zl}\\p{Zp}\\p{Zs}${NUEVAS}]`, "u");
function reprTexto(s) {
  const q = s.includes("'") && !s.includes('"') ? '"' : "'";
  let out = q;
  for (const c of s) {
    const cp = c.codePointAt(0);
    if (c === "\\" || c === q) out += `\\${c}`;
    else if (c === "\t") out += "\\t";
    else if (c === "\n") out += "\\n";
    else if (c === "\r") out += "\\r";
    else if (c !== " " && NO_IMPRIMIBLE.test(c)) {
      const h = cp.toString(16);
      out += cp < 0x100 ? `\\x${h.padStart(2, "0")}` : cp < 0x10000 ? `\\u${h.padStart(4, "0")}` : `\\U${h.padStart(8, "0")}`;
    } else out += c;
  }
  return out + q;
}

function repr(x) {
  if (typeof x === "string") return reprTexto(x);
  if (Array.isArray(x)) return `[${x.map(repr).join(", ")}]`;
  if (esDict(x)) return `{${entradas(x).map(([k, v]) => `${reprTexto(k)}: ${repr(v)}`).join(", ")}}`;
  return str(x);
}

// str(x) de Python, para lo que puede venir en un JSON. Un número sin
// decimales se escribe como entero (en JS no se distingue 12 de 12.0, y las
// apps de UNI, en JS, nunca guardan 12.0).
export function str(x) {
  if (nulo(x)) return "None";
  if (x === true) return "True";
  if (x === false) return "False";
  if (typeof x === "number") return Number.isInteger(x) ? BigInt(x).toString() : reprFloat(x);
  if (typeof x === "string") return x;
  return repr(x);
}

// int(texto) de Python: espacios alrededor, signo, cifras de cualquier
// escritura (\p{Nd}: "٣" vale 3) y guiones bajos entre cifras. Si no es un
// número, el Python se cae (ValueError): acá devuelve null.
// int() no toma como espacio U+001C–U+001F (split() y strip() sí).
const ESP_INT = ESP.replace("\\x1c-\\x1f ", " ");
const ENTERO = new RegExp(`^[${ESP_INT}]*([+-]?)(\\p{Nd}+(?:_\\p{Nd}+)*)[${ESP_INT}]*$`, "u");
const CIFRA = /\p{Nd}/u;
function cifra(c) {
  // las cifras de Unicode vienen de a 10 seguidas, del 0 al 9 (es una regla
  // de estabilidad de Unicode): el valor es cuántas hay antes, módulo 10
  let n = 0;
  for (let cp = c.codePointAt(0) - 1; CIFRA.test(String.fromCodePoint(cp)); cp--) n++;
  return n % 10;
}
export function enteroDeTexto(s) {
  if (HAY_NUEVAS.test(s)) return null;   // una cifra nueva no es cifra para Python
  const m = ENTERO.exec(s);
  if (!m) return null;
  let n = 0;
  for (const c of m[2]) if (c !== "_") n = n * 10 + cifra(c);
  return m[1] === "-" ? -n : n;
}

// "123" (sólo cifras, de cualquier escritura): str.isdecimal() de Python.
export const soloCifras = (s) => /^\p{Nd}+$/u.test(s) && !HAY_NUEVAS.test(s);

// str.isdigit() de Python: además de las cifras decimales, "²", "①"...
const DIGITO = new RegExp(`^(?:[${DIGITOS}]|\\p{Nd})+$`, "u");
export const soloDigitos = (s) => DIGITO.test(s) && !HAY_NUEVAS.test(s);

// int(x) de Python, o 0 si no se puede (_entero de calculos.py).
export function entero(x) {
  if (typeof x === "boolean") return x ? 1 : 0;
  if (typeof x === "number") return Number.isFinite(x) ? Math.trunc(x) : 0;
  if (typeof x === "string") return enteroDeTexto(x) ?? 0;
  return 0;
}

// int(texto) donde el Python no lo protege: si no se puede, se cae.
export function enteroOCaer(x, que) {
  const n = typeof x === "string" ? enteroDeTexto(x) : null;
  return n ?? caer(que);
}

// s.upper() de Python. Unicode 16 les dio mayúscula a unas letras que ya
// existían (ƛ → Ƛ...): Node la conoce y Python 3.13 (Unicode 15.1) no.
const SIN_MAYUSCULA = /([ƛɤꟓꟕ])/u;
export const mayuscula = (s) => comoPython(s, (x) => x.split(SIN_MAYUSCULA).map((y, i) => (i % 2 ? y : y.toUpperCase())).join(""));

// s.lower() de Python.
export const minuscula = (s) => comoPython(s, (x) => x.toLowerCase());

// c.title() de Python para una letra, donde no es c.toUpperCase(). Sale de
// comparar las dos en todas las letras de Unicode (python_letras.py).
const TITULO = new Map(Object.entries({
  "ß": "Ss", "Ǆ": "ǅ", "ǅ": "ǅ", "ǆ": "ǅ", "Ǉ": "ǈ",
  "ǈ": "ǈ", "ǉ": "ǈ", "Ǌ": "ǋ", "ǋ": "ǋ", "ǌ": "ǋ",
  "Ǳ": "ǲ", "ǲ": "ǲ", "ǳ": "ǲ", "և": "Եւ",
  "ᾲ": "Ὰͅ", "ᾳ": "ᾼ", "ᾴ": "Άͅ", "ᾷ": "ᾼ͂",
  "ᾼ": "ᾼ", "ῂ": "Ὴͅ", "ῃ": "ῌ", "ῄ": "Ήͅ",
  "ῇ": "ῌ͂", "ῌ": "ῌ", "ῲ": "Ὼͅ", "ῳ": "ῼ",
  "ῴ": "Ώͅ", "ῷ": "ῼ͂", "ῼ": "ῼ",
  "ﬀ": "Ff", "ﬁ": "Fi", "ﬂ": "Fl", "ﬃ": "Ffi", "ﬄ": "Ffl", "ﬅ": "St", "ﬆ": "St",
  "ﬓ": "Մն", "ﬔ": "Մե", "ﬕ": "Մի", "ﬖ": "Վն",
  "ﬗ": "Մխ",
}));
function titulo(c) {
  if (TITULO.has(c)) return TITULO.get(c);
  const cp = c.codePointAt(0);
  // georgiano: la "de título" es la misma letra (la mayúscula es otra)
  if ((cp >= 0x10d0 && cp <= 0x10fa) || (cp >= 0x10fd && cp <= 0x10ff)) return c;
  // griego con iota suscrita (ᾀ → ᾈ): la de título conserva la iota
  if (cp >= 0x1f80 && cp <= 0x1faf) return String.fromCodePoint(cp | 0x08);
  return mayuscula(c);
}

// s.capitalize() de Python: la primera letra "de título" y el resto en
// minúscula, mirando el texto entero (la sigma final depende de lo de antes).
export function capitalizar(s) {
  if (!s) return s;
  return comoPython(s, (x) => {
    const [c] = letras(x);
    return titulo(c) + x.toLowerCase().slice(c.toLowerCase().length);
  });
}
