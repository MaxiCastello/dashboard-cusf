// Las pestañas del tablero (cusf/vistas.py), traducidas tal cual. Cada una
// recibe una "temporada" (los partidos elegidos y su total), así la misma
// función sirve para la temporada entera y para un partido solo, y dibuja
// en un lienzo (lienzo.js): las pruebas comparan lo que dibuja con lo que
// dibuja hoy el Python, operación por operación.
//
// Criterio de los números: primero "X de Y" y después el porcentaje, sin
// jerga y sin decir si estuvo bien o mal.
import { etiqueta, pjTexto, resultado, sumar, tacklesTemporada } from "./calculos.js";
import { coma, conSigno, fijo, pct, unDecimal, xdey } from "./formato.js";
import { acumulado, apiladas, barras, chances22, dona, lineas, mapaCalor, marcadorEnElPartido, mariposa, pesas, piruletas, radar, sol }
  from "./graficos.js";
import { aclarar, anillos, html, kpis, tabla } from "./piezas.js";
import { MIN_AMARILLA, MIN_ROJA, OBJETIVOS, evaluar, minutosConUnoMenos, penales as penalesDe, temporada } from "./objetivos.js";
import { capitalizar, conDefecto, enteroDeTexto, esVerdad, mayuscula, o, soloCifras, str } from "./python.js";
import { ACENTO, AVISO, MAL, NEUTRO, RIVAL, UNI } from "./tema.js";

// ── Lo que usan varias pestañas ─────────────────────────────────────────────

// Situaciones de los penales: su color (Map: la situación viene de los datos)
const SIT_COLOR = new Map([["Scrum", ACENTO], ["Line", "#9fb8ff"], ["Ruck", UNI], ["Maul", "#7be0a5"], ["Juego", AVISO]]);

// Tipos de tackle (estilo.py: TK, TK_NOMBRE)
const TK = [["pos", "Positivos", UNI], ["neu", "Neutrales", NEUTRO], ["neg", "Negativos", AVISO], ["err", "Errados", MAL]];

// Formas de anotar: el mismo color en la torta de UNI y en la del rival
const FORMAS = [["Tries", 5, "tries", UNI], ["Tries penales", 7, "triesp", "#7be0a5"], ["Conversiones", 2, "conv", ACENTO],
  ["Penales a los palos", 3, "palos", "#9fb8ff"], ["Drops", 3, "drop", AVISO]];

// (también las usa el informe PDF: informe.js)
export const pen = penalesDe;
export const hechos = (filas) => filas.reduce((s, j) => s + j.pos + j.neu + j.neg, 0);
export const intentos = (filas) => hechos(filas) + filas.reduce((s, j) => s + j.err, 0);
export const pateo = (f) => [f.puntos.conv_u + f.puntos.palos_u, f.puntos.convt_u + f.puntos.palost_u];
// rótulos del eje de los gráficos: la fecha y el rival, en todos
const ejex = (ps) => ps.map((p) => etiqueta(p, true));
export const cuantos = (rs, x) => rs.filter((r) => r === x).length;
// de mayor a menor, y lo que no tiene valor (null) al final
export const desc = (a, b) => (a === b ? 0 : a === null ? 1 : b === null ? -1 : b - a);

// De dónde salieron los tries, sumando los partidos: [[origen, UNI, rival]],
// de más a menos (los empatados, en el orden en que aparecen).
export function origenesTries(ps) {
  const orig = new Map();
  for (const q of ps) {
    for (const [k, [u, r]] of q.tries_origen ?? []) {
      if (!orig.has(k)) orig.set(k, [0, 0]);
      orig.get(k)[0] += u;
      orig.get(k)[1] += r;
    }
  }
  return [...orig].sort(([, a], [, b]) => (b[0] + b[1]) - (a[0] + a[1])).map(([k, [u, r]]) => [k, u, r]);
}

// Los penales por situación: [[situación, UNI, rival]], de más a menos (los
// empatados, en el orden en que aparecen).
export function porSituacion(pens) {
  const sits = new Map();
  for (const f of pens) {
    if (!sits.has(f.situacion)) sits.set(f.situacion, [0, 0]);
    sits.get(f.situacion)[0] += f.uni;
    sits.get(f.situacion)[1] += f.rival;
  }
  return [...sits].sort(([, a], [, b]) => (b[0] + b[1]) - (a[0] + a[1])).map(([s, [u, r]]) => [s, u, r]);
}

export function nota(lz, txt) {
  lz.html(html`<div class="nota">${txt}</div>`);
}

// ── Encabezado de un partido ────────────────────────────────────────────────

export const RESULTADO = { G: "Ganado", P: "Perdido", E: "Empatado" };
export const ORIGEN = new Map([["unidat", "Cargado en Uni-Dat"], ["manual", "Cargado a mano en el tablero"],
  ["planilla", "Planilla 2025 (sólo tackles)"]]);

