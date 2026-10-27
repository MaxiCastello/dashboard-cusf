// CARGAR PARTIDO (cusf/cargar.py): sólo para los admins de Uni-Dat. Ingresar,
// y después cargar un partido nuevo, corregir o borrar uno cargado a mano,
// o sumarle a uno de Uni-Dat las chances en 22 y corregirle las tarjetas.
//
// Lo que se hace con lo escrito (validar, armar la fila, el aviso) está en
// carga.js; acá, la pantalla. El permiso lo controla la base: la página
// sólo pasa el token del usuario que ingresó.
//
// La sesión se guarda en sessionStorage: sobrevive a recargar la página,
// pero se borra al cerrar la pestaña. Dura 1 hora y se renueva sola antes de
// cada escritura (renovar() de fuente.js).
import { desdeManual, etiqueta, partidosBase, SITUACIONES } from "./calculos.js";
import * as K from "./carga.js";
import { desplegable, radios } from "./controles.js";
import { borrarManual, ErrorBase, filasManuales, filasUnidat, guardarManual, ingresar, renovar, salir } from "./fuente.js";
import { CHEVRON_DER, FLECHA_ABAJO } from "./iconos.js";
import { barra, encabezado } from "./marco.js";
import { html, poner } from "./piezas.js";

const $ = (id) => document.getElementById(id);

const ACCIONES = [["nuevo", "Partido nuevo"], ["corregir", "Corregir o borrar"], ["complemento", "Chances en 22 y tarjetas (Uni-Dat)"]];
const SESION = "cusf-sesion", INTENTOS = "cusf-intentos";
const MAX_INTENTOS = 5, VENTANA = 600;   // 5 intentos cada 10 minutos, como cargar.py

const estado = {
  partidos: [], filas: [], sesion: null,
  aviso: null,                // [tipo, texto] de la última carga (se ve una vez)
  accion: "nuevo", corregir: null, complemento: null,
};

// ── sessionStorage (puede no andar: modo privado, bloqueado) ─────────────────

function leerGuardado(clave) {
  try {
    return JSON.parse(sessionStorage.getItem(clave));
  } catch {
    return null;
  }
}

function guardar(clave, valor) {
  try {
    if (valor === null) sessionStorage.removeItem(clave);
    else sessionStorage.setItem(clave, JSON.stringify(valor));
  } catch {
    // sin sessionStorage: la sesión dura lo que dure la página abierta
  }
}

function sesionGuardada() {
  const s = leerGuardado(SESION);
  return s && typeof s.token === "string" && typeof s.vence === "number" ? s : null;
}

function olvidar() {
  estado.sesion = null;
  guardar(SESION, null);
}

const ahora = () => Date.now() / 1000;

// Una acción a la vez (ingresar, guardar, borrar): un segundo toque mientras
// la primera sigue (por ejemplo, leyendo el CSV) no hace nada, y mientras
// tanto no se puede tocar nada más (ni SALIR, ni cambiar de acción o de
// partido: lo que conteste la base tiene que verse donde se tocó). Así un
// doble clic no guarda dos veces.
let ocupado = false;
async function unaVez(f) {
  if (ocupado) return;
  ocupado = true;
  caja().inert = true;
  try {
    await f();
  } finally {
    ocupado = false;
    caja().inert = false;
  }
}
function intentosRecientes() {
  const t = leerGuardado(INTENTOS);
  return (Array.isArray(t) ? t : []).filter((x) => typeof x === "number" && ahora() - x < VENTANA);
}

// La sesión, renovada si está por vencer. Si no se puede, hay que volver a
// ingresar (como un 401).
async function vigente() {
  try {
    const s = await renovar(estado.sesion);
    if (s !== estado.sesion) {
      estado.sesion = s;
      guardar(SESION, s);
    }
    return s;
  } catch (e) {
    if (!(e instanceof ErrorBase)) throw e;
    throw new ErrorBase(e.message, 401);
  }
}

// ── La base ──────────────────────────────────────────────────────────────────

