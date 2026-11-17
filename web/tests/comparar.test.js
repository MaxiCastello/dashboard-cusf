// La pestaña Comparar (nov 2026): dos temporadas cara a cara.
import assert from "node:assert/strict";
import { test } from "node:test";

import { desdeManual, temporada } from "../sitio/js/calculos.js";
import { cambioConteo, cambioPromedio, cambioProporcion, dispersionConteo, dispersionProporcion, ejeDe, enjambre, tono } from "../sitio/js/comparar.js";
import { Registro } from "../sitio/js/lienzo.js";
import { caraACara, diferencia, partidoPorPartido, pistas } from "../sitio/js/piezas.js";
import { PLANILLA_2025 } from "../sitio/js/planilla2025.js";
import { compararTemporadas, fraseCambio } from "../sitio/js/vistas.js";

const cerca = (x, y, que) => assert.ok(Math.abs(x - y) < 0.01, `${que}: ${x} no es ${y}`);

test("X de Y: firme o casualidad (dos proporciones)", () => {
  // scrum 2026 contra 2025: 89% contra 79%, firme
  const scrum = cambioProporcion([94, 106], [153, 193]);
  assert.deepEqual([scrum.antes, scrum.ahora, scrum.dir, scrum.firme], [79, 89, 1, true]);
  cerca(scrum.z, 2.05, "z del scrum");
  // line: 73% contra 67% con 179 y 294 lines: puede ser casualidad
  const line = cambioProporcion([131, 179], [198, 294]);
  assert.deepEqual([line.antes, line.ahora, line.dir, line.firme], [67, 73, 1, false]);
  cerca(line.z, 1.338, "z del line");
  // el mismo 73% contra 67% con diez veces más lines sí es firme
  assert.equal(cambioProporcion([1310, 1790], [1980, 2940]).firme, true);
  assert.equal(cambioProporcion([19, 70], [78, 193]).dir, -1);
  // iguales, y sin dato
  assert.deepEqual([cambioProporcion([1, 2], [5, 10]).dir, cambioProporcion([1, 2], [5, 10]).firme], [0, false]);
  assert.equal(cambioProporcion([0, 0], [5, 10]), null);
  assert.equal(cambioProporcion([5, 10], [0, 0]), null);
  // todo ganado en las dos: sin vaivén posible, no se divide por cero
  assert.deepEqual([cambioProporcion([4, 4], [9, 9]).z, cambioProporcion([4, 4], [9, 9]).firme], [0, false]);
});

test("por partido: conteos (Poisson) y promedios (con el desvío entre partidos)", () => {
  // penales en el scrum: 21 en 16 contra 62 en 23: de 2,7 a 1,3, firme
  const pen = cambioConteo(21, 16, 62, 23);
  assert.deepEqual([pen.dir, pen.firme, pen.rel], [-1, true, -51]);
  cerca(pen.z, -3.099, "z de los penales");
  // penales totales: 196 en 16 contra 297 en 23: parecido
  assert.deepEqual([cambioConteo(196, 16, 297, 23).firme, cambioConteo(196, 16, 297, 23).rel], [false, -5]);
  // muy pocos casos (4 contra 0): no alcanza para decir nada, aunque la cuenta dé
  assert.equal(cambioConteo(0, 16, 4, 23).firme, false);
  assert.equal(cambioConteo(3, 16, 16, 23).firme, true);
  assert.equal(cambioConteo(5, 2, 0, 3).rel, null);   // contra cero no hay %
  assert.equal(cambioConteo(5, 0, 3, 2), null);
  // puntos: con partidos muy distintos entre sí, 5 puntos de diferencia no son firmes…
  const dispares = [10, 60, 20, 45, 5, 55];
  assert.equal(cambioPromedio(195, 6, 162, 6, [dispares, null]).firme, false);
  // …y con partidos parejos, sí
  assert.equal(cambioPromedio(195, 6, 162, 6, [[32, 33, 32, 33, 32, 33], null]).firme, true);
  assert.equal(cambioPromedio(195, 6, 162, 6, [dispares, null]).rel, 20);
  // sin ninguna temporada partido a partido: firme sólo desde 10%
  assert.deepEqual([cambioPromedio(110, 10, 100, 10, []).firme, cambioPromedio(105, 10, 100, 10, []).firme], [true, false]);
});

