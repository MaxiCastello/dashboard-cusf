// Dibuja el informe (los bloques de informe.js) en un PDF con jsPDF.
//
// Pensado para leerlo en el celular (lo mandan por WhatsApp): la hoja tiene
// la forma de la pantalla (9:16), así en el teléfono entra entera a lo
// ancho y se lee sin agrandar. Fondo blanco (se lee al sol y se puede
// imprimir), con la franja oscura del tablero arriba.
//
// Reglas del dibujo:
// - nada se sale de su lugar: un texto que no entra se corta con "…";
// - un título nunca queda solo al pie de una página (va con lo que sigue);
//   una tabla larga sigue en la otra página, con su encabezado otra vez;
// - jsPDF no busca otra letra si a la elegida le falta una: seguro() la
//   cambia por la misma sin tilde, o por "?" (nunca queda en blanco).
//
// No usa la página (sin document): las pruebas lo corren en Node.
import { pct } from "./formato.js";
import { LETRAS, TIENE, ESCUDO } from "./pdf-recursos.js";
import { aclarar } from "./piezas.js";
import { NEUTRO } from "./tema.js";

export const ANCHO = 400, ALTO = 711;
const M = 20, CW = ANCHO - 2 * M;   // margen y ancho útil
const PIE = 26;                     // lo que ocupa el pie de cada página
const ABAJO = ALTO - PIE;           // hasta dónde se dibuja
const ARRIBA = M + 4;               // dónde empieza una página que no es la primera

const C = {
  tinta: "#14181f", gris: "#5b6472", claro: "#8b93a3", linea: "#e3e7ee", caja: "#f3f5f8", raya: "#f7f8fa",
  fondo: "#0a0c0f", acento: "#1a6fd4",
};
// cada color: el de relleno (barras, anillos) y el de texto sobre blanco (más oscuro, para que se lea)
const COLOR = {
  uni: ["#00c853", "#00873a"], rival: ["#ff9800", "#b86200"], acento: ["#1a6fd4", "#1a6fd4"], aviso: ["#ffd600", "#8a6d00"],
  mal: ["#ff1744", "#d0102f"], neutro: ["#6b7280", "#5b6472"],
};
const relleno = (c) => (c ? COLOR[c][0] : C.tinta);
const tinta = (c) => (c ? COLOR[c][1] : C.tinta);

// ── Letras ──────────────────────────────────────────────────────────────────

// ¿la fuente tiene esta letra? (TIENE: los rangos de códigos, en orden)
function tiene(fuente, cp) {
  const s = TIENE[fuente];
  let lo = 0, hi = s.length - 1;
  while (lo <= hi) {
    const m = (lo + hi) >> 1;
    if (cp < s[m][0]) hi = m - 1;
    else if (cp > s[m][1]) lo = m + 1;
    else return true;
  }
  return false;
}

// El texto con letras que la fuente tiene.
export function seguro(texto, fuente) {
  let out = "";
  for (const ch of String(texto)) {
    const cp = ch.codePointAt(0);
    if (cp === 10 || tiene(fuente, cp)) out += ch;
    else {
      const sin = ch.normalize("NFD").replace(/\p{M}/gu, "");
      out += sin && [...sin].every((x) => tiene(fuente, x.codePointAt(0))) ? sin : "?";
    }
  }
  return out;
}

// ── El documento ────────────────────────────────────────────────────────────

class Hoja {
  constructor(JsPDF, meta) {
    this.doc = new JsPDF({ unit: "pt", format: [ANCHO, ALTO], compress: true, putOnlyUsedFonts: true });
    for (const [nombre, datos] of Object.entries(LETRAS)) {
      this.doc.addFileToVFS(`${nombre}.ttf`, datos);
      this.doc.addFont(`${nombre}.ttf`, nombre, "normal");
    }
    this.doc.setProperties({ title: meta.titulo, author: "Club Universitario de Santa Fe", creator: "Tablero CUSF",
      subject: meta.pie });
    this.meta = meta;
    this.y = M;
    this.cola = 0;   // lo que ocupa la nota que va pegada abajo del bloque que se dibuja
  }

  // letra, tamaño y color
  letra(fuente, tam, color = C.tinta) {
    this.fuente = fuente;
    this.doc.setFont(fuente, "normal");
    this.doc.setFontSize(tam);
    this.doc.setTextColor(color);
  }

  ancho(t) {
    return this.doc.getTextWidth(seguro(t, this.fuente));
  }

  // si texto() lo escribe entero, sin cortarlo con "…" (medido igual que ahí)
  entra(t, max, espacio = 0) {
    const s = seguro(t, this.fuente);
    this.doc.setCharSpace(espacio);
    const si = this.doc.getTextWidth(s) + espacio * s.length <= max;
    this.doc.setCharSpace(0);
    return si;
  }

  // un renglón; si no entra en `max`, se corta con "…"
  texto(t, x, y, { alinear = "left", max = null, espacio = 0 } = {}) {
    let s = seguro(t, this.fuente);
    this.doc.setCharSpace(espacio);
    if (max !== null && this.doc.getTextWidth(s) + espacio * s.length > max) {
      while (s.length > 1 && this.doc.getTextWidth(`${s}…`) + espacio * (s.length + 1) > max) s = s.slice(0, -1);
      s = `${s.trimEnd()}…`;
    }
    this.doc.text(s, x, y, { align: alinear, baseline: "alphabetic" });
    this.doc.setCharSpace(0);
  }

  // los renglones de un texto largo, cortados a `max` de ancho
  renglones(t, max) {
    return this.doc.splitTextToSize(seguro(t, this.fuente), max);
  }

