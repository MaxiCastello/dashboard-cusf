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

st.set_page_config(page_title="Dashboard de Universitario", layout="wide")
st.title("📊 Dashboard Temporada 2025")
modo_celular = st.toggle("📱 Activar modo celular", help="Mejora la visualización de los gráficos para celular.")

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

def normalizar_texto(s):
    if pd.isna(s):
        return ""
    s = str(s).strip().lower()
    s = " ".join(s.split()) 
    s = "".join(c for c in unicodedata.normalize("NFD", s) if unicodedata.category(c) != "Mn")
    return s.title()

#Convierte un fig de Plotly a Image para reportlab sin archivos temporales.
def fig_to_img(fig, w=900, h=520, scale=2, width_pt=180):
    fig.update_layout(paper_bgcolor="white", plot_bgcolor="white", template="plotly_white")
    img_bytes = pio.to_image(fig, format="png", width=w, height=h, scale=scale, engine="kaleido")
    buf = io.BytesIO(img_bytes)
    return Image(buf, width=width_pt, height=width_pt * (h / w))

# Sirve para descargar PDF
def generar_informe_pdf(
    titulo="Informe Club Universitario – TRL B - 2025",
    kpis=None,                   
    tabla_puntos=None,          
    figs=None,
    tackles_tabla=None,
    conclusion_22=None,
    conclusion_penales=None,                   
):
    
    if kpis is None: kpis = {}
    if figs is None: figs = {}

    buf_pdf = io.BytesIO()
    doc = SimpleDocTemplate(buf_pdf, pagesize=A4, leftMargin=28, rightMargin=28, topMargin=28, bottomMargin=28)
    S = getSampleStyleSheet()
    H1 = ParagraphStyle("H1", parent=S["Heading1"], spaceAfter=8)
    H2 = ParagraphStyle("H2", parent=S["Heading2"], spaceBefore=8, spaceAfter=6)
    P  = ParagraphStyle("P",  parent=S["BodyText"], leading=14)
    
    W_FULL  = 530   # imagen a todo el ancho del área de texto
    W_HALF  = 265   # para dos graficos por fila
    W_THIRD = 200   # para tres graficos por fila

    # helper para reducir margen superior y tamaño de título de cada fig
    def _for_pdf(fig, title_size=12, top=36):
        fig.update_layout(
            margin=dict(l=10, r=10, t=top, b=10),
            title=dict(font=dict(size=title_size))
        )   
        return fig

    story = []

    # Título
    story.append(Paragraph(titulo, H1))
    story.append(Spacer(1, 6))

    # KPIs de puntos
    if kpis:
        kpi_txt = (
            f"<b>Puntos:</b> {kpis.get('pf',0)} a favor · {kpis.get('pc',0)} en contra · "
            f"dif: {kpis.get('dif',0)} · XP: {kpis.get('xp_favor',0):.1f} vs {kpis.get('xp_contra',0):.1f} "
            f"({kpis.get('partidos',0)} PJ)"
        )
        story.append(Paragraph(kpi_txt, P))
        story.append(Spacer(1, 8))

    # Puntos – gráfico barra + composicion + precision
    row_imgs = []
    if figs.get("puntos_bar"):    row_imgs.append(fig_to_img(_for_pdf(figs["puntos_bar"]),    width_pt=W_THIRD))
    if figs.get("puntos_comp_f"): row_imgs.append(fig_to_img(_for_pdf(figs["puntos_comp_f"]), width_pt=W_THIRD))
    if figs.get("puntos_comp_c"): row_imgs.append(fig_to_img(_for_pdf(figs["puntos_comp_c"]), width_pt=W_THIRD))
    if row_imgs:
        story.append(Paragraph("Puntos", H2))
        # poner hasta 3 gráficos en una fila
        story.append(Table([row_imgs], colWidths=[W_THIRD]*len(row_imgs), hAlign="CENTER"))
        story.append(Spacer(1, 6))
    if figs.get("puntos_acc"):
        story.append(fig_to_img(figs["puntos_acc"], width_pt=520))
        story.append(Spacer(1, 8))

    # Tabla compacta de puntos (tries/conv/pen/drops)
    if tabla_puntos:
        t = Table(tabla_puntos, hAlign="CENTER")
        t.setStyle(TableStyle([
            ("BACKGROUND", (0,0), (-1,0), colors.HexColor("#222")),
            ("TEXTCOLOR", (0,0), (-1,0), colors.whitesmoke),
            ("GRID", (0,0), (-1,-1), 0.4, colors.grey),
            ("ALIGN", (0,0), (-1,-1), "CENTER"),
            ("VALIGN", (0,0), (-1,-1), "MIDDLE"),
        ]))
        story.append(t)
        story.append(Spacer(1, 8))

    # Penales (4 graficos)
    pen_list = [f for f in [figs.get("pen_situaciones"), figs.get("pen_ruck"),
                        figs.get("pen_juego"), figs.get("pen_scrum")] if f]
    pen_imgs = [fig_to_img(_for_pdf(f), width_pt=W_HALF) for f in pen_list]
    if pen_imgs:
        story.append(Paragraph("Penales", H2))
        rows = [pen_imgs[i:i+2] for i in range(0, len(pen_imgs), 2)]
        for r in rows:
            story.append(Table([r], colWidths=[W_HALF]*len(r), hAlign="CENTER"))
            story.append(Spacer(1, 6))
    if conclusion_penales:
        story.append(Spacer(1, 4))
        story.append(Paragraph(conclusion_penales, P))
        story.append(Spacer(1, 8))

    # Line y Scrum (de a 3)
    for titulo_secc, trio in [
        ("Line",  [figs.get("line_total"),  figs.get("line_prop"),  figs.get("line_rival")]),
        ("Scrum", [figs.get("scrum_total"), figs.get("scrum_prop"), figs.get("scrum_rival")]),
    ]:
        trio = [fig_to_img(_for_pdf(f), width_pt=W_THIRD) for f in trio if f]
        if trio:
            story.append(Paragraph(titulo_secc, H2))
            story.append(Table([trio], colWidths=[W_THIRD]*len(trio), hAlign="CENTER"))
            story.append(Spacer(1, 6))

    # Salidas y Salidas 22
    for titulo_secc, trio in [
        ("Salidas",       [figs.get("salidas_total"),  figs.get("salidas_prop"),  figs.get("salidas_rival")]),
        ("Salidas de 22", [figs.get("salidas22_total"), figs.get("salidas22_prop"), figs.get("salidas22_rival")]),
    ]:
        trio = [fig_to_img(_for_pdf(f), width_pt=W_THIRD) for f in trio if f]
        if trio:
            story.append(Paragraph(titulo_secc, H2))
            story.append(Table([trio], colWidths=[W_THIRD]*len(trio), hAlign="CENTER"))
            story.append(Spacer(1, 6))

    # Efectividad en 22 Rival (linea)
    if figs.get("efectividad22"):
        story.append(Paragraph("Efectividad en 22 Rival", H2))
        story.append(fig_to_img(_for_pdf(figs["efectividad22"]), width_pt=W_FULL))
        story.append(Spacer(1, 6))
        if conclusion_22:
            story.append(Paragraph(conclusion_22, P))
            story.append(Spacer(1, 8))

    # Tackles Totales
    if tackles_tabla is not None:
        story.append(Paragraph("Tackles Totales por jugador", H2))
        story.append(tackles_tabla)
        story.append(Spacer(1, 12))
    elif figs.get("tackles_total"):
        story.append(Paragraph("Tackles Totales por jugador", H2))
        story.append(fig_to_img(_for_pdf(figs["tackles_total"]), width_pt=W_FULL))
        story.append(Spacer(1, 8))
        
    # Final
    story.append(PageBreak())
    story.append(Paragraph("Generado automáticamente desde el dashboard de Universitario.", P))

    doc.build(story)
    buf_pdf.seek(0)
    return buf_pdf