// Lee los partidos de Uni-Dat y los cargados a mano. Devuelve si existe la
// tabla de los manuales.
async function leer() {
  const [unidat, [manuales, hayTabla]] = await Promise.all([filasUnidat(), filasManuales()]);
  estado.partidos = partidosBase(unidat, manuales);
  estado.filas = manuales;
  return hayTabla;
}

// ── Pantallas ────────────────────────────────────────────────────────────────

const caja = () => $("carga");

function soloAviso(clase, texto) {
  poner(caja(), html`<div class="aviso ${clase}" role="alert">${texto}</div>`);
}

const cajaError = (txt) => html`<div class="aviso error" role="alert"${txt ? "" : html` hidden`}>${txt ?? ""}</div>`;

function mostrarErrores(el, errores) {
  poner(el, html`${errores.map((e) => html`<p>${e}</p>`)}`);
  el.hidden = false;
  el.scrollIntoView({ block: "nearest" });
}

function login(error = null) {
  poner(caja(), html`<form class="formulario" id="login" novalidate>
<p>Ingresá con tu usuario de admin de Uni-Dat.</p>
<label class="campo"><span class="rotulo">Mail</span><input type="email" name="mail" maxlength="120" autocomplete="username"
autocapitalize="none" spellcheck="false" required></label>
<label class="campo"><span class="rotulo">Contraseña</span><input type="password" name="clave" maxlength="120"
autocomplete="current-password" required></label>
<div class="botones"><button type="submit" class="boton primario">Ingresar</button></div>
</form>${cajaError(error)}`);
  const form = $("login"), boton = form.querySelector("button"), err = caja().querySelector(".aviso.error");
  form.addEventListener("submit", (e) => {
    e.preventDefault();
    unaVez(() => entrar(form, boton, err));
  });
}

async function entrar(form, boton, err) {
  const intentos = intentosRecientes();
  if (intentos.length >= MAX_INTENTOS) {
    mostrarErrores(err, ["Demasiados intentos. Esperá unos minutos."]);
    return;
  }
  boton.disabled = true;
  boton.textContent = "Ingresando…";
  err.hidden = true;
  try {
    estado.sesion = await ingresar(form.elements.mail.value, form.elements.clave.value);
    guardar(SESION, estado.sesion);
    guardar(INTENTOS, []);
    adentro();
  } catch (ex) {
    // cuenta lo que la base rechazó (no un corte de la conexión ni los campos vacíos)
    if (ex instanceof ErrorBase && ex.codigo !== null) guardar(INTENTOS, [...intentos, ahora()]);
    mostrarErrores(err, [ex instanceof ErrorBase ? ex.message : "No se pudo ingresar. Probá de nuevo en un rato."]);
    if (!(ex instanceof ErrorBase)) console.error(ex);
    boton.disabled = false;
    boton.textContent = "Ingresar";
  }
}

// Ya ingresó: SALIR, el aviso de la última carga y las tres acciones.
function adentro() {
  const aviso = estado.aviso;
  estado.aviso = null;    // como st.session_state.pop("aviso"): se ve una vez
  poner(caja(), html`<div class="botones"><button type="button" class="boton" id="salir">Salir</button></div>${
    aviso ? html`<div class="aviso ${aviso[0]}" role="status" id="aviso-carga">${aviso[1]}</div>` : ""}
<div role="radiogroup" aria-labelledby="r-accion"><p class="rotulo" id="r-accion">Qué querés hacer</p><div class="radios" id="acciones"></div></div>
<div class="accion" id="accion"></div>`);
  $("salir").addEventListener("click", () => {
    if (estado.sesion) salir(estado.sesion);
    olvidar();
    login();
  });
  radios($("acciones"), ACCIONES, estado.accion, (a) => {
    estado.accion = a;
    $("aviso-carga")?.remove();
    accion();
  });
  accion();
  // el aviso queda arriba y el botón que se tocó estaba abajo: se lleva a la vista
  if (aviso) $("aviso-carga").scrollIntoView({ block: "center" });
}

function accion() {
  const cont = $("accion");
  if (estado.accion === "nuevo") formularioPartido(cont, null);
  else if (estado.accion === "corregir") corregir(cont);
  else complemento(cont);
}

