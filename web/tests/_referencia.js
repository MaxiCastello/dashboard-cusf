// Lee la referencia que exporta el Python (fase 0) y la copia de la base. Las
// dos viven FUERA del repo (en dashboard-cusf.pruebas/: tienen datos reales
// y el repo es público). Si faltan, las pruebas fallan con un aviso: nunca
// se saltean en silencio.
import { existsSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import process from "node:process";

export const PRUEBAS = resolve(import.meta.dirname, "../../../dashboard-cusf.pruebas");
export const REF = process.env.REFERENCIA ?? join(PRUEBAS, "referencia_2026-10-23");

function leerJson(f) {
  if (!existsSync(f)) {
    throw new Error(`Falta ${f}. Se arma con exportar_referencia.py (ver dashboard-cusf.MIGRACION.md).`);
  }
  return JSON.parse(readFileSync(f, "utf8"));
}

// leer("base", "cuentas.json")
export const leer = (...partes) => leerJson(join(REF, ...partes));

// Las filas de la base con las que se armó una referencia (`origen` de su cuentas.json).
export function filasDe(cuentas) {
  const carpeta = join(PRUEBAS, cuentas.origen);
  return [leerJson(join(carpeta, "partidos.json")), leerJson(join(carpeta, "partidos_manuales.json"))];
}

// Cada llamada a st.plotly_chart / st.markdown de todas las pantallas, con
// dónde estaba (para que un fallo diga qué pantalla mirar).
export function llamadas(sub) {
  const out = [];
  for (const pantalla of leer(sub, "pantallas.json")) {
    const donde = `${sub} ${pantalla.anio} ${pantalla.categoria ?? ""} ${pantalla.ver}`;
    pantalla.llamadas.forEach((l, i) => out.push({ ...l, donde: `${donde} #${i}` }));
  }
  return out;
}
