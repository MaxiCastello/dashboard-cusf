// FASE 1: casos a mano. En la fase 2 se suman miles de casos al azar con los
// resultados que da Python.
import assert from "node:assert/strict";
import { test } from "node:test";

import { esc, pct, redondear, xdey } from "../sitio/js/formato.js";

test("redondear() es el round() de Python: los .5 exactos van al par", () => {
  const casos = [[0.5, 0], [1.5, 2], [2.5, 2], [12.5, 12], [13.5, 14], [-0.5, 0], [-1.5, -2], [-2.5, -2],
    [0.49999999999999994, 0], [2.675, 3], [74.99, 75], [75.01, 75], [0, 0], [100, 100]];
  for (const [x, esperado] of casos) assert.equal(redondear(x), esperado, `redondear(${x})`);
});

test("pct() da lo mismo que round(a * 100 / b) de Python", () => {
  // valores de Python: [round(a * 100 / b) for a, b in ...]
  const casos = [[1, 8, 12], [3, 8, 38], [1, 40, 2], [3, 40, 8], [5, 8, 62], [7, 8, 88], [103, 137, 75],
    [79, 88, 90], [16, 62, 26], [69, 102, 68], [774, 927, 83], [6, 22, 27], [1, 3, 33], [2, 3, 67], [0, 5, 0]];
  for (const [a, b, esperado] of casos) assert.equal(pct(a, b), esperado, `pct(${a}, ${b})`);
  assert.equal(pct(3, 0), 0);
  assert.equal(pct(3, null), 0);
});

test("xdey(): el denominador antes que el porcentaje", () => {
  assert.equal(xdey(18, 24), "18 de 24 · 75%");
  assert.equal(xdey(0, 0), "—");
  assert.equal(xdey(1, 8), "1 de 8 · 12%");
});

test("esc() escapa igual que html.escape(quote=True)", () => {
  assert.equal(esc(`<img src=x onerror="alert('1')">&`), "&lt;img src=x onerror=&quot;alert(&#x27;1&#x27;)&quot;&gt;&amp;");
  assert.equal(esc(12), "12");
  assert.equal(esc("Ñandú · García"), "Ñandú · García");
});
