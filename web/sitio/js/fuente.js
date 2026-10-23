// Lectura de la base de Supabase (cusf/fuente.py): las mismas consultas, con
// la clave pública. La clave es pública a propósito: lo que cada uno puede
// leer o escribir lo decide la base (RLS), no esta clave.
//
// FASE 1: sólo lectura. El login y la carga se pasan en la fase 7.

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

async function pedir(ruta) {
  let r, cuerpo;
  try {
    [r, cuerpo] = await bajar(URL_BASE + ruta, { headers: { apikey: CLAVE, Authorization: "Bearer " + CLAVE } });
  } catch {
    throw new ErrorBase("No se pudo conectar con la base. Revisá la conexión y probá de nuevo.");
  }
  if (r.ok) {
    try {
      return JSON.parse(cuerpo);
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
