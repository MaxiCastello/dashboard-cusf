import streamlit as st
import pandas as pd
import plotly.express as px
import plotly.graph_objects as go
import os

st.set_page_config(page_title="Dashboard de Universitario", layout="wide")
st.title("📊 Dashboard Temporada 2025")
modo_celular = st.toggle("📱 Activar modo celular", help="Mejora la visualización de los gráficos para celular.")

if modo_celular:
    altura_grafico = 500
    margen_titulo = dict(l=20, r=20, t=40, b=20)
    texto_tamanio = 7
    altura_donut = 250
else:
    altura_grafico = 900
    margen_titulo = dict(l=120, r=50, t=50, b=50)
    texto_tamanio = 11
    altura_donut = 400

# Carga de archivos en repositorio Github @MaxiCastello dashboard-cusf
carpeta_data = "data/"
archivos = [
    os.path.join(carpeta_data, archivo)
    for archivo in os.listdir(carpeta_data)
    if archivo.endswith(".xlsx") and not os.path.basename(archivo).lower().startswith("estadistica")
    ]

if archivos:
    resumen_total = pd.DataFrame()

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
        st.subheader("📄 Tabla de Tackles Combinada")
        st.dataframe(resumen_total)

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
            text="texto",
        
        )

        fig_total.update_traces(textposition="outside")
        
        altura_total = 900 if not modo_celular else 1500
        
        fig_total.update_layout(
            yaxis=dict(
                title="Nombre del Jugador",
                dtick=1
                ),
            xaxis=dict(
                title="Cantidad de Tackles",
                range=[0, 80],
                tick0=0,
                dtick=5
                ),
            barmode="stack",
            height=altura_grafico,
            margin=dict(l=160, r=80, t=60, b=80),
            uniformtext_minsize=8,
            uniformtext_mode='show',
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
            titulo_donut = f"{jugador_donut} – {int(tackles_reales + errados)} tackles en {pj} PJ"
        else:
            titulo_donut = (
        f"{jugador_donut} – Distribución de {int(tackles_reales + errados)} intentos de tackle "
        f"({int(tackles_reales)} realizados, {int(errados)} errados) en {pj} partido{'s' if pj != 1 else ''} "
        f"(Promedio: {promedio:.1f} por partido)"
        )

        fig_donut.update_layout(
        title=titulo_donut,
        height=altura_donut
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
            margin=margen_titulo,
            uniformtext_minsize=texto_tamanio,
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

        # Grafico 2 Detalle de penales en Ruck por motivo
        st.subheader("🔍 Detalle de Penales en Ruck (por motivo)")
        penales_ruck = penales[penales["situacion"] == "ruck"]
        resumen_ruck = penales_ruck.groupby("motivo")[["propios", "rival"]].sum().reset_index()

        fig2 = px.bar(
            resumen_ruck,
            x="motivo",
            y=["propios", "rival"],
            barmode="group",
            labels={"value": "Cantidad", "variable": "Tipo"},
            title="Detalle de Penales en Ruck por Motivo",
            color_discrete_map={"propios": "#28A745", "rival": "#C0392B"},
            height=500,
            text_auto=True
        )
        fig2.update_layout(xaxis_tickangle=-30)
        st.plotly_chart(fig2, use_container_width=True)

        # Grafico 3 Detalle de penales en Juego por motivo
        st.subheader("🔍 Detalle de Penales en Juego (por motivo)")
        penales_juego = penales[penales["situacion"] == "juego"]
        resumen_juego = penales_juego.groupby("motivo")[["propios", "rival"]].sum().reset_index()

        fig3 = px.bar(
            resumen_juego,
            x="motivo",
            y=["propios", "rival"],
            barmode="group",
            labels={"value": "Cantidad", "variable": "Tipo"},
            title="Detalle de Penales en Juego por Motivo",
            color_discrete_map={"propios": "#28A745", "rival": "#C0392B"},
            height=500,
            text_auto=True
        )
        fig3.update_layout(xaxis_tickangle=-30)
        st.plotly_chart(fig3, use_container_width=True)
        
        # Grafico 4 Detalle de penales en Scrum por motivo
        st.subheader("🔍 Detalle de Penales en Scrum (por motivo)")
        penales_scrum = penales[penales["situacion"] == "scrum"]
        resumen_scrum = penales_scrum.groupby("motivo")[["propios", "rival"]].sum().reset_index()

        fig4 = px.bar(
            resumen_scrum,
            x="motivo",
            y=["propios", "rival"],
            barmode="group",
            labels={"value": "Cantidad", "variable": "Tipo"},
            title="Detalle de Penales en Scrum por Motivo",
            color_discrete_map={"propios": "#28A745", "rival": "#C0392B"},
            height=500,
            text_auto=True
        )
        fig4.update_layout(xaxis_tickangle=-30)
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
    st.subheader("📈 Efectividad en 22 Rival TRL B")

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
    st.subheader("🎯 Puntos de CUSF")

    puntos_df = pd.read_excel(archivo_estadistica, sheet_name="Puntos")
    puntos_df.columns = puntos_df.columns.str.strip().str.lower()
    row = puntos_df.iloc[0]

    # 1) KPIs
    pf = int(row["puntos_favor"])
    pc = int(row["puntos_contra"])
    total = pf + pc
    share_favor = (pf / total * 100) if total else 0
    dif = pf - pc
    xp_favor = float(row.get("xp_favor", 0))
    xp_contra = float(row.get("xp_contra", 0))

    col1, col2, col3, col4 = st.columns(4)
    col1.metric("Puntos a favor", pf)
    col2.metric("Puntos en contra", pc)
    col3.metric("Diferencia", dif)
    col4.metric("XP (prom. por partido)", f"{xp_favor:.1f} 🆚 {xp_contra:.1f}")

    # 2) Barra apilada 100%
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
        title=f"Participación de puntos (Azul vs Rojo) – {share_favor:.0f}% a favor",
        barmode="relative", height=240 if modo_celular else 300,
        yaxis=dict(range=[0, total]),
        margin=dict(l=40, r=40, t=60, b=20),
        )
    st.plotly_chart(fig_bar, use_container_width=True)

    # 3) Donuts de composición de puntos (calculados)
    # Rugby: try=5, conversión=2, penal=3, drop=3
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

    fig_f.update_traces(textinfo="percent+label")
    fig_c.update_traces(textinfo="percent+label")
    fig_f.update_layout(height=260 if modo_celular else 320, margin=dict(l=20,r=20,t=60,b=20))
    fig_c.update_layout(height=260 if modo_celular else 320, margin=dict(l=20,r=20,t=60,b=20))

    c1, c2 = st.columns(2)
    with c1:
        st.plotly_chart(fig_f, use_container_width=True)
    with c2:
        st.plotly_chart(fig_c, use_container_width=True)

    # 4) Precisión: Conversiones y Penales (%)
    conv_f = (row["conv_favor_m"] / row["conv_favor_t"] * 100) if row["conv_favor_t"] else 0
    conv_c = (row["conv_contra_m"] / row["conv_contra_t"] * 100) if row["conv_contra_t"] else 0
    pen_f = (row["pen_favor_m"] / row["pen_favor_t"] * 100) if row["pen_favor_t"] else 0
    pen_c = (row["pen_contra_m"] / row["pen_contra_t"] * 100) if row["pen_contra_t"] else 0

    acc_df = pd.DataFrame({
        "Métrica": ["Conversiones", "Penales"],
        "A favor": [round(conv_f,1), round(pen_f,1)],
        "En contra": [round(conv_c,1), round(pen_c,1)]
        })
    fig_acc = px.bar(
        acc_df.melt(id_vars="Métrica", var_name="Lado", value_name="Precisión (%)"),
        x="Métrica", y="Precisión (%)", color="Lado", barmode="group",
        text="Precisión (%)",
        color_discrete_map={"A favor": "#2E86DE", "En contra": "#EB4D8A"},
        title="Precisión: Conversiones y Penales"
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
except Exception as e:
    st.error(f"⚠️ Error al procesar los datos del archivo 'Estadistica.xlsx': {e}")