// Una escritura: con la sesión vigente; si sale bien, el aviso, se vuelve a
// leer la base y se arma todo de nuevo (como el st.rerun() de cargar.py:
// el formulario de un partido nuevo queda vacío y un segundo clic no lo
// duplica). Si la base dice que la sesión no sirve, a ingresar de nuevo.
async function escribir(boton, err, hacer, aviso) {
  const rotulo = boton.textContent;
  boton.disabled = true;
  boton.textContent = "Guardando…";
  err.hidden = true;
  try {
    await hacer((await vigente()).token);
  } catch (e) {
    if (!(e instanceof ErrorBase)) {
      console.error(e);
      mostrarErrores(err, ["No se pudo guardar. Probá de nuevo."]);
    } else if (e.codigo === 403 && e.detalle === "42501") {
      // la base no deja escribir esa fila (permisos): la sesión sirve, el formulario queda
      mostrarErrores(err, ["La base no dejó guardar esto (no tenés permiso). No se guardó nada."]);
    } else if (e.codigo === 401 || e.codigo === 403) {
      olvidar();
      login(e.message);
      return;
    } else if (e.sinRespuesta) {
      // se cortó: puede que el pedido haya llegado y la respuesta no
      mostrarErrores(err, [e.message, "Puede que se haya guardado igual: recargá la página y fijate si quedó antes de guardar de nuevo."]);
    } else {
      mostrarErrores(err, [e.message]);
    }
    boton.disabled = false;
    boton.textContent = rotulo;
    return;
  }
  estado.aviso = aviso;
  try {
    await leer();
  } catch (e) {
    // ya se guardó: no se muestra un formulario con lo viejo (otro clic podría duplicarlo)
    poner(caja(), html`<div class="aviso ${aviso[0]}" role="status">${aviso[1]}</div><div class="aviso error" role="alert">${
      e instanceof ErrorBase ? e.message : "No se pudo volver a leer la base."} Recargá la página.</div>`);
    estado.aviso = null;
    return;
  }
  adentro();
}

// ── Las casillas ─────────────────────────────────────────────────────────────

// Una casilla de número: vacía vale 0 (el 0 se ve gris, como guía).
const num = (nombre, rotulo, v) => html`<label class="campo"><span class="rotulo">${rotulo}</span><input name="${nombre}"
inputmode="numeric" autocomplete="off" placeholder="0" value="${v[nombre] === "0" ? "" : v[nombre]}"></label>`;

// (sin maxlength: el navegador cuenta un emoji como 2; el largo lo valida carga.js, como Python)
const texto = (nombre, rotulo, v) => html`<label class="campo"><span class="rotulo">${rotulo}</span><input name="${nombre}"
autocomplete="off" value="${v[nombre]}"></label>`;

// lo escrito en cada casilla (sin el archivo)
const valores = (form) => Object.fromEntries([...new FormData(form)].filter(([, x]) => typeof x === "string"));

// ── Partido nuevo / corregir ─────────────────────────────────────────────────

