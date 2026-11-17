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

// ── Comparar temporadas (nov 2026) ───────────────────────────────────────────
// Dos temporadas cara a cara: siempre la más nueva primero (a) y la más
// vieja después (b). Un cambio (`dif`) es { tono, dir, txt } o null (sin
// datos). tono: "favor" (verde: a favor de UNI), "contra" (rojo) o "parecido"
// (gris: tan chico que puede ser casualidad). dir: 1 subió, -1 bajó. El color
// lo da el tono, no la flecha: que bajen los penales de UNI es verde.
export function diferencia(dif) {
  if (!dif) return html`<span class="dif nada">Sin datos</span>`;
  const flecha = dif.dir > 0 ? "▲" : dif.dir < 0 ? "▼" : "≈";
  return html`<span class="dif ${dif.tono}"><i>${flecha}</i> ${dif.txt}</span>`;
}

// Arriba de todo: qué color es cada temporada y qué quiere decir cada color
// de los cambios. lados: [{ nombre, n (ya escrito), color }]
export function leyendaComparar(lados) {
  return html`<div class="cley"><div class="cl1">${lados.map((l) =>
    html`<span><i style="background:${l.color}"></i><b>${l.nombre}</b> ${l.n}</span>`)}</div><div class="cl2">${
    // (sin flechas: la flecha dice si subió o bajó; el color, para quién)
    [["favor", "A favor de UNI"], ["contra", "En contra de UNI"], ["parecido", "Parecido"]].map(([t, txt]) =>
      html`<span class="dif ${t}">${txt}</span>`)}</div></div>`;
}

// Lo que cambió, en palabras: una línea con lo de a favor y otra con lo de en
// contra (cada una, si hay). favor y contra: frases ("menos penales de UNI en
// el scrum").
const enLista = (xs) => (xs.length < 2 ? xs.join("") : `${xs.slice(0, -1).join(", ")} y ${xs.at(-1)}`);
export function resumenComparar(titulo, favor, contra) {
  const linea = (clase, rotulo, xs) => (xs.length ? html`<p class="${clase}"><b>${rotulo}:</b> ${enLista(xs)}.</p>` : "");
  return html`<div class="resumen-cmp"><div class="rt">${titulo}</div>${
    favor.length || contra.length ? html`${linea("favor", "A favor de UNI", favor)}${linea("contra", "En contra de UNI", contra)}<p
class="resto">Lo demás quedó parecido.</p>` : html`<p class="resto">Nada cambió tanto como para estar seguros de que no es casualidad.</p>`}</div>`;
}

// Los puntos de un partido promedio de cada temporada, como dos marcadores.
// lados: [{ nombre, color, favor, contra, res: [g, e, p] | null, abajo }]
// (favor y contra ya escritos). cambios: [[rótulo, antes, ahora, dif]]: los
// renglones de abajo, "A favor: 27,8 → 32,8".
export function partidoPromedio(lados, cambiosDe) {
  const barra = (res) => (res ? html`<div class="pb">${res.map((v, i) => (v ? html`<i class="r${i}" style="flex:${v} 0 0"></i>` : ""))}</div>` : "");
  return html`<div class="promedios">${lados.map((l) =>
    html`<div class="pm" style="border-top-color:${l.color}"><div class="pn"><i style="background:${l.color}"></i>${l.nombre}</div><div
class="pv"><div><b>${l.favor}</b><span>A favor</span></div><em>–</em><div><b>${l.contra}</b><span>En contra</span></div></div>${
      barra(l.res)}<div class="px">${l.abajo}</div></div>`)}<div class="pc">${cambiosDe.map(([rotulo, antes, ahora, dif]) =>
    html`<div><span>${rotulo}</span><b>${antes}<em>→</em>${ahora}</b>${diferencia(dif)}</div>`)}</div></div>`;
}

// Lo que más cambió: una tarjeta por cosa, con el antes y el ahora en grande.
// items: [{ rotulo, antes, ahora, unidad, dif, renglones: [[nombre, texto, color]], ojo }]
// (ojo, opcional: un aviso, ej. de cuántos partidos sale el dato)
export function cambios(items) {
  return html`<div class="cambios">${items.map((x) =>
    html`<div class="cb ${x.dif.tono}"><div class="cn">${x.rotulo}</div><div class="cv"><span>${x.antes}</span><em>→</em><b>${x.ahora}</b>${
      x.unidad ? html`<small>${x.unidad}</small>` : ""}</div><div class="cd">${diferencia(x.dif)}</div>${
      x.renglones.map(([n, txt, c]) => html`<div class="cr"><i style="background:${c}"></i><b>${n}</b><span>${txt}</span></div>`)}${
      x.ojo ? html`<div class="pq">${x.ojo}</div>` : ""}</div>`)}</div>`;
}

