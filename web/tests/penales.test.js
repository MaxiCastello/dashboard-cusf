// Lo nuevo de la fase 8 (decisión del usuario, no está en el Python): el
// treemap de "Los de UNI: situación y motivo" con su frase, y los torneos
// de VER (Copa de Oro, Copa Santa Fe). El resto de la pestaña Penales se
// sigue comparando con el Python (vistas.test.js, con _aproposito.js).
import assert from "node:assert/strict";
import { test } from "node:test";

import { partidosBase, sumar, temporada, torneo, torneosDe, TORNEOS } from "../sitio/js/calculos.js";
import { cajas } from "../sitio/js/graficos.js";
import { arbolPenales, frasePenales, SEP } from "../sitio/js/vistas.js";
import { filasDe, leer } from "./_referencia.js";

const pen = (situacion, motivo, uni, rival = 0) => ({ situacion, motivo, uni, rival });
// el id de una caja: "s", la situación y el motivo (o "", "otros")
const id = (...xs) => ["s", ...xs].join(SEP);

// Lo que tiene que cumplir cualquier árbol: una sola raíz, ids sin repetir,
// cada padre existe, cada caja vale la suma de las de adentro y cada penal
// de UNI está una sola vez como hoja, con su cantidad.
function revisar(uni) {
  const nodos = arbolPenales(uni);
  const ids = nodos.map((n) => n.id);
  assert.equal(new Set(ids).size, ids.length, "ids repetidos");
  assert.deepEqual(nodos.filter((n) => !n.padre).map((n) => n.id), ["todos"]);
  for (const n of nodos) if (n.padre) assert.ok(ids.includes(n.padre), `sin padre: ${n.id}`);
  const hijos = (id) => nodos.filter((n) => n.padre === id);
  for (const n of nodos) {
    const hs = hijos(n.id);
    if (hs.length) assert.equal(n.valor, hs.reduce((s, h) => s + h.valor, 0), `${n.id}: no suma lo de adentro`);
  }
  const hojas = nodos.filter((n) => !hijos(n.id).length);
  assert.equal(hojas.length, uni.length, "no está cada penal una vez");
  for (const f of uni) {
    const h = hojas.filter((n) => n.id.startsWith(id(f.situacion, "")) && n.id.endsWith(SEP + f.motivo));
    assert.equal(h.length, 1, `${f.situacion} / ${f.motivo}`);
    assert.equal(h[0].valor, f.uni);
  }
  assert.equal(nodos[0].valor, uni.reduce((s, f) => s + f.uni, 0));
  return nodos;
}

// Lo que se ve sin tocar nada (raíz, situación, motivo: maxdepth 3).
function visibles(nodos) {
  const prof = new Map([["todos", 1]]);
  for (const n of nodos) if (n.padre) prof.set(n.id, prof.get(n.padre) + 1);
  return nodos.filter((n) => prof.get(n.id) <= 3);
}

test("treemap: cada situación con su cuenta y su %; de cada una, hasta 4 motivos y el resto en Otros", () => {
  const uni = [pen("Ruck", "Retener pelota", 25), pen("Ruck", "Estorbar el juego", 20), pen("Ruck", "Pesca indebida", 16),
    pen("Ruck", "Juega desde el piso", 6), pen("Ruck", "Entra de costado", 5), pen("Ruck", "Zambullirse", 4),
    pen("Juego", "Def. en offside", 21), pen("Juego", "Tackle peligroso", 12), pen("Scrum", "Derrumbe", 7),
    pen("Scrum", "Otro", 6), pen("Maul", "Maul", 3), pen("Line", "Sin detalle", 2)];
  const nodos = revisar(uni);
  const total = 127;
  const r = nodos.find((n) => n.id === id("Ruck"));
  assert.equal(r.rotulo, `Ruck · 76 de ${total} (60%)`);
  const deRuck = nodos.filter((n) => n.padre === id("Ruck")).map((n) => n.rotulo);
  // los que tienen al menos el 10% de Ruck (76): 25, 20, 16; el resto (6, 5, 4) en Otros
  assert.deepEqual(deRuck, ["Retener pelota", "Estorbar<br>el juego", "Pesca indebida", "Otros ›"]);
  const otros = nodos.find((n) => n.id === id("Ruck", "", "otros"));
  assert.equal(otros.valor, 15);
  assert.match(otros.texto, /3 motivos$/);
  // Scrum (13 de 127, menos del 15%): una sola caja que se abre
  assert.deepEqual(nodos.filter((n) => n.padre === id("Scrum")).map((n) => n.rotulo), ["2 motivos ›"]);
  // Maul y Line (menos del 8% cada una): juntas en Otras
  assert.equal(nodos.find((n) => n.id === "otras").rotulo, `Otras · 5 de ${total} (4%) ›`);
  assert.deepEqual(nodos.filter((n) => n.padre === "otras").map((n) => n.id), [id("Maul"), id("Line")]);
  assert.equal(nodos.find((n) => n.id === id("Maul")).rotulo, `Maul · 3 de ${total} (2%) ›`);
  // la raíz y el detalle del mouse: "X de Y · Z%"
  assert.equal(nodos[0].rotulo, `${total} penales de UNI`);
  assert.equal(nodos.find((n) => n.id === id("Ruck", "Retener pelota")).detalle, "25 de 76 · 33% de Ruck");
  // adentro de Otros, cada uno sobre Otros (15)
  assert.equal(nodos.find((n) => n.id === id("Ruck", "", "otros", "Juega desde el piso")).detalle, "6 de 15 · 40% de Otros (Ruck)");
  // lo que se ve sin tocar: ninguna caja de un motivo de Otros
  assert.ok(!visibles(nodos).some((n) => n.padre === id("Ruck", "", "otros")));
});

