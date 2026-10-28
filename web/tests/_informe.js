// Para pruebas/fuzz_informe.py: arma el informe PDF (informe.js, sin
// dibujarlo) de cada temporada y cada partido de cada base.
//
// Uso: node tests/_informe.js <entrada.json> <salida.json> [--pdf]
//   entrada: [{unidat, manuales, planilla}, ...]
//   salida:  por base: [{anio, categoria, partido, titulo, pie, archivo, bloques}]
//            o {error} si las cuentas cortaron (ErrorDatos)
//   --pdf: además lo dibuja con jsPDF (que no se caiga con nada) y anota
//          cuántas páginas salieron
import { readFileSync, writeFileSync } from "node:fs";
import process from "node:process";

import * as C from "../sitio/js/calculos.js";
import { informe } from "../sitio/js/informe.js";
import { armarPdf } from "../sitio/js/pdf.js";
import { PLANILLA_2025 } from "../sitio/js/planilla2025.js";
import { leerJson } from "../sitio/js/python.js";
import { sinCajas } from "./_aproposito.js";
import { jsPDF } from "./_informe_pdf.js";

function todos(unidat, manuales, planilla, pdf) {
  const partidos = C.partidosBase(unidat, manuales);
  const out = [];
  for (const anio of C.aniosDisponibles(partidos)) {
    const grupos = anio === C.ANIO_PLANILLA
      ? (planilla ? [[null, PLANILLA_2025]] : [])
      : C.categoriasDe(partidos, anio).map((cat) => [cat, C.temporada(partidos, anio, cat)]);
    for (const [categoria, t] of grupos) {
      for (const p of [null, ...t.partidos]) {
        const inf = informe(t, categoria, p);
        const x = { anio, categoria, partido: p ? p.id : null, ...inf, bloques: sinCajas(inf.bloques) };
        if (pdf) x.paginas = armarPdf(jsPDF, inf.bloques, { titulo: inf.titulo, pie: inf.pie, generado: "Generado hoy" }).getNumberOfPages();
        out.push(x);
      }
    }
  }
  return JSON.parse(JSON.stringify(out));
}

const [entrada, salida] = process.argv.slice(2);
const pdf = process.argv.includes("--pdf");
const casos = leerJson(readFileSync(entrada, "utf8"));
writeFileSync(salida, JSON.stringify(casos.map(({ unidat, manuales, planilla }) => {
  try {
    return todos(unidat, manuales, planilla, pdf);
  } catch (e) {
    return { error: e instanceof C.ErrorDatos ? "ErrorDatos" : `${e.name}: ${e.message}` };
  }
})));