// fila = null para uno nuevo, o la fila de la base para corregirlo.
function formularioPartido(cont, fila) {
  const v = K.valoresPartido(fila);
  const tk = Array.isArray(fila?.datos?.tackles_registros) ? fila.datos.tackles_registros.length : 0;
  poner(cont, html`<form class="formulario" novalidate>
<h4>Partido</h4>
<div class="grupo g2">${texto("r", "Rival", v)}${texto("c", "Categoría", v)}</div>
<div class="grupo g3"><label class="campo"><span class="rotulo">Fecha</span><input type="date" name="f" value="${v.f}" required></label>${
  num("su", "Puntos UNI", v)}${num("sr", "Puntos rival", v)}</div>
<h4>Cómo se hicieron los puntos</h4>
<div class="grupo g2">${K.LADOS.map(([l, quien]) => html`<div class="lado"><p class="sub">${quien}</p>${
  K.CAMPOS_PUNTOS.map(([c, rot]) => num(c + l, rot, v))}</div>`)}</div>
<h4>Formaciones (las que lanzó cada uno)</h4>
${K.FORMACIONES.map(([tit, clave]) => html`<p class="sub">${tit}</p><div class="grupo g4">${
  K.COLUMNAS_FORMACION.map(([sfx, rot]) => num(clave + sfx, rot, v))}</div>`)}
<h4>Penales cometidos</h4>
<div class="grupo g5">${SITUACIONES.map((s) => html`<div class="lado"><p class="sub">${s}</p><div class="grupo g2">${
  num(`pu${s}`, "UNI", v)}${num(`pr${s}`, "Rival", v)}</div></div>`)}</div>
<h4>Tarjetas y chances en 22</h4>
<div class="grupo g6">${num("amu", "Amarillas UNI", v)}${num("rou", "Rojas UNI", v)}${num("amr", "Amarillas rival", v)}${
  num("ror", "Rojas rival", v)}${num("ch", "Chances en 22", v)}${num("co", "Concretadas", v)}</div>
<h4>Tackles (opcional)</h4>
<label class="campo"><span class="rotulo">CSV del Tackle Tracker</span><input type="file" name="tk" accept=".csv"></label>
${tk ? html`<div class="nota">Ya tiene ${tk} tackles cargados. Subí otro CSV sólo para reemplazarlos.</div>` : ""}
<div class="botones"><button type="submit" class="boton primario">Guardar partido</button></div>
</form>${cajaError(null)}`);
  const form = cont.querySelector("form"), err = cont.querySelector(".aviso.error"), boton = form.querySelector("[type=submit]");
  form.addEventListener("submit", (e) => {
    e.preventDefault();
    unaVez(() => guardarPartido(form, boton, err, fila));
  });
}

async function guardarPartido(form, boton, err, fila) {
  const archivo = form.elements.tk.files[0] ?? null;
  const errores = [];
  let csv = null;
  if (archivo && !/\.csv$/i.test(archivo.name)) errores.push("El archivo de tackles tiene que ser un CSV (el del Tackle Tracker).");
  else if (archivo && archivo.size > K.MAX_CSV) errores.push("El CSV de tackles pesa más de 2 MB: ¿es el del Tackle Tracker?");
  else if (archivo) {
    try {
      csv = new Uint8Array(await archivo.arrayBuffer());
    } catch {
      errores.push("El CSV de tackles no se pudo leer.");
    }
  }
  const r = K.armarPartido(valores(form), fila, csv);
  errores.push(...(r.errores ?? []));
  if (errores.length) {
    mostrarErrores(err, errores);
    return;
  }
  await escribir(boton, err, (token) => guardarManual(token, r.fila, r.id), r.aviso);
}

function corregir(cont) {
  const lista = K.sueltos(estado.filas, desdeManual);
  if (!lista.length) {
    poner(cont, html`<div class="nota">Todavía no hay partidos cargados a mano.</div>`);
    return;
  }
  if (!lista.some(([id]) => id === estado.corregir)) estado.corregir = lista[0][0];
  poner(cont, html`<div class="ver"><label class="rotulo" for="corregir-sel">Partido</label><select id="corregir-sel"></select></div>
<div id="corregir-form"></div>
<details class="expander"><summary><span class="ico cerrado">${CHEVRON_DER}</span><span class="ico abierto">${FLECHA_ABAJO}</span><span
class="rot">Borrar este partido</span></summary><div class="cuerpo">
<div class="nota">Se oculta enseguida y se elimina del todo a los 7 días (igual que en Uni-Dat). Hasta entonces se puede recuperar desde Supabase.</div>
<label class="casilla"><input type="checkbox" id="seguro"><span>Sí, quiero borrarlo</span></label>
<div class="botones"><button type="button" class="boton" id="borrar" disabled>Borrar</button></div>${cajaError(null)}
</div></details>`);
  const elegir = () => {
    const [id, fila] = lista.find(([i]) => i === estado.corregir);
    formularioPartido($("corregir-form"), fila);
    const seguro = $("seguro"), borrar = $("borrar");
    seguro.checked = false;
    borrar.disabled = true;
    seguro.onchange = () => {
      borrar.disabled = !seguro.checked;
    };
    borrar.onclick = () => unaVez(() => escribir(borrar, cont.querySelector(".expander .aviso.error"),
      (token) => borrarManual(token, id), ["ok", "Borrado."]));
  };
  desplegable($("corregir-sel"), lista.map(([id, , et]) => [id, et]), estado.corregir, (id) => {
    estado.corregir = id;
    elegir();
  });
  elegir();
}

