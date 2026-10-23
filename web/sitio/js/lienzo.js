// Dónde dibujan las pestañas (vistas.js). Tiene las mismas operaciones que
// usa vistas.py de Streamlit: un título (### ...), un pedazo de HTML, un
// gráfico, columnas, un contenedor, pestañas internas, un desplegable
// (expander).
//
// Registro sólo anota cada operación, con la misma forma con que
// exportar_referencia.py anotó las de Streamlit: así las pruebas comparan
// cada pestaña, operación por operación, con lo que hace hoy el Python
// (pruebas/exportar_secciones.py). EnPagina además la dibuja en la página
// (y anota lo mismo: las pruebas de pantalla lo leen).
import { porcentajeCss } from "./formato.js";
import { CONFIG, dibujar } from "./graficos.js";
import { html, poner } from "./piezas.js";

export class Registro {
  constructor(llamadas = []) {
    this.llamadas = llamadas;
  }

  anotar(x) {
    this.llamadas.push(x);
  }

  // Un hijo que anota en la misma lista (como dibujar dentro de una columna).
  hijo() {
    return new Registro(this.llamadas);
  }

  // st.markdown("### Título")
  titulo(txt) {
    this.anotar({ f: "markdown", cuerpo: `### ${txt}`, html: false });
  }

  // st.markdown(h, unsafe_allow_html=True); h sale de html`...` (piezas.js)
  html(h) {
    this.anotar({ f: "markdown", cuerpo: String(h), html: true });
  }

  // grafico() de estilo.py; una figura null (dona sin nada) no se dibuja
  grafico(fig) {
    if (fig === null) return;
    this.anotar({ f: "plotly_chart", fig: structuredClone(fig), config: { ...CONFIG }, theme: null });
  }

  // st.columns(spec, gap=...): spec es un número (columnas iguales) o los pesos
  columnas(spec, gap = null) {
    this.anotar({ f: "columns", spec, gap });
    return pesosDe(spec).map(() => this.hijo());
  }

  // st.container()
  contenedor() {
    this.anotar({ f: "container", args: [], key: null, type: null });
    return this.hijo();
  }

  // st.tabs(rotulos): uno por pestaña
  pestanas(rotulos) {
    this.anotar({ f: "tabs", rotulos: [...rotulos] });
    return rotulos.map(() => this.hijo());
  }

  // st.expander(rotulo)
  desplegable(rotulo) {
    this.anotar({ f: "expander", args: [rotulo], key: null, type: null });
    return this.hijo();
  }
}

const pesosDe = (spec) => (typeof spec === "number" ? Array(spec).fill(1) : spec);

// Espacio entre columnas (Streamlit 1.55): "large" 4rem, si no 1rem.
const ESPACIO = { large: 4, medium: 2.5, small: 1 };

// Lo mismo, dibujado en `el` (un elemento con las piezas una abajo de la otra).
// Los gráficos que Plotly todavía está dibujando (dibujar() es asíncrono).
const pendientes = new Set();
export const todoDibujado = () => Promise.all([...pendientes]);

// Lo que se anotó al dibujar en cada elemento (para las pruebas de pantalla:
// prueba_fase4.py lo compara con el Python).
export const anotadas = new WeakMap();

export class EnPagina extends Registro {
  constructor(el, llamadas = []) {
    super(llamadas);
    this.el = el;
    if (!anotadas.has(el)) anotadas.set(el, llamadas);
  }

  poner(h) {
    const div = document.createElement("div");
    poner(div, h);
    const nodo = div.firstElementChild ?? div;
    this.el.append(nodo);
    return nodo;
  }

  titulo(txt) {
    super.titulo(txt);
    this.poner(html`<h3>${txt}</h3>`);
  }

  html(h) {
    super.html(h);
    this.poner(html`<div class="md">${h}</div>`);
  }

  grafico(fig) {
    if (fig === null) return;
    super.grafico(fig);
    const div = this.poner(html`<div class="grafico"></div>`);
    // si Plotly falla, a la consola (las pruebas de pantalla la miran)
    const p = dibujar(div, fig).catch((e) => console.error("No se pudo dibujar un gráfico:", e));
    pendientes.add(p);
    p.finally(() => pendientes.delete(p));
  }

  // Como Streamlit: cada columna arranca en su parte del ancho menos el
  // espacio entre columnas, y crecen todas por igual hasta llenar la fila
  // (ver tablero.css). En una variable y no en width: en la tablet parada el
  // CSS las pone a todo el ancho.
  columnas(spec, gap = null) {
    this.anotar({ f: "columns", spec, gap });
    const pesos = pesosDe(spec), total = pesos.reduce((s, x) => s + x, 0);
    const esp = ESPACIO[gap] ?? 1;
    // el porcentaje con 4 decimales, como lo escribe Streamlit (33.3333%)
    const fila = this.poner(html`<div class="columnas" style="gap:${esp}rem">${pesos.map((p) =>
      html`<div style="--ancho:calc(${porcentajeCss(p / total)}% - ${esp}rem)"></div>`)}</div>`);
    return [...fila.children].map((c) => new EnPagina(c, this.llamadas));
  }

  contenedor() {
    this.anotar({ f: "container", args: [], key: null, type: null });
    return new EnPagina(this.poner(html`<div class="bloque"></div>`), this.llamadas);
  }

  // (las pestañas internas y el desplegable se dibujan desde la pestaña
  // PARTIDOS y PENALES de la fase 4: hasta entonces, que no pase en silencio)
  pestanas() {
    throw new Error("EnPagina.pestanas(): todavía no");
  }

  desplegable() {
    throw new Error("EnPagina.desplegable(): todavía no");
  }
}
