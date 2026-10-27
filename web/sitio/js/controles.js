// Los controles de arriba del tablero, como los de Streamlit: los radios
// (st.radio horizontal), el desplegable VER (st.selectbox) y las pestañas
// (st.tabs). Por dentro son los elementos de HTML de siempre (input radio,
// select, button con role="tab"): andan con el teclado y con el lector de
// pantalla, y en el celular el desplegable abre la lista del teléfono.
import { CHEVRON_DER, CHEVRON_IZQ } from "./iconos.js";
import { html, poner } from "./piezas.js";

let nombres = 0;   // un name distinto para cada grupo de radios

// Radios: opciones [[valor, texto]], `elegido` es el valor marcado.
// alCambiar(valor) se llama cuando se elige otro.
// Se vuelven a armar en cada cambio: si el foco estaba en el grupo (alguien
// usando las flechas del teclado), queda en la opción elegida.
export function radios(cont, opciones, elegido, alCambiar) {
  const nombre = `radios${++nombres}`;
  const conFoco = cont.contains(document.activeElement);
  poner(cont, html`${opciones.map(([, txt], i) =>
    html`<label><input type="radio" name="${nombre}" value="${i}"><span class="circ"></span><span>${txt}</span></label>`)}`);
  cont.querySelectorAll("input").forEach((inp, i) => {
    inp.checked = opciones[i][0] === elegido;
    inp.addEventListener("change", () => {
      if (inp.checked) alCambiar(opciones[i][0]);
    });
  });
  if (conFoco) cont.querySelector("input:checked")?.focus();
}

// Desplegable: opciones [[valor, texto]]. El valor de cada <option> es su
// posición (un id de la base puede ser cualquier cosa).
export function desplegable(sel, opciones, elegido, alCambiar) {
  poner(sel, html`${opciones.map(([, txt], i) => html`<option value="${i}">${txt}</option>`)}`);
  sel.selectedIndex = Math.max(0, opciones.findIndex(([v]) => v === elegido));
  sel.onchange = () => alCambiar(opciones[sel.selectedIndex][0]);
}

// Pestañas: arma la fila de pestañas y un panel por pestaña. Cada panel se
// llena la primera vez que se muestra (alMostrar(i, panel)): un gráfico de
// Plotly dibujado en un panel escondido sale con ancho 0. Arranca en la
// primera, como Streamlit cada vez que cambia lo que se ve.
let pestanasArmadas = 0;
// lugar de las pestañas: el que mira sus flechas. Cada uno sale de acá al
// apagarlo o cuando su fila ya no está en la página.
const observadores = new Map();

// Antes de poner otra cosa donde había pestañas: se apagan los que miraban
// sus flechas, las de ahí y las que quedan adentro (las de un partido,
// debajo del marcador; las internas de una pestaña). Si no, siguen vivos y
// guardan la temporada anterior.
export function apagarPestanas(cont) {
  for (const [lugar, obs] of observadores) {
    if (cont.contains(lugar)) {
      obs.disconnect();
      observadores.delete(lugar);
    }
  }
}

export function pestanas(cont, rotulos, alMostrar) {
  const id = `pest${++pestanasArmadas}`;
  apagarPestanas(cont);
  poner(cont, html`<div class="pestanas"><div role="tablist">${rotulos.map((r, i) =>
    html`<button type="button" role="tab" id="${id}-t${i}" aria-controls="${id}-p${i}">${r}</button>`)}</div>
<button type="button" class="flecha izq" tabindex="-1" aria-label="Ver las pestañas de la izquierda" hidden>${CHEVRON_IZQ}</button>
<button type="button" class="flecha der" tabindex="-1" aria-label="Ver más pestañas" hidden>${CHEVRON_DER}</button></div>
${rotulos.map((r, i) => html`<div class="panel" role="tabpanel" id="${id}-p${i}" aria-labelledby="${id}-t${i}" hidden></div>`)}`);
  const botones = [...cont.querySelectorAll('[role="tab"]')];
  const paneles = [...cont.querySelectorAll('[role="tabpanel"]')];
  const lista = cont.querySelector('[role="tablist"]');
  const llenos = new Set();

  function mostrar(i, foco = false) {
    botones.forEach((b, k) => {
      b.setAttribute("aria-selected", String(k === i));
      b.tabIndex = k === i ? 0 : -1;   // con Tab se entra a la elegida; con las flechas, a las otras
      paneles[k].hidden = k !== i;
    });
    if (foco) botones[i].focus({ preventScroll: true });
    // que la elegida se vea entera, corriendo sólo la fila (no la página)
    const b = botones[i], borde = 40;   // el ancho de las flechas
    if (b.offsetLeft < lista.scrollLeft + borde) lista.scrollLeft = b.offsetLeft - borde;
    else if (b.offsetLeft + b.offsetWidth > lista.scrollLeft + lista.clientWidth - borde) {
      lista.scrollLeft = b.offsetLeft + b.offsetWidth - lista.clientWidth + borde;
    }
    if (!llenos.has(i)) {
      llenos.add(i);
      alMostrar(i, paneles[i]);
    }
  }
  botones.forEach((b, i) => b.addEventListener("click", () => mostrar(i)));
  // flechas del teclado, Inicio y Fin (como las pestañas de Streamlit)
  lista.addEventListener("keydown", (e) => {
    const i = botones.indexOf(document.activeElement);
    if (i < 0) return;
    const ir = { ArrowRight: i + 1, ArrowLeft: i - 1, Home: 0, End: botones.length - 1 }[e.key];
    if (ir === undefined) return;
    e.preventDefault();
    mostrar((ir + botones.length) % botones.length, true);
  });

  // Las flechas de los costados aparecen sólo si las pestañas no entran.
  const izq = cont.querySelector(".flecha.izq"), der = cont.querySelector(".flecha.der");
  const flechas = () => {
    const max = lista.scrollWidth - lista.clientWidth;
    izq.hidden = lista.scrollLeft <= 1;
    der.hidden = lista.scrollLeft >= max - 1;
  };
  izq.addEventListener("click", () => lista.scrollBy({ left: -lista.clientWidth * 0.6, behavior: "smooth" }));
  der.addEventListener("click", () => lista.scrollBy({ left: lista.clientWidth * 0.6, behavior: "smooth" }));
  lista.addEventListener("scroll", flechas, { passive: true });
  // se miran la fila y cada pestaña: si la letra llega tarde (font-display:
  // swap), las pestañas cambian de ancho sin que la fila cambie
  const obs = new ResizeObserver(() => {
    if (lista.isConnected) flechas();
    else {   // ya no está (otra temporada): se lo suelta (las de adentro nadie las apaga)
      obs.disconnect();
      observadores.delete(cont);
    }
  });
  for (const el of [lista, ...botones]) obs.observe(el);
  observadores.set(cont, obs);
  document.fonts?.ready.then(flechas);

  mostrar(0);
  flechas();
}
