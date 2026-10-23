// Los anillos y los números grandes tienen que dar el MISMO HTML que el
// Python, letra por letra; y todo texto de los datos sale escapado.
import assert from "node:assert/strict";
import { test } from "node:test";

import { anillos, html, kpis } from "../sitio/js/piezas.js";
import { llamadas } from "./_referencia.js";

const html_de = (sub, clase) =>
  llamadas(sub).filter((l) => l.f === "markdown" && l.cuerpo?.startsWith(`<div class="${clase}"`));

// Saca de un HTML de anillos los datos con que se armó (sirve para volver a
// armarlo y comparar).
function itemsAnillos(cuerpo) {
  const re = /<div class="anillo"><div class="r" style="background:conic-gradient\((#[0-9a-f]+) \d+%,#1c2028 0\)"><div class="c">(?:(\d+)<span class="de">de (\d+)<\/span><small>\d+%<\/small>|—<small>sin datos<\/small>)<\/div><\/div><div class="l">(?:<i>(.*?)<\/i>)?(.*?)<\/div><\/div>/g;
  const des = (s) => s.replaceAll("&lt;", "<").replaceAll("&gt;", ">").replaceAll("&quot;", '"').replaceAll("&#x27;", "'").replaceAll("&amp;", "&");
  return [...cuerpo.matchAll(re)].map(([, color, a, b, arriba, rotulo]) =>
    [des(rotulo), a === undefined ? 0 : Number(a), b === undefined ? 0 : Number(b), color, arriba === undefined ? null : des(arriba)]);
}

for (const sub of ["base", "demo"]) {
  test(`anillos(): todos los de la referencia, letra por letra (${sub})`, () => {
    const todos = html_de(sub, "anillos");
    assert.ok(todos.length >= 10, `pocos anillos en la referencia: ${todos.length}`);
    for (const { cuerpo, donde } of todos) {
      const items = itemsAnillos(cuerpo);
      assert.equal(items.length, (cuerpo.match(/class="anillo"/g) ?? []).length, `${donde}: no se leyeron todos`);
      const columnas = cuerpo.match(/^<div class="anillos" style="grid-template-columns:repeat\((\d+),1fr\)">/)?.[1];
      assert.equal(String(anillos(items, columnas ? Number(columnas) : null)), cuerpo, donde);
    }
  });

  test(`kpis(): todos los de la referencia, letra por letra (${sub})`, () => {
    const todos = html_de(sub, "kpis");
    assert.ok(todos.length >= 10, `pocos kpis en la referencia: ${todos.length}`);
    const re = /<div class="kpi"><div class="v" style="color:(#[0-9a-f]+)">(.*?)<\/div><div class="l">(.*?)<\/div><\/div>/g;
    const des = (s) => s.replaceAll("&#x27;", "'").replaceAll("&quot;", '"').replaceAll("&lt;", "<").replaceAll("&gt;", ">").replaceAll("&amp;", "&");
    for (const { cuerpo, donde } of todos) {
      const items = [...cuerpo.matchAll(re)].map(([, c, v, l]) => [des(v), des(l), c]);
      assert.equal(String(kpis(items)), cuerpo, donde);
    }
  });
}

test("lo que viene de los datos sale escapado, y lo armado con html`` no se escapa dos veces", () => {
  const malo = `<img src=x onerror="alert(1)">`;
  const h = String(anillos([[malo, 1, 2, "#00c853", malo]]));
  assert.equal(h.includes("<img"), false);
  assert.ok(h.includes("&lt;img src=x onerror=&quot;alert(1)&quot;&gt;"));
  assert.equal(String(html`<b>${html`<i>${"a&b"}</i>`}</b>`), "<b><i>a&amp;b</i></b>");
  assert.equal(String(html`${["<", html`<br>`]}`), "&lt;<br>");
});

test("anillos() sin denominador dice 'sin datos' (no 0%)", () => {
  assert.ok(String(anillos([["Line", 0, 0, "#00c853", null]])).includes("—<small>sin datos</small>"));
});

test("kpis(): sin color (null o vacío) va el color del texto, como `c or TEXTO`", () => {
  for (const c of [null, ""]) assert.ok(String(kpis([[1, "a", c]])).includes('style="color:#e8eaf0"'));
});
