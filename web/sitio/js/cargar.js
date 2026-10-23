// CARGAR PARTIDO (pagina_cargar() de dashboard.py). FASE 3: sólo la barra y
// el encabezado; la carga se pasa en la fase 7.
import { barra, encabezado } from "./marco.js";

barra("cargar");
encabezado("Carga manual · sólo admins");
document.body.dataset.listo = "1";
