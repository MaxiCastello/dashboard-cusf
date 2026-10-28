// CARGAR PARTIDO: lo que no se puede comparar con cargar.py (allá Streamlit
// no deja escribir otra cosa en una casilla de número) y el login contra un
// Supabase falso (fetch reemplazado: nunca sale a la red). Lo que sí se
// compara con el Python, con miles de casos, está en pruebas/fuzz_carga.py.
import assert from "node:assert/strict";
import { afterEach, test } from "node:test";

import { leerCsvTackles } from "../sitio/js/calculos.js";
import { armarComplemento, armarPartido, registrosDelCsv, valoresPartido } from "../sitio/js/carga.js";
import { borrarManual, ErrorBase, filasManuales, filasUnidat, guardarManual, ingresar, renovar, URL_BASE } from "../sitio/js/fuente.js";
import { leer } from "./_referencia.js";

const ID = "0f8fad5b-d9cb-469f-a165-70867728950e";
const base = () => ({ ...valoresPartido(null), r: "Rowing", f: "2026-05-10" });
const csv = (t) => new TextEncoder().encode(t);

test("casillas de número: vacía = 0; letras, negativos, decimales o más de 300 no", () => {
  const ok = armarPartido({ ...base(), su: "", sr: " 7 " }, null, null);
  assert.equal(ok.fila.score_uni, 0);
  assert.equal(ok.fila.score_rival, 7);
  for (const malo of ["-1", "1.5", "abc", "301", "1e2", "٣"]) {
    const r = armarPartido({ ...base(), triesu: malo }, null, null);
    assert.deepEqual(r.errores, ["Tries (UNI): tiene que ser un número entero de 0 a 300."], malo);
  }
  assert.equal(armarPartido({ ...base(), triesu: "300", convtu: "300" }, null, null).fila.datos.puntos.tries_u, 300);
});

test("rival, categoría y fecha", () => {
  assert.deepEqual(armarPartido({ ...base(), r: "  ", f: "" }, null, null).errores, ["Falta el rival.", "Falta la fecha."]);
  assert.deepEqual(armarPartido({ ...base(), r: "x".repeat(61) }, null, null).errores, ["El rival tiene más de 60 letras."]);
  // las letras se cuentan como en Python: un emoji es una
  assert.ok(armarPartido({ ...base(), r: "😀".repeat(60) }, null, null).fila);
  assert.deepEqual(armarPartido({ ...base(), f: "2026-02-30" }, null, null).errores, ["Falta la fecha."]);
  const f = armarPartido({ ...base(), r: " Rowing B ", c: "  " }, null, null).fila;
  assert.equal(f.rival, "Rowing B");
  assert.equal(f.categoria, null);
});

test("un partido nuevo arranca vacío, con la categoría Primera y la fecha de hoy", () => {
  const v = valoresPartido(null);
  assert.equal(v.r, "");
  assert.equal(v.c, "Primera");
  assert.match(v.f, /^\d{4}-\d{2}-\d{2}$/);
  assert.equal(v.triesu, "0");
});

test("corregir: la fila conserva sus tackles si no se sube otro CSV, y va con su id", () => {
  const fila = { id: ID, rival: "CRAI", categoria: "Primera", fecha: "2026-04-01", score_uni: 5, score_rival: 0,
    datos: { puntos: { tries_u: 1 }, tackles_registros: [{ tiempo: "Primer tiempo", jugador: "7", nombre: "A", tipo: "Positivo" }] } };
  const r = armarPartido(valoresPartido(fila), fila, null);
  assert.equal(r.id, ID);
  assert.equal(r.fila.datos.tackles_registros.length, 1);
  assert.deepEqual(r.aviso, ["ok", "Guardado: UNI 5–0 CRAI."]);
});

test("CSV: BOM, \\r\\n, comillas, sólo jugadores con número y largos recortados", () => {
  const t = "﻿PLANTILLA\r\nDorsal,Nombre\r\n7,Juan\r\n\r\nTiempo,Jugador,Nombre,Tipo\r\n" +
    `Primer tiempo,7,"Pérez, ""Pato""",Positivo\r\nSegundo tiempo,abc,X,Errado\r\nSegundo tiempo,1234,${"N".repeat(70)},Errado\r\n`;
  const regs = registrosDelCsv(csv(t));
  assert.deepEqual(regs, [
    { tiempo: "Primer tiempo", jugador: "7", nombre: 'Pérez, "Pato"', tipo: "Positivo" },
    { tiempo: "Segundo tiempo", jugador: "123", nombre: "N".repeat(60), tipo: "Errado" },
  ]);
  const [, plantilla] = leerCsvTackles(t);
  assert.equal(plantilla.get("7"), "Juan");
});

