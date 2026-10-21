# Tablero · Club Universitario de Santa Fe — Rugby

Tablero de fin de temporada y por partido. Streamlit + Plotly, tema oscuro con
la paleta y las fuentes de Uni-Dat. Lo van a mirar todos a fin de año.
Publicado en [tablero-cusf.streamlit.app](https://tablero-cusf.streamlit.app/)
(Streamlit Cloud, Python 3.13, sin secrets; se actualiza solo con cada push a `main`).

## Estado (21 oct 2026)

- **PUBLICADO el 21 oct** y verificado en la publicada (5 anchos de pantalla,
  todas las pestañas). Lo viejo quedó en `Uni/dashboard-cusf.respaldo/`.
- **En la base hay 13 partidos de Primera 2026**: 12 de Uni-Dat + Rowing
  cargado a mano.
- Falta: que el usuario pruebe CARGAR PARTIDO en la publicada con su admin.

### Historial de sesiones

**13 oct** — reescritura, gráficos nuevos ("no todo barras, algo
profesional"; se miró Flourish/Datawrapper como referencia, no se usan),
carga manual, seguridad. SQL del tablero corrido esa noche (incluye el grant
de `admins` que faltaba y `creado_por` puesto por la base).

**15 oct** — auditoría con 12 partidos reales:
- `prueba_real.py` (31 pantallas), `comparar_con_unidat.py` con la base
  entera bajada (11 de 11 iguales), marcador = suma de anotaciones = 1° + 2°
  tiempo en todos, tackles = registros. Line/scrum/salidas cuadran
  (ganados de uno + recuperados del otro = lanzados).
- **Datos corregidos en la base** con
  `Uni/dashboard-cusf.correcciones-2026-10-15.sql` (lo corrió el usuario; dio
  0 / 3 / "3 y 4", verificado después contra la base):
  - nombres de jugadores unificados: **Jorge Onorato, Gonzalo Meza, Ignacio
    Mazzaro, Tomas Galiano** (estaban como Onoratto, Gonza/Gonzalo meza,
    Nacho, Galeano y salían como dos jugadores);
  - rival: ALMA y ALMA JRS → **ALMA JUNIORS** (los 3 partidos);
  - Rowing: conversiones pateadas 4→3 (UNI) y 5→4 (rival); tenía más
    pateadas que tries.
- Código:
  - Carga manual: no deja guardar más conversiones pateadas que tries.
  - Lecturas con `borrado_en=is.null` explícito (la base ya los escondía).
  - PARTIDOS: los gráficos de line / scrum / salidas pasaron a pestañas, a
    todo el ancho (con 12 partidos, tres lado a lado no se leían). No se
    grafican los recuperados por partido: son el espejo de lo que pierde el
    rival.
  - PDF con coma decimal (35,9); nombres de jugadores con mayúscula inicial
    ("Federico bruzzone" → "Federico Bruzzone").
  - `requests` 2.32.5 → 2.33.1 (CVE-2026-25645; no nos afectaba).
- Seguridad revisada de nuevo: todo cerrado (ver *Seguridad*).
- Chances en 22 cargadas por el usuario: Rowing 4 de 10 y Alma Juniors
  10 oct 2 de 12 → temporada 6 de 22.

**21 oct** — publicado:
- GitHub al día (commit d509d62) y Streamlit Cloud con Python 3.13 y sin
  secrets. Antes: todas las pruebas, ruff, pip-audit (Pillow 12.3.0 tiene
  CVEs arreglados en 13.0, pero Streamlit 1.55 exige Pillow < 13; no nos
  alcanza: no se abren imágenes de afuera y el único upload es un CSV de admin).
- Ancho completo en notebook/monitor (antes tope de 1180 px), tablet parada
  con gráficos apilados, celular igual.
- **OBJETIVOS** (pestaña nueva, ver *Qué muestra*), **tarjetas** en Penales con
  minutos con uno menos, ejes con fecha + rival en todos los partidos, hover
  de puntos sumados con lo del partido y el total. Se borró `.devcontainer`
  (lo había creado Streamlit al abrir Codespaces sin querer).
- Ojo: si el usuario toca algo desde GitHub/Streamlit, hay commits en `main`
  que no están acá: `git pull --rebase` antes de pushear.

### Para publicar (hecho el 21 oct; para la próxima vez)

1. Correr todas las pruebas (ver *Pruebas*) y `seguridad_anon.py`.
2. Subir el repo a GitHub. **Hoy GitHub sólo tiene `dashboard.py`, README,
   requirements, `packages.txt` y `data/*.xlsx` viejos.** Hay que agregar
   `cusf/`, `assets/`, `.streamlit/config.toml`, `.gitignore` y `data/2025/`,
   y borrar `packages.txt` y `data/*.xlsx` de la raíz (pasaron a
   `data/2025/`). Revisar que no se suba `.claude/` ni ningún secret.
3. En Streamlit Cloud: archivo principal `dashboard.py`, sin secrets. Si quedó
   un secret `admin_password` del tablero viejo, borrarlo.
4. Revisar la publicada con un partido y con CARGAR PARTIDO (ingresar con el
   admin de Uni-Dat **lo hace el usuario**, nunca en pruebas).

## De dónde salen los datos

| Temporada | Fuente |
|---|---|
| 2026 en adelante | La base de **Uni-Dat** (Supabase, proyecto `yrxsqrfjqyoicohsfrrt`): cada partido que se publica desde la app aparece solo (en hasta 5 minutos), con sus tackles. |
| Partidos sin Uni-Dat | **CARGAR PARTIDO** (arriba, sólo admins de Uni-Dat): se cargan a mano los números. Tabla `partidos_manuales` de la misma base. Ej.: Rowing (14 mar). |
| 2025 | La planilla vieja `data/2025/*.xlsx`: totales de la temporada + tackles de cada partido. No hay partido a partido. |

- **Las cuentas son las de Uni-Dat**: `cusf/calculos.py` es la traducción de
  `computeScrumStats`, `resultadoLine`, `whoWonSalida`, `computePeriodStats`,
  etc. Si se cambia una regla en Uni-Dat, cambiarla acá y correr
  `comparar_con_unidat.py`. (El ETL viejo contaba mal el line: no tomaba PENAL
  ni KNOCK-ON como ganador.)
- **Categoría**: Uni-Dat la guarda como texto libre ("Primera oro f3"); se
  agrupa por la primera palabra ("Primera").
- **Chances en 22 rival**: Uni-Dat no las registra. Se le suman a un partido ya
  publicado desde CARGAR PARTIDO → *Chances en 22 (Uni-Dat)* (una fila de
  `partidos_manuales` con `partido_id`).
- **Planilla 2025, ojo**: "lanzamientos rival ganados" son los que **ganó UNI**
  en lanzamiento rival (verificado con las filas de totales en las 4 hojas).
  Leído al revés da "el rival ganó 36 de 188 scrums propios" (era 152 de 188).
- **Recuperados** (line, scrum, salidas): un partido cargado a mano no los
  tiene. La temporada los cuenta con los partidos que sí y lo aclara
  ("sin Rowing"); no se ponen en cero.
- **Tackles por jugador**: se agrupan por nombre (sin tildes ni mayúsculas)
  y se muestran con mayúscula inicial. Un mismo jugador escrito distinto sale
  dos veces: en 2025 Fleitas/Felitas y Hotham/Hothan (está así en la
  planilla); en 2026 se corrigió en la base el 15 oct. Los nombres se escriben
  a mano en la plantilla de cada partido del Tackle Tracker: si vuelve a
  aparecer "Nacho" o "Gonza", se corrige con un `replace` como el de
  `dashboard-cusf.correcciones-2026-10-15.sql`. PJ = partidos con al menos un
  tackle.
- **Completados** = (intentos − errados) / intentos, igual que el Tackle
  Tracker: un tackle negativo se completó igual.
- **Marcador del partido**: Uni-Dat no guarda minutos; el gráfico va
  anotación por anotación en el orden en que se cargaron, con el entretiempo
  marcado. Usa los `puntos` de cada evento (la suma da el resultado).

## Qué muestra

Arriba: **Temporada** (2026, 2025…), **Categoría** y **Ver** (toda la
temporada o un partido).

| Pestaña | Temporada | Un partido |
|---|---|---|
| Resumen | números grandes, torta de resultados, puntos de cada partido (dos puntos unidos), anillos "UNI en números", puntos sumados en la temporada, los que más tacklearon | cómo se fue dando el marcador, radar partido vs temporada + tabla |
| Objetivos | en cuántos partidos se cumplió cada uno (barras), tabla con la meta y la temporada, cuadro partido × objetivo (✓ / ✗ / sin datos) | tabla del partido |
| Partidos / 1° vs 2° tiempo | tabla + líneas partido a partido con la temporada punteada: line / scrum / salidas en pestañas a todo el ancho; puntos, penales, tackles | 1° vs 2° tiempo enfrentados + anillos de formaciones por tiempo |
| Puntos | cómo hizo los puntos cada uno (tortas), pateo (anillos), de dónde salieron los tries, **chances en 22** (total + un renglón por partido) | igual, del partido |
| Formaciones | anillos de line, scrum y salidas (ganados y recuperados), mapa de calor del line jugadores × posición, knock-ons | igual |
| Penales | dónde (UNI vs rival), por tiempo, torta situación → motivo, lista de motivos, **tarjetas**: amarillas, rojas, por partido, minutos con uno menos (UNI y rival) y barras partido a partido | igual |
| Tackles | torta por tipo, los que más tacklearon, barras por jugador, tabla completa | + completados por tiempo |
| Informe | PDF de tablas (reportlab) | igual |

**Criterio de los números** (el del usuario, para todo el club):
- Primero "X de Y" y después el %. En los anillos: el número, abajo "de Y" y
  el %, en tres renglones (entra aunque sean miles de tackles).
- Sin jerga y **sin decir si estuvo bien o mal**. Verde = UNI, naranja = rival.
  **Excepción: OBJETIVOS**, que son metas del cuerpo técnico (21 oct) y dicen
  cumplido / no cumplido. "Sin datos" no es "no cumplido".

**Objetivos** (`cusf/objetivos.py`; interpretaciones confirmadas por el usuario):
- Line propio y scrum propio: 100% ganados.
- Salidas del rival: UNI se queda con el 100% (sólo las de mitad de cancha,
  no las de 22; los partidos cargados a mano no tienen el dato).
- Chances en 22: 60% o más concretadas (se cargan a mano).
- Penales: UNI comete **menos** de la mitad de los del partido (13 a 13 = no)
  y **menos de 10** (9 o menos).
- Tarjetas: 0 por partido. Minutos con uno menos: amarilla 10, roja 20 (la
  roja de 20 minutos de World Rugby; una roja definitiva sería hasta el final,
  se cuenta 20 igual). La planilla 2025 no tiene tarjetas: no se muestran ceros.
- Rótulos con la primera letra en mayúscula.
- Que se vea en el celular: nada se sale de la pantalla (lo revisa `capturas.py`).

## Estructura

```
dashboard.py            entrada: encabezado, filtros, pestañas, navegación (Tablero / Cargar partido)
cusf/calculos.py        las cuentas (reglas de Uni-Dat) y el formato de un partido
cusf/fuente.py          lectura de Supabase y de la planilla 2025; login y escritura (admins)
cusf/objetivos.py       los objetivos del equipo y si se cumplieron (y los minutos por tarjeta)
cusf/vistas.py          las secciones del tablero (una función por pestaña)
cusf/graficos.py        los tipos de gráfico (torta, mariposa, pesas, líneas, radar, mapa de calor…)
cusf/estilo.py          paleta/fuentes de Uni-Dat, tema de plotly, piezas HTML (kpis, anillos, tablas)
cusf/cargar.py          la página CARGAR PARTIDO
cusf/informe.py         el PDF
.streamlit/config.toml  tema oscuro + seguridad
data/2025/              planilla 2025
assets/                 escudo e ícono
```

Fuera del repo (en `Uni/`, porque el repo es público):
- `dashboard-cusf.supabase.sql`: tabla `partidos_manuales`, permisos (RLS),
  historial, limpieza de borrados y la carga inicial de Rowing.
- `dashboard-cusf.SEGURIDAD.md`: el análisis de seguridad completo.
- `dashboard-cusf.pruebas/`: las pruebas (ver abajo).
- `dashboard-cusf.respaldo/`: lo viejo (dashboard 2026 sin commit, ETL, JSON).

**Un partido** (lo que arman `desde_unidat` / `desde_manual`, ver
`calculos.partido_vacio()`): id, fuente (`unidat`/`manual`/`planilla`), rival,
categoría, fecha, tanteo, `puntos`, `scrum`/`line` (`uLan uGan uPer uRec rLan
rGan rPer rRec`), `salida`/`salida22`/`salida_ingoal` (con `Pro` en vez de
`Lan`), `penales`, `tarjetas`, `knockons`, `efectividad_22`, `tackles` (uno por
jugador), `periodos` (1° y 2° tiempo), `line_tabla`, `tries_origen`, `marcador`.
Una **temporada** es la lista de partidos + `calculos.sumar()` de todos; las
secciones reciben una temporada (para un partido, una temporada de uno).
`None` = "no se sabe" (no es cero) y se propaga al sumar.

## Cargar partido (admins)

- Se entra con **el mismo mail y contraseña de admin de Uni-Dat**. Quién es
  admin lo decide la tabla `admins` de Supabase (la misma de Uni-Dat).
- El mail se pasa a minúsculas (como Uni-Dat). Mensajes: "Mail o contraseña
  incorrectos", "Demasiados intentos", "Ese usuario no es admin", sin conexión.
  Si el navegador autocompleta y Streamlit no lo toma, dice "Completá el mail
  y la contraseña": hacer clic en cada casilla.
- "No se pudo comprobar si el usuario es admin (error 403 42501)" = a la base
  le falta `grant select on public.admins to authenticated` (pasó el 13 oct;
  también rompe publicar en Uni-Dat). Lo pone el `.sql` del tablero.
- La sesión dura 1 hora y se renueva sola (refresh token).
- Partido nuevo / Corregir o borrar / Chances en 22 (Uni-Dat). Valida rival,
  metidas ≤ pateadas, conversiones pateadas ≤ tries, ganados ≤ lanzados,
  concretadas ≤ chances; si tries +
  patadas no dan el tanteo, avisa pero guarda. Tackles: CSV del Tackle Tracker.
- Después de guardar uno nuevo, el formulario queda vacío (un segundo clic no
  lo duplica).
- Borrar = ocultar; a los 7 días se elimina (igual que Uni-Dat).
- **En el tablero de prueba (`demo_tablero.py`) no se puede ingresar**: bloquea
  toda escritura a propósito y ahora lo dice. El 13 oct el usuario "no pudo
  ingresar" ahí (antes mostraba "Mail o contraseña incorrectos" para cualquier
  error).

## Seguridad (resumen)

Análisis completo y pruebas en `Uni/dashboard-cusf.SEGURIDAD.md` (fuera del repo).

- Sin contraseñas ni claves secretas en el código ni en el historial de git
  (revisado). La clave del código es la *publishable* de Supabase, pública por
  diseño (la misma de Uni-Dat): sólo deja leer.
- Quién escribe lo decide la base (RLS), no el tablero. Probado sin usuario
  contra la base real: leer sí; cargar, corregir, borrar, ver admins,
  anotarse como admin, ver el historial y token falso: rechazado.
- Todo texto que viene de la base o de un CSV se escapa antes del HTML y se le
  sacan `<` `>` antes de un gráfico (probado con nombres maliciosos).
- La pantalla no muestra detalles de errores ni el menú de desarrollador;
  subida máx. 2 MB; 5 intentos de login por sesión cada 10 minutos.
- Revisado el 15 oct: en Supabase Auth **el registro está apagado** (nadie
  puede crearse cuenta), la API no le muestra el esquema a quien no tiene
  usuario y no hay buckets públicos; `pip-audit -r requirements.txt` limpio.

## Correr local

```
pip install -r requirements.txt
python -m streamlit run dashboard.py
```

**Ojo:** Streamlit no siempre recarga los módulos de `cusf/` al cambiarlos.
Después de tocar código, **cerrar y volver a abrir** el tablero (pasó con el
gráfico de chances en 22, que "no aparecía").

Tablero de prueba (7 partidos de Primera armados con los CSV reales, no toca
la base; correrlo desde `dashboard-cusf` para que tome el tema oscuro):
```
python ../dashboard-cusf.pruebas/armar_demo.py      # una vez, arma demo_partidos.json
python -m streamlit run ../dashboard-cusf.pruebas/demo_tablero.py --server.port 8502
```

## Pruebas (en `Uni/dashboard-cusf.pruebas/`, fuera del repo)

Ninguna escribe en la base real. Correr todas antes de publicar.

| Archivo | Qué prueba |
|---|---|
| `comparar_con_unidat.py [partidos.json]` | las funciones reales de Uni-Dat (Node) contra `calculos.py`, campo por campo, en todos los CSV + Alma; con un JSON bajado de la base (`partidos?select=id,rival,fecha,main:stats->main,...`), en todos los partidos reales |
| `prueba_objetivos.py` | los objetivos en los bordes (0 de 0, 60% justo, mitad justa, 10 penales, dato que falta) |
| `prueba_demo.py` | todas las pestañas y todos los partidos (2026 de prueba + 2025) sin errores |
| `prueba_carga.py` | CARGAR PARTIDO contra una base falsa: login (mal, no admin, vacío, mayúsculas), validaciones, guardar, no duplicar, corregir, borrar, renovar sesión, chances en 22 |
| `prueba_xss.py` | nombres maliciosos en rival/jugador/motivo no llegan como HTML ni a los gráficos |
| `prueba_real.py` | el tablero entero con la base REAL, sólo lectura (corta si algo intenta escribir): correrla después de cargar partidos |
| `seguridad_anon.py` | permisos de la base REAL sin usuario (cada intento está armado para no escribir aunque el permiso estuviera abierto) |
| `capturas.py [carpeta] [url] [partido]` | capturas de todas las pestañas en compu y celular; avisa si algo da error o se sale de la pantalla |

`probar_correcciones.mjs <sql> <partidos_full.json> <manuales.json> <salida.json>`
corre un SQL de correcciones sobre una copia local de los partidos (PGlite),
dos veces, y guarda el resultado para comparar: así se probó el del 15 oct
antes de dárselo al usuario.

`sql_tablero.mjs` prueba el SQL en un Postgres local (PGlite; necesita
`npm i @electric-sql/pglite` en esa carpeta, y se corre con
`node sql_tablero.mjs ../dashboard-cusf.supabase.sql`): se corre dos veces, anon y no
admin rechazados, admin no puede DELETE, CHECKs, historial, cron, Rowing
sembrado, `creado_por` lo pone la base.

## Pendiente / ideas

- El usuario prueba CARGAR PARTIDO en la publicada. Si carga partidos nuevos,
  repetir `prueba_real.py` + `comparar_con_unidat.py` con la base bajada + mirar
  nombres parecidos de jugadores y rivales.
- Ofrecido y en espera: que el tablero junte solo variantes conocidas de un
  nombre o avise de nombres parecidos.
- "Puntos por partido" y "Penales cometidos" siguen lado a lado: con una
  temporada de ~20 partidos se van a apretar; pasarlos a todo el ancho como
  las formaciones.
- Supabase plan gratis: el proyecto se **pausa tras 7 días sin uso** (ej. el
  receso de verano). El tablero muestra el error y sólo 2025 hasta
  reactivarlo desde el panel de Supabase.

- Los jugadores escritos de dos formas en la planilla 2025 (Fleitas/Felitas,
  Hotham/Hothan) salen separados.
- Si Uni-Dat algún día registra las chances en 22 o los minutos de cada
  evento, el tablero los puede tomar directo.
