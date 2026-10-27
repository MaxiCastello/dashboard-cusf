// Lo que dice el informe PDF (fase 6), sin dibujarlo: una lista de bloques
// (encabezado, números grandes, anillos, barras, tablas, notas) con los
// textos ya escritos. pdf.js los dibuja; las pruebas comparan esta lista
// con la que arma el Python con las mismas cuentas (pruebas/informe_modelo.py).
//
// No es una copia del informe del Python (cusf/informe.py, sólo tablas):
// el usuario pidió uno pensado para leer en el celular (27 oct). Los
// números son los mismos del tablero: salen de las mismas cuentas.
// Criterio de siempre: primero "X de Y" y después el porcentaje, sin jerga
// y sin decir si estuvo bien o mal. Lo que no tiene el dato no aparece
// (no es un 0).
//
// Colores por nombre: "uni", "rival", "acento", "aviso", "mal", "neutro" o null.
import { etiqueta, resultado, tacklesTemporada, una } from "./calculos.js";
import { coma, conSigno, fijo, pct, unDecimal, xdey } from "./formato.js";
import { OBJETIVOS, evaluar, minutosConUnoMenos, temporada as objetivoTemporada } from "./objetivos.js";
import { capitalizar, conDefecto, esVerdad, mayuscula, str } from "./python.js";
import { cuantos, desc, hechos, intentos, origenesTries, pateo, pen, porSituacion } from "./vistas.js";

const RESULTADO = { G: "Ganado", P: "Perdido", E: "Empatado" };
const ORIGEN = new Map([["unidat", "Cargado en Uni-Dat"], ["manual", "Cargado a mano en el tablero"],
  ["planilla", "Planilla 2025 (sólo tackles)"]]);

// "4 jul" (la fecha de la etiqueta corta) y "4 jul 2026"
const fechaCorta = (p) => etiqueta(p, true).split(" · ")[0];
const fechaLarga = (p) => (esVerdad(p.fecha) ? `${fechaCorta(p)} ${p.fecha.slice(0, 4)}` : str(conDefecto(p, "fecha_txt", "")));

// ── Las piezas ──────────────────────────────────────────────────────────────

const seccion = (titulo) => ({ tipo: "seccion", titulo });
const nota = (texto) => ({ tipo: "nota", texto });
const kpis = (items) => ({ tipo: "kpis", items: items.map(([valor, rotulo, color]) => ({ valor: str(valor), rotulo, color })) });
// cada anillo: "a de b" y el %; `abajo`: un renglón más chico (ej. la temporada)
const anillos = (items) => ({
  tipo: "anillos",
  items: items.map(([rotulo, a, b, color, grupo = null, abajo = null]) => ({ rotulo, a, b, pct: b ? pct(a, b) : null, color, grupo, abajo })),
});
// UNI hacia la izquierda, el rival hacia la derecha; `valor` es el largo de la barra
const mariposa = (titulo, filas, { nombres = ["UNI", "Rival"], colores = ["uni", "rival"], porCiento = false } = {}) => ({
  tipo: "mariposa", titulo, nombres, colores, porCiento,
  filas: filas.map(([rotulo, a, b, ta = str(a), tb = str(b)]) => ({ rotulo, a, b, ta, tb })),
});
// columnas: [[título, ancho relativo, "izq" | "der"]]
const tabla = (columnas, filas, { chica = false } = {}) => ({
  tipo: "tabla", chica, columnas: columnas.map(([titulo, ancho, alinear]) => ({ titulo, ancho, alinear })),
  filas: filas.map((f) => f.map((c) => str(c))),
});

// ── Secciones que comparten la temporada y el partido ───────────────────────

