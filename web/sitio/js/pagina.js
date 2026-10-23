// La pantalla del tablero (tablero() de dashboard.py): el encabezado, los
// filtros Temporada / Categoría / Ver y lo que se ve abajo (las pestañas de
// la temporada o las de un partido).
//
// Mismo comportamiento que Streamlit (medido en la fase 3):
// - al entrar: el año más nuevo, su primera categoría (Primera primero) y
//   "Toda la temporada";
// - otro año: la categoría vuelve a la primera y VER a "Toda la temporada"
//   (Streamlit borra lo elegido en un filtro que dejó de mostrarse);
// - otra categoría: VER vuelve a "Toda la temporada";
// - cada cambio arranca otra vez en la primera pestaña.
// Si algo falla al armar (un dato imposible: el Python se cae), no queda la
// pantalla a medias: se esconde todo y se ve el error (fallo()).
//
// FASE 3: el contenido de las pestañas (fases 4 y 5) todavía no está.
import { ANIO_PLANILLA, aniosDisponibles, categoriasDe, etiqueta, temporada } from "./calculos.js";
import { apagarPestanas, desplegable, pestanas, radios } from "./controles.js";
import { EnPagina } from "./lienzo.js";
import { encabezado } from "./marco.js";
import { html, poner } from "./piezas.js";
import { PLANILLA_2025 } from "./planilla2025.js";
import { str } from "./python.js";
import * as V from "./vistas.js";

const $ = (id) => document.getElementById(id);

export const PESTANAS_TEMPORADA = ["Resumen", "Partidos", "Puntos", "Formaciones", "Penales", "Tackles", "Objetivos", "Informe"];
// Las pestañas de la temporada ya pasadas (fase 4), en el orden de arriba.
const SECCIONES_TEMPORADA = [V.resumen, V.evolucion];

export const PESTANAS_PARTIDO = ["Resumen", "1° vs 2° tiempo", "Puntos", "Formaciones", "Penales", "Tackles", "Objetivos",
  "Informe"];

// Algo falló: sólo el mensaje (como el Python, que deja de mostrar el tablero).
export function fallo(err) {
  for (const id of ["aviso", "filtros", "caja-ver", "vista"]) $(id).hidden = true;
  apagarPestanas($("vista"));
  const c = $("cargando");
  c.hidden = false;
  c.className = "aviso error";
  c.setAttribute("role", "alert");
  c.textContent = err.message;
  document.body.dataset.listo = "error";
  console.error(err);
}

// Lo que se hace al tocar un filtro: si falla, fallo().
const seguro = (f) => (...a) => {
  try {
    f(...a);
  } catch (err) {
    fallo(err);
  }
};

// partidos: los de la base (ya armados); errorBase: el mensaje si la base no
// contestó (entonces partidos es [] y se ve sólo 2025).
export function tablero({ partidos, errorBase = null }) {
  const aviso = $("aviso");
  aviso.hidden = !errorBase;
  if (errorBase) aviso.textContent = `${errorBase} Se muestra sólo la temporada 2025.`;

  const anios = aniosDisponibles(partidos);
  const estado = { anio: anios[0], cat: null, ver: "temporada" };

  function armar() {
    let t, sub;
    // en 2025 la columna de Categoría queda vacía, pero queda (como en
    // Streamlit: en el celular, apilada, deja su espacio de 1rem)
    $("filtro-cat").classList.toggle("vacia", estado.anio === ANIO_PLANILLA);
    if (estado.anio === ANIO_PLANILLA) {
      t = PLANILLA_2025;
      sub = "Temporada 2025 · planilla";
    } else {
      const cats = categoriasDe(partidos, estado.anio);
      if (!cats.includes(estado.cat)) estado.cat = cats[0] ?? null;
      radios($("cats"), cats.map((c) => [c, c]), estado.cat, seguro((c) => {
        estado.cat = c;
        estado.ver = "temporada";
        armar();
      }));
      t = temporada(partidos, estado.anio, estado.cat);
      sub = `Temporada ${estado.anio} · ${str(estado.cat)}`;
    }
    radios($("anios"), anios.map((a) => [a, String(a)]), estado.anio, seguro((a) => {
      estado.anio = a;
      estado.cat = null;
      estado.ver = "temporada";
      armar();
    }));

    // VER: del último partido al primero
    const porId = porIdDe(t);
    const opciones = [["temporada", "Toda la temporada"], ...[...porId].reverse().map(([id, p]) => [id, etiqueta(p)])];
    if (!porId.has(estado.ver)) estado.ver = "temporada";
    desplegable($("ver"), opciones, estado.ver, seguro((v) => {
      estado.ver = v;
      vista(t);
    }));
    encabezado(sub);
    vista(t);
  }

  function vista(t) {
    const cont = $("vista");
    if (estado.ver === "temporada") {
      if (!t.partidos.length && !t.planilla) {
        apagarPestanas(cont);
        poner(cont, html`<div class="aviso info" role="status">Todavía no hay partidos de esta temporada.</div>`);
        return;
      }
      pestanas(cont, PESTANAS_TEMPORADA, seguro((i, panel) => {
        const f = SECCIONES_TEMPORADA[i];
        if (f) f(new EnPagina(panel), t);
        else enPreparacion(panel, PESTANAS_TEMPORADA[i]);
      }));
      return;
    }
    const p = porIdDe(t).get(estado.ver);
    if (t.planilla) {   // un partido de la planilla 2025: sólo sus tackles, sin pestañas
      apagarPestanas(cont);
      poner(cont, html`<div class="panel" data-partido-planilla></div>`);
      enPreparacion(cont.firstElementChild, `Tackles · ${p.rival}`);
      return;
    }
    pestanas(cont, PESTANAS_PARTIDO, (i, panel) => enPreparacion(panel, PESTANAS_PARTIDO[i]));
  }

  $("cargando").hidden = true;
  $("filtros").hidden = false;
  $("caja-ver").hidden = false;
  armar();
}

// por_id de dashboard.py: el último partido con cada id, en el lugar del primero.
function porIdDe(t) {
  const m = new Map();
  for (const p of t.partidos) m.set(p.id, p);
  return m;
}

// FASE 3: lugar de lo que se pasa en las fases 4 y 5.
function enPreparacion(panel, que) {
  poner(panel, html`<p class="nota">${que}: en preparación (todavía se ve en el tablero de siempre).</p>`);
}
