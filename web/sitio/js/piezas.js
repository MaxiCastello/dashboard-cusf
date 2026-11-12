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
// Cada parte puede traer un 4° elemento: un renglón chico debajo de su valor
// (ej. "Temporada 34%": el partido al lado de la temporada, sin opinar).
// `frase` (opcional): lo principal dicho en palabras, arriba de todo.
export function lupa(arriba, abajo, fmt, frase = null) {
  const barra = ([titulo, total, partes]) => {
    const suma = partes.reduce((s, [, v]) => s + v, 0);
    return html`<div class="lb"><div class="lt"><span>${titulo}</span><b>${total}</b></div><div class="lr">${
      partes.map(([, v, c]) => html`<div style="flex:${v} 0 0;background:${c}">${pct(v, suma) >= 12 ? html`<span>${pct(v, suma)}%</span>` : ""}</div>`)
    }</div><div class="ll">${partes.map(([r, v, c, ref]) =>
      html`<div><span class="r"><i style="background:${c}"></i>${r}</span><span class="v">${fmt(v)}<small>${pct(v, suma)}%</small></span>${
        ref ? html`<span class="t">${ref}</span>` : ""}</div>`)}</div></div>`;
  };
  const suma = arriba[2].reduce((s, [, v]) => s + v, 0);
  const p = suma ? fijo((arriba[2][0][1] * 100) / suma, 2) : "0.00";
  return html`<div class="lupa">${frase ? html`<p class="lf">${frase}</p>` : ""}${barra(arriba)}<div class="lz" style="clip-path:polygon(0 0,${
    p}% 0,100% 100%,0 100%)"></div>${barra(abajo)}</div>`;
}

// Cuánto duró cada vez (nov 2026): el promedio y la más larga, del mismo
// tamaño. items: [[título, promedio|null, máximo|null, color (el cuadradito
// del título, el mismo de la lupa), al lado del título|null, debajo del
// máximo|null]]; `fmt` escribe los tiempos.
export function tramos(items, fmt) {
  // de a cuatro, en dos filas de dos (en una sola fila los títulos se parten)
  // `fmt` da [número, unidad]: el número grande y la unidad chica al lado ("41 seg", "2:10 min")
  const num = (v) => {
    if (v === null) return "—";
    const [n, u] = fmt(v);
    return html`${n}<small>${u}</small>`;
  };
  return html`<div class="tramos${items.length === 4 ? " c4" : ""}">${items.map(([titulo, prom, max, color, lado, bajo]) =>
    html`<div class="tr"><div class="tt"><span><i style="background:${color}"></i>${titulo}</span>${
      lado ? html`<small>${lado}</small>` : ""}</div><div class="tv"><div><span>Promedio</span><b>${num(prom)}</b></div><div><span>La más larga</span><b>${
      num(max)}</b>${bajo ? html`<small>${bajo}</small>` : ""}</div></div></div>`)}</div>`;
}

// Cada partido de la temporada en dos renglones, con los minutos escritos (en
// el celular no hay cursor): el partido (en juego / pelota muerta) y el tiempo
// en juego (UNI / Rival con la pelota). items: [[partido, aclaración|null,
// [[rótulo, valor, color], [rótulo, valor, color]], [[...], [...]]]]; `fmt`
// escribe los valores.
export function porPartido(items, fmt) {
  const renglon = ([a, b]) => {
    const suma = a[1] + b[1];
    const lado = ([r, v]) => html`<span><em>${r}</em> ${fmt(v)} <small>${pct(v, suma)}%</small></span>`;
    return html`<div class="pr"><div class="px">${lado(a)}${lado(b)}</div><div class="pb">${
      [a, b].map(([, v, c]) => html`<div style="flex:${v} 0 0;background:${c}"></div>`)}</div></div>`;
  };
  return html`<div class="porpartido">${items.map(([partido, aclaracion, arriba, abajo]) =>
    html`<div class="pp"><div class="pt"><span>${partido}</span>${aclaracion ? html`<small>${aclaracion}</small>` : ""}</div>${
      renglon(arriba)}${renglon(abajo)}</div>`)}</div>`;
}

// Avisos de cómo se cargó (no de cómo se jugó): un renglón por aviso.
export function ojo(textos) {
  return html`<div class="aviso ojo" role="note">${textos.map((t) => html`<p>${t}</p>`)}</div>`;
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
