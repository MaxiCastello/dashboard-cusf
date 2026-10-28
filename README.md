# Tablero del Club Universitario de Santa Fe – Rugby

[![JavaScript](https://img.shields.io/badge/JavaScript-página_web-F7DF1E?logo=javascript&logoColor=black)](https://developer.mozilla.org/es/docs/Web/JavaScript)
[![Plotly](https://img.shields.io/badge/Plotly-visualizaciones-3DDC84?logo=plotly)](https://plotly.com/javascript/)
[![Cloudflare Pages](https://img.shields.io/badge/Cloudflare-Pages-F38020?logo=cloudflare&logoColor=white)](https://pages.cloudflare.com/)
[![Supabase](https://img.shields.io/badge/Supabase-datos-3ECF8E?logo=supabase&logoColor=white)](https://supabase.com/)

Este proyecto es un **tablero interactivo** del **Club Universitario de Santa Fe** para seguir el
rendimiento del equipo de rugby a lo largo de la temporada y partido por partido: puntos, formaciones
fijas, penales, tarjetas, tackles y los objetivos que se pone el equipo.

Acceso al tablero: [cusf-tablero.pages.dev](https://cusf-tablero.pages.dev/)

---

## Qué se puede ver

Arriba se elige la **temporada**, la **categoría** y si se mira **toda la temporada**, **un torneo**
(Copa de Oro, Copa Santa Fe) o **un partido**.

- **Resumen**: resultados, el marcador de cada partido, los puntos sumados a lo largo de la temporada,
  lo principal de UNI en números y los que más tacklearon.
- **Objetivos**: las metas del equipo (line y scrum propios, salidas del rival, chances en 22, penales
  y tarjetas) y en cuántos partidos se cumplió cada una, partido por partido.
- **Partidos**: cómo fue cambiando cada cosa de un partido a otro.
- **Puntos**: cómo se hicieron los puntos, el pateo a los palos, de dónde salieron los tries y las
  chances en 22 rival.
- **Formaciones**: line, scrum y salidas (propias ganadas y recuperadas), y el line según cantidad de
  jugadores y posición.
- **Penales**: dónde y por qué se cometen, por tiempo, y las tarjetas con el tiempo jugado con uno menos.
- **Tackles**: completados, tipos de tackle y el detalle por jugador.
- **Informe**: un PDF armado para leer en el celular, para mandar por WhatsApp o imprimir.

Mirando un partido solo, además: cómo se fue dando el marcador, el 1° tiempo contra el 2° y cómo
estuvo ese partido al lado de la temporada.

Los números se muestran primero como "X de Y" y después en porcentaje, sin jerga. Se ve bien en la
computadora, la tablet y el celular.

---

## De dónde salen los datos

- **Uni-Dat**: la app con la que el club carga cada partido mientras se juega. El tablero lee esos
  partidos de la base de datos compartida, así que lo que se carga ahí aparece solo.
- **Carga manual**: para los partidos que no se cargaron en Uni-Dat y para sumar lo que la app no
  registra (las chances en 22 rival) o corregir tarjetas. Sólo pueden hacerlo los administradores.
- **Temporada 2025**: planillas de Excel incluidas en el proyecto.

---

## Tecnologías utilizadas

- **HTML, CSS y JavaScript** – una página estática, sin servidor propio (`web/sitio`)
- **Plotly.js** – los gráficos interactivos
- **jsPDF** – el informe en PDF
- **Supabase** – la base de datos compartida con Uni-Dat
- **Cloudflare Pages** – donde se publica la página

Hasta octubre de 2026 el tablero estaba hecho en Python con Streamlit. Ese código se guarda en
`streamlit/`, y la dirección vieja (tablero-cusf.streamlit.app) ahora lleva a la nueva.


---

## Estado del proyecto

En uso desde la temporada 2026, con mejoras a medida que el cuerpo técnico pide cosas nuevas.
