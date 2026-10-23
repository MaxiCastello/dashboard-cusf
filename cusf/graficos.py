"""Los tipos de gráfico del tablero, todos con el mismo estilo (tema "cusf"
de estilo.py). Cada función arma la figura y la dibuja.

Los textos que llegan acá (rival, jugador, motivo) ya pasaron por
calculos.texto(): sin < > (plotly interpreta algunas etiquetas HTML).
"""

import plotly.graph_objects as go

from .estilo import UNI, RIVAL, ACENTO, APAGADO, BORDE, SUP2, TEXTO, pct, grafico

BEBAS = "Bebas Neue, Arial Narrow, sans-serif"


def dona(etiquetas, valores, colores, centro, sub="", alto=280):
    """Torta con agujero; en el medio, el total o lo principal."""
    pares = [(e, v, c) for e, v, c in zip(etiquetas, valores, colores) if v]
    if not pares:
        return
    e, v, c = zip(*pares)
    fig = go.Figure(go.Pie(labels=e, values=v, hole=.62, sort=False, direction="clockwise",
                           marker=dict(colors=c, line=dict(color="#0a0c0f", width=2)),
                           textinfo="value", textfont=dict(size=13, color="#0a0c0f"),
                           hovertemplate="%{label}: %{value} · %{percent}<extra></extra>"))
    fig.add_annotation(text=f"<span style='font-family:{BEBAS};font-size:34px'>{centro}</span>"
                            + (f"<br><span style='font-size:11px;color:{APAGADO}'>{sub}</span>" if sub else ""),
                       showarrow=False, x=.5, y=.5, xref="paper", yref="paper")
    fig.update_layout(margin=dict(t=8, b=8, l=8, r=8), legend=dict(y=-0.08))
    grafico(fig, alto)


def mariposa(categorias, uni, rival, alto=None, nombres=("UNI", "Rival"), colores=(UNI, RIVAL)):
    """UNI hacia la izquierda, el rival hacia la derecha, misma escala."""
    tope = max([*uni, *rival, 1])
    fig = go.Figure([
        go.Bar(y=categorias, x=[-v for v in uni], name=nombres[0], orientation="h", marker_color=colores[0],
               text=[v or "" for v in uni], textposition="outside", cliponaxis=False,
               customdata=uni, hovertemplate="%{y}: %{customdata}<extra>" + nombres[0] + "</extra>"),
        go.Bar(y=categorias, x=rival, name=nombres[1], orientation="h", marker_color=colores[1],
               text=[v or "" for v in rival], textposition="outside", cliponaxis=False,
               hovertemplate="%{y}: %{x}<extra>" + nombres[1] + "</extra>")])
    fig.update_layout(barmode="relative", bargap=.35,
                      xaxis=dict(range=[-tope * 1.25, tope * 1.25], showticklabels=False, showgrid=False,
                                 zeroline=True, zerolinecolor=BORDE, zerolinewidth=2),
                      yaxis=dict(autorange="reversed", showgrid=False))
    grafico(fig, alto or 70 + 44 * len(categorias))


def pesas(etiquetas, a, b, nombres=("UNI", "Rival"), colores=(UNI, RIVAL), titulo_x="", alto=None,
          textos=None):
    """Un renglón por partido: dos puntos unidos por una línea (rango)."""
    fig = go.Figure()
    for i, (y, x1, x2) in enumerate(zip(etiquetas, a, b)):
        fig.add_scatter(x=[x1, x2], y=[y, y], mode="lines", line=dict(color=BORDE, width=6),
                        hoverinfo="skip", showlegend=False)
    for nombre, xs, color in ((nombres[0], a, colores[0]), (nombres[1], b, colores[1])):
        fig.add_scatter(x=xs, y=etiquetas, mode="markers", name=nombre,
                        marker=dict(size=15, color=color, line=dict(color="#0a0c0f", width=2)),
                        hovertemplate="%{y}<br>" + nombre + ": %{x}<extra></extra>")
    if textos:
        fig.add_scatter(x=[max(x1, x2) for x1, x2 in zip(a, b)], y=etiquetas, mode="text", text=textos,
                        textposition="middle right", textfont=dict(family="DM Mono, monospace", size=12,
                                                                   color=APAGADO),
                        hoverinfo="skip", showlegend=False, cliponaxis=False)
    fig.update_layout(xaxis=dict(title=titulo_x, rangemode="tozero"),
                      yaxis=dict(autorange="reversed", showgrid=False),
                      legend=dict(y=1.02, yanchor="bottom", x=0), margin=dict(t=30, r=56))
    grafico(fig, alto or 80 + 38 * len(etiquetas))


