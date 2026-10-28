// La pestaña Informe: el PDF de lo que se está viendo (la temporada o un
// partido), para bajarlo o, en el celular, mandarlo directo (WhatsApp).
//
// jsPDF (420 KB) y las letras del PDF (330 KB) no se bajan con el tablero:
// se piden al abrir esta pestaña. El PDF se arma ahí mismo, una sola vez
// (lo que muestra el panel no cambia), y los botones se prenden cuando está
// listo: así al tocar se baja o se comparte en el acto. Compartir tiene que
// ser en el mismo toque: si antes hay que esperar a armarlo, el teléfono ya
// no abre su menú. jsPDF viene armado para <script> (vendor/, sin eval: la
// CSP no cambia).
import { informe } from "./informe.js";
import { html, poner } from "./piezas.js";

const JSPDF = "vendor/jspdf-4.2.1.umd.min.js";
const ESPERA = 30_000;   // si no llega en este tiempo, se avisa (y se puede probar de nuevo)
let cargando = null;

function cargarJsPdf() {
  return new Promise((ok, mal) => {
    if (window.jspdf) return ok(window.jspdf.jsPDF);
    const s = document.createElement("script");
    const plazo = setTimeout(() => mal(new Error("jsPDF tardó demasiado.")), ESPERA);
    s.src = JSPDF;
    s.onload = () => {
      clearTimeout(plazo);
      if (window.jspdf?.jsPDF) ok(window.jspdf.jsPDF);
      else mal(new Error("jsPDF llegó pero no se pudo usar."));
    };
    s.onerror = () => {
      clearTimeout(plazo);
      s.remove();
      mal(new Error("No se pudo bajar jsPDF."));
    };
    document.head.append(s);
  });
}

// jsPDF y pdf.js (con las letras), una sola vez; si falla, la próxima se prueba de nuevo.
export function cargarPdf() {
  cargando ??= Promise.all([cargarJsPdf(), import("./pdf.js")]).catch((e) => {
    cargando = null;
    throw e;
  });
  return cargando;
}

const dos = (n) => String(n).padStart(2, "0");
function hoy() {
  const d = new Date();
  return `Generado el ${dos(d.getDate())}/${dos(d.getMonth() + 1)}/${d.getFullYear()} desde el tablero del club`;
}

// El PDF, como archivo.
async function armar(t, categoria, p) {
  let JsPDF, armarPdf;
  try {
    [JsPDF, { armarPdf }] = await cargarPdf();
  } catch (e) {
    e.sinConexion = true;
    throw e;
  }
  const inf = informe(t, categoria, p);
  const doc = armarPdf(JsPDF, inf.bloques, { titulo: inf.titulo, pie: inf.pie, generado: hoy() });
  return new File([doc.output("blob")], inf.archivo, { type: "application/pdf" });
}

function bajar(archivo) {
  const url = URL.createObjectURL(archivo);
  const a = document.createElement("a");
  a.href = url;
  a.download = archivo.name;
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

// ¿El teléfono deja mandar un PDF con su menú de compartir?
function puedeCompartir() {
  try {
    return Boolean(navigator.canShare?.({ files: [new File([""], "x.pdf", { type: "application/pdf" })] }));
  } catch {
    return false;
  }
}

// t: la temporada; p: el partido (o null: la temporada entera).
export function pestanaInforme(panel, t, categoria, p = null) {
  poner(panel, html`<div class="nota">Un informe en PDF de lo que se ve en esta pantalla, armado para leer en el celular: para mandar por WhatsApp o imprimir.</div>
<div class="botones"><button type="button" class="boton primario" data-pdf="bajar">Descargar PDF</button>${
  puedeCompartir() ? html`<button type="button" class="boton" data-pdf="compartir">Compartir</button>` : ""}</div>
<div class="aviso error" role="alert" hidden><span></span> <button type="button" class="boton" data-pdf="otra">Probar de nuevo</button></div>`);
  const botones = [...panel.querySelectorAll("[data-pdf=bajar], [data-pdf=compartir]")];
  const rotulos = botones.map((b) => b.textContent);
  const error = panel.querySelector(".aviso.error");
  let archivo = null;

  // arma el PDF (al abrir la pestaña, o al probar de nuevo); mientras, los botones esperan
  async function preparar() {
    error.hidden = true;
    botones.forEach((b) => {
      b.disabled = true;
      b.textContent = "Preparando el PDF…";
    });
    try {
      archivo = await armar(t, categoria, p);
    } catch (e) {
      console.error(e);
      // sin conexión, probar de nuevo sirve; con los datos de esta pantalla, no
      error.querySelector("span").textContent = e?.sinConexion
        ? "No se pudo armar el PDF. Revisá la conexión."
        : "No se pudo armar el PDF de esta pantalla. Avisale a quien maneja el tablero.";
      error.querySelector("[data-pdf=otra]").hidden = !e?.sinConexion;
      error.hidden = false;
    } finally {
      botones.forEach((b, i) => {
        b.disabled = !archivo;
        b.textContent = rotulos[i];
      });
    }
  }

  panel.querySelector("[data-pdf=bajar]").addEventListener("click", () => archivo && bajar(archivo));
  panel.querySelector("[data-pdf=compartir]")?.addEventListener("click", async () => {
    if (!archivo) return;
    try {
      await navigator.share({ files: [archivo], title: archivo.name });
    } catch (e) {
      if (e.name !== "AbortError") bajar(archivo);   // si el teléfono no dejó compartir, se baja
    }
  });
  panel.querySelector("[data-pdf=otra]").addEventListener("click", preparar);
  preparar();
}