# Arranca el codigo para streamlit cloud.
# Carga de archivos en repositorio Github @MaxiCastello dashboard-cusf
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
                st.warning(f"⚠️ El archivo '{archivo.name}' no contiene una hoja llamada 'Resumen'.")
                continue

            resumen = hojas['Resumen']
            # Normalizamos los nombres de las columnas
            resumen.columns = resumen.columns.str.strip().str.lower()

            # Renombramos variaciones de "nombre del jugador" a una sola forma
            for col in resumen.columns:
                if "nombre" in col and "jugador" in col:
                    resumen.rename(columns={col: "nombre del jugador"}, inplace=True)

            resumen["archivo"] = os.path.basename(archivo)
            resumen_total = pd.concat([resumen_total, resumen], ignore_index=True)

        except Exception as e:
            st.error(f"❌ Error al procesar el archivo {os.path.basename(archivo)}: {e}")

    if not resumen_total.empty:
        st.success("✅ Todos los archivos cargados correctamente.")

        # Checkbox global para expandir o colapsar todos los bloques de archivos
        expandir_todo = st.checkbox("🔽 Mostrar todos los gráficos desplegados", value=False)    
        
    # Gráficos por archivo individual
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

            # Aseguramos que "nombre del jugador" exista aunque esté vacío
            resumen["nombre del jugador"] = resumen["nombre del jugador"].fillna("")

            # columna combinada: nombre completo con número de camiseta
            resumen["nombre completo"] = resumen["nombre del jugador"] + " (" + resumen["jugador"] + ")"

            # Filtramos solo filas con nombre asignado
            resumen = resumen[resumen["nombre del jugador"] != ""]

            # Rellenamos columnas numéricas y las forzamos a enteros
            columnas_numericas = ["tackles", "errados", "positivos", "neutrales", "negativos"]
            for col in columnas_numericas:
                resumen[col] = resumen[col].fillna(0).astype(int)

            resumen["total"] = resumen["tackles"] + resumen["errados"]

            resumen["porcentaje"] = resumen.apply(
                lambda row: (row["tackles"] / row["total"] * 100) if row["total"] > 0 else 0,
                axis=1
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
                df_plot,
                y="nombre completo",
                x="cantidad",
                color="resultado",
                orientation="h",
                color_discrete_map={"tackles": "#253094", "errados": "#8F1B30"},
                title="Tackles Exitosos y Errados por Jugador",
                category_orders={"jugador": list(map(str, range(1, 26)))},
                text="texto"
                )

            fig.update_traces(textposition="outside")

            fig.update_layout(
                yaxis=dict(title="Jugador",categoryorder="total descending"),
                xaxis=dict(title="Cantidad de Tackles", range=[0, 16], tick0=0, dtick=1),
                barmode="stack",
                height=altura
                )

            st.plotly_chart(fig, use_container_width=True)

            # Gráfico de Torta
            st.subheader("Distribución de Tipos de Tackles")
            total_tipos = {
                "Positivos": resumen["positivos"].sum(),
                "Neutrales": resumen["neutrales"].sum(),
                "Negativos": resumen["negativos"].sum(),
                "Errados": resumen["errados"].sum()
                }

            df_torta = pd.DataFrame({
                "tipo": list(total_tipos.keys()),
                "cantidad": list(total_tipos.values())
                })

            fig_torta = px.pie(
                df_torta,
                names="tipo",
                values="cantidad",
                color="tipo",
                title="Gráfico de Tipos de Tackles",
                color_discrete_map={
                    "Positivos": "#28A745",
                    "Neutrales": "#95A5A6",
                    "Negativos": "#253094",
                    "Errados": "#8F1B30"
                    },
                hole=0.3
                )

            fig_torta.update_traces(textinfo="label+percent")
            fig_torta.update_layout(    
                height=altura_donut,
                margin=margen_titulo,
                uniformtext_minsize=texto_tamanio,
                )
            st.plotly_chart(fig_torta, use_container_width=True)

        
    # Gráfico Global por Nombre de Jugador
    if "nombre del jugador" in resumen_total.columns:
        resumen_total["nombre del jugador"] = resumen_total["nombre del jugador"].apply(normalizar_texto)
        resumen_total = resumen_total[resumen_total["nombre del jugador"] != ""]  # borra filas sin nombre
        
        st.subheader("📶 Gráfico de Tackles Totales por Nombre de Jugador")

        df_nombre = resumen_total.copy()
        df_nombre["tackles"] = df_nombre["tackles"].fillna(0).astype(int)
        df_nombre["errados"] = df_nombre["errados"].fillna(0).astype(int)
        conteo_partidos = resumen_total["nombre del jugador"].value_counts().reset_index()
        conteo_partidos.columns = ["nombre del jugador", "PJ"]  # Renombrar columnas
        
        df_sumado = df_nombre.groupby("nombre del jugador")[["tackles", "errados", "positivos", "neutrales", "negativos"]].sum().reset_index()
        df_sumado = df_sumado.merge(conteo_partidos, on="nombre del jugador", how="left")
        
        df_sumado["total"] = df_sumado["tackles"] + df_sumado["errados"]
        df_sumado["porcentaje"] = (df_sumado["tackles"] / df_sumado["total"] * 100).round(1)


        df_sumado["etiqueta"] = (
            df_sumado["tackles"].astype(str) + "/" +
            df_sumado["total"].astype(str) + " (" +
            df_sumado["porcentaje"].astype(str) + "%) – " +
            df_sumado["PJ"].astype(str) + " PJ"
            )
       
        df_sumado = df_sumado.sort_values("total", ascending=False)
        
        # Tabla de tackles (para el PDF)
        data_tabla = [["Jugador", "Tackles", "Errados", "Efectividad (%)", "PJ"]]
        for _, fila in df_sumado.iterrows():
            data_tabla.append([
                fila["nombre del jugador"],
                int(fila["tackles"]),
                int(fila["errados"]),
                f"{fila['porcentaje']}%",
                int(fila["PJ"])
        ])

        tabla_tackles = Table(data_tabla, repeatRows=1, hAlign="LEFT")
        tabla_tackles.setStyle(TableStyle([
            ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#253094")),
            ("TEXTCOLOR", (0, 0), (-1, 0), colors.whitesmoke),
            ("ALIGN", (0, 0), (-1, -1), "CENTER"),
            ("GRID", (0, 0), (-1, -1), 0.5, colors.black),
            ("FONTSIZE", (0, 0), (-1, -1), 8),
        ]))
                
        # Datos para gráfico apilado
        df_melted = df_sumado.melt(
            id_vars=["nombre del jugador", "etiqueta"],
            value_vars=["tackles", "errados"],
            var_name="resultado",
            value_name="cantidad"
        )

        df_melted["nombre del jugador"] = pd.Categorical(
            df_melted["nombre del jugador"],
            categories=df_sumado["nombre del jugador"],
            ordered=True
        )
        
        #  Etiqueta solo para los tackles
        df_melted["texto"] = df_melted.apply(lambda row: row["etiqueta"] if row["resultado"] == "tackles" else "", axis=1)

        fig_total = px.bar(
            df_melted,
            y="nombre del jugador",
            x="cantidad",
            color="resultado",
            orientation="h",
            color_discrete_map={"tackles": "#253094", "errados": "#8F1B30"},
            title="Tackles Totales por Nombre de Jugador",
        
        )

        fig_total.update_traces(text=None)
        
        altura_total = 900 if not modo_celular else 1500
        
        max_total = int(df_sumado["total"].max())
        padding = 10
        fig_total.update_layout(
            xaxis=dict(title="Cantidad de Tackles", range=[0, max_total + padding], tick0=0, dtick=5),
            barmode="stack",
            height=altura_grafico,
            margin=dict(l=180, r=120, t=60, b=80),
        )
        # Agrega anotación por jugador al final del total
        for _, r in df_sumado.iterrows():
            fig_total.add_annotation(
                x=float(r["total"]) + 0.5,                 
                y=r["nombre del jugador"],
                text=str(r["etiqueta"]),
                showarrow=False,
                xanchor="left",
                yanchor="middle",
           font=dict(size=10),
           align="left"
         )

        st.plotly_chart(fig_total, use_container_width=True)
        
        # Gráfico de precisión en formato anillo para un jugador
        st.subheader(("🎯 Porcentaje de tipos de tackles por jugador"))
        
        jugador_donut = st.selectbox("Seleccioná un jugador:", df_sumado["nombre del jugador"].unique())
        
        # Extraer la fila del jugador seleccionado
        fila_jugador = df_sumado[df_sumado["nombre del jugador"] == jugador_donut].iloc[0]

        # Extraer valores por tipo de tackle
        valores = [
            fila_jugador.get("positivos", 0),
            fila_jugador.get("neutrales", 0),
            fila_jugador.get("negativos", 0),
            fila_jugador.get("errados", 0)
            ]

        etiquetas = ["Positivos", "Neutrales", "Negativos", "Errados"]
        colores = ["#28A745", "#95A5A6", "#253094", "#8F1B30"]
        
        fig_donut = go.Figure(data=[go.Pie(
            labels=etiquetas,
            values=valores,
            hole=0.5,
            marker=dict(colors=colores),
            textinfo="label+value+percent",
            textposition='outside',
            hoverinfo="label+value+percent"
        )])
        
    
        tackles_reales = fila_jugador.get("positivos", 0) + fila_jugador.get("neutrales", 0) + fila_jugador.get("negativos", 0)
        errados = fila_jugador.get("errados", 0)
        pj = int(fila_jugador['PJ'])
        promedio = tackles_reales / pj if pj > 0 else 0

        fig_donut.update_layout(
            title=(
                f"{jugador_donut} – Distribución de {int(tackles_reales + errados)} intentos de tackle "
                f"({int(tackles_reales)} realizados, {int(errados)} errados) en {pj} partido{'s' if pj != 1 else ''} "
                f"(Promedio: {promedio:.1f} por partido)"
                ),
            height=altura_donut
            )
        if modo_celular:
            titulo_donut = f"{jugador_donut} – {int(tackles_reales + errados)} intentos de tackle en {pj} PJ"
        else:
            titulo_donut = (
        f"{jugador_donut} – Distribución de {int(tackles_reales + errados)} intentos de tackle "
        f"({int(tackles_reales)} realizados, {int(errados)} errados) en {pj} partido{'s' if pj != 1 else ''} "
        f"(Promedio: {promedio:.1f} por partido)"
        )

        fig_donut.update_layout(
        title=titulo_donut,
        height=altura_donut,
        margin=margen_donut,
        legend=dict(orientation="h", x=0.5, xanchor="center", y=-0.15, yanchor="top")
            )
    
        st.plotly_chart(fig_donut, use_container_width=True)

        
        # Gráfico Global de Tipos de Tackles Combinados
        st.subheader("🌐 Gráfico de efectividad TOTAL de tipos de tackles")
        
        # Normalizar nombres de columnas por si acaso
        resumen_total.columns = resumen_total.columns.str.strip().str.lower()

         # Validamos que existan las columnas necesarias
        tipos_requeridos = ["positivos", "neutrales", "negativos", "errados"]
        if all(col in resumen_total.columns for col in tipos_requeridos):
    

            resumen_limpio = resumen_total[
            ~resumen_total["jugador"].astype(str).str.lower().isin(
                ["positivos", "neutrales", "negativos", "errados"]
                )
            ]

        # Calcular totales solo de las filas válidas
        total_global = {
            "Positivos": resumen_limpio["positivos"].fillna(0).sum(),
            "Neutrales": resumen_limpio["neutrales"].fillna(0).sum(),
            "Negativos": resumen_limpio["negativos"].fillna(0).sum(),
            "Errados": resumen_limpio["errados"].fillna(0).sum()
            }

        total_cantidad = sum(total_global.values())
    
        df_global_tipos = pd.DataFrame({
            "Tipo de Tackle": list(total_global.keys()),
            "Cantidad": list(total_global.values())
            })

        df_global_tipos["Porcentaje"] = (df_global_tipos["Cantidad"] / total_cantidad * 100).round(1)
        df_global_tipos["Etiqueta"] = df_global_tipos.apply(
            lambda row: f"{row['Tipo de Tackle']} – Cantidad: {int(row['Cantidad'])} – {row['Porcentaje']}%", axis=1
            )

        fig_global = go.Figure(data=[go.Pie(
            labels=df_global_tipos["Tipo de Tackle"],
            values=df_global_tipos["Cantidad"],
            hole=0.4,
            marker=dict(colors=["#28A745", "#95A5A6", "#253094", "#8F1B30"]),
            textinfo="label+value+percent",
            textposition='outside',
            hoverinfo="label+value+percent"
            )])

        fig_global.update_layout(
            title="Efectividad Total de Tackles (Totales)",
            height=altura_donut,
            margin=margen_donut,
            legend=dict(orientation="h", x=0.5, xanchor="center", y=-0.15, yanchor="top"),
            uniformtext_minsize=texto_tamanio
            )

        st.plotly_chart(fig_global, use_container_width=True)
        
    else:
            st.warning("⚠️ No se pudo encontrar una columna estándar para 'Nombre del jugador'.")