// El tanteo, arriba de las pestañas del partido (va antes que ellas).
export function marcador(lz, p) {
  const res = RESULTADO[resultado(p)];
  let origen = ORIGEN.get(p.fuente) ?? "";
  if (esVerdad(p.tarjetas_unidat)) origen += " (tarjetas corregidas en el tablero)";
  const cat = esVerdad(p.categoria) ? ` · ${str(p.categoria)}` : "";
  if (p.fuente === "planilla") {
    lz.html(html`<div class="marcador"><div class="info">${str(conDefecto(p, "fecha_txt", ""))} · ${p.rival}<br>${origen}</div></div>`);
    return;
  }
  // (html`` + html`` daría un texto común, que se escaparía: van juntos adentro de otro)
  const uni = html`<div class="eq">UNI<div class="n" style="color:${UNI}">${str(p.score_uni)}</div></div>`;
  const rival = html`<div class="eq">${mayuscula(p.rival)}<div class="n" style="color:${RIVAL}">${str(p.score_rival)}</div></div>`;
  lz.html(html`<div class="marcador">${uni}<div class="sep">–</div>${rival}</div><div class="nota" style="text-align:center">${
    etiqueta(p, true)}${cat} · ${res} · ${origen}</div>`);
}

// ── Resumen de la temporada ─────────────────────────────────────────────────

export function resumen(lz, t) {
  const ps = t.partidos, tot = t.totales, n = t.n_partidos;
  const items = [[n, "Partidos", null]];
  if (!t.planilla) {
    const r = ps.map(resultado);
    items.push([`${cuantos(r, "G")}-${cuantos(r, "E")}-${cuantos(r, "P")}`, "Ganó-empató-perdió", null]);
  }
  items.push([tot.score_uni, "Puntos a favor", UNI], [tot.score_rival, "Puntos en contra", RIVAL],
    [conSigno(tot.score_uni - tot.score_rival), "Diferencia", null]);
  if (n) items.push([unDecimal(pen(tot) / n), "Penales UNI por partido", null]);
  lz.html(kpis(items));

  if (!t.planilla && ps.length > 1) {
    const [c1, c2] = lz.columnas([1, 2], "large");
    const r = ps.map(resultado), [g, e, p] = ["G", "E", "P"].map((x) => cuantos(r, x));
    c1.titulo("Resultados");
    c1.grafico(dona(["Ganados", "Empatados", "Perdidos"], [g, e, p], [UNI, NEUTRO, MAL], `${g}-${e}-${p}`, "ganó-empató-perdió"));
    c2.titulo("Partido a partido");
    c2.grafico(pesas(ejex(ps), ps.map((x) => x.score_uni), ps.map((x) => x.score_rival),
      { tituloX: "Puntos", textos: ps.map((x) => `   ${x.score_uni}–${x.score_rival}`) }));
  }

  lz.titulo("UNI en números");
  const [a, b] = pateo(tot);
  const items2 = [["Line propio ganado", tot.line.uGan, tot.line.uLan, UNI, null],
    ["Scrum propio ganado", tot.scrum.uGan, tot.scrum.uLan, UNI, null],
    ["Salidas propias ganadas", tot.salida.uGan, tot.salida.uPro, UNI, null],
    ["Pateo a los palos", a, b, ACENTO, null]];
  const jug = tacklesTemporada(ps);
  if (jug.length) items2.push(["Tackles completados", hechos(jug), intentos(jug), UNI, null]);
  if (tot.efectividad_22) {
    const ef = tot.efectividad_22;
    items2.push(["Chances en 22 concretadas", ef.concretadas, ef.chances, ACENTO, null]);
  }
  lz.html(anillos(items2));

  // sorted(key=-hechos)[:8]: estable, los empates quedan en su orden
  const top = jug.filter((j) => hechos([j])).sort((x, y) => hechos([y]) - hechos([x])).slice(0, 8);
  let col;
  if (!t.planilla && ps.length > 1) {
    const [c1, c2] = lz.columnas(2, "large");
    c1.titulo("Puntos sumados en la temporada");
    c1.grafico(acumulado(ejex(ps), ps.map((x) => x.score_uni), ps.map((x) => x.score_rival)));
    col = c2;
  } else {
    col = lz.contenedor();
  }
  if (top.length) {
    col.titulo("Los que más tacklearon");
    col.grafico(piruletas(top.map((j) => j.nombre), top.map((j) => j.pos + j.neu + j.neg)));
    nota(col, "Tackles hechos (positivos, neutrales y negativos).");
  }
}

// ── Partido a partido ───────────────────────────────────────────────────────

