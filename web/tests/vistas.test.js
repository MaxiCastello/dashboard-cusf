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
import * as V from "../sitio/js/vistas.js";
import { armar } from "./_armar.js";
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

// Las secciones de la temporada ya pasadas (se suman a medida que se pasan).
const SECCIONES_TEMPORADA = { resumen: V.resumen, evolucion: V.evolucion };

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
}