// ── Chances en 22 y tarjetas de un partido de Uni-Dat ────────────────────────

function complemento(cont) {
  const unidat = estado.partidos.filter((p) => p.fuente === "unidat");
  const nota = html`<div class="nota">Para un partido ya publicado en Uni-Dat: sumarle las chances en 22 rival (Uni-Dat no las
registra) y agregar o sacar tarjetas si en Uni-Dat quedaron mal.</div>`;
  if (!unidat.length) {
    poner(cont, html`${nota}<div class="nota">No hay partidos de Uni-Dat.</div>`);
    return;
  }
  // el más nuevo primero (si un id se repite, vale el último, en el lugar del primero)
  const porId = new Map();
  for (const p of [...unidat].reverse()) porId.set(p.id, p);
  if (!porId.has(estado.complemento)) estado.complemento = porId.keys().next().value;
  poner(cont, html`${nota}<div class="ver"><label class="rotulo" for="comp-sel">Partido de Uni-Dat</label><select id="comp-sel"></select></div>
<div id="comp-form"></div>`);
  const elegir = () => {
    const p = porId.get(estado.complemento);
    const v = K.valoresComplemento(p), original = K.tarjetasUnidat(p);
    const f = $("comp-form");
    poner(f, html`<form class="formulario" novalidate>
<h4>Chances en 22 rival</h4>
<div class="grupo g2">${num("cch", "Chances en 22", v)}${num("cco", "Concretadas", v)}</div>
<h4>Tarjetas</h4>
<div class="nota">Lo que cargó Uni-Dat: ${K.TARJETAS.map(([k, r]) => `${r} ${original[k]}`).join(" · ")}. Cambiá los números para agregar
o sacar; si quedan iguales, vale lo de Uni-Dat.</div>
<div class="grupo g4">${K.TARJETAS.map(([k, r]) => num(`ct${k}`, r, v))}</div>
<div class="botones"><button type="submit" class="boton primario">Guardar</button></div>
</form>${cajaError(null)}`);
    const form = f.querySelector("form"), err = f.querySelector(".aviso.error"), boton = form.querySelector("[type=submit]");
    form.addEventListener("submit", (e) => {
      e.preventDefault();
      const r = K.armarComplemento(valores(form), p);
      if (r.errores) mostrarErrores(err, r.errores);
      else unaVez(() => escribir(boton, err, (token) => guardarManual(token, r.fila, r.id), r.aviso));
    });
  };
  desplegable($("comp-sel"), [...porId].map(([id, p]) => [id, etiqueta(p)]), estado.complemento, (id) => {
    estado.complemento = id;
    elegir();
  });
  elegir();
}

// ── Arranque ─────────────────────────────────────────────────────────────────

async function arrancar() {
  barra("cargar");
  encabezado("Carga manual · sólo admins");
  let hayTabla;
  try {
    hayTabla = await leer();
  } catch (e) {
    $("cargando").hidden = true;
    caja().hidden = false;
    soloAviso("error", e.message);
    if (!(e instanceof ErrorBase)) console.error(e);
    document.body.dataset.listo = "error";
    return;
  }
  $("cargando").hidden = true;
  caja().hidden = false;
  if (!hayTabla) {
    soloAviso("ojo", "Falta crear la tabla de partidos manuales en Supabase: correr dashboard-cusf.supabase.sql en el SQL " +
      "Editor (está fuera del repo).");
  } else if (!sesionGuardada()) {
    login();
  } else {
    estado.sesion = sesionGuardada();
    try {
      await vigente();
      adentro();
    } catch (e) {
      olvidar();
      login(e instanceof ErrorBase ? e.message : "La sesión venció. Volvé a ingresar.");
    }
  }
  document.body.dataset.listo = "1";   // para las pruebas: ya está todo armado
}

arrancar();
