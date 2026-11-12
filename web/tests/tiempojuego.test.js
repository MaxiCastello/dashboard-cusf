// Tiempo de juego cargado en Uni-Dat (sección TIEMPO DE JUEGO, nov 2026): la
// columna partidos.tiempos guarda la hora de cada toque y el tablero hace las
// cuentas. Los partidos sin tiempos tienen que quedar exactamente como eran.
import assert from "node:assert/strict";
import { test } from "node:test";

import { limpiarTiempos, partidosBase, temporada, tiempoJuego, tiempoJuegoManual, tiempoManualValido } from "../sitio/js/calculos.js";
import { armarComplemento, armarPartido, armarTiempo, segundos, tiempoUnidat, valoresComplemento, valoresPartido, valoresTiempo }
  from "../sitio/js/carga.js";
import { duracion, mmss } from "../sitio/js/formato.js";
import { Registro } from "../sitio/js/lienzo.js";
import { cintaJuego, rangosJuego } from "../sitio/js/graficos.js";
import { informe } from "../sitio/js/informe.js";
import { armarPdf } from "../sitio/js/pdf.js";
import { jsPDF } from "./_informe_pdf.js";
import { kpis, anillos, porPartido } from "../sitio/js/piezas.js";
import { tiempoDeJuego, tiempoDeJuegoTemporada } from "../sitio/js/vistas.js";

const T0 = 1.7e12;
// [segundos desde el principio, estado, tiempo]
const marcas = (...ms) => ({ v: 1, marcas: ms.map(([s, e, p = "PT"]) => ({ t: T0 + s * 1000, e, p })) });
const fila = (id, tiempos) => ({ id, rival: "X", categoria: "Primera", fecha: "2026-11-07", score_uni: 0, score_rival: 0,
  main: { eventos: [] }, ...(tiempos === undefined ? {} : { tiempos }) });

// El mismo partido corto que prueba Uni-Dat (prueba_tiempos.js): tienen que dar lo mismo.
const CORTO = marcas([0, "UNI"], [20, "RIVAL"], [30, "OUT"], [70, "UNI"], [100, "PAUSA"]);

test("las cuentas de un partido corto (las mismas que Uni-Dat)", () => {
  const tj = tiempoJuego(CORTO);
  assert.deepEqual([tj.bip, tj.out, tj.uni, tj.riv], [60000, 40000, 50000, 10000]);
  assert.deepEqual([tj.tBip.n, tj.tBip.prom, tj.tBip.max], [2, 30000, 30000]);   // UNI 20 + RIVAL 10 = UN tramo en juego
  assert.deepEqual([tj.tOut.n, tj.tOut.max], [1, 40000]);
  assert.deepEqual([tj.posUni.n, tj.posUni.prom, tj.posUni.max, tj.posRiv.n], [2, 25000, 30000, 1]);
  assert.deepEqual(tj.segmentos.map((s) => [s.e, s.d, s.desde]), [["UNI", 20000, 0], ["RIVAL", 10000, 20000], ["OUT", 40000, 30000], ["UNI", 30000, 70000]]);
});

test("el último tramo sin cerrar (sin PAUSA) no se cuenta", () => {
  const tj = tiempoJuego(marcas([0, "UNI"], [10, "OUT"]));
  assert.deepEqual([tj.bip, tj.out, tj.tOut.n], [10000, 0, 0]);
  assert.equal(tiempoJuego(marcas([0, "UNI"])), null);   // una sola marca abierta: no hay nada medido
});

test("un tramo que duró 0 (el olvidado que Uni-Dat cerró sin contar) no es un tramo", () => {
  // UNI 30 s, RIVAL olvidado (Uni-Dat pone la PAUSA en la misma hora), después OUT 10 s
  const tj = tiempoJuego(marcas([0, "UNI"], [30, "RIVAL"], [30, "PAUSA"], [1500, "OUT"], [1510, "PAUSA"]));
  assert.deepEqual([tj.uni, tj.riv, tj.posRiv.n, tj.tBip.n, tj.tOut.n, tj.out], [30000, 0, 0, 1, 1, 10000]);
  assert.deepEqual(tj.segmentos.map((s) => s.e), ["UNI", "OUT"]);
});

test("las pausas y el entretiempo no cuentan, y cortan los tramos; 1°T y 2°T por separado", () => {
  const tj = tiempoJuego(marcas([0, "UNI"], [30, "PAUSA"], [900, "UNI", "ST"], [920, "OUT", "ST"], [950, "PAUSA", "ST"]));
  assert.deepEqual([tj.bip, tj.out], [50000, 30000]);
  assert.equal(tj.tBip.n, 2);                              // UNI del PT y UNI del ST: dos tramos, no uno
  assert.deepEqual([tj.PT.bip, tj.ST.bip, tj.ST.out], [30000, 20000, 30000]);
  assert.deepEqual(tj.segmentos.map((s) => [s.p, s.desde]), [["PT", 0], ["ST", 0], ["ST", 20000]]);
});

