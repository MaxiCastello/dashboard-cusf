// Los tipos de gráfico del tablero (cusf/graficos.py). Cada función arma la
// figura igual que el Python (las pruebas comparan contra su JSON) y la
// devuelve; dibujar() la pone en la página.
//
// Los textos que llegan acá (rival, jugador, motivo) ya pasaron por
// texto(): sin < > (plotly interpreta algunas etiquetas HTML).
import { APAGADO, BORDE, RIVAL, TEMA, UNI } from "./tema.js";

const BEBAS = "Bebas Neue, Arial Narrow, sans-serif";
const CONFIG = { displayModeBar: false, scrollZoom: false };

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

// Plotly guarda y cambia lo que recibe: le llega una copia, así la figura
// sigue siendo la que se comparó en las pruebas. `responsive` lo agrega
// Streamlit por su cuenta (el gráfico acompaña el ancho de la pantalla).
export function dibujar(el, fig) {
  dibujadas.set(el, fig);
  const { data, layout } = structuredClone(fig);
  return window.Plotly.newPlot(el, data, { ...layout, template: structuredClone(TEMA) }, { ...CONFIG, responsive: true });
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
