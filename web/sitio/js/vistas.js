// Las pestañas del tablero (cusf/vistas.py), traducidas tal cual. Cada una
// recibe una "temporada" (los partidos elegidos y su total), así la misma
// función sirve para la temporada entera y para un partido solo, y dibuja
// en un lienzo (lienzo.js): las pruebas comparan lo que dibuja con lo que
// dibuja hoy el Python, operación por operación.
//
// Criterio de los números: primero "X de Y" y después el porcentaje, sin
// jerga y sin decir si estuvo bien o mal.
import { etiqueta, resultado, tacklesTemporada } from "./calculos.js";
import { conSigno, unDecimal } from "./formato.js";
import { acumulado, dona, pesas, piruletas } from "./graficos.js";
import { anillos, html, kpis } from "./piezas.js";
import { ACENTO, MAL, NEUTRO, RIVAL, UNI } from "./tema.js";

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
