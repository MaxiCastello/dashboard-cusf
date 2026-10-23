// Las cuentas del tablero (cusf/calculos.py y la parte de armar temporadas
// de cusf/fuente.py). Las claves de cada partido son las mismas que en el
// Python (score_uni, uLan...) para poder compararlas tal cual.
//
// FASE 1 (prueba de concepto): sólo lo que usa la página de prueba: el
// tanteo, el rival, la fecha y el line. El resto se pasa en la fase 2, con
// sus pruebas contra el Python y contra Uni-Dat.

// bool(x) de Python: además de null/undefined, son "falsos" el 0, "", y
// las listas y diccionarios vacíos (en JS [] y {} son verdaderos).
export function esVerdad(x) {
  if (Array.isArray(x)) return x.length > 0;
  if (x && typeof x === "object") return Object.keys(x).length > 0;
  return Boolean(x) || Number.isNaN(x);   // NaN es verdadero en Python
}

// `a or b or c` de Python: el primero verdadero, o el último.
const o = (...vs) => vs.find(esVerdad) ?? vs.at(-1);

// texto() de Python: sin < > (los gráficos interpretan algunas etiquetas
// HTML), los espacios juntados y con un largo máximo (en letras, no en
// unidades de JS: un emoji cuenta 1, como en Python).
// FASE 2: split() de Python y \s de JS no toman exactamente los mismos
// espacios raros (U+001C a U+001F, U+FEFF): probarlo contra Python.
export function texto(x, largo = 60) {
  const s = String(esVerdad(x) ? x : "").replaceAll("<", "").replaceAll(">", "").split(/\s+/).filter(Boolean).join(" ");
  return Array.from(s).slice(0, largo).join("");
}

// int(x) de Python, con 0 si no se puede (_entero).
export function entero(x) {
  if (typeof x === "boolean") return x ? 1 : 0;
  if (typeof x === "number") return Number.isFinite(x) ? Math.trunc(x) : 0;
  if (typeof x === "string" && /^\s*[+-]?\d+(_\d+)*\s*$/.test(x)) return Number.parseInt(x.replaceAll("_", ""), 10);
  return 0;
}

function ceroFp() {
  return { uLan: 0, uGan: 0, uPer: 0, uRec: 0, rLan: 0, rGan: 0, rPer: 0, rRec: 0 };
}

function partidoVacio() {
  return { id: "", fuente: "", rival: "", categoria: "", fecha: null, score_uni: 0, score_rival: 0, line: ceroFp() };
}

const d = (e) => (esVerdad(e.data) ? e.data : {});

const lanzoLine = (l) => (d(l).equipo === "UNI" ? "UNI" : "RIVAL");

// resultadoLine(): "UNI", "RIVAL" o null (sin dueño limpio).
function resultadoLine(l) {
  const eq = lanzoLine(l);
  const otro = eq === "UNI" ? "RIVAL" : "UNI";
  const { fin, ganador } = d(l);
  if (["GANADA", "FREE KICK", "INFRACCIÓN", "PENAL", "KNOCK-ON"].includes(fin) && ganador) {
    return ganador === eq ? eq : otro;
  }
  if (fin === "TORCIDA") return otro;
  return null;
}

export function lineStats(eventos) {
  const s = ceroFp();
  for (const l of eventos) {
    if (l.tipo !== "LINE") continue;
    const r = resultadoLine(l);
    if (lanzoLine(l) === "UNI") {
      s.uLan++;
      if (r === "UNI") s.uGan++;
      else if (r === "RIVAL") { s.uPer++; s.rRec++; }
      else s.uPer++;
    } else {
      s.rLan++;
      if (r === "RIVAL") s.rGan++;
      else if (r === "UNI") { s.rPer++; s.uRec++; }
      else s.rPer++;
    }
  }
  return s;
}

const conRival = (r) => (r === "" ? "Rival" : r);

// Una fila de la tabla partidos de Uni-Dat -> partido del tablero.
export function desdeUnidat(fila) {
  const main = esVerdad(fila.main) ? fila.main : {};
  const ev = (Array.isArray(main.eventos) ? main.eventos : []).filter((e) => e && typeof e === "object" && !Array.isArray(e));
  return {
    ...partidoVacio(),
    id: fila.id ?? "", fuente: "unidat",
    rival: conRival(texto(o(fila.rival, main.rivalName))),
    categoria: texto(o(fila.categoria, main.categoria)),
    fecha: fila.fecha ?? null,
    score_uni: entero(fila.score_uni), score_rival: entero(fila.score_rival),
    line: lineStats(ev),
  };
}

