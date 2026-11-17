// El video de un partido (video.js): qué links se aceptan y qué direcciones
// salen de ahí, cómo se guarda desde CARGAR PARTIDO y cómo llega al partido.
import assert from "node:assert/strict";
import { test } from "node:test";
import * as C from "../sitio/js/calculos.js";
import * as K from "../sitio/js/carga.js";
import { linkEscrito, videoDe } from "../sitio/js/video.js";

const YT = "https://www.youtube.com/watch?v=b9fdnZ2XBFY";
const DBX = "https://www.dropbox.com/scl/fi/ofnk31sbdgmd7h9jbfzxi/111426-TRL-B-Alma-Junior-v-Uni-SF-Final.mp4?rlkey=tk9wdjr7ggsj38udbs4fasylj&e=1&dl=0";

test("YouTube: de cualquier forma del link sale el mismo código", () => {
  for (const l of [YT, "youtube.com/watch?v=b9fdnZ2XBFY", "https://youtu.be/b9fdnZ2XBFY?si=abc", "https://m.youtube.com/watch?t=90&v=b9fdnZ2XBFY",
    "https://www.youtube.com/live/b9fdnZ2XBFY", "https://www.youtube.com/embed/b9fdnZ2XBFY", "  http://www.youtube.com/shorts/b9fdnZ2XBFY  "]) {
    assert.deepEqual(videoDe(l), { sitio: "youtube", id: "b9fdnZ2XBFY", ver: YT, embed: "https://www.youtube-nocookie.com/embed/b9fdnZ2XBFY" }, l);
  }
});

test("Dropbox: la dirección se arma de nuevo, con raw=1 para el reproductor", () => {
  const base = "https://www.dropbox.com/scl/fi/ofnk31sbdgmd7h9jbfzxi/111426-TRL-B-Alma-Junior-v-Uni-SF-Final.mp4?rlkey=tk9wdjr7ggsj38udbs4fasylj&";
  assert.deepEqual(videoDe(DBX), { sitio: "dropbox", ver: base + "dl=0", archivo: base + "raw=1" });
  // lo guardado (ver) vuelve a dar lo mismo
  assert.deepEqual(videoDe(base + "dl=0"), videoDe(DBX));
  assert.equal(videoDe("https://www.dropbox.com/s/abc123/partido.mp4?dl=0").archivo, "https://www.dropbox.com/s/abc123/partido.mp4?raw=1");
  // nada de lo pegado pasa sin codificar
  const raro = videoDe('https://www.dropbox.com/scl/fi/x/a"><b>.mp4?rlkey=a"b&dl=0').archivo;
  assert.ok(!/["<> ]/.test(raro), raro);
});

test("lo que no es un video de YouTube o Dropbox no pasa", () => {
  for (const l of [null, 7, "", "   ", "hola", "https://vimeo.com/123", "javascript:alert(1)", "data:text/html,x",
    "https://www.youtube.com/watch?v=corto", "https://www.youtube.com/watch?v=b9fdnZ2XBFY<x", "https://www.youtube.com/",
    "https://youtube.com.malo.com/watch?v=b9fdnZ2XBFY", "https://malo.com/?u=youtube.com/watch?v=b9fdnZ2XBFY",
    "https://usuario@www.youtube.com/watch?v=b9fdnZ2XBFY", "https://www.youtube.com:444/watch?v=b9fdnZ2XBFY",
    "https://www.dropbox.com/home", "https://dropbox.com.malo.com/scl/fi/a/b.mp4", "https://www.dropbox.com/scl/fi/%E0%A4%A/b.mp4",
    YT + "&x=" + "a".repeat(600)]) {
    assert.equal(videoDe(l), null, String(l));
  }
});

test("la casilla del formulario: vacía = sin video; si no sirve, un error", () => {
  assert.deepEqual(linkEscrito(""), { link: null, error: null });
  assert.deepEqual(linkEscrito(undefined), { link: null, error: null });
  assert.deepEqual(linkEscrito(" youtu.be/b9fdnZ2XBFY "), { link: YT, error: null });
  assert.equal(linkEscrito("https://vimeo.com/1").link, null);
  assert.match(linkEscrito("https://vimeo.com/1").error, /YouTube.*Dropbox/);
});

const unidat = (id) => ({ id, rival: "ALMA", categoria: "Final oro", fecha: "2026-11-14", score_uni: 24, score_rival: 23, main: {}, tackles: null });

test("el complemento de un partido de Uni-Dat guarda el video y el partido lo trae", () => {
  const [p] = C.partidosBase([unidat("a")], []);
  assert.ok(!("video" in p));
  const v = { ...K.valoresComplemento(p), ...K.valoresTiempo(null) };
  assert.equal(v.vid, "");
  assert.ok(!("video" in K.armarComplemento(v, p).fila.datos));
  assert.match(K.armarComplemento({ ...v, vid: "https://vimeo.com/1" }, p).errores[0], /^Video/);
  const r = K.armarComplemento({ ...v, vid: DBX }, p);
  assert.equal(r.fila.datos.video, videoDe(DBX).ver);
  const [q] = C.partidosBase([unidat("a")], [{ id: "c1", partido_id: "a", datos: r.fila.datos }]);
  assert.equal(q.video, videoDe(DBX).ver);
  // al abrir de nuevo el formulario está el link, y guardar otra cosa no lo pierde
  assert.equal(K.valoresComplemento(q).vid, q.video);
  assert.equal(K.armarComplemento({ ...K.valoresComplemento(q), ...K.valoresTiempo(null), cch: "3", cco: "1" }, q).fila.datos.video, q.video);
  // un link que no sirve en la base: el partido queda sin video
  assert.ok(!("video" in C.partidosBase([unidat("a")], [{ id: "c1", partido_id: "a", datos: { video: "javascript:alert(1)" } }])[0]));
});

test("un partido cargado a mano guarda el video", () => {
  const v = { ...K.valoresPartido(null), r: "CRAR", f: "2026-11-01", vid: YT };
  const r = K.armarPartido(v, null, null);
  assert.equal(r.fila.datos.video, YT);
  const p = C.desdeManual({ id: "m1", ...r.fila });
  assert.equal(p.video, YT);
  assert.equal(K.valoresPartido({ id: "m1", ...r.fila }).vid, YT);
  assert.ok(!("video" in K.armarPartido({ ...v, vid: "" }, null, null).fila.datos));
  assert.ok(K.armarPartido({ ...v, vid: "cualquiera" }, null, null).errores.some((e) => e.startsWith("Video")));
});

test("categoría: la instancia y el torneo no son la categoría (Final oro es Primera)", () => {
  assert.deepEqual(["Final oro", "final ORO", "Final", "Semifinal trl b oro", "Final (oro)", "Cuartos de final CSF", "oro",
    "Final M19 oro", "M19 final", "Intermedia final oro", "Final - oro"].map(C.categoriaBase),
  ["Primera", "Primera", "Primera", "Primera", "Primera", "Primera", "Primera", "M19", "M19", "Intermedia", "Primera"]);
  // y la final entra en la Copa de Oro de Primera
  const ps = C.partidosBase([unidat("a"), { ...unidat("b"), categoria: "Primera oro f5", fecha: "2026-10-24" }], []);
  const t = C.temporada(ps, 2026, "Primera");
  assert.equal(t.n_partidos, 2);
  assert.deepEqual(C.categoriasDe(ps, 2026), ["Primera"]);
  assert.equal(C.torneo(t, "oro").n_partidos, 2);
});
