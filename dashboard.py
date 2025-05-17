import streamlit as st
import pandas as pd
import os
import plotly.express as px

# Titulo del dashboard
st.set_page_config(page_title="Dashboard de Universitario", layout="wide")
st.title("📊 Dashboard de Tackles")

# --- CARGA DEL ARCHIVO ---
archivo = st.file_uploader("Elegí un archivo .xlsx", type=["xlsx"])

if archivo is not None:
    try:
        hojas = pd.read_excel(archivo, sheet_name=None)
        if 'Resumen' not in hojas:
            st.error("❌ No se encontró una hoja llamada 'Resumen'.")
        else:
            resumen = hojas['Resumen']
            st.success("✅ Archivo cargado correctamente.")

            st.subheader("📄 Tabla Resumen")
            st.dataframe(resumen)
            
            # Asegura jugadores del 1 al 23 como strings
            jugadores_completos = pd.DataFrame({"Jugador": list(map(str, range(1, 24)))})
            resumen["Jugador"] = resumen["Jugador"].astype(str)

            resumen = jugadores_completos.merge(resumen, on="Jugador", how="left").fillna(0)

            # Convierte a int
            resumen["Tackles"] = resumen["Tackles"].astype(int)
            resumen["Errados"] = resumen["Errados"].astype(int)

            # Calcular totales y porcentaje
            resumen["Total"] = resumen["Tackles"] + resumen["Errados"]
            resumen["Porcentaje"] = resumen.apply(
                lambda row: (row["Tackles"] / row["Total"] * 100) if row["Total"] > 0 else 0,
                axis=1
            ).round(0).astype(int)

            # Etiqueta tipo: 6/7 (86%)
            resumen["Etiqueta"] = resumen.apply(
                lambda row: f'{row["Tackles"]}/{row["Total"]} ({row["Porcentaje"]}%)' if row["Total"] > 0 else '',
                axis=1
            )

            st.subheader("📊 Gráfico de Tackles Totales por Jugador ")

            df_plot = resumen.melt(
                id_vars=["Jugador", "Etiqueta"],
                value_vars=["Tackles", "Errados"],
                var_name="Resultado",
                value_name="Cantidad"
            )

            df_plot["Texto"] = df_plot.apply(
                lambda row: row["Etiqueta"] if row["Resultado"] == "Errados" and row["Cantidad"] > 0 else "",
                axis=1
            )

            fig = px.bar(
                df_plot,
                y="Jugador",
                x="Cantidad",
                color="Resultado",
                orientation="h",
                color_discrete_map={"Tackles": "blue", "Errados": "red"},
                title="Tackles Exitosos y Errados por Jugador",
                category_orders={"Jugador": list(map(str, range(1, 24)))},
                text="Texto"
            )

            fig.update_traces(textposition="outside")

            fig.update_layout(
                yaxis=dict(
                    title="Jugador",
                    dtick=1,
                    categoryorder="array",
                    categoryarray=list(map(str, range(1, 24)))
                ),
                xaxis=dict(
                    title="Cantidad de Tackles",
                    range=[0, 10],
                    tick0=0,
                    dtick=1
                ),
                barmode="stack",
                height=900
            )

            st.plotly_chart(fig, use_container_width=True)
            
            # 📈 Gráfico de Torta de Tipos de Tackles
            st.subheader("Distribución de Tipos de Tackles")

        total_tipos = {
            "Positivos": resumen["Positivos"].sum(),
            "Neutrales": resumen["Neutrales"].sum(),
            "Negativos": resumen["Negativos"].sum(),
            "Errados": resumen["Errados"].sum()
            }

        df_torta = pd.DataFrame({
            "Tipo": list(total_tipos.keys()),
            "Cantidad": list(total_tipos.values())
            })

        fig_torta = px.pie(
            df_torta,
            names="Tipo",
            values="Cantidad",
            color="Tipo",
            title="Distribución de Tipos de Tackles",
            color_discrete_map={
                "Positivos": "#2ecc71",  # Verde
                "Neutrales": "#f1c40f",    # Amarillo
                "Negativos": "#e67e22",  # Naranja
                "Errados": "#e74c3c"     # Rojo
                },
            hole=0.3
            )

        fig_torta.update_traces(textinfo="label+percent")

        st.plotly_chart(fig_torta, use_container_width=True)

    except Exception as e:
        st.error(f"❌ Error al procesar el archivo: {e}")
else:
    st.info("📁 Por favor cargá un archivo Excel.")
    