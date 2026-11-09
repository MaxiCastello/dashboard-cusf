// Piezas de HTML del tablero (cusf/estilo.py): números grandes y anillos
// "X de Y". Dan el mismo HTML que el Python (las pruebas lo comparan).
//
// Todo el HTML se arma con html`...`: cada valor que se mete adentro se
// escapa, salvo que ya sea HTML armado con html`...`. Así un nombre cargado
// con etiquetas se ve como texto y no se ejecuta (el lint sólo deja poner
// en innerHTML lo que sale de html`...`).
import { esc, fijo, pct, redondear } from "./formato.js";
import { str } from "./python.js";
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
// items: [[valor, rótulo, color, abajo]]; `abajo` (opcional, nov 2026) es un
// renglón chico debajo del rótulo (ej. "Máximo 2:30 · 50 tramos").
export function kpis(items) {
  return html`<div class="kpis">${items.map(([v, l, c, x]) =>
    html`<div class="kpi"><div class="v" style="color:${c || TEXTO}">${v}</div><div class="l">${l}</div>${
      x ? html`<div class="x">${x}</div>` : ""}</div>`)}</div>`;
}

// items: [[rótulo, a, color]], partes de un total b -> un renglón por item:
// el color, el rótulo, "a de b" y el % con un decimal. Va debajo de una torta
// (nov 2026: tackles) para que el % se vea sin pasar el cursor.
export function reparto(items, b) {
  return html`<div class="reparto">${items.map(([rotulo, a, color]) =>
    html`<div class="f"><i style="background:${color}"></i><span>${rotulo}</span><span class="d">${a} de ${b}</span><b>${
      b ? fijo((a * 100) / b, 1) : "0.0"}%</b></div>`)}</div>`;
}

// La lupa del tiempo de juego (nov 2026): arriba una barra con el total y sus
// partes; debajo, la primera parte de arriba ampliada a todo el ancho y
// partida en otras. Cada barra: [título, total ya escrito, [[rótulo, valor,
// color]]]; `fmt` escribe los valores. El % va adentro de la barra si entra y
// siempre abajo, con el valor (en el celular no hay cursor).
export function lupa(arriba, abajo, fmt) {
  const barra = ([titulo, total, partes]) => {
    const suma = partes.reduce((s, [, v]) => s + v, 0);
    return html`<div class="lb"><div class="lt"><span>${titulo}</span><b>${total}</b></div><div class="lr">${
      partes.map(([, v, c]) => html`<div style="flex:${v} 0 0;background:${c}">${pct(v, suma) >= 12 ? html`<span>${pct(v, suma)}%</span>` : ""}</div>`)
    }</div><div class="ll">${partes.map(([r, v, c]) =>
      html`<div><span class="r"><i style="background:${c}"></i>${r}</span><span class="v">${fmt(v)}<small>${pct(v, suma)}%</small></span></div>`)}</div></div>`;
  };
  const suma = arriba[2].reduce((s, [, v]) => s + v, 0);
  const p = suma ? fijo((arriba[2][0][1] * 100) / suma, 2) : "0.00";
  return html`<div class="lupa">${barra(arriba)}<div class="lz" style="clip-path:polygon(0 0,${p}% 0,100% 100%,0 100%)"></div>${barra(abajo)}</div>`;
}

// Cuánto duró cada tramo (nov 2026): el promedio y el más largo del mismo
// tamaño, y una regla cuyo largo entero es el más largo y la parte pintada el
// promedio. items: [[título, promedio|null, máximo|null, color, al lado del
// título|null, debajo del máximo|null]]; `fmt` escribe los tiempos.
export function tramos(items, fmt) {
  return html`<div class="tramos">${items.map(([titulo, prom, max, color, lado, bajo]) =>
    html`<div class="tr"><div class="tt"><span>${titulo}</span>${lado ? html`<small>${lado}</small>` : ""}</div><div class="tv"><div><span>Promedio</span><b>${
      prom === null ? "—" : fmt(prom)}</b></div><div><span>El más largo</span><b>${max === null ? "—" : fmt(max)}</b>${
      bajo ? html`<small>${bajo}</small>` : ""}</div></div>${prom !== null && max ? html`<div class="rg"><div style="width:${
      fijo(Math.min(100, (prom * 100) / max), 2)}%;background:${color}"></div></div>` : ""}</div>`)}</div>`;
}

// items: [[rótulo, a, b, color, arriba|null]] -> un anillo por item con "a",
// abajo "de b" y el % (en tres renglones: entra aunque sean miles). `arriba`
// es el grupo (UNI / Rival).
// `fmt` (opcional, nov 2026): cómo se escriben a y b (ej. milisegundos → "17:36").
export function anillos(items, columnas = null, fmt = (x) => x) {
  const partes = items.map(([rotulo, a, b, color, arriba]) => {
    const p = pct(a, b);
    const centro = b ? html`${fmt(a)}<span class="de">de ${fmt(b)}</span><small>${p}%</small>` : html`—<small>sin datos</small>`;
    // ojo: html`` + html`` da un texto común (que se escaparía): se juntan adentro de otro html``
    const anillo = html`<div class="r" style="background:conic-gradient(${color} ${p}%,${SUP2} 0)"><div class="c">${centro}</div></div>`;
    const rot = html`<div class="l">${arriba ? html`<i>${arriba}</i>` : ""}${rotulo}</div>`;
    return html`<div class="anillo">${anillo}${rot}</div>`;
  });
  const fijo = columnas ? html` style="grid-template-columns:repeat(${columnas},1fr)"` : "";
  return html`<div class="anillos"${fijo}>${partes}</div>`;
}

// Tabla simple; la primera columna a la izquierda. Todo se escapa (cada
// celda pasa por str(), como esc(str(v)) en el Python).
export function tabla(columnas, filas) {
  return html`<div class="tabla-scroll"><table class="t"><thead><tr>${columnas.map((c) => html`<th>${str(c)}</th>`)}</tr></thead><tbody>${
    filas.map((f) => html`<tr>${f.map((v) => html`<td>${str(v)}</td>`)}</tr>`)}</tbody></table></div>`;
}

// El mismo color, mezclado con blanco (para el anillo de afuera de una torta).
export function aclarar(color, f = 0.45) {
  const [r, g, b] = [1, 3, 5].map((i) => Number.parseInt(color.slice(i, i + 2), 16));
  return `#${[r, g, b].map((c) => redondear(c + (255 - c) * f).toString(16).padStart(2, "0")).join("")}`;
}