def lineas(x, series, alto=300, por_ciento=False, referencias=()):
    """series: [(nombre, ys, color, hover_textos|None)];
    referencias: [(valor, texto, color)] -> línea punteada (ej. la temporada)."""
    fig = go.Figure()
    for nombre, ys, color, hov in series:
        fig.add_scatter(x=x, y=ys, name=nombre, mode="lines+markers", connectgaps=True,
                        line=dict(color=color, width=3),
                        marker=dict(size=9, color=color, line=dict(color="#0a0c0f", width=2)),
                        customdata=hov or ys,
                        hovertemplate="%{x}<br>" + nombre + ": %{customdata}<extra></extra>")
    # el rótulo de la primera referencia a la izquierda y el de la segunda a la
    # derecha: si las dos líneas quedan cerca, los textos no se pisan
    for i, (valor, txt, color) in enumerate(referencias):
        if valor is None:
            continue
        lado = "left" if i == 0 else "right"
        fig.add_hline(y=valor, line=dict(color=color, width=1.5, dash="dot"), opacity=.7,
                      annotation=dict(text=txt, font=dict(size=11, color=color), xanchor=lado),
                      annotation_position="top " + lado)
    if por_ciento:
        fig.update_layout(yaxis=dict(range=[0, 108], ticksuffix="%"))
    fig.update_layout(xaxis=dict(showgrid=False), legend=dict(y=1.02, yanchor="bottom", x=0),
                      margin=dict(t=34))
    grafico(fig, alto)


def acumulado(x, uni, rival, alto=300):
    """Puntos a favor y en contra sumados partido a partido (áreas). Al
    pasar por un punto: el partido, lo que sumó ese partido y el total."""
    def suma(v):
        s, out = 0, []
        for n in v:
            s += n
            out.append(s)
        return out
    fig = go.Figure()
    for nombre, pts, color, relleno in (("En contra", rival, RIVAL, "rgba(255,152,0,.12)"),
                                        ("A favor", uni, UNI, "rgba(0,200,83,.16)")):
        fig.add_scatter(x=x, y=suma(pts), name=nombre, mode="lines+markers", fill="tozeroy", fillcolor=relleno,
                        line=dict(color=color, width=3), marker=dict(size=7, color=color), customdata=pts,
                        hovertemplate=nombre + ": +%{customdata} en el partido · total %{y}<extra></extra>")
    # un solo cartel por partido, con a favor y en contra (el título es el partido)
    fig.update_layout(xaxis=dict(showgrid=False), legend=dict(y=1.02, yanchor="bottom", x=0, traceorder="reversed"),
                      margin=dict(t=34), hovermode="x unified")
    grafico(fig, alto)


def barras(x, series, alto=300, titulo_y="", sufijo=""):
    """Barras verticales lado a lado, una tanda por partido.
    series: [(nombre, valores, color, hover_textos)]"""
    fig = go.Figure()
    for nombre, ys, color, hov in series:
        fig.add_bar(x=x, y=ys, name=nombre, marker_color=color, customdata=hov,
                    text=[f"{v}{sufijo}" if v else "" for v in ys], textposition="outside", cliponaxis=False,
                    textfont=dict(family="DM Mono, monospace", size=11, color=APAGADO),
                    hovertemplate="%{x}<br>" + nombre + ": %{customdata}<extra></extra>")
    tope = max([v for _, ys, _, _ in series for v in ys] + [1])
    fig.update_layout(barmode="group", bargap=.3, xaxis=dict(showgrid=False),
                      yaxis=dict(title=titulo_y, range=[0, tope * 1.2]),
                      legend=dict(y=1.02, yanchor="bottom", x=0), margin=dict(t=34))
    grafico(fig, alto)