export function evolucion(lz, t) {
  const ps = t.partidos;
  if (t.planilla) {
    nota(lz, "De 2025 sólo hay totales de la temporada: no se puede ver partido a partido, " +
      "salvo los tackles (pestaña TACKLES) y las chances en 22 (pestaña PUNTOS).");
    return;
  }
  if (!ps.length) return;
  // `_intentos(...) or "—"`: sin tackles (0) va la raya
  const filas = ps.map((p) => [etiqueta(p, true), `${resultado(p)} ${p.score_uni}–${p.score_rival}`,
    xdey(p.line.uGan, p.line.uLan), xdey(p.scrum.uGan, p.scrum.uLan), pen(p), o(intentos(p.tackles), "—")]);
  lz.html(tabla(["Partido", "Resultado", "Line propio", "Scrum propio", "Penales UNI", "Tackles"], filas));
  if (ps.length < 2) return;
  const x = ejex(ps), tot = t.totales, n = ps.length;

  lz.titulo("Formaciones propias ganadas, partido a partido");
  // una pestaña por formación y el gráfico a todo el ancho: con muchos
  // partidos, tres gráficos lado a lado no dejan leer los rivales
  const formas = [["Line", "line", "uLan"], ["Scrum", "scrum", "uLan"], ["Salidas", "salida", "uPro"]];
  lz.pestanas(formas.map(([r]) => r)).forEach((pestana, i) => {
    const [, k, lan] = formas[i];
    const rlan = lan === "uLan" ? "rLan" : "rPro";
    const series = [["UNI", "uGan", lan, UNI], ["Rival", "rGan", rlan, RIVAL]].map(([nombre, g, l, color]) =>
      [nombre, ps.map((p) => (p[k][l] ? pct(p[k][g], p[k][l]) : null)), color, ps.map((p) => xdey(p[k][g], p[k][l]))]);
    const f = tot[k];
    const refs = [[f[lan] ? pct(f.uGan, f[lan]) : null, "UNI en la temporada", UNI]];
    if (k !== "salida") refs.push([100, "Objetivo: 100%", AVISO]);
    pestana.grafico(lineas(x, series, { alto: 320, porCiento: true, referencias: refs }));
  });
  nota(lz, "Arriba se elige Line, Scrum o Salidas. La línea punteada verde es UNI sumando toda la temporada; " +
    "la amarilla, el objetivo. Pasá el dedo o el mouse por un punto para ver el X de Y.");

  const [c1, c2] = lz.columnas(2, "large");
  c1.titulo("Puntos por partido");
  c1.grafico(lineas(x, [["UNI", ps.map((p) => p.score_uni), UNI, null], ["Rival", ps.map((p) => p.score_rival), RIVAL, null]],
    { referencias: [[tot.score_uni / n, "Promedio UNI", UNI]] }));
  c2.titulo("Penales cometidos");
  c2.grafico(lineas(x, [["UNI", ps.map((p) => pen(p)), UNI, null], ["Rival", ps.map((p) => pen(p, "rival")), RIVAL, null]],
    { referencias: [[pen(tot) / n, "Promedio UNI", UNI], [10, "Objetivo: menos de 10", AVISO]] }));
  const conTk = ps.filter((p) => p.tackles.length);
  if (conTk.length > 1) {
    lz.titulo("Tackles completados, partido a partido");
    const jug = tacklesTemporada(ps);
    lz.grafico(lineas(ejex(conTk), [["Completados", conTk.map((p) => pct(hechos(p.tackles), intentos(p.tackles))), UNI,
      conTk.map((p) => xdey(hechos(p.tackles), intentos(p.tackles)))]],
    { alto: 260, porCiento: true, referencias: [[pct(hechos(jug), intentos(jug)), "Temporada", UNI]] }));
  }
}

// ── Puntos ──────────────────────────────────────────────────────────────────

// Chances en 22 rival: el total y, si hay más de un partido, uno por renglón.
function chancesEn22(lz, t) {
  const e = t.totales.efectividad_22;
  if (!e) return;
  const filas = t.planilla
    ? t.serie_22.map((r) => [r.rival, r.concretadas, r.chances])
    : t.partidos.filter((p) => p.efectividad_22).map((p) => [etiqueta(p, true), p.efectividad_22.concretadas, p.efectividad_22.chances]);
  lz.titulo("Chances en 22 rival");
  const [c1, c2] = lz.columnas([1, 3], "large");
  c1.html(anillos([["Concretadas", e.concretadas, e.chances, ACENTO, "UNI"]], 1));
  if (filas.length > 1) c2.grafico(chances22(filas.map((f) => f[0]), filas.map((f) => f[2]), filas.map((f) => f[1])));
  nota(lz, "Cuántas veces UNI entró en la 22 rival y cuántas de esas terminaron en puntos. " +
    "Se carga a mano: Uni-Dat no registra las chances en 22.");
}

