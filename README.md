# Dashboard del Club Universitario de Santa Fe – Rugby - 2025  

[![Python](https://img.shields.io/badge/Python-3.12-blue?logo=python&logoColor=white)](https://www.python.org/)  
[![Streamlit](https://img.shields.io/badge/Streamlit-app-red?logo=streamlit)](https://streamlit.io/)  
[![Plotly](https://img.shields.io/badge/Plotly-visualizations-3DDC84?logo=plotly)](https://plotly.com/)  
[![Pandas](https://img.shields.io/badge/Pandas-data--analysis-purple?logo=pandas)](https://pandas.pydata.org/)  
[![License](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)  

Este proyecto es un **tablero interactivo** desarrollado para el **Club Universitario de Santa Fe** con **Streamlit** y **Plotly**, que permite analizar de forma integral el rendimiento del equipo a lo largo de la temporada.  

Acceso al tablero: [tablero-cusf.streamlit.app](https://tablero-cusf.streamlit.app/)  

---

## Funcionalidades principales  

- **Tablero general** con KPIs clave: puntos a favor, en contra, diferencia y XP por partido.  
- **Visualización de puntos**:  
  - Totales, composición (tries, conversiones, penales, drops).  
  - Precisión en conversiones y penales.  
- **Estadísticas de formaciones fijas**:  
  - **Line**: totales, lanzamientos propios y rivales.  
  - **Scrum**: totales, lanzamientos propios y rivales.  
- **Penales**:  
  - Totales por situación (line, scrum, ruck, juego, salidas).  
  - Detalle por motivo en ruck, juego y scrum.  
  - Conclusión con promedio de penales cometidos por partido.  
- **Salidas**:  
  - Totales, propias y rivales.  
  - **Salidas de 22** desglosadas.  
- **Efectividad en 22 rival**: comparación de chances vs concretadas.  
- **Tackles**:  
  - Totales por jugador, con % de efectividad y PJ jugados.  
  - Gráficos por tipo de tackle (positivo, negativo, neutral, errado).  
- **Generación de informe PDF** automático con KPIs, gráficos y conclusiones.  

---

## Tecnologías utilizadas  

- **Python 3.12**  
- **Streamlit** – Tablero web interactivo  
- **Plotly** – Visualizaciones interactivas  
- **Pandas** – Procesamiento de datos  
- **ReportLab** – Exportación a PDF  

---

## Estructura esperada de los datos  

- Archivos de partidos individuales (`Tackles_FechaX_Club.xlsx`):  
  - Hoja **Resumen** con columnas:  
    - `jugador` (número de camiseta)  
    - `nombre del jugador`  
    - `tackles`, `errados`  
    - `positivos`, `negativos`, `neutrales`  

- Archivo consolidado `Estadistica.xlsx`:  
  - Hoja **Penales** (situaciones, motivos, propios/rival).  
  - Hojas **Line**, **Scrum**, **Salidas**, **Salidas de 22**, **Efectividad 22**, **Puntos**.  
  - Hoja **Info** - cantidad de partidos jugados.  

---

## Estado del proyecto  

- Proyecto en **desarrollo activo**.  
- Se irán agregando nuevas visualizaciones, mejoras en la interfaz y opciones de análisis comparativo.  

---

## Próximas ideas  

- Evolución de cada métrica a lo largo de la temporada.  
- Comparativas entre jugadores, rivales y partidos.  
- Análisis de tendencias y promedios históricos.  
- Exportación automática de reportes personalizados para entrenadores y staff.  