// Los anillos de "UNI en números" (los de la pestaña Resumen). `contra`: la
// temporada, para poner abajo de cada uno lo de toda la temporada.
function enNumeros(tot, ps, contra = null) {
  const [a, b] = pateo(tot);
  const items = [["Line propio ganado", tot.line.uGan, tot.line.uLan, "uni", null, ["line", "uGan", "uLan"]],
    ["Scrum propio ganado", tot.scrum.uGan, tot.scrum.uLan, "uni", null, ["scrum", "uGan", "uLan"]],
    ["Salidas propias ganadas", tot.salida.uGan, tot.salida.uPro, "uni", null, ["salida", "uGan", "uPro"]],
    ["Pateo a los palos", a, b, "acento", null, "pateo"]];
  const jug = tacklesTemporada(ps);
  if (jug.length) items.push(["Tackles completados", hechos(jug), intentos(jug), "uni", null, "tackles"]);
  if (esVerdad(tot.efectividad_22)) {
    const ef = tot.efectividad_22;
    items.push(["Chances en 22 concretadas", ef.concretadas, ef.chances, "acento", null, "chances"]);
  }
  return anillos(items.map(([rotulo, x, y, color, grupo, de]) => {
    let abajo = null;
    if (contra) {
      const ct = contra.totales;
      let ca, cb;
      if (de === "pateo") [ca, cb] = pateo(ct);
      else if (de === "tackles") {
        const jt = tacklesTemporada(contra.partidos);
        [ca, cb] = [hechos(jt), intentos(jt)];
      } else if (de === "chances") [ca, cb] = esVerdad(ct.efectividad_22) ? [ct.efectividad_22.concretadas, ct.efectividad_22.chances] : [0, 0];
      else [ca, cb] = [ct[de[0]][de[1]], ct[de[0]][de[2]]];
      abajo = `Temporada: ${xdey(ca, cb)}`;
    }
    return [rotulo, x, y, color, grupo, abajo];
  }));
}

function losPuntos(t) {
  const p = t.totales.puntos;
  const out = [seccion("Los puntos")];
  const filas = [["Tries", p.tries_u, p.tries_r]];
  if (p.triesp_u || p.triesp_r) filas.push(["Tries penales", p.triesp_u, p.triesp_r]);
  filas.push(["Conversiones", p.conv_u, p.conv_r], ["Penales a los palos", p.palos_u, p.palos_r]);
  if (p.drop_u || p.drop_r) filas.push(["Drops", p.drop_u, p.drop_r]);
  out.push(mariposa("Cuántas veces anotó cada uno", filas));
  out.push(nota("Un try vale 5, un try penal 7, una conversión 2, un penal o un drop 3."));
  const pateoFilas = [["Conversiones", xdey(p.conv_u, p.convt_u), xdey(p.conv_r, p.convt_r)],
    ["Penales a los palos", xdey(p.palos_u, p.palost_u), xdey(p.palos_r, p.palost_r)]];
  if (p.dropt_u || p.dropt_r) pateoFilas.push(["Drops", xdey(p.drop_u, p.dropt_u), xdey(p.drop_r, p.dropt_r)]);
  out.push(tabla([["Pateo a los palos", 2, "izq"], ["UNI", 1.4, "der"], ["Rival", 1.4, "der"]], pateoFilas));

  const orig = origenesTries(t.partidos);
  if (orig.length) out.push(mariposa("De dónde salieron los tries", orig.map(([k, u, r]) => [capitalizar(k), u, r])));

  // las chances en 22: el total va en los anillos; acá, una por partido
  const filas22 = t.planilla
    ? t.serie_22.map((r) => [r.rival, r.concretadas, r.chances])
    : t.partidos.filter((q) => esVerdad(q.efectividad_22)).map((q) => [etiqueta(q, true), q.efectividad_22.concretadas, q.efectividad_22.chances]);
  if (filas22.length > 1) {
    out.push(tabla([["Chances en 22, partido a partido", 3, "izq"], ["Concretadas", 2, "der"]],
      filas22.map(([q, c, n]) => [q, xdey(c, n)])));
    out.push(nota("Cuántas veces UNI entró en la 22 rival y cuántas de esas terminaron en puntos (se carga a mano)."));
  }
  return out;
}

