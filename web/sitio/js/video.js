// El video de un partido (nov 2026): un link de YouTube o de Dropbox que
// pega un admin en CARGAR PARTIDO y que el tablero muestra en la pestaña
// Video del partido. En la base va el link tal como quedó aceptado
// (datos.video de partidos_manuales).
//
// El link viene de la base: no se usa tal cual. De YouTube sólo se saca el
// código del video (11 letras) y de Dropbox se arma de nuevo la dirección
// con lo único que hace falta. Cualquier otra cosa no es un video (null):
// así en la página nunca entra una dirección que no sea de esos dos sitios
// (y la CSP de _headers tampoco deja cargar otra).

const YT = /^[A-Za-z0-9_-]{11}$/;
const SITIOS_YT = new Set(["www.youtube.com", "youtube.com", "m.youtube.com", "music.youtube.com", "www.youtube-nocookie.com"]);
const SITIOS_DBX = new Set(["www.dropbox.com", "dropbox.com"]);
// los que hacen falta para abrir un archivo compartido de Dropbox
const PARAMETROS_DBX = ["rlkey", "st"];
export const MAX_LINK = 500;

// Lo escrito -> { sitio: "youtube", id, ver, embed } | { sitio: "dropbox",
// ver, archivo } | null. `ver`: la página del video (para abrirlo aparte).
export function videoDe(x) {
  if (typeof x !== "string") return null;
  let s = x.trim();
  if (!s || s.length > MAX_LINK) return null;
  if (!/^https?:\/\//i.test(s)) s = `https://${s}`;   // pegado sin el https://
  let u;
  try {
    u = new URL(s);
  } catch {
    return null;
  }
  if (u.username || u.password || u.port) return null;
  const sitio = u.hostname.toLowerCase();
  const partes = u.pathname.split("/").filter(Boolean);

  let id = null;
  if (sitio === "youtu.be") id = partes[0];
  else if (SITIOS_YT.has(sitio)) {
    if (partes[0] === "watch") id = u.searchParams.get("v");
    else if (["embed", "live", "shorts", "v"].includes(partes[0])) id = partes[1];
  }
  if (id !== null) {
    if (typeof id !== "string" || !YT.test(id)) return null;
    return {
      sitio: "youtube", id, ver: `https://www.youtube.com/watch?v=${id}`,
      embed: `https://www.youtube-nocookie.com/embed/${id}`,
    };
  }

  if (SITIOS_DBX.has(sitio) && ["scl", "s"].includes(partes[0]) && partes.length >= 3) {
    // cada parte de la ruta, escrita de nuevo (nada de lo pegado pasa sin codificar)
    let ruta;
    try {
      ruta = partes.map((p) => encodeURIComponent(decodeURIComponent(p))).join("/");
    } catch {
      return null;
    }
    const q = new URLSearchParams();
    for (const k of PARAMETROS_DBX) if (u.searchParams.get(k)) q.set(k, u.searchParams.get(k));
    const base = `https://www.dropbox.com/${ruta}?${q}${[...q].length ? "&" : ""}`;
    // dl=0: la página de Dropbox; raw=1: el archivo, para el reproductor
    return { sitio: "dropbox", ver: `${base}dl=0`, archivo: `${base}raw=1` };
  }
  return null;
}

// Lo escrito en la casilla del formulario -> { link, error }. Vacío: sin
// video (link = null). Se guarda la dirección limpia (`ver`).
export function linkEscrito(x) {
  const s = String(x ?? "").trim();
  if (!s) return { link: null, error: null };
  const v = videoDe(s);
  if (!v) {
    return { link: null, error: "Video: tiene que ser un link de YouTube (youtube.com/watch?v=… o youtu.be/…) o de Dropbox (dropbox.com/scl/fi/…)." };
  }
  return { link: v.ver, error: null };
}
