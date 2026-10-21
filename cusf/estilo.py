"""Aspecto del tablero: la paleta y las fuentes de Uni-Dat, el tema de los
gráficos y unas piezas de HTML (números grandes, barras "X de Y").

Todo texto que viene de los datos (rival, jugador, motivo) pasa por
`esc()` antes de entrar al HTML: un nombre cargado con etiquetas no se
ejecuta, se ve como texto.
"""

from html import escape

import plotly.graph_objects as go
import plotly.io as pio
import streamlit as st

# Paleta de Uni-Dat
BG, SUP, SUP2, BORDE = "#0a0c0f", "#13161b", "#1c2028", "#2a2f3a"
TEXTO, APAGADO, ACENTO = "#e8eaf0", "#8b93a3", "#1a6fd4"
UNI, RIVAL = "#00c853", "#ff9800"          # nosotros / ellos
MAL, NEUTRO, AVISO = "#ff1744", "#6b7280", "#ffd600"
TK = {"pos": UNI, "neu": NEUTRO, "neg": AVISO, "err": MAL}
TK_NOMBRE = {"pos": "Positivos", "neu": "Neutrales", "neg": "Negativos", "err": "Errados"}


def esc(x):
    return escape(str(x), quote=True)


def pct(a, b):
    return round(a * 100 / b) if b else 0


def xdey(a, b):
    """'18 de 24 · 75%': el denominador antes que el porcentaje."""
    return f"{a} de {b} · {pct(a, b)}%" if b else "—"


# ── Gráficos ─────────────────────────────────────────────────────────────────

pio.templates["cusf"] = go.layout.Template(layout=go.Layout(
    paper_bgcolor="rgba(0,0,0,0)", plot_bgcolor="rgba(0,0,0,0)",
    font=dict(family="DM Sans, system-ui, sans-serif", color=TEXTO, size=13),
    title=dict(font=dict(size=14, color=TEXTO), x=0, xanchor="left"),
    xaxis=dict(automargin=True, gridcolor="rgba(255,255,255,.06)", zerolinecolor="rgba(255,255,255,.12)",
               tickfont=dict(color=APAGADO), title_font=dict(color=APAGADO)),
    yaxis=dict(automargin=True, gridcolor="rgba(255,255,255,.06)", zerolinecolor="rgba(255,255,255,.12)",
               tickfont=dict(color=APAGADO), title_font=dict(color=APAGADO)),
    legend=dict(orientation="h", y=-0.18, x=0, font=dict(color=APAGADO)),
    hoverlabel=dict(bgcolor=SUP2, bordercolor=BORDE, font=dict(color=TEXTO)),
    margin=dict(l=8, r=8, t=36, b=8), colorway=[UNI, RIVAL, ACENTO, AVISO, MAL, NEUTRO],
    barcornerradius=3, separators=",.",
))
pio.templates.default = "cusf"


def grafico(fig, alto=320):
    # El mismo gráfico puede salir en dos pestañas (ej. los que más tacklearon):
    # cada uno lleva su número de orden en la pantalla como clave.
    n = st.session_state["_graficos"] = st.session_state.get("_graficos", 0) + 1
    fig.update_layout(height=alto, paper_bgcolor="rgba(0,0,0,0)", plot_bgcolor="rgba(0,0,0,0)")
    st.plotly_chart(fig, theme=None, width="stretch", key=f"g{n}",
                    config={"displayModeBar": False, "scrollZoom": False})


# ── CSS ──────────────────────────────────────────────────────────────────────

