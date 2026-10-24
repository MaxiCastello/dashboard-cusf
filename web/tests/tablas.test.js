// La comparación con que se ordena la tabla de TACKLES tocando un
// encabezado: la "smart" de Glide (Streamlit), copiada de su código. El orden
// de verdad, columna por columna, se mira contra Streamlit en el navegador
// (comparar_orden_tabla.py); acá, los casos que podrían salir mal.
import assert from "node:assert/strict";
import { test } from "node:test";

import { compararSmart } from "../sitio/js/tablas.js";

const ordenar = (vals) => vals.map((_, i) => i).sort((a, b) => compararSmart(vals[a], vals[b])).map((i) => vals[i]);

test("los números (aunque vengan como texto) se comparan como números, no letra por letra", () => {
  assert.deepEqual(ordenar(["10", "9", "100", "2.5"]), ["2.5", "9", "10", "100"]);
  assert.deepEqual(ordenar([10, 9, 100]), [9, 10, 100]);
  assert.equal(compararSmart("86", 86), 0);
});

test("los textos, como palabras (con acentos y mayúsculas como el navegador)", () => {
  assert.deepEqual(ordenar(["Zárate", "álvarez", "Benítez"]), ["álvarez", "Benítez", "Zárate"]);
});

test("un vacío vale como 0 contra un número, como en Glide", () => {
  assert.equal(compararSmart("", "0"), 0);
  assert.equal(compararSmart("", "5"), -1);
  assert.equal(compararSmart("5", ""), 1);
});

test("los empates quedan en el orden en que venían", () => {
  const filas = [["Ana", "3"], ["Beto", "1"], ["Caro", "3"], ["Dani", "1"]];
  const orden = filas.map((_, i) => i).sort((a, b) => compararSmart(filas[a][1], filas[b][1]));
  assert.deepEqual(orden.map((i) => filas[i][0]), ["Beto", "Dani", "Ana", "Caro"]);
});