  // ¿entra algo de este alto? si no, otra página (salvo que ya esté arriba
  // de una nueva: algo más alto que una página se corta solo, sin dejar una en blanco)
  lugar(alto) {
    if (this.y + alto > ABAJO && this.y > ARRIBA) this.nueva();
  }

  nueva() {
    this.doc.addPage([ANCHO, ALTO]);
    this.y = ARRIBA;
  }

  // el pie de cada página (al final, cuando se sabe cuántas son)
  pies() {
    const n = this.doc.getNumberOfPages();
    for (let i = 1; i <= n; i++) {
      this.doc.setPage(i);
      this.doc.setDrawColor(C.linea);
      this.doc.setLineWidth(0.6);
      this.doc.line(M, ALTO - PIE + 6, ANCHO - M, ALTO - PIE + 6);
      this.letra("DMSans", 7, C.claro);
      this.texto(this.meta.pie, M, ALTO - 10, { max: CW - 50 });
      this.texto(`${i} de ${n}`, ANCHO - M, ALTO - 10, { alinear: "right" });
    }
  }

  // un anillo "a de b": el fondo gris y la parte del % en color
  anillo(cx, cy, r, grosor, fraccion, color) {
    const d = this.doc;
    d.setLineWidth(grosor);
    d.setDrawColor(C.linea);
    d.circle(cx, cy, r, "S");
    if (fraccion > 0) {
      d.setDrawColor(color);
      d.setLineCap("butt");
      const pasos = Math.max(2, Math.ceil(72 * fraccion));
      const pts = [];
      for (let i = 0; i <= pasos; i++) {
        const a = -Math.PI / 2 + 2 * Math.PI * fraccion * (i / pasos);
        pts.push([cx + r * Math.cos(a), cy + r * Math.sin(a)]);
      }
      d.lines(pts.slice(1).map(([x, y], i) => [x - pts[i][0], y - pts[i][1]]), pts[0][0], pts[0][1], [1, 1], "S", false);
    }
    d.setLineWidth(0.6);
  }

  // ✓ / ✗ dibujados (las letras no los tienen)
  marca(tipo, cx, cy, tam, color) {
    const d = this.doc;
    d.setDrawColor(color);
    d.setLineWidth(tam * 0.22);
    d.setLineCap("round");
    if (tipo === "si") {
      d.lines([[tam * 0.3, tam * 0.3], [tam * 0.6, -tam * 0.65]], cx - tam * 0.45, cy, [1, 1], "S", false);
    } else {
      const h = tam * 0.38;
      d.line(cx - h, cy - h, cx + h, cy + h);
      d.line(cx - h, cy + h, cx + h, cy - h);
    }
    d.setLineCap("butt");
    d.setLineWidth(0.6);
  }
}

// ── Cada bloque: cuánto ocupa y cómo se dibuja ──────────────────────────────

function encabezado(h, b) {
  const d = h.doc, alto = b.marcador ? 196 : 150;
  d.setFillColor(C.fondo);
  d.rect(0, 0, ANCHO, alto, "F");
  d.setFillColor(C.acento);
  d.rect(0, alto - 3, ANCHO, 3, "F");
  const lado = 46, ew = (ESCUDO.ancho / ESCUDO.alto) * lado;
  d.addImage(`data:image/png;base64,${ESCUDO.png}`, "PNG", M, 22, ew, lado);
  const x = M + ew + 12;
  h.letra("DMMono", 7.5, C.claro);
  h.texto("UNIVERSITARIO RUGBY · INFORME", x, 36, { espacio: 1.2, max: ANCHO - x - M });
  // el título grande: si no entra, más chico (hasta 20); si tampoco, en dos
  // renglones cortado en un " · " (hasta 16) y recién ahí se corta con "…"
  const max = ANCHO - x - M, entra = (s) => h.entra(s, max, 0.6);
  const partes = b.titulo.split(" · ");
  const enDos = () => {
    for (let k = partes.length - 1; k > 0; k--) {
      const dos = [partes.slice(0, k).join(" · "), partes.slice(k).join(" · ")];
      if (dos.every(entra)) return dos;
    }
    return null;
  };
  let tam = 24, renglones = null;
  h.letra("Bebas", tam, "#ffffff");
  while (tam > 20 && !entra(b.titulo)) h.letra("Bebas", --tam, "#ffffff");
  if (!entra(b.titulo)) {
    tam = 22;
    h.letra("Bebas", tam, "#ffffff");
    while (!(renglones = enDos()) && tam > 16) h.letra("Bebas", --tam, "#ffffff");
  }
  if (renglones) renglones.forEach((r, i) => h.texto(r, x, 57 + i * (tam + 1), { espacio: 0.6, max }));
  else h.texto(b.titulo, x, 61, { espacio: 0.6, max });
  if (b.marcador) {
    // el tanteo: UNI a la izquierda, el rival a la derecha, grande
    const mc = b.marcador, cy = 128, mitad = ANCHO / 2;
    h.letra("Bebas", 54, COLOR.uni[0]);
    h.texto(mc.uni, mitad - 22, cy, { alinear: "right" });
    h.letra("Bebas", 54, COLOR.rival[0]);
    h.texto(mc.rival, mitad + 22, cy);
    h.letra("Bebas", 30, "#3a4150");
    h.texto("–", mitad, cy - 10, { alinear: "center" });
    h.letra("DMMono", 8, C.claro);
    h.texto("UNI", mitad - 22, cy + 16, { alinear: "right", espacio: 1.5 });
    h.texto(mc.nombre, mitad + 22, cy + 16, { espacio: 1.5, max: ANCHO - M - mitad - 22 });
    h.letra("DMSans", 8.5, "#c9ced8");
    h.renglones(b.detalle, CW).slice(0, 2).forEach((r, i) => h.texto(r, mitad, cy + 38 + i * 11, { alinear: "center" }));
  } else {
    h.letra("DMSans", 9.5, "#c9ced8");
    h.renglones(b.detalle, CW).slice(0, 3).forEach((r, i) => h.texto(r, M, (renglones ? 103 : 98) + i * 13));
  }
  h.letra("DMSans", 7, C.claro);
  h.texto(h.meta.generado, M, alto - 13);
  h.y = alto + 14;
}