test("datos raros: null y no se cae", () => {
  for (const x of [undefined, null, "x", 3, [], {}, { marcas: "x" }, { marcas: [] }, marcas([0, "PAUSA"]),
    { marcas: [{ t: "z", e: "UNI", p: "PT" }, null, { t: 5, e: "NADA", p: "PT" }] }]) {
    assert.equal(tiempoJuego(x), null);
  }
  // fuera de orden y repetidas: se descartan (la misma regla que csv-unidat.js)
  const l = limpiarTiempos(marcas([0, "UNI"], [5, "UNI"], [3, "OUT"], [10, "OUT"]));
  assert.deepEqual(l.marcas.map((m) => m.e), ["UNI", "OUT"]);
});

test("un partido sin tiempos queda igual que siempre (sin la clave nueva)", () => {
  const [sin, nulo, con] = partidosBase([fila("a"), fila("b", null), fila("c", CORTO)], []);
  assert.equal(Object.hasOwn(sin, "tiempo_juego"), false);
  assert.equal(Object.hasOwn(nulo, "tiempo_juego"), false);
  assert.equal(con.tiempo_juego.bip, 60000);
});

test("mmss: al segundo más cercano, como Uni-Dat", () => {
  assert.deepEqual([0, 499, 500, 12500, 59999, 61000, 3725000, null, Number.NaN].map(mmss),
    ["0:00", "0:00", "0:01", "0:13", "1:00", "1:01", "1:02:05", "0:00", "0:00"]);
});

test("las piezas nuevas no cambian lo de antes (kpis sin renglón y anillos sin formato)", () => {
  assert.equal(String(kpis([["3", "Tries", null]])), '<div class="kpis"><div class="kpi"><div class="v" style="color:#e8eaf0">3</div><div class="l">Tries</div></div></div>');
  assert.ok(String(kpis([["0:38", "BIP Promedio", null, "Máximo 2:30"]])).includes('<div class="x">Máximo 2:30</div>'));
  assert.ok(String(anillos([["Line", 2, 3, "#00c853", null]])).includes("2<span class=\"de\">de 3</span>"));
  assert.ok(String(anillos([["BIP", 60000, 100000, "#1a6fd4", null]], null, mmss)).includes("1:00<span class=\"de\">de 1:40</span><small>60%</small>"));
});

test("las pestañas se dibujan (partido y temporada) y sin datos avisan", () => {
  const ps = partidosBase([fila("a"), fila("c", CORTO)], []);
  const lz = new Registro();
  tiempoDeJuego(lz, ps[1]);
  const fs = lz.llamadas.filter((l) => l.f === "plotly_chart");
  assert.equal(fs.length, 2);   // la cinta y cuánto duraron los tramos (1° y 2° tiempo son dos lupas, sin gráfico)
  const vacio = new Registro();
  tiempoDeJuego(vacio, ps[0]);
  assert.equal(vacio.llamadas.filter((l) => l.f === "plotly_chart").length, 0);
  const t = temporada(ps, 2026, "Primera");
  const lt = new Registro();
  tiempoDeJuegoTemporada(lt, t);
  assert.equal(lt.llamadas.filter((l) => l.f === "plotly_chart").length, 0);   // con un solo partido no hay "partido a partido"
  const txt = JSON.stringify(lt.llamadas);
  assert.ok(txt.includes("1 de 2 partidos tienen el tiempo de juego cargado."));
  assert.ok(txt.includes("Cada partido, con sus minutos") && txt.includes("porpartido"));
});

// ── Lo de nov 2026 (2ª vuelta): avisos de carga, la cinta en filas, los rangos ──
const ENTERO = marcas([0, "UNI"], [20, "OUT"], [50, "RIVAL"], [60, "PAUSA"], [900, "UNI", "ST"], [940, "OUT", "ST"], [1000, "PAUSA", "ST"]);
const dibujo = (f, ...a) => {
  const lz = new Registro();
  f(lz, ...a);
  return [JSON.stringify(lz.llamadas), lz.llamadas];
};

test("un partido entero y bien cerrado no tiene avisos; las partes de abajo están todas", () => {
  const [p] = partidosBase([fila("a", ENTERO)], []);
  assert.equal(p.tiempo_juego.abierto, false);
  const [txt] = dibujo(tiempoDeJuego, p);
  assert.ok(!txt.includes("aviso ojo"));
  for (const t of ["### La cinta del partido", "### 1° y 2° tiempo", "### ¿Cuánto duró cada vez?", "1° tiempo, en juego", "2° tiempo, en juego"]) assert.ok(txt.includes(t), t);
  // sin jerga a la vista: nada de "tramo" en lo que lee el que mira (los avisos de carga son para el que carga)
  assert.ok(!/tramo/i.test(txt.replace(/<[^>]*>/g, "")));   // (sin las etiquetas: la clase de CSS se llama "tramos")
});