test("CSV: lo que no es UTF-8 o lo que el csv de Python no lee, no se lee", () => {
  assert.equal(registrosDelCsv(new Uint8Array([0x54, 0xff, 0x0a])), null);
  assert.equal(registrosDelCsv(csv("Tiempo,Jugador,Nombre,Tipo\rPrimer tiempo,7,A,Positivo\r")), null);
  const r = armarPartido(base(), null, new Uint8Array([0xff]));
  assert.deepEqual(r.errores, ["El CSV de tackles no se pudo leer.", "El CSV no tiene tackles: ¿es el del Tackle Tracker?"]);
});

test("CSV: más de 2.000 tackles se guardan los primeros 2.000", () => {
  const filas = Array.from({ length: 2500 }, (_, i) => `Primer tiempo,${(i % 30) + 1},J,Positivo`);
  assert.equal(registrosDelCsv(csv(`Tiempo,Jugador,Nombre,Tipo\n${filas.join("\n")}\n`)).length, 2000);
});

test("complemento: tarjetas iguales a Uni-Dat no se guardan; distintas sí", () => {
  const p = { id: "u1", tarjetas: { am_u: 1, ro_u: 0, am_r: 0, ro_r: 0 }, efectividad_22: null, complemento_id: ID };
  const v = { cch: "4", cco: "2", ctam_u: "1", ctro_u: "", ctam_r: "", ctro_r: "" };
  assert.deepEqual(armarComplemento(v, p).fila, { partido_id: "u1", datos: { efectividad_22: { chances: 4, concretadas: 2 } } });
  assert.equal(armarComplemento(v, p).id, ID);
  const r = armarComplemento({ ...v, ctam_r: "2" }, p);
  assert.deepEqual(r.fila.datos.tarjetas, { am_u: 1, ro_u: 0, am_r: 2, ro_r: 0 });
  assert.deepEqual(armarComplemento({ ...v, cco: "5" }, p).errores, ["Hay más concretadas que chances."]);
});

// ── Login y escritura contra un Supabase falso ───────────────────────────────

const fetchReal = globalThis.fetch;
const pedidos = [];
afterEach(() => {
  globalThis.fetch = fetchReal;
  pedidos.length = 0;
});

// respuestas: [[patrón de la dirección, estado, cuerpo]]; null = sin conexión
function supabase(respuestas) {
  globalThis.fetch = async (url, op) => {
    pedidos.push({ url, metodo: op.method, cab: op.headers, cuerpo: op.body });
    const r = respuestas.find(([patron]) => url.includes(patron));
    if (!r || r[1] === null) throw new TypeError("Failed to fetch");
    return new Response(r[2] === undefined ? "" : JSON.stringify(r[2]), { status: r[1] });
  };
}
const TOKEN = { access_token: "TOKEN-ADMIN", refresh_token: "r1", expires_in: 3600 };

test("lectura: los mismos pedidos que el Python, con la clave pública; sin la tabla de manuales sigue", async () => {
  supabase([["/rest/v1/partidos?", 200, []], ["/rest/v1/partidos_manuales?", 200, []]]);
  await filasUnidat();
  assert.deepEqual(await filasManuales(), [[], true]);
  assert.deepEqual(pedidos.map((p) => p.url.slice(URL_BASE.length)), leer("base", "pedidos.json"));
  assert.ok(pedidos.every((p) => p.metodo === "GET" && p.cab.Authorization === "Bearer " + p.cab.apikey));
  supabase([["/rest/v1/partidos_manuales?", 404, { code: "PGRST205" }]]);
  assert.deepEqual(await filasManuales(), [[], false]);
  supabase([["/rest/v1/partidos_manuales?", 404, { code: "PGRST116" }]]);
  await assert.rejects(filasManuales(), { message: "La base rechazó el pedido (404)." });
});

test("login: el mail va en minúsculas y sin espacios; un admin entra", async () => {
  supabase([["grant_type=password", 200, TOKEN], ["/rest/v1/admins", 200, [{ user_id: "x" }]]]);
  const ses = await ingresar("  Admin@Club.COM ", "clave");
  assert.equal(ses.token, "TOKEN-ADMIN");
  assert.equal(JSON.parse(pedidos[0].cuerpo).email, "admin@club.com");
  assert.equal(pedidos[1].cab.Authorization, "Bearer TOKEN-ADMIN");
});

