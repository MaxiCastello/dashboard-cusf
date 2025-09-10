import streamlit as st
import pandas as pd
import plotly.express as px
import plotly.graph_objects as go
import unicodedata
import os
import io
import plotly.io as pio
from reportlab.lib.pagesizes import A4
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, Image, PageBreak
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib import colors


# Configuracion inicial + modo celu
st.set_page_config(page_title="Dashboard de Universitario", layout="wide")
st.title("📊 Dashboard Temporada 2025")

with st.sidebar:
    modo_celular = st.toggle("📱 Modo celular", help="Mejora la visualización de los gráficos para celular.")
    vista = st.radio(
        "Navegación",
        ["Tablero", "Tackles", "Penales", "Line", "Scrum", "Salidas", "Salidas 22", "Efectividad 22", "Puntos", "Informe PDF"],
        index=0,
    )

SHOW_SECCIONES = (vista not in ["Tablero", "Informe PDF"])

if modo_celular:
    altura_grafico = 500
    margen_titulo = dict(l=20, r=20, t=40, b=20)
    texto_tamanio = 7
    altura_donut = 250
    margen_donut = dict(l=20, r=20, t=50, b=20)
else:
    altura_grafico = 900
    margen_titulo = dict(l=120, r=50, t=50, b=50)
    texto_tamanio = 11
    altura_donut = 400
    margen_donut = dict(l=80, r=80, t=80, b=50)

# Helpers
def normalizar_texto(s):
    if pd.isna(s):
        return ""
    s = str(s).strip().lower()
    s = " ".join(s.split())
    s = "".join(c for c in unicodedata.normalize("NFD", s) if unicodedata.category(c) != "Mn")
    return s.title()

DASHBOARD_CSS = """
<style>
.block-container{padding-top:1rem;padding-bottom:.6rem}
.card{background:#202226;border:1px solid #2e3136;border-radius:14px;padding:14px 16px;box-shadow:0 2px 10px rgba(0,0,0,.25)}
.card h4{margin:0 0 6px 0;font-weight:600}
.kpi{background:#202226;border:1px solid #2e3136;border-radius:14px;padding:12px 16px}
.kpi .val{font-size:28px;font-weight:700;line-height:1}
.kpi .lbl{opacity:.85;font-size:13px;margin-top:6px}
.js-plotly-plot .legend{margin-top:-4px}
</style>
"""
st.markdown(DASHBOARD_CSS, unsafe_allow_html=True)

def kpi_card(label, value, delta=None):
    st.markdown('<div class="kpi">', unsafe_allow_html=True)
    st.markdown(f'<div class="val">{value}</div>', unsafe_allow_html=True)
    st.markdown(f'<div class="lbl">{label}' + (f' — {delta}' if delta else '') + '</div>', unsafe_allow_html=True)
    st.markdown('</div>', unsafe_allow_html=True)

def card(title, render_func):
    st.markdown('<div class="card">', unsafe_allow_html=True)
    st.markdown(f"<h4>{title}</h4>", unsafe_allow_html=True)
    render_func()
    st.markdown('</div>', unsafe_allow_html=True)

def grid(ncols=3, gap="small"):
    return st.columns(ncols, gap=gap)

# Selector en tarjetas
def switch_card(titulo, opciones: dict, default_key=None, height=260):
    if not opciones:
        st.info("Sin datos.")
        return
    keys = list(opciones.keys())
    if default_key is None or default_key not in opciones:
        default_key = keys[0]
    col_tit, col_sel = st.columns([0.6, 0.4])
    with col_tit:
        st.markdown(f"#### {titulo}")
    with col_sel:
        choice = st.selectbox(" ", keys, index=keys.index(default_key),
                              label_visibility="collapsed", key=f"{titulo}_sel")
    fig = opciones[choice]
    if fig is not None:
        fig.update_layout(height=height, margin=dict(l=20, r=20, t=40, b=20))
        st.plotly_chart(fig, use_container_width=True, config={"displayModeBar": False})
    else:
        st.warning("No hay figura para esta opción.")


# REPORTLAB, creacion del PDF
def fig_to_img(fig, w=1200, h=700, scale=2, width_pt=180):
    fig.update_layout(paper_bgcolor="white", plot_bgcolor="white", template="plotly_white")
    img_bytes = pio.to_image(fig, format="png", width=w, height=h, scale=scale, engine="kaleido")
    buf = io.BytesIO(img_bytes)
    return Image(buf, width=width_pt, height=width_pt * (h / w))

