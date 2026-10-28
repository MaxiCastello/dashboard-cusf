// Lo que hace CARGAR PARTIDO con lo que se escribió en el formulario
// (cusf/cargar.py), sin tocar la pantalla ni la base: los valores de
// arranque de cada casilla, las validaciones, la fila que se guarda y el
// aviso. Aparte de cargar.js para probarlo en Node contra el propio
// cargar.py (pruebas/fuzz_carga.py) con los mismos valores.
//
// Las casillas se llaman como las `key` de cargar.py sin el final del
// partido (r, su, triesu, lineul, puScrum, amu, cch...): así la prueba le da
// los mismos valores a los dos.
//
// Lo único que cargar.py no necesitaba validar: Streamlit no deja escribir
// en una casilla de número algo que no sea un entero de 0 a 300, ni más
// letras que las permitidas, ni dejar la fecha vacía. Acá son casillas de
// HTML: eso se valida antes que el resto.
import { ANIO_PLANILLA, etiqueta, leerCsvTackles, SITUACIONES } from "./calculos.js";
import { conDefecto, entero, esVerdad, letras, recortar, soloDigitos, str } from "./python.js";

export const MAX_TXT = 60, MAX_N = 300;
export const MAX_CSV = 2 * 1024 * 1024;   // como maxUploadSize = 2 (MB) de .streamlit/config.toml
const MAX_REGISTROS = 2000;

export const CAMPOS_PUNTOS = [["tries", "Tries"], ["triesp", "Tries penales"], ["conv", "Conversiones metidas"],
  ["convt", "Conversiones pateadas"], ["palos", "Penales a los palos metidos"], ["palost", "Penales a los palos pateados"],
  ["drop", "Drops metidos"], ["dropt", "Drops pateados"]];
export const LADOS = [["u", "UNI"], ["r", "Rival"]];
// [título, clave en datos, lanzó/proveyó]
export const FORMACIONES = [["Line", "line", "Lan"], ["Scrum", "scrum", "Lan"], ["Salidas", "salida", "Pro"],
  ["Salidas de 22", "salida22", "Pro"]];
export const COLUMNAS_FORMACION = [["ul", "UNI lanzó"], ["ug", "UNI ganó"], ["rl", "Rival lanzó"], ["rg", "Rival ganó"]];
export const TARJETAS = [["am_u", "Amarillas UNI"], ["ro_u", "Rojas UNI"], ["am_r", "Amarillas rival"], ["ro_r", "Rojas rival"]];
const TARJETAS_FORM = [["amu", "am_u"], ["rou", "ro_u"], ["amr", "am_r"], ["ror", "ro_r"]];

// El rótulo de cada casilla de número (para decir cuál está mal).
export const ROTULOS = new Map([
  ["su", "Puntos UNI"], ["sr", "Puntos rival"],
  ...CAMPOS_PUNTOS.flatMap(([c, rot]) => LADOS.map(([l, quien]) => [c + l, `${rot} (${quien})`])),
  ...FORMACIONES.flatMap(([tit, clave]) => COLUMNAS_FORMACION.map(([sfx, rot]) => [clave + sfx, `${tit}: ${rot}`])),
  ...SITUACIONES.flatMap((s) => [[`pu${s}`, `Penales en ${s}: UNI`], [`pr${s}`, `Penales en ${s}: Rival`]]),
  ...TARJETAS_FORM.map(([n, k]) => [n, TARJETAS.find(([x]) => x === k)[1]]),
  ["ch", "Chances en 22"], ["co", "Concretadas"],
  ["cch", "Chances en 22"], ["cco", "Concretadas"],
  ...TARJETAS.map(([k, rot]) => [`ct${k}`, rot]),
]);

const dos = (n) => String(n).padStart(2, "0");
export function hoy() {
  const d = new Date();
  return `${d.getFullYear()}-${dos(d.getMonth() + 1)}-${dos(d.getDate())}`;
}

