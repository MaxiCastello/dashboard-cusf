// Las cuentas del tablero: cusf/calculos.py, la parte de armar temporadas de
// cusf/fuente.py y una() de cusf/vistas.py, traducidas tal cual. Las claves
// de cada partido son las mismas que en el Python (score_uni, uLan...) para
// poder compararlas tal cual con la referencia.
//
// Son las MISMAS reglas que index.html de Uni-Dat (computeScrumStats,
// resultadoLine/computeLineStats, whoWonSalida, computeSalidaStats,
// computeKnockOnStats, computePeriodStats y el RESUMEN del CSV). Si se cambia
// una regla en Uni-Dat hay que cambiarla acá y en el Python.
//
// Criterio: con cualquier dato, el resultado es el del Python. Donde el
// Python se cae (un dato con una forma imposible, ej. `data` que es un
// número), acá se corta con ErrorDatos: nunca se muestra un número que el
// Python no mostraría. Lo prueba tests/calculos.test.js contra la
// referencia y pruebas/fuzz_cuentas.py con miles de partidos al azar.
//
// Ojo: un objeto de JS ordena primero las claves que parecen números ("12"):
// lo que viene de los datos y tiene orden (plantel, tries_origen) va en Map.
// El resto de las diferencias con Python, en python.js.

import { caer, capitalizar, comoPython, comparar, conDefecto, entero, enteroDeTexto, enteroOCaer, entradas, esDict, esVerdad,
  g, letras, mayuscula, minuscula, nulo, o, partir, recortar, soloCifras, soloDigitos, str, suma } from "./python.js";

export { ErrorDatos, entero, esVerdad, leerJson } from "./python.js";

// texto() de calculos.py: sin < > (los gráficos interpretan algunas
// etiquetas HTML), los espacios juntados y con un largo máximo en letras.
export function texto(x, largo = 60) {
  const s = partir(str(esVerdad(x) ? x : "").replaceAll("<", "").replaceAll(">", "")).join(" ");
  return letras(s).slice(0, largo).join("");
}

// ── El partido ───────────────────────────────────────────────────────────────

// Formación (line/scrum): lanzados, ganados, perdidos y recuperados de cada
// lado. Recuperados = null cuando no se sabe (carga manual, 2025).
const ceroFp = () => ({ uLan: 0, uGan: 0, uPer: 0, uRec: 0, rLan: 0, rGan: 0, rPer: 0, rRec: 0 });
const ceroSal = () => ({ uPro: 0, uGan: 0, uPer: 0, uRec: 0, rPro: 0, rGan: 0, rPer: 0, rRec: 0 });

export const PUNTOS_CAMPOS = ["tries_u", "tries_r", "triesp_u", "triesp_r", "conv_u", "convt_u", "conv_r", "convt_r",
  "palos_u", "palost_u", "palos_r", "palost_r", "drop_u", "dropt_u", "drop_r", "dropt_r"];

export function partidoVacio() {
  return {
    id: "", fuente: "", rival: "", categoria: "", fecha: null, score_uni: 0, score_rival: 0,
    puntos: Object.fromEntries(PUNTOS_CAMPOS.map((k) => [k, 0])),
    scrum: ceroFp(), line: ceroFp(), salida: ceroSal(), salida22: ceroSal(), salida_ingoal: ceroSal(),
    penales: [],               // [{situacion, motivo, uni, rival}]
    tarjetas: { am_u: 0, ro_u: 0, am_r: 0, ro_r: 0 },
    knockons: null,            // {uni, rival}
    efectividad_22: null,      // {chances, concretadas}
    tackles: [],               // [{dorsal, nombre, pos, neu, neg, err, pt, pt_err, st, st_err}]
    periodos: null,            // {PT: {...}, ST: {...}}
    line_tabla: null,          // {"jugadores|zona": [ganados, tirados]}
    tries_origen: null,        // Map origen -> [uni, rival]
    marcador: null,            // [{periodo, u, r, eq, como}] anotación por anotación
  };
}

// ── Reglas de Uni-Dat ────────────────────────────────────────────────────────

const tipo = (e) => g(e, "tipo");
const equipo = (e) => g(e, "equipo");

// e.get("data") or {}: si data es otra cosa (un número, una lista), el Python
// se cae en el primer .get().
function d(e) {
  const x = g(e, "data");
  if (!esVerdad(x)) return {};
  return esDict(x) ? x : caer("data");
}