function seccion(h, b, siguiente, colaSiguiente) {
  // el título va con el primer pedazo entero de lo que sigue (no queda solo al pie)
  h.lugar(34 + primero(h, siguiente, colaSiguiente));
  h.y += 8;
  h.doc.setFillColor(C.acento);
  h.doc.rect(M, h.y + 1, 3, 15, "F");
  h.letra("Bebas", 17, C.tinta);
  h.texto(b.titulo, M + 9, h.y + 14, { espacio: 0.6, max: CW - 9 });
  h.y += 26;
}

// de a 2 si son 2 o 4; si no, de a 3
const columnas = (n) => (n === 2 || n === 4 ? 2 : 3);

const KPI_ALTO = 48, KPI_GAP = 7;
function kpis(h, b) {
  const col = columnas(b.items.length);
  const w = (CW - (col - 1) * KPI_GAP) / col;
  b.items.forEach((it, i) => {
    if (i % col === 0) {
      if (i) h.y += KPI_ALTO + KPI_GAP;
      h.lugar(KPI_ALTO + (i + col >= b.items.length ? h.cola : 0));   // (la primera: primero())
    }
    const x = M + (i % col) * (w + KPI_GAP);
    h.doc.setFillColor(C.caja);
    h.doc.roundedRect(x, h.y, w, KPI_ALTO, 5, 5, "F");
    h.letra("Bebas", 22, tinta(it.color));
    h.texto(it.valor, x + w / 2, h.y + 24, { alinear: "center", max: w - 8 });
    // el rótulo, en uno o dos renglones
    h.letra("DMMono", 6, C.gris);
    const rs = h.renglones(it.rotulo.toUpperCase(), w - 12).slice(0, 2);
    rs.forEach((r, k) => h.texto(r, x + w / 2, h.y + (rs.length > 1 ? 35 : 39) + k * 7.5, { alinear: "center", max: w - 6 }));
  });
  h.y += KPI_ALTO + 12;
}

const ANI_GAP = 7;
const aniAlto = (b) => (b.items.some((it) => it.abajo) ? 112 : 100) + (b.items.some((it) => it.grupo) ? 10 : 0);
function anillos(h, b) {
  const col = columnas(b.items.length);
  const w = (CW - (col - 1) * ANI_GAP) / col, alto = aniAlto(b);
  const conGrupo = b.items.some((it) => it.grupo);
  b.items.forEach((it, i) => {
    if (i % col === 0) {
      if (i) h.y += alto + ANI_GAP;
      h.lugar(alto + (i + col >= b.items.length ? h.cola : 0));
    }
    const x = M + (i % col) * (w + ANI_GAP), cx = x + w / 2;
    h.doc.setFillColor(C.caja);
    h.doc.roundedRect(x, h.y, w, alto, 5, 5, "F");
    let y = h.y + 10;
    if (conGrupo) {
      h.letra("DMMono", 6, C.gris);
      h.texto((it.grupo ?? "").toUpperCase(), cx, y + 3, { alinear: "center", espacio: 0.8, max: w - 8 });
      y += 10;
    }
    const r = 23, cy = y + r + 3;
    h.anillo(cx, cy, r, 6.5, it.b ? it.a / it.b : 0, relleno(it.color));
    if (it.b) {
      h.letra("Bebas", 17, C.tinta);
      h.texto(it.a, cx, cy + 1, { alinear: "center", max: 2 * r - 10 });
      h.letra("DMMono", 6.5, C.gris);
      h.texto(`de ${it.b}`, cx, cy + 10, { alinear: "center", max: 2 * r - 8 });
      h.letra("Bebas", 14, tinta(it.color));
      h.texto(`${it.pct}%`, cx, cy + r + 17, { alinear: "center" });
    } else {
      h.letra("Bebas", 17, C.claro);
      h.texto("—", cx, cy + 5, { alinear: "center" });
      h.letra("DMMono", 6.5, C.gris);
      h.texto("sin datos", cx, cy + r + 15, { alinear: "center" });
    }
    h.letra("DMSans", 7.5, C.tinta);
    h.texto(it.rotulo, cx, cy + r + 29, { alinear: "center", max: w - 8 });
    if (it.abajo) {
      h.letra("DMSans", 6.6, C.gris);
      h.texto(it.abajo, cx, cy + r + 40, { alinear: "center", max: w - 6 });
    }
  });
  h.y += alto + 12;
}

