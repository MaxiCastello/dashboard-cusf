// Casos a mano con los valores que da Python. Miles de casos al azar más,
// contra Python, en pruebas/fuzz_cuentas.py.
import assert from "node:assert/strict";
import { test } from "node:test";

import { coma, conSigno, esc, fijo, pct, redondear, unDecimal, xdey } from "../sitio/js/formato.js";

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

test("fijo() es f\"{x:.1f}\" / f\"{x:.0f}\" de Python: en el empate justo va al par (toFixed sube)", () => {
  // valores de Python: [f"{x:.1f}", f"{x:.0f}"]
  const casos = [[0.25, "0.2", "0"], [0.75, "0.8", "1"], [2.5, "2.5", "2"], [12.5, "12.5", "12"], [13.5, "13.5", "14"],
    [0.05, "0.1", "0"], [0.15, "0.1", "0"], [0.35, "0.3", "0"], [2.25, "2.2", "2"], [9.95, "9.9", "10"],
    [-0.25, "-0.2", "-0"], [-2.5, "-2.5", "-2"], [1 / 3, "0.3", "0"], [2 / 3, "0.7", "1"], [0, "0.0", "0"],
    [100, "100.0", "100"], [3, "3.0", "3"], [10, "10.0", "10"]];
  for (const [x, uno, cero] of casos) {
    assert.equal(fijo(x, 1), uno, `fijo(${x}, 1)`);
    assert.equal(fijo(x, 0), cero, `fijo(${x}, 0)`);
  }
  assert.equal(unDecimal(2.25), "2,2");
});

test("coma() y conSigno() como _coma() y f\"{n:+d}\" de vistas.py", () => {
  assert.deepEqual([3, 2.5, 10, 100, 0.05, 1 / 3].map(coma), ["3", "2,5", "10", "100", "0,1", "0,3"]);
  assert.deepEqual([5, -3, 0].map(conSigno), ["+5", "-3", "+0"]);
});

test("fijo() con números enormes escribe todas las cifras (como Python), y sin número corta", () => {
  assert.equal(fijo(1e21, 1), "1000000000000000000000.0");
  assert.equal(fijo(-1e22, 0), "-10000000000000000000000");
  for (const x of [Number.NaN, Infinity, -Infinity]) assert.throws(() => fijo(x, 1), RangeError);
});
