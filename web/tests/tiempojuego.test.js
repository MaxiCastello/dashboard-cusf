// Tiempo de juego cargado en Uni-Dat (sección TIEMPO DE JUEGO, nov 2026): la
// columna partidos.tiempos guarda la hora de cada toque y el tablero hace las
// cuentas. Los partidos sin tiempos tienen que quedar exactamente como eran.
import assert from "node:assert/strict";
import { test } from "node:test";

import { limpiarTiempos, partidosBase, temporada, tiempoJuego, tiempoJuegoManual, tiempoManualValido } from "../sitio/js/calculos.js";
import { armarComplemento, armarPartido, armarTiempo, segundos, tiempoUnidat, valoresComplemento, valoresPartido, valoresTiempo }
  from "../sitio/js/carga.js";
import { mmss } from "../sitio/js/formato.js";
import { Registro } from "../sitio/js/lienzo.js";
import { kpis, anillos } from "../sitio/js/piezas.js";
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
  assert.equal(fs.length, 3);
  const vacio = new Registro();
  tiempoDeJuego(vacio, ps[0]);
  assert.equal(vacio.llamadas.filter((l) => l.f === "plotly_chart").length, 0);
  const t = temporada(ps, 2026, "Primera");
  const lt = new Registro();
  tiempoDeJuegoTemporada(lt, t);
  assert.equal(lt.llamadas.filter((l) => l.f === "plotly_chart").length, 1);
  assert.ok(JSON.stringify(lt.llamadas).includes("1 de 2 partidos tienen el tiempo de juego cargado."));
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
  assert.ok(txt.includes("<b>0:32</b>") && txt.includes("<b>2:02</b>"), "promedio y el más largo, del mismo tamaño");
  assert.ok(!/\d+ tramos/.test(txt), "sin la cantidad estimada");
  assert.ok(!txt.includes("Cada posesión"));
  // temporada: 2 tramos de Uni-Dat (60 s) + 57 estimados (1810 s) → (60 + 1810) / 59 = 31,7 s ≈ 0:32
  const t = temporada(ps, 2026, "Primera");
  const lt = new Registro();
  tiempoDeJuegoTemporada(lt, t);
  const tt = JSON.stringify(lt.llamadas);
  assert.equal(lt.llamadas.filter((l) => l.f === "plotly_chart").length, 2);   // la línea partido a partido + las barras
  assert.ok(tt.includes("Pelota en juego, cada tramo") && tt.includes("<b>0:32</b>"));
  assert.ok(/<b>2:02<\/b><small>[^<]+<\/small>/.test(tt.replaceAll("\\", "")), "el tramo más largo, con su partido");
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