def generar_informe_pdf(
    titulo="Informe Club Universitario – TRL B - 2025",
    kpis=None, tabla_puntos=None, figs=None,
    tackles_tabla=None, conclusion_22=None, conclusion_penales=None,
):
    if kpis is None: kpis = {}
    if figs is None: figs = {}
    buf_pdf = io.BytesIO()
    doc = SimpleDocTemplate(buf_pdf, pagesize=A4, leftMargin=28, rightMargin=28, topMargin=28, bottomMargin=28)
    S = getSampleStyleSheet()
    H1 = ParagraphStyle("H1", parent=S["Heading1"], spaceAfter=8)
    H2 = ParagraphStyle("H2", parent=S["Heading2"], spaceBefore=8, spaceAfter=6)
    P  = ParagraphStyle("P",  parent=S["BodyText"], leading=14)

    PAGE_W, _ = A4
    USABLE_W = PAGE_W - (28 + 28)

    def colw(n, gap=8):
        return (USABLE_W - gap*(n-1)) / n

    W_FULL  = USABLE_W
    W_HALF  = colw(2)
    W_THIRD = colw(3) * 1.1

    def _for_pdf(fig, title_size=12, top=28, base_font=12, tick=11):
        fig.update_layout(
            margin=dict(l=0, r=0, t=top, b=6),
            title=dict(font=dict(size=title_size)),
            font=dict(size=base_font),
            legend=dict(orientation="h", x=0.5, xanchor="center", y=-0.18, yanchor="top"),
            xaxis=dict(tickfont=dict(size=tick)),
            yaxis=dict(tickfont=dict(size=tick)),
        )
        return fig

    story = []
    story.append(Paragraph(titulo, H1))
    story.append(Spacer(1, 6))

    if kpis:
        kpi_txt = (f"<b>Puntos:</b> {kpis.get('pf',0)} a favor · {kpis.get('pc',0)} en contra · "
                   f"dif: {kpis.get('dif',0)} · XP: {kpis.get('xp_favor',0):.1f} vs {kpis.get('xp_contra',0):.1f} "
                   f"({kpis.get('partidos',0)} PJ)")
        story.append(Paragraph(kpi_txt, P))
        story.append(Spacer(1, 8))

    row_imgs = []
    if figs.get("puntos_bar"):    row_imgs.append(fig_to_img(_for_pdf(figs["puntos_bar"]),    width_pt=W_THIRD))
    if figs.get("puntos_comp_f"): row_imgs.append(fig_to_img(_for_pdf(figs["puntos_comp_f"]), width_pt=W_THIRD))
    if figs.get("puntos_comp_c"): row_imgs.append(fig_to_img(_for_pdf(figs["puntos_comp_c"]), width_pt=W_THIRD))

    if row_imgs:
        story.append(Paragraph("Puntos", H1))
        story.append(Table([row_imgs], colWidths=[W_THIRD]*len(row_imgs), hAlign="CENTER",
                           style=[("LEFTPADDING",(0,0),(-1,-1),0), ("RIGHTPADDING",(0,0),(-1,-1),0)]))
        story.append(Spacer(1, 6))

    if figs.get("puntos_acc"):
        story.append(Table([[fig_to_img(_for_pdf(figs["puntos_acc"]), width_pt=W_FULL)]],
                           colWidths=[W_FULL], hAlign="CENTER",
                           style=[("LEFTPADDING",(0,0),(-1,-1),0), ("RIGHTPADDING",(0,0),(-1,-1),0)]))
        story.append(Spacer(1, 8))

    if tabla_puntos:
        t = Table(tabla_puntos, hAlign="CENTER")
        t.setStyle(TableStyle([
            ("BACKGROUND",(0,0),(-1,0),colors.HexColor("#222")),
            ("TEXTCOLOR",(0,0),(-1,0),colors.whitesmoke),
            ("GRID",(0,0),(-1,-1),0.4,colors.grey),
            ("ALIGN",(0,0),(-1,-1),"CENTER"),
            ("VALIGN",(0,0),(-1,-1),"MIDDLE"),
        ]))
        story.append(t); story.append(Spacer(1, 8))

    pen_list = [f for f in [figs.get("pen_situaciones"), figs.get("pen_ruck"), figs.get("pen_juego"), figs.get("pen_scrum")] if f]
    pen_imgs = [fig_to_img(_for_pdf(f), width_pt=W_HALF) for f in pen_list]
    if pen_imgs:
        story.append(Paragraph("Penales", H2))
        rows = [pen_imgs[i:i+2] for i in range(0, len(pen_imgs), 2)]
        for r in rows:
            story.append(Table([r], colWidths=[W_HALF]*len(r), hAlign="CENTER",
                               style=[("LEFTPADDING",(0,0),(-1,-1),0), ("RIGHTPADDING",(0,0),(-1,-1),0)]))
            story.append(Spacer(1, 6))
    if conclusion_penales:
        story.append(Spacer(1, 4)); story.append(Paragraph(conclusion_penales, P)); story.append(Spacer(1, 8))

    for titulo_secc, trio in [
        ("Line",  [figs.get("line_total"), figs.get("line_prop"),  figs.get("line_rival")]),
        ("Scrum", [figs.get("scrum_total"), figs.get("scrum_prop"), figs.get("scrum_rival")]),
    ]:
        trio = [fig_to_img(_for_pdf(f), width_pt=W_THIRD) for f in trio if f]
        if trio:
            story.append(Paragraph(titulo_secc, H2))
            story.append(Table([trio], colWidths=[W_THIRD]*len(trio), hAlign="CENTER",
                               style=[("LEFTPADDING",(0,0),(-1,-1),0), ("RIGHTPADDING",(0,0),(-1,-1),0)]))
            story.append(Spacer(1, 6))

    for titulo_secc, trio in [
        ("Salidas",       [figs.get("salidas_total"),  figs.get("salidas_prop"),  figs.get("salidas_rival")]),
        ("Salidas de 22", [figs.get("salidas22_total"), figs.get("salidas22_prop"), figs.get("salidas22_rival")]),
    ]:
        trio = [fig_to_img(_for_pdf(f), width_pt=W_THIRD) for f in trio if f]
        if trio:
            story.append(Paragraph(titulo_secc, H2))
            story.append(Table([trio], colWidths=[W_THIRD]*len(trio), hAlign="CENTER",
                               style=[("LEFTPADDING",(0,0),(-1,-1),0), ("RIGHTPADDING",(0,0),(-1,-1),0)]))
            story.append(Spacer(1, 6))

    if figs.get("efectividad22"):
        story.append(Paragraph("Efectividad en 22 Rival", H2))
        story.append(fig_to_img(_for_pdf(figs["efectividad22"]), width_pt=W_FULL))
        story.append(Spacer(1, 6))
        if conclusion_22:
            story.append(Paragraph(conclusion_22, P)); story.append(Spacer(1, 8))

    if tackles_tabla is not None:
        story.append(Paragraph("Tackles Totales por jugador", H2)); story.append(tackles_tabla); story.append(Spacer(1, 12))
    elif figs.get("tackles_total"):
        story.append(Paragraph("Tackles Totales por jugador", H2))
        story.append(fig_to_img(_for_pdf(figs["tackles_total"]), width_pt=W_FULL))
        story.append(Spacer(1, 8))

    story.append(PageBreak())
    story.append(Paragraph("Generado automáticamente desde el dashboard de Universitario.", P))
    doc.build(story)
    buf_pdf.seek(0)
    return buf_pdf


# Carga de datos
carpeta_data = "data/"
archivos = [
    os.path.join(carpeta_data, archivo)
    for archivo in os.listdir(carpeta_data)
    if archivo.endswith(".xlsx") and not os.path.basename(archivo).lower().startswith("estadistica")
]