test("lo principal en palabras: de cada 10 minutos, cuántos se jugó (al medio minuto)", () => {
  const frase = (bip, out) => {
    const [p] = partidosBase([fila("a", marcas([0, "UNI"], [bip, "OUT"], [bip + out, "PAUSA"]))], []);
    return /De cada 10 minutos, la pelota estuvo en juego <b>([^<]+)<\/b>\./.exec(dibujo(tiempoDeJuego, p)[0].replaceAll("\\", ""))?.[1];
  };
  assert.deepEqual([[35, 65], [30, 70], [50, 50], [5, 95], [1, 99], [99, 1], [34, 66], [33, 67]].map(([a, b]) => frase(a, b)),
    ["3 y medio", "3", "5", "medio", "0", "10", "3 y medio", "3 y medio"]);
});

test("cuánto duró cada vez: segundos hasta el minuto, después minutos; el número grande y la unidad chica", () => {
  assert.deepEqual([0, 26000, 59499, 59500, 130000, 3725000, null].map(duracion),
    [["0", "seg"], ["26", "seg"], ["59", "seg"], ["1:00", "min"], ["2:10", "min"], ["1:02:05", "h"], ["0", "seg"]]);
  const [p] = partidosBase([fila("a", ENTERO)], []);
  const txt = dibujo(tiempoDeJuego, p)[0].replaceAll("\\", "");
  // ENTERO: se jugó 20, 10 y 40 s (promedio 23, la más larga 40); se paró 30 y 60 s
  assert.ok(txt.includes('Cada vez que se jugó</span><small>3 veces</small>'));
  assert.ok(txt.includes("<span>Promedio</span><b>23<small>seg</small></b>") && txt.includes("<span>La más larga</span><b>40<small>seg</small></b>"));
  assert.ok(txt.includes("<b>1:00<small>min</small></b>"));
  assert.ok(txt.includes("Cada vez que la tuvo UNI") && txt.includes("Cada vez que la tuvo el rival</span><small>1 vez</small>"));
  assert.ok(!txt.includes('class="rg"'), "sin la barrita que necesitaba explicación");
});

test("un partido al lado de la temporada: debajo de cada número, el % de la temporada (si hay 2 o más con tiempo)", () => {
  const otro = { ...fila("b", marcas([0, "UNI"], [60, "OUT"], [100, "PAUSA"], [900, "RIVAL", "ST"], [940, "PAUSA", "ST"])), fecha: "2026-11-08" };
  const ps = partidosBase([fila("a", ENTERO), otro], []);
  const t = temporada(ps, 2026, "Primera");
  const txt = dibujo(tiempoDeJuego, ps[0], t)[0];
  // temporada: en juego 70 + 100 de 160 + 140 = 57%; UNI 60 + 60 de 170 = 71%
  for (const r of ["Temporada 57%", "Temporada 43%", "Temporada 71%", "Temporada 29%"]) assert.ok(txt.includes(`<span class=\\"t\\">${r}</span>`), r);
  // sin temporada, o con un solo partido con tiempo, no hay con qué comparar
  assert.ok(!dibujo(tiempoDeJuego, ps[0])[0].includes("Temporada"));
  assert.ok(!dibujo(tiempoDeJuego, ps[0], temporada([ps[0]], 2026, "Primera"))[0].includes("Temporada"));
  // los dos tiempos por separado no llevan la referencia ni la frase (una sola vez, arriba)
  assert.equal(txt.split("De cada 10 minutos").length, 2);
  assert.equal(txt.split("Temporada ").length, 5);
});

test("el partido dura más de 80 minutos: se explica (y si no los pasa, no)", () => {
  const largo = marcas([0, "UNI"], [1500, "OUT"], [2700, "PAUSA"], [3600, "RIVAL", "ST"], [5000, "OUT", "ST"], [6000, "PAUSA", "ST"]);
  const [p, q] = partidosBase([fila("a", largo), fila("b", ENTERO)], []);
  assert.ok(dibujo(tiempoDeJuego, p)[0].includes("por eso dura más de 80 minutos"));
  assert.ok(!dibujo(tiempoDeJuego, q)[0].includes("80 minutos"));
});