const MAR_FILA = 17;
const marAlto = (b) => 26 + b.filas.length * MAR_FILA;
function mariposa(h, b) {
  const rot = 100, area = CW - rot, centro = M + rot + area / 2;
  // lo que ocupa el texto más largo al lado de una barra
  h.letra("DMSans", 7.5);
  const txt = Math.min(area / 2 - 30, 8 + Math.max(...b.filas.flatMap((f) => [h.ancho(f.ta), h.ancho(f.tb)])));
  const max = area / 2 - txt;
  const tope = b.porCiento ? 100 : Math.max(1, ...b.filas.flatMap((f) => [f.a, f.b]));
  h.lugar(primero(h, b, h.cola));
  // el título y quién es quién
  h.letra("DMSans-Bold", 8.5, C.tinta);
  h.texto(b.titulo, M, h.y + 9, { max: rot + area / 2 - 70 });
  h.letra("DMMono", 6.5, C.gris);
  const ley = (nombre, color, x, alinear) => {
    h.doc.setFillColor(relleno(color));
    const w = h.ancho(nombre);
    h.doc.circle(alinear === "right" ? x - w - 6 : x, h.y + 6.5, 2.6, "F");
    h.texto(nombre, alinear === "right" ? x : x + 6, h.y + 9, { alinear });
  };
  ley(b.nombres[0], b.colores[0], centro - 8, "right");
  ley(b.nombres[1], b.colores[1], centro + 8, "left");
  h.y += 18;
  for (const f of b.filas) {
    h.lugar(MAR_FILA);   // (corta sólo si no entra en una página entera)
    const yb = h.y + 3, alto = MAR_FILA - 6;
    h.letra("DMSans", 8, C.tinta);
    h.texto(f.rotulo, M, yb + alto - 2, { max: rot - 6 });
    const la = (f.a / tope) * max, lb = (f.b / tope) * max;
    h.doc.setFillColor(relleno(b.colores[0]));
    if (la > 0) h.doc.rect(centro - la, yb, la, alto, "F");
    h.doc.setFillColor(relleno(b.colores[1]));
    if (lb > 0) h.doc.rect(centro, yb, lb, alto, "F");
    h.letra("DMSans", 7.5, C.tinta);
    h.texto(f.ta, centro - la - 4, yb + alto - 2.5, { alinear: "right", max: txt - 4 });
    h.texto(f.tb, centro + lb + 4, yb + alto - 2.5, { max: txt - 4 });
    // el eje, renglón por renglón (si el gráfico sigue en otra página, sigue con él)
    h.doc.setDrawColor(C.claro);
    h.doc.setLineWidth(0.8);
    h.doc.line(centro, h.y, centro, h.y + MAR_FILA);
    h.doc.setLineWidth(0.6);
    h.y += MAR_FILA;
  }
  h.y += 8;
}

// el alto de un renglón, la letra y el alto del encabezado
const medTabla = (b) => (b.chica ? { fila: 12.5, tam: 6.8, cab: 17 } : { fila: 15, tam: 7.8, cab: 18 });

function tabla(h, b) {
  const { fila, tam, cab } = medTabla(b);
  const total = b.columnas.reduce((s, c) => s + c.ancho, 0);
  const anchos = b.columnas.map((c) => (c.ancho / total) * CW);
  const xs = anchos.map((_, i) => M + anchos.slice(0, i).reduce((s, w) => s + w, 0));
  const encabezado = () => {
    h.letra("DMSans-Bold", b.chica ? 6.3 : 7.2, C.gris);
    b.columnas.forEach((c, i) => {
      const der = c.alinear === "der";
      h.texto(c.titulo, der ? xs[i] + anchos[i] - 4 : xs[i] + 4, h.y + cab - 6, { alinear: der ? "right" : "left", max: anchos[i] - 6 });
    });
    h.doc.setDrawColor(C.tinta);
    h.doc.setLineWidth(0.8);
    h.doc.line(M, h.y + cab - 1, M + CW, h.y + cab - 1);
    h.doc.setLineWidth(0.6);
    h.y += cab;
  };
  const corta = b.filas.length <= 3;   // una tabla corta, entera y con su nota
  h.lugar(primero(h, b, h.cola));
  encabezado();
  // cuántos renglones van en esta página: los que entran, pero sin dejar
  // menos de 3 solos en la que sigue; los últimos, con la nota de abajo
  const cuantos = (k) => {
    const entran = Math.floor((ABAJO - h.y) / fila), quedan = b.filas.length - k;
    if (quedan <= entran) {
      if (corta || h.y + quedan * fila + 10 + h.cola <= ABAJO || quedan <= 3) return quedan;
      return quedan - 3;
    }
    return quedan - entran < 3 ? Math.max(1, entran - (3 - (quedan - entran))) : entran;
  };
  let hasta = cuantos(0);
  b.filas.forEach((f, k) => {
    if (k === hasta) {
      h.nueva();
      encabezado();
      hasta = k + cuantos(k);
    }
    if (k % 2) {
      h.doc.setFillColor(C.raya);
      h.doc.rect(M, h.y, CW, fila, "F");
    }
    f.forEach((celda, i) => {
      const der = b.columnas[i].alinear === "der";
      h.letra("DMSans", tam, C.tinta);
      h.texto(celda, der ? xs[i] + anchos[i] - 4 : xs[i] + 4, h.y + fila / 2 + tam * 0.35,
        { alinear: der ? "right" : "left", max: anchos[i] - 7 });
    });
    h.y += fila;
  });
  h.doc.setDrawColor(C.linea);
  h.doc.line(M, h.y, M + CW, h.y);
  h.y += 10;
}

// Una frase destacada (un dato que vale la pena leer entero): recuadro claro,
// la barra de color a la izquierda y un renglón por equipo, con su punto.
const FRASE_TAM = 8.8, FRASE_RENGLON = 11.5, FRASE_PAD = 9;
function renglonesFrase(h, b) {
  h.letra("DMSans", FRASE_TAM);
  return b.lineas.map((l) => h.renglones(l.texto, CW - 2 * FRASE_PAD - 12));
}
const altoFrase = (h, b) => 2 * FRASE_PAD + renglonesFrase(h, b).reduce((s, r) => s + r.length * FRASE_RENGLON, 0)
  + (b.lineas.length - 1) * 4 + 10;

