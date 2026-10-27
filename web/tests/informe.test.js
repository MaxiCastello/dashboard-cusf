// El informe PDF (informe.js) contra el que arma el Python con las mismas
// cuentas (pruebas/informe_modelo.py, exportado a informes.json): cada
// bloque, en cada temporada y cada partido de la referencia.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";

import * as C from "../sitio/js/calculos.js";
import { informe } from "../sitio/js/informe.js";
import { armar } from "./_armar.js";
import { PRUEBAS, filasDe, leer } from "./_referencia.js";

const comoJson = (x) => JSON.parse(JSON.stringify(x));

for (const sub of ["base", "demo"]) {
  test(`informe: igual al Python en cada temporada y cada partido (${sub})`, () => {
    const cuentas = leer(sub, "cuentas.json");
    const [unidat, manuales] = cuentas.origen === "demo"
      ? [C.leerJson(readFileSync(join(PRUEBAS, "demo_partidos.json"), "utf8")), []]
      : filasDe(cuentas);
    const ts = armar(unidat, manuales).temporadas;
    const esperados = leer(sub, "informes.json");
    assert.ok(esperados.filter((x) => x.partido).length >= 5, "pocos partidos en la referencia");
    for (const e of esperados) {
      const temp = ts.find((x) => x.anio === e.anio && x.categoria === e.categoria);
      assert.ok(temp, `${sub} ${e.anio} ${e.categoria ?? ""}: la página no arma esta temporada`);
      const p = e.partido === null ? null : temp.t.partidos.findLast((x) => x.id === e.partido);
      assert.ok(e.partido === null || p, `${sub} ${e.anio}: la página no tiene el partido ${e.partido}`);
      const hecho = comoJson(informe(temp.t, temp.categoria, p));
      const donde = `${sub} ${e.titulo}`;
      for (const k of ["titulo", "pie", "archivo"]) assert.equal(hecho[k], e[k], `${donde}: ${k}`);
      assert.equal(hecho.bloques.length, e.bloques.length, `${donde}: ${hecho.bloques.length} bloques y el Python ${e.bloques.length}`);
      hecho.bloques.forEach((b, i) => assert.deepEqual(b, e.bloques[i], `${donde}, bloque ${i} (${e.bloques[i].tipo})`));
    }
  });
}
