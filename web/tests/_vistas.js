// Para pruebas/fuzz_vistas.py: dibuja las pestañas ya pasadas de cada
// temporada de cada base (con Registro, sin página) y anota lo que dibujó.
//
// Uso: node tests/_vistas.js <entrada.json> <salida.json>
//   entrada: [{unidat, manuales}, ...]   (las mismas bases que arma el Python)
//   salida:  por base: [{anio, categoria, secciones: {nombre: [llamadas]}}]
//            o {error} si las cuentas cortaron (ErrorDatos)
import { readFileSync, writeFileSync } from "node:fs";
import process from "node:process";
import { pathToFileURL } from "node:url";

import * as C from "../sitio/js/calculos.js";
import { Registro } from "../sitio/js/lienzo.js";
import { PLANILLA_2025 } from "../sitio/js/planilla2025.js";
import { leerJson } from "../sitio/js/python.js";
import * as V from "../sitio/js/vistas.js";

// las pestañas de la temporada ya pasadas a la página
export const SECCIONES_TEMPORADA = { resumen: V.resumen, evolucion: V.evolucion, puntos: V.puntos, formaciones: V.formaciones, penales: V.penales, objetivos: V.objetivos };

export function dibujarTodo(unidat, manuales, planilla = false) {
  const out = [];
  // sólo las temporadas (no las etiquetas de cada partido, como fuzz_vistas.py)
  const partidos = C.partidosBase(unidat, manuales);
  const temporadas = [];
  for (const anio of C.aniosDisponibles(partidos)) {
    if (anio === C.ANIO_PLANILLA) {
      if (planilla) temporadas.push({ anio, categoria: null, t: PLANILLA_2025 });
      continue;
    }
    for (const cat of C.categoriasDe(partidos, anio)) temporadas.push({ anio, categoria: cat, t: C.temporada(partidos, anio, cat) });
  }
  for (const { anio, categoria, t } of temporadas) {
    const secciones = {};
    for (const [nombre, f] of Object.entries(SECCIONES_TEMPORADA)) {
      const lz = new Registro();
      f(lz, t);
      secciones[nombre] = lz.llamadas;
    }
    out.push({ anio, categoria, secciones });
  }
  return JSON.parse(JSON.stringify(out));
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const [entrada, salida] = process.argv.slice(2);
  const casos = leerJson(readFileSync(entrada, "utf8"));
  const out = casos.map(({ unidat, manuales, planilla }) => {
    try {
      return dibujarTodo(unidat, manuales, planilla);
    } catch (e) {
      return { error: e instanceof C.ErrorDatos ? "ErrorDatos" : `${e.name}: ${e.message}` };
    }
  });
  writeFileSync(salida, JSON.stringify(out));
}