export function puntos(lz, t) {
  const p = t.totales.puntos;
  const cols = lz.columnas(2, "large");
  [["u", "UNI"], ["r", "el rival"]].forEach(([lado, quien], i) => {
    const vals = FORMAS.map(([, v, k]) => p[`${k}_${lado}`] * v);
    cols[i].titulo(`Cómo hizo los puntos ${quien}`);
    if (vals.some(Boolean)) {
      cols[i].grafico(dona(FORMAS.map(([n]) => n), vals, FORMAS.map((f) => f[3]), vals.reduce((s, v) => s + v, 0), "puntos", 300));
    } else {
      nota(cols[i], "Sin puntos.");
    }
  });
  nota(lz, "Puntos de cada forma de anotar: un try vale 5, un try penal 7, una conversión 2, un penal o un drop 3.");

  lz.titulo("Pateo a los palos");
  const items = [];
  for (const [lado, quien, color] of [["u", "UNI", UNI], ["r", "Rival", RIVAL]]) {
    items.push(["Conversiones", p[`conv_${lado}`], p[`convt_${lado}`], color, quien],
      ["Penales", p[`palos_${lado}`], p[`palost_${lado}`], color, quien]);
    if (p.dropt_u || p.dropt_r) items.push(["Drops", p[`drop_${lado}`], p[`dropt_${lado}`], color, quien]);
  }
  lz.html(anillos(items));

  const orig = origenesTries(t.partidos);
  if (orig.length) {
    const [c1] = lz.columnas([3, 2], "large");
    c1.titulo("De dónde salieron los tries");
    c1.grafico(mariposa(orig.map(([k]) => capitalizar(k)), orig.map((o) => o[1]), orig.map((o) => o[2])));
    nota(c1, "UNI a la izquierda, el rival a la derecha.");
  }
  chancesEn22(lz, t);
}

// ── Formaciones ─────────────────────────────────────────────────────────────

// Ganados (todos los partidos) y recuperados (sólo los partidos que tienen
// ese dato: a uno cargado a mano le puede faltar).
function anillosFp(lz, t, k, lan, rlan, rotPropio, rotRec) {
  const f = t.totales[k];
  const items = [[rotPropio, f.uGan, f[lan], UNI, "UNI"], [rotPropio, f.rGan, f[rlan], RIVAL, "Rival"]];
  let rec = f, sin = [];
  if (f.uRec === null) {
    const con = t.partidos.filter((p) => p[k].uRec !== null);
    sin = t.partidos.filter((p) => p[k].uRec === null).map((p) => p.rival);
    rec = con.length ? sumar(con)[k] : null;
  }
  if (rec) {
    items.push([`${rotRec} al rival`, rec.uRec, rec[rlan], UNI, "UNI"], [`${rotRec} a UNI`, rec.rRec, rec[lan], RIVAL, "Rival"]);
  }
  lz.html(anillos(items, items.length === 4 ? 2 : null));
  if (rec && sin.length) nota(lz, `${rotRec}: sin ${sin.join(", ")} (cargado a mano sin ese dato).`);
}

export function formaciones(lz, t) {
  const tot = t.totales;
  const cols = lz.columnas(2, "large");
  [["Line", "line"], ["Scrum", "scrum"]].forEach(([titulo, k], i) => {
    cols[i].titulo(titulo);
    anillosFp(cols[i], t, k, "uLan", "rLan", "Propios ganados", "Recuperados");
  });
  const salidas = [["Salidas", "salida"], ["Salidas de 22", "salida22"], ["Salidas del ingoal", "salida_ingoal"]]
    .filter(([, k]) => tot[k].uPro || tot[k].rPro);
  if (salidas.length) {
    const c = lz.columnas(2, "large");
    salidas.forEach(([nombre, k], i) => {
      c[i % 2].titulo(nombre);
      anillosFp(c[i % 2], t, k, "uPro", "rPro", "Propias ganadas", "Recuperadas");
    });
  }

  // Line de UNI por cantidad de jugadores y posición (como en Uni-Dat)
  const celdas = new Map();
  for (const p of t.partidos) {
    for (const [k, [g, n]] of Object.entries(p.line_tabla ?? {})) {
      if (!celdas.has(k)) celdas.set(k, [0, 0]);
      celdas.get(k)[0] += g;
      celdas.get(k)[1] += n;
    }
  }
  const [c1, c2] = lz.columnas([3, 2], "large");
  if (celdas.size) {
    // sorted(key=(x == "S/D", int(x) si es número)): los números de menor a mayor, S/D al final
    const clave = (x) => [x === "S/D" ? 1 : 0, soloCifras(x) ? enteroDeTexto(x) : 0];
    const orden = (xs) => [...new Set(xs)].sort((a, b) => {
      const [ka, kb] = [clave(a), clave(b)];
      return ka[0] - kb[0] || ka[1] - kb[1];
    });
    const jug = orden([...celdas.keys()].map((k) => k.split("|")[0]));
    const zon = orden([...celdas.keys()].map((k) => k.split("|")[1]));
    const celda = (j, z, i) => (celdas.get(`${j}|${z}`) ?? [0, 0])[i];
    c1.titulo("Line de UNI: jugadores y posición");
    c1.grafico(mapaCalor(jug.map((j) => (j !== "S/D" ? `${j} jugadores` : "S/D")), zon.map((z) => (z !== "S/D" ? `${z}° posición` : "S/D")),
      jug.map((j) => zon.map((z) => celda(j, z, 0))), jug.map((j) => zon.map((z) => celda(j, z, 1)))));
    nota(c1, "Ganados de tirados en cada combinación; el color va del rojo (pocos) al verde (muchos). " +
      "Sólo partidos cargados en Uni-Dat.");
  }
  if (tot.knockons) {
    const k = tot.knockons;
    const col = celdas.size ? c2 : lz.contenedor();
    col.titulo("Knock-ons");
    col.grafico(dona(["UNI", "Rival"], [k.uni, k.rival], [UNI, RIVAL], k.uni + k.rival, "knock-ons", 260));
  }
}