test("avisos de carga: un solo tiempo, el final sin cerrar y un tramo larguísimo", () => {
  // sólo el 1° tiempo, y faltó la PAUSA del final (el último RIVAL no se cuenta)
  const [p] = partidosBase([fila("a", marcas([0, "UNI"], [30, "OUT"], [60, "RIVAL"]))], []);
  assert.equal(p.tiempo_juego.abierto, true);
  const [txt] = dibujo(tiempoDeJuego, p);
  assert.ok(txt.includes("Sólo está medido el 1° tiempo"));
  assert.ok(txt.includes("El último tramo quedó abierto"));
  assert.ok(txt.includes("El 2° tiempo no está medido."));
  // nunca tuvo la pelota el rival: sin tarjeta en 0:00
  assert.ok(txt.includes("Cada vez que la tuvo UNI") && !txt.includes("Cada vez que la tuvo el rival"));
  // 12 minutos de pelota muerta en el medio: puede ser un olvido
  const [q] = partidosBase([fila("b", marcas([0, "UNI"], [30, "OUT"], [750, "UNI"], [800, "PAUSA"], [900, "UNI", "ST"], [950, "PAUSA", "ST"]))], []);
  const [tq] = dibujo(tiempoDeJuego, q);
  assert.ok(tq.includes("Hay un tramo de pelota muerta de 12:00"));
  assert.ok(!tq.includes("Sólo está medido") && !tq.includes("quedó abierto"));
});

test("temporada: un partido con un solo tiempo no baja el promedio por partido (y se dice cuál quedó afuera)", () => {
  const soloPT = { ...fila("b", marcas([0, "UNI"], [30, "OUT"], [60, "PAUSA"])), rival: "Mitad", fecha: "2026-11-08" };
  const ps = partidosBase([fila("a", ENTERO), soloPT], []);
  const [txt, llamadas] = dibujo(tiempoDeJuegoTemporada, temporada(ps, 2026, "Primera"));
  // el entero: 70 s en juego + 90 s de pelota muerta = 2:40 (con el otro promediado daría 1:50)
  assert.ok(txt.includes("<b>2:40</b>") && !txt.includes("<b>1:50</b>"));
  assert.ok(txt.includes("Promedio de 1 partido."));
  assert.ok(txt.includes("No entra en el promedio por partido, por tener un solo tiempo medido: 8 nov · Mitad."));
  assert.ok(txt.includes("Sólo el 1° tiempo"));
  // dos gráficos de un solo % cada uno, con el eje ajustado y el número arriba de cada punto
  const fs = llamadas.filter((l) => l.f === "plotly_chart").map((l) => l.fig);
  assert.deepEqual(fs.map((f) => f.data.map((d) => d.name)), [["En juego"], ["Posesión UNI"]]);
  assert.deepEqual(fs[0].data[0].text, ["44%", "50%"]);
  assert.deepEqual(fs[0].layout.yaxis.range, [30, 64]);
  assert.equal(fs[0].layout.annotations, undefined);   // la línea de la temporada, sin rótulo que pise los puntos
  assert.equal(fs[0].layout.shapes.length, 1);
});

test("a mano: si UNI + Rival no da el tiempo en juego, la pestaña lo dice", () => {
  const [p] = partidosBase([], [manual("m0", PLANILLA)]);
  assert.ok(dibujo(tiempoDeJuego, p)[0].includes("En la planilla, UNI + Rival da 31:00 y el tiempo en juego 30:10"));
  const [q] = partidosBase([], [manual("m1", { ...PLANILLA, uni: 1046 })]);
  assert.ok(!dibujo(tiempoDeJuego, q)[0].includes("En la planilla"));
});

test("la cinta en el celular: filas de 15 minutos, y un tramo que cruza de fila se parte sin perder nada", () => {
  // 1°T: UNI 14 min, OUT 2 min (cruza el minuto 15), RIVAL 20 min (cruza el 30)
  const tj = tiempoJuego(marcas([0, "UNI"], [840, "OUT"], [960, "RIVAL"], [2160, "PAUSA"], [3000, "UNI", "ST"], [3060, "PAUSA", "ST"]));
  const ancha = cintaJuego(tj.segmentos);
  assert.deepEqual(ancha.layout.yaxis.categoryarray, ["2°T", "1°T"]);
  assert.deepEqual(ancha.data.map((d) => d.x.length), [2, 1, 1]);
  const fig = cintaJuego(tj.segmentos, 15);
  assert.deepEqual(fig.layout.yaxis.categoryarray, ["2°T 0'", "1°T 30'", "1°T 15'", "1°T 0'"]);
  const [uni, riv, out] = fig.data;
  assert.deepEqual([uni.y, uni.base, uni.x], [["1°T 0'", "2°T 0'"], [0, 0], [14, 1]]);
  assert.deepEqual([out.y, out.base, out.x], [["1°T 0'", "1°T 15'"], [14, 0], [1, 1]]);
  assert.deepEqual([riv.y, riv.base, riv.x], [["1°T 15'", "1°T 30'"], [1, 0], [14, 6]]);
  // cada pedazo dice cuánto duró el tramo entero
  assert.deepEqual(riv.customdata, [["20:00", "16:00"], ["20:00", "16:00"]]);
  const total = fig.data.flatMap((d) => d.x).reduce((a, b) => a + b, 0);
  assert.equal(total, (tj.bip + tj.out) / 60000);
});