function frase(h, b) {
  const rs = renglonesFrase(h, b), alto = altoFrase(h, b) - 10;
  h.lugar(alto + h.cola);
  h.doc.setFillColor("#eef4fd");
  h.doc.roundedRect(M, h.y, CW, alto, 5, 5, "F");
  h.doc.setFillColor(C.acento);
  h.doc.rect(M, h.y, 3, alto, "F");
  let y = h.y + FRASE_PAD + FRASE_TAM;
  b.lineas.forEach((l, i) => {
    h.doc.setFillColor(relleno(l.color));
    h.doc.circle(M + FRASE_PAD + 3, y - FRASE_TAM * 0.32, 2.6, "F");
    h.letra("DMSans", FRASE_TAM, C.tinta);
    rs[i].forEach((r, k) => h.texto(r, M + FRASE_PAD + 12, y + k * FRASE_RENGLON));
    y += rs[i].length * FRASE_RENGLON + 4;
  });
  h.y += alto + 10;
}

function altoNota(h, b) {
  h.letra("DMSans", 7.3, C.gris);
  return h.renglones(b.texto, CW).length * 9.5 + 8;
}

function nota(h, b) {
  h.letra("DMSans", 7.3, C.gris);
  const rs = h.renglones(b.texto, CW);
  h.lugar(rs.length * 9.5 + 4);
  rs.forEach((r, i) => h.texto(r, M, h.y + 7 + i * 9.5));
  h.y += rs.length * 9.5 + 8;
}

// el marcador después de cada anotación, en escalones
const MARCADOR = 150;
function marcador(h, b) {
  const alto = MARCADOR, d = h.doc;
  h.lugar(primero(h, b, h.cola));
  const x0 = M + 22, x1 = M + CW - 8, y0 = h.y + 18, y1 = h.y + alto - 18;
  const n = b.evol.length, tope = Math.max(1, ...b.evol.flatMap((e) => [e.u, e.r]));
  const paso = tope > 60 ? 20 : tope > 25 ? 10 : 5, arriba = Math.ceil(tope / paso) * paso;
  const X = (i) => x0 + ((x1 - x0) * i) / Math.max(n, 1), Y = (v) => y1 - ((y1 - y0) * v) / arriba;
  h.letra("DMMono", 6.5, C.gris);
  for (let v = 0; v <= arriba; v += paso) {
    d.setDrawColor(C.linea);
    d.line(x0, Y(v), x1, Y(v));
    h.texto(v, x0 - 5, Y(v) + 2.2, { alinear: "right" });
  }
  const medio = b.evol.findIndex((e) => e.periodo === "ST");
  if (medio > 0) {
    d.setDrawColor(C.claro);
    d.setLineDashPattern([2, 2], 0);
    d.line(X(medio + 0.5), y0 - 4, X(medio + 0.5), y1);
    d.setLineDashPattern([], 0);
    h.letra("DMMono", 6, C.gris);
    h.texto("ENTRETIEMPO", X(medio + 0.5), y0 - 7, { alinear: "center", espacio: 0.6 });
  }
  for (const [k, color] of [["r", "rival"], ["u", "uni"]]) {
    const vs = [0, ...b.evol.map((e) => e[k])];
    d.setDrawColor(relleno(color));
    d.setLineWidth(2.2);
    const seg = [];
    for (let i = 1; i < vs.length; i++) seg.push([X(i) - X(i - 1), 0], [0, Y(vs[i]) - Y(vs[i - 1])]);
    d.lines(seg, X(0), Y(0), [1, 1], "S", false);
    d.setLineWidth(0.6);
    d.setFillColor(relleno(color));
    vs.forEach((v, i) => d.circle(X(i), Y(v), 2, "F"));
  }
  // el final de cada uno, con su número
  const fin = b.evol.at(-1) ?? { u: 0, r: 0 };
  h.letra("Bebas", 12, tinta("uni"));
  h.texto(`UNI ${fin.u}`, x1, Y(fin.u) - 5, { alinear: "right" });
  h.letra("Bebas", 12, tinta("rival"));
  h.texto(`RIVAL ${fin.r}`, x1, Y(fin.r) + (Math.abs(Y(fin.r) - Y(fin.u)) < 14 ? 13 : -5), { alinear: "right" });
  h.letra("DMMono", 6, C.gris);
  h.texto("ANOTACIONES, EN ORDEN", x0, y1 + 12, { espacio: 0.5 });
  h.y += alto + 4;
}