function formaciones(t) {
  const tot = t.totales;
  const filas = [["Line", "line", "uLan", "rLan"], ["Scrum", "scrum", "uLan", "rLan"], ["Salidas", "salida", "uPro", "rPro"],
    ["Salidas de 22", "salida22", "uPro", "rPro"], ["Salidas del ingoal", "salida_ingoal", "uPro", "rPro"]]
    .filter(([, k]) => k === "line" || k === "scrum" || tot[k].uPro || tot[k].rPro)
    .map(([nombre, k, l, rl]) => {
      const f = tot[k];
      return [nombre, f[l] ? pct(f.uGan, f[l]) : 0, f[rl] ? pct(f.rGan, f[rl]) : 0, xdey(f.uGan, f[l]), xdey(f.rGan, f[rl])];
    });
  const out = [seccion("Formaciones"), mariposa("Propias ganadas", filas, { porCiento: true }),
    nota("De las que lanzó o sacó cada equipo, cuántas se quedó. La barra es el %.")];
  if (esVerdad(tot.knockons)) {
    out.push(kpis([[tot.knockons.uni, "Knock-ons de UNI", "uni"], [tot.knockons.rival, "Knock-ons del rival", "rival"]]));
  }
  return out;
}

function penales(t) {
  const tot = t.totales, n = Math.max(t.n_partidos, 1);
  const pu = pen(tot), pr = pen(tot, "rival");
  const items = [[pu, "Cometidos por UNI", "uni"], [pr, "Cometidos por el rival", "rival"]];
  if (n > 1) items.splice(1, 0, [unDecimal(pu / n), "UNI por partido", "uni"]);
  const out = [seccion("Penales"), kpis(items)];
  if (!tot.penales.length) {
    out.push(nota("No hay penales cargados."));
    return out;
  }
  out.push(mariposa("Dónde se cometen", porSituacion(tot.penales)));
  // los de UNI, de más a menos (los 10 primeros)
  const mot = tot.penales.filter((f) => f.uni).sort((a, b) => b.uni - a.uni).slice(0, 10);
  if (mot.length) {
    out.push(tabla([["Los motivos de UNI", 3, "izq"], ["Situación", 1.6, "izq"], ["UNI", 1, "der"], ["Rival", 1, "der"]],
      mot.map((f) => [f.motivo, f.situacion, f.uni, f.rival])));
  }
  return out;
}

// Un partido son 80 minutos: los minutos con uno menos, dichos en partidos
// (lo pidió el usuario: "260 minutos con uno menos son más de 3 partidos").
const MIN_PARTIDO = 80;
const enPartidos = (n) => (n === 1 ? "1 partido entero" : `${n} partidos enteros`);

// La frase de un lado (UNI o el rival). enUno: el informe de un partido.
function conUnoMenos(quien, m, enUno) {
  if (enUno) {
    if (!m) return `${quien} jugó los ${MIN_PARTIDO} minutos con los 15.`;
    if (m > MIN_PARTIDO) {
      return `${quien} sumó ${m} minutos con uno menos: más que los ${MIN_PARTIDO} del partido, porque hubo ratos con más de uno afuera.`;
    }
    return `${quien} jugó ${m} de los ${MIN_PARTIDO} minutos con uno menos.`;
  }
  if (!m) return `${quien} no jugó ningún minuto con uno menos.`;
  if (m < MIN_PARTIDO) return `${quien} jugó ${m} minutos con uno menos: menos de un partido (un partido son ${MIN_PARTIDO} minutos).`;
  const n = Math.floor(m / MIN_PARTIDO), r = m % MIN_PARTIDO;
  return `${quien} jugó ${m} minutos con uno menos: es lo mismo que ${enPartidos(n)}${r ? ` y ${r} minutos más` : ""}.`;
}

// "2 amarillas · 1 roja", "1 amarilla" o "—"
function cuantasTarjetas(am, ro) {
  const partes = [];
  if (am) partes.push(am === 1 ? "1 amarilla" : `${am} amarillas`);
  if (ro) partes.push(ro === 1 ? "1 roja" : `${ro} rojas`);
  return partes.length ? partes.join(" · ") : "—";
}