// ── Penales ─────────────────────────────────────────────────────────────────

export function penales(lz, t) {
  const tot = t.totales, n = Math.max(t.n_partidos, 1);
  const pu = pen(tot), pr = pen(tot, "rival");
  const items = [[pu, "Cometidos por UNI", UNI], [pr, "Cometidos por el rival", RIVAL]];
  if (n > 1) items.splice(1, 0, [unDecimal(pu / n), "UNI por partido", UNI]);
  lz.html(kpis(items));
  if (!tot.penales.length) nota(lz, "No hay penales cargados.");
  else penalesDetalle(lz, t, tot.penales);
  tarjetas(lz, t);
}

// Tarjetas y el tiempo jugado con uno menos (UNI y el rival).
function tarjetas(lz, t) {
  const tj = t.totales.tarjetas, ps = t.partidos, n = Math.max(t.n_partidos, 1);
  const mu = minutosConUnoMenos(tj, "u"), mr = minutosConUnoMenos(tj, "r");
  lz.titulo("Tarjetas");
  if (t.planilla) {   // sin el dato no es cero: no se muestran ceros
    nota(lz, "La planilla 2025 no tiene las tarjetas.");
    return;
  }
  const items = [[tj.am_u, "Amarillas UNI", AVISO], [tj.ro_u, "Rojas UNI", MAL]];
  if (n > 1) items.push([coma((tj.am_u + tj.ro_u) / n), "Tarjetas UNI por partido", null]);
  items.push([`${mu}'`, "Minutos UNI con uno menos", UNI], [`${mr}'`, "Minutos del rival con uno menos", RIVAL]);
  lz.html(kpis(items));
  if (ps.length > 1 && ps.some((p) => ["u", "r"].some((l) => minutosConUnoMenos(p.tarjetas, l)))) {
    const hov = (p, l) => `${minutosConUnoMenos(p.tarjetas, l)} min · ${p.tarjetas[`am_${l}`]} amarilla(s), ${p.tarjetas[`ro_${l}`]} roja(s)`;
    lz.titulo("Minutos con uno menos, partido a partido");
    lz.grafico(barras(ejex(ps), [
      ["UNI", ps.map((p) => minutosConUnoMenos(p.tarjetas, "u")), UNI, ps.map((p) => hov(p, "u"))],
      ["Rival", ps.map((p) => minutosConUnoMenos(p.tarjetas, "r")), RIVAL, ps.map((p) => hov(p, "r"))]],
    { tituloY: "Minutos", sufijo: "'" }));
  }
  nota(lz, `Cada amarilla son ${MIN_AMARILLA} minutos afuera y cada roja ${MIN_ROJA} ` +
    "(la roja de 20 minutos: después entra un reemplazo; si la roja es definitiva, el equipo " +
    `sigue con uno menos hasta el final y acá igual se cuentan ${MIN_ROJA}). ` +
    "Objetivo: 0 tarjetas por partido.");
}

function penalesDetalle(lz, t, pens) {
  const sits = porSituacion(pens);
  const [c1, c2] = lz.columnas(2, "large");
  c1.titulo("Dónde se cometen");
  c1.grafico(mariposa(sits.map((s) => s[0]), sits.map((s) => s[1]), sits.map((s) => s[2])));
  nota(c1, "UNI a la izquierda, el rival a la derecha.");
  const conPer = t.partidos.filter((p) => p.periodos);
  if (conPer.length) {
    c1.titulo("Por tiempo");
    const a = (per, k) => conPer.reduce((s, p) => s + p.periodos[per][k], 0);
    c1.grafico(mariposa(["1° tiempo", "2° tiempo"], [a("PT", "pen_u"), a("ST", "pen_u")], [a("PT", "pen_r"), a("ST", "pen_r")],
      { alto: 160 }));
    if (conPer.length < t.partidos.length) {
      nota(c1, `Sólo los ${conPer.length} partidos cargados en Uni-Dat tienen el tiempo de cada penal.`);
    }
  }
  c2.titulo("Los de UNI: situación y motivo");
  const uni = pens.filter((f) => f.uni);
  if (uni.length) {
    const sitU = new Map();
    for (const f of uni) sitU.set(f.situacion, (sitU.get(f.situacion) ?? 0) + f.uni);
    const etq = [], pad = [], val = [], col = [];
    for (const [s, v] of sitU) {
      etq.push(s);
      pad.push("");
      val.push(v);
      col.push(SIT_COLOR.get(s) ?? NEUTRO);
    }
    for (const f of uni) {
      etq.push(f.motivo);
      pad.push(f.situacion);
      val.push(f.uni);
      col.push(aclarar(SIT_COLOR.get(f.situacion) ?? NEUTRO));
    }
    c2.grafico(sol(etq, pad, val, col));
    nota(c2, "Adentro, dónde; afuera, el motivo. Tocá una parte para abrirla.");
    const mot = [...uni].sort((a, b) => b.uni - a.uni).slice(0, 10);
    c2.desplegable("Ver la lista de motivos").html(tabla(["Motivo", "Situación", "UNI", "Rival"],
      mot.map((f) => [f.motivo, f.situacion, f.uni, f.rival])));
  }
}

