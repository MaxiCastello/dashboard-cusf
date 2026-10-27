// La base de Supabase (cusf/fuente.py): las mismas consultas, con la clave
// pública. La clave es pública a propósito: lo que cada uno puede leer o
// escribir lo decide la base (RLS), no esta clave. Escribir sólo puede un
// admin, con el token de su usuario de Uni-Dat (CARGAR PARTIDO).

import { entero, esVerdad, leerJson, minuscula, recortar, str } from "./python.js";

export const URL_BASE = "https://yrxsqrfjqyoicohsfrrt.supabase.co";
const CLAVE = "sb_publishable_qmd1XRbPJ5Ej7i08ZUZq_g__Vn7_2PZ";
const TIEMPO_MS = 15000;

export class ErrorBase extends Error {
  // codigo: el estado HTTP (null si ni siquiera hubo respuesta); detalle:
  // el código de error de Supabase. No se muestran: el mensaje sí.
  constructor(msg, codigo = null, detalle = "") {
    super(msg);
    this.codigo = codigo;
    this.detalle = detalle;
  }
}

// Como timeout=15 de requests en el Python: corta si la base tarda 15 s en
// contestar, o si mientras baja la respuesta pasan 15 s sin que llegue nada.
// Una conexión lenta pero que avanza no se corta (la lista de partidos pesa
// cientos de KB). Devuelve [respuesta, texto del cuerpo].
async function bajar(url, opciones) {
  const control = new AbortController();
  let reloj;
  const darCuerda = () => {
    clearTimeout(reloj);
    reloj = setTimeout(() => control.abort(), TIEMPO_MS);
  };
  darCuerda();
  try {
    const r = await fetch(url, { ...opciones, signal: control.signal });
    let texto = "";
    if (r.body) {
      const lector = r.body.getReader();
      const deco = new TextDecoder();
      for (;;) {
        darCuerda();
        const { done, value } = await lector.read();
        if (done) break;
        texto += deco.decode(value, { stream: true });
      }
      texto += deco.decode();
    }
    return [r, texto];
  } finally {
    clearTimeout(reloj);
  }
}

// _pedir() de fuente.py. Sin token, con la clave pública (leer); con el
// token del admin, como él (escribir: la base decide si puede). `json` es lo
// que se manda. Devuelve la respuesta ya leída (null si vino vacía, como
// `Prefer: return=minimal`).
async function pedir(ruta, { metodo = "GET", token = null, json, cabeceras = {} } = {}) {
  const opciones = {
    method: metodo,
    headers: { apikey: CLAVE, Authorization: "Bearer " + (token ?? CLAVE), ...cabeceras },
  };
  if (json !== undefined) {
    opciones.headers["Content-Type"] = "application/json";
    opciones.body = JSON.stringify(json);
  }
  let r, cuerpo;
  try {
    [r, cuerpo] = await bajar(URL_BASE + ruta, opciones);
  } catch {
    const e = new ErrorBase("No se pudo conectar con la base. Revisá la conexión y probá de nuevo.");
    e.sinRespuesta = true;   // el pedido pudo haber llegado y la respuesta no
    throw e;
  }
  if (r.ok) {
    if (metodo !== "GET" && !cuerpo.trim()) return null;
    try {
      // leerJson y no JSON.parse: sin perder el orden de las claves (python.js)
      return leerJson(cuerpo);
    } catch {
      throw new ErrorBase("La base contestó algo que no se entiende. Probá de nuevo en un rato.", r.status);
    }
  }
  let detalle = "";
  try {
    const j = JSON.parse(cuerpo);
    if (j && typeof j === "object" && !Array.isArray(j)) {
      // es un código (se le muestra al usuario): sólo letras, números, _ . -
      detalle = String([j.error_code, j.error, j.code].find(Boolean) ?? "").replace(/[^\p{L}\p{N}_.-]/gu, "").slice(0, 40);
    }
  } catch {
    // la respuesta no era JSON: queda sin detalle
  }
  if (r.status === 401 || r.status === 403) {
    throw new ErrorBase("La sesión venció o no tenés permiso. Volvé a ingresar.", r.status, detalle);
  }
  if (r.status === 404 && detalle === "PGRST205") throw new ErrorBase("TABLA_MANUALES", 404, detalle);
  throw new ErrorBase(`La base rechazó el pedido (${r.status}).`, r.status, detalle);
}

// main:stats->main: los escudos (imágenes en base64) no hacen falta. Los
// borrados ya los esconde la base a quien lee sin usuario; el filtro es por
// las dudas.
export function filasUnidat() {
  return pedir("/rest/v1/partidos?select=id,rival,categoria,fecha,score_uni," +
    "score_rival,main:stats->main,tackles&borrado_en=is.null&order=fecha.asc");
}

// [filas, hayTabla]: si todavía no se corrió el SQL de la tabla, no es un error.
export async function filasManuales() {
  try {
    return [await pedir("/rest/v1/partidos_manuales?select=*&borrado_en=is.null&order=fecha.asc"), true];
  } catch (e) {
    if (e instanceof ErrorBase && e.message === "TABLA_MANUALES") return [[], false];
    throw e;
  }
}

