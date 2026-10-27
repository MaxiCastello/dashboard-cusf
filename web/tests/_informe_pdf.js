// Arma los PDF del informe con jsPDF en Node (sin navegador), para revisarlos
// como imagen y medir que nada se salga (pruebas/revisar_pdf.py).
//
// Uso: node tests/_informe_pdf.js <carpeta_salida> [base|demo]
//   guarda un PDF por temporada y por partido de la referencia, y indice.json
//   con {archivo, titulo, bloques} de cada uno.
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import process from "node:process";
import { pathToFileURL } from "node:url";
import { runInThisContext } from "node:vm";

import * as C from "../sitio/js/calculos.js";
import { informe } from "../sitio/js/informe.js";
import { armarPdf } from "../sitio/js/pdf.js";
import { armar } from "./_armar.js";
import { PRUEBAS, filasDe, fueraDelRepo, leer } from "./_referencia.js";

// jsPDF viene armado para <script> o para require (UMD); web/ es de módulos
// ES, así que se lo corre con un `module` propio
export const { jsPDF } = (() => {
  const m = { exports: {} };
  const codigo = readFileSync(new URL("../sitio/vendor/jspdf-4.2.1.umd.min.js", import.meta.url), "utf8");
  runInThisContext(`(function (module, exports) {${codigo}
})`)(m, m.exports);
  return m.exports;
})();

export function pdfs(sub) {
  const cuentas = leer(sub, "cuentas.json");
  const [unidat, manuales] = cuentas.origen === "demo"
    ? [C.leerJson(readFileSync(join(PRUEBAS, "demo_partidos.json"), "utf8")), []]
    : filasDe(cuentas);
  const out = [];
  for (const { anio, categoria, t } of armar(unidat, manuales).temporadas) {
    out.push({ anio, categoria, partido: null, ...informe(t, categoria) });
    for (const p of t.partidos) out.push({ anio, categoria, partido: p.id, ...informe(t, categoria, p) });
  }
  return out;
}

const [salida, sub = "base"] = process.argv.slice(2);
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  fueraDelRepo(salida);
  mkdirSync(salida, { recursive: true });
  const indice = pdfs(sub).map((x, i) => {
    const doc = armarPdf(jsPDF, x.bloques, { titulo: x.titulo, pie: x.pie, generado: "Generado el 27/10/2026 desde el tablero del club" });
    const archivo = `${String(i).padStart(3, "0")}.pdf`;
    writeFileSync(join(salida, archivo), Buffer.from(doc.output("arraybuffer")));
    return { archivo, nombre: x.archivo, titulo: x.titulo, anio: x.anio, categoria: x.categoria, partido: x.partido, bloques: x.bloques };
  });
  writeFileSync(join(salida, "indice.json"), JSON.stringify(indice, null, 1));
  console.log(`${indice.length} PDF en ${salida}`);
}
