// La paleta de Uni-Dat y el tema "cusf" de los gráficos (cusf/estilo.py).
// Las pruebas comparan TEMA contra el que exporta el Python (tema.json).

export const BG = "#0a0c0f", SUP = "#13161b", SUP2 = "#1c2028", BORDE = "#2a2f3a";
export const TEXTO = "#e8eaf0", APAGADO = "#8b93a3", ACENTO = "#1a6fd4";
export const UNI = "#00c853", RIVAL = "#ff9800";          // nosotros / ellos
export const MAL = "#ff1744", NEUTRO = "#6b7280", AVISO = "#ffd600";

// un objeto nuevo por eje (si los dos ejes compartieran el mismo, lo que
// Plotly cambiara en uno aparecería en el otro)
const eje = () => ({
  automargin: true, gridcolor: "rgba(255,255,255,.06)", zerolinecolor: "rgba(255,255,255,.12)",
  tickfont: { color: APAGADO }, title: { font: { color: APAGADO } },
});

export const TEMA = {
  layout: {
    paper_bgcolor: "rgba(0,0,0,0)", plot_bgcolor: "rgba(0,0,0,0)",
    font: { family: "DM Sans, system-ui, sans-serif", color: TEXTO, size: 13 },
    title: { font: { size: 14, color: TEXTO }, x: 0, xanchor: "left" },
    xaxis: eje(),
    yaxis: eje(),
    legend: { orientation: "h", y: -0.18, x: 0, font: { color: APAGADO } },
    hoverlabel: { bgcolor: SUP2, bordercolor: BORDE, font: { color: TEXTO } },
    margin: { l: 8, r: 8, t: 36, b: 8 }, colorway: [UNI, RIVAL, ACENTO, AVISO, MAL, NEUTRO],
    barcornerradius: 3, separators: ",.",
  },
};