// ── Objetivos ───────────────────────────────────────────────────────────────

// "8 de 9 · 89%" o la cantidad.
const valor = (e) => (e.b !== null ? xdey(e.a, e.b) : str(e.a));

function celda(e) {
  if (e === null) return html`<td class="obj sd">sin datos</td>`;
  const [marca, clase] = e.cumple ? ["✓", "ok"] : ["✗", "no"];
  return html`<td class="obj ${clase}">${marca} ${valor(e)}</td>`;
}

// Un partido en la card: ✓ cumplido, ✗ no, vacío sin datos.
function cuadradito(e, p) {
  const [marca, clase] = e && e.cumple ? ["✓", "ok"] : e ? ["✗", "no"] : ["", "sd"];
  const txt = `${etiqueta(p, true)}: ${e ? valor(e) : "sin datos"}`;
  return html`<span class="${clase}" title="${txt}">${marca}</span>`;
}

// (`<div class=pts>` sin comillas, como en el Python: el HTML tiene que ser el mismo)
function card(nombre, meta, grande, chico, abajo, puntos = "", clase = "") {
  return html`<div class="objc"><div class="n">${nombre}</div><div class="m">${meta}</div><div class="v ${clase}">${grande}<small>${
    chico}</small></div>${String(puntos) ? html`<div class=pts>${puntos}</div>` : ""}<div class="t">${abajo}</div></div>`;
}

export function objetivos(lz, t) {
  const ps = t.partidos;
  if (t.planilla) {
    nota(lz, "La planilla 2025 no tiene estos datos partido a partido: los objetivos se miden desde 2026.");
    return;
  }
  if (!ps.length) return;
  if (ps.length === 1) {
    const cards = OBJETIVOS.map((ob) => {
      const e = evaluar(ob, ps[0]);
      return e
        ? card(ob.nombre, ob.meta, e.cumple ? "✓ Sí" : "✗ No", "", `En el partido: ${valor(e)}`, "", e.cumple ? "ok" : "no")
        : card(ob.nombre, ob.meta, "—", "sin datos", "");
    });
    lz.html(html`<div class="objs">${cards}</div>`);
    return;
  }
  const cards = OBJETIVOS.map((ob) => {
    const s = temporada(ob, ps);
    let temp;
    if (!s.medidos) temp = "Sin datos en ningún partido";
    else if (s.b !== null) temp = `Temporada: ${xdey(s.a, s.b)}`;
    else temp = `Temporada: ${coma(s.a / s.medidos)} por partido`;
    if (s.sin_datos && s.medidos) temp += ` (${s.sin_datos} sin datos)`;
    const puntos = html`${ps.map((p) => cuadradito(evaluar(ob, p), p))}`;
    const grande = s.medidos ? `${s.cumplidos} de ${s.medidos}` : "—";
    return card(ob.nombre, ob.meta, grande, s.medidos ? "partidos" : "", temp, puntos);
  });
  lz.titulo("En cuántos partidos se cumplió cada objetivo");
  lz.html(html`<div class="objs">${cards}</div>`);
  nota(lz, "Cada cuadradito es un partido, del primero al último: ✓ se cumplió, ✗ no, vacío si falta el dato. " +
    "Temporada: la suma de los partidos que tienen el dato (en penales y tarjetas, el promedio por partido).");
  lz.titulo("Partido a partido");
  const cab = OBJETIVOS.map((ob) => html`<th>${ob.nombre}</th>`);
  const cuerpo = [...ps].reverse().map((p) => html`<tr><td>${etiqueta(p, true)}</td>${OBJETIVOS.map((ob) => celda(evaluar(ob, p)))}</tr>`);
  lz.html(html`<div class="tabla-scroll"><table class="t objetivos"><thead><tr><th>Partido</th>${cab}</tr></thead><tbody>${
    cuerpo}</tbody></table></div>`);
  nota(lz, "Las chances en 22 se cargan a mano (Uni-Dat no las registra) y las salidas del rival que " +
    "se quedó UNI sólo están en los partidos cargados en Uni-Dat: por eso a algunos les falta el dato.");
}

// ── Tackles ─────────────────────────────────────────────────────────────────

// La configuración de las columnas de la tabla, tal como la anota Streamlit
// (st.column_config.TextColumn("PJ", width=210) y la ProgressColumn).
const CONFIG_TACKLES = {
  PJ: { label: "PJ", width: 210, help: null, disabled: null, required: null, pinned: null, default: null,
    type_config: { type: "text", max_chars: null, validate: null } },
  Completados: { label: "Completados", width: null, help: null, pinned: null,
    type_config: { type: "progress", format: "%d%%", min_value: 0, max_value: 100, step: null, color: null } },
};

