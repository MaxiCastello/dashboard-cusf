// Los tipos de gráfico del tablero (cusf/graficos.py). Cada función arma la
// figura igual que el Python (las pruebas comparan contra su JSON) y la
// devuelve; dibujar() la pone en la página.
//
// Los textos que llegan acá (rival, jugador, motivo) ya pasaron por
// texto(): sin < > (plotly interpreta algunas etiquetas HTML).
import { APAGADO, BORDE, RIVAL, SUP2, TEMA, TEXTO, UNI } from "./tema.js";

const BEBAS = "Bebas Neue, Arial Narrow, sans-serif";
// la config de grafico() de estilo.py (sin barra de botones, sin zoom con la rueda)
export const CONFIG = { displayModeBar: false, scrollZoom: false };

// grafico() de estilo.py: el alto y el fondo transparente.
function grafico(fig, alto = 320) {
  Object.assign(fig.layout, { height: alto, paper_bgcolor: "rgba(0,0,0,0)", plot_bgcolor: "rgba(0,0,0,0)" });
  return fig;
}

// La figura que se le dio a cada elemento, tal cual (Plotly escribe en lo
// que recibe los rangos y colores que calcula: comparar eso con el Python no
// sirve). Las pruebas de pantalla leen esto para comparar con el JSON del
// Python.
export const dibujadas = new WeakMap();

// Lo que Streamlit le agrega a cada figura al dibujarla (st.plotly_chart con
// theme=None, medido en las fases 3 y 4):
// - la letra y el color de sus textos: por eso los gráficos del tablero salen
//   en Source Sans y no en la DM Sans del tema (la misma letra que --st de
//   tablero.css);
// - el ancho exacto del lugar (824,05px, no 824): si Plotly lo calcula solo
//   lo redondea y el gráfico sale corrido medio píxel. Si el lugar cambia de
//   ancho (se gira el celular), se vuelve a poner.
export const FUENTE_STREAMLIT = { color: TEXTO, family: '"Source Sans", sans-serif, "Source Sans", sans-serif' };

// (0 = todavía no tiene lugar: entonces Plotly lo calcula solo)
const ancho = (el) => {
  const w = el.getBoundingClientRect?.().width;
  return w > 0 ? w : null;
};

// Uno solo para todos los gráficos; uno que ya no está en la página deja de mirarse.
let mirar = null;
function seguirAncho(el) {
  mirar ??= new ResizeObserver((cambios) => {
    for (const { target } of cambios) {
      if (!target.isConnected) mirar.unobserve(target);
      else if (ancho(target) && ancho(target) !== target._fullLayout?.width) window.Plotly.relayout(target, { width: ancho(target) });
    }
  });
  mirar.observe(el);
}

// Plotly guarda y cambia lo que recibe: le llega una copia, así la figura
// sigue siendo la que se comparó en las pruebas.
export function dibujar(el, fig) {
  dibujadas.set(el, fig);
  const { data, layout } = structuredClone(fig);
  const w = ancho(el);
  const hecho = window.Plotly.newPlot(el, data, {
    ...layout, ...(w ? { width: w } : {}), font: { ...FUENTE_STREAMLIT, ...layout.font }, template: structuredClone(TEMA),
  }, { ...CONFIG });
  if (w && typeof ResizeObserver !== "undefined") hecho.then(() => seguirAncho(el));
  return hecho;
}

// Torta con agujero; en el medio, el total o lo principal. null si no hay
// nada que dibujar (el Python no dibuja nada).
export function dona(etiquetas, valores, colores, centro, sub = "", alto = 280) {
  const pares = etiquetas.map((e, i) => [e, valores[i], colores[i]]).filter(([, v]) => v);
  if (!pares.length) return null;
  const fig = {
    data: [{
      direction: "clockwise", hole: 0.62, hovertemplate: "%{label}: %{value} · %{percent}<extra></extra>",
      labels: pares.map(([e]) => e),
      marker: { colors: pares.map(([, , c]) => c), line: { color: "#0a0c0f", width: 2 } },
      sort: false, textfont: { color: "#0a0c0f", size: 13 }, textinfo: "value",
      values: pares.map(([, v]) => v), type: "pie",
    }],
    layout: {
      annotations: [{
        showarrow: false,
        text: `<span style='font-family:${BEBAS};font-size:34px'>${centro}</span>` +
          (sub ? `<br><span style='font-size:11px;color:${APAGADO}'>${sub}</span>` : ""),
        x: 0.5, xref: "paper", y: 0.5, yref: "paper",
      }],
      margin: { t: 8, b: 8, l: 8, r: 8 }, legend: { y: -0.08 },
    },
  };
  return grafico(fig, alto);
}

