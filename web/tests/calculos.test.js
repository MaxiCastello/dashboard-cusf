// Las cuentas de la página contra lo que calculó el Python con la misma
// copia de la base (la referencia): cada partido, cada temporada, una(), los
// tackles y los objetivos, campo por campo, con los null y en el mismo
// orden. Los casos raros, con partidos al azar, los prueba
// pruebas/fuzz_cuentas.py.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";

import * as C from "../sitio/js/calculos.js";
import { PLANILLA_2025 } from "../sitio/js/planilla2025.js";
import { armar, canon, canonDeJson, diferencia } from "./_armar.js";
import { PRUEBAS, REF, filasDe, leer } from "./_referencia.js";

for (const sub of ["base", "demo"]) {
  test(`todas las cuentas, iguales al Python (${sub})`, () => {
    const ref = canonDeJson(readFileSync(join(REF, sub, "cuentas.json"), "utf8"));
    const cuentas = leer(sub, "cuentas.json");
    const [unidat, manuales] = cuentas.origen === "demo"
      ? [C.leerJson(readFileSync(join(PRUEBAS, "demo_partidos.json"), "utf8")), []]
      : filasDe(cuentas);
    // la referencia dice además de qué copia salió: eso no es una cuenta
    const esperado = ["D", ref[1].filter(([k]) => k !== "origen")];
    const hecho = canon(armar(unidat, manuales, { hayTabla: cuentas.hay_tabla_manuales }));
    assert.equal(diferencia(hecho, esperado, sub), null);
    // y que se haya comparado algo de verdad
    assert.ok(cuentas.partidos.length >= 5 && cuentas.temporadas.length >= 2, "referencia casi vacía");
  });
}

test("la planilla 2025 de la página es la del Python (exportar_2025.py al día)", () => {
  // contra el texto del archivo (en su orden), no contra un objeto de JS ya reordenado
  const ref = canonDeJson(readFileSync(join(REF, "base", "cuentas.json"), "utf8"));
  const temporadas = ref[1].find(([k]) => k === "temporadas")[1].slice(1);
  const t2025 = temporadas.find((t) => t[1].some(([k, v]) => k === "anio" && v === 2025));
  assert.equal(diferencia(canon(PLANILLA_2025), t2025[1].find(([k]) => k === "t")[1], "2025"), null);
  assert.equal(PLANILLA_2025.partidos.length, 16);
});

test("canonDeJson() respeta el orden de las claves que parecen números, y no confunde textos con claves", () => {
  const c = canonDeJson('{"12": 1, "8": {"x": "a\\": b", "3": [true, null]}}');
  assert.deepEqual(c, ["D", [["12", 1], ["8", ["D", [["x", 'a": b'], ["3", ["L", ["B", true], null]]]]]]]);
  assert.notEqual(diferencia(canon({ a: 1, b: 2 }), canon({ b: 2, a: 1 })), null);   // el orden cuenta
  assert.notEqual(diferencia(canon([1]), canon([true])), null);                       // True no es 1
});

test("el plantel queda en el orden en que lo manda la base aunque los dorsales parezcan números", () => {
  const json = '{"id":"x","fecha":"2026-05-01","tackles":{"session":{"registros":[{"jugador":"9","nombre":"Nueve",' +
    '"tipo":"Positivo"}]},"jugadores":{"12":"Doce","8":"Ocho","9":"Nueve","__proto__":"Proto"}}}';
  assert.deepEqual(Object.keys(JSON.parse(json).tackles.jugadores), ["8", "9", "12", "__proto__"]);   // JSON.parse los reordena
  const p = C.desdeUnidat(C.leerJson(json));
  assert.deepEqual([...p.plantel.keys()], ["12", "8", "9", "__pr"]);
  // los que no tacklearon, en ese orden (como en el Python)
  assert.deepEqual(C.tacklesTemporada([p]).map((j) => j.nombre), ["Nueve", "Doce", "Ocho", "Proto"]);
});