// date.fromisoformat() de una fecha de la base: AAAA-MM-DD que exista.
function fechaValida(x) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(typeof x === "string" ? x : "");
  if (!m) return false;
  const [a, me, d] = [m[1], m[2], m[3]].map(Number);
  const dias = [31, a % 4 === 0 && (a % 100 !== 0 || a % 400 === 0) ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  return a >= 1 && me >= 1 && me <= 12 && d >= 1 && d <= dias[me - 1];
}

// int(valor or 0) de cargar.py, como texto para la casilla.
const n0 = (x) => String(esVerdad(x) ? entero(x) : 0);
const de = (d, k) => (d && typeof d === "object" && !Array.isArray(d) && esVerdad(d[k]) ? d[k] : {});

// Lo que muestra el formulario al abrirse: vacío (partido nuevo, fila = null)
// o lo que tiene el partido que se corrige (una fila de partidos_manuales).
export function valoresPartido(fila) {
  const f = fila ?? {};
  const d = de(f, "datos");
  const pts = de(d, "puntos"), tj = de(d, "tarjetas"), ef = de(d, "efectividad_22");
  const pen = new Map();
  for (const x of Array.isArray(d.penales) ? d.penales : []) {
    if (x && typeof x === "object") pen.set(x.situacion, x);
  }
  // .get("rival", "") y .get("categoria", "Primera"): si la fila tiene null, la casilla arranca vacía
  const v = {
    r: str(conDefecto(f, "rival", "") ?? ""), c: str(conDefecto(f, "categoria", "Primera") ?? ""),
    f: fechaValida(f.fecha) ? f.fecha : hoy(), su: n0(f.score_uni), sr: n0(f.score_rival),
  };
  for (const [c] of CAMPOS_PUNTOS) for (const [l] of LADOS) v[c + l] = n0(pts[`${c}_${l}`]);
  for (const [, clave, lan] of FORMACIONES) {
    const src = de(d, clave);
    v[`${clave}ul`] = n0(src[`u${lan}`]);
    v[`${clave}ug`] = n0(src.uGan);
    v[`${clave}rl`] = n0(src[`r${lan}`]);
    v[`${clave}rg`] = n0(src.rGan);
  }
  for (const s of SITUACIONES) {
    v[`pu${s}`] = n0(pen.get(s)?.uni);
    v[`pr${s}`] = n0(pen.get(s)?.rival);
  }
  for (const [n, k] of TARJETAS_FORM) v[n] = n0(tj[k]);
  v.ch = n0(ef.chances);
  v.co = n0(ef.concretadas);
  return v;
}

// Las casillas de número: vacía = 0 (como arranca en Streamlit); si no, un
// entero de 0 a 300. Devuelve [números, errores].
function numeros(v, nombres) {
  const n = {}, errores = [];
  for (const k of nombres) {
    const t = String(v[k] ?? "").trim();
    if (t === "") n[k] = 0;
    else if (/^[0-9]+$/.test(t) && Number(t) <= MAX_N) n[k] = Number(t);
    else errores.push(`${ROTULOS.get(k)}: tiene que ser un número entero de 0 a ${MAX_N}.`);
  }
  return [n, errores];
}

const NUMEROS_PARTIDO = ["su", "sr", ...CAMPOS_PUNTOS.flatMap(([c]) => LADOS.map(([l]) => c + l)),
  ...FORMACIONES.flatMap(([, clave]) => COLUMNAS_FORMACION.map(([sfx]) => clave + sfx)),
  ...SITUACIONES.flatMap((s) => [`pu${s}`, `pr${s}`]), ...TARJETAS_FORM.map(([n]) => n), "ch", "co"];

