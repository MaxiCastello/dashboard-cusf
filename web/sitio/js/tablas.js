// st.dataframe: la tabla de jugadores de TACKLES. Streamlit la dibuja con
// Glide Data Grid en un canvas; acá se dibuja igual, en un canvas, con las
// mismas cuentas de Glide (sacadas de su código, Streamlit 1.55; ver
// dashboard-cusf.MIGRACION.md, fase 4) para que se vea igual punto por punto:
// - el ancho de cada columna: el texto más largo de las 9 primeras filas y
//   la última (y el título) + 16px; las de ancho fijo, su ancho; la de
//   progreso, 150; lo que sobra se reparte en partes iguales (la última se
//   queda con el resto);
// - encabezado de 36px, filas de 35, las rayas en el último píxel de cada
//   fila y en el primero de cada columna;
// - el texto a 8,5px del borde, centrado con las medidas de la letra; los
//   números a la derecha;
// - la barra de progreso de Glide (range-cell) y su porcentaje.
// Se ordena tocando el encabezado: de menor a mayor (↑), de mayor a menor
// (↓) y otra vez como venía, con la comparación "smart" de Glide. Abajo hay
// una tabla de verdad, escondida, para el lector de pantalla.
import { html, poner } from "./piezas.js";
import { str } from "./python.js";

// El tema de Glide que usa Streamlit con los colores del tablero (medido).
const T = {
  bgCell: "#0a0c0f", bgHeader: "rgba(26, 28, 36, 1)", bgHeaderHovered: "rgba(157, 166, 185, 0.1)",
  textDark: "#e8eaf0", textHeader: "rgba(232, 234, 240, 0.6)", borderColor: "rgba(232, 234, 240, 0.1)",
  accentColor: "#1a6fd4", accentLight: "rgba(26, 111, 212, 0.1)", bgBubble: "#13161b",
  padding: 8, fuente: '400 14px "Source Sans", sans-serif, "Source Sans", sans-serif',
  fuenteBarra: '400 12.6px "Source Sans", sans-serif, "Source Sans", sans-serif',
};
const ALTO_ENC = 36, ALTO_FILA = 35, ANCHO_SIN_MEDIDA = 150;

// Lo que se ve en una celda: un número entero sin ".0" (pandas guarda 86.0
// cuando la columna tiene algún vacío), vacío si no hay dato.
const nulo = (v) => v === null || v === undefined;
const texto = (v) => (nulo(v) ? "" : str(v));

// "%d%%" de Streamlit (sprintf): la parte entera y el signo de por ciento.
const conFormato = (v, formato) => formato.replace("%d", str(Math.trunc(v))).replace("%%", "%");

// Glide: dónde va la línea de base para que el texto quede centrado (qn / tm).
const bases = new Map();
function base(ctx, fuente) {
  if (bases.has(fuente)) return bases.get(fuente);
  const medir = (b) => {
    ctx.save();
    ctx.textBaseline = b;
    const m = ctx.measureText("ABCDEFGHIJKLMNOPQRSTUVWXYZ");
    ctx.restore();
    return m;
  };
  ctx.font = fuente;
  const a = medir("alphabetic");
  const v = -(medir("middle").actualBoundingBoxDescent - a.actualBoundingBoxDescent) + a.actualBoundingBoxAscent / 2;
  bases.set(fuente, v);
  return v;
}

// Glide (Ul): el alto de la letra
function altoLetra(ctx, fuente) {
  ctx.font = fuente;
  const m = ctx.measureText("ABCi09jgqpy");
  return m.actualBoundingBoxAscent + m.actualBoundingBoxDescent;
}

// Glide (lc): rectángulo con las puntas redondeadas
function redondeado(ctx, x, y, w, h, r) {
  if (w <= 0 || h <= 0) return;
  r = Math.max(0, Math.min(r, h / 2, w / 2));
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + r, r);
  ctx.arcTo(x + w, y + h, x + w - r, y + h, r);
  ctx.arcTo(x, y + h, x, y + h - r, r);
  ctx.arcTo(x, y, x + r, y, r);
}

// La comparación "smart" de Glide (by / ac): lo que parece número, como
// número; los textos, como palabras.
const comoNumero = (e) => (typeof e === "number" ? e : e.length > 0 && !Number.isNaN(Number(e)) ? Number(e) : e);
export function compararSmart(a, b) {
  const e = comoNumero(a), t = comoNumero(b);
  if (typeof e === "string" && typeof t === "string") return e.localeCompare(t);
  if (typeof e === "number" && typeof t === "number") return e === t ? 0 : e > t ? 1 : -1;
  // eslint-disable-next-line eqeqeq -- así compara Glide (un vacío "" vale como 0)
  return e == t ? 0 : e > t ? 1 : -1;
}

