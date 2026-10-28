"""El tablero se mudó: lo que queda en Streamlit Cloud (tablero-cusf.streamlit.app)
es este cartel con el link nuevo, para que los links viejos lleven a algún lado.

El tablero viejo, en Python, está guardado en streamlit/.
"""

import os

import streamlit as st

NUEVO = "https://cusf-tablero.pages.dev/"
AQUI = os.path.dirname(os.path.abspath(__file__))

st.set_page_config(page_title="Tablero · CUSF", page_icon=os.path.join(AQUI, "streamlit", "assets", "icono.png"),
                   layout="centered")

st.image(os.path.join(AQUI, "streamlit", "assets", "escudo.png"), width=96)
st.title("El tablero se mudó")
st.write("El tablero de Universitario Rugby ahora está en una dirección nueva. "
         "Tiene lo mismo de siempre.")
st.link_button("Ir al tablero nuevo", NUEVO, type="primary")
st.caption(f"La dirección nueva es {NUEVO} — guardala en favoritos o agregala a la pantalla de inicio del celular.")
