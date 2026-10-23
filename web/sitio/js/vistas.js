// Las pestañas del tablero (cusf/vistas.py), traducidas tal cual. Cada una
// recibe una "temporada" (los partidos elegidos y su total), así la misma
// función sirve para la temporada entera y para un partido solo, y dibuja
// en un lienzo (lienzo.js): las pruebas comparan lo que dibuja con lo que
// dibuja hoy el Python, operación por operación.
//
// Criterio de los números: primero "X de Y" y después el porcentaje, sin
// jerga y sin decir si estuvo bien o mal.
import { etiqueta, resultado, tacklesTemporada } from "./calculos.js";
import { conSigno, pct, unDecimal, xdey } from "./formato.js";
import { acumulado, chances22, dona, lineas, mariposa, pesas, piruletas } from "./graficos.js";
import { anillos, html, kpis, tabla } from "./piezas.js";
import { capitalizar, o } from "./python.js";
import { ACENTO, AVISO, MAL, NEUTRO, RIVAL, UNI } from "./tema.js";

// ── Lo que usan varias pestañas ─────────────────────────────────────────────

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
