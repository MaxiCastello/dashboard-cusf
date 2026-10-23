// Las cuentas de la página de prueba, contra lo que calculó el Python con
// la misma copia de la base. FASE 1: sólo lo que usa la prueba de concepto
// (tanteo, rival, fecha, line, etiquetas); el resto en la fase 2.
import assert from "node:assert/strict";
import { test } from "node:test";

import { aniosDisponibles, categoriaBase, categoriasDe, desdeManual, entero, esVerdad, etiqueta, partidosBase, resultado, temporada, texto }
  from "../sitio/js/calculos.js";
import { filasDe, leer } from "./_referencia.js";

const cuentas = leer("base", "cuentas.json");
const CAMPOS = ["id", "fuente", "rival", "categoria", "fecha", "score_uni", "score_rival", "line"];
const solo = (p) => Object.fromEntries(CAMPOS.map((k) => [k, p[k]]));

test("partidosBase(): los mismos partidos, en el mismo orden y con los mismos datos", () => {
  const [unidat, manuales] = filasDe(cuentas);
  const hechos = partidosBase(unidat, manuales);
  assert.equal(hechos.length, cuentas.partidos.length);
  hechos.forEach((p, i) => assert.deepEqual(solo(p), solo(cuentas.partidos[i]), `partido ${i} (${p.fecha} ${p.rival})`));
});

test("temporada(): los mismos partidos y el mismo total de line", () => {
  const [unidat, manuales] = filasDe(cuentas);
  const partidos = partidosBase(unidat, manuales);
  for (const ref of cuentas.temporadas.filter((x) => !x.t.planilla)) {
    const t = temporada(partidos, ref.anio, ref.categoria);
    assert.deepEqual(t.partidos.map((p) => p.id), ref.t.partidos.map((p) => p.id), `${ref.anio} ${ref.categoria}`);
    assert.deepEqual(t.totales.line, ref.t.totales.line);
    assert.equal(t.totales.score_uni, ref.t.totales.score_uni);
    assert.equal(t.totales.score_rival, ref.t.totales.score_rival);
    assert.deepEqual(t.partidos.map(resultado), ref.partidos.map((p) => p.resultado));
  }
});

test("etiqueta(): igual en todos los partidos (también los de la planilla 2025)", () => {
  let n = 0;
  for (const ref of cuentas.temporadas) {
    ref.t.partidos.forEach((p, i) => {
      assert.equal(etiqueta(p), ref.partidos[i].etiqueta, p.id);
      assert.equal(etiqueta(p, true), ref.partidos[i].etiqueta_corta, p.id);
      n++;
    });
  }
  assert.ok(n >= 20, `pocos partidos: ${n}`);
});

test("texto(), entero(), esVerdad() y categoriaBase() como en Python", () => {
  assert.equal(texto("  Alma <b>Juniors</b>  "), "Alma bJuniors/b");
  assert.equal(texto(null), "");
  assert.equal(texto(0), "");
  assert.equal(texto("x".repeat(70)).length, 60);
  assert.equal(texto("😀".repeat(70)), "😀".repeat(60));   // 60 letras, no 60 unidades de JS
  assert.deepEqual([entero("12"), entero(" 7 "), entero("1_000"), entero(12.9), entero("12.5"), entero(null), entero(true), entero("x")],
    [12, 7, 1000, 12, 0, 0, 1, 0]);
  assert.deepEqual([esVerdad(0), esVerdad(""), esVerdad([]), esVerdad({}), esVerdad(null), esVerdad(Number.NaN), esVerdad("0"), esVerdad([0])],
    [false, false, false, false, false, true, true, true]);
  assert.deepEqual([categoriaBase("primera oro f3"), categoriaBase("  INTERMEDIA "), categoriaBase(""), categoriaBase(null)],
    ["Primera", "Intermedia", "Sin categoría", "Sin categoría"]);
});

test("aniosDisponibles() y la categoría de cada partido, como en el Python", () => {
  const [unidat, manuales] = filasDe(cuentas);
  const partidos = partidosBase(unidat, manuales);
  assert.deepEqual(aniosDisponibles(partidos), cuentas.anios);
  for (const p of partidos) assert.equal(categoriaBase(p.categoria), cuentas.categorias[p.id], p.id);
  // sin partidos queda sólo la planilla; con un año nuevo, ése va primero
  assert.deepEqual(aniosDisponibles([]), [2025]);
  assert.deepEqual(aniosDisponibles([{ fecha: "2027-01-10" }, { fecha: "2024-05-01" }]), [2027, 2025, 2024]);
});

test("categoriasDe(): Primera primero y el resto como sorted() de Python", () => {
  const ps = ["intermedia", "Primera oro", "M19", "Ñandúes", "Zeta", "intermedia b"].map((c) => ({ fecha: "2027-02-01", categoria: c }));
  // Python: sorted({...}, key=lambda c: (c != "Primera", c))
  assert.deepEqual(categoriasDe(ps, 2027), ["Primera", "Intermedia", "M19", "Zeta", "Ñandúes"]);
  assert.deepEqual(categoriasDe(ps, 2026), []);
});

test("desdeManual(): sólo las claves del line (no toString ni constructor), y recuperadas null si no se cargaron", () => {
  const p = desdeManual({ id: "x", fecha: "2026-01-01", datos: { line: { uLan: "5", toString: 3, constructor: 1, otra: 2 } } });
  assert.deepEqual(Object.keys(p.line), ["uLan", "uGan", "uPer", "uRec", "rLan", "rGan", "rPer", "rRec"]);
  assert.equal(p.line.uLan, 5);
  assert.equal(p.line.uRec, null);
  assert.equal(p.line.rRec, null);
  assert.equal(desdeManual({ datos: { line: { uRec: 2 } } }).line.uRec, 2);
});