// Un renglón por cosa sobre un mismo eje de 0 a 100% (arriba, con sus
// rayas): el punto de cada temporada va en su %, con el % escrito (el de la
// nueva arriba del punto, el de la vieja abajo: nunca se pisan), y el tramo
// entre los dos pintado. filas: [{ rotulo, muestra | null, p: [a | null, b |
// null], txt: [a, b], dif }]; nombres y colores: [a, b].
const MARCAS = [0, 25, 50, 75, 100];
export function pistas(filas, nombres, colores, eje = "% ganado") {
  const punto = (p, c, clase) => (p === null ? "" : html`<i class="${clase}" style="left:${p}%;background:${c}"></i><b class="${clase}"
style="left:${p}%;color:${c}">${p}%</b>`);
  return html`<div class="pistas"><div class="pj"><span>${eje}</span><div>${MARCAS.map((m) => html`<s style="left:${m}%">${m}%</s>`)}</div></div>${
    filas.map((f) => {
      const [pa, pb] = f.p;
      const tramo = pa === null || pb === null ? "" : html`<u style="left:${Math.min(pa, pb)}%;width:${Math.abs(pa - pb)}%"></u>`;
      return html`<div class="pi"><div class="pt"><span>${f.rotulo}</span>${diferencia(f.dif)}</div><div class="pr">${tramo}${
        punto(pb, colores[1], "b")}${punto(pa, colores[0], "a")}</div><div class="pe">${[0, 1].map((i) =>
        html`<span><i style="background:${colores[i]}"></i><b>${nombres[i]}</b> ${f.txt[i]}</span>`)}</div>${
        f.muestra ? html`<div class="pq">${f.muestra}</div>` : ""}</div>`;
    })}</div>`;
}

// Barras enfrentadas que salen del medio: a la izquierda la temporada nueva,
// a la derecha la vieja, y en el medio qué es y cuánto cambió. Cada renglón
// tiene su propia escala (la barra más larga de las dos llega al borde).
// filas: [[rótulo, valor a, valor b, [grande, chico] a, [grande, chico] b, dif]]
export function caraACara(filas, nombres, colores) {
  const lado = (v, max, [grande, chico], color, clase) =>
    html`<div class="cl ${clase}"><div class="ct"><b>${grande}</b><small>${chico}</small></div><div class="cz"><i style="width:${
      max ? fijo((v * 100) / max, 2) : "0.00"}%;background:${color}"></i></div></div>`;
  return html`<div class="cara"><div class="cf cab"><div class="cl a"><i style="background:${colores[0]}"></i>${nombres[0]}</div><div
class="cm"></div><div class="cl b">${nombres[1]}<i style="background:${colores[1]}"></i></div></div>${
    filas.map(([rotulo, va, vb, ta, tb, dif]) => {
      const max = Math.max(va, vb);
      return html`<div class="cf">${lado(va, max, ta, colores[0], "a")}<div class="cm"><span>${rotulo}</span>${diferencia(dif)}</div>${
        lado(vb, max, tb, colores[1], "b")}</div>`;
    })}</div>`;
}

// Cada punto es un partido, puesto en su % sobre un eje con sus números
// (abajo). Los que caen juntos se apilan (no se tapan). La raya es la
// temporada entera. grupos: [{ titulo, eje: [desde, hasta, paso], filas:
// [{ nombre, color, puntos: [{ p, nivel }], total | null, abajo }] }]
export function partidoPorPartido(grupos) {
  return html`<div class="tiras">${grupos.map((g) => {
    const [desde, hasta, paso] = g.eje;
    const x = (p) => fijo(((p - desde) * 100) / (hasta - desde), 2);
    const marcas = [];
    for (let m = desde; m <= hasta; m += paso) marcas.push(m);
    return html`<div class="ti"><div class="tt">${g.titulo}</div>${g.filas.map((f) => {
      const pisos = f.puntos.reduce((s, q) => Math.max(s, q.nivel + 1), 1);
      return html`<div class="tf"><b style="color:${f.color}">${f.nombre}</b><div class="tp" style="height:${10 + pisos * 15}px">${
        marcas.map((m) => html`<s style="left:${x(m)}%"></s>`)}${
        f.puntos.map((q) => html`<i style="left:${x(q.p)}%;bottom:${3 + q.nivel * 15}px;background:${f.color}"></i>`)}${
        f.total === null ? "" : html`<u style="left:${x(f.total)}%;background:${f.color}"></u>`}</div><small>${f.abajo}</small></div>`;
    })}<div class="tk"><div>${marcas.map((m) => html`<s style="left:${x(m)}%">${m}%</s>`)}</div></div></div>`;
  })}</div>`;
}

// El mismo color, mezclado con blanco (para el anillo de afuera de una torta).
export function aclarar(color, f = 0.45) {
  const [r, g, b] = [1, 3, 5].map((i) => Number.parseInt(color.slice(i, i + 2), 16));
  return `#${[r, g, b].map((c) => redondear(c + (255 - c) * f).toString(16).padStart(2, "0")).join("")}`;
}
