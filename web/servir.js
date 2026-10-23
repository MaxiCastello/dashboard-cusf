// Servidor local para probar el tablero con las MISMAS cabeceras que pone
// Cloudflare Pages (las lee de sitio/_headers): así un problema de la CSP se
// ve acá y no recién publicado. Sólo escucha en 127.0.0.1 y sólo sirve lo
// que está en sitio/ (lo mismo que publica Cloudflare).
// Comprime los textos con brotli, como Cloudflare (Plotly baja de 5 MB a
// ~1,1 MB): sin eso, medir la velocidad acá no se parecería a la real.
// Uso: node servir.js [puerto]   (por defecto 8600)
import { createServer } from "node:http";
import { readFileSync, realpathSync, statSync } from "node:fs";
import { basename, extname, join, normalize, resolve, sep } from "node:path";
import process from "node:process";
import { brotliCompressSync } from "node:zlib";

const RAIZ = resolve(import.meta.dirname, "sitio");
const PUERTO = Number(process.argv[2] ?? 8600);
const TIPOS = {
  ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8", ".json": "application/json; charset=utf-8",
  ".png": "image/png", ".woff2": "font/woff2", ".txt": "text/plain; charset=utf-8",
};

// _headers: un renglón sin sangría es una ruta (con * como comodín), los
// renglones con sangría "Nombre: valor" son sus cabeceras. Si varias rutas
// coinciden se aplican todas, como en Cloudflare: y si dos ponen la misma
// cabecera, los valores se juntan con una coma (también como en Cloudflare).
function leerCabeceras() {
  const reglas = [];
  for (const crudo of readFileSync(join(RAIZ, "_headers"), "utf8").split(/\r?\n/)) {
    const r = crudo.replace(/\s+$/, "");
    if (!r.trim() || r.trim().startsWith("#")) continue;
    if (!/^\s/.test(r)) {
      const patron = r.replace(/[.+?^${}()|[\]\\]/g, "\\$&").replaceAll("*", ".*");
      reglas.push({ re: new RegExp(`^${patron}$`), cab: [] });
    } else {
      const i = r.indexOf(":");
      if (i < 0 || !reglas.length) throw new Error(`_headers: renglón raro: ${r}`);
      reglas.at(-1).cab.push([r.slice(0, i).trim(), r.slice(i + 1).trim()]);
    }
  }
  return reglas;
}

// Comprimir Plotly tarda: se guarda la última versión de cada archivo hasta
// que cambie (una sola por archivo: la vieja se reemplaza).
const yaComprimidos = new Map();
function comprimido(archivo, cuerpo) {
  const fecha = statSync(archivo).mtimeMs;
  const guardado = yaComprimidos.get(archivo);
  if (guardado?.fecha === fecha) return guardado.br;
  const br = brotliCompressSync(cuerpo);
  yaComprimidos.set(archivo, { fecha, br });
  return br;
}

// Windows no distingue mayúsculas e ignora puntos y espacios al final
// (/_HEADERS, /_headers. encuentran _headers): sólo vale si el nombre pedido
// es exactamente el del archivo. Y _headers / _redirects los lee Cloudflare:
// no se publican.
function publicable(archivo) {
  return archivo.startsWith(RAIZ + sep) && statSync(archivo).isFile() &&
    realpathSync.native(archivo) === archivo && !["_headers", "_redirects"].includes(basename(archivo));
}

createServer((pedido, resp) => {
  let reglas;
  try {
    reglas = leerCabeceras();   // se relee en cada pedido: cambiar _headers no pide reiniciar
  } catch (e) {   // _headers mal escrito: se avisa y el servidor sigue andando
    resp.writeHead(500, { "Content-Type": "text/plain; charset=utf-8" }).end(String(e.message));
    return;
  }
  let ruta = "", archivo = "", ok;
  try {
    ruta = decodeURIComponent(new URL(pedido.url, "http://x").pathname);
    if (ruta.endsWith("/")) ruta += "index.html";
    archivo = normalize(join(RAIZ, ruta));
    ok = publicable(archivo);
  } catch {   // %zz en la dirección, o el archivo no existe
    ok = false;
  }
  const visible = ruta.replace(/\/index\.html$/, "/");
  const cabeceras = new Map();
  for (const { re, cab } of reglas) {
    if (!re.test(visible) && !re.test(ruta)) continue;
    for (const [k, v] of cab) cabeceras.set(k.toLowerCase(), [...(cabeceras.get(k.toLowerCase()) ?? []), v]);
  }
  for (const [k, vs] of cabeceras) resp.setHeader(k, vs.join(", "));
  if (!ok) {
    resp.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" }).end("No existe");
    return;
  }
  const tipo = TIPOS[extname(archivo)] ?? "application/octet-stream";
  let cuerpo = readFileSync(archivo);
  resp.setHeader("Vary", "Accept-Encoding");
  if (/^(text\/|application\/json)/.test(tipo) && /\bbr\b/.test(pedido.headers["accept-encoding"] ?? "")) {
    cuerpo = comprimido(archivo, cuerpo);
    resp.setHeader("Content-Encoding", "br");
  }
  resp.writeHead(200, { "Content-Type": tipo, "Content-Length": cuerpo.length });
  resp.end(cuerpo);
}).listen(PUERTO, "127.0.0.1", () => console.log(`http://127.0.0.1:${PUERTO}/`));