const OBJ_GAP = 6;
const objAlto = (b) => (b.partidos ? 58 : 46);
function objetivos(h, b) {
  const alto = objAlto(b);
  b.items.forEach((it, k) => {
    h.lugar(alto + (k === b.items.length - 1 ? h.cola : 0));
    const d = h.doc, x = M, y = h.y;
    d.setFillColor(C.caja);
    d.roundedRect(x, y, CW, alto, 5, 5, "F");
    // a la derecha, lo grande
    const derecha = 104;
    const colorGrande = it.marca === "si" ? tinta("uni") : it.marca === "no" ? tinta("mal") : C.tinta;
    h.letra("Bebas", 20, it.grande === "Sin datos" || it.grande === "—" ? C.claro : colorGrande);
    let xg = x + CW - 10;
    if (it.chico) {
      h.letra("DMMono", 6.5, C.gris);
      h.texto(it.chico.toUpperCase(), xg, y + 22, { alinear: "right", espacio: 0.5 });
      xg -= h.ancho(it.chico.toUpperCase()) + 0.5 * it.chico.length + 4;
      h.letra("Bebas", 20, C.tinta);
    }
    if (it.marca) h.marca(it.marca, xg - h.ancho(it.grande) - 10, y + 15.5, 9, colorGrande);
    h.texto(it.grande, xg, y + 23, { alinear: "right" });
    // a la izquierda, el objetivo
    h.letra("Bebas", 13, C.tinta);
    h.texto(it.nombre, x + 10, y + 17, { espacio: 0.5, max: CW - derecha - 16 });
    h.letra("DMSans", 7, C.gris);
    h.texto(it.meta, x + 10, y + 28, { max: CW - derecha - 16 });
    h.letra("DMSans", 7.2, C.tinta);
    h.texto(it.detalle, x + 10, y + 39.5, { max: CW - 20 });
    if (b.partidos) {
      // un cuadradito por partido, del primero al último (más chicos si son muchos: entran todos)
      const n = it.marcas.length, paso = Math.min(11, (CW - 20) / Math.max(n, 1));
      const lado = paso * (8.5 / 11), xs = x + 10, yc = y + 44 + (8.5 - lado) / 2;
      it.marcas.forEach((m, i) => {
        const xc = xs + i * paso;
        if (m === "si") d.setFillColor("#d9f5e4");
        else if (m === "no") d.setFillColor("#fde0e5");
        if (m) d.roundedRect(xc, yc, lado, lado, 1.5, 1.5, "F");
        else {
          d.setDrawColor(C.claro);
          d.setLineDashPattern([1, 1], 0);
          d.roundedRect(xc, yc, lado, lado, 1.5, 1.5, "S");
          d.setLineDashPattern([], 0);
        }
        if (m) h.marca(m, xc + lado / 2, yc + lado / 2 + (m === "si" ? lado / 8.5 : 0), lado * 0.61, m === "si" ? tinta("uni") : tinta("mal"));
      });
    }
    h.y += alto + OBJ_GAP;
  });
  h.y += 4;
}

// ── Los penales de UNI en cajas (treemap) ───────────────────────────────────
//
// Como en la pestaña, pero quieto (en el PDF no se abre nada): cada situación
// es una caja de su color con su nombre arriba, y adentro sus motivos en el
// mismo color más claro. Una caja que no tiene lugar para su nombre y su
// número no se dibuja vacía: ese motivo pasa a "Otros" (y una situación que
// no entra, a "Otras situaciones"). La lista de motivos va en la tabla de abajo.

const CAJ_ALTO = 236, CAJ_CAB = 15, CAJ_GAP = 2, CAJ_PAD = 2.5;
const CAJ_FRASE = 8.6, CAJ_RENGLON = 11.5;
const MIN_SIT = 0.08, MAX_MOTIVOS = 4, MIN_MOTIVO = 0.1;   // los de la pestaña (vistas.js)

// ¿va letra blanca sobre este color?
function oscuro(hex) {
  const [r, g, b] = [1, 3, 5].map((i) => Number.parseInt(hex.slice(i, i + 2), 16) / 255);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b < 0.5;
}

// Cajas de tamaño proporcional a cada valor (de más a menos), lo más
// cuadradas posible (el "squarified" de Bruls y otros, el de Plotly).
function repartir(valores, x, y, w, h) {
  const out = [];
  let resto = valores.reduce((s, v) => s + v, 0), i = 0;
  while (i < valores.length) {
    const area = (v) => (v / resto) * w * h, lado = Math.min(w, h);
    const peor = (fila) => {
      const s = fila.reduce((a, v) => a + area(v), 0);
      return Math.max(...fila.map((v) => Math.max((lado * lado * area(v)) / (s * s), (s * s) / (lado * lado * area(v)))));
    };
    const fila = [valores[i]];
    while (i + fila.length < valores.length && peor([...fila, valores[i + fila.length]]) <= peor(fila)) fila.push(valores[i + fila.length]);
    const grosor = fila.reduce((a, v) => a + area(v), 0) / lado;
    let pos = 0;
    for (const v of fila) {
      const largo = area(v) / grosor;
      out.push(w >= h ? { x, y: y + pos, w: grosor, h: largo } : { x: x + pos, y, w: largo, h: grosor });
      pos += largo;
    }
    if (w >= h) [x, w] = [x + grosor, w - grosor];
    else [y, h] = [y + grosor, h - grosor];
    resto -= fila.reduce((a, v) => a + v, 0);
    i += fila.length;
  }
  return out;
}

// Lo que entra en una caja de w × alto: el nombre (hasta 2 renglones), el
// número grande y, si hay lugar, "de Y (Z%)" y los renglones de `extra`.
// null: no entran ni el nombre y el número.
function encaja(h, c, w, alto) {
  const ancho = w - 10;
  if (ancho <= 0) return null;
  h.letra("DMSans-Bold", 7);
  const rs = h.renglones(c.nombre, ancho);
  // (splitTextToSize corta una palabra larga por la mitad: eso tampoco entra)
  const palabras = (xs) => xs.join(" ").split(/\s+/).filter(Boolean).join(" ");
  if (rs.length > 2 || rs.some((r) => h.ancho(r) > ancho) || palabras(rs) !== palabras([seguro(c.nombre, "DMSans-Bold")])) return null;
  h.letra("Bebas", 17);
  const base = 4 + rs.length * 8 + 15;   // la línea del número
  if (h.ancho(String(c.valor)) > ancho || base + 4 > alto) return null;
  h.letra("DMSans", 6.3);
  const conDe = Boolean(c.de) && base + 10.5 <= alto && h.ancho(c.de) <= ancho;
  // los renglones de abajo, en orden, mientras entren; si quedan afuera, el
  // último dice cuántos faltan ("y 3 más")
  const extra = [], todos = c.extra ?? [];
  let y = base + (conDe ? 9 : 0);
  for (const t of todos) {
    if (y + 9.5 > alto || h.ancho(t) > ancho) break;
    extra.push(t);
    y += 8;
  }
  if (extra.length < todos.length && extra.length) extra[extra.length - 1] = `y ${todos.length - extra.length + 1} más`;
  return { rs, base, conDe, extra };
}

