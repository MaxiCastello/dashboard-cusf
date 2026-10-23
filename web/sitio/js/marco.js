// Lo que comparten las dos páginas (Tablero y Cargar partido): la barra de
// arriba (st.navigation) y el encabezado. Aparte de pagina.js para que
// cargar.html no baje las cuentas.
//
// Como Streamlit: desde 768px de ancho los links van en la barra; más
// angosto (celular, tablet chica) quedan detrás del botón », que abre un
// panel desde la izquierda (se cierra con «, tocando afuera o con Escape).
import { EDIT_NOTE, INSIGHTS, MENU_ABRIR, MENU_CERRAR } from "./iconos.js";
import { html, poner } from "./piezas.js";

const $ = (id) => document.getElementById(id);

// "cargar" y no "cargar.html": Cloudflare sirve cargar.html en /cargar (y
// redirige el .html).
function links(actual) {
  const link = (href, icono, txt, cual) =>
    html`<a href="${href}"${cual === actual ? html` aria-current="page"` : ""}>${icono}<span data-texto="${txt}">${txt}</span></a>`;
  return html`${link("./", INSIGHTS, "Tablero", "tablero")}${link("cargar", EDIT_NOTE, "Cargar partido", "cargar")}`;
}

export function barra(actual) {
  poner($("barra"), html`<button type="button" class="menu" aria-label="Abrir el menú" aria-expanded="false"
aria-controls="lateral">${MENU_ABRIR}</button><nav class="arriba" aria-label="Páginas">${links(actual)}</nav>
<aside class="lateral" id="lateral" aria-label="Páginas" inert><div class="cab"><button type="button" class="menu cerrar"
aria-label="Cerrar el menú">${MENU_CERRAR}</button></div><nav>${links(actual)}</nav></aside>`);
  const abrir = $("barra").querySelector(".menu"), lateral = $("lateral");
  const cerrar = lateral.querySelector(".cerrar");
  const mostrar = (abierto) => {
    lateral.classList.toggle("abierto", abierto);
    lateral.inert = !abierto;   // cerrado, sus links no se alcanzan con Tab
    abrir.setAttribute("aria-expanded", String(abierto));
  };
  abrir.addEventListener("click", () => {
    mostrar(true);
    lateral.querySelector("a")?.focus();
  });
  cerrar.addEventListener("click", () => {
    mostrar(false);
    abrir.focus();
  });
  // tocar afuera o Escape: se cierra
  document.addEventListener("pointerdown", (e) => {
    if (lateral.classList.contains("abierto") && !lateral.contains(e.target) && !abrir.contains(e.target)) mostrar(false);
  });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && lateral.classList.contains("abierto")) {
      mostrar(false);
      abrir.focus();
    }
  });
}

export function encabezado(sub) {
  poner($("enc"), html`<img src="img/escudo.png" alt=""><div><div class="t">Universitario Rugby</div><div class="s">${sub}</div></div>`);
}