// Un partido cargado a mano en el tablero (tabla partidos_manuales).
export function desdeManual(fila) {
  const p = {
    ...partidoVacio(),
    id: fila.id ?? "", fuente: "manual",
    rival: conRival(texto(fila.rival)), categoria: texto(fila.categoria), fecha: fila.fecha ?? null,
    score_uni: entero(fila.score_uni), score_rival: entero(fila.score_rival),
  };
  const datos = esVerdad(fila.datos) ? fila.datos : {};
  const l = datos.line;
  if (l && typeof l === "object" && !Array.isArray(l)) {
    // hasOwn y no `in`: `in` también acepta "toString", "constructor"...
    for (const [k, v] of Object.entries(l)) if (Object.hasOwn(p.line, k)) p.line[k] = entero(v);
  }
  // a mano no se cargan las recuperadas: no se sabe, no es cero
  if (!(l && typeof l === "object" && !Array.isArray(l) && "uRec" in l)) p.line.uRec = p.line.rRec = null;
  return p;
}

// partidos_base() de fuente.py: Uni-Dat + los cargados a mano, por fecha.
// Un manual con partido_id es un complemento de un partido de Uni-Dat, no
// un partido aparte (lo que agrega se pasa en la fase 2).
export function partidosBase(filasUnidat, filasManuales) {
  const unidat = filasUnidat.map(desdeUnidat);
  const sueltos = filasManuales.filter((m) => !m.partido_id).map(desdeManual);
  // sort de JS es estable, como sorted() de Python: los empates quedan en el mismo orden
  return [...unidat, ...sueltos].filter((p) => p.fecha).sort((x, y) => (x.fecha < y.fecha ? -1 : x.fecha > y.fecha ? 1 : 0));
}

// 'Primera oro f3' -> 'Primera' (capitalize() de Python).
export function categoriaBase(cat) {
  const c = String(cat ?? "").trim();
  if (!c) return "Sin categoría";
  const w = c.split(/\s+/)[0];
  return w.charAt(0).toUpperCase() + w.slice(1).toLowerCase();
}

export const ANIO_PLANILLA = 2025;

// anios_disponibles() de fuente.py: los años con partidos y siempre 2025
// (la planilla), del más nuevo al más viejo. El primero es el que se ve al
// entrar.
export function aniosDisponibles(partidos) {
  const anios = new Set(partidos.map((p) => Number.parseInt(p.fecha.slice(0, 4), 10)));
  anios.add(ANIO_PLANILLA);
  return [...anios].sort((a, b) => b - a);
}

// Las categorías de un año, Primera primero y el resto por orden alfabético
// (sorted(key=(c != "Primera", c)) de dashboard.py: compara letra por
// letra, como < en JS, no como localeCompare).
export function categoriasDe(partidos, anio) {
  const cats = [...new Set(partidos.filter((p) => p.fecha.startsWith(String(anio))).map((p) => categoriaBase(p.categoria)))];
  return cats.sort((a, b) => (a === "Primera") !== (b === "Primera") ? (a === "Primera" ? -1 : 1) : a < b ? -1 : a > b ? 1 : 0);
}

// La suma de una formación: si un partido no tiene el dato (null), el total
// tampoco lo tiene (no es cero). En JS null + 1 da 1: por eso se mira antes.
function sumarDicts(dicts) {
  const out = {};
  for (const k of Object.keys(dicts[0])) {
    const vals = dicts.map((x) => x[k]);
    out[k] = vals.some((v) => v === null || v === undefined) ? null : vals.reduce((s, v) => s + v, 0);
  }
  return out;
}

export function temporada(partidos, anio, categoria) {
  const ps = partidos.filter((p) => p.fecha.startsWith(String(anio)) && categoriaBase(p.categoria) === categoria);
  const totales = ps.length
    ? { score_uni: ps.reduce((s, p) => s + p.score_uni, 0), score_rival: ps.reduce((s, p) => s + p.score_rival, 0),
      line: sumarDicts(ps.map((p) => p.line)) }
    : { score_uni: 0, score_rival: 0, line: ceroFp() };
  return { anio, partidos: ps, totales, n_partidos: ps.length, planilla: false };
}

// "G", "P" o "E" a partir del tanteo.
export function resultado(p) {
  return p.score_uni > p.score_rival ? "G" : p.score_uni < p.score_rival ? "P" : "E";
}

const MESES = ["", "ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];

// etiqueta() de vistas.py. La fecha es texto AAAA-MM-DD: no pasa por Date
// (en Argentina, new Date("2026-03-14") es el 13).
export function etiqueta(p, corta = false) {
  let f;
  if (p.fecha) {
    const [, m, dia] = p.fecha.split("-");
    f = `${Number.parseInt(dia, 10)} ${MESES[Number.parseInt(m, 10)]}`;
  } else {
    f = p.fecha_txt ?? "";
  }
  if (corta || p.fuente === "planilla") return `${f} · ${p.rival}`;
  return `${f} · UNI ${p.score_uni}–${p.score_rival} ${p.rival}`;
}
