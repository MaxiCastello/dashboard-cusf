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
// La última pestaña (Informe) arma el PDF: pestana-informe.js.
import { ANIO_PLANILLA, aniosDisponibles, categoriasDe, etiqueta, temporada, TORNEOS, torneo, torneosDe, una } from "./calculos.js";
import { apagarPestanas, desplegable, pestanas, radios } from "./controles.js";
import { EnPagina } from "./lienzo.js";
import { encabezado } from "./marco.js";
import { html, poner } from "./piezas.js";
import { pestanaInforme } from "./pestana-informe.js";
import { PLANILLA_2025 } from "./planilla2025.js";
import { str } from "./python.js";
import * as V from "./vistas.js";

const $ = (id) => document.getElementById(id);

export const PESTANAS_TEMPORADA = ["Resumen", "Partidos", "Puntos", "Formaciones", "Penales", "Tackles", "Objetivos", "Informe"];
// Las pestañas de la temporada ya pasadas (fase 4), en el orden de arriba.
const SECCIONES_TEMPORADA = [V.resumen, V.evolucion, V.puntos, V.formaciones, V.penales, V.tackles, V.objetivos];

// Las de un partido salen de V.SECCIONES_PARTIDO (la misma lista que prueban
// tests/vistas.test.js y fuzz_vistas.py) y el Informe.
export const PESTANAS_PARTIDO = [...V.SECCIONES_PARTIDO.map(([, rotulo]) => rotulo), "Informe"];

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
// contestó (entonces partidos es [] y se ve sólo 2025). Devuelve
// actualizar(): con los partidos leídos de nuevo, se vuelve a armar con lo
// elegido (si sigue existiendo) y en la misma pestaña.
export function tablero({ partidos, errorBase = null }) {
  const aviso = $("aviso");
  function avisar(error) {
    aviso.hidden = !error;
    if (error) aviso.textContent = `${error} Se muestra sólo la temporada 2025.`;
  }
  avisar(errorBase);

  let anios = aniosDisponibles(partidos);
  const estado = { anio: anios[0], cat: null, ver: "temporada" };

  // pestana: la de arriba que se muestra (al tocar un filtro, la primera, como
  // Streamlit; al volver a leer la base, la que estaba)
  function armar(pestana = 0) {
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
    // (no está en el Python) después de "Toda la temporada", los torneos (Copa de Oro)
    const porId = porIdDe(t);
    const torneos = torneosDe(t).map(([id, nombre]) => [`torneo:${id}`, nombre]);
    const opciones = [["temporada", "Toda la temporada"], ...torneos, ...[...porId].reverse().map(([id, p]) => [id, etiqueta(p)])];
    if (estado.ver !== "temporada" && !porId.has(estado.ver) && !torneos.some(([v]) => v === estado.ver)) {
      estado.ver = "temporada";   // ese partido ya no está
      pestana = 0;
    }
    desplegable($("ver"), opciones, estado.ver, seguro((v) => {
      estado.ver = v;
      vista(t);
    }));
    encabezado(sub);
    vista(t, pestana);
  }

  function vista(t, pestana = 0) {
    const cont = $("vista");
    if (estado.ver === "temporada" || estado.ver.startsWith("torneo:")) {
      let cat = estado.cat;
      if (estado.ver !== "temporada") {
        const id = estado.ver.slice("torneo:".length);
        t = torneo(t, id);
        cat = `${str(estado.cat)} · ${TORNEOS.find(([x]) => x === id)[1]}`;
      }
      if (!t.partidos.length && !t.planilla) {
        apagarPestanas(cont);
        poner(cont, html`<div class="aviso info" role="status">Todavía no hay partidos de esta temporada.</div>`);
        return;
      }
      pestanas(cont, PESTANAS_TEMPORADA, seguro((i, panel) => {
        const f = SECCIONES_TEMPORADA[i];
        if (f) f(new EnPagina(panel), t);
        else pestanaInforme(panel, t, cat);
      }), pestana);
      return;
    }
    // un partido: el marcador y abajo sus pestañas (o sólo sus tackles, si
    // es de la planilla 2025)
    const p = porIdDe(t).get(estado.ver);
    apagarPestanas(cont);
    poner(cont, html`<div class="bloque"></div>`);
    const lz = new EnPagina(cont.firstElementChild);
    V.marcador(lz, p);
    if (t.planilla) {
      V.tackles(lz, t, p);
      return;
    }
    const tp = una(p, t);
    // (las pestañas van debajo del marcador; apagarPestanas(cont) también las apaga)
    pestanas(lz.poner(html`<div class="pestanas-partido"></div>`), PESTANAS_PARTIDO, seguro((i, panel) => {
      const f = V.SECCIONES_PARTIDO[i]?.[2];
      if (f) f(new EnPagina(panel), p, t, tp);
      else pestanaInforme(panel, t, estado.cat, p);
    }), pestana);
  }

  $("cargando").hidden = true;
  $("filtros").hidden = false;
  $("caja-ver").hidden = false;
  armar();

  // los años, las categorías y la temporada elegida (2025 sale de la planilla);
  // los Map (orígenes de los tries, plantel) como listas, si no JSON los deja vacíos
  const loQueSeVe = () => JSON.stringify([anios, estado.anio === ANIO_PLANILLA ? null
    : [categoriasDe(partidos, estado.anio), temporada(partidos, estado.anio, estado.cat)]],
  (_, v) => (v instanceof Map ? ["Map", ...v] : v));

  return seguro((nuevos) => {
    const lo = loQueSeVe();
    partidos = nuevos;
    anios = aniosDisponibles(partidos);
    // si al abrir la base no contestaba, 2025 no lo eligió nadie: como al abrir
    const deCero = !aviso.hidden || !anios.includes(estado.anio);
    avisar(null);
    if (deCero) {
      Object.assign(estado, { anio: anios[0], cat: null, ver: "temporada" });
      armar();
      return;
    }
    // si lo que se ve no cambió (el cambio es de otro año o categoría), no se toca
    if (lo === loQueSeVe()) return;
    // la pestaña de arriba elegida (en un partido, la de sus pestañas)
    const fila = $("vista").querySelector(".pestanas-partido [role=tablist]") ?? $("vista").querySelector("[role=tablist]");
    armar(fila ? [...fila.children].findIndex((b) => b.getAttribute("aria-selected") === "true") : 0);
  });
}

// por_id de dashboard.py: el último partido con cada id, en el lugar del primero.
function porIdDe(t) {
  const m = new Map();
  for (const p of t.partidos) m.set(p.id, p);
  return m;
}
