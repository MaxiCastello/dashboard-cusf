// Cada pestaña de la página contra la misma pestaña del Python: lo que
// dibuja (títulos, HTML, gráficos con su JSON, columnas...), operación por
// operación y en el mismo orden, en cada temporada y cada partido de la
// referencia (pruebas/exportar_secciones.py: secciones.json).
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";

import * as C from "../sitio/js/calculos.js";
import { Registro } from "../sitio/js/lienzo.js";
import { armar } from "./_armar.js";
import { SECCIONES_TEMPORADA, dibujarPartido } from "./_vistas.js";
import { PRUEBAS, filasDe, leer } from "./_referencia.js";

// La temporada de cada pantalla, armada con las cuentas de la página.
function temporadas(sub) {
  const cuentas = leer(sub, "cuentas.json");
  const [unidat, manuales] = cuentas.origen === "demo"
    ? [C.leerJson(readFileSync(join(PRUEBAS, "demo_partidos.json"), "utf8")), []]
    : filasDe(cuentas);
  return armar(unidat, manuales).temporadas;
}

// Lo que se anota pasa por JSON (como la referencia): sin undefined.
const comoJson = (x) => JSON.parse(JSON.stringify(x));


for (const sub of ["base", "demo"]) {
  const ts = temporadas(sub);
  const secciones = leer(sub, "secciones.json");
  for (const [nombre, f] of Object.entries(SECCIONES_TEMPORADA)) {
    test(`${nombre}: igual al Python en cada temporada (${sub})`, () => {
      const casos = secciones.filter((s) => s.ver === "temporada");
      assert.ok(casos.length >= 2, "pocas temporadas en la referencia");
      for (const s of casos) {
        const t = ts.find((x) => x.anio === s.anio && x.categoria === s.categoria).t;
        const lz = new Registro();
        f(lz, t);
        const esperado = s.secciones[nombre];
        const hecho = comoJson(lz.llamadas);
        const donde = `${sub} ${s.anio} ${s.categoria ?? ""}`;
        assert.equal(hecho.length, esperado.length, `${donde}: ${hecho.length} cosas dibujadas y el Python ${esperado.length}`);
        hecho.forEach((h, i) => assert.deepEqual(h, esperado[i], `${donde}, ${nombre} #${i}`));
      }
    });
  }

  // Cada partido (con el marcador de arriba): las mismas secciones que el
  // Python, en el mismo orden, y cada una igual.
  test(`cada partido: igual al Python (${sub})`, () => {
    const casos = secciones.filter((s) => s.ver !== "temporada");
    assert.ok(casos.length >= 5, "pocos partidos en la referencia");
    for (const s of casos) {
      const temp = ts.find((x) => x.anio === s.anio && x.categoria === s.categoria);
      assert.ok(temp, `${sub} ${s.anio} ${s.categoria ?? ""}: la página no arma esta temporada`);
      const t = temp.t;
      const p = t.partidos.findLast((x) => x.id === s.ver);   // por_id: el último con ese id
      assert.ok(p, `${sub} ${s.anio} ${s.categoria ?? ""}: la página no tiene el partido ${s.ver}`);
      const hechas = comoJson(dibujarPartido(t, p));
      const donde = `${sub} ${s.anio} ${s.categoria ?? ""} ${p.rival}`;
      assert.deepEqual(Object.keys(hechas), Object.keys(s.secciones), `${donde}: otras secciones`);
      for (const [nombre, esperado] of Object.entries(s.secciones)) {
        const hecho = hechas[nombre];
        assert.equal(hecho.length, esperado.length, `${donde} ${nombre}: ${hecho.length} cosas dibujadas y el Python ${esperado.length}`);
        hecho.forEach((h, i) => assert.deepEqual(h, esperado[i], `${donde}, ${nombre} #${i}`));
      }
    }
  });
}
