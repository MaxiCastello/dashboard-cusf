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
import { acumulado, dona, lineas, pesas, piruletas } from "./graficos.js";
import { anillos, html, kpis, tabla } from "./piezas.js";
import { o } from "./python.js";
import { ACENTO, AVISO, MAL, NEUTRO, RIVAL, UNI } from "./tema.js";

// ── Lo que usan varias pestañas ─────────────────────────────────────────────

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