function tarjetas(t) {
  const tj = t.totales.tarjetas, n = Math.max(t.n_partidos, 1), ps = t.partidos;
  const mu = minutosConUnoMenos(tj, "u"), mr = minutosConUnoMenos(tj, "r");
  const items = [[tj.am_u, "Amarillas UNI", "aviso"], [tj.ro_u, "Rojas UNI", "mal"]];
  if (n > 1) items.push([coma((tj.am_u + tj.ro_u) / n), "Tarjetas UNI por partido", null]);
  items.push([`${mu}'`, "Minutos UNI con uno menos", "uni"], [`${mr}'`, "Minutos del rival con uno menos", "rival"]);
  const enUno = ps.length === 1;
  const out = [seccion("Tarjetas"), kpis(items), { tipo: "frase", lineas: [
    { texto: conUnoMenos("UNI", mu, enUno), color: "uni" }, { texto: conUnoMenos("El rival", mr, enUno), color: "rival" }] }];
  // partido a partido: sólo los que tuvieron alguna tarjeta
  const con = ps.filter((p) => minutosConUnoMenos(p.tarjetas, "u") || minutosConUnoMenos(p.tarjetas, "r"));
  if (!enUno && con.length) {
    out.push(tabla([["Tarjetas, partido a partido", 3, "izq"], ["Tarjetas UNI", 2.1, "der"], ["Minutos UNI", 1.5, "der"],
      ["Minutos rival", 1.5, "der"]], con.map((p) => [etiqueta(p, true), cuantasTarjetas(p.tarjetas.am_u, p.tarjetas.ro_u),
      `${minutosConUnoMenos(p.tarjetas, "u")}'`, `${minutosConUnoMenos(p.tarjetas, "r")}'`])));
  }
  out.push(nota(`Cada amarilla son 10 minutos afuera y cada roja 20 (con una roja definitiva se cuentan igual 20). Un partido son ${
    MIN_PARTIDO} minutos.${!enUno && con.length ? " En la tabla, los minutos que cada equipo jugó con uno menos en ese partido." : ""}`));
  return out;
}

// "8 de 9 · 89%" o la cantidad.
const valor = (e) => (e.b !== null ? xdey(e.a, e.b) : str(e.a));

function objetivos(t) {
  const ps = t.partidos;
  const out = [seccion("Objetivos")];
  if (ps.length === 1) {
    out.push({
      tipo: "objetivos", partidos: null, items: OBJETIVOS.map((ob) => {
        const e = evaluar(ob, ps[0]);
        return { nombre: ob.nombre, meta: ob.meta, marca: e ? (e.cumple ? "si" : "no") : null,
          grande: e ? (e.cumple ? "Sí" : "No") : "Sin datos", chico: "", detalle: e ? `En el partido: ${valor(e)}` : "" };
      }),
    });
    return out;
  }
  out.push({
    tipo: "objetivos", partidos: ps.map((p) => etiqueta(p, true)), items: OBJETIVOS.map((ob) => {
      const s = objetivoTemporada(ob, ps);
      let det;
      if (!s.medidos) det = "Sin datos en ningún partido";
      else if (s.b !== null) det = `Temporada: ${xdey(s.a, s.b)}`;
      else det = `Temporada: ${coma(s.a / s.medidos)} por partido`;
      if (s.sin_datos && s.medidos) det += ` (${s.sin_datos} sin datos)`;
      return { nombre: ob.nombre, meta: ob.meta, marca: null, grande: s.medidos ? `${s.cumplidos} de ${s.medidos}` : "—",
        chico: s.medidos ? "partidos" : "", detalle: det,
        marcas: ps.map((p) => {
          const e = evaluar(ob, p);
          return e ? (e.cumple ? "si" : "no") : null;
        }) };
    }),
  });
  out.push(nota("Cada cuadradito es un partido, del primero al último: verde con tilde, se cumplió; rojo con cruz, no; " +
    "vacío, falta el dato."));
  return out;
}