test("texto(), entero(), esVerdad() y categoriaBase() como en Python", () => {
  assert.equal(C.texto("  Alma <b>Juniors</b>  "), "Alma bJuniors/b");
  assert.equal(C.texto(null), "");
  assert.equal(C.texto(0), "");
  assert.equal(C.texto(12), "12");
  assert.equal(C.texto(true), "True");
  assert.equal(C.texto(0.00001), "1e-05");
  assert.equal(C.texto(["a", "b's"]), `['a', "b's"]`);
  assert.equal(C.texto("x".repeat(70)).length, 60);
  assert.equal(C.texto("😀".repeat(70)), "😀".repeat(60));   // 60 letras, no 60 unidades de JS
  assert.equal(C.texto("a\u001fb﻿c"), "a b﻿c");     // los espacios de Python, no los de JS
  assert.deepEqual([C.entero("12"), C.entero(" 7 "), C.entero("1_000"), C.entero(12.9), C.entero("12.5"), C.entero(null),
    C.entero(true), C.entero("x"), C.entero("٣٤"), C.entero("1__0")], [12, 7, 1000, 12, 0, 0, 1, 0, 34, 0]);
  assert.deepEqual([0, "", [], {}, null, Number.NaN, "0", [0], new Map()].map(C.esVerdad),
    [false, false, false, false, false, true, true, true, false]);
  assert.deepEqual([C.categoriaBase("primera oro f3"), C.categoriaBase("  INTERMEDIA "), C.categoriaBase(""), C.categoriaBase(null),
    C.categoriaBase("ǆungla"), C.categoriaBase("ßeta")], ["Primera", "Intermedia", "Sin categoría", "Sin categoría", "ǅungla", "Sseta"]);
});

test("aniosDisponibles() y categoriasDe() como en el Python", () => {
  assert.deepEqual(C.aniosDisponibles([]), [2025]);
  assert.deepEqual(C.aniosDisponibles([{ fecha: "2027-01-10" }, { fecha: "2024-05-01" }]), [2027, 2025, 2024]);
  const ps = ["intermedia", "Primera oro", "M19", "Ñandúes", "Zeta", "intermedia b", "￿", "😀"]
    .map((c) => ({ fecha: "2027-02-01", categoria: c }));
  // Python: sorted({...}, key=lambda c: (c != "Primera", c)): letra por letra (😀 va después de ￿)
  assert.deepEqual(C.categoriasDe(ps, 2027), ["Primera", "Intermedia", "M19", "Zeta", "Ñandúes", "￿", "😀"]);
  assert.deepEqual(C.categoriasDe(ps, 2026), []);
});

test("desdeManual(): sólo las claves del line (no toString ni constructor), y recuperadas null si no se cargaron", () => {
  const p = C.desdeManual({ id: "x", fecha: "2026-01-01", datos: { line: { uLan: "5", toString: 3, constructor: 1, otra: 2 } } });
  assert.deepEqual(Object.keys(p.line), ["uLan", "uGan", "uPer", "uRec", "rLan", "rGan", "rPer", "rRec"]);
  assert.equal(p.line.uLan, 5);
  assert.equal(p.line.uRec, null);
  assert.equal(p.line.rRec, null);
  assert.equal(C.desdeManual({ datos: { line: { uRec: 2 } } }).line.uRec, 2);
});

test("donde el Python se cae, la página corta con ErrorDatos (no muestra números)", () => {
  const malos = [
    [[{ id: "a", fecha: "2026-01-01", main: { eventos: [{ tipo: "SCRUM", data: 5 }] } }], []],
    [[{ id: "a", fecha: "2026-01-01", main: { eventos: 3 } }], []],
    [[{ id: "a", fecha: "2026-01-01", main: { eventos: [{ tipo: "TRY", equipo: "UNI", periodo: "PT", puntos: "5" }] } }], []],
    [[{ id: "a", fecha: 20260101 }], []],
    [[{ id: "a", fecha: "2026-01-01" }], [{ partido_id: "a", datos: {} }]],          // complemento sin id
    [[], [{ id: "m", fecha: "2026-01-01", datos: { tackles_registros: ["x"] } }]],
    [[{ id: "a", fecha: "20x6-01-01" }], []],
  ];
  for (const [u, m] of malos) assert.throws(() => armar(u, m), C.ErrorDatos, JSON.stringify([u, m]));
});

test("leerJson(): un texto larguísimo (una imagen en base64) no rompe la lectura, y respeta el orden", () => {
  const json = `{"img":"${"A".repeat(5e6)}\\"x","12":1,"8":["a\\\\",{"3":2,"1":3}]}`;
  const x = C.leerJson(json);
  assert.equal(x.img.length, 5e6 + 2);
  assert.deepEqual(canonDeJson(json)[1].map(([k]) => k), ["img", "12", "8"]);
});

test("un dorsal que isdigit() acepta pero no es un número (\"²\"): el Python se cae, la página corta", () => {
  const fila = { id: "a", fecha: "2026-01-01", tackles: { session: { registros: [{ jugador: "²", nombre: "X", tipo: "Positivo" }] } } };
  assert.throws(() => armar([fila], []), C.ErrorDatos);
});
