// Lo que comparten las dos páginas (Tablero y Cargar partido): la barra de
// arriba (st.navigation) y el encabezado. Aparte de pagina.js para que
// cargar.html no baje las cuentas.
import { EDIT_NOTE, INSIGHTS } from "./iconos.js";
import { html, poner } from "./piezas.js";

const $ = (id) => document.getElementById(id);

// La barra de arriba: la página actual, resaltada.
export function barra(actual) {
  const link = (href, icono, txt, cual) =>
    html`<a href="${href}"${cual === actual ? html` aria-current="page"` : ""}>${icono}<span data-texto="${txt}">${txt}</span></a>`;
  poner($("barra"), html`<nav aria-label="Páginas">${link("./", INSIGHTS, "Tablero", "tablero")}${link("cargar.html", EDIT_NOTE,
    "Cargar partido", "cargar")}</nav>`);
}

export function encabezado(sub) {
  poner($("enc"), html`<img src="img/escudo.png" alt=""><div><div class="t">Universitario Rugby</div><div class="s">${sub}</div></div>`);
}
