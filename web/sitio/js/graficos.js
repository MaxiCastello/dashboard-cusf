// Los tipos de gráfico del tablero (cusf/graficos.py). Cada función arma la
// figura igual que el Python (las pruebas comparan contra su JSON) y la
// devuelve; dibujar() la pone en la página.
//
// Los textos que llegan acá (rival, jugador, motivo) ya pasaron por
// texto(): sin < > (plotly interpreta algunas etiquetas HTML).
import { pct } from "./formato.js";
import { str } from "./python.js";
import { ACENTO, APAGADO, BORDE, RIVAL, SUP2, TEMA, TEXTO, UNI } from "./tema.js";

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
      else {
        const w = ancho(target);
        if (w && w !== target._fullLayout?.width) window.Plotly.relayout(target, { width: w });
      }
    }
  });
  mirar.observe(el);
}

// Plotly acomoda márgenes y leyendas midiendo los textos, y no se entera si
// la letra llega después (con poca señal): se queda con la medida de la de
// reemplazo y corta los nombres. Encima guarda cada medida (por texto y
// estilo, para todos los gráficos de la página) y la reusa aunque ya haya
// llegado la letra. Por eso:
// - cuando termina de llegar una letra, se vuelven a dibujar de cero los
//   gráficos dibujados antes;
// - a cada letra de la figura se le suma al final una que no existe y que
//   cambia cada vez que llega una (el navegador usa la primera que tiene: se
//   ve igual), así Plotly no reusa medidas hechas con la de reemplazo, ni en
//   esos gráficos ni en los que se dibujan después (otra pestaña).
// Medido con las letras demoradas: queda igual, punto por punto, que si
// hubieran estado desde el principio (letras_tarde.py, en las pruebas).
let letrasLlegadas = 0;
const conLetras = new Map();   // gráfico: cuántas letras habían llegado al dibujarlo
const enCurso = new WeakMap(); // gráfico: su último dibujo (no se empieza otro encima)
const redibujos = new Set();   // los redibujos que faltan terminar
let redibujo = null;
globalThis.document?.fonts?.addEventListener("loadingdone", (e) => {
  letrasLlegadas += e.fontfaces.length;
  redibujo ??= requestAnimationFrame(() => {
    redibujo = null;
    for (const [el, n] of conLetras) {
      if (!el.isConnected) conLetras.delete(el);
      else if (n < letrasLlegadas) {
        conLetras.set(el, letrasLlegadas);   // (no se lo vuelve a pedir mientras espera)
        const p = enCurso.get(el).then(() => el.isConnected && dibujar(el, dibujadas.get(el)))
          .catch((err) => console.error("No se pudo dibujar un gráfico:", err));
        redibujos.add(p);
        p.finally(() => redibujos.delete(p));
      }
    }
  });
});
// Para todoDibujado() de lienzo.js (y las pruebas de pantalla).
export const redibujosHechos = () => Promise.all([...redibujos]);

function conLlave(o, llave) {
  if (Array.isArray(o)) o.forEach((v) => conLlave(v, llave));
  else if (o && typeof o === "object") {
    for (const [k, v] of Object.entries(o)) {
      if (k === "family" && typeof v === "string") o[k] = `${v}, ${llave}`;
      else if (k === "family" && Array.isArray(v)) o[k] = v.map((f) => (typeof f === "string" ? `${f}, ${llave}` : f));
      else conLlave(v, llave);
    }
  }
  return o;
}

