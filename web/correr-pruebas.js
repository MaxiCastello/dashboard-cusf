// Corre las pruebas de tests/**/*.test.js, cada archivo en su propio
// proceso (como `node --test`: nada pasa de un archivo a otro). A
// diferencia de `node --test` solo, falla si no encontró ningún archivo o
// si un archivo no tiene ninguna prueba que se corra de verdad (sin contar
// las salteadas, las pendientes ni los `describe`): una carpeta vacía, un
// archivo vacío o uno con todo salteado no pueden dar verde.
import { spawnSync } from "node:child_process";
import process from "node:process";

const [mayor, menor] = process.versions.node.split(".").map(Number);
if (mayor < 22 || (mayor === 22 && menor < 8)) {
  console.error(`Hace falta Node 22.8 o más nuevo (está ${process.versions.node}).`);
  process.exit(1);
}
// globSync recién existe en Node 22: se importa después de mirar la versión
// (con un import de arriba, un Node viejo fallaría antes, con un error en inglés).
const { globSync } = await import("node:fs");

const archivos = globSync("tests/**/*.test.js").sort();
if (archivos.length === 0) {
  console.error("No hay pruebas en tests/**/*.test.js");
  process.exit(1);
}

// El resumen TAP de Node: "# tests 3", "# skipped 1", "# todo 0", "# fail 0"…
function resumen(tap) {
  const n = (clave) => Number((tap.match(new RegExp(`^# ${clave} (\\d+)$`, "m")) || [])[1] ?? NaN);
  return { tests: n("tests"), fail: n("fail"), skipped: n("skipped"), todo: n("todo") };
}

let mal = 0;
for (const f of archivos) {
  const r = spawnSync(process.execPath, ["--test", "--test-reporter=tap", f], { encoding: "utf8" });
  const s = resumen(r.stdout);
  // Un archivo sin pruebas, Node lo informa como una prueba con el nombre
  // del archivo ("ok 1 - tests\\a.test.js"): ésa no cuenta.
  const comoArchivo = new RegExp(`^ok \\d+ - ${f.replaceAll("\\", "\\\\").replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`, "m");
  const reales = s.tests - s.skipped - s.todo - (comoArchivo.test(r.stdout) ? 1 : 0);
  let estado = "ok";
  if (Number.isNaN(reales)) estado = "no se pudo leer el resultado";
  else if (r.status !== 0 || s.fail > 0) estado = `${s.fail} fallaron`;
  else if (reales <= 0) estado = "sin pruebas que se corran";
  if (estado !== "ok") {
    mal++;
    process.stdout.write(r.stdout);
    process.stderr.write(r.stderr);
  }
  console.log(`${estado === "ok" ? "✔" : "✖"} ${f}: ${reales} pruebas` +
    (s.skipped || s.todo ? ` (+${s.skipped} salteadas, ${s.todo} pendientes)` : "") +
    (estado === "ok" ? "" : ` — ${estado}`));
}
console.log(mal ? `\n${mal} de ${archivos.length} archivos con problemas` : `\nTodo OK (${archivos.length} archivos)`);
process.exitCode = mal ? 1 : 0;
