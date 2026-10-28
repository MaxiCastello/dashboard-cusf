// Las cajas de los penales de UNI (el treemap del PDF) con penales al límite
// y al azar, para revisar que el dibujo aguante (pruebas/revisar_pdf.py):
// nada se sale, nada se encima, ningún texto cortado con "…".
//
// Uso: node tests/_informe_cajas.js <carpeta_salida> [cuántos al azar]
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import process from "node:process";

import { cajasPenales } from "../sitio/js/informe.js";
import { armarPdf } from "../sitio/js/pdf.js";
import { jsPDF } from "./_informe_pdf.js";
import { fueraDelRepo } from "./_referencia.js";

const pen = (situacion, motivo, uni) => ({ situacion, motivo, uni, rival: 0 });
const SITS = ["Ruck", "Juego", "Scrum", "Maul", "Line", "Salida", "Ñandú 🏉 Ωmega", "<b>Raro</b> & cía",
  "Una situación con un nombre larguísimo que no entra"];
const MOTIVOS = ["Retener pelota", "Def. en offside", "Estorbar el juego", "Pesca indebida", "Tackle alto", "Otro", "Sin detalle",
  "Motivo larguísimo de un penal que no entra en ninguna caja chica", "SANTAFESINOSUPERLARGOMOTIVOSINESPACIOS", "日本 🏉", "Ñ",
  "<script>alert(1)</script>"];

const casos = [
  [pen("Ruck", "Retener pelota", 1)],
  MOTIVOS.map((m, i) => pen("Ruck", m, 12 - i)),
  SITS.map((s) => pen(s, "Otro", 1)),
  [pen("Ruck", "Retener pelota", 500), ...SITS.slice(1).map((s, i) => pen(s, MOTIVOS[i], 1))],
  SITS.flatMap((s, i) => MOTIVOS.map((m, k) => pen(s, m, 1 + ((i * 7 + k * 3) % 9)))),
  [pen(SITS[8], MOTIVOS[7], 3), pen(SITS[8], MOTIVOS[8], 2)],
];
let semilla = 11;
const azar = (n) => {
  semilla = (semilla * 1103515245 + 12345) % 2147483648;
  return semilla % n;
};
for (let k = 0, n = Number(process.argv[3] ?? 300); k < n; k++) {
  const uni = [], vistos = new Set();
  for (let i = 0, cuantos = 1 + azar(azar(2) ? 12 : 40); i < cuantos; i++) {
    const s = SITS[azar(azar(3) ? 5 : SITS.length)], m = MOTIVOS[azar(azar(3) ? 7 : MOTIVOS.length)];
    if (vistos.has(`${s}/${m}`)) continue;
    vistos.add(`${s}/${m}`);
    uni.push(pen(s, m, 1 + azar(azar(3) ? 6 : 60)));
  }
  casos.push(uni);
}

const salida = fueraDelRepo(process.argv[2]);
mkdirSync(salida, { recursive: true });
writeFileSync(join(salida, "indice.json"), JSON.stringify(casos.map((uni, i) => {
  const bloques = [{ tipo: "seccion", titulo: "Penales" }, cajasPenales(uni), { tipo: "nota", texto: "Nota de abajo." }];
  const doc = armarPdf(jsPDF, bloques, { titulo: `Caso ${i}`, pie: `Caso ${i}`, generado: "Generado hoy" });
  const archivo = `${String(i).padStart(3, "0")}.pdf`;
  writeFileSync(join(salida, archivo), Buffer.from(doc.output("arraybuffer")));
  return { archivo, titulo: `Caso ${i}`, bloques };
}), null, 1));
console.log(`${casos.length} PDF con cajas en ${salida}`);
