## Dashboard de Tackles por Jugador

Este proyecto es un tablero interactivo desarrollado para el Club Universiario de Santa Fe con Streamlit y Plotly, que permite analizar el rendimiento defensivo de jugadores de rugby (u otros deportes de contacto). Visualiza de forma clara y dinámica la cantidad de tackles realizados, con su tipo positivo, negativo o neutral, los errados y su precisión defensiva.

## Funcionalidades principales

- Visualización por partido de tackles exitosos vs errados por jugador.
- Etiquetas dinámicas con porcentaje de efectividad (ej. 6/7 (86%)).
- Agrupamiento por nombre y número de camiseta.
- Gráfico de barras apiladas ordenado y de fácil lectura.
- Soporte para múltiples archivos .xlsx con datos por partido.
- Preparado para futuras extensiones (mapas de calor, comparativas, evolución por temporada, etc.).

## Tecnologías utilizadas

- Python 3.12
- Plotly – Visualizaciones interactivas
- Pandas – Procesamiento de datos
- Streamlit – Tablero web interactivo

## Estado del proyecto

Proyecto en desarrollo activo.  
Se irán agregando nuevas estadísticas y visualizaciones a medida que se carguen más partidos.

## Estructura esperada de los datos

Cada archivo `.xlsx` debe contener una hoja llamada `Resumen` con las siguientes columnas mínimas:

- `jugador` (número de camiseta)
- `nombre del jugador`
- `tackles`
- `errados`
- `positivos`, `negativos`, `neutrales`

## Próximas ideas

- Evolución de cada jugador a lo largo del tiempo.
- Comparativa entre jugadores o entre partidos.

---

Cualquier sugerencia o colaboración es bienvenida.