def radar(ejes, series, alto=380):
    """series: [(nombre, valores %, color, relleno, textos hover)]"""
    fig = go.Figure()
    for nombre, vals, color, relleno, hov in series:
        fig.add_scatterpolar(r=vals + vals[:1], theta=ejes + ejes[:1], name=nombre, fill="toself",
                             fillcolor=relleno, line=dict(color=color, width=2.5),
                             marker=dict(size=7, color=color), customdata=hov + hov[:1],
                             hovertemplate="%{theta}: %{customdata}<extra>" + nombre + "</extra>")
    fig.update_layout(polar=dict(bgcolor="rgba(0,0,0,0)",
                                 radialaxis=dict(range=[0, 100], showticklabels=False, tickvals=[25, 50, 75, 100],
                                                 gridcolor="rgba(255,255,255,.08)", linecolor=BORDE,
                                                 tickfont=dict(size=10, color=APAGADO)),
                                 angularaxis=dict(gridcolor="rgba(255,255,255,.08)", linecolor=BORDE,
                                                  tickfont=dict(size=12, color=TEXTO))),
                      legend=dict(y=-0.06), margin=dict(t=24, b=24, l=48, r=48))
    grafico(fig, alto)


def mapa_calor(filas, columnas, ganados, tirados, alto=None):
    """Celdas coloreadas por el % ganado; el texto dice 'X de Y'."""
    z = [[pct(g, n) if n else None for g, n in zip(fg, fn)] for fg, fn in zip(ganados, tirados)]
    txt = [[f"{g} de {n}" if n else "" for g, n in zip(fg, fn)] for fg, fn in zip(ganados, tirados)]
    fig = go.Figure(go.Heatmap(
        z=z, x=columnas, y=filas, text=txt, texttemplate="%{text}", zmin=0, zmax=100, xgap=4, ygap=4,
        textfont=dict(family="DM Mono, monospace", size=13, color="#0a0c0f"),
        colorscale=[[0, "#ff1744"], [.5, "#ffd600"], [1, UNI]], showscale=False,
        hovertemplate="%{y} · %{x}<br>%{text} · %{z}%<extra></extra>"))
    fig.update_layout(xaxis=dict(side="top", showgrid=False), yaxis=dict(autorange="reversed", showgrid=False),
                      margin=dict(t=30))
    grafico(fig, alto or 70 + 52 * len(filas))


def sol(etiquetas, padres, valores, colores, alto=380):
    """Torta en dos anillos: adentro la situación, afuera el motivo."""
    fig = go.Figure(go.Sunburst(labels=etiquetas, parents=padres, values=valores, branchvalues="total",
                                ids=[f"{p}/{e}" if p else e for e, p in zip(etiquetas, padres)],
                                marker=dict(colors=colores, line=dict(color="#0a0c0f", width=2)),
                                insidetextorientation="radial", textfont=dict(size=12, color="#0a0c0f"),
                                hovertemplate="%{label}: %{value}<extra></extra>"))
    fig.update_layout(margin=dict(t=8, b=8, l=8, r=8))
    grafico(fig, alto)


def piruletas(etiquetas, valores, color=UNI, alto=None, sufijo=""):
    """Ranking horizontal: palito y punto, más liviano que una barra llena."""
    fig = go.Figure()
    for y, v in zip(etiquetas, valores):
        fig.add_scatter(x=[0, v], y=[y, y], mode="lines", line=dict(color=SUP2, width=4),
                        hoverinfo="skip", showlegend=False)
    fig.add_scatter(x=valores, y=etiquetas, mode="markers+text", text=[f"{v}{sufijo}" for v in valores],
                    textposition="middle right", marker=dict(size=14, color=color),
                    textfont=dict(family="DM Mono, monospace", size=12), cliponaxis=False,
                    hovertemplate="%{y}: %{x}<extra></extra>", showlegend=False)
    fig.update_layout(xaxis=dict(visible=False, range=[0, max([*valores, 1]) * 1.18]),
                      yaxis=dict(autorange="reversed", showgrid=False), margin=dict(r=30))
    grafico(fig, alto or 50 + 34 * len(etiquetas))


