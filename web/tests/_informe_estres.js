// Informes PDF con datos al límite, para revisar que el dibujo aguante
// (pruebas/revisar_pdf.py): nombres muy largos, letras que la fuente no
// tiene (emoji, alfabetos raros), HTML, muchos partidos, muchos jugadores.
// Parte de la copia de la base de la referencia.
//
// Uso: node tests/_informe_estres.js <carpeta_salida>
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import process from "node:process";

import * as C from "../sitio/js/calculos.js";
import { informe } from "../sitio/js/informe.js";
import { armarPdf } from "../sitio/js/pdf.js";
import { filasDe, fueraDelRepo, leer } from "./_referencia.js";
import { jsPDF } from "./_informe_pdf.js";

const RIVALES = ["CLUB ATLÉTICO ESTUDIANTES DE PARANÁ RUGBY & HOCKEY", "<b>Rival</b> \"raro\" & cía", "Ñandú 🏉 Ωmega 日本",
  "SANTAFESINOSUPERLARGONOMBREDEUNCLUBSINESPACIOS"];
const JUGADORES = ["Juan Ignacio Fernández de la Fuente Rodríguez Peñaloza", "Pepe 🏉 Argüello", "<script>alert(1)</script>",
  "Łukasz Świątek", "Ελληνικό Όνομα", "José \"el Tano\" & Cía"];

const [unidat, manuales] = filasDe(leer("base", "cuentas.json"));
const base = C.partidosBase(unidat, manuales).filter((p) => p.fecha?.startsWith("2026"));
// 3 vueltas de la temporada (39 partidos), con nombres al límite
const muchos = [0, 1, 2].flatMap((v) => base.map((p, i) => {
  const q = structuredClone(p);
  q.id = `${p.id}-${v}`;
  q.fecha = `2026-${String(1 + v * 4 + (i % 4)).padStart(2, "0")}-${String(1 + i).padStart(2, "0")}`;
  if (i % 3 === 0) q.rival = RIVALES[(i + v) % RIVALES.length];
  q.tackles = q.tackles.map((f, k) => ({ ...f, nombre: k % 5 === 0 ? `${JUGADORES[(k + v) % JUGADORES.length]} ${v}${k}` : f.nombre }));
  if (q.penales.length) q.penales[0] = { ...q.penales[0], motivo: "Motivo larguísimo de un penal que no entra en la columna de la tabla" };
  return q;
}));
const casos = [];
for (const cat of C.categoriasDe(muchos, 2026)) {
  const t = C.temporada(muchos, 2026, cat);
  casos.push(informe(t, `${cat} con un nombre de categoría muy largo`));
  for (const p of t.partidos.filter((_, i) => i % 6 === 0)) casos.push(informe(t, cat, p));
}

const salida = fueraDelRepo(process.argv[2]);
mkdirSync(salida, { recursive: true });
writeFileSync(join(salida, "indice.json"), JSON.stringify(casos.map((x, i) => {
  const doc = armarPdf(jsPDF, x.bloques, { titulo: x.titulo, pie: x.pie, generado: "Generado el 27/10/2026 desde el tablero del club" });
  const archivo = `${String(i).padStart(3, "0")}.pdf`;
  writeFileSync(join(salida, archivo), Buffer.from(doc.output("arraybuffer")));
  return { archivo, titulo: x.titulo, bloques: x.bloques };
}), null, 1));
console.log(`${casos.length} PDF al límite en ${salida}`);