// computeScrumStats(): razona por quién se quedó con la pelota.
export function scrumStats(eventos) {
  const s = ceroFp();
  for (const x of eventos) {
    if (tipo(x) !== "SCRUM") continue;
    const gan = g(d(x), "ganador"), eq = g(d(x), "equipo");
    if (eq === "UNI") s.uLan++;
    else s.rLan++;
    if (gan === "UNI") {
      if (eq === "UNI") s.uGan++;
      else { s.uRec++; s.rPer++; }
    } else if (gan === "RIVAL") {
      if (eq === "RIVAL") s.rGan++;
      else { s.rRec++; s.uPer++; }
    } else if (eq === "UNI") s.uPer++;
    else s.rPer++;
  }
  return s;
}

const lanzoLine = (l) => (g(d(l), "equipo") === "UNI" ? "UNI" : "RIVAL");

// resultadoLine(): "UNI", "RIVAL" o null (sin dueño limpio).
function resultadoLine(l) {
  const eq = lanzoLine(l);
  const otro = eq === "UNI" ? "RIVAL" : "UNI";
  const fin = g(d(l), "fin"), gan = g(d(l), "ganador");
  if (["GANADA", "FREE KICK", "INFRACCIÓN", "PENAL", "KNOCK-ON"].includes(fin) && esVerdad(gan)) {
    return gan === eq ? eq : otro;
  }
  if (fin === "TORCIDA") return otro;
  return null;
}