export function tackles(lz, t, partido = null) {
  const ps = partido ? [partido] : t.partidos;
  const jug = tacklesTemporada(ps);
  if (!jug.length) {
    nota(lz, "No hay tackles cargados para estos partidos.");
    return;
  }
  const tipos = Object.fromEntries(TK.map(([k]) => [k, jug.reduce((s, j) => s + j[k], 0)]));
  const total = intentos(jug), hech = hechos(jug);
  const conTk = ps.filter((p) => p.tackles.length).length;
  const items = [[total, "Intentos de tackle", null], [`${hech} de ${total}`, "Completados", UNI], [tipos.err, "Errados", MAL]];
  if (conTk > 1) items.splice(1, 0, [fijo(total / conTk, 0), "Intentos por partido", null]);
  lz.html(kpis(items));

  const [c1, c2] = lz.columnas(2, "large");
  c1.titulo("Cómo fueron");
  c1.grafico(dona(TK.map(([, n]) => n), TK.map(([k]) => tipos[k]), TK.map(([, , c]) => c), `${pct(hech, total)}%`,
    `completados · ${hech} de ${total}`, 300));
  nota(c1, "Un tackle negativo se completó igual; el único no completado es el errado (como en el Tackle Tracker).");
  if (partido && partido.tackles.some((f) => f.pt || f.st)) {
    c2.titulo("Por tiempo");
    const s = (k) => partido.tackles.reduce((a, f) => a + f[k], 0);
    c2.html(anillos([["Completados", s("pt") - s("pt_err"), s("pt"), UNI, "1° tiempo"],
      ["Completados", s("st") - s("st_err"), s("st"), UNI, "2° tiempo"]]));
  }
  const top = jug.filter((j) => hechos([j])).sort((x, y) => hechos([y]) - hechos([x])).slice(0, 8);
  c2.titulo("Los que más tacklearon");
  c2.grafico(piruletas(top.map((j) => j.nombre), top.map((j) => hechos([j]))));

  lz.titulo("Por jugador");
  const int1 = (j) => intentos([j]);
  const orden = jug.filter(int1).sort((x, y) => int1(y) - int1(x)).slice(0, 18);
  lz.grafico(apiladas(orden.map((j) => j.nombre), TK.map(([k, n, c]) => [n, orden.map((j) => j[k]), c])));
  if (jug.length > orden.length) nota(lz, `Los ${orden.length} con más intentos; la tabla de abajo tiene a los ${jug.length}.`);

  // la tabla: ordenada por Hechos y Completados, de mayor a menor (sort_values
  // de pandas: estable; sin intentos no hay porcentaje, y el vacío va al final)
  const filas = jug.map((j) => {
    const h = hechos([j]);
    return { Jugador: j.nombre, PJ: pjTexto(j), Hechos: h, Errados: j.err, Completados: int1(j) ? pct(h, int1(j)) : null,
      Positivos: j.pos, Neutrales: j.neu, Negativos: j.neg };
  });
  filas.sort((a, b) => desc(a.Hechos, b.Hechos) || desc(a.Completados, b.Completados));
  const cols = ["Jugador", "PJ", "Hechos", "Errados", "Completados", "Positivos", "Neutrales", "Negativos"].filter((c) => !partido || c !== "PJ");
  lz.tablaDatos(cols, filas.map((f) => cols.map((c) => f[c])), Math.min(38 + 35 * filas.length, 740), CONFIG_TACKLES);
  if (!partido) {
    nota(lz, "PJ = partidos en los que estuvo en la lista del Tackle Tracker, aunque no haya tackleado. " +
      "Titular: jugó con la camiseta 1 a 15 en ese partido; suplente: de la 16 en adelante.");
  }
}

// ── Un partido ──────────────────────────────────────────────────────────────

// Las pestañas de un partido, en orden (las de dashboard.py, sin el Informe):
// [la sección (como en exportar_secciones.py), el rótulo, dibujar(lz, p, t, tp)].
// tp es el partido como una temporada de uno (una()): así reusan las de la
// temporada. La página y las pruebas usan esta misma lista.
export const SECCIONES_PARTIDO = [
  ["resumen", "Resumen", (lz, p, t, tp) => partidoResumen(lz, p, t, tp)],
  ["tiempos", "1° vs 2° tiempo", (lz, p) => tiempos(lz, p)],
  ["puntos", "Puntos", (lz, p, t, tp) => puntos(lz, tp)],
  ["formaciones", "Formaciones", (lz, p, t, tp) => formaciones(lz, tp)],
  ["penales", "Penales", (lz, p, t, tp) => penales(lz, tp)],
  ["tackles", "Tackles", (lz, p, t, tp) => tackles(lz, tp, p)],
  ["objetivos", "Objetivos", (lz, p, t, tp) => objetivos(lz, tp)],
];

// tp: el partido como temporada de uno (una() de calculos.js).
export function partidoResumen(lz, p, t, tp) {
  if (esVerdad(p.marcador)) {
    lz.titulo("Cómo se fue dando el marcador");
    lz.grafico(marcadorEnElPartido(p.marcador));
    nota(lz, "Cada paso es una anotación, en el orden en que se cargó (Uni-Dat no guarda los minutos).");
  }
  if (t.partidos.length >= 2) contraTemporada(lz, p, t);
  else formaciones(lz, tp);   // sin temporada para comparar: lo principal del partido
}

