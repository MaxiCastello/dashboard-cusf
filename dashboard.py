import streamlit as st
import pandas as pd
import plotly.express as px
import plotly.graph_objects as go
import os

st.set_page_config(page_title="Dashboard de Universitario", layout="wide")
st.title("📊 Dashboard de Tackles")
modo_celular = st.toggle("📱 Activar modo celular", help="Usalo si estás en el teléfono. Mejora la visualización de los gráficos.")

if modo_celular:
    altura_grafico = 500
    margen_titulo = dict(l=20, r=20, t=40, b=20)
    texto_tamanio = 9
    altura_donut = 300
else:
    altura_grafico = 900
    margen_titulo = dict(l=120, r=50, t=50, b=50)
    texto_tamanio = 11
    altura_donut = 400

# CARGA DE ARCHIVOS
carpeta_data = "data/"
archivos = [os.path.join(carpeta_data, archivo) for archivo in os.listdir(carpeta_data) if archivo.endswith(".xlsx")]

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

        with st.expander(f"📁 Datos del archivo: {os.path.basename(archivo)}", expanded=expandir_todo):
            jugadores_completos = pd.DataFrame({"jugador": list(map(str, range(1, 26)))})
            resumen["jugador"] = resumen["jugador"].astype(str)
            resumen = jugadores_completos.merge(resumen, on="jugador", how="left").fillna(0)
            
            resumen["tackles"] = resumen["tackles"].astype(int)
            resumen["errados"] = resumen["errados"].astype(int)
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
                id_vars=["jugador", "etiqueta"],
                value_vars=["tackles", "errados"],
                var_name="resultado",
                value_name="cantidad"
                )

            df_plot["texto"] = df_plot.apply(
                lambda row: row["etiqueta"] if row["resultado"] == "errados" and row["cantidad"] > 0 else "",
                axis=1
                )
            altura = 1300 if modo_celular else 900
            
            fig = px.bar(
                df_plot,
                y="jugador",
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
                yaxis=dict(title="Jugador", dtick=1, categoryorder="array", categoryarray=list(map(str, range(1, 26)))),
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
            margin=margen_titulo,
            uniformtext_minsize=texto_tamanio,
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
    st.info("📁 Por favor, cargá uno o más archivos Excel.")
    