if archivos:
    resumen_total = pd.DataFrame()
    tabla_tackles = None
    for archivo in archivos:
        try:
            hojas = pd.read_excel(archivo, sheet_name=None)
            if 'Resumen' not in hojas:
                st.warning(f"⚠️ El archivo '{os.path.basename(archivo)}' no contiene una hoja llamada 'Resumen'.")
                continue
            resumen = hojas['Resumen']
            resumen.columns = resumen.columns.str.strip().str.lower()
            for col in resumen.columns:
                if "nombre" in col and "jugador" in col:
                    resumen.rename(columns={col: "nombre del jugador"}, inplace=True)
            resumen["archivo"] = os.path.basename(archivo)
            resumen_total = pd.concat([resumen_total, resumen], ignore_index=True)
        except Exception as e:
            st.error(f"❌ Error al procesar el archivo {os.path.basename(archivo)}: {e}")

    if not resumen_total.empty:
        if SHOW_SECCIONES:   # solo fuera de Tablero e Informe PDF
            st.success("✅ Todos los archivos cargados correctamente.")
            expandir_todo = st.checkbox("🔽 Mostrar todos los gráficos desplegados", value=False)
        else:
            expandir_todo = False
        
    # Render por archivo (solo si NO es Tablero)
    if SHOW_SECCIONES:
        for archivo in archivos:
            resumen = pd.read_excel(archivo, sheet_name="Resumen")
            resumen.columns = resumen.columns.str.strip().str.lower()
            for col in resumen.columns:
                if "nombre" in col and "jugador" in col:
                    resumen.rename(columns={col: "nombre del jugador"}, inplace=True)
                    resumen["nombre completo"] = resumen["nombre del jugador"].astype(str) + " (" + resumen["jugador"].astype(str) + ")"

            with st.expander(f"📁 Datos del archivo: {os.path.basename(archivo)}", expanded=expandir_todo):
                jugadores_completos = pd.DataFrame({"jugador": list(map(str, range(1, 26)))})
                resumen["jugador"] = resumen["jugador"].astype(str)
                resumen = jugadores_completos.merge(resumen, on="jugador", how="left")
                resumen["nombre del jugador"] = resumen["nombre del jugador"].fillna("")
                resumen["nombre completo"] = resumen["nombre del jugador"] + " (" + resumen["jugador"] + ")"
                resumen = resumen[resumen["nombre del jugador"] != ""]
                columnas_numericas = ["tackles", "errados", "positivos", "neutrales", "negativos"]
                for col in columnas_numericas:
                    resumen[col] = resumen[col].fillna(0).astype(int)
                resumen["total"] = resumen["tackles"] + resumen["errados"]
                resumen["porcentaje"] = resumen.apply(
                    lambda row: (row["tackles"] / row["total"] * 100) if row["total"] > 0 else 0, axis=1
                ).round(0).astype(int)
                resumen["etiqueta"] = resumen.apply(
                    lambda row: f'{row["tackles"]}/{row["total"]} ({row["porcentaje"]}%)' if row["total"] > 0 else '',
                    axis=1
                )

                st.subheader("📈 Gráfico de Tackles por partido por número de jugador")
                df_plot = resumen.melt(
                    id_vars=["nombre completo", "etiqueta"],
                    value_vars=["tackles", "errados"],
                    var_name="resultado",
                    value_name="cantidad"
                )
                df_plot["texto"] = df_plot.apply(
                    lambda row: row["etiqueta"] if (
                        (row["resultado"] == "tackles" and row["cantidad"] > 0) or
                        (row["resultado"] == "errados" and row["cantidad"] > 0 and row["etiqueta"].startswith("0/"))
                    ) else "",
                    axis=1
                )
                altura = 1300 if modo_celular else 900
                fig = px.bar(
                    df_plot, y="nombre completo", x="cantidad", color="resultado", orientation="h",
                    color_discrete_map={"tackles": "#253094", "errados": "#8F1B30"},
                    title="Tackles Exitosos y Errados por Jugador",
                    category_orders={"jugador": list(map(str, range(1, 26)))},
                    text="texto"
                )
                fig.update_traces(textposition="outside")
                fig.update_layout(
                    yaxis=dict(title="Jugador", categoryorder="total descending"),
                    xaxis=dict(title="Cantidad de Tackles", range=[0, 16], tick0=0, dtick=1),
                    barmode="stack", height=altura
                )
                st.plotly_chart(fig, use_container_width=True)

                # Donut por archivo
                st.subheader("Distribución de Tipos de Tackles")
                total_tipos = {
                    "Positivos": resumen["positivos"].sum(),
                    "Neutrales": resumen["neutrales"].sum(),
                    "Negativos": resumen["negativos"].sum(),
                    "Errados": resumen["errados"].sum()
                }
                df_torta = pd.DataFrame({"tipo": list(total_tipos.keys()), "cantidad": list(total_tipos.values())})
                fig_torta = px.pie(
                    df_torta, names="tipo", values="cantidad", color="tipo",
                    title="Gráfico de Tipos de Tackles",
                    color_discrete_map={"Positivos": "#28A745", "Neutrales": "#95A5A6", "Negativos": "#253094", "Errados": "#8F1B30"},
                    hole=0.3
                )
                fig_torta.update_traces(textinfo="label+percent")
                fig_torta.update_layout(height=altura_donut, margin=margen_titulo, uniformtext_minsize=texto_tamanio)
                st.plotly_chart(fig_torta, use_container_width=True)

    # Tackles
    if "nombre del jugador" in resumen_total.columns:
        resumen_total["nombre del jugador"] = resumen_total["nombre del jugador"].apply(normalizar_texto)
        resumen_total = resumen_total[resumen_total["nombre del jugador"] != ""]

        # ---- Totales por jugador
        df_nombre = resumen_total.copy()
        for c in ["tackles","errados","positivos","neutrales","negativos"]:
            df_nombre[c] = df_nombre[c].fillna(0).astype(int)
        conteo_partidos = resumen_total["nombre del jugador"].value_counts().reset_index()
        conteo_partidos.columns = ["nombre del jugador", "PJ"]
        df_sumado = df_nombre.groupby("nombre del jugador")[["tackles","errados","positivos","neutrales","negativos"]].sum().reset_index()
        df_sumado = df_sumado.merge(conteo_partidos, on="nombre del jugador", how="left")
        df_sumado["total"] = df_sumado["tackles"] + df_sumado["errados"]
        df_sumado["porcentaje"] = (df_sumado["tackles"] / df_sumado["total"] * 100).round(1)
        df_sumado["etiqueta"] = (
            df_sumado["tackles"].astype(str) + "/" + df_sumado["total"].astype(str) + " (" +
            df_sumado["porcentaje"].astype(str) + "%) – " + df_sumado["PJ"].astype(str) + " PJ"
        )
        df_sumado = df_sumado.sort_values("total", ascending=False)

        # Tabla para PDF
        data_tabla = [["Jugador","Tackles","Errados","Efectividad (%)","PJ"]]
        for _, f in df_sumado.iterrows():
            data_tabla.append([f["nombre del jugador"], int(f["tackles"]), int(f["errados"]), f"{f['porcentaje']}%", int(f["PJ"])])
        tabla_tackles = Table(data_tabla, repeatRows=1, hAlign="LEFT")
        tabla_tackles.setStyle(TableStyle([
            ("BACKGROUND",(0,0),(-1,0),colors.HexColor("#253094")),
            ("TEXTCOLOR",(0,0),(-1,0),colors.whitesmoke),
            ("ALIGN",(0,0),(-1,-1),"CENTER"),
            ("GRID",(0,0),(-1,-1),0.5,colors.black),
            ("FONTSIZE",(0,0),(-1,-1),8),
        ]))

        # Figura total 
        df_melted = df_sumado.melt(id_vars=["nombre del jugador","etiqueta"],
                                   value_vars=["tackles","errados"],
                                   var_name="resultado", value_name="cantidad")
        df_melted["nombre del jugador"] = pd.Categorical(df_melted["nombre del jugador"],
                                                         categories=df_sumado["nombre del jugador"], ordered=True)
        df_melted["texto"] = df_melted.apply(lambda r: r["etiqueta"] if r["resultado"]=="tackles" else "", axis=1)
        fig_total = px.bar(
            df_melted, y="nombre del jugador", x="cantidad", color="resultado", orientation="h",
            color_discrete_map={"tackles":"#253094","errados":"#8F1B30"},
            title="Tackles Totales por Nombre de Jugador",
        )
        max_total = int(df_sumado["total"].max()); padding = 10
        fig_total.update_layout(
            xaxis=dict(title="Cantidad de Tackles", range=[0, max_total + padding], tick0=0, dtick=5),
            barmode="stack", height=altura_grafico, margin=dict(l=180, r=120, t=60, b=80),
        )
        for _, r in df_sumado.iterrows():
            fig_total.add_annotation(x=float(r["total"])+0.5, y=r["nombre del jugador"],
                                     text=str(r["etiqueta"]), showarrow=False, xanchor="left", yanchor="middle",
                                     font=dict(size=10), align="left")

        # Donut por jugador 
        if SHOW_SECCIONES and vista == "Tackles":
            st.subheader("📶 Gráfico de Tackles Totales por Nombre de Jugador")
            st.plotly_chart(fig_total, use_container_width=True)
            st.subheader("🎯 Porcentaje de tipos de tackles por jugador")
            jugador_donut = st.selectbox("Seleccioná un jugador:", df_sumado["nombre del jugador"].unique())
            fila_jugador = df_sumado[df_sumado["nombre del jugador"] == jugador_donut].iloc[0]
            valores = [fila_jugador.get("positivos",0), fila_jugador.get("neutrales",0),
                       fila_jugador.get("negativos",0), fila_jugador.get("errados",0)]
            etiquetas = ["Positivos","Neutrales","Negativos","Errados"]
            colores = ["#28A745","#95A5A6","#253094","#8F1B30"]
            fig_donut = go.Figure(data=[go.Pie(labels=etiquetas, values=valores, hole=0.5,
                                               marker=dict(colors=colores),
                                               textinfo="label+value+percent", textposition='outside',
                                               hoverinfo="label+value+percent")])
            tackles_reales = fila_jugador.get("positivos",0)+fila_jugador.get("neutrales",0)+fila_jugador.get("negativos",0)
            errados = fila_jugador.get("errados",0); pj = int(fila_jugador['PJ'])
            promedio = tackles_reales/pj if pj>0 else 0
            titulo_donut = (f"{jugador_donut} – {int(tackles_reales+errados)} intentos de tackle "
                            f"({int(tackles_reales)} realizados, {int(errados)} errados) en {pj} PJ "
                            f"(Promedio: {promedio:.1f}/PJ)")
            fig_donut.update_layout(title=titulo_donut, height=altura_donut, margin=margen_donut,
                                    legend=dict(orientation="h", x=0.5, xanchor="center", y=-0.15, yanchor="top"))
            st.plotly_chart(fig_donut, use_container_width=True)

        # Tipos de tackles, total.
        if SHOW_SECCIONES and vista == "Tackles":
            st.subheader("🌐 Efectividad TOTAL de tipos de tackles")
            resumen_limpio = resumen_total[~resumen_total["jugador"].astype(str).str.lower().isin(
                ["positivos","neutrales","negativos","errados"]
            )]
            total_global = {
                "Positivos": resumen_limpio["positivos"].fillna(0).sum(),
                "Neutrales": resumen_limpio["neutrales"].fillna(0).sum(),
                "Negativos": resumen_limpio["negativos"].fillna(0).sum(),
                "Errados": resumen_limpio["errados"].fillna(0).sum()
            }
            df_global_tipos = pd.DataFrame({"Tipo de Tackle": list(total_global.keys()),
                                            "Cantidad": list(total_global.values())})
            fig_global = go.Figure(data=[go.Pie(labels=df_global_tipos["Tipo de Tackle"],
                                                values=df_global_tipos["Cantidad"],
                                                hole=0.4,
                                                marker=dict(colors=["#28A745","#95A5A6","#253094","#8F1B30"]),
                                                textinfo="label+value+percent", textposition='outside',
                                                hoverinfo="label+value+percent")])
            fig_global.update_layout(title="Efectividad Total de Tackles (Totales)",
                                     height=altura_donut, margin=margen_donut,
                                     legend=dict(orientation="h", x=0.5, xanchor="center", y=-0.15, yanchor="top"),
                                     uniformtext_minsize=texto_tamanio)
            st.plotly_chart(fig_global, use_container_width=True)
    else:
        if SHOW_SECCIONES and vista == "Tackles":
            st.warning("⚠️ No se pudo encontrar una columna estándar para 'Nombre del jugador'.")