else:
    st.info("📁 Por favor, cargá uno o más archivos.")

st.header(" Estadísticas de Penales")


try:
    archivo_estadistica = os.path.join(carpeta_data, "Estadistica.xlsx")
    penales = pd.read_excel(archivo_estadistica, sheet_name="Penales")
    penales.columns = penales.columns.str.strip().str.lower()

    # Verificacion de columnas necesarias
    if {"situacion", "propios", "rival", "motivo"}.issubset(set(penales.columns)):

        # Normaliza el texto
        penales["situacion"] = penales["situacion"].astype(str).str.strip().str.lower()
        penales["motivo"] = penales["motivo"].astype(str).str.strip().str.lower()

        # Calcula totales y porcentajes
        penales["total"] = penales["propios"] + penales["rival"]
        penales["% propios"] = (penales["propios"] / penales["total"] * 100).round(1)
        penales["% rival"] = (penales["rival"] / penales["total"] * 100).round(1)

        # Grafico 1 Penales por situacion especifica
        situaciones_clave = ["scrum", "line", "ruck", "juego", "salida", "salida 22"]
        penales_resumen = penales[penales["situacion"].isin(situaciones_clave)]
        resumen = penales_resumen.groupby("situacion")[["propios", "rival"]].sum().reset_index()

        st.subheader("📊 Penales por Situación")

        fig1 = px.bar(
            resumen,
            x="situacion",
            y=["propios", "rival"],
            barmode="group",
            labels={"value": "Cantidad", "variable": "Tipo"},
            color_discrete_map={"propios": "#28A745", "rival": "#C0392B"},
            title="Penales Propios y Rivales por Situación",
            height=500,
            text_auto=True
        )
        st.plotly_chart(fig1, use_container_width=True)
        
    fila_tot = penales["situacion"].astype(str).str.lower().str.contains("penales totales", na=False)
    if fila_tot.any():
        total_pen_propios = int(penales.loc[fila_tot, "propios"].iloc[0])
    else:
        total_pen_propios = int(penales["propios"].fillna(0).sum())

    # Cantidad de partidos en hoja info
    info_df = pd.read_excel(archivo_estadistica, sheet_name="Info")
    partidos_pen = int(
        info_df.loc[info_df["Variable"].astype(str).str.lower() == "cantidad_partidos", "Valor"].iloc[0]
    )

    prom_pen = total_pen_propios / partidos_pen if partidos_pen else 0
    texto_conclusion_penales = (
    f"Cometimos un total de <b>{total_pen_propios}</b> penales en "
    f"<b>{partidos_pen}</b> partidos que da un promedio de <b>{prom_pen:.1f}</b> por partido."
    )

        
    st.markdown(texto_conclusion_penales.replace("<b>", "**").replace("</b>", "**"))
    
    # Grafico 2 Detalle de penales en Ruck por motivo
    st.subheader("🔍 Detalle de Penales en Ruck (por motivo)")
    penales_ruck = penales[penales["situacion"] == "ruck"]
    resumen_ruck = penales_ruck.melt(id_vars="motivo", value_vars=["propios","rival"],
                              var_name="lado", value_name="cantidad")

    fig2 = px.bar(
        resumen_ruck, y="motivo", x="cantidad", color="lado", orientation="h",
        labels={"cantidad":"Cantidad","motivo":"Motivo","lado":"Tipo"},
        title="Detalle de Penales en Ruck por Motivo",
        color_discrete_map={"propios":"#28A745","rival":"#C0392B"},
        text="cantidad"
       )
        
    fig2.update_layout(height=600, margin=dict(l=10, r=10, t=60, b=30))
    st.plotly_chart(fig2, use_container_width=True)

    # Grafico 3 Detalle de penales en Juego por motivo
    st.subheader("🔍 Detalle de Penales en Juego (por motivo)")
    penales_juego = penales[penales["situacion"] == "juego"]
    resumen_juego = penales_juego.melt(id_vars="motivo", value_vars=["propios","rival"],
                                var_name="lado", value_name="cantidad")

    fig3 = px.bar(
        resumen_juego, y="motivo", x="cantidad", color="lado", orientation="h",
        labels={"cantidad":"Cantidad","motivo":"Motivo","lado":"Tipo"},
        title="Detalle de Penales en Juego por Motivo",
        color_discrete_map={"propios":"#28A745","rival":"#C0392B"},
        text="cantidad"
    )
        
    fig3.update_layout(height=600, margin=dict(l=10, r=10, t=60, b=30))
    st.plotly_chart(fig3, use_container_width=True)
        
     # Grafico 4 Detalle de penales en Scrum por motivo
    st.subheader("🔍 Detalle de Penales en Scrum (por motivo)")
    penales_scrum = penales[penales["situacion"] == "scrum"]
    resumen_scrum = penales_scrum.melt(id_vars="motivo", value_vars=["propios","rival"],
                                var_name="lado", value_name="cantidad")

    fig4 = px.bar(
        resumen_scrum, y="motivo", x="cantidad", color="lado", orientation="h",
        labels={"cantidad":"Cantidad","motivo":"Motivo","lado":"Tipo"},
        title="Detalle de Penales en Scrum por Motivo",
        color_discrete_map={"propios":"#28A745","rival":"#C0392B"},
        text="cantidad"
       )
        
    fig4.update_layout(height=600, margin=dict(l=10, r=10, t=60, b=30))
    st.plotly_chart(fig4, use_container_width=True)
        
        # Line
    st.subheader("Estadísticas de Line")
    line = pd.read_excel(archivo_estadistica, sheet_name="Line")
    line.columns = line.columns.str.strip().str.lower()

    if {
            "lanzamientos propios",
            "lanzamientos rival",
            "lanzamientos propios ganados",
            "lanzamientos rival ganados",
            "lanzamientos propios perdidos",
            "lanzamientos rival perdidos",
            "totales ganados",
            "totales perdidos",
            "total"
    }.issubset(set(line.columns)):

            # Extraer la primera fila con los valores
            row = line.iloc[0]

            total_propios = row["lanzamientos propios"]
            total_rival = row["lanzamientos rival"]
            propios_ganados = row["lanzamientos propios ganados"]
            propios_perdidos = row["lanzamientos propios perdidos"]
            rival_ganados = row["lanzamientos rival ganados"]
            rival_perdidos = row["lanzamientos rival perdidos"]

            st.write(f"**Total:** {row['total']} lanzamientos")

            # Grafico 1 line totales
            overall_data = pd.DataFrame({
                "Resultado": ["Ganados", "Perdidos"],
                "Cantidad": [row["totales ganados"], row["totales perdidos"]]
                })
            fig_overall = px.pie(
                overall_data, 
                names="Resultado", 
                values="Cantidad", 
                hole=0.6,
                color_discrete_sequence=["#FF8D2E", "#4A50FF"]
                )
            fig_overall.update_traces(textinfo='percent+label+value')
            fig_overall.update_layout(title=f"Line totales (Total {row['total']})")

            # Grafico 2 Lanzamientos propios 
            propios_data = pd.DataFrame({
                "Resultado": ["Ganados", "Perdidos"],
                "Cantidad": [propios_ganados, propios_perdidos]
                })
            fig_propios = px.pie(
                propios_data, 
                names="Resultado", 
                values="Cantidad", 
                hole=0.6,
                color_discrete_sequence=["#4A50FF", "#FF8D2E"]
                )
            fig_propios.update_traces(textinfo='percent+label+value')
            fig_propios.update_layout(title=f"Lanzamientos Propios (Total {total_propios})")

            # Grafico 3 Lanzamiento rival
            rival_data = pd.DataFrame({
                "Resultado": ["Ganados", "Perdidos"],
                "Cantidad": [rival_ganados, rival_perdidos]
                })
            fig_rival = px.pie(
                rival_data, 
                names="Resultado", 
                values="Cantidad", 
                hole=0.6,
                color_discrete_sequence=["#4A50FF", "#FF8D2E"]
                )
            fig_rival.update_traces(textinfo='percent+label+value')
            fig_rival.update_layout(title=f"Lanzamientos Rival (Total {total_rival})")

            # Mostrar los gráficos en columnas (horizontal)
            col1, col2, col3 = st.columns(3)
            with col1:
                st.plotly_chart(fig_overall, use_container_width=True)
            with col2:
                st.plotly_chart(fig_propios, use_container_width=True)
            with col3:
                st.plotly_chart(fig_rival, use_container_width=True)

    else:
        st.warning("❗ Error: Faltan columnas esperadas o el formato de la hoja no es correcto.")
    # Scrum
    st.subheader("Estadísticas de Scrum")

    scrum = pd.read_excel(archivo_estadistica, sheet_name="Scrum")
    scrum.columns = scrum.columns.str.strip().str.lower()

    if {
        "lanzamientos propios",
        "lanzamientos rival",
        "lanzamientos propios ganados",
        "lanzamientos rival ganados",
        "lanzamientos propios perdidos",
        "lanzamientos rival perdidos",
        "totales ganados",
        "totales perdidos",
        "total"
    }.issubset(set(scrum.columns)):

        row = scrum.iloc[0]
        total_propios = row["lanzamientos propios"]
        total_rival = row["lanzamientos rival"]
        propios_ganados = row["lanzamientos propios ganados"]
        propios_perdidos = row["lanzamientos propios perdidos"]
        rival_ganados = row["lanzamientos rival ganados"]
        rival_perdidos = row["lanzamientos rival perdidos"]

        st.write(f"**Total:** {row['total']} lanzamientos")

        overall_data_scrum = pd.DataFrame({
            "Resultado": ["Ganados", "Perdidos"],
            "Cantidad": [row["totales ganados"], row["totales perdidos"]]
        })
        fig_overall_scrum = px.pie(
            overall_data_scrum,
            names="Resultado",
            values="Cantidad",
            hole=0.6,
            color_discrete_sequence=["#8E3AC7", "#C7693A"]
        )
        fig_overall_scrum.update_traces(textinfo='percent+label+value')
        fig_overall_scrum.update_layout(title=f"Scrum totales (Total {row['total']})")

        propios_data_scrum = pd.DataFrame({
            "Resultado": ["Ganados", "Perdidos"],
            "Cantidad": [propios_ganados, propios_perdidos]
        })
        fig_propios_scrum = px.pie(
            propios_data_scrum,
            names="Resultado",
            values="Cantidad",
            hole=0.6,
            color_discrete_sequence=["#8E3AC7", "#C7693A"]
        )
        fig_propios_scrum.update_traces(textinfo='percent+label+value')
        fig_propios_scrum.update_layout(title=f"Lanzamientos Propios (Total {total_propios})")

        rival_data_scrum = pd.DataFrame({
            "Resultado": ["Ganados", "Perdidos"],
            "Cantidad": [rival_ganados, rival_perdidos]
        })
        fig_rival_scrum = px.pie(
            rival_data_scrum,
            names="Resultado",
            values="Cantidad",
            hole=0.6,
            color_discrete_sequence=["#8E3AC7", "#C7693A"]
        )
        fig_rival_scrum.update_traces(textinfo='percent+label+value')
        fig_rival_scrum.update_layout(title=f"Lanzamientos Rival (Total {total_rival})")

        col1, col2, col3 = st.columns(3)
        with col1:
            st.plotly_chart(fig_overall_scrum, use_container_width=True)
        with col2:
            st.plotly_chart(fig_propios_scrum, use_container_width=True)
        with col3:
            st.plotly_chart(fig_rival_scrum, use_container_width=True)

    else:
        st.warning("❗ Error: Faltan columnas esperadas o el formato de la hoja 'Scrum' no es correcto.")
        
        # SALIDAS
    st.subheader("Estadísticas de Salidas")

    salidas = pd.read_excel(archivo_estadistica, sheet_name="Salidas")
    salidas.columns = salidas.columns.str.strip().str.lower()

    if {
        "salidas propias",
        "salidas rival",
        "salidas propias ganadas",
        "salidas rival ganadas",
        "salidas propias perdidas",
        "salidas rival perdidas",
        "salidas total ganadas",
        "salidas total perdidas",
        "salidas total"
   }.issubset(salidas.columns):
        
        row = salidas.iloc[0]

        total_propios = row["salidas propias"]
        total_rival = row["salidas rival"]
        propios_ganados = row["salidas propias ganadas"]
        propios_perdidos = row["salidas propias perdidas"]
        rival_ganados = row["salidas rival ganadas"]
        rival_perdidos = row["salidas rival perdidas"]

        st.write(f"**Total:** {row['salidas total']} salidas")

        # Grafico 1: Salidas totales
        data_total_salidas = pd.DataFrame({
        "Resultado": ["Ganadas", "Perdidas"],
        "Cantidad": [row["salidas total ganadas"], row["salidas total perdidas"]]
        })
        fig_salidas_total = px.pie(
            data_total_salidas,
            names="Resultado",
            values="Cantidad",
            hole=0.6,
            color_discrete_sequence=["#7CDED3", "#218378"]
            )   
        fig_salidas_total.update_traces(textinfo='percent+label+value')
        fig_salidas_total.update_layout(title=f"Salidas Totales (Total {row['salidas total']})")

        # Grafico 2: Salidas propias
        data_propias = pd.DataFrame({
            "Resultado": ["Ganadas", "Perdidas"],
            "Cantidad": [propios_ganados, propios_perdidos]
            })
        fig_salidas_propias = px.pie(
            data_propias,
            names="Resultado",
            values="Cantidad",
            hole=0.6,
            color_discrete_sequence=["#7CDED3", "#218378"]
            )
        fig_salidas_propias.update_traces(textinfo='percent+label+value')
        fig_salidas_propias.update_layout(title=f"Salidas Propias (Total {total_propios})")

        # Grafico 3: Salidas rival
        data_rival = pd.DataFrame({
            "Resultado": ["Ganadas", "Perdidas"],
            "Cantidad": [rival_ganados, rival_perdidos]
            })
        fig_salidas_rival = px.pie(
            data_rival,
            names="Resultado",
            values="Cantidad",
            hole=0.6,
            color_discrete_sequence=["#7CDED3", "#218378"]
            )
        fig_salidas_rival.update_traces(textinfo='percent+label+value')
        fig_salidas_rival.update_layout(title=f"Salidas Rival (Total {total_rival})")

        col1, col2, col3 = st.columns(3)
        with col1:
            st.plotly_chart(fig_salidas_total, use_container_width=True)
        with col2:
            st.plotly_chart(fig_salidas_propias, use_container_width=True)
        with col3:
            st.plotly_chart(fig_salidas_rival, use_container_width=True)
    else:
        st.warning("❗ Error: Faltan columnas esperadas o el formato de la hoja 'Salidas' no es correcto.")
    # SALIDAS 22
    st.subheader("Estadísticas de Salidas de 22")

    salidas_22 = pd.read_excel(archivo_estadistica, sheet_name="Salidas de 22")
    salidas_22.columns = salidas_22.columns.str.strip().str.lower()

    if {
        "salidas 22 propias",
        "salidas 22 rival",
        "salidas 22 propias ganadas",
        "salidas 22 rival ganadas",
        "salidas 22 propias perdidas",
        "salidas 22 rival perdidas",
        "salidas 22 total ganadas",
        "salidas 22 total perdidas",
        "salidas 22 total"
    }.issubset(salidas_22.columns):

        row = salidas_22.iloc[0]

        total_propios_22 = row["salidas 22 propias"]
        total_rival_22 = row["salidas 22 rival"]
        propios_ganados_22 = row["salidas 22 propias ganadas"]
        propios_perdidos_22 = row["salidas 22 propias perdidas"]
        rival_ganados_22 = row["salidas 22 rival ganadas"]
        rival_perdidos_22 = row["salidas 22 rival perdidas"]

        st.write(f"**Total:** {row['salidas 22 total']} - salidas de 22")

        data_total_22 = pd.DataFrame({
            "Resultado": ["Ganadas", "Perdidas"],
            "Cantidad": [row["salidas 22 total ganadas"], row["salidas 22 total perdidas"]]
            })
        fig_total_22 = px.pie(
            data_total_22,
            names="Resultado",
            values="Cantidad",
            hole=0.6,
            color_discrete_sequence=["#7DBADE", "#215F83"]
            )
        fig_total_22.update_traces(textinfo='percent+label+value')
        fig_total_22.update_layout(title=f"Salidas de 22 Totales (Total {row['salidas 22 total']})")

        data_propias_22 = pd.DataFrame({
            "Resultado": ["Ganadas", "Perdidas"],
            "Cantidad": [propios_ganados_22, propios_perdidos_22]
            })
        fig_propias_22 = px.pie(
            data_propias_22,
            names="Resultado",
            values="Cantidad",
            hole=0.6,
            color_discrete_sequence=["#7DBADE", "#215F83"]
            )
        fig_propias_22.update_traces(textinfo='percent+label+value')
        fig_propias_22.update_layout(title=f"Salidas de 22 Propias (Total {total_propios_22})")
        
        data_rival_22 = pd.DataFrame({
            "Resultado": ["Ganadas", "Perdidas"],
            "Cantidad": [rival_ganados_22, rival_perdidos_22]
            })
        fig_rival_22 = px.pie(
            data_rival_22,
            names="Resultado",
            values="Cantidad",
            hole=0.6,
            color_discrete_sequence=["#7DBADE", "#215F83"]
            )
        fig_rival_22.update_traces(textinfo='percent+label+value')
        fig_rival_22.update_layout(title=f"Salidas de 22 Rival (Total {total_rival_22})")

        col1, col2, col3 = st.columns(3)
        with col1:
            st.plotly_chart(fig_total_22, use_container_width=True)
        with col2:
            st.plotly_chart(fig_propias_22, use_container_width=True)
        with col3:
            st.plotly_chart(fig_rival_22, use_container_width=True)

    else:
        st.warning("❗ Error: Faltan columnas esperadas o el formato de la hoja 'Salidas 22' no es correcto.")
        
    # Efectividad en 22 rival
    st.subheader("📈 Efectividad en 22 Rival - TRL B")

    efectividad = pd.read_excel(archivo_estadistica, sheet_name="Efectividad 22")
    efectividad.columns = efectividad.columns.str.strip().str.lower()
    
    # Agregamos una columna para el orden secuencial de los partidos
    efectividad["partido"] = range(1, len(efectividad) + 1)
    efectividad["etiqueta"] = efectividad["partido"].astype(str) + " - " + efectividad["rival"]

    # Separar la fila que tiene 'total' para la conclusion abajo de todo
    fila_total = efectividad[efectividad["rival"].str.lower() == "total"]
    # Sacamos total del grafico
    efectividad = efectividad[efectividad["rival"].str.lower() != "total"]
    
    fig = px.line(
        efectividad,
        x="rival",
        y=["concretadas", "chances"],
        markers=True,
        labels={"value": "Cantidad", "variable": "Tipo de Acción", "rival": "Rival"},
        title="Acciones Concretadas vs Chances en 22 Rival",
        color_discrete_map={"concretadas": "#F4B400", "chances": "#DB4437"}
        )

    fig.update_layout(
        height=500,
        yaxis=dict(title="Cantidad"),
        xaxis=dict(title="Rival"),
        legend_title="Tipo",
        margin=dict(l=40, r=40, t=60, b=40),
        )
    
    st.plotly_chart(fig, use_container_width=True)
    
    #Conclusion
    if not fila_total.empty:
        total_chances = int(fila_total["chances"].values[0])
        total_concretadas = int(fila_total["concretadas"].values[0])
        total_porcentaje = int(fila_total["%pp"].values[0])

        st.markdown(
        f" **Conclusión:** Hubo un total de **{total_chances}** chances y se concretaron **{total_concretadas}**, "
        f"dando una efectividad del **{total_porcentaje}%** en zona de 22 rival."
        )
        
    conclusion_22 = None
    if not fila_total.empty:
        total_chances = int(fila_total["chances"].values[0])
        total_concretadas = int(fila_total["concretadas"].values[0])
        total_porcentaje = int(fila_total["%pp"].values[0])
        conclusion_22 = (f" Conclusión: Hubo un total de {total_chances} chances y se concretaron {total_concretadas}, "
        f"dando una efectividad del {total_porcentaje}% en zona de 22 rival.")
        
    # Estadisticas de puntos
    st.subheader("Puntos")

    puntos_df = pd.read_excel(archivo_estadistica, sheet_name="Puntos")
    puntos_df.columns = puntos_df.columns.str.strip().str.lower()
    row = puntos_df.iloc[0]

    # KPIs
    pf = int(row["puntos_favor"])
    pc = int(row["puntos_contra"])
    total = pf + pc
    share_favor = (pf / total * 100) if total else 0
    dif = pf - pc
    partidos = int(row["partidos"])
    xp_favor = row["puntos_favor"] / partidos
    xp_contra = row["puntos_contra"] / partidos

    col1, col2, col3, col4 = st.columns(4)
    col1.metric("Puntos a favor", pf)
    col2.metric("Puntos en contra", pc)
    col3.metric("Diferencia", dif)
    col4.metric("XP (prom. por partido)", f"{xp_favor:.1f} vs {xp_contra:.1f}")

    # Barra apilada
    bar_100 = pd.DataFrame({
        "Tipo": ["Puntos"],
        "A favor": [pf],
        "En contra": [pc]
        })
    fig_bar = px.bar(
        bar_100.melt(id_vars="Tipo", var_name="Lado", value_name="Puntos"),
        x="Tipo", y="Puntos", color="Lado",
        color_discrete_map={"A favor": "#2E86DE", "En contra": "#EB4D8A"},
        text="Puntos"
        )
    fig_bar.update_layout(
        title=f"Total de puntos – {share_favor:.0f}% a favor",
        barmode="relative", height=240 if modo_celular else 300,
        yaxis=dict(range=[0, total]),
        margin=dict(l=40, r=40, t=60, b=20),
        )
    st.plotly_chart(fig_bar, use_container_width=True)

    # Donuts de composición de puntos 
    def puntos_componentes(prefix):
        tries = int(row[f"tries_{prefix}"])
        conv_m = int(row[f"conv_{prefix}_m"])
        pen_m = int(row[f"pen_{prefix}_m"])
        drops = int(row.get(f"drops_{prefix}", 0))

        return {
            "Tries (x5)": tries * 5,
            "Conversiones (x2)": conv_m * 2,
            "Penales (x3)": pen_m * 3,
            "Drops (x3)": drops * 3,
            }

    comp_favor = puntos_componentes("favor")
    comp_contra = puntos_componentes("contra")

    df_comp_f = pd.DataFrame({"Componente": comp_favor.keys(), "Puntos": comp_favor.values()})
    df_comp_c = pd.DataFrame({"Componente": comp_contra.keys(), "Puntos": comp_contra.values()})

    fig_f = px.pie(df_comp_f, names="Componente", values="Puntos", hole=0.5,
               title="Composición de puntos A FAVOR")
    fig_c = px.pie(df_comp_c, names="Componente", values="Puntos", hole=0.5,
               title="Composición de puntos EN CONTRA")

    fig_f.update_traces(textinfo="percent+label+value")
    fig_c.update_traces(textinfo="percent+label+value")
    fig_f.update_layout(height=260 if modo_celular else 320, margin=dict(l=20,r=20,t=60,b=20))
    fig_c.update_layout(height=260 if modo_celular else 320, margin=dict(l=20,r=20,t=60,b=20))

    c1, c2 = st.columns(2)
    with c1:
        st.plotly_chart(fig_f, use_container_width=True)
    with c2:
        st.plotly_chart(fig_c, use_container_width=True)

    # Precision: Conversiones y Penales (%)
    conv_f = (row["conv_favor_m"] / row["conv_favor_t"] * 100) if row["conv_favor_t"] else 0
    conv_c = (row["conv_contra_m"] / row["conv_contra_t"] * 100) if row["conv_contra_t"] else 0
    pen_f = (row["pen_favor_m"] / row["pen_favor_t"] * 100) if row["pen_favor_t"] else 0
    pen_c = (row["pen_contra_m"] / row["pen_contra_t"] * 100) if row["pen_contra_t"] else 0

    acc_df = pd.DataFrame({
        "Métrica": ["Conversiones", "Penales"],
        "A favor": [round(conv_f,1), round(pen_f,1)],
        "En contra": [round(conv_c,1), round(pen_c,1)]
        })
    
    labels = {
    ("Conversiones", "A favor"):  f"{int(row['conv_favor_m'])}/{int(row['conv_favor_t'])}",
    ("Conversiones", "En contra"):f"{int(row['conv_contra_m'])}/{int(row['conv_contra_t'])}",
    ("Penales",      "A favor"):  f"{int(row['pen_favor_m'])}/{int(row['pen_favor_t'])}",
    ("Penales",      "En contra"):f"{int(row['pen_contra_m'])}/{int(row['pen_contra_t'])}",
    }

    acc_long = acc_df.melt(id_vars="Métrica", var_name="Lado %", value_name="Precisión (%)")
    acc_long["Lado"] = acc_long["Lado %"].str.replace(" %","", regex=False)
    acc_long["label"] = acc_long.apply(lambda r: labels[(r["Métrica"], r["Lado"])], axis=1)

    fig_acc = px.bar(
        acc_long,
        x="Métrica", y="Precisión (%)", color="Lado",
        barmode="group",
        color_discrete_map={"A favor": "#2E86DE", "En contra": "#EB4D8A"},
        text="label",  
        title="Precisión: Conversiones y Penales"
    )
    
    fig_acc.update_traces(
        textposition="outside",
        texttemplate="%{text} (%{y:.1f}%)",
        cliponaxis=False
    )

    fig_acc.update_layout(
        height=260 if modo_celular else 320,
        yaxis=dict(title="Precisión (%)", range=[0,100]),
        margin=dict(l=40, r=40, t=60, b=20)
    )
    
    fig_acc.update_layout(height=260 if modo_celular else 320, yaxis=dict(range=[0,100]))
    st.plotly_chart(fig_acc, use_container_width=True)

    # 5) Conclusión
    st.markdown(
        f"**Conclusión:** Total de puntos **{total}** → "
        f"**{pf}** a favor (≈ **{share_favor:.0f}%** del total) y **{pc}** en contra. "
        f"Promedios por partido: **{xp_favor:.1f}** (nosotros) vs **{xp_contra:.1f}** (rivales). "
        f"Precisión: conversiones **{conv_f:.1f}%** vs **{conv_c:.1f}%**; penales **{pen_f:.1f}%** vs **{pen_c:.1f}%**."
        )
    
    
    # Empaquetamos los figs ya creados
    figs = {
        # Puntos
        "puntos_bar":   fig_bar,
        "puntos_comp_f": fig_f,
        "puntos_comp_c": fig_c,
        "puntos_acc":   fig_acc,
        # Penales
        "pen_situaciones": fig1,
        "pen_ruck":        fig2,
        "pen_juego":       fig3,
        "pen_scrum":       fig4,
        # Line
        "line_total":  fig_overall,
        "line_prop":   fig_propios,
        "line_rival":  fig_rival,
        # Scrum
        "scrum_total": fig_overall_scrum,
        "scrum_prop":  fig_propios_scrum,
        "scrum_rival": fig_rival_scrum,
        # Salidas
        "salidas_total": fig_salidas_total,
        "salidas_prop":  fig_salidas_propias,
        "salidas_rival": fig_salidas_rival,
        # Salidas 22
        "salidas22_total": fig_total_22,
        "salidas22_prop":  fig_propias_22,
        "salidas22_rival": fig_rival_22,
        # Efectividad 22
        "efectividad22": fig,
        # Tackles
        "tackles_total": fig_total,
    }

    # KPIs ya calculados
    kpis = dict(
        pf=pf, pc=pc, dif=dif, partidos=partidos,
        xp_favor=xp_favor, xp_contra=xp_contra
    )

    # Tabla compacta de puntos (editable)
    tabla_puntos = [
        ["Item", "A favor", "En contra"],
        ["Tries",           int(row["tries_favor"]),  int(row["tries_contra"])],
        ["Conversiones",    f"{int(row['conv_favor_m'])}/{int(row['conv_favor_t'])}",
                             f"{int(row['conv_contra_m'])}/{int(row['conv_contra_t'])}"],
        ["Penales",         f"{int(row['pen_favor_m'])}/{int(row['pen_favor_t'])}",
                             f"{int(row['pen_contra_m'])}/{int(row['pen_contra_t'])}"],
        ["Drops",           int(row.get("drops_favor",0)), int(row.get("drops_contra",0))],
        ["Puntos",          pf, pc],
    ]

    pdf_buffer = generar_informe_pdf(
        titulo="Informe Anual – Universitario 2025",
        kpis=kpis,
        tabla_puntos=tabla_puntos,
        figs=figs,
        tackles_tabla=tabla_tackles,
        conclusion_22=conclusion_22,
        conclusion_penales=texto_conclusion_penales,
    )

    pdf_bytes = pdf_buffer.getvalue()

    st.download_button(
        "📥 Descargar Informe PDF",
        data=pdf_bytes,  # <- en bytes
        file_name="Informe_Universitario_2025.pdf",
        mime="application/pdf",
    )
    
except Exception as e:
        st.error(f"⚠️ Error al procesar los datos: {e}")