// ── Escritura (sólo admins) ──────────────────────────────────────────────────

const ahora = () => Date.now() / 1000;

function sesionDe(d) {
  if (!d || typeof d !== "object" || !d.access_token) throw new ErrorBase("No se pudo ingresar. Probá de nuevo en un rato.");
  const dura = entero(d.expires_in);   // int(expires_in or 3600)
  return { token: String(d.access_token), refresh: d.refresh_token ?? null, vence: ahora() + (dura === 0 ? 3600 : dura) };
}

// Login con el usuario de Uni-Dat (igual que nube.js: el mail en
// minúsculas). Devuelve la sesión {token, refresh, vence} si es admin. Los
// mensajes no dicen si el mail existe.
export async function ingresar(email, clave) {
  const mail = minuscula(recortar(str(email ?? "")));
  if (!mail || !clave) throw new ErrorBase("Completá el mail y la contraseña.");
  let ses;
  try {
    ses = sesionDe(await pedir("/auth/v1/token?grant_type=password", { metodo: "POST", json: { email: mail, password: clave } }));
  } catch (e) {
    // sin conexión, o una respuesta que no se entiende: el mensaje ya lo dice
    if (!(e instanceof ErrorBase) || e.codigo === null || e.codigo < 400) throw e;
    // (con su código: la página cuenta los intentos que la base rechazó)
    if (e.codigo === 429 || e.detalle.includes("rate")) throw new ErrorBase("Demasiados intentos: esperá unos minutos.", e.codigo);
    if (["invalid_credentials", "invalid_grant"].includes(e.detalle)) throw new ErrorBase("Mail o contraseña incorrectos.", e.codigo);
    if (e.detalle === "email_not_confirmed") throw new ErrorBase("Ese mail todavía no está confirmado en Supabase.", e.codigo);
    throw new ErrorBase(`No se pudo ingresar (error ${e.codigo}). Probá de nuevo en un rato.`, e.codigo);
  }
  // La tabla admins sólo le deja ver a cada uno su propia fila: si vuelve una, es admin.
  let esAdmin;
  try {
    esAdmin = esVerdad(await pedir("/rest/v1/admins?select=user_id", { token: ses.token }));
  } catch (e) {
    if (!(e instanceof ErrorBase)) throw e;
    throw new ErrorBase(`No se pudo comprobar si el usuario es admin (error ${e.codigo ?? "de conexión"}` +
      `${e.detalle ? " " + e.detalle : ""}). Probá de nuevo en un rato.`, e.codigo);
  }
  if (!esAdmin) {
    salir(ses);
    throw new ErrorBase("Ese usuario no es admin.", 403);
  }
  return ses;
}

// La sesión de Supabase dura 1 hora: antes de que venza (5 minutos antes) se
// pide otra con el refresh token, así una carga larga no se pierde al guardar.
export async function renovar(ses) {
  if (ses.vence - ahora() > 300 || !ses.refresh) return ses;
  try {
    return sesionDe(await pedir("/auth/v1/token?grant_type=refresh_token", { metodo: "POST", json: { refresh_token: ses.refresh } }));
  } catch (e) {
    if (!(e instanceof ErrorBase)) throw e;
    throw new ErrorBase("La sesión venció. Volvé a ingresar.");
  }
}

// SALIR: además de olvidarla en el navegador, la sesión se cierra en
// Supabase (su refresh token deja de servir). Si no se puede (sin conexión),
// igual se olvida: el token vence solo en una hora.
export function salir(ses) {
  pedir("/auth/v1/logout?scope=local", { metodo: "POST", token: ses.token }).catch(() => {});
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

// el id va en la URL: si no es un uuid, no se manda nada
function idValido(x) {
  if (typeof x !== "string" || !UUID.test(x)) throw new ErrorBase("Partido inválido.");
  return x;
}

const MINIMO = { Prefer: "return=minimal" };

// Un partido nuevo (POST) o la corrección de uno (PATCH, por su id).
export async function guardarManual(token, fila, idExistente = null) {
  if (idExistente) {
    await pedir(`/rest/v1/partidos_manuales?id=eq.${idValido(idExistente)}`, { metodo: "PATCH", token, json: fila, cabeceras: MINIMO });
  } else {
    await pedir("/rest/v1/partidos_manuales", { metodo: "POST", token, json: fila, cabeceras: MINIMO });
  }
}

// Borrar = marcarlo: se oculta enseguida y la base lo elimina a los 7 días.
export async function borrarManual(token, id) {
  await pedir(`/rest/v1/partidos_manuales?id=eq.${idValido(id)}`,
    // la hora en UTC (con la Z) es justo lo que va: la base guarda el momento, no una fecha
    // eslint-disable-next-line no-restricted-syntax
    { metodo: "PATCH", token, json: { borrado_en: new Date().toISOString() }, cabeceras: MINIMO });
}