function caja(h, c, r, lugar, radio = 2) {
  h.doc.setFillColor(c.color);
  h.doc.roundedRect(r.x, r.y, r.w, r.h, radio, radio, "F");
  if (!lugar) return;
  const color = oscuro(c.color) ? "#ffffff" : C.tinta, x = r.x + 5;
  h.letra("DMSans-Bold", 7, color);
  lugar.rs.forEach((t, i) => h.texto(t, x, r.y + 10 + i * 8));
  h.letra("Bebas", 17, color);
  h.texto(c.valor, x, r.y + lugar.base);
  h.letra("DMSans", 6.3, color);
  if (lugar.conDe) h.texto(c.de, x, r.y + lugar.base + 9);
  lugar.extra.forEach((t, i) => h.texto(t, x, r.y + lugar.base + (lugar.conDe ? 17 : 8) + i * 8));
}

const adentro = (r, d) => ({ x: r.x + d, y: r.y + d, w: r.w - 2 * d, h: r.h - 2 * d });

// Una situación abierta (su nombre arriba y sus motivos adentro) o, si no
// entran, cerrada (una sola caja). null: no entra ni así.
function planSituacion(h, s, r, total) {
  const box = adentro(r, CAJ_GAP / 2);
  const dato = `de ${total} (${pct(s.valor, total)}%)`;
  h.letra("DMSans-Bold", 7);
  const cab = [`${s.nombre} · ${s.valor} ${dato}`, `${s.nombre} · ${s.valor} (${pct(s.valor, total)}%)`]
    .find((t) => h.ancho(t) <= box.w - 8);
  const claro = aclarar(s.color);
  const dentro = { x: box.x + CAJ_PAD, y: box.y + CAJ_CAB, w: box.w - 2 * CAJ_PAD, h: box.h - CAJ_CAB - CAJ_PAD };
  const mots = s.motivos;
  if (cab && dentro.h > 0) {
    let vistos = mots.filter((m, i) => i < MAX_MOTIVOS && m.valor / s.valor >= MIN_MOTIVO).length;
    if (mots.length - vistos === 1) vistos++;   // "Otros" de uno solo, no
    for (; vistos >= 0; vistos--) {
      const resto = mots.slice(vistos), vr = resto.reduce((a, m) => a + m.valor, 0);
      const cs = mots.slice(0, vistos).map((m) => ({ ...m, color: claro }));
      if (resto.length === 1) cs.push({ ...resto[0], color: claro });
      else if (resto.length && vistos) cs.push({ nombre: `Otros (${resto.length} motivos)`, valor: vr, color: aclarar(claro, 0.3) });
      // ninguno entra con su caja: una sola, con la lista adentro
      else if (resto.length) cs.push({ nombre: `${resto.length} motivos`, valor: vr, color: claro, extra: resto.map((m) => `${m.nombre} · ${m.valor}`) });
      for (const c of cs) c.de = cs.length > 1 ? `de ${s.valor} (${pct(c.valor, s.valor)}%)` : "";
      const rs = repartir(cs.map((c) => c.valor), dentro.x, dentro.y, dentro.w, dentro.h).map((q) => adentro(q, CAJ_GAP / 2));
      const lugares = cs.map((c, i) => encaja(h, c, rs[i].w, rs[i].h));
      if (lugares.every(Boolean)) return { s, box, cab, cajas: cs.map((c, i) => [c, rs[i], lugares[i]]) };
    }
  }
  // cerrada: el nombre, el número, de cuántos y sus motivos (los que entren)
  const c = { nombre: s.nombre, valor: s.valor, color: s.color, de: dato,
    extra: mots.length === 1 ? [mots[0].nombre] : mots.map((m) => `${m.nombre} · ${m.valor}`) };
  const lugar = encaja(h, c, box.w, box.h);
  return lugar ? { s, box, cajas: [[c, box, lugar]] } : null;
}

function cajas(h, b) {
  h.lugar(primero(h, b, h.cola));
  h.letra("DMSans-Bold", 8.5, C.tinta);
  h.texto(b.titulo, M, h.y + 9, { max: CW - 80 });
  h.letra("DMMono", 6.5, C.gris);
  h.texto(`${b.total} ${b.total === 1 ? "PENAL" : "PENALES"} DE UNI`, M + CW, h.y + 9, { alinear: "right", espacio: 0.5 });
  h.y += 18;
  renglonesMixtos(h, b.frase, CW).forEach((renglon) => {
    for (const [t, negrita, x] of renglon) {
      h.letra(negrita ? "DMSans-Bold" : "DMSans", CAJ_FRASE, C.tinta);
      h.texto(t, M + x, h.y + 8);
    }
    h.y += CAJ_RENGLON;
  });
  h.y += 6;
  const area = { x: M, y: h.y, w: CW, h: CAJ_ALTO };
  // las situaciones chicas (si son más de una) van juntas, como en la pestaña;
  // si una no entra, se suma a ellas (la más chica primero)
  let sueltas = b.situaciones.filter((s) => s.valor / b.total >= MIN_SIT), chicas = b.situaciones.filter((s) => !sueltas.includes(s));
  if (chicas.length === 1) [sueltas, chicas] = [b.situaciones, []];
  let planes;
  for (;;) {
    const grupos = [...sueltas];
    if (chicas.length) {
      const v = chicas.reduce((a, s) => a + s.valor, 0);
      grupos.push({ otras: true, nombre: "Otras situaciones", valor: v, color: NEUTRO,
        de: `de ${b.total} (${pct(v, b.total)}%)`, extra: chicas.map((s) => `${s.nombre} · ${s.valor}`) });
      grupos.sort((a, c) => c.valor - a.valor);
    }
    const rs = repartir(grupos.map((g) => g.valor), area.x, area.y, area.w, area.h);
    planes = grupos.map((g, i) => {
      if (!g.otras) return planSituacion(h, g, rs[i], b.total);
      const box = adentro(rs[i], CAJ_GAP / 2);
      return { s: g, box, cajas: [[g, box, encaja(h, g, box.w, box.h)]] };   // (sin lugar: la caja sola)
    });
    const falta = planes.findLastIndex((p) => !p);
    if (falta < 0 || !sueltas.length) break;
    chicas = [...chicas, grupos[falta]].sort((a, c) => c.valor - a.valor);
    sueltas = sueltas.filter((s) => s !== grupos[falta]);
  }
  for (const p of planes) {
    if (!p) continue;
    if (p.cab) {
      caja(h, { color: p.s.color }, p.box, null, 3);
      h.letra("DMSans-Bold", 7, oscuro(p.s.color) ? "#ffffff" : C.tinta);
      h.texto(p.cab, p.box.x + 5, p.box.y + 10.5);
    }
    for (const [c, r, lugar] of p.cajas) caja(h, c, r, lugar, p.cab ? 2 : 3);
  }
  h.y += CAJ_ALTO + 10;
}