// De titular, en cuántos partidos; "—" si a alguno le falta el número de
// camiseta (como pjTexto: los de adentro no sumarían el total).
const titular = (j) => (j.tit + j.sup === j.pj ? j.tit : "—");

// partido: los tackles de un partido solo (sin PJ, con los de cada tiempo)
function tackles(ps, partido = null) {
  const jug = tacklesTemporada(ps);
  const out = [seccion("Tackles")];
  if (!jug.length) {
    out.push(nota("No hay tackles cargados."));
    return out;
  }
  const total = intentos(jug), hech = hechos(jug), err = jug.reduce((s, j) => s + j.err, 0);
  const conTk = ps.filter((p) => p.tackles.length).length;
  const items = [[total, "Intentos de tackle", null], [`${hech} de ${total}`, "Completados", "uni"], [err, "Errados", "mal"]];
  if (conTk > 1) items.splice(1, 0, [fijo(total / conTk, 0), "Intentos por partido", null]);
  out.push(kpis(items));
  if (partido && partido.tackles.some((f) => f.pt || f.st)) {
    const s = (k) => partido.tackles.reduce((a, f) => a + f[k], 0);
    out.push(anillos([["Completados", s("pt") - s("pt_err"), s("pt"), "uni", "1° tiempo"],
      ["Completados", s("st") - s("st_err"), s("st"), "uni", "2° tiempo"]]));
  }
  // de más a menos hechos; empatados, el que tiene más completados (como la tabla del tablero)
  const filas = jug.map((j) => ({ j, h: hechos([j]), c: intentos([j]) ? pct(hechos([j]), intentos([j])) : null }));
  filas.sort((a, b) => desc(a.h, b.h) || desc(a.c, b.c));
  // completados = hechos de intentos (hechos: positivos + neutrales + negativos)
  const cols = partido
    ? [["Jugador", 3.4, "izq"], ["Completados", 2.3, "der"], ["Errados", 1.2, "der"],
      ["Positivos", 1.3, "der"], ["Neutrales", 1.3, "der"], ["Negativos", 1.3, "der"]]
    : [["Jugador", 2.8, "izq"], ["PJ", 0.6, "der"], ["Titular", 1, "der"], ["Completados", 2.1, "der"], ["Errados", 1.05, "der"],
      ["Positivos", 1.2, "der"], ["Neutrales", 1.2, "der"], ["Negativos", 1.2, "der"]];
  out.push(tabla(cols, filas.map(({ j, h }) => [j.nombre, ...(partido ? [] : [j.pj, titular(j)]), xdey(h, h + j.err), j.err,
    j.pos, j.neu, j.neg]), { chica: !partido }));
  out.push(nota("Completados: los tackles hechos de todos los que intentó. Un tackle positivo, neutral o negativo se completó " +
    "(el negativo también); el errado no." +
    (partido ? "" : " PJ: partidos en la lista del Tackle Tracker; titular: en cuántos tuvo la camiseta 1 a 15.")));
  return out;
}

// ── El informe de la temporada ──────────────────────────────────────────────