else:
    st.info("📁 Por favor, cargá uno o más archivos.")

# PENAL, LINE, SCRUM, SALIDAS, 22, EFECTIVIDAD, PUNTOS
try:
    archivo_estadistica = os.path.join("data", "Estadistica.xlsx")
    penales = pd.read_excel(archivo_estadistica, sheet_name="Penales")
    penales.columns = penales.columns.str.strip().str.lower()

    # Penales
    if {"situacion","propios","rival","motivo"}.issubset(set(penales.columns)):
        penales["situacion"] = penales["situacion"].astype(str).str.strip().str.lower()
        penales["motivo"]    = penales["motivo"].astype(str).str.strip().str.lower()
        penales["total"] = penales["propios"] + penales["rival"]

        situaciones_clave = ["scrum","line","ruck","juego","salida","salida 22"]
        penales_resumen = penales[penales["situacion"].isin(situaciones_clave)]
        resumen = penales_resumen.groupby("situacion")[["propios","rival"]].sum().reset_index()

        fig1 = px.bar(resumen, x="situacion", y=["propios","rival"], barmode="group",
                      labels={"value":"Cantidad","variable":"Tipo"},
                      color_discrete_map={"propios": "#28A745", "rival": "#C0392B"},
                      title="Penales Propios y Rivales por Situación", height=500, text_auto=True)

        penales_ruck = penales[penales["situacion"] == "ruck"]
        resumen_ruck = penales_ruck.melt(id_vars="motivo", value_vars=["propios","rival"], var_name="lado", value_name="cantidad")
        fig2 = px.bar(resumen_ruck, y="motivo", x="cantidad", color="lado", orientation="h",
                      labels={"cantidad":"Cantidad","motivo":"Motivo","lado":"Tipo"},
                      title="Detalle de Penales en Ruck por Motivo",
                      color_discrete_map={"propios":"#28A745","rival":"#C0392B"}, text="cantidad")
        fig2.update_layout(height=600, margin=dict(l=10, r=10, t=60, b=30))

        penales_juego = penales[penales["situacion"] == "juego"]
        resumen_juego = penales_juego.melt(id_vars="motivo", value_vars=["propios","rival"], var_name="lado", value_name="cantidad")
        fig3 = px.bar(resumen_juego, y="motivo", x="cantidad", color="lado", orientation="h",
                      labels={"cantidad":"Cantidad","motivo":"Motivo","lado":"Tipo"},
                      title="Detalle de Penales en Juego por Motivo",
                      color_discrete_map={"propios":"#28A745","rival":"#C0392B"}, text="cantidad")
        fig3.update_layout(height=600, margin=dict(l=10, r=10, t=60, b=30))

        penales_scrum = penales[penales["situacion"] == "scrum"]
        resumen_scrum = penales_scrum.melt(id_vars="motivo", value_vars=["propios","rival"], var_name="lado", value_name="cantidad")
        fig4 = px.bar(resumen_scrum, y="motivo", x="cantidad", color="lado", orientation="h",
                      labels={"cantidad":"Cantidad","motivo":"Motivo","lado":"Tipo"},
                      title="Detalle de Penales en Scrum por Motivo",
                      color_discrete_map={"propios":"#28A745","rival":"#C0392B"}, text="cantidad")
        fig4.update_layout(height=600, margin=dict(l=10, r=10, t=60, b=30))

        if SHOW_SECCIONES and vista == "Penales":
            st.header("Estadísticas de Penales")
            st.plotly_chart(fig1, use_container_width=True)
            st.subheader("🔍 Detalle de Penales en Ruck (por motivo)"); st.plotly_chart(fig2, use_container_width=True)
            st.subheader("🔍 Detalle de Penales en Juego (por motivo)"); st.plotly_chart(fig3, use_container_width=True)
            st.subheader("🔍 Detalle de Penales en Scrum (por motivo)"); st.plotly_chart(fig4, use_container_width=True)

        # conclusión penales
        fila_tot = penales["situacion"].astype(str).str.lower().str.contains("penales totales", na=False)
        if fila_tot.any():
            total_pen_propios = int(penales.loc[fila_tot, "propios"].iloc[0])
        else:
            total_pen_propios = int(penales["propios"].fillna(0).sum())
        info_df = pd.read_excel(archivo_estadistica, sheet_name="Info")
        partidos_pen = int(info_df.loc[info_df["Variable"].astype(str).str.lower() == "cantidad_partidos", "Valor"].iloc[0])
        prom_pen = total_pen_propios / partidos_pen if partidos_pen else 0
        texto_conclusion_penales = (
            f"Cometimos un total de <b>{total_pen_propios}</b> penales en <b>{partidos_pen}</b> partidos "
            f"que da un promedio de <b>{prom_pen:.1f}</b> por partido."
        )
        if SHOW_SECCIONES and vista == "Penales":
            st.markdown(texto_conclusion_penales.replace("<b>","**").replace("</b>","**"))
    else:
        if SHOW_SECCIONES and vista == "Penales":
            st.warning("❗ Error: Faltan columnas esperadas en 'Penales'.")

    # Line
    line = pd.read_excel(archivo_estadistica, sheet_name="Line"); line.columns = line.columns.str.strip().str.lower()
    if {
        "lanzamientos propios","lanzamientos rival","lanzamientos propios ganados","lanzamientos rival ganados",
        "lanzamientos propios perdidos","lanzamientos rival perdidos","totales ganados","totales perdidos","total"
    }.issubset(set(line.columns)):
        row = line.iloc[0]
        overall_data = pd.DataFrame({"Resultado":["Ganados","Perdidos"], "Cantidad":[row["totales ganados"], row["totales perdidos"]]})
        fig_overall = px.pie(overall_data, names="Resultado", values="Cantidad", hole=0.6,
                             color_discrete_sequence=["#FF8D2E","#4A50FF"])
        fig_overall.update_traces(textinfo='percent+label+value'); fig_overall.update_layout(title=f"Line totales (Total {row['total']})")
        propios_data = pd.DataFrame({"Resultado":["Ganados","Perdidos"], "Cantidad":[row["lanzamientos propios ganados"], row["lanzamientos propios perdidos"]]})
        fig_propios = px.pie(propios_data, names="Resultado", values="Cantidad", hole=0.6,
                             color_discrete_sequence=["#4A50FF","#FF8D2E"])
        fig_propios.update_traces(textinfo='percent+label+value'); fig_propios.update_layout(title=f"Lanzamientos Propios (Total {row['lanzamientos propios']})")
        rival_data = pd.DataFrame({"Resultado":["Ganados","Perdidos"], "Cantidad":[row["lanzamientos rival ganados"], row["lanzamientos rival perdidos"]]})
        fig_rival = px.pie(rival_data, names="Resultado", values="Cantidad", hole=0.6,
                           color_discrete_sequence=["#4A50FF","#FF8D2E"])
        fig_rival.update_traces(textinfo='percent+label+value'); fig_rival.update_layout(title=f"Lanzamientos Rival (Total {row['lanzamientos rival']})")
        if SHOW_SECCIONES and vista == "Line":
            st.header("Estadísticas de Line")
            col1,col2,col3 = st.columns(3)
            with col1: st.plotly_chart(fig_overall, use_container_width=True)
            with col2: st.plotly_chart(fig_propios, use_container_width=True)
            with col3: st.plotly_chart(fig_rival, use_container_width=True)
    else:
        if SHOW_SECCIONES and vista == "Line":
            st.warning("❗ Error: Faltan columnas esperadas o el formato de la hoja 'Line' no es correcto.")

    # Scrum
    scrum = pd.read_excel(archivo_estadistica, sheet_name="Scrum"); scrum.columns = scrum.columns.str.strip().str.lower()
    if {
        "lanzamientos propios","lanzamientos rival","lanzamientos propios ganados","lanzamientos rival ganados",
        "lanzamientos propios perdidos","lanzamientos rival perdidos","totales ganados","totales perdidos","total"
    }.issubset(set(scrum.columns)):
        row = scrum.iloc[0]
        overall_data_scrum = pd.DataFrame({"Resultado":["Ganados","Perdidos"], "Cantidad":[row["totales ganados"], row["totales perdidos"]]})
        fig_overall_scrum = px.pie(overall_data_scrum, names="Resultado", values="Cantidad", hole=0.6,
                                   color_discrete_sequence=["#8E3AC7","#C7693A"])
        fig_overall_scrum.update_traces(textinfo='percent+label+value'); fig_overall_scrum.update_layout(title=f"Scrum totales (Total {row['total']})")
        propios_data_scrum = pd.DataFrame({"Resultado":["Ganados","Perdidos"], "Cantidad":[row["lanzamientos propios ganados"], row["lanzamientos propios perdidos"]]})
        fig_propios_scrum = px.pie(propios_data_scrum, names="Resultado", values="Cantidad", hole=0.6,
                                   color_discrete_sequence=["#8E3AC7","#C7693A"])
        fig_propios_scrum.update_traces(textinfo='percent+label+value'); fig_propios_scrum.update_layout(title=f"Lanzamientos Propios (Total {row['lanzamientos propios']})")
        rival_data_scrum = pd.DataFrame({"Resultado":["Ganados","Perdidos"], "Cantidad":[row["lanzamientos rival ganados"], row["lanzamientos rival perdidos"]]})
        fig_rival_scrum = px.pie(rival_data_scrum, names="Resultado", values="Cantidad", hole=0.6,
                                 color_discrete_sequence=["#8E3AC7","#C7693A"])
        fig_rival_scrum.update_traces(textinfo='percent+label+value'); fig_rival_scrum.update_layout(title=f"Lanzamientos Rival (Total {row['lanzamientos rival']})")
        if SHOW_SECCIONES and vista == "Scrum":
            st.header("Estadísticas de Scrum")
            col1,col2,col3 = st.columns(3)
            with col1: st.plotly_chart(fig_overall_scrum, use_container_width=True)
            with col2: st.plotly_chart(fig_propios_scrum, use_container_width=True)
            with col3: st.plotly_chart(fig_rival_scrum, use_container_width=True)
    else:
        if SHOW_SECCIONES and vista == "Scrum":
            st.warning("❗ Error: Faltan columnas esperadas o el formato de la hoja 'Scrum' no es correcto.")

    # Salidas
    salidas = pd.read_excel(archivo_estadistica, sheet_name="Salidas"); salidas.columns = salidas.columns.str.strip().str.lower()
    if {
        "salidas propias","salidas rival","salidas propias ganadas","salidas rival ganadas","salidas propias perdidas",
        "salidas rival perdidas","salidas total ganadas","salidas total perdidas","salidas total"
    }.issubset(salidas.columns):
        row = salidas.iloc[0]
        data_total_salidas = pd.DataFrame({"Resultado":["Ganadas","Perdidas"],"Cantidad":[row["salidas total ganadas"], row["salidas total perdidas"]]})
        fig_salidas_total = px.pie(data_total_salidas, names="Resultado", values="Cantidad", hole=0.6,
                                   color_discrete_sequence=["#7CDED3","#218378"])
        fig_salidas_total.update_traces(textinfo='percent+label+value'); fig_salidas_total.update_layout(title=f"Salidas Totales (Total {row['salidas total']})")
        data_propias = pd.DataFrame({"Resultado":["Ganadas","Perdidas"],"Cantidad":[row["salidas propias ganadas"], row["salidas propias perdidas"]]})
        fig_salidas_propias = px.pie(data_propias, names="Resultado", values="Cantidad", hole=0.6,
                                     color_discrete_sequence=["#7CDED3","#218378"])
        fig_salidas_propias.update_traces(textinfo='percent+label+value'); fig_salidas_propias.update_layout(title=f"Salidas Propias (Total {row['salidas propias']})")
        data_rival = pd.DataFrame({"Resultado":["Ganadas","Perdidas"],"Cantidad":[row["salidas rival ganadas"], row["salidas rival perdidas"]]})
        fig_salidas_rival = px.pie(data_rival, names="Resultado", values="Cantidad", hole=0.6,
                                   color_discrete_sequence=["#7CDED3","#218378"])
        fig_salidas_rival.update_traces(textinfo='percent+label+value'); fig_salidas_rival.update_layout(title=f"Salidas Rival (Total {row['salidas rival']})")
        if SHOW_SECCIONES and vista == "Salidas":
            st.header("Estadísticas de Salidas")
            col1,col2,col3 = st.columns(3)
            with col1: st.plotly_chart(fig_salidas_total, use_container_width=True)
            with col2: st.plotly_chart(fig_salidas_propias, use_container_width=True)
            with col3: st.plotly_chart(fig_salidas_rival, use_container_width=True)
    else:
        if SHOW_SECCIONES and vista == "Salidas":
            st.warning("❗ Error: Faltan columnas esperadas o el formato de la hoja 'Salidas' no es correcto.")

    # Salidas de 22
    salidas_22 = pd.read_excel(archivo_estadistica, sheet_name="Salidas de 22"); salidas_22.columns = salidas_22.columns.str.strip().str.lower()
    if {
        "salidas 22 propias","salidas 22 rival","salidas 22 propias ganadas","salidas 22 rival ganadas",
        "salidas 22 propias perdidas","salidas 22 rival perdidas","salidas 22 total ganadas","salidas 22 total perdidas","salidas 22 total"
    }.issubset(salidas_22.columns):
        row = salidas_22.iloc[0]
        data_total_22 = pd.DataFrame({"Resultado":["Ganadas","Perdidas"],"Cantidad":[row["salidas 22 total ganadas"], row["salidas 22 total perdidas"]]})
        fig_total_22 = px.pie(data_total_22, names="Resultado", values="Cantidad", hole=0.6,
                              color_discrete_sequence=["#7DBADE","#215F83"])
        fig_total_22.update_traces(textinfo='percent+label+value'); fig_total_22.update_layout(title=f"Salidas de 22 Totales (Total {row['salidas 22 total']})")
        data_propias_22 = pd.DataFrame({"Resultado":["Ganadas","Perdidas"],"Cantidad":[row["salidas 22 propias ganadas"], row["salidas 22 propias perdidas"]]})
        fig_propias_22 = px.pie(data_propias_22, names="Resultado", values="Cantidad", hole=0.6,
                                color_discrete_sequence=["#7DBADE","#215F83"])
        fig_propias_22.update_traces(textinfo='percent+label+value'); fig_propias_22.update_layout(title=f"Salidas de 22 Propias (Total {row['salidas 22 propias']})")
        data_rival_22 = pd.DataFrame({"Resultado":["Ganadas","Perdidas"],"Cantidad":[row["salidas 22 rival ganadas"], row["salidas 22 rival perdidas"]]})
        fig_rival_22 = px.pie(data_rival_22, names="Resultado", values="Cantidad", hole=0.6,
                              color_discrete_sequence=["#7DBADE","#215F83"])
        fig_rival_22.update_traces(textinfo='percent+label+value'); fig_rival_22.update_layout(title=f"Salidas de 22 Rival (Total {row['salidas 22 rival']})")
        if SHOW_SECCIONES and vista == "Salidas 22":
            st.header("Estadísticas de Salidas de 22")
            col1,col2,col3 = st.columns(3)
            with col1: st.plotly_chart(fig_total_22, use_container_width=True)
            with col2: st.plotly_chart(fig_propias_22, use_container_width=True)
            with col3: st.plotly_chart(fig_rival_22, use_container_width=True)
    else:
        if SHOW_SECCIONES and vista == "Salidas 22":
            st.warning("❗ Error: Faltan columnas esperadas o el formato de la hoja 'Salidas 22' no es correcto.")

    # Efectividad en 22 rival
    efectividad = pd.read_excel(archivo_estadistica, sheet_name="Efectividad 22")
    efectividad.columns = efectividad.columns.str.strip().str.lower()
    efectividad["partido"] = range(1, len(efectividad) + 1)
    efectividad["etiqueta"] = efectividad["partido"].astype(str) + " - " + efectividad["rival"]
    fila_total = efectividad[efectividad["rival"].str.lower() == "total"]
    efectividad_sin_total = efectividad[efectividad["rival"].str.lower() != "total"]
    fig_eff = px.line(
        efectividad_sin_total, x="rival", y=["concretadas","chances"], markers=True,
        labels={"value":"Cantidad","variable":"Tipo de Acción","rival":"Rival"},
        title="Acciones Concretadas vs Chances en 22 Rival",
        color_discrete_map={"concretadas":"#F4B400","chances":"#DB4437"}
    )
    fig_eff.update_layout(height=500, yaxis=dict(title="Cantidad"), xaxis=dict(title="Rival"),
                          legend_title="Tipo", margin=dict(l=40, r=40, t=60, b=40))
    if SHOW_SECCIONES and vista == "Efectividad 22":
        st.header("📈 Efectividad en 22 Rival - TRL B"); st.plotly_chart(fig_eff, use_container_width=True)
        if not fila_total.empty:
            total_chances = int(fila_total["chances"].values[0])
            total_concretadas = int(fila_total["concretadas"].values[0])
            total_porcentaje = int(fila_total["%pp"].values[0])
            st.markdown(f"**Conclusión:** {total_chances} chances, {total_concretadas} concretadas → **{total_porcentaje}%**.")

    # Puntos (KPIs con 3 gráficos)
    puntos_df = pd.read_excel(archivo_estadistica, sheet_name="Puntos"); puntos_df.columns = puntos_df.columns.str.strip().str.lower()
    rowp = puntos_df.iloc[0]
    pf = int(rowp["puntos_favor"]); pc = int(rowp["puntos_contra"]); total = pf + pc
    share_favor = (pf/total*100) if total else 0
    partidos = int(rowp["partidos"])
    xp_favor = rowp["puntos_favor"]/partidos; xp_contra = rowp["puntos_contra"]/partidos
    dif = pf - pc

    bar_100 = pd.DataFrame({"Tipo":["Puntos"], "A favor":[pf], "En contra":[pc]})
    fig_bar = px.bar(bar_100.melt(id_vars="Tipo", var_name="Lado", value_name="Puntos"),
                     x="Tipo", y="Puntos", color="Lado",
                     color_discrete_map={"A favor":"#2E86DE","En contra":"#EB4D8A"},
                     text="Puntos")
    fig_bar.update_layout(title=f"Total de puntos – {share_favor:.0f}% a favor",
                          barmode="relative", height=240 if modo_celular else 300,
                          yaxis=dict(range=[0,total]), margin=dict(l=40, r=40, t=60, b=20))

    def puntos_componentes(prefix):
        tries = int(rowp[f"tries_{prefix}"]); conv_m = int(rowp[f"conv_{prefix}_m"]); pen_m = int(rowp[f"pen_{prefix}_m"])
        drops = int(rowp.get(f"drops_{prefix}",0))
        return {"Tries (x5)":tries*5, "Conversiones (x2)":conv_m*2, "Penales (x3)":pen_m*3, "Drops (x3)":drops*3}

    df_comp_f = pd.DataFrame({"Componente": list(puntos_componentes("favor").keys()),
                              "Puntos": list(puntos_componentes("favor").values())})
    df_comp_c = pd.DataFrame({"Componente": list(puntos_componentes("contra").keys()),
                              "Puntos": list(puntos_componentes("contra").values())})
    fig_f = px.pie(df_comp_f, names="Componente", values="Puntos", hole=0.5, title="Composición de puntos A FAVOR")
    fig_c = px.pie(df_comp_c, names="Componente", values="Puntos", hole=0.5, title="Composición de puntos EN CONTRA")
    fig_f.update_traces(textinfo="percent+label+value"); fig_c.update_traces(textinfo="percent+label+value")
    fig_f.update_layout(height=260 if modo_celular else 320, margin=dict(l=20,r=20,t=60,b=20))
    fig_c.update_layout(height=260 if modo_celular else 320, margin=dict(l=20,r=20,t=60,b=20))

    conv_f = (rowp["conv_favor_m"]/rowp["conv_favor_t"]*100) if rowp["conv_favor_t"] else 0
    conv_c = (rowp["conv_contra_m"]/rowp["conv_contra_t"]*100) if rowp["conv_contra_t"] else 0
    pen_f  = (rowp["pen_favor_m"]/rowp["pen_favor_t"]*100) if rowp["pen_favor_t"] else 0
    pen_c  = (rowp["pen_contra_m"]/rowp["pen_contra_t"]*100) if rowp["pen_contra_t"] else 0
    acc_df = pd.DataFrame({"Métrica":["Conversiones","Penales"], "A favor":[round(conv_f,1), round(pen_f,1)], "En contra":[round(conv_c,1), round(pen_c,1)]})
    labels = {
        ("Conversiones","A favor"):f"{int(rowp['conv_favor_m'])}/{int(rowp['conv_favor_t'])}",
        ("Conversiones","En contra"):f"{int(rowp['conv_contra_m'])}/{int(rowp['conv_contra_t'])}",
        ("Penales","A favor"):f"{int(rowp['pen_favor_m'])}/{int(rowp['pen_favor_t'])}",
        ("Penales","En contra"):f"{int(rowp['pen_contra_m'])}/{int(rowp['pen_contra_t'])}",
    }
    acc_long = acc_df.melt(id_vars="Métrica", var_name="Lado %", value_name="Precisión (%)"); acc_long["Lado"] = acc_long["Lado %"].str.replace(" %","",regex=False)
    acc_long["label"] = acc_long.apply(lambda r: labels[(r["Métrica"], r["Lado"])], axis=1)
    fig_acc = px.bar(acc_long, x="Métrica", y="Precisión (%)", color="Lado", barmode="group",
                     color_discrete_map={"A favor":"#2E86DE","En contra":"#EB4D8A"}, text="label",
                     title="Precisión: Conversiones y Penales")
    fig_acc.update_traces(textposition="outside", texttemplate="%{text} (%{y:.1f}%)", cliponaxis=False)
    fig_acc.update_layout(height=260 if modo_celular else 320, yaxis=dict(title="Precisión (%)", range=[0,100]),
                          margin=dict(l=40, r=40, t=60, b=20))

    if SHOW_SECCIONES and vista == "Puntos":
        st.header("Puntos")
        c1,c2,c3 = st.columns([1,1,1])
        with c1: st.metric("Puntos a favor", pf)
        with c2: st.metric("Puntos en contra", pc)
        with c3: st.metric("Diferencia", dif)
        st.plotly_chart(fig_bar, use_container_width=True)
        col1,col2 = st.columns(2)
        with col1: st.plotly_chart(fig_f, use_container_width=True)
        with col2: st.plotly_chart(fig_c, use_container_width=True)
        st.plotly_chart(fig_acc, use_container_width=True)
        st.markdown(f"**Conclusión:** Total de puntos **{total}** → **{pf}** a favor (≈ **{share_favor:.0f}%**). "
                    f"Promedios por partido: **{xp_favor:.1f}** vs **{xp_contra:.1f}**. "
                    f"Precisión: conversiones **{conv_f:.1f}%** vs **{conv_c:.1f}%**; penales **{pen_f:.1f}%** vs **{pen_c:.1f}%**.")

    # PDF
    figs = {
        "puntos_bar": fig_bar, "puntos_comp_f": fig_f, "puntos_comp_c": fig_c, "puntos_acc": fig_acc,
        "pen_situaciones": fig1, "pen_ruck": fig2, "pen_juego": fig3, "pen_scrum": fig4,
        "line_total": 'fig_overall' in locals() and fig_overall or None,
        "line_prop":  'fig_propios' in locals() and fig_propios or None,
        "line_rival": 'fig_rival' in locals() and fig_rival or None,
        "scrum_total": 'fig_overall_scrum' in locals() and fig_overall_scrum or None,
        "scrum_prop":  'fig_propios_scrum' in locals() and fig_propios_scrum or None,
        "scrum_rival": 'fig_rival_scrum' in locals() and fig_rival_scrum or None,
        "salidas_total": 'fig_salidas_total' in locals() and fig_salidas_total or None,
        "salidas_prop":  'fig_salidas_propias' in locals() and fig_salidas_propias or None,
        "salidas_rival": 'fig_salidas_rival' in locals() and fig_salidas_rival or None,
        "salidas22_total": 'fig_total_22' in locals() and fig_total_22 or None,
        "salidas22_prop":  'fig_propias_22' in locals() and fig_propias_22 or None,
        "salidas22_rival": 'fig_rival_22' in locals() and fig_rival_22 or None,
        "efectividad22": fig_eff,
        "tackles_total": 'fig_total' in locals() and fig_total or None,
    }
    kpis = dict(pf=pf, pc=pc, dif=dif, partidos=partidos, xp_favor=xp_favor, xp_contra=xp_contra)

    # Vista de tablero compacta
    if vista == "Tablero":
        # Modo compacto fuerza alturas bajas y menos márgenes
        tablero_compacto = True  # dejalo fijo o hacé un toggle si querés
        h_small = 230 if modo_celular else 260

        # 1) KPIs en una sola fila
        c1, c2, c3, c4 = grid(4)
        with c1: kpi_card("Puntos a favor", pf)
        with c2: kpi_card("Puntos en contra", pc)
        with c3: kpi_card("Diferencia", dif)
        with c4: kpi_card("XP por partido", f"{xp_favor:.1f} vs {xp_contra:.1f}")

        st.markdown("")  # respirito

        # 2) Fila superior (3 tarjetas): Total de puntos, Composición (switch), Precisión
        c1, c2, c3 = grid(3)
        with c1:
            card("Total de puntos", lambda: (
                fig_bar.update_layout(height=h_small, margin=dict(l=20, r=20, t=40, b=10)),
                st.plotly_chart(fig_bar, use_container_width=True, config={"displayModeBar": False})
                ))
        with c2:
            switch_card("Composición de puntos",
                        {"A favor": fig_f, "En contra": fig_c},
                        default_key="A favor", height=h_small)
        with c3:
            card("Precisión (Conv/Pen)", lambda: (
                fig_acc.update_layout(height=h_small, margin=dict(l=20, r=20, t=40, b=10)),
                st.plotly_chart(fig_acc, use_container_width=True, config={"displayModeBar": False})
                ))

        # 3) Fila media (3 tarjetas): Line, Scrum, Efectividad 22
        c1, c2, c3 = grid(3)
        with c1:
            switch_card("Line",
                        {
                            "Totales": 'fig_overall' in locals() and fig_overall or None,
                            "Propios": 'fig_propios' in locals() and fig_propios or None,
                            "Rival":   'fig_rival' in locals() and fig_rival or None,
                            },
                        default_key="Totales", height=h_small)
        with c2:
            switch_card("Scrum",
                        {
                            "Totales": 'fig_overall_scrum' in locals() and fig_overall_scrum or None,
                            "Propios": 'fig_propios_scrum' in locals() and fig_propios_scrum or None,
                            "Rival":   'fig_rival_scrum' in locals() and fig_rival_scrum or None,
                            },
                        default_key="Totales", height=h_small) 
        with c3:
            card("Efectividad en 22", lambda: (
                fig_eff.update_layout(height=h_small, margin=dict(l=20, r=20, t=40, b=10)),
                st.plotly_chart(fig_eff, use_container_width=True, config={"displayModeBar": False})
                ))

        # 4) Fila inferior (3 tarjetas): Salidas, Salidas 22, Tackles Totales
        c1, c2, c3 = grid(3)
        with c1:
            switch_card("Salidas",
                        {
                            "Totales": 'fig_salidas_total' in locals() and fig_salidas_total or None,
                            "Propias": 'fig_salidas_propias' in locals() and fig_salidas_propias or None,
                            "Rival":   'fig_salidas_rival' in locals() and fig_salidas_rival or None,
                            },
                        default_key="Totales", height=h_small)
        with c2:
            switch_card("Salidas de 22",
                        {
                            "Totales": 'fig_total_22' in locals() and fig_total_22 or None,
                            "Propias": 'fig_propias_22' in locals() and fig_propias_22 or None,
                            "Rival":   'fig_rival_22' in locals() and fig_rival_22 or None,
                            },
                        default_key="Totales", height=h_small)
        with c3:
            if 'fig_total' in locals() and fig_total is not None:
                N = 18
                top = df_sumado.head(N)
                df_mini = top.melt(id_vars=["nombre del jugador"], value_vars=["tackles","errados"],
                           var_name="resultado", value_name="cantidad")
                fig_tackles_compacto = px.bar(
                    df_mini, y="nombre del jugador", x="cantidad", color="resultado", orientation="h",
                    color_discrete_map={"tackles":"#253094","errados":"#8F1B30"},
                    title=f"Tackles totales (Top {N})",
                )
                fig_tackles_compacto.update_layout(
                    height=h_small, margin=dict(l=20, r=20, t=40, b=10),
                    barmode="stack", xaxis=dict(tick0=0, dtick=5)
                )
                card("Tackles totales por jugador", lambda: st.plotly_chart(fig_tackles_compacto, use_container_width=True, config={"displayModeBar": False}))
            else:
                st.info("Tackles totales no disponibles todavía.")

                
    # Vista "Informe PDF" (se genera solo cuando el usuario lo pide)
    if vista == "Informe PDF":
        st.header("📄 Generar Informe PDF")
        generar = st.button("⚙️ Generar informe ahora")
        if generar:
            pdf_buffer = generar_informe_pdf(
                titulo="Informe Anual – Universitario 2025",
                kpis=kpis,
                tabla_puntos=[
                    ["Item","A favor","En contra"],
                    ["Tries", int(rowp.get("tries_favor", 0)), int(rowp.get("tries_contra", 0))],
                    ["Conversiones",
                         f"{int(rowp.get('conv_favor_m', 0))}/{int(rowp.get('conv_favor_t', 0))}",
                         f"{int(rowp.get('conv_contra_m', 0))}/{int(rowp.get('conv_contra_t', 0))}"],
                    ["Penales",
                         f"{int(rowp.get('pen_favor_m', 0))}/{int(rowp.get('pen_favor_t', 0))}",
                         f"{int(rowp.get('pen_contra_m', 0))}/{int(rowp.get('pen_contra_t', 0))}"],
                    ["Drops", int(rowp.get("drops_favor", 0)), int(rowp.get("drops_contra", 0))],
                    ["Puntos", pf, pc],
               ],
                figs=figs,
                tackles_tabla=tabla_tackles if 'tabla_tackles' in locals() else None,
                conclusion_22=(
                    None if 'fila_total' not in locals() or fila_total.empty else
                    f" Conclusión: Hubo un total de {int(fila_total['chances'].values[0])} chances y se concretaron "
                    f"{int(fila_total['concretadas'].values[0])}, dando una efectividad del "
                    f"{int(fila_total['%pp'].values[0])}% en zona de 22 rival."
                ),
                conclusion_penales=texto_conclusion_penales if 'texto_conclusion_penales' in locals() else None,
            )
            
            st.download_button(
                "📥 Descargar Informe PDF",
                data=pdf_buffer.getvalue(),
                file_name="Informe_Universitario_2025.pdf",
                mime="application/pdf",
            )
        else:
            st.info("Presioná **Generar informe ahora** para construir el PDF.")

except Exception as e:
    st.error(f"⚠️ Error al procesar los datos: {e}")