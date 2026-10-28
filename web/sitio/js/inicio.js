// Arranque del tablero: lee la base y arma la pantalla. Si la base no
// contesta (o está pausada), como dashboard.py: el aviso y sólo 2025.
import { partidosBase } from "./calculos.js";
import { ErrorBase, filasManuales, filasUnidat } from "./fuente.js";
import { barra } from "./marco.js";
import { fallo, tablero } from "./pagina.js";

// Como la caché de 5 minutos de Streamlit: si la pestaña queda abierta y se
// vuelve a ella después de 5 minutos, se lee la base de nuevo; si algo
// cambió, se vuelve a armar con lo elegido. Sin señal, queda lo que había.
const CADA = 5 * 60 * 1000;

async function leer() {
  const [unidat, [manuales]] = await Promise.all([filasUnidat(), filasManuales()]);
  return [unidat, manuales];
}

// Para saber si algo cambió sin guardar todo el texto (cientos de KB): un
// número de 53 bits sacado del texto (cyrb53).
function huella(txt) {
  let h1 = 0xdeadbeef, h2 = 0x41c6ce57;
  for (let i = 0; i < txt.length; i++) {
    const c = txt.charCodeAt(i);
    h1 = Math.imul(h1 ^ c, 2654435761);
    h2 = Math.imul(h2 ^ c, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return 4294967296 * (2097151 & h2) + (h1 >>> 0);
}

async function arrancar() {
  barra("tablero");
  let filas = null, errorBase = null;
  try {
    filas = await leer();
  } catch (e) {
    if (!(e instanceof ErrorBase)) throw e;   // un dato imposible (ErrorDatos): no se muestra nada
    errorBase = e.message;
  }
  let firma = huella(JSON.stringify(filas));
  const actualizar = tablero({ partidos: filas ? partidosBase(...filas) : [], errorBase });
  document.body.dataset.listo = "1";   // para las pruebas: ya está todo armado

  let leido = Date.now(), leyendo = false, otraVez = false;
  // ya: sin esperar los 5 minutos (al volver con el botón atrás, por ejemplo
  // después de cargar un partido)
  const conError = () => document.body.dataset.listo === "error";   // después de fallo() no se arma nada
  async function volver(ya = false) {
    if (document.visibilityState !== "visible" || conError() || (!ya && Date.now() - leido < CADA)) return;
    if (leyendo) {
      if (ya) otraVez = true;   // lo que se está leyendo puede ser de antes de volver atrás
      return;
    }
    leyendo = true;
    try {
      const nuevas = await leer();
      const f = huella(JSON.stringify(nuevas));
      if (f !== firma && !conError()) {
        firma = f;
        actualizar(partidosBase(...nuevas));
        document.body.dataset.releido = String(Number(document.body.dataset.releido ?? 0) + 1);   // para las pruebas
      }
    } catch (e) {
      if (!(e instanceof ErrorBase)) fallo(e);
    } finally {
      leido = Date.now();   // también sin señal: se prueba de nuevo en 5 minutos
      leyendo = false;
      if (otraVez) {
        otraVez = false;
        volver(true);
      }
    }
  }
  document.addEventListener("visibilitychange", () => volver());
  window.addEventListener("focus", () => volver());   // en la compu, otra ventana al lado no la esconde
  window.addEventListener("pageshow", (e) => e.persisted && volver(true));   // vuelta con el botón atrás
}

arrancar().catch(fallo);