export function tablaDatos(cont, columnas, filas, alto, config) {
  const tipoDe = (c, k) => config[c]?.type_config?.type ?? (filas.some((f) => typeof f[k] === "number") ? "number" : "text");
  const tipos = columnas.map(tipoDe);
  const titulos = columnas.map((c) => config[c]?.label ?? c);
  let orden = null;      // [columna, 1 | -1] o null = como vino
  let vista = filas;     // las filas en el orden que se ve
  let anchos = [], hover = -1, foco = -1;

  // lo que se usa para ordenar (vy de Glide): números como texto, vacío ""
  const valorOrden = (v, k) => (tipos[k] === "text" ? texto(v) : nulo(v) ? "" : String(v));

  // como Glide: el canvas queda pegado arriba a la izquierda adentro de la
  // caja que se corre (así el dedo y la rueda la corren como siempre), y
  // abajo un relleno del tamaño de toda la tabla
  poner(cont, html`<div class="caja" style="height:${alto}px"><div class="scroll"><canvas class="lienzo-tabla" aria-hidden="true"></canvas><div class="relleno"></div></div></div>
<table class="para-lector"><caption>Tabla</caption><thead><tr>${titulos.map((t) => html`<th scope="col"><button type="button">${t}</button></th>`)}</tr></thead><tbody></tbody></table>`);
  const caja = cont.querySelector(".caja"), scroll = cont.querySelector(".scroll"), canvas = cont.querySelector("canvas");
  const relleno = cont.querySelector(".relleno");
  const lector = cont.querySelector(".para-lector");

  function medirAnchos(ctx, disponible) {
    ctx.font = T.fuente;
    const muestra = filas.length > 10 ? [...filas.slice(0, 9), filas.at(-1)] : filas.slice(0, 10);
    const bases_ = columnas.map((c, k) => {
      if (config[c]?.width) return config[c].width;
      let u;
      if (tipos[k] === "progress") u = ANCHO_SIN_MEDIDA;   // la celda de progreso no se mide (Ml de Glide)
      else {
        const med = muestra.map((f) => ctx.measureText(texto(f[k])).width + T.padding * 2);
        u = Math.max(0, ...med);
        if (med.length > 5) {   // sin los que miden el doble del promedio
          const prom = med.reduce((s, m) => s + m, 0) / med.length;
          u = Math.max(0, ...med.map((m) => (m >= prom * 2 ? 0 : m)));
        }
      }
      u = Math.max(u, ctx.measureText(titulos[k]).width + T.padding * 2);
      return Math.max(50, Math.min(1000, Math.ceil(u)));   // minColumnWidth / maxColumnWidth de Streamlit
    });
    const total = bases_.reduce((s, w) => s + w, 0);
    if (total >= disponible) return bases_;
    const sobra = disponible - total;
    let resto = sobra;
    return bases_.map((w, i) => {
      const e = i === bases_.length - 1 ? resto : Math.min(resto, Math.floor(sobra / bases_.length));
      resto -= e;
      return w + e;
    });
  }

  // opaco, como Glide: así el navegador suaviza el texto igual (por subpíxel)
  const ctx = canvas.getContext("2d", { alpha: false });
  // (Glide: el alto de todo, 1px menos que encabezado + filas; medido, se nota al bajar hasta el fondo)
  const altoTotal = ALTO_ENC + filas.length * ALTO_FILA - 1;

  // Los tamaños: el canvas del tamaño de lo que se ve, el reparto de las
  // columnas y el relleno. Al empezar, al cambiar el lugar y cuando llega la letra.
  function acomodar() {
    const lienzo = () => {
      const dpr = window.devicePixelRatio ?? 1;
      canvas.style.width = `${scroll.clientWidth}px`;
      canvas.style.height = `${scroll.clientHeight}px`;
      canvas.width = Math.floor(scroll.clientWidth * dpr);
      canvas.height = Math.floor(scroll.clientHeight * dpr);
      relleno.style.height = `${Math.max(0, altoTotal - scroll.clientHeight)}px`;
    };
    // primero el alto (de él depende si hay barra para bajar), después las
    // columnas hasta el ancho que se ve (sin esa barra), y otra vez el alto
    // (si las columnas no entran, la barra de costado lo achica)
    lienzo();
    anchos = medirAnchos(ctx, scroll.clientWidth);
    relleno.style.width = `${anchos.reduce((s, w) => s + w, 0)}px`;
    lienzo();
    dibujar();
  }

  // un dibujo por cuadro (al correr la tabla con el dedo llegan muchos avisos)
  let pedido = null;
  const pedirDibujo = () => {
    pedido ??= requestAnimationFrame(() => {
      pedido = null;
      dibujar();
    });
  };

  function dibujar() {
    const dpr = window.devicePixelRatio ?? 1;
    const ancho = scroll.clientWidth, altoVisible = scroll.clientHeight;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.textBaseline = "middle";   // como Glide: todo el texto con la base al medio
    ctx.textAlign = "left";
    const y0 = scroll.scrollTop, x0 = scroll.scrollLeft;

    ctx.fillStyle = T.bgCell;
    ctx.fillRect(0, 0, ancho, altoVisible);
    const xs = [];
    anchos.reduce((x, w) => (xs.push(x), x + w), 0);
    const yBase = base(ctx, T.fuente);

    // las filas que se ven
    const primera = Math.max(0, Math.floor(y0 / ALTO_FILA));
    for (let r = primera; r < vista.length; r++) {
      const y = ALTO_ENC + r * ALTO_FILA - y0;
      if (y > altoVisible) break;
      // (el contenido de la fila va 1px más arriba que su raya de arriba, medido en Streamlit)
      columnas.forEach((c, k) => celda(ctx, vista[r][k], k, xs[k] - x0, y - 1, anchos[k], ALTO_FILA, yBase));
    }
    // las rayas: entre columnas (en el primer píxel de la siguiente) y debajo de cada fila
    ctx.beginPath();
    ctx.strokeStyle = T.borderColor;
    ctx.lineWidth = 1;
    let x = 0.5;
    for (const w of anchos) {
      x += w;
      ctx.moveTo(x - x0, ALTO_ENC);
      ctx.lineTo(x - x0, Math.min(altoVisible, ALTO_ENC + vista.length * ALTO_FILA - y0));
    }
    for (let r = primera; r < vista.length; r++) {
      const y = ALTO_ENC + (r + 1) * ALTO_FILA - y0 - 0.5;
      if (y > altoVisible) break;
      ctx.moveTo(0, y);
      ctx.lineTo(xs.at(-1) + anchos.at(-1) - x0, y);
    }
    ctx.stroke();

    // el encabezado, arriba siempre
    ctx.fillStyle = T.bgHeader;
    ctx.fillRect(0, 0, ancho, ALTO_ENC);
    columnas.forEach((c, k) => {
      const xc = xs[k] - x0;
      if (k === hover) {
        ctx.fillStyle = T.bgHeaderHovered;
        ctx.fillRect(xc, 0, anchos[k], ALTO_ENC);
      }
      const titulo = orden && orden[0] === k ? `${orden[1] > 0 ? "↑" : "↓"} ${titulos[k]}` : titulos[k];
      ctx.save();
      ctx.beginPath();
      ctx.rect(xc, 0, anchos[k], ALTO_ENC);
      ctx.clip();
      ctx.font = T.fuente;
      ctx.fillStyle = T.textHeader;
      ctx.fillText(titulo, xc + T.padding, ALTO_ENC / 2 + yBase);   // (bd() de Glide: sin el medio píxel)
      if (k === foco) {   // con el teclado (la tabla para el lector): dónde está
        ctx.strokeStyle = T.accentColor;
        ctx.lineWidth = 2;
        ctx.strokeRect(xc + 1, 1, anchos[k] - 2, ALTO_ENC - 2);
      }
      ctx.restore();
    });
    ctx.beginPath();
    ctx.strokeStyle = T.borderColor;
    x = 0.5;
    for (const w of anchos) {
      x += w;
      ctx.moveTo(x - x0, 0);
      ctx.lineTo(x - x0, ALTO_ENC);
    }
    ctx.moveTo(0, ALTO_ENC - 0.5);
    ctx.lineTo(ancho, ALTO_ENC - 0.5);
    ctx.stroke();
  }

  function celda(ctx, v, k, x, y, w, h, yBase) {
    ctx.save();
    ctx.beginPath();
    ctx.rect(x, y, w, h);
    ctx.clip();
    if (tipos[k] === "progress") {
      if (!nulo(v)) barra(ctx, v, config[columnas[k]].type_config, x, y, w, h);
    } else {
      const t = texto(v).slice(0, w / 4);   // rm() de Glide
      if (t) {
        ctx.font = T.fuente;
        ctx.fillStyle = T.textDark;
        if (tipos[k] === "number") {
          ctx.textAlign = "right";
          ctx.fillText(t, x + w - (T.padding + 0.5), y + h / 2 + yBase);
        } else {
          ctx.fillText(t, x + T.padding + 0.5, y + h / 2 + yBase);
        }
      }
    }
    ctx.restore();
  }

  // range-cell de Glide (la ProgressColumn de Streamlit)
  function barra(ctx, valor, tc, x, y, w, h) {
    const { min_value: mn, max_value: mx, format } = tc;
    const val = Math.min(mx, Math.max(mn, valor));
    const etiqueta = conFormato(valor, format), mayor = conFormato(mx, format);
    const medida = etiqueta.length > mayor.length ? etiqueta : mayor;
    const d = x + T.padding, g = y + h / 2, p = (val - mn) / (mx - mn);
    // Glide mide el alto con la letra que el canvas tiene puesta en ese
    // momento (la de la tabla, 14px), antes de pasar a la del porcentaje
    const v = altoLetra(ctx, T.fuente) / 2;
    ctx.font = T.fuenteBarra;
    const b = ctx.measureText(medida).width + T.padding;
    const ancho = w - T.padding * 2 - b;
    if (ancho >= v) {
      const grad = ctx.createLinearGradient(d, g, d + ancho, g);
      grad.addColorStop(0, T.accentColor);
      grad.addColorStop(p, T.accentColor);
      grad.addColorStop(p, T.bgBubble);
      grad.addColorStop(1, T.bgBubble);
      ctx.beginPath();
      ctx.fillStyle = grad;
      redondeado(ctx, d, g - v / 2, ancho, v, v / 2);
      ctx.fill();
      ctx.beginPath();
      redondeado(ctx, d + 0.5, g - v / 2 + 0.5, ancho - 1, v - 1, (v - 1) / 2);
      ctx.strokeStyle = T.accentLight;
      ctx.lineWidth = 1;
      ctx.stroke();
    }
    ctx.textAlign = "right";
    ctx.fillStyle = T.textDark;
    ctx.fillText(etiqueta, x + w - T.padding, g + base(ctx, T.fuenteBarra));
  }

  function ordenar(k) {
    orden = !orden || orden[0] !== k ? [k, 1] : orden[1] > 0 ? [k, -1] : null;
    if (!orden) vista = filas;
    else {
      const [col, dir] = orden;
      const vals = filas.map((f) => valorOrden(f[col], col));
      vista = filas.map((_, i) => i).sort((a, b) => compararSmart(vals[a], vals[b]) * dir).map((i) => filas[i]);
    }
    llenarLector();
    pedirDibujo();
  }

  function llenarLector() {
    poner(lector.querySelector("tbody"), html`${vista.map((f) => html`<tr>${f.map((v, k) => html`<td>${
      tipos[k] === "progress" ? (nulo(v) ? "" : conFormato(v, config[columnas[k]].type_config.format)) : texto(v)}</td>`)}</tr>`)}`);
    lector.querySelectorAll("th").forEach((th, k) => th.setAttribute("aria-sort",
      orden && orden[0] === k ? (orden[1] > 0 ? "ascending" : "descending") : "none"));
  }

  // la columna bajo el mouse (en el encabezado)
  const columnaEn = (ev) => {
    const r = canvas.getBoundingClientRect(), x = ev.clientX - r.left + scroll.scrollLeft, y = ev.clientY - r.top;
    if (y < 0 || y >= ALTO_ENC) return -1;
    let acc = 0;
    return anchos.findIndex((w) => (acc += w) > x);
  };
  scroll.addEventListener("scroll", pedirDibujo, { passive: true });
  canvas.addEventListener("click", (e) => {
    const k = columnaEn(e);
    if (k >= 0) ordenar(k);
  });
  // el encabezado se aclara con el mouse encima; con el dedo no (un toque
  // no avisa cuando se va y quedaría aclarado)
  canvas.addEventListener("pointermove", (e) => {
    const k = e.pointerType === "mouse" ? columnaEn(e) : -1;
    canvas.style.cursor = k >= 0 ? "pointer" : "default";
    if (k !== hover) {
      hover = k;
      pedirDibujo();
    }
  });
  canvas.addEventListener("pointerleave", () => {
    hover = -1;
    pedirDibujo();
  });
  lector.querySelectorAll("th button").forEach((b, k) => {
    b.addEventListener("click", () => ordenar(k));
    b.addEventListener("focus", () => {
      foco = k;
      caja.scrollIntoView({ block: "nearest" });
      const x = anchos.slice(0, k).reduce((s, w) => s + w, 0);
      if (x < scroll.scrollLeft || x + anchos[k] > scroll.scrollLeft + scroll.clientWidth) scroll.scrollLeft = x;
      pedirDibujo();
    });
    b.addEventListener("blur", () => {
      foco = -1;
      pedirDibujo();
    });
  });
  const mirar = new ResizeObserver(() => {
    if (!caja.isConnected) mirar.disconnect();   // la tabla ya no está (otro año): se la suelta
    else acomodar();
  });
  mirar.observe(caja);
  llenarLector();
  // el canvas no espera a la letra: dibuja con la de reemplazo y no se
  // entera cuando llega. Se la pide y, cuando está, se mide y dibuja de nuevo
  // (también lo que se guardó para centrar el texto, que era de la otra).
  Promise.all([T.fuente, T.fuenteBarra].map((f) => document.fonts?.load(f))).catch(() => null).then(() => {
    bases.clear();
    acomodar();
  });
  acomodar();
}
