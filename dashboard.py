"""Tablero del Club Universitario de Santa Fe — rugby.

Lee los partidos de la base de Uni-Dat (Supabase), los cargados a mano en
el tablero y la planilla 2025. Correr local:  python -m streamlit run dashboard.py
"""

import base64
import os

import streamlit as st

AQUI = os.path.dirname(os.path.abspath(__file__))
st.set_page_config(page_title="Tablero · CUSF", page_icon=os.path.join(AQUI, "assets", "icono.png"),
                   layout="wide")

from cusf import cargar, estilo, fuente, informe, vistas  # noqa: E402

estilo.aplicar()


@st.cache_data
def _escudo():
    with open(os.path.join(AQUI, "assets", "escudo.png"), "rb") as f:
        return base64.b64encode(f.read()).decode()


def encabezado(sub):
    estilo.html(f'<div class="enc"><img src="data:image/png;base64,{_escudo()}" alt="">'
                f'<div><div class="t">Universitario Rugby</div><div class="s">{estilo.esc(sub)}</div></div></div>')


def tablero():
    arriba = st.empty()   # el encabezado va arriba, pero depende de lo que se elija abajo
    try:
        partidos, _ = fuente.partidos_base()
    except fuente.ErrorBase as e:
        st.error(str(e) + " Se muestra sólo la temporada 2025.")
        partidos = []
    anios = fuente.anios_disponibles(partidos)
    c1, c2 = st.columns([1, 2])
    # radio y no segmented_control: tocar el elegido no lo deja vacío
    anio = c1.radio("Temporada", anios, horizontal=True, key="anio")
    if anio == fuente.ANIO_PLANILLA:
        t, sub = fuente.temporada_planilla(), "Temporada 2025 · planilla"
    else:
        cats = sorted({fuente.categoria_base(p["categoria"]) for p in partidos if p["fecha"].startswith(str(anio))},
                      key=lambda c: (c != "Primera", c))
        cat = c2.radio("Categoría", cats, horizontal=True, key=f"cat{anio}")
        t, sub = fuente.temporada(partidos, anio, cat), f"Temporada {anio} · {cat}"

    por_id = {p["id"]: p for p in t["partidos"]}
    opciones = ["temporada"] + list(reversed(por_id))
    sel = st.selectbox("Ver", opciones, key=f"ver{anio}{sub}",
                       format_func=lambda i: "Toda la temporada" if i == "temporada" else vistas.etiqueta(por_id[i]))
    with arriba.container():
        encabezado(sub)

    if sel == "temporada":
        if not t["partidos"] and not t["planilla"]:
            st.info("Todavía no hay partidos de esta temporada.")
            return
        tabs = st.tabs(["Resumen", "Objetivos", "Partidos", "Puntos", "Formaciones", "Penales", "Tackles",
                        "Informe"])
        secciones = [vistas.resumen, vistas.objetivos, vistas.evolucion, vistas.puntos, vistas.formaciones,
                     vistas.penales, vistas.tackles]
        for tab, f in zip(tabs, secciones):
            with tab:
                f(t)
        with tabs[-1]:
            _informe(f"Informe {sub}", t, "temporada")
        return

    p = por_id[sel]
    vistas.marcador(p)
    if t["planilla"]:
        vistas.tackles(t, p)
        return
    tp = vistas.una(p, t)
    tabs = st.tabs(["Resumen", "Objetivos", "1° vs 2° tiempo", "Puntos", "Formaciones", "Penales", "Tackles",
                    "Informe"])
    with tabs[0]:
        vistas.partido_resumen(p, t, tp)
    with tabs[1]:
        vistas.objetivos(tp)
    with tabs[2]:
        vistas.tiempos(p)
    with tabs[3]:
        vistas.puntos(tp)
    with tabs[4]:
        vistas.formaciones(tp)
    with tabs[5]:
        vistas.penales(tp)
    with tabs[6]:
        vistas.tackles(tp, p)
    with tabs[7]:
        _informe(f"Informe UNI {p['score_uni']}-{p['score_rival']} {p['rival']} ({p['fecha']})", tp, p["id"])


def _informe(titulo, t, clave):
    estilo.nota("Un PDF con las tablas de esta pantalla, para mandar o imprimir.")
    if st.button("Preparar PDF", key=f"pdf{clave}"):
        st.session_state[f"pdf{clave}"] = informe.generar(titulo, t, vistas.etiqueta)
    if st.session_state.get(f"pdf{clave}"):
        st.download_button("Descargar PDF", st.session_state[f"pdf{clave}"], type="primary",
                           file_name=titulo.replace(" ", "_").replace("·", "") + ".pdf",
                           mime="application/pdf", key=f"dl{clave}")


def pagina_cargar():
    encabezado("Carga manual · sólo admins")
    cargar.pagina()


st.navigation([st.Page(tablero, title="Tablero", icon=":material/insights:", default=True),
               st.Page(pagina_cargar, title="Cargar partido", icon=":material/edit_note:",
                       url_path="cargar")], position="top").run()