test("cuánto duraron los tramos: cada tramo cae en un solo rango (el borde, en el de arriba)", () => {
  const st = (...seg) => ({ lista: seg.map((s) => s * 1000) });
  const fig = rangosJuego(st(0.5, 14.999, 15, 29, 30, 59, 60, 119, 120, 600), st(15));
  assert.deepEqual(fig.data.map((d) => d.y), [[2, 2, 2, 2, 2], [0, 1, 0, 0, 0]]);
  assert.deepEqual(fig.data[0].text, ["2", "2", "2", "2", "2"]);
  assert.deepEqual(fig.data.map((d) => d.name), ["Pelota en juego", "Pelota muerta"]);
});

test("cada partido de la temporada: los minutos escritos y todo escapado", () => {
  const h = String(porPartido([['<b>x</b>', "Sólo el 1° tiempo", [["En juego", 60000, "#1a6fd4"], ["Pelota muerta", 180000, "#6b7280"]],
    [["UNI", 45000, "#00c853"], ["Rival", 15000, "#ff9800"]]]], mmss));
  assert.ok(h.includes("&lt;b&gt;x&lt;/b&gt;") && !h.includes("<b>x</b>"));
  assert.ok(h.includes("<em>En juego</em> 1:00 <small>25%</small>") && h.includes("<em>Rival</em> 0:15 <small>25%</small>"));
  assert.ok(h.includes("<small>Sólo el 1° tiempo</small>"));
});

// ── Tiempo de juego cargado a mano (CARGAR PARTIDO, nov 2026) ────────────────
// Los números de la planilla de UNI vs CAP (la diapositiva): UNI + Rival da
// 31:00 y En juego dice 30:10. No cuadran: se avisa, pero se guarda.
const PLANILLA = { bip: 1810, out: 3319, uni: 1096, riv: 764, bip_prom: 32, bip_max: 122, out_prom: 59, out_max: 175 };
const CASILLAS = { tjbip: "30:10", tjout: "00:55:19", tjuni: "18:16", tjriv: "12:44", tjbp: "0:32", tjbm: "2:02", tjop: "00:00:59", tjom: "2:55" };
const manual = (id, tiempo, partidoId) => ({ id, ...(partidoId ? { partido_id: partidoId } : { rival: "CAP", categoria: "Primera", fecha: "2026-05-02" }),
  score_uni: 0, score_rival: 0, datos: tiempo === undefined ? {} : { tiempo_juego: tiempo } });

test("a mano: los tiempos se escriben 30:10 o 1:05:19", () => {
  assert.deepEqual(["30:10", "00:55:19", "1:05:19", "0:32", " 2:02 ", "120:00", "", null].map(segundos),
    [1810, 3319, 3919, 32, 122, 7200, null, null]);
  for (const malo of ["30", "30:6", "30:60", "1:60:00", "1:2:3:4", "a:10", "-1:00", "30.10", "1,5"]) assert.ok(Number.isNaN(segundos(malo)), malo);
});

test("a mano: validación (obligatorios, promedio <= máximo <= total) y el aviso de que no cuadra", () => {
  assert.deepEqual(armarTiempo({}), { tj: null, errores: [], ojo: null });                 // nada escrito: sin tiempo de juego
  const r = armarTiempo(CASILLAS);
  assert.deepEqual(r.tj, PLANILLA);
  assert.match(r.ojo, /UNI \+ Rival da 31:00 y En juego dice 30:10 \(no cuadran por 0:50\)/);
  assert.equal(armarTiempo({ ...CASILLAS, tjuni: "17:26" }).ojo, null);                    // 17:26 + 12:44 = 30:10: cuadra
  assert.deepEqual(armarTiempo({ tjbip: "30:10" }).errores,
    ["Tiempo de juego: falta Pelota muerta (OUT), UNI con la pelota, Rival con la pelota (son los cuatro de arriba; los promedios y máximos son opcionales)."]);
  assert.deepEqual(armarTiempo({ ...CASILLAS, tjbp: "3:00" }).errores, ["El promedio en juego es más largo que el máximo."]);
  assert.deepEqual(armarTiempo({ ...CASILLAS, tjom: "56:00" }).errores,
    ["El tramo más largo de pelota muerta dura más que todo el tiempo de pelota muerta."]);
  assert.deepEqual(armarTiempo({ ...CASILLAS, tjbp: "0:00" }).errores, ["El promedio en juego no puede ser 0:00 (si no se midió, dejalo vacío)."]);
  assert.match(armarTiempo({ ...CASILLAS, tjout: "55" }).errores[0], /^Pelota muerta \(OUT\): escribilo como 30:10/);
  assert.deepEqual(armarTiempo({ ...CASILLAS, tjout: "4:00:01" }).errores, ["Pelota muerta (OUT): más de 4 horas no puede ser."]);
  // sin promedios ni máximos también sirve
  assert.deepEqual(armarTiempo({ tjbip: "30:10", tjout: "55:19", tjuni: "18:16", tjriv: "12:44" }).tj, { bip: 1810, out: 3319, uni: 1096, riv: 764 });
  // y lo guardado vuelve a las casillas igual
  assert.deepEqual(armarTiempo(valoresTiempo(PLANILLA)).tj, PLANILLA);
});

