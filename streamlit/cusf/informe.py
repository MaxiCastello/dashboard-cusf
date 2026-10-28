"""Informe PDF de la temporada o de un partido.

Sólo tablas (reportlab puro): no necesita Chrome ni kaleido para sacar
imágenes de los gráficos, que era lo que más se rompía al publicar.
"""

import io
from datetime import date
from html import escape

from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.platypus import Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle

from . import calculos as C
from .estilo import xdey

AZUL = colors.HexColor("#1a6fd4")


def _dec(x):
    """Un decimal con coma, como en la pantalla: 35,9."""
    return f"{x:.1f}".replace(".", ",")


def _tabla(filas, anchos=None):
    # Las celdas de Table se dibujan como texto plano (no se interpretan).
    t = Table(filas, colWidths=anchos, repeatRows=1, hAlign="LEFT")
    t.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), AZUL), ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
        ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"), ("FONTSIZE", (0, 0), (-1, -1), 8.5),
        ("ALIGN", (1, 0), (-1, -1), "RIGHT"), ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, colors.HexColor("#eef3fb")]),
        ("LINEBELOW", (0, 0), (-1, -1), 0.25, colors.HexColor("#c8d3e6")),
        ("TOPPADDING", (0, 0), (-1, -1), 3), ("BOTTOMPADDING", (0, 0), (-1, -1), 3)]))
    return t


def generar(titulo, t, etiqueta):
    """t: temporada (ver vistas). Devuelve los bytes del PDF."""
    buf = io.BytesIO()
    doc = SimpleDocTemplate(buf, pagesize=A4, leftMargin=36, rightMargin=36, topMargin=36,
                            bottomMargin=36, title=titulo, author="Club Universitario de Santa Fe")
    S = getSampleStyleSheet()
    H1 = ParagraphStyle("h1", parent=S["Heading1"], textColor=AZUL, fontSize=17)
    H2 = ParagraphStyle("h2", parent=S["Heading2"], fontSize=12.5, spaceBefore=12, spaceAfter=5)
    P = ParagraphStyle("p", parent=S["BodyText"], fontSize=9, leading=12)
    ps, tot, n = t["partidos"], t["totales"], max(t["n_partidos"], 1)
    h = []
    h.append(Paragraph(escape(titulo), H1))
    h.append(Paragraph(f"Generado el {date.today():%d/%m/%Y} desde el tablero del club.", P))

    h.append(Paragraph("Resumen", H2))
    filas = [["", "UNI", "Rival"],
             ["Puntos", tot["score_uni"], tot["score_rival"]],
             ["Promedio por partido", _dec(tot['score_uni'] / n), _dec(tot['score_rival'] / n)]]
    if not t["planilla"] and len(ps) > 1:
        r = [C.resultado(p) for p in ps]
        filas.append(["Ganados / empatados / perdidos", f"{r.count('G')} / {r.count('E')} / {r.count('P')}", ""])
    h.append(_tabla(filas, [220, 120, 120]))

    if not t["planilla"] and len(ps) > 1:
        h.append(Paragraph("Partidos", H2))
        h.append(_tabla([["Partido", "Resultado", "Line propio", "Scrum propio", "Penales UNI"]] + [
            [etiqueta(p, True), f"{C.resultado(p)} {p['score_uni']}-{p['score_rival']}",
             xdey(p["line"]["uGan"], p["line"]["uLan"]), xdey(p["scrum"]["uGan"], p["scrum"]["uLan"]),
             sum(f["uni"] for f in p["penales"])] for p in ps], [150, 70, 95, 95, 65]))

    pt = tot["puntos"]
    h.append(Paragraph("Puntos y pateo", H2))
    h.append(_tabla([["", "UNI", "Rival"],
                     ["Tries (+ tries penales)", f"{pt['tries_u']} (+{pt['triesp_u']})", f"{pt['tries_r']} (+{pt['triesp_r']})"],
                     ["Conversiones", xdey(pt["conv_u"], pt["convt_u"]), xdey(pt["conv_r"], pt["convt_r"])],
                     ["Penales a los palos", xdey(pt["palos_u"], pt["palost_u"]), xdey(pt["palos_r"], pt["palost_r"])],
                     ["Drops", xdey(pt["drop_u"], pt["dropt_u"]), xdey(pt["drop_r"], pt["dropt_r"])]],
                    [220, 120, 120]))
    if tot.get("efectividad_22"):
        e = tot["efectividad_22"]
        h.append(Paragraph(f"Chances en 22 rival concretadas: {xdey(e['concretadas'], e['chances'])}.", P))

    h.append(Paragraph("Formaciones (propias ganadas)", H2))
    filas = [["", "UNI", "Rival"]]
    for nombre, k, a, b in (("Line", "line", "Gan", "Lan"), ("Scrum", "scrum", "Gan", "Lan"),
                            ("Salidas", "salida", "Gan", "Pro"), ("Salidas de 22", "salida22", "Gan", "Pro")):
        f = tot[k]
        filas.append([nombre, xdey(f["u" + a], f["u" + b]), xdey(f["r" + a], f["r" + b])])
    h.append(_tabla(filas, [220, 120, 120]))

    pen = tot["penales"]
    if pen:
        h.append(Paragraph("Penales", H2))
        pu, pr = sum(f["uni"] for f in pen), sum(f["rival"] for f in pen)
        h.append(Paragraph(f"UNI cometió {pu} ({_dec(pu / n)} por partido); el rival, {pr}.", P))
        top = sorted(pen, key=lambda f: -f["uni"])[:12]
        h.append(_tabla([["Motivo", "Situación", "UNI", "Rival"]] +
                        [[f["motivo"], f["situacion"], f["uni"], f["rival"]] for f in top],
                        [190, 110, 80, 80]))

    jug = C.tackles_temporada(ps)
    if jug:
        h.append(Paragraph("Tackles por jugador", H2))
        jug.sort(key=lambda j: -(j["pos"] + j["neu"] + j["neg"]))
        filas = [["Jugador", "PJ", "Hechos", "Errados", "Completados", "Pos.", "Neu.", "Neg."]]
        for j in jug:
            hechos = j["pos"] + j["neu"] + j["neg"]
            filas.append([j["nombre"], C.pj_texto(j), hechos, j["err"], xdey(hechos, hechos + j["err"]),
                          j["pos"], j["neu"], j["neg"]])
        h.append(_tabla(filas, [118, 118, 42, 42, 85, 36, 36, 36]))
    h.append(Spacer(1, 8))
    doc.build(h)
    return buf.getvalue()