// Los renglones de un texto con partes en negrita: [[texto, negrita, x]] por
// renglón. Se corta después de un espacio (una palabra puede tener pedazos
// en negrita y sin: "Juego)," se mide entera); una palabra más larga que el
// renglón, letra por letra.
function renglonesMixtos(h, partes, max) {
  const palabras = [[]];
  for (const [texto, negrita] of partes) {
    for (const t of texto.split(/(?<= )/)) {
      if (t) palabras.at(-1).push([t, negrita]);
      if (t.endsWith(" ")) palabras.push([]);
    }
  }
  const medir = (t, negrita) => {
    h.letra(negrita ? "DMSans-Bold" : "DMSans", CAJ_FRASE);
    return h.ancho(t);
  };
  const out = [[]];
  let x = 0;
  const poner = (t, negrita) => {
    if (!out.at(-1).length && !t.trim()) return;   // sin espacio al principio del renglón
    out.at(-1).push([t, negrita, x]);
    x += medir(t, negrita);
  };
  const otro = () => {
    out.push([]);
    x = 0;
  };
  for (const p of palabras) {
    const ancho = p.reduce((s, [t, n], i) => s + medir(i === p.length - 1 ? t.trimEnd() : t, n), 0);
    if (out.at(-1).length && x + ancho > max) otro();
    if (ancho <= max) {
      for (const [t, n] of p) poner(t, n);
      continue;
    }
    for (const [t, n] of p) {
      for (const ch of t) {
        if (out.at(-1).length && ch.trim() && x + medir(ch, n) > max) otro();
        poner(ch, n);
      }
    }
  }
  // sin el espacio del final de cada renglón (no se ve, pero ocupa)
  for (const r of out) if (r.length) r[r.length - 1][0] = r.at(-1)[0].trimEnd();
  return out;
}

const altoCajas = (h, b) => 18 + renglonesMixtos(h, b.frase, CW).length * CAJ_RENGLON + 6 + CAJ_ALTO + 10;

const DIBUJAR = { encabezado, seccion, kpis, anillos, mariposa, tabla, nota, frase, marcador, objetivos, cajas };

// Lo primero de un bloque que no se puede cortar: una fila de números o de
// anillos, un gráfico entero, el encabezado de una tabla y 3 renglones, una
// card de objetivo; con `cola` (la nota que va pegada abajo) si ese pedazo
// es también el último. Lo usan los títulos (para no quedar solos al pie) y
// cada bloque al empezar: las mismas medidas con que se dibuja.
function primero(h, b, cola = 0) {
  if (!b) return 0;
  switch (b.tipo) {
    case "kpis": return KPI_ALTO + (b.items.length <= columnas(b.items.length) ? cola : 0);
    case "anillos": return aniAlto(b) + (b.items.length <= columnas(b.items.length) ? cola : 0);
    case "mariposa": return Math.min(marAlto(b) + cola, ABAJO - ARRIBA);
    case "tabla": {
      const { fila, cab } = medTabla(b);
      return cab + fila * Math.min(3, b.filas.length) + (b.filas.length <= 3 ? 10 + cola : 0);
    }
    case "marcador": return MARCADOR + 10 + cola;
    case "objetivos": return objAlto(b) + (b.items.length === 1 ? cola : 0);
    case "nota": return altoNota(h, b);
    case "frase": return altoFrase(h, b) - 10 + cola;
    case "cajas": return altoCajas(h, b) - 10 + cola;
    default: return 0;
  }
}

// bloques: los de informe.js; meta: {titulo, pie, generado}. Devuelve el documento de jsPDF.
export function armarPdf(JsPDF, bloques, meta) {
  const h = new Hoja(JsPDF, meta);
  // lo que ocupa la nota pegada abajo del bloque i (si la hay)
  const cola = (i) => (bloques[i + 1]?.tipo === "nota" && bloques[i]?.tipo !== "seccion" ? altoNota(h, bloques[i + 1]) : 0);
  bloques.forEach((b, i) => {
    h.cola = cola(i);
    DIBUJAR[b.tipo](h, b, bloques[i + 1], cola(i + 1));
  });
  h.pies();
  return h.doc;
}
