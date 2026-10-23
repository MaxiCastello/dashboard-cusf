// FASE 1 (prueba de concepto): la temporada que se ve al entrar (el año más
// nuevo y su primera categoría, como en dashboard.py), con tres piezas
// reales de la pestaña Resumen ("Resultados", "Partido a partido" y el
// anillo del line), leídas de la base. Sirve para probar la CSP, las
// fuentes, Plotly y la velocidad antes de pasar el resto (fase 3 en
// adelante).
import { ANIO_PLANILLA, aniosDisponibles, categoriasDe, etiqueta, partidosBase, resultado, temporada } from "./calculos.js";
import { filasManuales, filasUnidat } from "./fuente.js";
import { dibujar, dona, pesas } from "./graficos.js";
import { anillos, html, poner } from "./piezas.js";
import { MAL, NEUTRO, UNI } from "./tema.js";

const $ = (id) => document.getElementById(id);

function encabezado(sub) {
  poner($("enc"), html`<img src="img/escudo.png" alt=""><div><div class="t">Universitario Rugby</div><div class="s">${sub}</div></div>`);
}

async function arrancar() {
  const [unidat, [manuales]] = await Promise.all([filasUnidat(), filasManuales()]);
  const partidos = partidosBase(unidat, manuales);
  const anio = aniosDisponibles(partidos)[0];
  if (anio === ANIO_PLANILLA) throw new Error("La temporada 2025 (planilla) se pasa en la fase 2.");
  const cat = categoriasDe(partidos, anio)[0];
  const t = temporada(partidos, anio, cat);
  encabezado(`Temporada ${anio} · ${cat}`);

  const ps = t.partidos;
  // como vistas.resumen(): con un solo partido no hay torta ni "partido a partido"
  $("columnas").hidden = ps.length <= 1;
  if (ps.length > 1) {
    const r = ps.map(resultado);
    const cuenta = (x) => r.filter((v) => v === x).length;
    const [g, e, p] = [cuenta("G"), cuenta("E"), cuenta("P")];
    await dibujar($("g-resultados"), dona(["Ganados", "Empatados", "Perdidos"], [g, e, p], [UNI, NEUTRO, MAL],
      `${g}-${e}-${p}`, "ganó-empató-perdió"));
    await dibujar($("g-partidos"), pesas(ps.map((x) => etiqueta(x, true)), ps.map((x) => x.score_uni),
      ps.map((x) => x.score_rival), { tituloX: "Puntos", textos: ps.map((x) => `   ${x.score_uni}–${x.score_rival}`) }));
  }
  const line = t.totales.line;
  poner($("anillos"), anillos([["Line propio ganado", line.uGan, line.uLan, UNI, null]]));
  $("cargando").hidden = true;
  document.body.dataset.listo = "1";   // para las pruebas: ya está todo dibujado
}

arrancar().catch((err) => {
  $("cargando").textContent = err.message;
  document.body.dataset.listo = "error";
  console.error(err);
});
