# Tablero del Club Universitario de Santa Fe – Rugby

[![Python](https://img.shields.io/badge/Python-3.13-blue?logo=python&logoColor=white)](https://www.python.org/)
[![Streamlit](https://img.shields.io/badge/Streamlit-app-red?logo=streamlit)](https://streamlit.io/)
[![Plotly](https://img.shields.io/badge/Plotly-visualizaciones-3DDC84?logo=plotly)](https://plotly.com/)
[![Supabase](https://img.shields.io/badge/Supabase-datos-3ECF8E?logo=supabase&logoColor=white)](https://supabase.com/)

Este proyecto es un **tablero interactivo** del **Club Universitario de Santa Fe** para seguir el
rendimiento del equipo de rugby a lo largo de la temporada y partido por partido: puntos, formaciones
fijas, penales, tarjetas, tackles y los objetivos que se pone el equipo.

Acceso al tablero: [tablero-cusf.streamlit.app](https://tablero-cusf.streamlit.app/)

---

## Qué se puede ver

Arriba se elige la **temporada**, la **categoría** y si se mira **toda la temporada** o **un partido**.

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
- **Informe**: un PDF con las tablas, para mandar o imprimir.

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

- **Python 3.13**
- **Streamlit** – el tablero web
- **Plotly** – los gráficos interactivos
- **Pandas** – el manejo de los datos
- **Supabase** – la base de datos compartida con Uni-Dat
- **ReportLab** – el informe en PDF


---

## Estado del proyecto

En uso desde la temporada 2026, con mejoras a medida que el cuerpo técnico pide cosas nuevas.
