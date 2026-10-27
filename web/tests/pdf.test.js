// El dibujo del informe (pdf.js): las letras que la fuente no tiene, y que
// cada informe de la referencia se dibuje (lo que dice cada página lo mira
// pruebas/revisar_pdf.py; que sea lo del Python, tests/informe.test.js).
import assert from "node:assert/strict";
import { test } from "node:test";

import { nombreArchivo } from "../sitio/js/informe.js";
import { armarPdf, seguro } from "../sitio/js/pdf.js";
import { jsPDF, pdfs } from "./_informe_pdf.js";

test("seguro(): lo que la letra tiene queda; lo que no, sin tilde o ?", () => {
  assert.equal(seguro("Ñandú Peñaloza · 27–20 — 4 de 6 · 67% °", "DMSans"), "Ñandú Peñaloza · 27–20 — 4 de 6 · 67% °");
  assert.equal(seguro("Pepe 🏉", "DMSans"), "Pepe ?");
  assert.equal(seguro("日本", "DMSans"), "??");
  assert.equal(seguro("Łukasz Świątek", "DMSans"), "Łukasz Świątek");   // latín extendido: las dos partes juntas
  for (const ch of ["ǅ", "ẞ", "ɤ", "🏉"]) assert.equal([...seguro(ch, "Bebas")].length, 1, ch);   // nunca queda en blanco
  assert.equal(seguro("a\nb", "DMSans"), "a\nb");
});

test("nombreArchivo(): el título con _, sin · ni espacios ni signos", () => {
  assert.equal(nombreArchivo(["Temporada", 2026, "Primera"]), "Informe_Temporada_2026_Primera.pdf");
  assert.equal(nombreArchivo(["2026-10-17", "UNI 27-20 CARANCHOS"]), "Informe_2026-10-17_UNI_27-20_CARANCHOS.pdf");
  assert.equal(nombreArchivo([2025, "Fecha 12", "<b>Ñandú</b> & \"x\""]), "Informe_2025_Fecha_12_b_Ñandú_b_x.pdf");
});

for (const sub of ["base", "demo"]) {
  test(`cada informe de la referencia se dibuja (${sub})`, () => {
    for (const x of pdfs(sub)) {
      const doc = armarPdf(jsPDF, x.bloques, { titulo: x.titulo, pie: x.pie, generado: "Generado hoy" });
      const n = doc.getNumberOfPages();
      assert.ok(n >= 1 && n <= 8, `${x.titulo}: ${n} páginas`);
    }
  });
}

test("el mismo informe sale igual dos veces (sin contar la fecha de creación)", () => {
  const x = pdfs("base")[0];
  const uno = () => armarPdf(jsPDF, x.bloques, { titulo: x.titulo, pie: x.pie, generado: "Generado hoy" })
    .setCreationDate("D:20261027000000+00'00'").setFileId("0".repeat(32)).output();
  assert.equal(uno(), uno());
});
