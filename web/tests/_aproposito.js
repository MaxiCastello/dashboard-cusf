// Cambios a propósito (fase 8, decisión del usuario): "Los de UNI: situación
// y motivo" es un treemap con una frase arriba, no la torta del Python. Para
// seguir comparando todo lo demás contra el Python, ese bloque (del título
// hasta la lista de motivos, o el final) queda como un solo marcador en los
// dos lados; lo nuevo tiene sus propias pruebas (penales.test.js). Lo mismo
// en dashboard-cusf.pruebas/_comun.py (a_proposito).
//
// En el informe PDF, lo mismo (28 oct): el bloque "cajas" y su nota no están
// en el del Python (informe_modelo.py); se sacan antes de comparar y se
// prueban aparte (pdf.test.js y _informe_cajas.js con revisar_pdf.py).
export const sinCajas = (bloques) => bloques.filter((b, i) => b.tipo !== "cajas" && bloques[i - 1]?.tipo !== "cajas");

export const TITULO_A_PROPOSITO ="### Los de UNI: situación y motivo";

export function aProposito(llamadas) {
  const out = [];
  let saltar = false;
  for (const x of llamadas) {
    if (x.f === "markdown" && x.cuerpo === TITULO_A_PROPOSITO) {
      out.push(x, { f: "a propósito: treemap" });
      saltar = true;
      continue;
    }
    // hasta la lista de motivos o, si no hay (UNI sin penales), el título siguiente
    if (saltar && x.f !== "expander" && !(x.f === "markdown" && x.cuerpo.startsWith("### "))) continue;
    saltar = false;
    out.push(x);
  }
  return out;
}