def apiladas(etiquetas, capas, alto=None):
    """Barras horizontales apiladas. capas: [(nombre, valores, color)]"""
    fig = go.Figure()
    for nombre, vals, color in capas:
        fig.add_bar(y=etiquetas, x=vals, name=nombre, orientation="h", marker_color=color,
                    hovertemplate="%{y}<br>" + nombre + ": %{x}<extra></extra>")
    fig.update_layout(barmode="stack", bargap=.3, yaxis=dict(autorange="reversed", showgrid=False),
                      legend=dict(y=1.02, yanchor="bottom", x=0, traceorder="normal"), margin=dict(t=34))
    grafico(fig, alto or 80 + 28 * len(etiquetas))


def marcador_en_el_partido(evol, alto=320):
    """Cómo fue cambiando el marcador, anotación por anotación.
    evol: [{periodo, u, r, eq, como}] acumulado (Uni-Dat no guarda minutos)."""
    x = list(range(len(evol) + 1))
    u = [0] + [e["u"] for e in evol]
    r = [0] + [e["r"] for e in evol]
    hov = ["Arranque"] + [f"{'UNI' if e['eq'] == 'UNI' else 'Rival'}: {e['como']} · "
                          f"{'1°' if e['periodo'] == 'PT' else '2°'} tiempo" for e in evol]
    fig = go.Figure()
    for nombre, ys, color in (("Rival", r, RIVAL), ("UNI", u, UNI)):
        fig.add_scatter(x=x, y=ys, name=nombre, mode="lines+markers", line=dict(color=color, width=3, shape="hv"),
                        marker=dict(size=7, color=color), customdata=hov,
                        hovertemplate="%{customdata}<br>" + nombre + " %{y}<extra></extra>")
    medio = next((i for i, e in enumerate(evol) if e["periodo"] == "ST"), None)
    if medio is not None and medio > 0:
        fig.add_vline(x=medio + .5, line=dict(color=APAGADO, width=1, dash="dot"),
                      annotation=dict(text="Entretiempo", font=dict(size=11, color=APAGADO)),
                      annotation_position="top")
    fig.update_layout(xaxis=dict(title="Anotaciones, en orden", showgrid=False, dtick=1),
                      yaxis=dict(title="Puntos", rangemode="tozero"),
                      legend=dict(y=1.02, yanchor="bottom", x=0, traceorder="reversed"), margin=dict(t=34))
    grafico(fig, alto)


def chances_22(etiquetas, chances, concretadas, alto=None):
    """Un renglón por partido: la barra clara son las chances y la llena,
    las que terminaron en puntos. El texto dice 'X de Y'."""
    fig = go.Figure([
        go.Bar(y=etiquetas, x=chances, name="Chances", orientation="h", marker_color="rgba(26,111,212,.32)",
               hovertemplate="%{y}<br>Chances: %{x}<extra></extra>"),
        go.Bar(y=etiquetas, x=concretadas, name="Concretadas", orientation="h", marker_color=ACENTO,
               width=.45, hovertemplate="%{y}<br>Concretadas: %{x}<extra></extra>")])
    fig.add_scatter(x=chances, y=etiquetas, mode="text", textposition="middle right", cliponaxis=False,
                    text=[f"  {c} de {n} · {pct(c, n)}%" for c, n in zip(concretadas, chances)],
                    textfont=dict(family="DM Mono, monospace", size=12, color=APAGADO),
                    hoverinfo="skip", showlegend=False)
    fig.update_layout(barmode="overlay", bargap=.3, yaxis=dict(autorange="reversed", showgrid=False),
                      xaxis=dict(range=[0, max([*chances, 1]) * 1.45]),
                      legend=dict(y=1.02, yanchor="bottom", x=0), margin=dict(t=34))
    grafico(fig, alto or 90 + 30 * len(etiquetas))