export function informeTemporada(t, categoria) {
  const ps = t.partidos, tot = t.totales, n = t.n_partidos;
  let detalle;
  if (t.planilla) detalle = `${n} partidos · sólo totales de la temporada y tackles de cada partido`;
  else if (ps.length === 1) detalle = `1 partido · ${fechaCorta(ps[0])}`;
  else detalle = `${ps.length} partidos · del ${fechaCorta(ps[0])} al ${fechaCorta(ps.at(-1))}`;
  const b = [{ tipo: "encabezado", titulo: `Temporada ${t.anio} · ${t.planilla ? "Planilla" : str(categoria)}`, detalle, marcador: null }];

  b.push(seccion("La temporada en números"));
  const items = [[n, "Partidos", null]];
  if (!t.planilla) {
    const r = ps.map(resultado);
    items.push([`${cuantos(r, "G")}-${cuantos(r, "E")}-${cuantos(r, "P")}`, "Ganó-empató-perdió", null]);
  }
  items.push([tot.score_uni, "Puntos a favor", "uni"], [tot.score_rival, "Puntos en contra", "rival"],
    [conSigno(tot.score_uni - tot.score_rival), "Diferencia", null]);
  if (n) items.push([unDecimal(pen(tot) / n), "Penales UNI por partido", null]);
  b.push(kpis(items));
  b.push(seccion("UNI en números"), enNumeros(tot, ps), nota("Cada anillo: cuántas salieron bien de cuántas hubo, y el %."));

  if (!t.planilla && ps.length) {
    b.push(seccion("Partido a partido"));
    b.push(tabla([["Partido", 3, "izq"], ["Resultado", 1.6, "der"], ["Line propio", 2.2, "der"], ["Scrum propio", 2.2, "der"],
      ["Penales", 1.1, "der"]], ps.map((p) => [etiqueta(p, true), `${resultado(p)} ${p.score_uni}–${p.score_rival}`,
      xdey(p.line.uGan, p.line.uLan), xdey(p.scrum.uGan, p.scrum.uLan), pen(p)])));
    b.push(nota("Resultado: G ganó, E empató, P perdió. Penales: los que cometió UNI."));
  }
  b.push(...losPuntos(t), ...formaciones(t), ...penales(t));
  if (!t.planilla) b.push(...tarjetas(t), ...objetivos(t));
  b.push(...tackles(ps));
  return b;
}

// ── El informe de un partido ────────────────────────────────────────────────

// t: la temporada del partido; tp: el partido como temporada de uno (una()).
export function informePartido(p, t, tp) {
  if (t.planilla) {
    return [{ tipo: "encabezado", titulo: `${fechaLarga(p)} · ${p.rival}`, detalle: `Temporada ${t.anio} · de la planilla, sólo los tackles`,
      marcador: null }, ...tackles([p], p)];
  }
  let origen = ORIGEN.get(p.fuente) ?? "";
  if (esVerdad(p.tarjetas_unidat)) origen += " (tarjetas corregidas en el tablero)";
  const cat = esVerdad(p.categoria) ? ` · ${str(p.categoria)}` : "";
  const b = [{ tipo: "encabezado", titulo: `Temporada ${t.anio}`,
    detalle: `${fechaLarga(p)}${cat} · ${RESULTADO[resultado(p)]} · ${origen}`,
    marcador: { uni: str(p.score_uni), rival: str(p.score_rival), nombre: mayuscula(p.rival) } }];

  // primero cómo fue el partido, después los números
  if (esVerdad(p.marcador)) {
    b.push(seccion("Cómo se fue dando el marcador"), { tipo: "marcador", evol: p.marcador.map((e) => ({
      periodo: e.periodo, u: e.u, r: e.r, quien: e.eq === "UNI" ? "UNI" : "Rival", como: str(e.como) })) });
    b.push(nota("Cada paso es una anotación, en el orden en que se cargó (Uni-Dat no guarda los minutos)."));
  }
  const conTemporada = t.partidos.length >= 2;
  b.push(seccion("El partido en números"), enNumeros(tp.totales, [p], conTemporada ? t : null));
  b.push(nota(conTemporada ? `Abajo de cada anillo, lo mismo sumando los ${t.partidos.length} partidos de la temporada.`
    : "Cada anillo: cuántas salieron bien de cuántas hubo, y el %."));
  if (conTemporada) {
    const n = t.partidos.length, tot = t.totales;
    const prom = (v) => unDecimal(v / n);
    const x = (f, g, l) => xdey(f[g], f[l]);
    const [pa, pb] = pateo(p), [ta, tb] = pateo(tot);
    b.push(seccion("Este partido y la temporada"), tabla([["", 2.6, "izq"], ["Este partido", 2, "der"], [`Temporada (${n})`, 2, "der"]], [
      ["Puntos a favor", p.score_uni, prom(tot.score_uni)], ["Puntos en contra", p.score_rival, prom(tot.score_rival)],
      ["Line propio ganado", x(p.line, "uGan", "uLan"), x(tot.line, "uGan", "uLan")],
      ["Scrum propio ganado", x(p.scrum, "uGan", "uLan"), x(tot.scrum, "uGan", "uLan")],
      ["Salidas propias ganadas", x(p.salida, "uGan", "uPro"), x(tot.salida, "uGan", "uPro")],
      ["Pateo a los palos", xdey(pa, pb), xdey(ta, tb)], ["Penales cometidos por UNI", pen(p), prom(pen(tot))]]));
    b.push(nota("En puntos y penales, la temporada es el promedio por partido; en el resto, la suma."));
  }
  if (esVerdad(p.periodos)) {
    const a = p.periodos.PT, s = p.periodos.ST;
    const fila = (rotulo, k) => [rotulo, a[`${k}_u`], a[`${k}_r`], s[`${k}_u`], s[`${k}_r`]];
    const fp = (rotulo, k, l, rl) => [rotulo, xdey(a[k].uGan, a[k][l]), xdey(a[k].rGan, a[k][rl]), xdey(s[k].uGan, s[k][l]),
      xdey(s[k].rGan, s[k][rl])];
    b.push(seccion("1° vs 2° tiempo"), tabla([["", 2.2, "izq"], ["1° T UNI", 1.5, "der"], ["1° T Rival", 1.5, "der"],
      ["2° T UNI", 1.5, "der"], ["2° T Rival", 1.5, "der"]], [fila("Puntos", "pts"), fila("Tries", "tries"),
      fila("Penales cometidos", "pen"), fila("Knock-ons", "ko"), fila("Tarjetas", "tar"),
      fp("Line propio", "line", "uLan", "rLan"), fp("Scrum propio", "scrum", "uLan", "rLan"),
      fp("Salidas propias", "salida", "uPro", "rPro")]));
    if (esVerdad(p.tarjetas_unidat)) b.push(nota("Las tarjetas por tiempo son las de Uni-Dat: el total del partido se corrigió en el tablero."));
  }
  b.push(...losPuntos(tp), ...formaciones(tp), ...penales(tp), ...tarjetas(tp), ...objetivos(tp), ...tackles([p], p));
  return b;
}