test("treemap: casos raros", () => {
  // un solo penal
  const uno = revisar([pen("Ruck", "Retener pelota", 1)]);
  assert.equal(uno[0].rotulo, "1 penal de UNI");
  // un "Otros" de un solo motivo no: se muestra ese motivo
  const cinco = revisar([5, 4, 3, 3, 2].map((n, i) => pen("Ruck", `M${i}`, n)));
  assert.ok(!cinco.some((n) => n.id.endsWith(SEP + "otros")));
  // muchos motivos de 1 penal: los de menos del 10%, en Otros
  const muchos = revisar([pen("Juego", "Grande", 30), ...Array.from({ length: 25 }, (_, i) => pen("Juego", `Chico ${i}`, 1))]);
  assert.equal(muchos.find((n) => n.id === id("Juego", "", "otros")).valor, 25);
  // seis motivos parejos (todos con más del 10%): se ven 4 y 2 en Otros
  const parejos = revisar(["A", "B", "C", "D", "E", "F"].map((m) => pen("Ruck", m, 10)));
  assert.equal(parejos.filter((n) => n.padre === id("Ruck")).length, 5);
  assert.equal(parejos.find((n) => n.id === id("Ruck", "", "otros")).valor, 20);
  // una situación grande sin ningún motivo que se destaque: una sola caja
  const parejitos = revisar(Array.from({ length: 11 }, (_, i) => pen("Ruck", `M${i}`, 1)));
  assert.deepEqual(parejitos.filter((n) => n.padre === id("Ruck")).map((n) => n.rotulo), ["11 motivos ›"]);
  // un "/" en un texto cargado a mano no confunde las cajas
  revisar([pen("Juego/Ruck", "X", 2), pen("Juego", "Ruck/X", 3), pen("Juego", "otros", 1)]);
  // el mismo motivo en dos situaciones: dos cajas distintas
  revisar([pen("Ruck", "Otro", 3), pen("Scrum", "Otro", 3)]);
  // una sola situación chica no va sola a "Otras"
  const unaChica = revisar([pen("Ruck", "A", 30), pen("Juego", "B", 30), pen("Line", "C", 1)]);
  assert.ok(!unaChica.some((n) => n.id === "otras"));
  // y con un solo motivo se muestra ése (no "1 motivos ›")
  assert.deepEqual(unaChica.filter((n) => n.padre === id("Line")).map((n) => n.rotulo), ["C"]);
  // lo que viene de la base, escapado (Plotly entiende algunas etiquetas)
  const raro = revisar([pen("Ruck", "Mano <b>5m & más", 3)]);
  assert.ok(raro.some((n) => n.rotulo === "Mano &lt;b&gt;5m<br>&amp; más"));
});

test("treemap: al azar, siempre cumple (2.000 casos)", () => {
  let semilla = 7;
  const azar = (n) => {
    semilla = (semilla * 1103515245 + 12345) % 2147483648;
    return semilla % n;
  };
  const sits = ["Ruck", "Juego", "Scrum", "Maul", "Line", "Otra"];
  for (let k = 0; k < 2000; k++) {
    const uni = [], vistos = new Set();
    for (let i = 0, n = 1 + azar(30); i < n; i++) {
      const s = sits[azar(sits.length)], m = `Motivo ${azar(12)}`;
      if (vistos.has(`${s}/${m}`)) continue;
      vistos.add(`${s}/${m}`);
      uni.push(pen(s, m, 1 + azar(azar(3) ? 4 : 40)));
    }
    revisar(uni);
    assert.ok(String(frasePenales(uni)).length > 0);
  }
});

