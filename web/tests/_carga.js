// Para pruebas/fuzz_carga.py: corre lo de carga.js con los casos que arma
// el Python y guarda lo que da. Uso: node tests/_carga.js entrada.json salida.json
import { readFileSync, writeFileSync } from "node:fs";
import process from "node:process";

import { desdeManual, leerJson, partidosBase } from "../sitio/js/calculos.js";
import { armarComplemento, armarPartido, registrosDelCsv, sueltos, valoresComplemento, valoresPartido } from "../sitio/js/carga.js";
import { fueraDelRepo } from "./_referencia.js";

const [entrada, salida] = process.argv.slice(2);
const casos = leerJson(readFileSync(entrada, "utf8"));
const bytes = (b64) => (b64 === null ? null : new Uint8Array(Buffer.from(b64, "base64")));
// los Map (plantel, tries_origen) no pasan a JSON: no se usan acá
const plano = (x) => JSON.parse(JSON.stringify(x, (k, v) => (v instanceof Map ? null : v)));

const out = casos.map((c) => {
  try {
    if (c.tipo === "csv") return { registros: registrosDelCsv(bytes(c.csv)) };
    if (c.tipo === "partido") {
      // la página arranca cada casilla con valoresPartido(); el caso cambia algunas
      const valores = valoresPartido(c.fila);
      return { valores, ...plano(armarPartido({ ...valores, ...c.valores }, c.fila, bytes(c.csv))) };
    }
    if (c.tipo === "complemento") {
      const ps = partidosBase(c.unidat, c.manuales).filter((p) => p.fuente === "unidat");
      // por_id de cargar.py: el más nuevo primero (el último con cada id, en el lugar del primero)
      const porId = new Map();
      for (const p of [...ps].reverse()) porId.set(p.id, p);
      const p = porId.get(c.sel);
      const valores = valoresComplemento(p);
      return { valores, ...plano(armarComplemento({ ...valores, ...c.valores }, p)), ids: [...porId.keys()] };
    }
    if (c.tipo === "sueltos") return { lista: sueltos(c.filas, desdeManual).map(([id, , et]) => [id, et]) };
    throw new Error(c.tipo);
  } catch (e) {
    return { error: e.constructor.name };
  }
});
writeFileSync(fueraDelRepo(salida), JSON.stringify(out));