export function lineStats(eventos) {
  const s = ceroFp();
  for (const l of eventos) {
    if (tipo(l) !== "LINE") continue;
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

// Lines de UNI por cantidad de jugadores y posición (lineTablaHTML):
// {"7|2": [ganados, tirados]}. Lo cargado sin dato va a S/D. Las claves
// tienen siempre "|": un objeto de JS las deja en el orden en que llegaron.
export function lineTabla(eventos) {
  const t = {};
  for (const l of eventos) {
    if (tipo(l) !== "LINE" || lanzoLine(l) !== "UNI") continue;
    const n = entero(o(g(d(l), "jugadores"), 0));
    const j = n > 0 ? str(n) : "S/D";
    const m = /^([123])/.exec(str(o(g(d(l), "zona"), "")));
    const k = `${j}|${m ? m[1] : "S/D"}`;
    t[k] ??= [0, 0];
    t[k][1]++;
    if (resultadoLine(l) === "UNI") t[k][0]++;
  }
  return t;
}

// whoWonSalida().
function quienGanoSalida(s) {
  const x = d(s);
  const fin = g(x, "fin");
  if (fin === "GANADA") return o(g(x, "ganador"), null);
  if (fin === "KNOCK-ON") return g(x, "knockOn") === "UNI" ? "RIVAL" : "UNI";
  if (fin === "SALE DIRECTO" || fin === "NO PASA LAS 10") return g(x, "equipo") === "UNI" ? "RIVAL" : "UNI";
  return null;
}

const contar = (xs, f) => xs.reduce((n, x) => n + (f(x) ? 1 : 0), 0);

export function salidaStats(eventos, subTipo) {
  const sal = eventos.filter((e) => tipo(e) === "SALIDA" && g(d(e), "subTipo") === subTipo);
  const uni = sal.filter((s) => g(d(s), "equipo") === "UNI");
  const riv = sal.filter((s) => g(d(s), "equipo") === "RIVAL");
  const uGan = contar(uni, (s) => quienGanoSalida(s) === "UNI");
  const rGan = contar(riv, (s) => quienGanoSalida(s) === "RIVAL");
  return {
    uPro: uni.length, uGan, uPer: uni.length - uGan, uRec: contar(riv, (s) => quienGanoSalida(s) === "UNI"),
    rPro: riv.length, rGan, rPer: riv.length - rGan, rRec: contar(uni, (s) => quienGanoSalida(s) === "RIVAL"),
  };
}

// computeKnockOnStats(): detectados en scrum/salida/line + manuales.
export function knockonStats(eventos) {
  const lado = (eq, otro) =>
    contar(eventos, (e) => tipo(e) === "SCRUM" && g(d(e), "origen") === "KNOCK-ON" && g(d(e), "equipo") === otro) +
    contar(eventos, (e) => ["SALIDA", "LINE"].includes(tipo(e)) && g(d(e), "fin") === "KNOCK-ON" && g(d(e), "knockOn") === eq) +
    contar(eventos, (e) => tipo(e) === "KNOCKON" && equipo(e) === eq);
  return { uni: lado("UNI", "RIVAL"), rival: lado("RIVAL", "UNI") };
}

// Lo mismo que el RESUMEN del CSV de Uni-Dat (TRIES y PATADAS).
export function puntosStats(eventos) {
  const n = (t, eq, ok = null, campo = "resultado") =>
    contar(eventos, (e) => tipo(e) === t && equipo(e) === eq && (ok === null || g(d(e), campo) === ok));
  const p = {};
  for (const [l, eq] of [["u", "UNI"], ["r", "RIVAL"]]) {
    p[`tries_${l}`] = n("TRY", eq);
    p[`triesp_${l}`] = n("TRY PENAL", eq);
    p[`conv_${l}`] = n("TRY", eq, "SI", "conversion");
    p[`convt_${l}`] = n("TRY", eq);
    p[`palos_${l}`] = n("PALOS", eq, "SI");
    p[`palost_${l}`] = n("PALOS", eq);
    p[`drop_${l}`] = n("DROP", eq, "SI");
    p[`dropt_${l}`] = n("DROP", eq);
  }
  return p;
}

// Penales: Uni-Dat guarda en data.tipo qué fue y en data.subTipo el motivo
// de ruck, scrum y line. Para el tablero se agrupan en situaciones (las
// mismas de la planilla 2025) y el motivo es el texto de la app.
export const SITUACIONES = ["Scrum", "Line", "Ruck", "Maul", "Juego"];

export function motivo(txt) {
  const t = texto(txt);
  if (!t || t === "—") return "Sin motivo";
  const [c, ...resto] = letras(t);
  return mayuscula(c) + minuscula(resto.join(""));
}

function situacionPenal(data) {
  const crudo = o(g(data, "tipo"), "OTRO");
  if (typeof crudo !== "string") caer("tipo de penal");
  const t = mayuscula(crudo);
  const sub = g(data, "subTipo");
  if (t === "PENAL EN SCRUM") return ["Scrum", motivo(sub)];
  if (t === "PENAL EN LINE") return ["Line", motivo(sub)];
  if (t === "RUCK") return ["Ruck", motivo(sub)];
  if (t === "MAUL") return ["Maul", "Maul"];
  if (t === "PENAL POR TRY PENAL") return ["Juego", "Try penal"];
  return ["Juego", motivo(t)];
}

export function penalesStats(eventos) {
  const filas = new Map();
  for (const e of eventos) {
    if (tipo(e) !== "PENAL") continue;
    const [situacion, mot] = situacionPenal(d(e));
    const k = JSON.stringify([situacion, mot]);
    if (!filas.has(k)) filas.set(k, { situacion, motivo: mot, uni: 0, rival: 0 });
    filas.get(k)[equipo(e) === "UNI" ? "uni" : "rival"]++;
  }
  return [...filas.values()];
}

export function tarjetasStats(eventos) {
  const n = (eq, color) => contar(eventos, (e) => tipo(e) === "TARJETA" && equipo(e) === eq && g(d(e), "color") === color);
  return { am_u: n("UNI", "AMARILLA"), ro_u: n("UNI", "ROJA"), am_r: n("RIVAL", "AMARILLA"), ro_r: n("RIVAL", "ROJA") };
}

// updateTryOrigenStats(): try normal + try penal, por origen. Map: el
// origen viene de los datos y el orden en que aparece importa.
export function triesOrigen(eventos) {
  const t = new Map();
  for (const e of eventos) {
    if (tipo(e) !== "TRY" && tipo(e) !== "TRY PENAL") continue;
    const k = o(texto(g(d(e), "origen")), "OTRO");
    if (!t.has(k)) t.set(k, [0, 0]);
    t.get(k)[equipo(e) === "UNI" ? 0 : 1]++;
  }
  return t;
}

// e.get("puntos") or 0, para sumar: un número (o True, que en Python vale 1).
// Un texto o una lista no se pueden sumar: el Python se cae.
function puntosDe(e) {
  const x = o(g(e, "puntos"), 0);
  if (typeof x === "number") return x;
  if (typeof x === "boolean") return Number(x);
  return caer("puntos");
}

// computePeriodStats(p) + line/scrum ganados del período.
export function periodoStats(eventos, per) {
  const ev = eventos.filter((e) => g(e, "periodo") === per);
  const n = (f) => contar(ev, f);
  const s = {};
  for (const [l, eq] of [["u", "UNI"], ["r", "RIVAL"]]) {
    s[`pts_${l}`] = suma(ev.filter((e) => equipo(e) === eq).map(puntosDe));
    s[`tries_${l}`] = n((e) => (tipo(e) === "TRY" || tipo(e) === "TRY PENAL") && equipo(e) === eq);
    s[`pen_${l}`] = n((e) => tipo(e) === "PENAL" && equipo(e) === eq);
    s[`tar_${l}`] = n((e) => tipo(e) === "TARJETA" && equipo(e) === eq);
  }
  const ko = knockonStats(ev);
  s.ko_u = ko.uni;
  s.ko_r = ko.rival;
  s.line = lineStats(ev);
  s.scrum = scrumStats(ev);
  s.salida = salidaStats(ev, "SALIDA");
  return s;
}

// El marcador después de cada anotación, en el orden en que se cargaron
// (Uni-Dat no guarda minutos). Usa los puntos de cada evento, igual que
// computePeriodStats.
const COMO = { TRY: "try", "TRY PENAL": "try penal", PALOS: "penal a los palos", DROP: "drop" };
export function marcadorEvolucion(eventos) {
  let u = 0, r = 0;
  const out = [];
  for (const e of eventos) {
    const crudo = o(g(e, "puntos"), 0);
    if (!esVerdad(crudo) || !["UNI", "RIVAL"].includes(equipo(e))) continue;
    const pts = puntosDe(e);
    if (equipo(e) === "UNI") u += pts;
    else r += pts;
    const t = tipo(e);
    // como.get(tipo): una lista o un diccionario no pueden ser clave (el Python se cae)
    if (t !== null && typeof t === "object") caer("tipo de evento");
    let como = typeof t === "string" && Object.hasOwn(COMO, t) ? COMO[t] : "puntos";
    if (t === "TRY" && crudo === 7) como = "try convertido";
    out.push({ periodo: g(e, "periodo") ?? null, u, r, eq: equipo(e), como });
  }
  return out;
}

// ── Tackles (Tackle Tracker) ─────────────────────────────────────────────────

const TIPO_TK = { positivo: "pos", neutral: "neu", negativo: "neg", errado: "err" };

// `for r in x` de Python sobre una lista que tiene que ser de diccionarios.
function listaDeDicts(x, que) {
  if (!Array.isArray(x)) caer(que);
  for (const r of x) if (!esDict(r)) caer(que);
  return x;
}

// Registros [{tiempo, jugador, nombre, tipo}] -> una fila por jugador. El
// nombre es el que quedó anotado en el tackle; si falta, el de la plantilla.
// Efectividad del Tackle Tracker: (total - errados) / total.
export function tacklesDesdeRegistros(registros, plantilla = null) {
  const pl = esVerdad(plantilla) ? plantilla : {};
  const filas = new Map();
  for (const r of esVerdad(registros) ? listaDeDicts(registros, "registros de tackles") : []) {
    const crudo = minuscula(recortar(str(conDefecto(r, "tipo", ""))));
    const t = Object.hasOwn(TIPO_TK, crudo) ? TIPO_TK[crudo] : null;
    if (!t) continue;
    const dorsal = texto(recortar(str(conDefecto(r, "jugador", ""))), 4);
    const nombre = texto(o(g(r, "nombre"), g(pl, dorsal)));
    const k = JSON.stringify([dorsal, nombre]);
    if (!filas.has(k)) {
      filas.set(k, { dorsal, nombre: o(nombre, `#${dorsal}`), pos: 0, neu: 0, neg: 0, err: 0, pt: 0, pt_err: 0, st: 0, st_err: 0 });
    }
    const f = filas.get(k);
    f[t]++;
    const mitad = minuscula(str(conDefecto(r, "tiempo", ""))).startsWith("segundo") ? "st" : "pt";
    f[mitad]++;
    if (t === "err") f[`${mitad}_err`]++;
  }
  return [...filas.values()];
}

// csv.reader de Python (formato "excel": coma, comillas dobles, "" adentro
// de comillas es una comilla) sobre io.StringIO(texto): los renglones se
// cortan sólo en \n y el lector se ocupa de \r. Donde el Python corta con
// csv.Error (un \r suelto en medio de un renglón, un campo de más de
// 131.072 letras), acá también: tira ErrorCsv.
export class ErrorCsv extends Error {}
const LIMITE_CAMPO = 131072;

function* filasCsv(texto) {
  const renglones = texto.match(/[^\n]*\n|[^\n]+$/g) ?? [];
  let celdas = [], campo = [], estado = "registro";
  const guardar = () => {
    celdas.push(campo.join(""));
    campo = [];
  };
  const sumar = (c) => {
    if (campo.length >= LIMITE_CAMPO) throw new ErrorCsv("campo demasiado largo");
    campo.push(c);
  };
  for (const renglon of renglones) {
    // FIN: el final del renglón (después de su último carácter)
    for (const c of [...letras(renglon), "FIN"]) {
      const corte = c === "\n" || c === "\r";
      switch (estado) {
        case "registro":
          if (c === "FIN") break;   // renglón vacío: una fila sin celdas
          if (corte) {
            estado = "comerFin";
            break;
          }
          estado = "campo";
        // falls through
        case "campo":
          if (corte || c === "FIN") {
            guardar();
            estado = c === "FIN" ? "registro" : "comerFin";
          } else if (c === '"') estado = "comillas";
          else if (c === ",") guardar();
          else {
            sumar(c);
            estado = "enCampo";
          }
          break;
        case "enCampo":
          if (corte || c === "FIN") {
            guardar();
            estado = c === "FIN" ? "registro" : "comerFin";
          } else if (c === ",") {
            guardar();
            estado = "campo";
          } else sumar(c);
          break;
        case "comillas":
          if (c === "FIN") break;   // sigue en el renglón que viene (el \n ya se sumó)
          if (c === '"') estado = "comillaEnComillas";
          else sumar(c);
          break;
        case "comillaEnComillas":
          if (c === '"') {
            sumar(c);
            estado = "comillas";
          } else if (c === ",") {
            guardar();
            estado = "campo";
          } else if (corte || c === "FIN") {
            guardar();
            estado = c === "FIN" ? "registro" : "comerFin";
          } else {
            sumar(c);
            estado = "enCampo";
          }
          break;
        case "comerFin":
          if (c === "FIN") estado = "registro";
          else if (!corte) throw new ErrorCsv("salto de renglón en medio de un campo");
          break;
      }
    }
    if (estado === "registro") {
      yield celdas;
      celdas = [];
    }
  }
  // se terminó el texto con un campo abierto (unas comillas sin cerrar)
  if (campo.length || estado === "comillas") {
    guardar();
    yield celdas;
  }
}

// leer_csv_tackles de calculos.py: el CSV del Tackle Tracker (nuevo o viejo)
// -> [registros, plantilla]. Sólo se leen la PLANTILLA y el log de tackles.
export function leerCsvTackles(texto) {
  const plantilla = new Map(), registros = [];
  let seccion = null;
  for (const celdas of filasCsv(texto.replace(/^\uFEFF+/, ""))) {
    const primero = celdas.length ? recortar(celdas[0]) : "";
    if (primero === "PLANTILLA" || primero === "PARTIDO") {
      seccion = primero;
      continue;
    }
    if (["RESUMEN POR JUGADOR", "TARJETAS", "SUSTITUCIONES"].includes(primero)) {
      seccion = null;
      continue;
    }
    if (primero === "Tiempo" && celdas.length >= 4) {
      seccion = "registros";
      continue;
    }
    if (!primero || primero === "Dorsal" || primero === "Rival") continue;
    if (seccion === "PLANTILLA" && celdas.length > 1 && recortar(celdas[1])) {
      plantilla.set(primero, recortar(celdas[1]));
    } else if (seccion === "registros" && celdas.length >= 4) {
      registros.push({ tiempo: primero, jugador: recortar(celdas[1]), nombre: recortar(celdas[2]), tipo: recortar(celdas[3]) });
    }
  }
  return [registros, plantilla];
}

// ── Armar partidos ───────────────────────────────────────────────────────────

const conRival = (r) => o(r, "Rival");

// Una fila de la tabla partidos de Uni-Dat -> partido del tablero.
export function desdeUnidat(fila) {
  const main = o(g(fila, "main", "fila de partido"), {});
  if (!esDict(main)) caer("main");
  const crudos = o(g(main, "eventos"), []);
  let ev;
  if (Array.isArray(crudos)) ev = crudos.filter(esDict);
  else if (typeof crudos === "string" || esDict(crudos)) ev = [];   // letras o claves: ninguna es un evento
  else caer("eventos");
  const p = {
    ...partidoVacio(),
    id: conDefecto(fila, "id", ""), fuente: "unidat",
    rival: conRival(texto(o(g(fila, "rival"), g(main, "rivalName")))),
    categoria: texto(o(g(fila, "categoria"), g(main, "categoria"))),
    fecha: g(fila, "fecha") ?? null,
    score_uni: entero(g(fila, "score_uni")), score_rival: entero(g(fila, "score_rival")),
    puntos: puntosStats(ev),
    scrum: scrumStats(ev), line: lineStats(ev),
    salida: salidaStats(ev, "SALIDA"), salida22: salidaStats(ev, "SALIDA DE 22"),
    salida_ingoal: salidaStats(ev, "SALIDA INGOAL"),
    penales: penalesStats(ev), tarjetas: tarjetasStats(ev),
    knockons: knockonStats(ev),
    periodos: { PT: periodoStats(ev, "PT"), ST: periodoStats(ev, "ST") },
    line_tabla: lineTabla(ev), tries_origen: triesOrigen(ev),
    marcador: marcadorEvolucion(ev),
  };
  const tk = o(g(fila, "tackles"), {});
  const ses = o(g(tk, "session", "tackles"), {});
  if (esDict(ses) && esVerdad(g(ses, "registros"))) {
    const jug = esDict(g(tk, "jugadores")) ? g(tk, "jugadores") : {};
    p.tackles = tacklesDesdeRegistros(g(ses, "registros"), jug);
    // los convocados (dorsal -> nombre): cuentan como PJ aunque no tacklearan.
    // Map: los dorsales parecen números y un objeto los reordenaría (y el
    // orden importa: es el de los que no tacklearon en la tabla).
    p.plantel = new Map();
    for (const [dor, nom] of entradas(jug)) if (texto(nom)) p.plantel.set(texto(dor, 4), texto(nom));
  }
  return p;
}

function efectividad22(x) {
  if (!esDict(x)) return null;
  const chances = entero(g(x, "chances")), concretadas = entero(g(x, "concretadas"));
  return chances || concretadas ? { chances, concretadas } : null;
}

// Un partido cargado a mano en el tablero (tabla partidos_manuales). `datos`
// tiene la misma forma que partidoVacio() en las claves que se cargaron; lo
// que falta queda en cero.
export function desdeManual(fila) {
  const p = {
    ...partidoVacio(),
    id: conDefecto(fila, "id", ""), fuente: "manual",
    rival: conRival(texto(g(fila, "rival"))), categoria: texto(g(fila, "categoria")),
    fecha: g(fila, "fecha") ?? null,
    score_uni: entero(g(fila, "score_uni")), score_rival: entero(g(fila, "score_rival")),
  };
  const datos = o(g(fila, "datos"), {});
  const de = (clave) => g(datos, clave, "datos");
  for (const clave of ["puntos", "scrum", "line", "salida", "salida22", "tarjetas"]) {
    // hasOwn y no `in`: `in` también acepta "toString", "constructor"...
    if (esDict(de(clave))) for (const [k, v] of entradas(de(clave))) if (Object.hasOwn(p[clave], k)) p[clave][k] = entero(v);
  }
  for (const clave of ["scrum", "line", "salida", "salida22"]) {
    // a mano no se cargan las recuperadas: no se sabe, no es cero
    if (!esDict(de(clave)) || !Object.hasOwn(de(clave), "uRec")) p[clave].uRec = p[clave].rRec = null;
  }
  if (Array.isArray(de("penales"))) {
    p.penales = de("penales").filter(esDict).map((f) => ({
      situacion: o(texto(g(f, "situacion")), "Juego"), motivo: texto(g(f, "motivo")),
      uni: entero(g(f, "uni")), rival: entero(g(f, "rival")),
    }));
  }
  p.efectividad_22 = efectividad22(de("efectividad_22"));
  if (Array.isArray(de("tackles_registros"))) p.tackles = tacklesDesdeRegistros(de("tackles_registros"));
  return p;
}

// Tarjetas corregidas a mano en el complemento de un partido de Uni-Dat:
// las cuatro cantidades, o null si no se corrigieron.
function tarjetasCorregidas(x) {
  if (!esDict(x)) return null;
  return Object.fromEntries(["am_u", "ro_u", "am_r", "ro_r"].map((k) => [k, Math.max(0, entero(g(x, k)))]));
}

// La clave de un diccionario de Python: 1, 1.0 y True son la misma; una
// lista no puede ser clave (el Python se cae).
function clavePy(x) {
  if (typeof x === "boolean" || typeof x === "number") return `n:${Number(x)}`;
  if (typeof x === "string") return `s:${x}`;
  if (nulo(x)) return "None";
  return caer("partido_id");
}

// partidos_base() de fuente.py: Uni-Dat + los cargados a mano, por fecha.
// Un manual con partido_id es un complemento de un partido de Uni-Dat (lo
// que Uni-Dat no registra, y tarjetas corregidas), no un partido aparte.
export function partidosBase(filasUnidat, filasManuales) {
  const unidat = listaDeDicts(filasUnidat, "partidos").map(desdeUnidat);
  const porId = new Map(unidat.map((p) => [clavePy(p.id), p]));
  const sueltos = [];
  for (const m of listaDeDicts(filasManuales, "partidos a mano")) {
    if (esVerdad(g(m, "partido_id"))) {
      const p = porId.get(clavePy(m.partido_id));
      if (p) {
        const datos = o(g(m, "datos"), {});
        p.efectividad_22 = efectividad22(g(datos, "efectividad_22", "datos"));
        if (!Object.hasOwn(m, "id")) caer("complemento sin id");
        p.complemento_id = m.id;
        const tj = tarjetasCorregidas(g(datos, "tarjetas"));
        if (tj) {
          p.tarjetas_unidat = p.tarjetas;
          p.tarjetas = tj;
        }
      }
    } else {
      sueltos.push(desdeManual(m));
    }
  }
  const todos = [...unidat, ...sueltos].filter((p) => esVerdad(p.fecha));
  // una fecha que no es texto: el Python se cae al ordenar o al leer el año
  for (const p of todos) if (typeof p.fecha !== "string") caer("fecha");
  // sort de JS es estable, como sorted() de Python: los empates quedan en el mismo orden
  return todos.sort((x, y) => comparar(x.fecha, y.fecha));
}

// 'Primera oro f3' -> 'Primera'. Uni-Dat guarda la categoría como texto
// libre; para filtrar alcanza con la primera palabra.
export function categoriaBase(cat) {
  const c = recortar(o(cat, ""));
  return c ? capitalizar(partir(c)[0]) : "Sin categoría";
}

export const ANIO_PLANILLA = 2025;

// anios_disponibles() de fuente.py: los años con partidos y siempre 2025
// (la planilla), del más nuevo al más viejo. El primero es el que se ve al
// entrar.
export function aniosDisponibles(partidos) {
  const anios = new Set(partidos.map((p) => enteroOCaer(letras(p.fecha).slice(0, 4).join(""), "fecha")));
  anios.add(ANIO_PLANILLA);
  return [...anios].sort((a, b) => b - a);
}

const delAnio = (p, anio) => p.fecha.startsWith(String(anio));

// Las categorías de un año, Primera primero y el resto por orden alfabético
// (sorted(key=(c != "Primera", c)) de dashboard.py: compara letra por letra,
// no como localeCompare).
export function categoriasDe(partidos, anio) {
  const cats = [...new Set(partidos.filter((p) => delAnio(p, anio)).map((p) => categoriaBase(p.categoria)))];
  return cats.sort((a, b) => ((a === "Primera") !== (b === "Primera") ? (a === "Primera" ? -1 : 1) : comparar(a, b)));
}

// ── Sumar partidos ───────────────────────────────────────────────────────────

// La suma de una formación: si un partido no tiene el dato (null), el total
// tampoco lo tiene (no es cero). En JS null + 1 da 1: por eso se mira antes.
function sumarDicts(dicts) {
  const out = {};
  for (const k of Object.keys(dicts[0])) {
    const vals = dicts.map((x) => (Object.hasOwn(x, k) ? x[k] : null));
    out[k] = vals.some(nulo) ? null : vals.reduce((s, v) => s + v, 0);
  }
  return out;
}

// Total de una lista de partidos con la misma forma que un partido.
export function sumar(partidos) {
  const t = partidoVacio();
  if (!partidos.length) return t;
  t.score_uni = partidos.reduce((s, p) => s + p.score_uni, 0);
  t.score_rival = partidos.reduce((s, p) => s + p.score_rival, 0);
  for (const clave of ["puntos", "scrum", "line", "salida", "salida22", "salida_ingoal", "tarjetas"]) {
    t[clave] = sumarDicts(partidos.map((p) => p[clave]));
  }
  const pen = new Map();
  for (const p of partidos) {
    for (const f of p.penales) {
      const k = JSON.stringify([f.situacion, f.motivo]);
      if (!pen.has(k)) pen.set(k, { ...f, uni: 0, rival: 0 });
      pen.get(k).uni += f.uni;
      pen.get(k).rival += f.rival;
    }
  }
  t.penales = [...pen.values()];
  const kos = partidos.map((p) => p.knockons).filter(esVerdad);
  t.knockons = kos.length ? sumarDicts(kos) : null;
  const efs = partidos.map((p) => p.efectividad_22).filter(esVerdad);
  t.efectividad_22 = efs.length ? sumarDicts(efs) : null;
  return t;
}

// Nombres mal escritos -> el correcto (la clave, sin tildes ni mayúsculas).
// 2025: en las planillas de la Fecha 14 y 15. 2026: en la plantilla del
// Tackle Tracker.
const NOMBRES_CORREGIDOS = new Map([["santiago hothan", "Santiago Hotham"], ["julian felitas", "Julian Fleitas"],
  ["alvaro otteo", "Alvaro Oteo"], ["nahuel gonzales", "Nahuel Gonzalez"]]);

// El jugador se reconoce por el nombre sin tildes ni mayúsculas.
// (U+1171E dejó de ser una marca en Unicode 16; para Python 3.13 todavía lo es)
export const claveJugador = (n) => comoPython(partir(str(n)).join(" "),
  (s) => s.toLowerCase().normalize("NFD").replace(/[\p{Mn}\u{1171e}]/gu, ""));

// 'Federico bruzzone' -> 'Federico Bruzzone'. Sólo sube la primera letra de
// cada palabra: no toca el resto ('McLean', 'Dal Molin' quedan igual).
export function mayusculas(nombre) {
  return partir(str(nombre)).map((w) => {
    const [c, ...resto] = letras(w);
    return mayuscula(c) + resto.join("");
  }).join(" ");
}

// Tackles por jugador sumando partidos. El jugador se reconoce por el nombre
// (sin tildes ni mayúsculas): el dorsal cambia de un partido a otro. PJ =
// partidos en la lista del Tackle Tracker, aunque no haya tackleado (la
// planilla 2025 y el plantel de Uni-Dat listan a los convocados; de un
// partido cargado a mano sólo se conocen los que tacklearon). Titular =
// camiseta 1 a 15 en ese partido; suplente = 16 en adelante; sin número,
// ninguno de los dos.
export function tacklesTemporada(partidos) {
  const out = new Map();
  for (const p of partidos) {
    const vistos = new Set();
    // los del plantel que no tienen fila de tackles, con todo en cero (el
    // dorsal manda: así no se duplica si el nombre se anotó distinto)
    const conFila = new Set(p.tackles.map((f) => f.dorsal));
    const sinTk = [...(p.plantel ?? new Map())].filter(([dor]) => !conFila.has(dor))
      .map(([dorsal, nombre]) => ({ dorsal, nombre, pos: 0, neu: 0, neg: 0, err: 0 }));
    for (const f of [...p.tackles, ...sinTk]) {
      const nombre = NOMBRES_CORREGIDOS.get(claveJugador(f.nombre)) ?? f.nombre;
      const k = claveJugador(nombre);
      if (!out.has(k)) out.set(k, { nombre: mayusculas(nombre), pj: 0, tit: 0, sup: 0, pos: 0, neu: 0, neg: 0, err: 0 });
      const j = out.get(k);
      for (const c of ["pos", "neu", "neg", "err"]) j[c] += f[c];
      if (!vistos.has(k)) {
        j.pj++;
        vistos.add(k);
        // str.isdigit() de Python acepta también "²" y compañía, y ahí el
        // Python se cae en int(): acá también se corta
        const dor = recortar(str(conDefecto(f, "dorsal", "")));
        if (soloDigitos(dor) && !soloCifras(dor)) caer("dorsal");   // "²": isdigit() sí, int() se cae
        if (soloCifras(dor) && enteroDeTexto(dor) >= 1) j[enteroDeTexto(dor) <= 15 ? "tit" : "sup"]++;
      }
    }
  }
  return [...out.values()];
}

// '13 (10 titular - 3 suplente)'; si a algún partido le falta el número de
// camiseta, sólo los PJ (los de adentro no sumarían el total).
export function pjTexto(j) {
  if (j.tit + j.sup !== j.pj) return String(j.pj);
  return `${j.pj} (${j.tit} titular - ${j.sup} suplente)`;
}

// "G", "P" o "E" a partir del tanteo (no se carga a mano).
export function resultado(p) {
  return p.score_uni > p.score_rival ? "G" : p.score_uni < p.score_rival ? "P" : "E";
}

// ── Temporadas ───────────────────────────────────────────────────────────────

const serie22 = (ps) => ps.filter((p) => esVerdad(p.efectividad_22)).map((p) => ({ rival: p.rival, ...p.efectividad_22 }));

// Los partidos de la base de un año y una categoría, con sus totales.
export function temporada(partidos, anio, categoria) {
  const ps = partidos.filter((p) => delAnio(p, anio) && categoriaBase(p.categoria) === categoria);
  return { anio, partidos: ps, totales: sumar(ps), n_partidos: ps.length, planilla: false, serie_22: serie22(ps) };
}

// una() de vistas.py: la temporada de un solo partido (para reusar las
// secciones). En la planilla, el partido es su propio total.
export function una(p, t) {
  return {
    anio: t.anio, partidos: [p], totales: t.planilla ? p : sumar([p]), n_partidos: 1, planilla: t.planilla,
    serie_22: serie22([p]),
  };
}

const MESES = ["", "ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];

// etiqueta() de vistas.py. La fecha es texto AAAA-MM-DD: no pasa por Date
// (en Argentina, new Date("2026-03-14") es el 13).
export function etiqueta(p, corta = false) {
  let f;
  if (esVerdad(p.fecha)) {
    const partes = p.fecha.split("-");
    if (partes.length !== 3) caer("fecha");
    const m = enteroOCaer(partes[1], "fecha"), dia = enteroOCaer(partes[2], "fecha");
    // MESES[int(m)] de Python: un índice negativo cuenta desde el final
    const i = m < 0 ? m + MESES.length : m;
    if (i < 0 || i >= MESES.length) caer("fecha");
    f = `${dia} ${MESES[i]}`;
  } else {
    f = p.fecha_txt ?? "";
  }
  // la planilla 2025 no tiene el tanteo de cada partido: no se inventa un 0–0
  if (corta || p.fuente === "planilla") return `${f} · ${p.rival}`;
  return `${f} · UNI ${p.score_uni}–${p.score_rival} ${p.rival}`;
}