test("la frase de arriba: dónde y el motivo que más se repite (empates, uno solo, sin opinar)", () => {
  const f = (uni) => String(frasePenales(uni));
  assert.equal(f([pen("Ruck", "Retener pelota", 25), pen("Juego", "Offside", 20), pen("Ruck", "Pesca", 3)]),
    "<b>Ruck</b> tiene 28 de los 48 penales de UNI. El motivo que más se repite: <b>Retener pelota</b> (en Ruck), 25 penales.");
  assert.equal(f([pen("Ruck", "A", 3), pen("Ruck", "B", 3)]),
    "Los 6 penales de UNI fueron en <b>Ruck</b>. Los motivos que más se repiten: <b>A</b> y <b>B</b>, 3 penales cada uno.");
  assert.equal(f([pen("Ruck", "A", 1)]), "El único penal de UNI fue en <b>Ruck</b>: <b>A</b>.");
  // dos situaciones empatadas arriba: las dos
  assert.equal(f([pen("Ruck", "A", 5), pen("Juego", "B", 4), pen("Juego", "C", 1)]),
    "<b>Ruck</b> y <b>Juego</b> tienen 5 de los 10 penales de UNI cada una. El motivo que más se repite: <b>A</b> (en Ruck), 5 penales.");
  // con 1 penal cada uno no se repite ningún motivo: sólo la primera parte
  assert.equal(f([pen("Ruck", "A", 1), pen("Juego", "B", 1)]), "<b>Ruck</b> y <b>Juego</b> tienen 1 de los 2 penales de UNI cada una.");
  // más de 3 empatados: sólo la primera parte
  assert.equal(f(["A", "B", "C", "D"].map((m) => pen("Ruck", m, 2))), "Los 8 penales de UNI fueron en <b>Ruck</b>.");
  // lo que viene de la base va escapado
  assert.ok(f([pen("Ruck", "<img src=x>", 2)]).includes("&lt;img src=x&gt;"));
});

test("cajas(): la figura de Plotly (en la compu, con el detalle al pasar el mouse)", () => {
  const nodos = arbolPenales([pen("Ruck", "A", 3)]);
  const fig = cajas(nodos, { alto: 480 });
  const d = fig.data[0];
  assert.equal(d.type, "treemap");
  assert.equal(d.branchvalues, "total");
  assert.deepEqual(d.ids, nodos.map((n) => n.id));
  assert.deepEqual(d.hovertext, nodos.map((n) => n.detalle));
  assert.ok(d.hovertemplate);
  assert.equal(d.maxdepth, 3);
  assert.equal(fig.layout.height, 480);
});

test("torneos: Copa de Oro y Copa Santa Fe, por la palabra en la categoría de Uni-Dat", () => {
  const es = (id, cat) => TORNEOS.find(([x]) => x === id)[2].test(cat);
  for (const c of ["Primera oro f4", "Primera f5 oro", "Primera oro", "PRIMERA ORO", "Primera-Oro", "Primera (Oro)", "Primera oro/F4"]) {
    assert.ok(es("oro", c), c);
  }
  for (const c of ["Primera", "Primera Orozco", "Tesoro", ""]) assert.ok(!es("oro", c), c);
  for (const c of ["PRIMERA CSF", "Primera CSF", "Primera csf f2", "Primera CSF,"]) assert.ok(es("csf", c), c);
  assert.ok(!es("csf", "Primera CSFX"));
  // con la base de la referencia: 2026 Primera
  const [unidat, manuales] = filasDe(leer("base", "cuentas.json"));
  const t = temporada(partidosBase(unidat, manuales), 2026, "Primera");
  assert.deepEqual(torneosDe(t), [["oro", "Copa de Oro"], ["csf", "Copa Santa Fe"]]);
  for (const [id] of TORNEOS) {
    const tt = torneo(t, id), ps = t.partidos.filter((p) => es(id, p.categoria ?? ""));
    assert.ok(ps.length > 0, id);
    assert.deepEqual(tt.partidos, ps);
    assert.equal(tt.n_partidos, ps.length);
    assert.deepEqual(tt.totales, sumar(ps));
  }
  // en la planilla 2025, ninguno; sin partidos de un torneo, ése no aparece
  assert.deepEqual(torneosDe({ ...t, planilla: true }), []);
  assert.deepEqual(torneosDe({ ...t, partidos: t.partidos.filter((p) => !/oro/iu.test(p.categoria ?? "")) }), [["csf", "Copa Santa Fe"]]);
});
