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
import { pestanas } from "./controles.js";
import { tablaDatos } from "./tablas.js";
import { CHEVRON_DER, FLECHA_ABAJO } from "./iconos.js";
import { CONFIG, dibujar, redibujosHechos } from "./graficos.js";
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

  // st.dataframe(df[columnas], height=alto, column_config=config)
  tablaDatos(columnas, filas, alto, config) {
    this.anotar({ f: "dataframe", columnas: [...columnas], filas: structuredClone(filas), alto, column_config: structuredClone(config) });
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
// Los gráficos de una pestaña interna escondida, hasta que se la muestre.
const esperando = new WeakMap();

// Los gráficos que Plotly todavía está dibujando (dibujar() es asíncrono).
const pendientes = new Set();
// (y los que se vuelven a dibujar porque llegó una letra: graficos.js)
export const todoDibujado = () => Promise.all([...pendientes, redibujosHechos()]);

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
    const ahora = () => {
      // si Plotly falla, a la consola (las pruebas de pantalla la miran)
      const p = dibujar(div, fig).catch((e) => console.error("No se pudo dibujar un gráfico:", e));
      pendientes.add(p);
      p.finally(() => pendientes.delete(p));
    };
    // en una pestaña interna que no se ve, o en un desplegable cerrado
    const oculto = div.closest("[hidden], details:not([open])");
    if (oculto) esperando.set(oculto, [...(esperando.get(oculto) ?? []), ahora]);
    else ahora();
  }

  // Como Streamlit: cada columna arranca en su parte del ancho menos el
  // espacio entre columnas, y crecen todas por igual hasta llenar la fila
  // (ver tablero.css). En una variable y no en width: en la tablet parada el
  // CSS las pone a todo el ancho.
  columnas(spec, gap = null) {
    super.columnas(spec, gap);   // (lo anota; sus hijos no dibujan)
    const pesos = pesosDe(spec), total = pesos.reduce((s, x) => s + x, 0);
    const esp = ESPACIO[gap] ?? 1;
    // el porcentaje con 4 decimales, como lo escribe Streamlit (33.3333%)
    const fila = this.poner(html`<div class="columnas" style="gap:${esp}rem">${pesos.map((p) =>
      html`<div style="--ancho:calc(${porcentajeCss(p / total)}% - ${esp}rem)"></div>`)}</div>`);
    return [...fila.children].map((c) => new EnPagina(c, this.llamadas));
  }

  contenedor() {
    super.contenedor();
    return new EnPagina(this.poner(html`<div class="bloque"></div>`), this.llamadas);
  }

  // Pestañas internas (ej. Line / Scrum / Salidas): el Python dibuja las tres
  // de una; acá se anota todo en el orden del Python, pero el gráfico de una
  // pestaña escondida espera a que se la muestre (Plotly, en un lugar
  // escondido, dibuja con ancho 0).
  pestanas(rotulos) {
    super.pestanas(rotulos);
    const cont = this.poner(html`<div class="internas"></div>`);
    pestanas(cont, rotulos, (i, panel) => {
      for (const f of esperando.get(panel) ?? []) f();
      esperando.delete(panel);
    });
    return [...cont.querySelectorAll('[role="tabpanel"]')].map((p) => new EnPagina(p, this.llamadas));
  }

  // st.dataframe(...): una tabla que se puede ordenar tocando la columna
  tablaDatos(columnas, filas, alto, config) {
    super.tablaDatos(columnas, filas, alto, config);
    const div = this.poner(html`<div class="datos"></div>`);
    tablaDatos(div, columnas, filas, alto, config);
  }

  // st.expander(rotulo): cerrado al empezar, como en Streamlit
  desplegable(rotulo) {
    super.desplegable(rotulo);
    const d = this.poner(html`<details class="expander"><summary><span class="ico cerrado">${CHEVRON_DER}</span><span class="ico abierto">${
      FLECHA_ABAJO}</span><span class="rot">${rotulo}</span></summary><div class="cuerpo"></div></details>`);
    // un gráfico adentro, cerrado, espera a que se lo abra (como en una pestaña escondida)
    d.addEventListener("toggle", () => {
      if (!d.open) return;
      for (const f of esperando.get(d) ?? []) f();
      esperando.delete(d);
    });
    return new EnPagina(d.querySelector(".cuerpo"), this.llamadas);
  }
}
