// Para pruebas/fuzz_vistas.py: dibuja las pestañas ya pasadas de cada
// temporada y de cada uno de sus partidos, en cada base (con Registro, sin
// página), y anota lo que dibujó.
//
// Uso: node tests/_vistas.js <entrada.json> <salida.json>
//   entrada: [{unidat, manuales}, ...]   (las mismas bases que arma el Python)
//   salida:  por base: [{anio, categoria, secciones: {nombre: [llamadas]},
//                        partidos: [{id, secciones: {nombre: [llamadas]}}]}]
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
export const SECCIONES_TEMPORADA = { resumen: V.resumen, evolucion: V.evolucion, puntos: V.puntos, formaciones: V.formaciones, penales: V.penales, tackles: V.tackles, objetivos: V.objetivos };

const correr = (f, ...a) => {
  const lz = new Registro();
  f(lz, ...a);
  return lz.llamadas;
};

// Las secciones de un partido, como las dibuja dashboard.py (y las anota
// exportar_secciones.py): el marcador va antes de las pestañas; uno de la
// planilla 2025 tiene sólo sus tackles.
export function dibujarPartido(t, p) {
  if (t.planilla) return { marcador: correr(V.marcador, p), tackles: correr(V.tackles, t, p) };
  const tp = C.una(p, t);
  // las pestañas de V.SECCIONES_PARTIDO: la misma lista que usa la página
  return { marcador: correr(V.marcador, p), ...Object.fromEntries(V.SECCIONES_PARTIDO.map(([nombre, , f]) => [nombre, correr(f, p, t, tp)])) };
}

export function dibujarTodo(unidat, manuales, planilla = false) {
  const out = [];
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
    const secciones = Object.fromEntries(Object.entries(SECCIONES_TEMPORADA).map(([nombre, f]) => [nombre, correr(f, t)]));
    out.push({ anio, categoria, secciones, partidos: t.partidos.map((p) => ({ id: p.id, secciones: dibujarPartido(t, p) })) });
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
