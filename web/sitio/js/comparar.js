// Las cuentas de la pestaña Comparar (nov 2026): cuánto cambió algo de una
// temporada a otra y si ese cambio es firme o puede ser casualidad.
//
// Con pocos partidos, una diferencia chica aparece sola aunque el equipo
// juegue igual (68% contra 66% de pateo no dice nada). Cada cambio trae `z`:
// la diferencia medida en "cuántas veces el vaivén esperable por azar". Si
// |z| no llega a Z_FIRME, el cambio se muestra como "Parecido" (gris) y no se
// pinta ni a favor ni en contra.
//
// - X de Y (line ganado, tackles): prueba de dos proporciones.
// - Conteos por partido (tries, penales): dos tasas de Poisson.
// - Promedios (puntos): el desvío entre partidos de las temporadas que lo
//   tienen partido a partido (la planilla 2025 no: se usa el de la otra).
//
// Z_FIRME = 1,645 (90%): menos exigente que el 95% de un paper, a propósito:
// es para mirar un equipo, no para publicar. Con 1,96 casi todo quedaría gris.
import { pct, redondear } from "./formato.js";

export const Z_FIRME = 1.645, MIN_CONTEO = 10;

const signo = (x) => (x > 0 ? 1 : x < 0 ? -1 : 0);
const firme = (z, dir) => dir !== 0 && Math.abs(z) >= Z_FIRME;

// Las jugadas de un mismo partido no son independientes: si un partido sale
// mal, salen mal muchas juntas, y los partidos varían más de lo que daría el
// azar jugada a jugada. phi (>= 1) mide cuánto más, con los partidos de las
// temporadas que lo tienen partido a partido (quasi-binomial / quasi-Poisson):
// el vaivén esperable se agranda por raíz de phi. Sin partidos con qué
// medirlo, phi = 1.
// grupos: una lista por temporada (o null): [[a, b] de cada partido].
export function dispersionProporcion(grupos) {
  let suma = 0, libres = 0;
  for (const g of grupos) {
    const ms = (g ?? []).filter(([, b]) => b);
    if (ms.length < 3) continue;
    const p = ms.reduce((s, [a]) => s + a, 0) / ms.reduce((s, [, b]) => s + b, 0);
    if (p <= 0 || p >= 1) continue;
    for (const [a, b] of ms) suma += (a - b * p) ** 2 / (b * p * (1 - p));
    libres += ms.length - 1;
  }
  return libres ? Math.max(1, suma / libres) : 1;
}

// Lo mismo para un conteo por partido. grupos: [[cantidad de cada partido]].
export function dispersionConteo(grupos) {
  let suma = 0, libres = 0;
  for (const g of grupos) {
    if (!g || g.length < 3) continue;
    const m = g.reduce((s, c) => s + c, 0) / g.length;
    if (!m) continue;
    for (const c of g) suma += (c - m) ** 2 / m;
    libres += g.length - 1;
  }
  return libres ? Math.max(1, suma / libres) : 1;
}

// X de Y: [a, b] de la temporada nueva y de la vieja. null si a alguna le
// falta el dato. antes/ahora: los % que se muestran; dir, con esos mismos %.
export function cambioProporcion([a1, b1], [a0, b0], phi = 1) {
  if (!b1 || !b0) return null;
  const p1 = a1 / b1, p0 = a0 / b0, p = (a1 + a0) / (b1 + b0);
  const se = Math.sqrt(phi * p * (1 - p) * (1 / b1 + 1 / b0));
  const z = se ? (p1 - p0) / se : 0;
  const antes = pct(a0, b0), ahora = pct(a1, b1), dir = signo(ahora - antes);
  return { antes, ahora, dir, z, firme: firme(z, dir), rel: null };
}

// El % de diferencia de un promedio respecto del de antes (null contra cero).
const relativo = (r1, r0) => (r0 ? redondear(((r1 - r0) * 100) / r0) : null);

// Un conteo por partido (tries, penales): c1 en n1 partidos, c0 en n0.
export function cambioConteo(c1, n1, c0, n0, phi = 1) {
  if (!n1 || !n0) return null;
  const r1 = c1 / n1, r0 = c0 / n0;
  const se = Math.sqrt(phi * (c1 / (n1 * n1) + c0 / (n0 * n0)));
  const z = se ? (r1 - r0) / se : 0;
  const dir = signo(r1 - r0);
  // con menos de 10 entre las dos (4 contra 0) la cuenta no alcanza para decir nada
  return { antes: r0, ahora: r1, dir, z, firme: c1 + c0 >= MIN_CONTEO && firme(z, dir), rel: relativo(r1, r0) };
}

// Un promedio que no es un conteo (puntos): t1 en n1 partidos, t0 en n0.
// muestras: los valores partido a partido de las temporadas que los tienen
// ([[...], [...]]; puede faltar alguna). Sin ninguna, no se puede saber: firme
// sólo si cambia 10% o más.
export function cambioPromedio(t1, n1, t0, n0, muestras) {
  if (!n1 || !n0) return null;
  const r1 = t1 / n1, r0 = t0 / n0, dir = signo(r1 - r0), rel = relativo(r1, r0);
  let suma = 0, libres = 0;
  for (const m of muestras.filter((x) => x && x.length >= 2)) {
    const media = m.reduce((s, v) => s + v, 0) / m.length;
    suma += m.reduce((s, v) => s + (v - media) ** 2, 0);
    libres += m.length - 1;
  }
  if (!libres) return { antes: r0, ahora: r1, dir, z: 0, firme: dir !== 0 && rel !== null && Math.abs(rel) >= 10, rel };
  const se = Math.sqrt(suma / libres) * Math.sqrt(1 / n1 + 1 / n0);
  const z = se ? (r1 - r0) / se : 0;
  return { antes: r0, ahora: r1, dir, z, firme: firme(z, dir), rel };
}

// "favor" | "contra" | "parecido". mejor: 1 si más es a favor de UNI (line
// ganado, puntos a favor), -1 si menos lo es (penales de UNI, puntos en contra).
export const tono = (c, mejor) => (!c.firme ? "parecido" : c.dir * mejor > 0 ? "favor" : "contra");

// Para la tira "cada punto es un partido": los valores ordenados, cada uno
// con su piso (0 abajo). Dos puntos a menos de `aire` de distancia no entran
// en el mismo piso: el segundo sube. Así ninguno tapa a otro.
export function enjambre(valores, aire) {
  const pisos = [];   // el último valor puesto en cada piso
  return [...valores].sort((x, y) => x - y).map((p) => {
    let nivel = pisos.findIndex((ultimo) => p - ultimo >= aire);
    if (nivel < 0) nivel = pisos.length;
    pisos[nivel] = p;
    return { p, nivel };
  });
}

// El eje de una tira: [desde, hasta, paso], en decenas que abarquen todo.
export function ejeDe(valores) {
  let desde = Math.floor(Math.min(...valores) / 10) * 10, hasta = Math.ceil(Math.max(...valores) / 10) * 10;
  if (hasta === desde) [desde, hasta] = [Math.max(0, desde - 10), Math.min(100, hasta + 10)];
  return [desde, hasta, hasta - desde <= 50 ? 10 : 20];
}