test("a mano: lo de la base se lee con la forma de Uni-Dat; la cantidad de tramos se estima (total ÷ promedio)", () => {
  const tj = tiempoJuegoManual(PLANILLA);
  assert.deepEqual([tj.bip, tj.out, tj.uni, tj.riv, tj.manual], [1810000, 3319000, 1096000, 764000, true]);
  assert.deepEqual([tj.tBip.n, tj.tBip.prom, tj.tBip.max, tj.tOut.n], [57, 32000, 122000, 56]);
  assert.deepEqual([tj.posUni, tj.segmentos, tj.PT], [null, null, null]);
  for (const malo of [null, [], "x", { bip: 1 }, { ...PLANILLA, uni: -1 }, { ...PLANILLA, out: 1.5 }, { ...PLANILLA, riv: "764" }, { ...PLANILLA, bip: 99999 }]) {
    assert.equal(tiempoManualValido(malo), null);
  }
  assert.deepEqual(tiempoManualValido({ ...PLANILLA, bip_prom: "x", otra: 1 }),
    { bip: 1810, out: 3319, uni: 1096, riv: 764, bip_max: 122, out_prom: 59, out_max: 175 });
  const sinProm = tiempoJuegoManual({ bip: 10, out: 20, uni: 5, riv: 5 });
  assert.deepEqual([sinProm.tBip.n, sinProm.tBip.prom, sinProm.tBip.max], [null, null, null]);
});

test("a mano: partido suelto y complemento de Uni-Dat; prioridad Uni-Dat y no se pierde lo manual", () => {
  // partido suelto: sólo suma la clave si se cargó (sin tiempos, la fila es la de siempre)
  const base = { ...valoresPartido(null), r: "CAP", f: "2026-05-02" };
  assert.equal(Object.hasOwn(armarPartido(base, null, null).fila.datos, "tiempo_juego"), false);
  const r = armarPartido({ ...base, ...CASILLAS }, null, null);
  assert.deepEqual(r.fila.datos.tiempo_juego, PLANILLA);
  assert.equal(r.aviso[0], "ojo");
  assert.ok(armarPartido({ ...base, tjbip: "x" }, null, null).errores[0].startsWith("En juego (BIP): escribilo"));
  const [suelto] = partidosBase([], [manual("m0", PLANILLA)]);
  assert.equal(suelto.tiempo_juego.bip, 1810000);

  // complemento de un partido de Uni-Dat SIN tiempos medidos: se cargan a mano
  const [a] = partidosBase([fila("a")], []);
  assert.deepEqual(armarComplemento({ ...valoresComplemento(a), ...CASILLAS }, a).fila.datos.tiempo_juego, PLANILLA);
  const [a2] = partidosBase([fila("a")], [manual("m1", PLANILLA, "a")]);
  assert.equal(a2.tiempo_juego.manual, true);
  // guardar de nuevo (por ejemplo, sólo tarjetas) con las casillas como vinieron: los tiempos siguen
  assert.deepEqual(armarComplemento({ ...valoresComplemento(a2), ...valoresTiempo(a2.tiempo_juego_manual) }, a2).fila.datos.tiempo_juego, PLANILLA);
  // vaciar las casillas los saca
  assert.equal(Object.hasOwn(armarComplemento(valoresComplemento(a2), a2).fila.datos, "tiempo_juego"), false);

  // partido de Uni-Dat CON tiempos medidos: vale Uni-Dat; lo manual no se usa pero se conserva al guardar
  const [b] = partidosBase([fila("b", CORTO)], [manual("m2", PLANILLA, "b")]);
  assert.equal(b.tiempo_juego.manual, undefined);
  assert.equal(b.tiempo_juego.bip, 60000);
  assert.equal(tiempoUnidat(b), b.tiempo_juego);
  assert.deepEqual(armarComplemento({ ...valoresComplemento(b), tjbip: "basura" }, b).fila.datos.tiempo_juego, PLANILLA);   // no se leen
  const [b2] = partidosBase([fila("b", CORTO)], []);
  assert.equal(Object.hasOwn(armarComplemento(valoresComplemento(b2), b2).fila.datos, "tiempo_juego"), false);
});