const LADOS_TIEMPO = ["Puntos", "Tries", "Penales cometidos", "Knock-ons", "Tarjetas"];

export function tiempos(lz, p) {
  if (!esVerdad(p.periodos)) {
    nota(lz, "Este partido no tiene el detalle por tiempo (se cargó a mano o viene de la planilla).");
    return;
  }
  const a = p.periodos.PT, b = p.periodos.ST;
  const cols = lz.columnas(2, "large");
  [["UNI", "u"], ["Rival", "r"]].forEach(([quien, l], i) => {
    const de = (s) => ["pts", "tries", "pen", "ko", "tar"].map((k) => s[`${k}_${l}`]);
    cols[i].titulo(quien);
    cols[i].grafico(mariposa(LADOS_TIEMPO, de(a), de(b), { nombres: ["1° tiempo", "2° tiempo"], colores: [ACENTO, "#9fb8ff"] }));
  });
  nota(lz, "El 1° tiempo a la izquierda y el 2° a la derecha." +
    (esVerdad(p.tarjetas_unidat) ? " Las tarjetas por tiempo son las de Uni-Dat: el total del partido se corrigió en el tablero." : ""));
  lz.titulo("Formaciones propias ganadas");
  const items = [];
  for (const [s, per] of [[a, "1° tiempo"], [b, "2° tiempo"]]) {
    items.push(["Line propio", s.line.uGan, s.line.uLan, UNI, `${per} · UNI`],
      ["Scrum propio", s.scrum.uGan, s.scrum.uLan, UNI, `${per} · UNI`],
      ["Salidas propias", s.salida.uGan, s.salida.uPro, UNI, `${per} · UNI`]);
  }
  lz.html(anillos(items));
  const formas = [["Line", "line", "uLan", "rLan"], ["Scrum", "scrum", "uLan", "rLan"], ["Salidas", "salida", "uPro", "rPro"]];
  lz.desplegable("Ver también los del rival").html(tabla(["", "1° T UNI", "1° T Rival", "2° T UNI", "2° T Rival"],
    formas.map(([n, k, l, rl]) => [n, xdey(a[k].uGan, a[k][l]), xdey(a[k].rGan, a[k][rl]), xdey(b[k].uGan, b[k][l]),
      xdey(b[k].rGan, b[k][rl])])));
}

// Este partido al lado de la temporada (sin juzgar).
export function contraTemporada(lz, p, t) {
  const otros = t.partidos, n = otros.length, tot = t.totales;
  const jugT = tacklesTemporada(otros);
  const [pa, pb] = pateo(p), [ta, tb] = pateo(tot);
  const ejes = [["Line propio", p.line.uGan, p.line.uLan, tot.line.uGan, tot.line.uLan],
    ["Scrum propio", p.scrum.uGan, p.scrum.uLan, tot.scrum.uGan, tot.scrum.uLan],
    ["Salidas propias", p.salida.uGan, p.salida.uPro, tot.salida.uGan, tot.salida.uPro],
    ["Pateo a los palos", pa, pb, ta, tb],
    ["Tackles completados", hechos(p.tackles), intentos(p.tackles), hechos(jugT), intentos(jugT)]]
    .filter((e) => esVerdad(e[2]) && esVerdad(e[4]));
  const [c1, c2] = lz.columnas([1, 1], "large");
  c1.titulo("Este partido y la temporada");
  if (ejes.length >= 3) {
    c1.grafico(radar(ejes.map((e) => e[0]), [
      ["Temporada", ejes.map((e) => pct(e[3], e[4])), "#8b93a3", "rgba(139,147,163,.15)", ejes.map((e) => xdey(e[3], e[4]))],
      ["Este partido", ejes.map((e) => pct(e[1], e[2])), UNI, "rgba(0,200,83,.22)", ejes.map((e) => xdey(e[1], e[2]))]]));
    nota(c1, `Lo ganado de cada cosa, en %. La temporada suma sus ${n} partidos.`);
  }
  const prom = (v) => unDecimal(v / n);
  const x = (f, g, l) => xdey(f[g], f[l]);
  c2.titulo("En números");
  c2.html(tabla(["", "Este partido", `Temporada (${n})`], [
    ["Puntos a favor", p.score_uni, prom(tot.score_uni)],
    ["Puntos en contra", p.score_rival, prom(tot.score_rival)],
    ["Line propio ganado", x(p.line, "uGan", "uLan"), x(tot.line, "uGan", "uLan")],
    ["Scrum propio ganado", x(p.scrum, "uGan", "uLan"), x(tot.scrum, "uGan", "uLan")],
    ["Salidas propias ganadas", x(p.salida, "uGan", "uPro"), x(tot.salida, "uGan", "uPro")],
    ["Pateo a los palos", xdey(pa, pb), xdey(ta, tb)],
    ["Penales cometidos por UNI", pen(p), prom(pen(tot))]]));
  nota(c2, "En puntos y penales, la temporada es el promedio por partido; en el resto, la suma.");
}