test("el color: a favor o en contra de UNI, según para qué lado es mejor", () => {
  const sube = { dir: 1, firme: true }, baja = { dir: -1, firme: true };
  assert.deepEqual([tono(sube, 1), tono(baja, 1), tono(sube, -1), tono(baja, -1)], ["favor", "contra", "contra", "favor"]);
  assert.equal(tono({ dir: 1, firme: false }, 1), "parecido");
  assert.match(String(diferencia({ tono: "favor", dir: -1, txt: "51%" })), /class="dif favor"><i>▼<\/i> 51%/);   // bajaron los penales: verde
  assert.match(String(diferencia({ tono: "contra", dir: -1, txt: "Bajó" })), /class="dif contra"><i>▼<\/i> Bajó/);
  assert.match(String(diferencia({ tono: "parecido", dir: 0, txt: "Parecido" })), /class="dif parecido"><i>≈<\/i> Parecido/);
  assert.match(String(diferencia(null)), /Sin datos/);
});

test("las jugadas de un mismo partido van juntas: con partidos muy distintos, hace falta más para ser firme", () => {
  // partidos parejos: phi 1 (nada cambia)
  assert.equal(dispersionProporcion([[[8, 10], [8, 10], [8, 10]]]), 1);
  // partidos muy distintos (2 de 10, 9 de 10, ...): phi grande
  const dispares = [[2, 10], [9, 10], [3, 10], [10, 10], [2, 10]];
  const phi = dispersionProporcion([dispares, null]);
  assert.ok(phi > 4, String(phi));
  // el mismo 52% contra 40% es firme con partidos parejos y no con partidos dispares
  assert.equal(cambioProporcion([52, 100], [40, 100]).firme, true);
  assert.equal(cambioProporcion([52, 100], [40, 100], phi).firme, false);
  // conteos: 2, 2, 2 no varía; 0, 9, 0 sí
  assert.equal(dispersionConteo([[2, 2, 2]]), 1);
  assert.ok(dispersionConteo([[0, 9, 0], null]) > 5);
  assert.equal(cambioConteo(30, 10, 15, 10, dispersionConteo([[0, 9, 0, 12, 1, 0, 8, 0]])).firme, false);
  assert.equal(cambioConteo(30, 10, 15, 10).firme, true);
  // menos de 3 partidos: no alcanza para medirlo
  assert.equal(dispersionProporcion([[[1, 10], [9, 10]]]), 1);
});