test("a mano: el partido muestra la lupa y los tramos (sin cinta) y la temporada junta todos los tramos", () => {
  const ps = partidosBase([fila("a", CORTO), fila("b")], [manual("m", PLANILLA, "b")]);
  const lz = new Registro();
  tiempoDeJuego(lz, ps[1]);
  assert.equal(lz.llamadas.filter((l) => l.f === "plotly_chart").length, 0);
  const txt = JSON.stringify(lz.llamadas);
  assert.ok(txt.includes("18:16<small>59%</small>"), "posesión sobre UNI + Rival (18:16 de 31:00)");
  assert.ok(txt.includes("El partido") && txt.includes("<b>1:25:29</b>") && txt.includes("<b>30:10</b>"), "los dos totales de la lupa");
  const limpio = txt.replaceAll("\\", "");
  assert.ok(limpio.includes("<b>32<small>seg</small></b>") && limpio.includes("<b>2:02<small>min</small></b>"), "promedio y la más larga, del mismo tamaño");
  assert.ok(!/\d+ veces/.test(txt), "sin la cantidad estimada");
  assert.ok(!txt.includes("Cada vez que la tuvo"));
  // temporada: 2 tramos de Uni-Dat (60 s) + 57 estimados (1810 s) → (60 + 1810) / 59 = 31,7 s ≈ 0:32
  const t = temporada(ps, 2026, "Primera");
  const lt = new Registro();
  tiempoDeJuegoTemporada(lt, t);
  const tt = JSON.stringify(lt.llamadas);
  assert.equal(lt.llamadas.filter((l) => l.f === "plotly_chart").length, 2);   // la línea partido a partido + las barras
  assert.ok(tt.includes("Cada vez que se jugó") && tt.replaceAll("\\", "").includes("<b>32<small>seg</small></b>"));
  assert.ok(/<b>2:02<small>min<\/small><\/b><small>[^<]+<\/small>/.test(tt.replaceAll("\\", "")), "la más larga, con su partido");
  assert.ok(tt.includes("2 de 2 partidos tienen el tiempo de juego cargado."));
});

test("seguridad: un rival con HTML no se ejecuta (el tramo más largo muestra el partido)", () => {
  const malo = { ...fila("z", CORTO), rival: '<img src=x onerror="alert(1)">' };
  const ps = partidosBase([malo, fila("b")], [manual("m", PLANILLA, "b")]);
  const lt = new Registro();
  tiempoDeJuegoTemporada(lt, temporada(ps, 2026, "Primera"));
  const tt = JSON.stringify(lt.llamadas);
  assert.ok(!tt.includes("<img"), "sin la etiqueta cruda");
  // y lo de la base que no es un número no llega a las cuentas
  const [raro] = partidosBase([fila("r")], [manual("m", { ...PLANILLA, bip: "<b>1</b>" }, "r")]);
  assert.equal(Object.hasOwn(raro, "tiempo_juego"), false);
});

// ── El tiempo de juego en el informe PDF (nov 2026) ─────────────────────────
const seccionTJ = (x) => {
  const i = x.bloques.findIndex((b) => b.tipo === "seccion" && b.titulo === "Tiempo de juego");
  if (i < 0) return null;
  const fin = x.bloques.findIndex((b, k) => k > i && b.tipo === "seccion");
  return x.bloques.slice(i + 1, fin < 0 ? undefined : fin);
};
const dibujar = (x) => armarPdf(jsPDF, x.bloques, { titulo: x.titulo, pie: x.pie, generado: "Generado hoy" }).getNumberOfPages();

test("PDF: un partido sin tiempo de juego queda igual que siempre (sin la sección)", () => {
  const ps = partidosBase([fila("a"), fila("c", ENTERO)], []);
  const t = temporada(ps, 2026, "Primera");
  assert.equal(seccionTJ(informe(t, "Primera", ps[0])), null);
  assert.equal(seccionTJ(informe(temporada([ps[0]], 2026, "Primera"), "Primera")), null);
});