test("login: cada respuesta de Supabase, su mensaje (sin decir si el mail existe)", async () => {
  const casos = [
    [[["grant_type", 400, { error_code: "invalid_credentials" }]], "Mail o contraseña incorrectos."],
    [[["grant_type", 400, { error: "invalid_grant" }]], "Mail o contraseña incorrectos."],
    [[["grant_type", 429, {}]], "Demasiados intentos: esperá unos minutos."],
    [[["grant_type", 400, { error_code: "over_request_rate_limit" }]], "Demasiados intentos: esperá unos minutos."],
    [[["grant_type", 400, { error_code: "email_not_confirmed" }]], "Ese mail todavía no está confirmado en Supabase."],
    [[["grant_type", 500, {}]], "No se pudo ingresar (error 500). Probá de nuevo en un rato."],
    [[["grant_type", null]], "No se pudo conectar con la base. Revisá la conexión y probá de nuevo."],
    [[["grant_type", 200, {}]], "No se pudo ingresar. Probá de nuevo en un rato."],
    [[["grant_type", 200, TOKEN], ["/rest/v1/admins", 200, []], ["logout", 204]], "Ese usuario no es admin."],
    [[["grant_type", 200, TOKEN], ["/rest/v1/admins", 500, { code: "XX000" }]],
      "No se pudo comprobar si el usuario es admin (error 500 XX000). Probá de nuevo en un rato."],
    [[["grant_type", 200, TOKEN], ["/rest/v1/admins", null]],
      "No se pudo comprobar si el usuario es admin (error de conexión). Probá de nuevo en un rato."],
  ];
  for (const [resp, msg] of casos) {
    supabase(resp);
    await assert.rejects(ingresar("a@b.c", "x"), (e) => e instanceof ErrorBase && e.message === msg, msg);
  }
  supabase([]);
  pedidos.length = 0;
  await assert.rejects(ingresar(" ", "x"), { message: "Completá el mail y la contraseña." });
  await assert.rejects(ingresar("a@b.c", ""), { message: "Completá el mail y la contraseña." });
  assert.equal(pedidos.length, 0, "con los campos vacíos no se pide nada");
});

test("renovar: sólo si faltan 5 minutos o menos; si no se puede, la sesión venció", async () => {
  supabase([["grant_type=refresh_token", 200, { ...TOKEN, access_token: "NUEVO" }]]);
  const lejos = { token: "T", refresh: "r1", vence: Date.now() / 1000 + 3000 };
  assert.equal(await renovar(lejos), lejos);
  assert.equal(pedidos.length, 0);
  const cerca = { ...lejos, vence: Date.now() / 1000 + 200 };
  assert.equal((await renovar(cerca)).token, "NUEVO");
  assert.equal(JSON.parse(pedidos[0].cuerpo).refresh_token, "r1");
  supabase([["grant_type=refresh_token", 400, { error_code: "refresh_token_not_found" }]]);
  await assert.rejects(renovar(cerca), { message: "La sesión venció. Volvé a ingresar.", codigo: 401 });
  // un corte o la base caída no vencen la sesión, y no se guardó nada (sin sinRespuesta)
  supabase([["grant_type=refresh_token", null]]);
  await assert.rejects(renovar(cerca), (e) => e.codigo === null && !e.sinRespuesta && e.message.startsWith("No se pudo conectar"));
  supabase([["grant_type=refresh_token", 503, {}]]);
  await assert.rejects(renovar(cerca), { message: "La base rechazó el pedido (503).", codigo: 503 });
});

test("escribir: siempre con el token del admin; el id va en la URL sólo si es un uuid", async () => {
  supabase([["partidos_manuales", 201]]);
  await guardarManual("TOKEN-ADMIN", { rival: "x" });
  await guardarManual("TOKEN-ADMIN", { rival: "x" }, ID);
  await borrarManual("TOKEN-ADMIN", ID);
  assert.deepEqual(pedidos.map((p) => [p.metodo, p.url.split("supabase.co")[1]]), [
    ["POST", "/rest/v1/partidos_manuales"],
    ["PATCH", `/rest/v1/partidos_manuales?id=eq.${ID}`],
    ["PATCH", `/rest/v1/partidos_manuales?id=eq.${ID}`],
  ]);
  for (const p of pedidos) {
    assert.equal(p.cab.Authorization, "Bearer TOKEN-ADMIN");
    assert.equal(p.cab.Prefer, "return=minimal");
  }
  assert.ok(JSON.parse(pedidos[2].cuerpo).borrado_en);
  pedidos.length = 0;
  for (const malo of ["1", `${ID}&rival=eq.x`, "", ID.toUpperCase(), 5]) {
    await assert.rejects(guardarManual("T", {}, malo === "" ? "x" : malo), { message: "Partido inválido." });
    await assert.rejects(borrarManual("T", malo), { message: "Partido inválido." });
  }
  assert.equal(pedidos.length, 0, "con un id raro no se manda nada");
  supabase([["partidos_manuales", 401, { code: "PGRST301" }]]);
  await assert.rejects(guardarManual("T", {}), (e) => e.codigo === 401 && e.message === "La sesión venció o no tenés permiso. Volvé a ingresar.");
});
