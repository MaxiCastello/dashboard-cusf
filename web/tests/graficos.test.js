// Cada gráfico del Python, vuelto a armar con graficos.js, tiene que dar el
// MISMO JSON (datos, textos, hover, colores, alto). FASE 1: dona y pesas.
import assert from "node:assert/strict";
import { test } from "node:test";

import { FUENTE_STREAMLIT, dibujadas, dibujar, dona, pesas } from "../sitio/js/graficos.js";
import { TEMA } from "../sitio/js/tema.js";
import { leer, llamadas } from "./_referencia.js";

const figuras = (sub) => llamadas(sub).filter((l) => l.f === "plotly_chart");
const CENTRO = /^<span style='font-family:[^']*;font-size:34px'>(.*?)<\/span>(?:<br><span style='font-size:11px;color:#8b93a3'>(.*)<\/span>)?$/s;

test("el tema de los gráficos es el del Python", () => {
  for (const sub of ["base", "demo"]) assert.deepEqual(TEMA, leer(sub, "tema.json"));
});

for (const sub of ["base", "demo"]) {
  test(`dona(): todas las tortas de la referencia (${sub})`, () => {
    const tortas = figuras(sub).filter((l) => l.fig.data.length === 1 && l.fig.data[0].type === "pie");
    assert.ok(tortas.length >= 10, `pocas tortas en la referencia: ${tortas.length}`);
    for (const { fig, donde } of tortas) {
      const [t] = fig.data;
      const m = fig.layout.annotations[0].text.match(CENTRO);
      assert.ok(m, `${donde}: centro con otra forma`);
      const hecha = dona(t.labels, t.values, t.marker.colors, m[1], m[2] ?? "", fig.layout.height);
      assert.deepEqual(hecha, fig, donde);
    }
  });

  test(`pesas(): todos los "Partido a partido" de la referencia (${sub})`, () => {
    const todas = figuras(sub).filter((l) => l.fig.layout.xaxis?.rangemode === "tozero" &&
      l.fig.data.some((t) => t.marker?.size === 15));
    assert.ok(todas.length >= 1, "no hay pesas en la referencia");
    for (const { fig, donde } of todas) {
      const puntos = fig.data.filter((t) => t.mode === "markers");
      const txt = fig.data.find((t) => t.mode === "text");
      const [u, r] = puntos;
      const hecha = pesas(u.y, u.x, r.x, { nombres: [u.name, r.name], colores: [u.marker.color, r.marker.color],
        tituloX: fig.layout.xaxis.title.text, alto: fig.layout.height, textos: txt?.text ?? null });
      assert.deepEqual(hecha, fig, donde);
    }
  });
}

test("dona() deja afuera lo que vale 0, y sin nada no dibuja", () => {
  const f = dona(["Ganados", "Empatados", "Perdidos"], [9, 0, 4], ["#a", "#b", "#c"], "9-0-4");
  assert.deepEqual(f.data[0].labels, ["Ganados", "Perdidos"]);
  assert.deepEqual(f.data[0].marker.colors, ["#a", "#c"]);
  assert.equal(f.layout.annotations[0].text.includes("<br>"), false);   // sin subtítulo
  assert.equal(dona(["A", "B"], [0, 0], ["#a", "#b"], "0"), null);
});

test("pesas(): el alto sale de la cantidad de partidos, y sin textos no hay renglón de texto", () => {
  const f = pesas(["a", "b", "c"], [1, 5, 3], [4, 2, 3]);
  assert.equal(f.layout.height, 80 + 38 * 3);
  assert.equal(f.data.length, 3 + 2);
  assert.equal(pesas(["a"], [1], [2], { textos: [] }).data.length, 1 + 2);
  assert.deepEqual(pesas(["a", "b"], [1, 5], [4, 2], { textos: ["x", "y"] }).data.at(-1).x, [4, 5]);
});

// Cada letra que recibe Plotly lleva al final la llave del caché de medidas
// (ver dibujar()): se la saca, y se mira que esté en todas.
function sinLlave(o, llave, vistas = []) {
  if (Array.isArray(o)) o.forEach((v) => sinLlave(v, llave, vistas));
  else if (o && typeof o === "object") {
    for (const [k, v] of Object.entries(o)) {
      if (k === "family") {
        vistas.push(v);
        assert.ok(v.endsWith(`, ${llave}`), `letra sin la llave: ${v}`);
        o[k] = v.slice(0, -`, ${llave}`.length);
      } else sinLlave(v, llave, vistas);
    }
  }
  return vistas;
}

test("dibujar(): a Plotly le llega la figura con la letra que pone Streamlit, el tema y la config; la figura no cambia", async () => {
  const llamadasPlotly = [];
  globalThis.window = { Plotly: { newPlot: async (...a) => llamadasPlotly.push(a) } };
  try {
    const fig = dona(["Ganados", "Perdidos"], [3, 1], ["#00c853", "#ff1744"], "3-0-1");
    const copia = structuredClone(fig);
    const el = {};
    await dibujar(el, fig);
    const [[elPlotly, data, layout, config]] = llamadasPlotly;
    // sin letras que lleguen (no hay página), la llave es la del principio
    assert.ok(sinLlave(layout, "cusf-letras-0").length >= 2);
    sinLlave(data, "cusf-letras-0");
    assert.equal(elPlotly, el);
    assert.deepEqual(data, copia.data);
    assert.deepEqual(layout, { ...copia.layout, font: FUENTE_STREAMLIT, template: TEMA });
    assert.deepEqual(config, { displayModeBar: false, scrollZoom: false });   // el ancho lo pone dibujar() (como Streamlit)
    assert.equal(dibujadas.get(el), fig);
    assert.deepEqual(fig, copia);                       // Plotly recibe copias
    assert.notEqual(layout.template, TEMA);             // ni el tema compartido
    assert.deepEqual(FUENTE_STREAMLIT, { color: "#e8eaf0", family: '"Source Sans", sans-serif, "Source Sans", sans-serif' });
  } finally {
    delete globalThis.window;
  }
});
