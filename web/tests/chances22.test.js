// Chances en 22 cargadas en Uni-Dat (sección CHANCES EN 22, nov 2026): el
// tablero las cuenta de los eventos "CHANCE 22" del partido. PRIORIDAD
// UNI-DAT: si el partido las tiene, valen ésas; si no, las cargadas a mano en
// el complemento, como siempre. Los partidos de antes, sin esos eventos,
// tienen que quedar exactamente como eran.
import assert from "node:assert/strict";
import { test } from "node:test";

import { chances22Stats, partidosBase } from "../sitio/js/calculos.js";
import { armarComplemento, chancesUnidat, valoresComplemento } from "../sitio/js/carga.js";

const ID = "11111111-1111-4111-8111-111111111111";
// un evento como lo guarda Uni-Dat (addChance de index.html)
const chance = (res, periodo = "PT") =>
  ({ tipo: "CHANCE 22", equipo: "UNI", periodo, detalle: `Equipo: UNI | Resultado: ${res}`, data: { equipo: "UNI", resultado: res } });
const fila = (id, eventos) => ({ id, rival: "X", categoria: "Primera", fecha: "2026-11-07", score_uni: 0, score_rival: 0, main: { eventos } });
const uno = (unidat, manuales = []) => partidosBase(unidat, manuales)[0];
const aMano = (datos) => [{ id: ID, partido_id: "a", datos }];
const TJ = { am_u: 1, ro_u: 0, am_r: 0, ro_r: 0 };

test("cuenta sólo las CHANCE 22 de UNI; sin ninguna, null", () => {
  const otros = [{ tipo: "KNOCKON", equipo: "UNI", data: {} }, { tipo: "CHANCE 22", equipo: "RIVAL", data: { resultado: "SI" } }];
  assert.deepEqual(chances22Stats([chance("SI"), chance("NO"), chance("SI", "ST"), ...otros]), { chances: 3, concretadas: 2 });
  assert.equal(chances22Stats(otros), null);
  assert.equal(chances22Stats([]), null);
  // importado de un CSV sin data: cuenta como chance, no como concretada
  assert.deepEqual(chances22Stats([{ tipo: "CHANCE 22", equipo: "UNI" }]), { chances: 1, concretadas: 0 });
});

test("partido de Uni-Dat con chances y sin complemento: valen las de Uni-Dat", () => {
  const p = uno([fila("a", [chance("SI"), chance("NO"), chance("NO")])]);
  assert.deepEqual(p.efectividad_22, { chances: 3, concretadas: 1 });
  assert.deepEqual(chancesUnidat(p), { chances: 3, concretadas: 1 });
});

test("partido sin chances en Uni-Dat: igual que antes (vale lo cargado a mano, sin claves nuevas)", () => {
  const p = uno([fila("a", [])]);
  assert.equal(p.efectividad_22, null);
  assert.equal(chancesUnidat(p), null);
  assert.equal(Object.hasOwn(p, "efectividad_22_unidat"), false);
  assert.deepEqual(uno([fila("a", [])], aMano({ efectividad_22: { chances: 4, concretadas: 2 } })).efectividad_22, { chances: 4, concretadas: 2 });
  // complemento sólo de tarjetas: sigue en null, como antes
  assert.equal(uno([fila("a", [])], aMano({ tarjetas: TJ })).efectividad_22, null);
});

test("prioridad Uni-Dat: las cargadas a mano antes no pisan las de Uni-Dat", () => {
  // el caso real: Caranchos tiene 4 de 7 a mano y después se cargan en Uni-Dat
  const p = uno([fila("a", [chance("SI"), chance("NO")])], aMano({ efectividad_22: { chances: 7, concretadas: 4 } }));
  assert.deepEqual(p.efectividad_22, { chances: 2, concretadas: 1 });
  // y un complemento sólo de tarjetas tampoco las borra
  const q = uno([fila("a", [chance("SI"), chance("NO")])], aMano({ tarjetas: TJ }));
  assert.deepEqual(q.efectividad_22, { chances: 2, concretadas: 1 });
  assert.deepEqual(q.tarjetas, TJ);
});

test("formulario: con chances en Uni-Dat no las lee ni las guarda (sólo tarjetas)", () => {
  const p = uno([fila("a", [chance("SI"), chance("NO")])], aMano({ efectividad_22: { chances: 7, concretadas: 4 } }));
  // las casillas bloqueadas no se mandan: aunque vengan cosas raras, se ignoran
  const v = { ...valoresComplemento(p), cch: "basura", cco: "99" };
  let r = armarComplemento(v, p);
  assert.equal(r.errores, undefined);
  // guardar limpia las viejas cargadas a mano (el PATCH reemplaza datos)
  assert.deepEqual(r.fila, { partido_id: "a", datos: {} });
  assert.equal(r.id, ID);
  r = armarComplemento({ ...v, ctam_r: "2" }, p);
  assert.deepEqual(r.fila.datos, { tarjetas: { am_u: 0, ro_u: 0, am_r: 2, ro_r: 0 } });
});

test("formulario: sin chances en Uni-Dat se cargan a mano como siempre", () => {
  const p = uno([fila("a", [])]);
  const v = valoresComplemento(p);
  assert.deepEqual(armarComplemento({ ...v, cch: "7", cco: "4" }, p).fila.datos, { efectividad_22: { chances: 7, concretadas: 4 } });
  assert.deepEqual(armarComplemento({ ...v, cch: "2", cco: "5" }, p).errores, ["Hay más concretadas que chances."]);
});