// El CSV del Tackle Tracker -> los registros que se guardan, o null si no se
// pudo leer (no es UTF-8, o el Python se caería al leerlo).
export function registrosDelCsv(bytes) {
  let texto;
  try {
    // decode("utf-8-sig"): fatal = un byte que no es UTF-8 corta (UnicodeDecodeError)
    texto = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    return null;
  }
  let registros;
  try {
    [registros] = leerCsvTackles(texto);
  } catch {
    return null;
  }
  const corte = (s, n) => letras(s).slice(0, n).join("");
  return registros.filter((r) => soloDigitos(r.jugador)).slice(0, MAX_REGISTROS)
    .map((r) => ({ tiempo: corte(r.tiempo, 20), jugador: corte(r.jugador, 3), nombre: corte(r.nombre, MAX_TXT), tipo: corte(r.tipo, 10) }));
}

export const AVISO_2025 = `Los partidos de ${ANIO_PLANILLA} no se ven en el tablero: esa temporada sale de la planilla.`;

// Guardar un partido (nuevo si fila = null, o la corrección de esa fila).
// v: lo escrito en cada casilla; csv: los bytes del CSV elegido (o null).
// Devuelve {errores} o {fila, id, aviso: [tipo, texto]} (id: el de la fila
// que se corrige; null si es nuevo).
export function armarPartido(v, fila, csv) {
  const d = de(fila ?? {}, "datos");
  const rival = recortar(str(v.r ?? "")), cat = recortar(str(v.c ?? ""));
  const [n, errores] = numeros(v, NUMEROS_PARTIDO);
  if (letras(rival).length > MAX_TXT) errores.push(`El rival tiene más de ${MAX_TXT} letras.`);
  if (letras(cat).length > MAX_TXT) errores.push(`La categoría tiene más de ${MAX_TXT} letras.`);
  if (!fechaValida(v.f)) errores.push("Falta la fecha.");
  if (errores.length) {
    if (!rival) errores.unshift("Falta el rival.");
    return { errores };
  }

  const P = {};
  for (const [l] of LADOS) for (const [c] of CAMPOS_PUNTOS) P[`${c}_${l}`] = n[c + l];
  // (en el mismo orden de claves que cargar.py: tries_u, triesp_u, ... dropt_u, tries_r, ...)
  const F = {};
  for (const [, clave, lan] of FORMACIONES) {
    F[clave] = { [`u${lan}`]: n[`${clave}ul`], uGan: n[`${clave}ug`], [`r${lan}`]: n[`${clave}rl`], rGan: n[`${clave}rg`] };
    F[clave].uPer = Math.max(0, F[clave][`u${lan}`] - F[clave].uGan);
    F[clave].rPer = Math.max(0, F[clave][`r${lan}`] - F[clave].rGan);
  }
  const PEN = [];
  for (const s of SITUACIONES) {
    const u = n[`pu${s}`], r = n[`pr${s}`];
    if (u || r) PEN.push({ situacion: s, motivo: "Sin detalle", uni: u, rival: r });
  }
  const T = { am_u: n.amu, ro_u: n.rou, am_r: n.amr, ro_r: n.ror };
  const E = { chances: n.ch, concretadas: n.co };

  if (!rival) errores.push("Falta el rival.");
  for (const [a, b, txt] of [["conv_u", "convt_u", "conversiones de UNI"], ["conv_r", "convt_r", "conversiones del rival"],
    ["palos_u", "palost_u", "penales a los palos de UNI"], ["palos_r", "palost_r", "penales a los palos del rival"],
    ["drop_u", "dropt_u", "drops de UNI"], ["drop_r", "dropt_r", "drops del rival"]]) {
    if (P[a] > P[b]) errores.push(`Hay más ${txt} metidos que pateados.`);
  }
  for (const [lado, quien] of [["u", "UNI"], ["r", "el rival"]]) {
    // sólo se patea una conversión después de un try (el try penal no se patea)
    if (P[`convt_${lado}`] > P[`tries_${lado}`]) errores.push(`Hay más conversiones pateadas que tries de ${quien}.`);
  }
  for (const [clave, f] of Object.entries(F)) {
    const lan = "uLan" in f ? "Lan" : "Pro";
    if (f.uGan > f[`u${lan}`] || f.rGan > f[`r${lan}`]) {
      errores.push(`En ${clave.replace("salida22", "salidas de 22")} hay más ganados que lanzados.`);
    }
  }
  if (E.concretadas > E.chances) errores.push("Hay más chances en 22 concretadas que chances.");
  let registros = esVerdad(d.tackles_registros) ? d.tackles_registros : [];
  if (csv !== null) {
    registros = registrosDelCsv(csv);
    if (registros === null) {
      errores.push("El CSV de tackles no se pudo leer.");
      registros = [];
    }
    if (!registros.length) errores.push("El CSV no tiene tackles: ¿es el del Tackle Tracker?");
  }
  if (errores.length) return { errores };

  const calcU = P.tries_u * 5 + P.triesp_u * 7 + P.conv_u * 2 + (P.palos_u + P.drop_u) * 3;
  const calcR = P.tries_r * 5 + P.triesp_r * 7 + P.conv_r * 2 + (P.palos_r + P.drop_r) * 3;
  const datos = { puntos: P, ...F, penales: PEN, tarjetas: T, efectividad_22: E, tackles_registros: registros };
  const su = n.su, sr = n.sr;
  const nueva = { rival, categoria: cat === "" ? null : cat, fecha: v.f, score_uni: su, score_rival: sr, datos };
  const txt = `Guardado: UNI ${su}–${sr} ${rival}.`;
  let aviso = calcU !== su || calcR !== sr
    ? ["ojo", `${txt} Ojo: con tries y patadas da ${calcU}–${calcR}, distinto del tanteo cargado (${su}–${sr}). ` +
      "Se guardó igual; si fue un error, corregilo."]
    : ["ok", txt];
  // (no está en cargar.py) 2025 sale de la planilla: un partido de ese año no se vería
  if (v.f.startsWith(`${ANIO_PLANILLA}-`)) aviso = ["ojo", `${aviso[1]} ${AVISO_2025}`];
  return { fila: nueva, id: fila?.id ?? null, aviso };
}

