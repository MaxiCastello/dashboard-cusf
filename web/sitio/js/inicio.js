// Arranque del tablero: lee la base y arma la pantalla. Si la base no
// contesta (o está pausada), como dashboard.py: el aviso y sólo 2025.
import { partidosBase } from "./calculos.js";
import { ErrorBase, filasManuales, filasUnidat } from "./fuente.js";
import { barra } from "./marco.js";
import { fallo, tablero } from "./pagina.js";

async function arrancar() {
  barra("tablero");
  let partidos = [], errorBase = null;
  try {
    const [unidat, [manuales]] = await Promise.all([filasUnidat(), filasManuales()]);
    partidos = partidosBase(unidat, manuales);
  } catch (e) {
    if (!(e instanceof ErrorBase)) throw e;   // un dato imposible (ErrorDatos): no se muestra nada
    errorBase = e.message;
  }
  tablero({ partidos, errorBase });
  document.body.dataset.listo = "1";   // para las pruebas: ya está todo armado
}

arrancar().catch(fallo);