CSS = f"""
<style>
@import url('https://fonts.googleapis.com/css2?family=Bebas+Neue&family=DM+Mono:wght@400;500&family=DM+Sans:wght@400;500;700&display=swap');
/* La fuente se hereda: así no pisa la de los íconos de Streamlit */
.stApp {{ font-family: 'DM Sans', system-ui, sans-serif; }}
/* Usa todo el ancho de la pantalla (notebook o monitor), con márgenes que
   crecen con ella; sólo en pantallas muy anchas se frena para que se lea. */
.block-container {{ padding-top: 4.4rem; max-width: 1760px;
  padding-left: clamp(1rem, 3vw, 3.5rem); padding-right: clamp(1rem, 3vw, 3.5rem); }}
h1, h2, h3 {{ font-family: 'Bebas Neue', 'Arial Narrow', sans-serif !important;
  letter-spacing: 2px; font-weight: 400 !important; }}
h3 {{ font-size: 1.35rem !important; margin-top: .6rem !important; }}

/* Encabezado */
.enc {{ display:flex; align-items:center; gap:14px; margin-bottom:6px; }}
.enc img {{ height:54px; }}
.enc .t {{ font-family:'Bebas Neue',sans-serif; font-size:2rem; letter-spacing:4px; line-height:1;
  color:{TEXTO}; }}
.enc .s {{ font-family:'DM Mono',monospace; font-size:.72rem; letter-spacing:2px; color:{APAGADO}; }}

/* Números grandes */
.kpis {{ display:grid; grid-template-columns:repeat(auto-fit,minmax(130px,1fr)); gap:10px; margin:6px 0 14px; }}
.kpi {{ background:{SUP}; border:1px solid {BORDE}; border-radius:10px; padding:12px 10px; text-align:center; }}
.kpi .v {{ font-family:'Bebas Neue',sans-serif; font-size:2.3rem; line-height:1; letter-spacing:1px; }}
.kpi .l {{ font-family:'DM Mono',monospace; font-size:.68rem; letter-spacing:1.5px; color:{APAGADO};
  margin-top:6px; text-transform:uppercase; }}

/* Marcador del partido */
.marcador {{ background:{SUP}; border:1px solid {BORDE}; border-radius:12px; padding:14px;
  display:flex; justify-content:center; align-items:center; gap:22px; margin:4px 0 14px; }}
.marcador .eq {{ text-align:center; font-family:'DM Mono',monospace; font-size:.72rem; letter-spacing:2px; color:{APAGADO}; }}
.marcador .n {{ font-family:'Bebas Neue',sans-serif; font-size:3.4rem; line-height:1; }}
.marcador .sep {{ font-family:'Bebas Neue',sans-serif; font-size:2rem; color:{BORDE}; }}
.marcador .info {{ font-family:'DM Mono',monospace; font-size:.7rem; color:{APAGADO}; text-align:center; }}

.nota {{ font-size:.78rem; color:{APAGADO}; margin:4px 0 10px; }}

/* Anillos "X de Y" */
.anillos {{ display:grid; grid-template-columns:repeat(auto-fit,minmax(132px,1fr)); gap:10px; margin:4px 0 14px; }}
.anillo {{ background:{SUP}; border:1px solid {BORDE}; border-radius:12px; padding:14px 8px 12px; text-align:center; }}
.anillo .r {{ width:104px; height:104px; margin:0 auto; border-radius:50%; position:relative;
  display:grid; place-items:center; }}
.anillo .r::before {{ content:""; position:absolute; inset:10px; border-radius:50%; background:{SUP}; }}
.anillo .c {{ position:relative; color:{TEXTO}; font-family:'Bebas Neue',sans-serif; font-size:1.75rem; line-height:1; letter-spacing:.5px; }}
.anillo .c .de {{ display:block; font-family:'DM Mono',monospace; font-size:.74rem; color:{TEXTO}; letter-spacing:0; margin-top:2px; }}
.anillo .c small {{ display:block; font-family:'DM Mono',monospace; font-size:.68rem; color:{APAGADO};
  letter-spacing:1px; margin-top:3px; }}
.anillo .l {{ color:{TEXTO}; font-size:.8rem; margin-top:9px; line-height:1.25; }}
.anillo .l i {{ display:block; font-style:normal; font-family:'DM Mono',monospace; font-size:.64rem;
  letter-spacing:1.2px; color:{APAGADO}; text-transform:uppercase; }}
.grupo {{ font-family:'DM Mono',monospace; font-size:.7rem; letter-spacing:2px; color:{APAGADO};
  text-transform:uppercase; margin:10px 0 2px; }}

/* Tablas propias */
table.t {{ width:100%; border-collapse:collapse; font-size:.86rem; }}
table.t th {{ font-family:'DM Mono',monospace; font-weight:500; font-size:.7rem; letter-spacing:1px;
  color:{APAGADO}; text-align:right; padding:6px 6px; border-bottom:1px solid {BORDE}; }}
table.t td {{ padding:7px 6px; text-align:right; border-bottom:1px solid {SUP2};
  font-family:'DM Mono',monospace; }}
table.t td {{ white-space:nowrap; }}
table.t th:first-child, table.t td:first-child {{ text-align:left; font-family:'DM Sans',sans-serif; }}
.tabla-scroll {{ overflow-x:auto; }}

/* Pestañas legibles y tocables */
button[data-baseweb="tab"] {{ min-height:44px; }}
button[data-baseweb="tab"] p {{ font-family:'Bebas Neue',sans-serif; font-size:1.05rem !important; letter-spacing:1.5px; }}

/* Tablet parada: los gráficos lado a lado no entran, van uno abajo del otro */
@media (max-width: 860px) {{
  [data-testid="stHorizontalBlock"] {{ flex-wrap: wrap; }}
  [data-testid="stHorizontalBlock"] > [data-testid="stColumn"] {{ min-width: 100% !important; flex: 1 1 100% !important; }}
  .kpis:has(> .kpi:nth-child(6)) {{ grid-template-columns:repeat(3,1fr); }}
}}

@media (max-width: 640px) {{
  .block-container {{ padding-left:.8rem; padding-right:.8rem; padding-top:4rem; }}
  .enc img {{ height:42px; }} .enc .t {{ font-size:1.5rem; letter-spacing:3px; }}
  .kpis, .kpis:has(> .kpi:nth-child(6)) {{ grid-template-columns:repeat(2,1fr); }}
  .kpi .v {{ font-size:1.9rem; }} .marcador .n {{ font-size:2.6rem; }}
  .anillos {{ grid-template-columns:repeat(2,1fr) !important; }}
}}
</style>
"""