test("las piezas: ejes, valores escritos y nada tapado", () => {
  const p = String(pistas([{ rotulo: "Line", muestra: null, p: [73, 67], txt: ["a", "b"], dif: null },
    { rotulo: "Tackles", muestra: "2026: dato de 7 de 16 partidos", p: [null, 86], txt: ["Sin datos", "b"], dif: null }], ["2026", "2025"], ["#00f", "#999"]));
  assert.deepEqual([...p.matchAll(/<s style="left:(\d+)%">(\d+)%<\/s>/g)].map((m) => m[2]), ["0", "25", "50", "75", "100"]);   // el eje
  assert.match(p, /<u style="left:67%;width:6%"><\/u>/);                    // el tramo entre los dos
  assert.match(p, /<b class="a"\s+style="left:73%;color:#00f">73%<\/b>/);   // el % escrito sobre cada punto
  assert.match(p, /<b class="b"\s+style="left:67%;color:#999">67%<\/b>/);
  assert.equal(p.match(/<u /g).length, 1, "sin tramo si a una le falta el dato");
  assert.match(p, /class="pq">2026: dato de 7 de 16 partidos/);
  // la barra más larga del renglón llega al borde; la otra, en proporción
  const c = String(caraACara([["Puntos", 30, 15, ["30,0", "60 en 2"], ["15,0", "15 en 1"], null]], ["2026", "2025"], ["#00f", "#999"]));
  assert.match(c, /width:100\.00%;background:#00f/);
  assert.match(c, /width:50\.00%;background:#999/);
  // la tira: los que caen juntos suben de piso
  assert.deepEqual(enjambre([80, 81, 90, 80], 3), [{ p: 80, nivel: 0 }, { p: 80, nivel: 1 }, { p: 81, nivel: 2 }, { p: 90, nivel: 0 }]);
  assert.deepEqual([ejeDe([76, 90, 83]), ejeDe([10, 64]), ejeDe([50]), ejeDe([100])], [[70, 90, 10], [10, 70, 20], [40, 60, 10], [90, 100, 10]]);
  const t = String(partidoPorPartido([{ titulo: "T", eje: [70, 90, 10], filas: [{ nombre: "2026", color: "#00f", puntos: enjambre([80, 80], 1), total: 85, abajo: "x" }] }]));
  assert.deepEqual([...t.matchAll(/<s style="left:[\d.]+%">(\d+)%<\/s>/g)].map((m) => m[1]), ["70", "80", "90"]);
  assert.match(t, /left:50\.00%;bottom:3px/);
  assert.match(t, /left:50\.00%;bottom:18px/);
  assert.match(t, /<u style="left:75\.00%/);
});

// un partido a mano: tanteo, tries, line y penales
const partido = (id, fecha, su, sr, { tries = 0, lan = 0, gan = 0, penRuck = 0, penJuego = 0 } = {}) => desdeManual({
  id, rival: "X", categoria: "Primera", fecha, score_uni: su, score_rival: sr,
  datos: {
    puntos: { tries_u: tries }, line: { uLan: lan, uGan: gan },
    penales: [{ situacion: "Ruck", motivo: "Sin detalle", uni: penRuck, rival: 1 }, { situacion: "Juego", motivo: "Sin detalle", uni: penJuego, rival: 0 }],
  },
});
const P26 = [partido("a", "2026-03-01", 20, 10, { tries: 3, lan: 10, gan: 8, penRuck: 4, penJuego: 2 }),
  partido("b", "2026-03-08", 10, 30, { tries: 1, lan: 6, gan: 4, penRuck: 5 })];
const P27 = [partido("c", "2027-03-01", 7, 7, { tries: 1, lan: 4, gan: 4, penJuego: 3 })];
const T26 = temporada(P26, 2026, "Primera"), T27 = temporada(P27, 2027, "Primera");

const anotado = (a, b) => {
  const lz = new Registro();
  compararTemporadas(lz, a, b);
  return lz.llamadas;
};
const sinEtiquetas = (h) => h.replace(/<[^>]+>/g, "|").replace(/\|+/g, "|");
const textos = (a, b) => anotado(a, b).map((x) => sinEtiquetas(String(x.cuerpo ?? x.args ?? ""))).join("\n");

test("dos temporadas de la base: la más nueva primero, se entre por la que se entre", () => {
  const todo = textos(["2026", T26], ["2027", T27]);
  assert.equal(todo, textos(["2027", T27], ["2026", T26]));
  assert.match(todo, /^\|2027\| 1 partido\|2026\| 2 partidos\|A favor de UNI\|En contra de UNI\|Parecido\|/);
  assert.match(todo, /\|De 2026 a 2027\|Nada cambió tanto como para estar seguros de que no es casualidad\.\|/);
  // los puntos por partido, con lo que es cada número, y el antes y el ahora
  assert.match(todo, /2027\|7,0\|A favor\|–\|7,0\|En contra\|0 ganados · 1 empatado · 0 perdidos\|/);
  assert.match(todo, /2026\|15,0\|A favor\|–\|20,0\|En contra\|1 ganado · 0 empatados · 1 perdido\|/);
  assert.match(todo, /Puntos a favor\|15,0\|→\|7,0\|▼\| 53%\|Puntos en contra\|20,0\|→\|7,0\|▼\| 65%\|/);
  // con tan pocos partidos y jugadas nada es firme: lo dice, y no hay tarjetas
  assert.ok(!todo.includes("Lo que más cambió"), "sin cambios firmes, sin tarjetas");
  assert.match(todo, /Line propio ganado\|≈\| Parecido\|75%\|100%\|2027\| 4 de 4 · 100%\|2026\| 12 de 16 · 75%\|/);
  // lo que ninguna de las dos tiene no va
  assert.ok(!todo.includes("Chances en 22"), "sin chances en ninguna");
  assert.ok(!todo.includes("Tackles completados"), "sin tackles en ninguna");
  assert.ok(!todo.includes("La forma de cada temporada"), "con menos de 3 cosas no hay telaraña");
  assert.ok(!todo.includes("Partido por partido"), "sin tackles ni chances partido a partido");
  // por partido: el promedio, el total y los partidos, y el % de cambio
  assert.match(todo, /7,0\|7 en 1\|Puntos a favor\|▼\| 53%\|15,0\|30 en 2\|/);
  assert.match(todo, /1,0\|1 en 1\|Tries de UNI\|▼\| 50%\|2,0\|4 en 2\|/);
  assert.match(todo, /3,0\|3 en 1\|Penales de UNI\|▼\| 45%\|5,5\|11 en 2\|/);
  assert.match(todo, /1,0\|1 en 1\|Penales del rival\|≈\| Igual\|1,0\|2 en 2\|/);
  assert.match(todo, /0,0\|0 en 1\|Tries del rival\|≈\| Igual\|0,0\|0 en 2\|/);
  // según dónde: las situaciones de las dos
  assert.match(todo, /3,0\|3 en 1\|Juego\|▲\| 200%\|1,0\|2 en 2\|/);
  assert.match(todo, /0,0\|0 en 1\|Ruck\|▼\| 100%\|4,5\|9 en 2\|/);
  assert.ok(!todo.includes("planilla"));
  // nada firme: todos los cambios en gris
  const html = anotado(["2027", T27], ["2026", T26]).map((x) => String(x.cuerpo ?? "")).join("");
  assert.ok(!/class="dif (favor|contra)"><i>[▲▼]<\/i> \d/.test(html), "ningún cambio pintado");
});

test("contra la planilla 2025: sin resultados partido a partido, y lo dice", () => {
  const ll = anotado(["2026", T26], ["2025", PLANILLA_2025]);
  const todo = ll.map((x) => sinEtiquetas(String(x.cuerpo ?? x.args ?? ""))).join("\n");
  assert.match(todo, /2025\|27,8\|A favor\|–\|20,9\|En contra\|23 partidos · sin el resultado de cada uno\|/);
  assert.match(todo, /Line propio ganado\|≈\| Parecido\|67%\|75%\|2026\| 12 de 16 · 75%\|2025\| 198 de 294 · 67%\|/);
  // 2026 no tiene tackles ni chances, la planilla sí: sin cambio, y de cuántos partidos sale el dato
  assert.match(todo, /Tackles completados\|Sin datos\|86%\|2026\| Sin datos\|2025\| 997 de 1166 · 86%\|2025: sólo 16 de 23 partidos tienen el dato\|/);
  // partido por partido: los 16 de la planilla con tackles, con el más bajo y el más alto
  assert.match(todo, /2026\|Sin datos partido a partido\|2025\|16 partidos · el más bajo 78% \(Alma\) · el más alto 90% \(Provincial\) · la raya: toda la temporada, 86%\|/);
  assert.match(todo, /2025 sale de la planilla: suma 23 partidos, sin el resultado de cada uno\. Sus tackles son de los 16 partidos/);
  // la telaraña: sólo con lo que tienen las dos (acá, una sola cosa: no va)
  assert.ok(!ll.some((x) => x.f === "plotly_chart"));
});

test("lo que más cambió: sólo lo firme, primero lo más firme, con su color", () => {
  // 2027 con muchos más penales de UNI en el ruck y mucho mejor line
  const mucho = (id, fecha, extra) => desdeManual({ id, rival: "X", categoria: "Primera", fecha, score_uni: 20, score_rival: 20, datos: extra });
  const viejo = temporada([1, 2, 3, 4].map((i) => mucho(`v${i}`, `2026-03-0${i}`,
    { line: { uLan: 30, uGan: 12 }, scrum: { uLan: 10, uGan: 8 }, salida: { uPro: 5, uGan: 1 }, penales: [{ situacion: "Ruck", uni: 2, rival: 5 }] })), 2026, "Primera");
  const nuevo = temporada([1, 2, 3, 4].map((i) => mucho(`n${i}`, `2027-03-0${i}`,
    { line: { uLan: 30, uGan: 27 }, scrum: { uLan: 10, uGan: 8 }, salida: { uPro: 5, uGan: 1 }, penales: [{ situacion: "Ruck", uni: 9, rival: 5 }] })), 2027, "Primera");
  const ll = anotado(["2027", nuevo], ["2026", viejo]);
  const tarjetas = String(ll.find((x) => String(x.cuerpo).includes('class="cambios"')).cuerpo);
  // el line (40% → 90%) es más firme que los penales (2,0 → 9,0): va primero. Subir el line es verde; subir los penales de UNI, rojo
  assert.deepEqual([...tarjetas.matchAll(/class="cb (\w+)"><div class="cn">([^<]+)</g)].map((m) => [m[1], m[2]]),
    [["favor", "Line propio ganado"], ["contra", "Penales de UNI"], ["contra", "Penales de UNI: Ruck"]]);
  const txt = sinEtiquetas(tarjetas);
  assert.match(txt, /Line propio ganado\|40%\|→\|90%\|▲\| Subió\|2027\|108 de 120\|2026\|48 de 120\|/);
  assert.match(txt, /Penales de UNI\|2,0\|→\|9,0\|por partido\|▲\| 350%\|2027\|36 en 4 partidos\|2026\|8 en 4 partidos\|/);
  // el scrum y las salidas quedaron iguales: no están
  assert.ok(!txt.includes("Scrum") && !txt.includes("Salidas"));
  // y la telaraña, con las tres cosas que tienen las dos: la nueva arriba
  const fig = ll.find((x) => x.f === "plotly_chart").fig;
  assert.deepEqual(fig.data.map((d) => d.name), ["2026", "2027"]);
  assert.deepEqual(fig.data[1].theta.slice(0, 3), ["Line", "Scrum", "Salidas"]);
  assert.deepEqual(fig.data[1].r.slice(0, 3), [90, 80, 20]);
});

test("el resumen en palabras, el aviso de un partido fuera de lo común y el de los datos que faltan", () => {
  assert.deepEqual([fraseCambio("Scrum propio ganado", 1), fraseCambio("Penales de UNI", -1, "Scrum"), fraseCambio("Penales de UNI", 1, "Salida"),
    fraseCambio("Chances en 22 concretadas", -1)],
  ["más scrums propios ganados", "menos penales de UNI en el scrum", "más penales de UNI en las salidas", "menos chances en 22 concretadas"]);
  // 2027: line mucho mejor, más penales en el ruck y un 100–0 que mueve solo el promedio; chances sólo en 1 de 5 partidos
  const p = (id, fecha, su, extra) => desdeManual({ id, rival: `R${id}`, categoria: "Primera", fecha, score_uni: su, score_rival: 10, datos: extra });
  const viejo = temporada([1, 2, 3, 4, 5].map((i) => p(`v${i}`, `2026-03-0${i}`, 20,
    { line: { uLan: 30, uGan: 12 }, penales: [{ situacion: "Ruck", uni: 2, rival: 5 }], efectividad_22: { chances: 10, concretadas: 5 } })), 2026, "Primera");
  const nuevo = temporada([1, 2, 3, 4, 5].map((i) => p(`n${i}`, `2027-03-0${i}`, i === 5 ? 100 : 20,
    { line: { uLan: 30, uGan: 27 }, penales: [{ situacion: "Ruck", uni: 9, rival: 5 }], ...(i === 1 ? { efectividad_22: { chances: 10, concretadas: 5 } } : {}) })), 2027, "Primera");
  const todo = textos(["2027", nuevo], ["2026", viejo]);
  assert.ok(todo.includes("|De 2026 a 2027|A favor de UNI:| más lines propios ganados.|En contra de UNI:| más penales de UNI y más penales de UNI en el ruck.|Lo demás quedó parecido.|"), todo);
  assert.ok(todo.includes("Ojo: el 100–10 a Rn5 sube solo el promedio de 2027. Sin ese partido, 2027 queda en 20,0 a favor y 10,0 en contra por partido."));
  assert.ok(todo.includes("2027: sólo 1 de 5 partidos tienen el dato (Rn5)") || todo.includes("2027: sólo 1 de 5 partidos tienen el dato (Rn1)"));
  // un partido sin un dato que no puede faltar (line, scrum: puede no haber habido) no es un dato que falta
  assert.ok(todo.includes("|Line propio ganado|▲| Subió|40%|90%|2027| 135 de 150 · 90%|2026| 60 de 150 · 40%|Chances en 22"), "el line, sin aviso");
});
