// Las pestañas del tablero (cusf/vistas.py), traducidas tal cual. Cada una
// recibe una "temporada" (los partidos elegidos y su total), así la misma
// función sirve para la temporada entera y para un partido solo, y dibuja
// en un lienzo (lienzo.js): las pruebas comparan lo que dibuja con lo que
// dibuja hoy el Python, operación por operación.
//
// Criterio de los números: primero "X de Y" y después el porcentaje, sin
// jerga y sin decir si estuvo bien o mal.
import { etiqueta, resultado, sumar, tacklesTemporada } from "./calculos.js";
import { coma, conSigno, pct, unDecimal, xdey } from "./formato.js";
import { acumulado, barras, chances22, dona, lineas, mapaCalor, mariposa, pesas, piruletas, sol } from "./graficos.js";
import { aclarar, anillos, html, kpis, tabla } from "./piezas.js";
import { MIN_AMARILLA, MIN_ROJA, minutosConUnoMenos } from "./objetivos.js";
import { capitalizar, enteroDeTexto, o, soloCifras } from "./python.js";
import { ACENTO, AVISO, MAL, NEUTRO, RIVAL, UNI } from "./tema.js";

// ── Lo que usan varias pestañas ─────────────────────────────────────────────

// Situaciones de los penales: su color (Map: la situación viene de los datos)
const SIT_COLOR = new Map([["Scrum", ACENTO], ["Line", "#9fb8ff"], ["Ruck", UNI], ["Maul", "#7be0a5"], ["Juego", AVISO]]);

// Formas de anotar: el mismo color en la torta de UNI y en la del rival
const FORMAS = [["Tries", 5, "tries", UNI], ["Tries penales", 7, "triesp", "#7be0a5"], ["Conversiones", 2, "conv", ACENTO],
  ["Penales a los palos", 3, "palos", "#9fb8ff"], ["Drops", 3, "drop", AVISO]];

const pen = (f, lado = "uni") => f.penales.reduce((s, x) => s + x[lado], 0);
const hechos = (filas) => filas.reduce((s, j) => s + j.pos + j.neu + j.neg, 0);
const intentos = (filas) => hechos(filas) + filas.reduce((s, j) => s + j.err, 0);
const pateo = (f) => [f.puntos.conv_u + f.puntos.palos_u, f.puntos.convt_u + f.puntos.palost_u];
// rótulos del eje de los gráficos: la fecha y el rival, en todos
const ejex = (ps) => ps.map((p) => etiqueta(p, true));
const cuantos = (rs, x) => rs.filter((r) => r === x).length;

export function nota(lz, txt) {
  lz.html(html`<div class="nota">${txt}</div>`);
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

  // de dónde salieron los tries: en el orden en que aparecen, de más a menos
  const orig = new Map();
  for (const q of t.partidos) {
    for (const [k, [u, r]] of q.tries_origen ?? []) {
      if (!orig.has(k)) orig.set(k, [0, 0]);
      orig.get(k)[0] += u;
      orig.get(k)[1] += r;
    }
  }
  if (orig.size) {
    const [c1] = lz.columnas([3, 2], "large");
    c1.titulo("De dónde salieron los tries");
    const ks = [...orig.keys()].sort((a, b) => (orig.get(b)[0] + orig.get(b)[1]) - (orig.get(a)[0] + orig.get(a)[1]));
    c1.grafico(mariposa(ks.map(capitalizar), ks.map((k) => orig.get(k)[0]), ks.map((k) => orig.get(k)[1])));
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
  // por situación, en el orden en que aparecen; de más a menos
  const sits = new Map();
  for (const f of pens) {
    if (!sits.has(f.situacion)) sits.set(f.situacion, [0, 0]);
    sits.get(f.situacion)[0] += f.uni;
    sits.get(f.situacion)[1] += f.rival;
  }
  const total = (s) => sits.get(s)[0] + sits.get(s)[1];
  const orden = [...sits.keys()].sort((a, b) => total(b) - total(a));
  const [c1, c2] = lz.columnas(2, "large");
  c1.titulo("Dónde se cometen");
  c1.grafico(mariposa(orden, orden.map((s) => sits.get(s)[0]), orden.map((s) => sits.get(s)[1])));
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