// Plotly guarda y cambia lo que recibe: le llega una copia, así la figura
// sigue siendo la que se comparó en las pruebas.
export function dibujar(el, fig) {
  dibujadas.set(el, fig);
  for (const viejo of conLetras.keys()) if (!viejo.isConnected) conLetras.delete(viejo);   // los de otro año, ya sacados
  conLetras.set(el, letrasLlegadas);
  const { data, layout } = structuredClone(fig);
  const w = ancho(el);
  const llave = `cusf-letras-${letrasLlegadas}`;
  const hecho = window.Plotly.newPlot(el, conLlave(data, llave), conLlave({
    ...layout, ...(w ? { width: w } : {}), font: { ...FUENTE_STREAMLIT, ...layout.font }, template: structuredClone(TEMA),
  }, llave), { ...CONFIG });
  enCurso.set(el, hecho.catch(() => null));
  // (también uno dibujado sin lugar: cuando lo tenga, se le pone ese ancho)
  if (typeof ResizeObserver !== "undefined") hecho.then(() => seguirAncho(el));
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

// UNI hacia la izquierda, el rival hacia la derecha, misma escala. Plotly
// guarda los textos de las barras como texto ("23"; un 0 va vacío).
export function mariposa(categorias, uni, rival, { alto = null, nombres = ["UNI", "Rival"], colores = [UNI, RIVAL] } = {}) {
  const tope = Math.max(...uni, ...rival, 1);
  const textos = (vs) => vs.map((v) => (v ? str(v) : ""));
  const data = [
    { cliponaxis: false, customdata: uni, hovertemplate: "%{y}: %{customdata}<extra>" + nombres[0] + "</extra>",
      marker: { color: colores[0] }, name: nombres[0], orientation: "h", text: textos(uni), textposition: "outside",
      x: uni.map((v) => 0 - v), y: categorias, type: "bar" },   // 0 - v y no -v: -0 no es 0 para JS
    { cliponaxis: false, hovertemplate: "%{y}: %{x}<extra>" + nombres[1] + "</extra>",
      marker: { color: colores[1] }, name: nombres[1], orientation: "h", text: textos(rival), textposition: "outside",
      x: rival, y: categorias, type: "bar" },
  ];
  const layout = {
    barmode: "relative", bargap: 0.35,
    xaxis: { range: [-tope * 1.25, tope * 1.25], showticklabels: false, showgrid: false, zeroline: true,
      zerolinecolor: BORDE, zerolinewidth: 2 },
    yaxis: { autorange: "reversed", showgrid: false },
  };
  return grafico({ data, layout }, alto || 70 + 44 * categorias.length);
}

// Un renglón por partido: la barra clara son las chances y la llena, las
// que terminaron en puntos. El texto dice "X de Y".
export function chances22(etiquetas, chances, concretadas, alto = null) {
  const data = [
    { hovertemplate: "%{y}<br>Chances: %{x}<extra></extra>", marker: { color: "rgba(26,111,212,.32)" }, name: "Chances",
      orientation: "h", x: chances, y: etiquetas, type: "bar" },
    { hovertemplate: "%{y}<br>Concretadas: %{x}<extra></extra>", marker: { color: ACENTO }, name: "Concretadas",
      orientation: "h", width: 0.45, x: concretadas, y: etiquetas, type: "bar" },
    { cliponaxis: false, hoverinfo: "skip", mode: "text", showlegend: false,
      text: concretadas.map((c, i) => `  ${c} de ${chances[i]} · ${pct(c, chances[i])}%`),
      textfont: { color: APAGADO, family: "DM Mono, monospace", size: 12 }, textposition: "middle right",
      x: chances, y: etiquetas, type: "scatter" },
  ];
  const layout = {
    barmode: "overlay", bargap: 0.3, yaxis: { autorange: "reversed", showgrid: false },
    xaxis: { range: [0, Math.max(...chances, 1) * 1.45] }, legend: { y: 1.02, yanchor: "bottom", x: 0 }, margin: { t: 34 },
  };
  return grafico({ data, layout }, alto || 90 + 30 * etiquetas.length);
}

// Celdas coloreadas por el % ganado; el texto dice "X de Y".
export function mapaCalor(filas, columnas, ganados, tirados, alto = null) {
  const z = ganados.map((fg, i) => fg.map((g, j) => (tirados[i][j] ? pct(g, tirados[i][j]) : null)));
  const txt = ganados.map((fg, i) => fg.map((g, j) => (tirados[i][j] ? `${g} de ${tirados[i][j]}` : "")));
  const data = [{
    colorscale: [[0, "#ff1744"], [0.5, "#ffd600"], [1, UNI]], hovertemplate: "%{y} · %{x}<br>%{text} · %{z}%<extra></extra>",
    showscale: false, text: txt, textfont: { color: "#0a0c0f", family: "DM Mono, monospace", size: 13 },
    texttemplate: "%{text}", x: columnas, xgap: 4, y: filas, ygap: 4, z, zmax: 100, zmin: 0, type: "heatmap",
  }];
  const layout = { xaxis: { side: "top", showgrid: false }, yaxis: { autorange: "reversed", showgrid: false }, margin: { t: 30 } };
  return grafico({ data, layout }, alto || 70 + 52 * filas.length);
}

// Barras verticales lado a lado, una tanda por partido.
// series: [[nombre, valores, color, textos del hover]]
export function barras(x, series, { alto = 300, tituloY = "", sufijo = "" } = {}) {
  const data = series.map(([nombre, ys, color, hov]) => ({
    cliponaxis: false, customdata: hov, hovertemplate: "%{x}<br>" + nombre + ": %{customdata}<extra></extra>",
    marker: { color }, name: nombre, text: ys.map((v) => (v ? `${str(v)}${sufijo}` : "")),
    textfont: { color: APAGADO, family: "DM Mono, monospace", size: 11 }, textposition: "outside", x, y: ys, type: "bar",
  }));
  const tope = Math.max(...series.flatMap(([, ys]) => ys), 1);
  const layout = {
    barmode: "group", bargap: 0.3, xaxis: { showgrid: false }, yaxis: { title: { text: tituloY }, range: [0, tope * 1.2] },
    legend: { y: 1.02, yanchor: "bottom", x: 0 }, margin: { t: 34 },
  };
  return grafico({ data, layout }, alto);
}

// Una telaraña: cada eje es un % (0 a 100); la forma se cierra volviendo al
// primero. series: [[nombre, valores %, color, relleno, textos del hover]]
export function radar(ejes, series, alto = 380) {
  const data = series.map(([nombre, vals, color, relleno, hov]) => ({
    customdata: [...hov, ...hov.slice(0, 1)], fill: "toself", fillcolor: relleno,
    hovertemplate: "%{theta}: %{customdata}<extra>" + nombre + "</extra>", line: { color, width: 2.5 },
    marker: { color, size: 7 }, name: nombre, r: [...vals, ...vals.slice(0, 1)], theta: [...ejes, ...ejes.slice(0, 1)],
    type: "scatterpolar",
  }));
  const layout = {
    polar: {
      radialaxis: { tickfont: { size: 10, color: APAGADO }, range: [0, 100], showticklabels: false, tickvals: [25, 50, 75, 100],
        gridcolor: "rgba(255,255,255,.08)", linecolor: BORDE },
      angularaxis: { tickfont: { size: 12, color: TEXTO }, gridcolor: "rgba(255,255,255,.08)", linecolor: BORDE },
      bgcolor: "rgba(0,0,0,0)",
    },
    legend: { y: -0.06 }, margin: { t: 24, b: 24, l: 48, r: 48 },
  };
  return grafico({ data, layout }, alto);
}

// Torta en dos anillos: adentro la situación, afuera el motivo.
export function sol(etiquetas, padres, valores, colores, alto = 380) {
  const data = [{
    branchvalues: "total", hovertemplate: "%{label}: %{value}<extra></extra>",
    ids: etiquetas.map((e, i) => (padres[i] ? `${padres[i]}/${e}` : e)), insidetextorientation: "radial", labels: etiquetas,
    marker: { colors: colores, line: { color: "#0a0c0f", width: 2 } }, parents: padres,
    textfont: { color: "#0a0c0f", size: 12 }, values: valores, type: "sunburst",
  }];
  return grafico({ data, layout: { margin: { t: 8, b: 8, l: 8, r: 8 } } }, alto);
}

// Barras horizontales apiladas. capas: [[nombre, valores, color]]
export function apiladas(etiquetas, capas, alto = null) {
  const data = capas.map(([nombre, vals, color]) => ({
    hovertemplate: "%{y}<br>" + nombre + ": %{x}<extra></extra>", marker: { color }, name: nombre, orientation: "h",
    x: vals, y: etiquetas, type: "bar",
  }));
  const layout = {
    barmode: "stack", bargap: 0.3, yaxis: { autorange: "reversed", showgrid: false },
    legend: { y: 1.02, yanchor: "bottom", x: 0, traceorder: "normal" }, margin: { t: 34 },
  };
  return grafico({ data, layout }, alto || 80 + 28 * etiquetas.length);
}

// Cómo fue cambiando el marcador, anotación por anotación. evol: [{periodo,
// u, r, eq, como}] acumulado (Uni-Dat no guarda minutos). La raya del
// entretiempo es fig.add_vline() de plotly: una forma y su rótulo.
export function marcadorEnElPartido(evol, alto = 320) {
  const x = [0, ...evol.map((_, i) => i + 1)];
  const u = [0, ...evol.map((e) => e.u)], r = [0, ...evol.map((e) => e.r)];
  const hov = ["Arranque", ...evol.map((e) =>
    `${e.eq === "UNI" ? "UNI" : "Rival"}: ${str(e.como)} · ${e.periodo === "PT" ? "1°" : "2°"} tiempo`)];
  const data = [["Rival", r, RIVAL], ["UNI", u, UNI]].map(([nombre, ys, color]) => ({
    customdata: hov, hovertemplate: "%{customdata}<br>" + nombre + " %{y}<extra></extra>",
    line: { color, shape: "hv", width: 3 }, marker: { color, size: 7 }, mode: "lines+markers", name: nombre,
    x, y: ys, type: "scatter",
  }));
  const layout = {
    xaxis: { title: { text: "Anotaciones, en orden" }, showgrid: false, dtick: 1 },
    yaxis: { title: { text: "Puntos" }, rangemode: "tozero" },
    legend: { y: 1.02, yanchor: "bottom", x: 0, traceorder: "reversed" }, margin: { t: 34 },
  };
  const medio = evol.findIndex((e) => e.periodo === "ST");
  if (medio > 0) {
    layout.shapes = [{ line: { color: APAGADO, dash: "dot", width: 1 }, type: "line", x0: medio + 0.5, x1: medio + 0.5,
      xref: "x", y0: 0, y1: 1, yref: "y domain" }];
    layout.annotations = [{ font: { color: APAGADO, size: 11 }, showarrow: false, text: "Entretiempo", x: medio + 0.5,
      xanchor: "center", xref: "x", y: 1, yanchor: "bottom", yref: "y domain" }];
  }
  return grafico({ data, layout }, alto);
}