test("PDF: un partido medido en Uni-Dat: la lupa con la temporada debajo, cuánto duró cada vez y 1° y 2° tiempo", () => {
  const otro = { ...fila("b", marcas([0, "UNI"], [60, "OUT"], [100, "PAUSA"], [900, "RIVAL", "ST"], [940, "PAUSA", "ST"])), fecha: "2026-11-08" };
  const ps = partidosBase([fila("a", ENTERO), otro], []);
  const x = informe(temporada(ps, 2026, "Primera"), "Primera", ps[0]);
  const [lupa, veces, mitades, nota] = seccionTJ(x);
  assert.equal(lupa.frase, "De cada 10 minutos, la pelota estuvo en juego 4 y medio.");
  assert.deepEqual(lupa.barras.map((b) => [b.titulo, b.total]), [["El partido", "2:40"], ["El tiempo en juego", "1:10"]]);
  assert.deepEqual(lupa.barras[0].partes.map((p) => [p.rotulo, p.valor, p.pct, p.peso, p.color, p.abajo]),
    [["En juego", "1:10", 44, 70000, "acento", "Temporada 57%"], ["Pelota muerta", "1:30", 56, 90000, "neutro", "Temporada 43%"]]);
  assert.deepEqual(lupa.barras[1].partes.map((p) => [p.valor, p.pct, p.abajo]), [["1:00", 86, "Temporada 71%"], ["0:10", 14, "Temporada 29%"]]);
  assert.deepEqual(veces.columnas.map((c) => c.titulo), ["Cuánto duró", "Promedio", "La más larga", "Veces"]);
  assert.deepEqual(veces.filas, [["Cada vez que se jugó", "23 seg", "40 seg", "3"], ["Cada vez que se paró", "45 seg", "1:00 min", "2"],
    ["Cada vez que la tuvo UNI", "30 seg", "40 seg", "2"], ["Cada vez que la tuvo el rival", "10 seg", "10 seg", "1"]]);
  assert.deepEqual(mitades.filas, [["Lo que duró", "1:00", "1:40"], ["En juego", "0:30 · 50%", "0:40 · 40%"],
    ["Pelota muerta", "0:30 · 50%", "1:00 · 60%"], ["UNI con la pelota", "0:20 · 67%", "0:40 · 100%"], ["Rival con la pelota", "0:10 · 33%", "0:00 · 0%"]]);
  assert.equal(nota.tipo, "nota");
  assert.ok(dibujar(x) >= 1);
});

test("PDF: un partido a mano (sin cantidad ni 1° y 2° tiempo) y los avisos de carga como nota", () => {
  const [p] = partidosBase([], [manual("m0", PLANILLA)]);
  const x = informe(temporada([p], 2026, "Primera"), "Primera", p);
  const [lupa, nota, veces, ...resto] = seccionTJ(x);
  assert.equal(lupa.barras[0].partes[0].abajo, null);   // un solo partido con tiempo: sin temporada para comparar
  assert.ok(nota.texto.includes("En la planilla, UNI + Rival da 31:00") && nota.texto.includes("por eso dura más de 80 minutos"));
  assert.deepEqual(veces.columnas.map((c) => c.titulo), ["Cuánto duró", "Promedio", "La más larga"]);
  assert.deepEqual(veces.filas, [["Cada vez que se jugó", "32 seg", "2:02 min"], ["Cada vez que se paró", "59 seg", "2:55 min"]]);
  assert.equal(resto.length, 0);
  assert.ok(dibujar(x) >= 1);
  // sólo el 1° tiempo y sin cerrar: se dice, y el 2° tiempo va con rayas
  const [q] = partidosBase([fila("a", marcas([0, "UNI"], [30, "OUT"], [60, "RIVAL"]))], []);
  const s = seccionTJ(informe(temporada([q], 2026, "Primera"), "Primera", q));
  assert.ok(s[1].texto.includes("Sólo está medido el 1° tiempo") && s[1].texto.includes("quedó abierto"));
  assert.deepEqual(s.find((b) => b.columnas?.[0].titulo === "1° y 2° tiempo").filas[1], ["En juego", "0:30 · 50%", "—"]);
});

test("PDF: la temporada: el promedio, cuánto duró cada vez (con su partido) y partido a partido; un rival con HTML se dibuja como texto", () => {
  const soloPT = { ...fila("b", marcas([0, "UNI"], [30, "OUT"], [60, "PAUSA"])), rival: "<b>Mitad</b>", fecha: "2026-11-08" };
  const ps = partidosBase([fila("a", ENTERO), soloPT], []);
  const x = informe(temporada(ps, 2026, "Primera"), "Primera");
  const [lupa, nota, veces, partidos] = seccionTJ(x);
  assert.deepEqual(lupa.barras.map((b) => [b.titulo, b.total]), [["El partido, en promedio", "2:40"], ["El tiempo en juego, en promedio", "1:10"]]);
  assert.ok(nota.texto.startsWith("Promedio de 1 partido. 2 de 2 partidos tienen el tiempo de juego cargado. No entra en el promedio"));
  assert.deepEqual(veces.filas[0], ["Cada vez que se jugó", "25 seg", "40 seg", "7 nov · X"]);
  assert.deepEqual(partidos.filas, [["7 nov · X", "1:10 · 44%", "1:00 · 86%"], ["8 nov · bMitad/b (sólo 1° T)", "0:30 · 50%", "0:30 · 100%"]]);
  assert.ok(dibujar(x) >= 1);
});