// Un renglón por partido: dos puntos unidos por una línea (rango).
export function pesas(etiquetas, a, b, { nombres = ["UNI", "Rival"], colores = [UNI, RIVAL], tituloX = "",
  alto = null, textos = null } = {}) {
  const data = etiquetas.map((y, i) => ({
    hoverinfo: "skip", line: { color: BORDE, width: 6 }, mode: "lines", showlegend: false,
    x: [a[i], b[i]], y: [y, y], type: "scatter",
  }));
  for (const [nombre, xs, color] of [[nombres[0], a, colores[0]], [nombres[1], b, colores[1]]]) {
    data.push({
      hovertemplate: "%{y}<br>" + nombre + ": %{x}<extra></extra>",
      marker: { color, line: { color: "#0a0c0f", width: 2 }, size: 15 },
      mode: "markers", name: nombre, x: xs, y: etiquetas, type: "scatter",
    });
  }
  if (textos?.length) {
    data.push({
      cliponaxis: false, hoverinfo: "skip", mode: "text", showlegend: false, text: textos,
      textfont: { color: APAGADO, family: "DM Mono, monospace", size: 12 }, textposition: "middle right",
      x: a.map((x1, i) => Math.max(x1, b[i])), y: etiquetas, type: "scatter",
    });
  }
  const layout = {
    xaxis: { title: { text: tituloX }, rangemode: "tozero" },
    yaxis: { autorange: "reversed", showgrid: false },
    legend: { y: 1.02, yanchor: "bottom", x: 0 }, margin: { t: 30, r: 56 },
  };
  // `alto or ...` en Python: un alto 0 también toma el de la cuenta
  return grafico({ data, layout }, alto || 80 + 38 * etiquetas.length);
}

// Puntos a favor y en contra sumados partido a partido (áreas). Al pasar por
// un punto: el partido, lo que sumó ese partido y el total.
export function acumulado(x, uni, rival, alto = 300) {
  const suma = (v) => {
    let s = 0;
    return v.map((n) => (s += n));
  };
  const data = [["En contra", rival, RIVAL, "rgba(255,152,0,.12)"], ["A favor", uni, UNI, "rgba(0,200,83,.16)"]]
    .map(([nombre, pts, color, relleno]) => ({
      customdata: pts, fill: "tozeroy", fillcolor: relleno,
      hovertemplate: nombre + ": +%{customdata} en el partido · total %{y}<extra></extra>",
      line: { color, width: 3 }, marker: { color, size: 7 }, mode: "lines+markers", name: nombre,
      x, y: suma(pts), type: "scatter",
    }));
  // un solo cartel por partido, con a favor y en contra (el título es el partido)
  const layout = {
    xaxis: { showgrid: false }, legend: { y: 1.02, yanchor: "bottom", x: 0, traceorder: "reversed" },
    margin: { t: 34 }, hovermode: "x unified",
  };
  return grafico({ data, layout }, alto);
}

// Ranking horizontal: palito y punto, más liviano que una barra llena.
export function piruletas(etiquetas, valores, { color = UNI, alto = null, sufijo = "" } = {}) {
  const data = etiquetas.map((y, i) => ({
    hoverinfo: "skip", line: { color: SUP2, width: 4 }, mode: "lines", showlegend: false,
    x: [0, valores[i]], y: [y, y], type: "scatter",
  }));
  data.push({
    cliponaxis: false, hovertemplate: "%{y}: %{x}<extra></extra>", marker: { color, size: 14 },
    mode: "markers+text", showlegend: false, text: valores.map((v) => `${v}${sufijo}`),
    textfont: { family: "DM Mono, monospace", size: 12 }, textposition: "middle right",
    x: valores, y: etiquetas, type: "scatter",
  });
  const layout = {
    xaxis: { visible: false, range: [0, Math.max(...valores, 1) * 1.18] },
    yaxis: { autorange: "reversed", showgrid: false }, margin: { r: 30 },
  };
  // `alto or ...` en Python: un alto 0 también toma el de la cuenta
  return grafico({ data, layout }, alto || 50 + 34 * etiquetas.length);
}

// series: [[nombre, ys, color, textos del hover | null]]; referencias:
// [[valor, texto, color]] -> línea punteada (ej. la temporada), como
// fig.add_hline() de plotly: una forma y su rótulo.
export function lineas(x, series, { alto = 300, porCiento = false, referencias = [] } = {}) {
  const data = series.map(([nombre, ys, color, hov]) => ({
    // `hov or ys` de Python: sin textos (o una lista vacía), los valores
    connectgaps: true, customdata: hov?.length ? hov : ys, hovertemplate: "%{x}<br>" + nombre + ": %{customdata}<extra></extra>",
    line: { color, width: 3 }, marker: { color, line: { color: "#0a0c0f", width: 2 }, size: 9 },
    mode: "lines+markers", name: nombre, x, y: ys, type: "scatter",
  }));
  const layout = {};
  // el rótulo de la primera referencia a la izquierda y el de la segunda a la
  // derecha: si las dos líneas quedan cerca, los textos no se pisan
  referencias.forEach(([valor, txt, color], i) => {
    if (valor === null || valor === undefined) return;
    const lado = i === 0 ? "left" : "right";
    (layout.shapes ??= []).push({
      line: { color, dash: "dot", width: 1.5 }, opacity: 0.7, type: "line",
      x0: 0, x1: 1, xref: "x domain", y0: valor, y1: valor, yref: "y",
    });
    (layout.annotations ??= []).push({
      font: { color, size: 11 }, showarrow: false, text: txt, x: lado === "left" ? 0 : 1, xanchor: lado,
      xref: "x domain", y: valor, yanchor: "bottom", yref: "y",
    });
  });
  if (porCiento) layout.yaxis = { range: [0, 108], ticksuffix: "%" };
  Object.assign(layout, { xaxis: { showgrid: false }, legend: { y: 1.02, yanchor: "bottom", x: 0 }, margin: { t: 34 } });
  return grafico({ data, layout }, alto);
}