def aplicar():
    st.session_state["_graficos"] = 0
    st.markdown(CSS, unsafe_allow_html=True)


# ── Piezas de HTML ───────────────────────────────────────────────────────────

def html(x):
    st.markdown(x, unsafe_allow_html=True)


def kpis(items):
    """items: [(valor, rótulo, color|None)]"""
    html('<div class="kpis">' + "".join(
        f'<div class="kpi"><div class="v" style="color:{c or TEXTO}">{esc(v)}</div>'
        f'<div class="l">{esc(l)}</div></div>' for v, l, c in items) + "</div>")




def anillos(items, columnas=None):
    """items: [(rótulo, a, b, color, arriba|None)] -> un anillo por item con
    "a", abajo "de b" y el % (en tres renglones: entra aunque sean miles). `arriba` es el grupo (UNI / Rival)."""
    partes = []
    for rotulo, a, b, color, arriba in items:
        p = pct(a, b)
        centro = f'{a}<span class="de">de {b}</span><small>{p}%</small>' if b else "—<small>sin datos</small>"
        partes.append(f'<div class="anillo"><div class="r" style="background:conic-gradient({color} {p}%,{SUP2} 0)">'
                      f'<div class="c">{centro}</div></div>'
                      f'<div class="l">{f"<i>{esc(arriba)}</i>" if arriba else ""}{esc(rotulo)}</div></div>')
    fijo = f' style="grid-template-columns:repeat({columnas},1fr)"' if columnas else ""
    html(f'<div class="anillos"{fijo}>' + "".join(partes) + "</div>")


def aclarar(color, f=.45):
    """El mismo color, mezclado con blanco (para el anillo de afuera de una torta)."""
    r, g, b = (int(color[i:i + 2], 16) for i in (1, 3, 5))
    return "#" + "".join(f"{round(c + (255 - c) * f):02x}" for c in (r, g, b))




def tabla(columnas, filas):
    """Tabla simple; la primera columna a la izquierda. Todo se escapa."""
    cab = "".join(f"<th>{esc(c)}</th>" for c in columnas)
    cuerpo = "".join("<tr>" + "".join(f"<td>{esc(v)}</td>" for v in f) + "</tr>" for f in filas)
    html(f'<div class="tabla-scroll"><table class="t"><thead><tr>{cab}</tr></thead>'
         f"<tbody>{cuerpo}</tbody></table></div>")


def nota(txt):
    html(f'<div class="nota">{esc(txt)}</div>')