// Los partidos que se pueden corregir: los cargados a mano (no los
// complementos de uno de Uni-Dat), con su etiqueta, en el orden de la base.
export function sueltos(filas, desdeManual) {
  const porId = new Map();
  for (const f of filas) if (!esVerdad(f.partido_id) && !esVerdad(f.borrado_en)) porId.set(f.id, f);
  return [...porId].map(([id, f]) => [id, f, etiqueta(desdeManual(f))]);
}

// ── Chances en 22 y tarjetas de un partido de Uni-Dat ────────────────────────

// p: el partido del tablero (ya con su complemento, si tiene).
export function valoresComplemento(p) {
  const ef = p.efectividad_22 ?? {};
  const v = { cch: n0(ef.chances), cco: n0(ef.concretadas) };
  for (const [k] of TARJETAS) v[`ct${k}`] = n0(p.tarjetas[k]);
  return v;
}

// Lo que cargó Uni-Dat (si se corrigieron, las de antes de corregir).
export const tarjetasUnidat = (p) => (esVerdad(p.tarjetas_unidat) ? p.tarjetas_unidat : p.tarjetas);

export function armarComplemento(v, p) {
  const [n, errores] = numeros(v, ["cch", "cco", ...TARJETAS.map(([k]) => `ct${k}`)]);
  if (errores.length) return { errores };
  if (n.cco > n.cch) return { errores: ["Hay más concretadas que chances."] };
  const T = Object.fromEntries(TARJETAS.map(([k]) => [k, n[`ct${k}`]]));
  const original = tarjetasUnidat(p);
  const datos = { efectividad_22: { chances: n.cch, concretadas: n.cco } };
  // sólo se guarda la corrección: si no, vale lo que diga Uni-Dat
  if (TARJETAS.some(([k]) => T[k] !== original[k])) datos.tarjetas = T;
  return {
    fila: { partido_id: p.id, datos }, id: p.complemento_id ?? null,
    aviso: ["ok", "Guardado." + ("tarjetas" in datos ? " Las tarjetas de este partido ahora son las corregidas acá." : "")],
  };
}