// El nombre del archivo: el título con _ (sin · ni espacios).
export function nombreArchivo(partes) {
  return `${["Informe", ...partes].map((x) => str(x)).join(" ").replace(/[^\p{L}\p{N}-]+/gu, "_").replace(/^_|_$/g, "")}.pdf`;
}

// Todo lo de un informe: los bloques, el título del documento, el renglón del
// pie y el nombre del archivo. p: un partido de la temporada t, o null.
export function informe(t, categoria, p = null) {
  if (!p) {
    const nombre = t.planilla ? `Temporada ${t.anio} · Planilla` : `Temporada ${t.anio} · ${str(categoria)}`;
    return { bloques: informeTemporada(t, categoria), titulo: `Informe ${nombre}`, pie: `Universitario Rugby · ${nombre}`,
      archivo: nombreArchivo(t.planilla ? ["Temporada", t.anio, "planilla"] : ["Temporada", t.anio, categoria]) };
  }
  if (t.planilla) {
    return { bloques: informePartido(p, t, null), titulo: `Informe ${fechaLarga(p)} · ${p.rival}`,
      pie: `Universitario Rugby · ${fechaLarga(p)} · ${p.rival}`, archivo: nombreArchivo([t.anio, fechaLarga(p), p.rival]) };
  }
  const nombre = `UNI ${p.score_uni}-${p.score_rival} ${mayuscula(p.rival)}`;
  return { bloques: informePartido(p, t, una(p, t)), titulo: `Informe ${nombre} · ${fechaLarga(p)}`,
    pie: `Universitario Rugby · ${nombre} · ${fechaLarga(p)}`, archivo: nombreArchivo([p.fecha, nombre]) };
}
