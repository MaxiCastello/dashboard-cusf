// Piezas de HTML del tablero (cusf/estilo.py): números grandes y anillos
// "X de Y". Dan el mismo HTML que el Python (las pruebas lo comparan).
//
// Todo el HTML se arma con html`...`: cada valor que se mete adentro se
// escapa, salvo que ya sea HTML armado con html`...`. Así un nombre cargado
// con etiquetas se ve como texto y no se ejecuta (el lint sólo deja poner
// en innerHTML lo que sale de html`...`).
import { esc, pct } from "./formato.js";
import { SUP2, TEXTO } from "./tema.js";

class Html extends String {}

function aHtml(v) {
  if (v instanceof Html) return String(v);
  if (Array.isArray(v)) return v.map(aHtml).join("");
  return esc(v);
}

export function html(partes, ...valores) {
  return new Html(partes.reduce((s, parte, i) => s + aHtml(valores[i - 1]) + parte));
}

// Pone HTML en un elemento. Lo armado con html`...` entra tal cual; un texto
// común se escapa (se ve como texto).
export function poner(el, h) {
  el.innerHTML = html`${h}`;
}

// items: [[valor, rótulo, color|null]]. `c || TEXTO` como el `c or TEXTO` de Python: "" también toma TEXTO.
export function kpis(items) {
  return html`<div class="kpis">${items.map(([v, l, c]) =>
    html`<div class="kpi"><div class="v" style="color:${c || TEXTO}">${v}</div><div class="l">${l}</div></div>`)}</div>`;
}

// items: [[rótulo, a, b, color, arriba|null]] -> un anillo por item con "a",
// abajo "de b" y el % (en tres renglones: entra aunque sean miles). `arriba`
// es el grupo (UNI / Rival).
export function anillos(items, columnas = null) {
  const partes = items.map(([rotulo, a, b, color, arriba]) => {
    const p = pct(a, b);
    const centro = b ? html`${a}<span class="de">de ${b}</span><small>${p}%</small>` : html`—<small>sin datos</small>`;
    // ojo: html`` + html`` da un texto común (que se escaparía): se juntan adentro de otro html``
    const anillo = html`<div class="r" style="background:conic-gradient(${color} ${p}%,${SUP2} 0)"><div class="c">${centro}</div></div>`;
    const rot = html`<div class="l">${arriba ? html`<i>${arriba}</i>` : ""}${rotulo}</div>`;
    return html`<div class="anillo">${anillo}${rot}</div>`;
  });
  const fijo = columnas ? html` style="grid-template-columns:repeat(${columnas},1fr)"` : "";
  return html`<div class="anillos"${fijo}>${partes}</div>`;
}
