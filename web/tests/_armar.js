// Arma, con las cuentas de la página, lo mismo que guarda el Python en la
// referencia (exportar_referencia.py, "1. Las cuentas"): los partidos, los
// años, cada temporada y, de cada partido, una(), sus tackles y objetivos.
// Lo usan tests/calculos.test.js (contra la referencia) y
// pruebas/fuzz_cuentas.py (contra el Python, con partidos al azar).
//
// Uso desde la consola: node tests/_armar.js <entrada.json> <salida.json>
//   entrada: [{unidat: [...], manuales: [...], planilla: true|false}, ...]
//   salida:  [cuentas en forma canónica, o {error: "..."}], en el mismo orden
import { readFileSync, writeFileSync } from "node:fs";
import process from "node:process";
import { pathToFileURL } from "node:url";

import * as C from "../sitio/js/calculos.js";
import * as O from "../sitio/js/objetivos.js";
import { PLANILLA_2025 } from "../sitio/js/planilla2025.js";
import { entradas, leerJson, str } from "../sitio/js/python.js";

function detalle(t) {
  const ps = t.partidos;
  const tk = C.tacklesTemporada(ps).map((j) => ({ ...j, _pj_texto: C.pjTexto(j) }));
  return {
    tackles_temporada: tk,
    objetivos_temporada: O.OBJETIVOS.map((ob) => O.temporada(ob, ps)),
    partidos: ps.map((p) => ({
      id: p.id, etiqueta: C.etiqueta(p), etiqueta_corta: C.etiqueta(p, true),
      resultado: t.planilla ? null : C.resultado(p),
      una: C.una(p, t),
      tackles: C.tacklesTemporada([p]),
      objetivos: t.planilla ? null : O.OBJETIVOS.map((ob) => O.evaluar(ob, p)),
    })),
  };
}

// cuentas.json de la referencia, sin "origen" (de qué copia salió).
export function armar(unidat, manuales, { hayTabla = true, planilla = true } = {}) {
  const partidos = C.partidosBase(unidat, manuales);
  const anios = C.aniosDisponibles(partidos);
  const temporadas = [];
  for (const anio of anios) {
    if (anio === C.ANIO_PLANILLA) {
      if (planilla) temporadas.push({ anio, categoria: null, t: PLANILLA_2025, ...detalle(PLANILLA_2025) });
      continue;
    }
    for (const cat of C.categoriasDe(partidos, anio)) {
      const t = C.temporada(partidos, anio, cat);
      temporadas.push({ anio, categoria: cat, t, ...detalle(t) });
    }
  }
  return {
    hay_tabla_manuales: hayTabla, anios, partidos,
    // Map: un id que parece número no tiene que pasar adelante (como en el dict de Python)
    categorias: new Map(partidos.map((p) => [str(p.id), C.categoriaBase(p.categoria)])),
    temporadas,
  };
}

// Forma canónica, para comparar con el Python sin que JS ni JSON cambien
// nada en el camino: un diccionario es ["D", [[clave, valor], ...]] EN SU
// ORDEN (el orden también se compara: decide qué se ve primero), una lista
// ["L", ...], True/False ["B", x]. Un undefined es ["U"]: en Python no
// existe, así que si aparece es un error de la página.
export function canon(x) {
  if (x === undefined) return ["U"];
  if (x === null || typeof x === "string" || typeof x === "number") return x;
  if (typeof x === "boolean") return ["B", x];
  if (Array.isArray(x)) return ["L", ...x.map(canon)];
  if (x instanceof Map) return ["D", [...x].map(([k, v]) => [k, canon(v)])];
  return ["D", entradas(x).map(([k, v]) => [k, canon(v)])];
}

// Un JSON (la referencia) en forma canónica, con sus claves en el orden en
// que están escritas.
export const canonDeJson = (texto) => canon(leerJson(texto));

// La primera diferencia entre dos formas canónicas, con dónde está.
export function diferencia(a, b, donde = "") {
  if (Array.isArray(a) && Array.isArray(b) && a[0] === b[0] && ["D", "L"].includes(a[0])) {
    if (a[0] === "D") {
      const ka = a[1].map(([k]) => k), kb = b[1].map(([k]) => k);
      if (ka.join("\u0000") !== kb.join("\u0000")) return `${donde}: claves ${JSON.stringify(ka)} != ${JSON.stringify(kb)}`;
      for (let i = 0; i < ka.length; i++) {
        const dif = diferencia(a[1][i][1], b[1][i][1], `${donde}.${ka[i]}`);
        if (dif) return dif;
      }
      return null;
    }
    if (a.length !== b.length) return `${donde}: ${a.length - 1} elementos != ${b.length - 1}`;
    for (let i = 1; i < a.length; i++) {
      const dif = diferencia(a[i], b[i], `${donde}[${i - 1}]`);
      if (dif) return dif;
    }
    return null;
  }
  return JSON.stringify(a) === JSON.stringify(b) ? null : `${donde}: ${JSON.stringify(a)} != ${JSON.stringify(b)}`;
}

// ¿se corrió este archivo desde la consola? (import.meta.main recién existe en Node 22.18)
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const [entrada, salida] = process.argv.slice(2);
  // leerJson y no JSON.parse: como la página, sin perder el orden de las claves
  const casos = leerJson(readFileSync(entrada, "utf8"));
  const out = casos.map(({ unidat, manuales, planilla }) => {
    try {
      return canon(armar(unidat, manuales, { planilla }));
    } catch (e) {
      // ErrorDatos: la página corta a propósito; cualquier otro error es un
      // camino que no se previó (también se informa)
      return { error: e instanceof C.ErrorDatos ? "ErrorDatos" : `${e.name}: ${e.message}` };
    }
  });
  writeFileSync(salida, JSON.stringify(out));
}
