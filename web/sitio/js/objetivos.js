// Los objetivos que se pone el equipo, y si se cumplieron en cada partido
// (cusf/objetivos.py).
//
// Cada objetivo mide un partido y devuelve [a, b]:
// - con b: "a de b" (ej. 8 de 9 lines propios ganados);
// - con b = null: una cantidad (ej. 7 penales).
// Si el partido no tiene el dato, devuelve null: "sin datos", que no es
// "no cumplido".

// Minutos que el equipo juega con uno menos por cada tarjeta. Amarilla: 10
// (sin-bin). Roja: 20, como la roja de 20 minutos de World Rugby (después
// entra un reemplazo); una roja definitiva deja uno menos hasta el final.
export const MIN_AMARILLA = 10;
export const MIN_ROJA = 20;

export function penales(p, lado = "uni") {
  return p.penales.reduce((s, f) => s + f[lado], 0);
}

export function minutosConUnoMenos(tj, lado = "u") {
  return tj[`am_${lado}`] * MIN_AMARILLA + tj[`ro_${lado}`] * MIN_ROJA;
}

// "a de b"; sin datos si no hubo ninguno (0 de 0 no se puede medir).
const de = (a, b) => (a !== null && a !== undefined && b ? [a, b] : null);

function chances(p) {
  const e = p.efectividad_22;
  return e ? de(e.concretadas, e.chances) : null;
}

export const OBJETIVOS = [
  { nombre: "Line propio", meta: "Ganar el 100% de los lines propios",
    medir: (p) => de(p.line.uGan, p.line.uLan), cumple: (a, b) => a === b },
  { nombre: "Scrum propio", meta: "Ganar el 100% de los scrums propios",
    medir: (p) => de(p.scrum.uGan, p.scrum.uLan), cumple: (a, b) => a === b },
  { nombre: "Salidas del rival", meta: "Quedarse con el 100% de las salidas que patea el rival",
    medir: (p) => de(p.salida.uRec, p.salida.rPro), cumple: (a, b) => a === b },
  { nombre: "Chances en 22", meta: "Convertir en puntos el 60% de las chances en 22",
    medir: chances, cumple: (a, b) => a * 100 >= 60 * b },
  { nombre: "Penales: menos de la mitad", meta: "Cometer menos de la mitad de los penales del partido",
    medir: (p) => de(penales(p), penales(p) + penales(p, "rival")), cumple: (a, b) => a * 2 < b },
  { nombre: "Penales: menos de 10", meta: "Cometer menos de 10 penales por partido",
    medir: (p) => [penales(p), null], cumple: (a) => a < 10 },
  { nombre: "Tarjetas: ninguna", meta: "0 tarjetas por partido",
    medir: (p) => [p.tarjetas.am_u + p.tarjetas.ro_u, null], cumple: (a) => a === 0 },
];

// {a, b, cumple} del partido, o null si no tiene el dato.
export function evaluar(obj, p) {
  const m = obj.medir(p);
  if (m === null) return null;
  const [a, b] = m;
  return { a, b, cumple: obj.cumple(a, b) };
}

// La temporada de un objetivo: la suma de los partidos que tienen el dato
// (a, b, cuántos son) y en cuántos se cumplió.
export function temporada(obj, partidos) {
  const ev = partidos.map((p) => evaluar(obj, p)).filter((e) => e !== null);
  const conB = ev.every((e) => e.b !== null);
  return {
    a: ev.reduce((s, e) => s + e.a, 0),
    b: ev.length && conB ? ev.reduce((s, e) => s + e.b, 0) : null,
    medidos: ev.length, cumplidos: ev.filter((e) => e.cumple).length,
    sin_datos: partidos.length - ev.length,
  };
}
