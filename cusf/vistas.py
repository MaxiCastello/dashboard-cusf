"""Las pantallas del tablero.

Cada sección recibe una "temporada" (los partidos elegidos y su total), así
la misma función sirve para la temporada entera y para un partido solo.
Criterio de los números: primero "X de Y" y después el porcentaje, sin
jerga y sin decir si estuvo bien o mal.
"""

import pandas as pd
import streamlit as st

from . import calculos as C
from . import graficos as G
from . import objetivos as O
from .estilo import (UNI, RIVAL, MAL, NEUTRO, ACENTO, AVISO, TK, TK_NOMBRE,
                     esc, pct, xdey, html, kpis, anillos, aclarar, tabla, nota)

MESES = ["", "ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"]
# Formas de anotar: el mismo color en la torta de UNI y en la del rival
FORMAS = [("Tries", 5, "tries", UNI), ("Tries penales", 7, "triesp", "#7be0a5"),
          ("Conversiones", 2, "conv", ACENTO), ("Penales a los palos", 3, "palos", "#9fb8ff"),
          ("Drops", 3, "drop", AVISO)]
SIT_COLOR = {"Scrum": ACENTO, "Line": "#9fb8ff", "Ruck": UNI, "Maul": "#7be0a5", "Juego": AVISO}


def etiqueta(p, corta=False):
    if p.get("fecha"):
        a, m, d = p["fecha"].split("-")
        f = f"{int(d)} {MESES[int(m)]}"
    else:
        f = p.get("fecha_txt", "")
    # la planilla 2025 no tiene el tanteo de cada partido: no se inventa un 0–0
    if corta or p.get("fuente") == "planilla":
        return f"{f} · {p['rival']}"
    return f"{f} · UNI {p['score_uni']}–{p['score_rival']} {p['rival']}"


def _ejex(ps):
    """Rótulos del eje de los gráficos: la fecha y el rival, en todos."""
    return [etiqueta(p, True) for p in ps]


def una(p, t):
    """Temporada de un solo partido (para reusar las secciones)."""
    return {"anio": t["anio"], "partidos": [p], "totales": C.sumar([p]) if not t["planilla"] else p,
            "n_partidos": 1, "planilla": t["planilla"],
            "serie_22": [{"rival": p["rival"], **p["efectividad_22"]}] if p.get("efectividad_22") else []}


def _pen(f, lado="uni"):
    return sum(x[lado] for x in f["penales"])


def _hechos(filas):
    return sum(j["pos"] + j["neu"] + j["neg"] for j in filas)


def _intentos(filas):
    return _hechos(filas) + sum(j["err"] for j in filas)


def _pateo(f):
    p = f["puntos"]
    return p["conv_u"] + p["palos_u"], p["convt_u"] + p["palost_u"]


# ── Encabezados ──────────────────────────────────────────────────────────────

def marcador(p):
    res = {"G": "Ganado", "P": "Perdido", "E": "Empatado"}[C.resultado(p)]
    origen = {"unidat": "Cargado en Uni-Dat", "manual": "Cargado a mano en el tablero",
              "planilla": "Planilla 2025 (sólo tackles)"}.get(p["fuente"], "")
    if p.get("tarjetas_unidat"):
        origen += " (tarjetas corregidas en el tablero)"
    cat = f" · {p['categoria']}" if p.get("categoria") else ""
    if p["fuente"] == "planilla":
        html(f'<div class="marcador"><div class="info">{esc(p.get("fecha_txt", ""))} · '
             f'{esc(p["rival"])}<br>{esc(origen)}</div></div>')
        return
    html(f'<div class="marcador"><div class="eq">UNI<div class="n" style="color:{UNI}">{p["score_uni"]}</div></div>'
         f'<div class="sep">–</div><div class="eq">{esc(p["rival"].upper())}'
         f'<div class="n" style="color:{RIVAL}">{p["score_rival"]}</div></div></div>'
         f'<div class="nota" style="text-align:center">{esc(etiqueta(p, True))}{esc(cat)} · {res} · {esc(origen)}</div>')


# ── Resumen de la temporada ──────────────────────────────────────────────────

def resumen(t):
    ps, tot, n = t["partidos"], t["totales"], t["n_partidos"]
    items = [(n, "Partidos", None)]
    if not t["planilla"]:
        r = [C.resultado(p) for p in ps]
        items.append((f"{r.count('G')}-{r.count('E')}-{r.count('P')}", "Ganó-empató-perdió", None))
    items += [(tot["score_uni"], "Puntos a favor", UNI), (tot["score_rival"], "Puntos en contra", RIVAL),
              (f"{tot['score_uni'] - tot['score_rival']:+d}", "Diferencia", None)]
    if n:
        items.append((f"{_pen(tot) / n:.1f}".replace(".", ","), "Penales UNI por partido", None))
    kpis(items)

    if not t["planilla"] and len(ps) > 1:
        c1, c2 = st.columns([1, 2], gap="large")
        with c1:
            st.markdown("### Resultados")
            r = [C.resultado(p) for p in ps]
            G.dona(["Ganados", "Empatados", "Perdidos"], [r.count("G"), r.count("E"), r.count("P")],
                   [UNI, NEUTRO, MAL], f"{r.count('G')}-{r.count('E')}-{r.count('P')}", "ganó-empató-perdió")
        with c2:
            st.markdown("### Partido a partido")
            G.pesas([etiqueta(p, True) for p in ps], [p["score_uni"] for p in ps], [p["score_rival"] for p in ps],
                    titulo_x="Puntos", textos=[f"   {p['score_uni']}–{p['score_rival']}" for p in ps])

    st.markdown("### UNI en números")
    a, b = _pateo(tot)
    items = [("Line propio ganado", tot["line"]["uGan"], tot["line"]["uLan"], UNI, None),
             ("Scrum propio ganado", tot["scrum"]["uGan"], tot["scrum"]["uLan"], UNI, None),
             ("Salidas propias ganadas", tot["salida"]["uGan"], tot["salida"]["uPro"], UNI, None),
             ("Pateo a los palos", a, b, ACENTO, None)]
    jug = C.tackles_temporada(ps)
    if jug:
        items.append(("Tackles completados", _hechos(jug), _intentos(jug), UNI, None))
    if tot.get("efectividad_22"):
        e = tot["efectividad_22"]
        items.append(("Chances en 22 concretadas", e["concretadas"], e["chances"], ACENTO, None))
    anillos(items)

    top = sorted([j for j in jug if _hechos([j])], key=lambda j: -_hechos([j]))[:8]
    if not t["planilla"] and len(ps) > 1:
        c1, c2 = st.columns(2, gap="large")
        with c1:
            st.markdown("### Puntos sumados en la temporada")
            G.acumulado(_ejex(ps), [p["score_uni"] for p in ps], [p["score_rival"] for p in ps])
        col = c2
    else:
        col = st.container()
    with col:
        if top:
            st.markdown("### Los que más tacklearon")
            G.piruletas([j["nombre"] for j in top], [j["pos"] + j["neu"] + j["neg"] for j in top])
            nota("Tackles hechos (positivos, neutrales y negativos).")


# ── Objetivos ────────────────────────────────────────────────────────────────

def _valor(e):
    """'8 de 9 · 89%' o la cantidad."""
    return xdey(e["a"], e["b"]) if e["b"] is not None else str(e["a"])


def _celda(e):
    if e is None:
        return '<td class="obj sd">sin datos</td>'
    marca, clase = ("✓", "ok") if e["cumple"] else ("✗", "no")
    return f'<td class="obj {clase}">{marca} {esc(_valor(e))}</td>'


def _cuadradito(e, p):
    """Un partido en la card: ✓ cumplido, ✗ no, vacío sin datos."""
    marca, clase = ("✓", "ok") if e and e["cumple"] else ("✗", "no") if e else ("", "sd")
    txt = f"{etiqueta(p, True)}: {_valor(e) if e else 'sin datos'}"
    return f'<span class="{clase}" title="{esc(txt)}">{marca}</span>'


def _card(nombre, meta, grande, chico, abajo, puntos="", clase=""):
    return (f'<div class="objc"><div class="n">{esc(nombre)}</div><div class="m">{esc(meta)}</div>'
            f'<div class="v {clase}">{esc(grande)}<small>{esc(chico)}</small></div>'
            f'{f"<div class=pts>{puntos}</div>" if puntos else ""}<div class="t">{esc(abajo)}</div></div>')


def objetivos(t):
    ps = t["partidos"]
    if t["planilla"]:
        nota("La planilla 2025 no tiene estos datos partido a partido: los objetivos se miden desde 2026.")
        return
    if not ps:
        return
    cards = []
    if len(ps) == 1:
        for o in O.OBJETIVOS:
            e = O.evaluar(o, ps[0])
            if e:
                cards.append(_card(o["nombre"], o["meta"], "✓ Sí" if e["cumple"] else "✗ No", "",
                                   f"En el partido: {_valor(e)}", clase="ok" if e["cumple"] else "no"))
            else:
                cards.append(_card(o["nombre"], o["meta"], "—", "sin datos", ""))
        html('<div class="objs">' + "".join(cards) + "</div>")
        return
    for o in O.OBJETIVOS:
        s = O.temporada(o, ps)
        if not s["medidos"]:
            temp = "Sin datos en ningún partido"
        elif s["b"] is not None:
            temp = f"Temporada: {xdey(s['a'], s['b'])}"
        else:
            temp = f"Temporada: {_coma(s['a'] / s['medidos'])} por partido"
        if s["sin_datos"] and s["medidos"]:
            temp += f" ({s['sin_datos']} sin datos)"
        puntos = "".join(_cuadradito(O.evaluar(o, p), p) for p in ps)
        grande = f"{s['cumplidos']} de {s['medidos']}" if s["medidos"] else "—"
        cards.append(_card(o["nombre"], o["meta"], grande, "partidos" if s["medidos"] else "", temp, puntos))

    st.markdown("### En cuántos partidos se cumplió cada objetivo")
    html('<div class="objs">' + "".join(cards) + "</div>")
    nota("Cada cuadradito es un partido, del primero al último: ✓ se cumplió, ✗ no, vacío si falta el dato. "
         "Temporada: la suma de los partidos que tienen el dato (en penales y tarjetas, el promedio por partido).")
    st.markdown("### Partido a partido")
    cab = "".join(f"<th>{esc(o['nombre'])}</th>" for o in O.OBJETIVOS)
    cuerpo = "".join(
        f"<tr><td>{esc(etiqueta(p, True))}</td>" + "".join(_celda(O.evaluar(o, p)) for o in O.OBJETIVOS) + "</tr>"
        for p in reversed(ps))
    html(f'<div class="tabla-scroll"><table class="t objetivos"><thead><tr><th>Partido</th>{cab}</tr></thead>'
         f"<tbody>{cuerpo}</tbody></table></div>")
    nota("Las chances en 22 se cargan a mano (Uni-Dat no las registra) y las salidas del rival que "
         "se quedó UNI sólo están en los partidos cargados en Uni-Dat: por eso a algunos les falta el dato.")


# ── Partido a partido ────────────────────────────────────────────────────────

def evolucion(t):
    ps = t["partidos"]
    if t["planilla"]:
        nota("De 2025 sólo hay totales de la temporada: no se puede ver partido a partido, "
             "salvo los tackles (pestaña TACKLES) y las chances en 22 (pestaña PUNTOS).")
        return
    if not ps:
        return
    filas = []
    for p in ps:
        filas.append([etiqueta(p, True), f"{C.resultado(p)} {p['score_uni']}–{p['score_rival']}",
                      xdey(p["line"]["uGan"], p["line"]["uLan"]), xdey(p["scrum"]["uGan"], p["scrum"]["uLan"]),
                      _pen(p), _intentos(p["tackles"]) or "—"])
    tabla(["Partido", "Resultado", "Line propio", "Scrum propio", "Penales UNI", "Tackles"], filas)
    if len(ps) < 2:
        return
    x, tot, n = _ejex(ps), t["totales"], len(ps)

    st.markdown("### Formaciones propias ganadas, partido a partido")
    # una pestaña por formación y el gráfico a todo el ancho: con muchos
    # partidos, tres gráficos lado a lado no dejan leer los rivales
    formas = (("Line", "line", "uLan"), ("Scrum", "scrum", "uLan"), ("Salidas", "salida", "uPro"))
    for pestana, (titulo, k, lan) in zip(st.tabs([f[0] for f in formas]), formas):
        rlan = "rLan" if lan == "uLan" else "rPro"
        with pestana:
            series = [(nombre, [pct(p[k][g], p[k][l]) if p[k][l] else None for p in ps], color,
                       [xdey(p[k][g], p[k][l]) for p in ps])
                      for nombre, g, l, color in (("UNI", "uGan", lan, UNI), ("Rival", "rGan", rlan, RIVAL))]
            f = tot[k]
            refs = [(pct(f["uGan"], f[lan]) if f[lan] else None, "UNI en la temporada", UNI)]
            if k != "salida":
                refs.append((100, "Objetivo: 100%", AVISO))
            G.lineas(x, series, alto=320, por_ciento=True, referencias=refs)
    nota("Arriba se elige Line, Scrum o Salidas. La línea punteada verde es UNI sumando toda la temporada; "
         "la amarilla, el objetivo. Pasá el dedo o el mouse por un punto para ver el X de Y.")

    c1, c2 = st.columns(2, gap="large")
    with c1:
        st.markdown("### Puntos por partido")
        G.lineas(x, [("UNI", [p["score_uni"] for p in ps], UNI, None),
                     ("Rival", [p["score_rival"] for p in ps], RIVAL, None)],
                 referencias=[(tot["score_uni"] / n, "Promedio UNI", UNI)])
    with c2:
        st.markdown("### Penales cometidos")
        G.lineas(x, [("UNI", [_pen(p) for p in ps], UNI, None),
                     ("Rival", [_pen(p, "rival") for p in ps], RIVAL, None)],
                 referencias=[(_pen(tot) / n, "Promedio UNI", UNI), (10, "Objetivo: menos de 10", AVISO)])
    con_tk = [p for p in ps if p["tackles"]]
    if len(con_tk) > 1:
        st.markdown("### Tackles completados, partido a partido")
        jug = C.tackles_temporada(ps)
        G.lineas(_ejex(con_tk), [("Completados", [pct(_hechos(p["tackles"]), _intentos(p["tackles"])) for p in con_tk],
                                  UNI, [xdey(_hechos(p["tackles"]), _intentos(p["tackles"])) for p in con_tk])],
                 alto=260, por_ciento=True,
                 referencias=[(pct(_hechos(jug), _intentos(jug)), "Temporada", UNI)])


def _chances_22(t):
    """Chances en 22 rival: el total y, si hay más de un partido, uno por renglón."""
    e = t["totales"].get("efectividad_22")
    if not e:
        return
    if t["planilla"]:
        filas = [(r["rival"], r["concretadas"], r["chances"]) for r in t["serie_22"]]
    else:
        filas = [(etiqueta(p, True), p["efectividad_22"]["concretadas"], p["efectividad_22"]["chances"])
                 for p in t["partidos"] if p.get("efectividad_22")]
    st.markdown("### Chances en 22 rival")
    c1, c2 = st.columns([1, 3], gap="large")
    with c1:
        anillos([("Concretadas", e["concretadas"], e["chances"], ACENTO, "UNI")], 1)
    with c2:
        if len(filas) > 1:
            G.chances_22([f[0] for f in filas], [f[2] for f in filas], [f[1] for f in filas])
    nota("Cuántas veces UNI entró en la 22 rival y cuántas de esas terminaron en puntos. "
         "Se carga a mano: Uni-Dat no registra las chances en 22.")


# ── Puntos ───────────────────────────────────────────────────────────────────

def puntos(t):
    tot = t["totales"]
    p = tot["puntos"]
    c1, c2 = st.columns(2, gap="large")
    for col, lado, quien in ((c1, "u", "UNI"), (c2, "r", "el rival")):
        vals = [p[k + "_" + lado] * v for _, v, k, _ in FORMAS]
        with col:
            st.markdown(f"### Cómo hizo los puntos {quien}")
            if any(vals):
                G.dona([n for n, *_ in FORMAS], vals, [c for *_, c in FORMAS], sum(vals), "puntos", alto=300)
            else:
                nota("Sin puntos.")
    nota("Puntos de cada forma de anotar: un try vale 5, un try penal 7, una conversión 2, un penal o un drop 3.")

    st.markdown("### Pateo a los palos")
    items = []
    for lado, quien, color in (("u", "UNI", UNI), ("r", "Rival", RIVAL)):
        items += [("Conversiones", p["conv_" + lado], p["convt_" + lado], color, quien),
                  ("Penales", p["palos_" + lado], p["palost_" + lado], color, quien)]
        if p["dropt_u"] or p["dropt_r"]:
            items.append(("Drops", p["drop_" + lado], p["dropt_" + lado], color, quien))
    anillos(items)

    orig = {}
    for q in t["partidos"]:
        for o, (u, r) in (q.get("tries_origen") or {}).items():
            orig.setdefault(o, [0, 0]); orig[o][0] += u; orig[o][1] += r
    if orig:
        c1, _ = st.columns([3, 2], gap="large")
        with c1:
            st.markdown("### De dónde salieron los tries")
            o = sorted(orig, key=lambda k: -(orig[k][0] + orig[k][1]))
            G.mariposa([k.capitalize() for k in o], [orig[k][0] for k in o], [orig[k][1] for k in o])
            nota("UNI a la izquierda, el rival a la derecha.")
    _chances_22(t)


# ── Formaciones ──────────────────────────────────────────────────────────────

def _anillos_fp(t, k, lan, rlan, rot_propio, rot_rec):
    """Ganados (todos los partidos) y recuperados (sólo los partidos que
    tienen ese dato: a uno cargado a mano le puede faltar)."""
    f = t["totales"][k]
    items = [(rot_propio, f["uGan"], f[lan], UNI, "UNI"), (rot_propio, f["rGan"], f[rlan], RIVAL, "Rival")]
    rec, sin = f, []
    if f["uRec"] is None:
        con = [p for p in t["partidos"] if p[k]["uRec"] is not None]
        sin = [p["rival"] for p in t["partidos"] if p[k]["uRec"] is None]
        rec = C.sumar(con)[k] if con else None
    if rec:
        items += [(rot_rec + " al rival", rec["uRec"], rec[rlan], UNI, "UNI"),
                  (rot_rec + " a UNI", rec["rRec"], rec[lan], RIVAL, "Rival")]
    anillos(items, 2 if len(items) == 4 else None)
    if rec and sin:
        nota(f"{rot_rec}: sin {', '.join(sin)} (cargado a mano sin ese dato).")


def formaciones(t):
    tot = t["totales"]
    c1, c2 = st.columns(2, gap="large")
    for col, titulo, k in ((c1, "Line", "line"), (c2, "Scrum", "scrum")):
        with col:
            st.markdown(f"### {titulo}")
            _anillos_fp(t, k, "uLan", "rLan", "Propios ganados", "Recuperados")
    salidas = [(n, k) for n, k in (("Salidas", "salida"), ("Salidas de 22", "salida22"),
                                   ("Salidas del ingoal", "salida_ingoal"))
               if tot[k]["uPro"] or tot[k]["rPro"]]
    if salidas:
        cols = st.columns(2, gap="large")
        for i, (nombre, k) in enumerate(salidas):
            with cols[i % 2]:
                st.markdown(f"### {nombre}")
                _anillos_fp(t, k, "uPro", "rPro", "Propias ganadas", "Recuperadas")

    # Line de UNI por cantidad de jugadores y posición (como en Uni-Dat)
    celdas = {}
    for p in t["partidos"]:
        for k, (g, n) in (p.get("line_tabla") or {}).items():
            c = celdas.setdefault(k, [0, 0]); c[0] += g; c[1] += n
    c1, c2 = st.columns([3, 2], gap="large")
    if celdas:
        orden = lambda xs: sorted(xs, key=lambda x: (x == "S/D", int(x) if x.isdigit() else 0))
        jug = orden({k.split("|")[0] for k in celdas})
        zon = orden({k.split("|")[1] for k in celdas})
        with c1:
            st.markdown("### Line de UNI: jugadores y posición")
            G.mapa_calor([f"{j} jugadores" if j != "S/D" else "S/D" for j in jug],
                         [f"{z}° posición" if z != "S/D" else "S/D" for z in zon],
                         [[celdas.get(f"{j}|{z}", (0, 0))[0] for z in zon] for j in jug],
                         [[celdas.get(f"{j}|{z}", (0, 0))[1] for z in zon] for j in jug])
            nota("Ganados de tirados en cada combinación; el color va del rojo (pocos) al verde (muchos). "
                 "Sólo partidos cargados en Uni-Dat.")
    if tot.get("knockons"):
        k = tot["knockons"]
        with c2 if celdas else st.container():
            st.markdown("### Knock-ons")
            G.dona(["UNI", "Rival"], [k["uni"], k["rival"]], [UNI, RIVAL], k["uni"] + k["rival"], "knock-ons",
                   alto=260)


# ── Penales ──────────────────────────────────────────────────────────────────

def penales(t):
    tot, n = t["totales"], max(t["n_partidos"], 1)
    pen = tot["penales"]
    pu, pr = _pen(tot), _pen(tot, "rival")
    items = [(pu, "Cometidos por UNI", UNI), (pr, "Cometidos por el rival", RIVAL)]
    if n > 1:
        items.insert(1, (f"{pu / n:.1f}".replace(".", ","), "UNI por partido", UNI))
    kpis(items)
    if not pen:
        nota("No hay penales cargados.")
    else:
        _penales_detalle(t, pen)
    _tarjetas(t)


def _coma(x):
    return f"{x:.1f}".replace(".", ",").replace(",0", "")


def _tarjetas(t):
    """Tarjetas y el tiempo jugado con uno menos (UNI y el rival)."""
    tj, ps, n = t["totales"]["tarjetas"], t["partidos"], max(t["n_partidos"], 1)
    mu, mr = O.minutos_con_uno_menos(tj, "u"), O.minutos_con_uno_menos(tj, "r")
    st.markdown("### Tarjetas")
    if t["planilla"]:   # sin el dato no es cero: no se muestran ceros
        nota("La planilla 2025 no tiene las tarjetas.")
        return
    items = [(tj["am_u"], "Amarillas UNI", AVISO), (tj["ro_u"], "Rojas UNI", MAL)]
    if n > 1:
        items.append((_coma((tj["am_u"] + tj["ro_u"]) / n), "Tarjetas UNI por partido", None))
    items += [(f"{mu}'", "Minutos UNI con uno menos", UNI), (f"{mr}'", "Minutos del rival con uno menos", RIVAL)]
    kpis(items)
    if len(ps) > 1 and any(O.minutos_con_uno_menos(p["tarjetas"], l) for p in ps for l in "ur"):
        def hov(p, l):
            a, r = p["tarjetas"]["am_" + l], p["tarjetas"]["ro_" + l]
            return f"{O.minutos_con_uno_menos(p['tarjetas'], l)} min · {a} amarilla(s), {r} roja(s)"
        st.markdown("### Minutos con uno menos, partido a partido")
        G.barras(_ejex(ps), [("UNI", [O.minutos_con_uno_menos(p["tarjetas"], "u") for p in ps], UNI,
                              [hov(p, "u") for p in ps]),
                             ("Rival", [O.minutos_con_uno_menos(p["tarjetas"], "r") for p in ps], RIVAL,
                              [hov(p, "r") for p in ps])],
                 titulo_y="Minutos", sufijo="'")
    nota(f"Cada amarilla son {O.MIN_AMARILLA} minutos afuera y cada roja {O.MIN_ROJA} "
         f"(la roja de 20 minutos: después entra un reemplazo; si la roja es definitiva, el equipo "
         f"sigue con uno menos hasta el final y acá igual se cuentan {O.MIN_ROJA}). "
         f"Objetivo: 0 tarjetas por partido.")


def _penales_detalle(t, pen):
    sits = {}
    for f in pen:
        s = sits.setdefault(f["situacion"], [0, 0]); s[0] += f["uni"]; s[1] += f["rival"]
    orden = sorted(sits, key=lambda s: -(sits[s][0] + sits[s][1]))
    c1, c2 = st.columns(2, gap="large")
    with c1:
        st.markdown("### Dónde se cometen")
        G.mariposa(orden, [sits[s][0] for s in orden], [sits[s][1] for s in orden])
        nota("UNI a la izquierda, el rival a la derecha.")
        con_per = [p for p in t["partidos"] if p.get("periodos")]
        if con_per:
            st.markdown("### Por tiempo")
            a = {(per, k): sum(p["periodos"][per][k] for p in con_per) for per in ("PT", "ST") for k in ("pen_u", "pen_r")}
            G.mariposa(["1° tiempo", "2° tiempo"], [a[("PT", "pen_u")], a[("ST", "pen_u")]],
                       [a[("PT", "pen_r")], a[("ST", "pen_r")]], alto=160)
            if len(con_per) < len(t["partidos"]):
                nota(f"Sólo los {len(con_per)} partidos cargados en Uni-Dat tienen el tiempo de cada penal.")
    with c2:
        st.markdown("### Los de UNI: situación y motivo")
        uni = [f for f in pen if f["uni"]]
        if uni:
            sit_u = {}
            for f in uni:
                sit_u[f["situacion"]] = sit_u.get(f["situacion"], 0) + f["uni"]
            etq, pad, val, col = [], [], [], []
            for s, v in sit_u.items():
                etq.append(s); pad.append(""); val.append(v); col.append(SIT_COLOR.get(s, NEUTRO))
            for f in uni:
                etq.append(f["motivo"]); pad.append(f["situacion"]); val.append(f["uni"])
                col.append(aclarar(SIT_COLOR.get(f["situacion"], NEUTRO)))
            G.sol(etq, pad, val, col)
            nota("Adentro, dónde; afuera, el motivo. Tocá una parte para abrirla.")
            mot = sorted(uni, key=lambda f: -f["uni"])[:10]
            with st.expander("Ver la lista de motivos"):
                tabla(["Motivo", "Situación", "UNI", "Rival"],
                      [[f["motivo"], f["situacion"], f["uni"], f["rival"]] for f in mot])


# ── Tackles ──────────────────────────────────────────────────────────────────

def tackles(t, partido=None):
    ps = [partido] if partido else t["partidos"]
    jug = C.tackles_temporada(ps)
    if not jug:
        nota("No hay tackles cargados para estos partidos.")
        return
    tipos = {k: sum(j[k] for j in jug) for k in ("pos", "neu", "neg", "err")}
    total, hechos = _intentos(jug), _hechos(jug)
    con_tk = sum(1 for p in ps if p["tackles"])
    items = [(total, "Intentos de tackle", None), (f"{hechos} de {total}", "Completados", UNI),
             (tipos["err"], "Errados", MAL)]
    if con_tk > 1:
        items.insert(1, (f"{total / con_tk:.0f}", "Intentos por partido", None))
    kpis(items)

    c1, c2 = st.columns(2, gap="large")
    with c1:
        st.markdown("### Cómo fueron")
        G.dona([TK_NOMBRE[k] for k in TK], [tipos[k] for k in TK], [TK[k] for k in TK],
               f"{pct(hechos, total)}%", f"completados · {hechos} de {total}", alto=300)
        nota("Un tackle negativo se completó igual; el único no completado es el errado "
             "(como en el Tackle Tracker).")
    with c2:
        mitades = partido and any(f["pt"] or f["st"] for f in partido["tackles"])
        if mitades:
            st.markdown("### Por tiempo")
            pt = sum(f["pt"] for f in partido["tackles"]); ptE = sum(f["pt_err"] for f in partido["tackles"])
            sg = sum(f["st"] for f in partido["tackles"]); sgE = sum(f["st_err"] for f in partido["tackles"])
            anillos([("Completados", pt - ptE, pt, UNI, "1° tiempo"), ("Completados", sg - sgE, sg, UNI, "2° tiempo")])
        top = sorted([j for j in jug if _hechos([j])], key=lambda j: -_hechos([j]))[:8]
        st.markdown("### Los que más tacklearon")
        G.piruletas([j["nombre"] for j in top], [j["pos"] + j["neu"] + j["neg"] for j in top])

    st.markdown("### Por jugador")
    intentaron = [j for j in jug if j["pos"] + j["neu"] + j["neg"] + j["err"]]
    orden = sorted(intentaron, key=lambda j: -(j["pos"] + j["neu"] + j["neg"] + j["err"]))[:18]
    G.apiladas([j["nombre"] for j in orden], [(TK_NOMBRE[k], [j[k] for j in orden], TK[k]) for k in TK])
    if len(jug) > len(orden):
        nota(f"Los {len(orden)} con más intentos; la tabla de abajo tiene a los {len(jug)}.")

    df = pd.DataFrame([{
        "Jugador": j["nombre"], "PJ": C.pj_texto(j),
        "Hechos": j["pos"] + j["neu"] + j["neg"], "Errados": j["err"],
        # sin intentos no hay porcentaje (queda vacío, no 0%)
        "Completados": pct(j["pos"] + j["neu"] + j["neg"], j["pos"] + j["neu"] + j["neg"] + j["err"])
        if j["pos"] + j["neu"] + j["neg"] + j["err"] else None,
        "Positivos": j["pos"], "Neutrales": j["neu"], "Negativos": j["neg"]} for j in jug])
    df = df.sort_values(["Hechos", "Completados"], ascending=False)
    cols = ["Jugador", "PJ", "Hechos", "Errados", "Completados", "Positivos", "Neutrales", "Negativos"]
    if partido:
        cols.remove("PJ")
    st.dataframe(df[cols], hide_index=True, width="stretch", height=min(38 + 35 * len(df), 740),
                 column_config={"PJ": st.column_config.TextColumn("PJ", width=210),
                                "Completados": st.column_config.ProgressColumn(
                     "Completados", format="%d%%", min_value=0, max_value=100)})
    if not partido:
        nota("PJ = partidos en los que estuvo en la lista del Tackle Tracker, aunque no haya tackleado. "
             "Titular: jugó con la camiseta 1 a 15 en ese partido; suplente: de la 16 en adelante.")


# ── Un partido ───────────────────────────────────────────────────────────────

def partido_resumen(p, t, tp):
    if p.get("marcador"):
        st.markdown("### Cómo se fue dando el marcador")
        G.marcador_en_el_partido(p["marcador"])
        nota("Cada paso es una anotación, en el orden en que se cargó (Uni-Dat no guarda los minutos).")
    if len(t["partidos"]) >= 2:
        contra_temporada(p, t)
    else:   # sin temporada para comparar: lo principal del partido
        formaciones(tp)


def tiempos(p):
    if not p.get("periodos"):
        nota("Este partido no tiene el detalle por tiempo (se cargó a mano o viene de la planilla).")
        return
    a, b = p["periodos"]["PT"], p["periodos"]["ST"]
    c1, c2 = st.columns(2, gap="large")
    with c1:
        st.markdown("### UNI")
        G.mariposa(["Puntos", "Tries", "Penales cometidos", "Knock-ons", "Tarjetas"],
                   [a["pts_u"], a["tries_u"], a["pen_u"], a["ko_u"], a["tar_u"]],
                   [b["pts_u"], b["tries_u"], b["pen_u"], b["ko_u"], b["tar_u"]],
                   nombres=("1° tiempo", "2° tiempo"), colores=(ACENTO, "#9fb8ff"))
    with c2:
        st.markdown("### Rival")
        G.mariposa(["Puntos", "Tries", "Penales cometidos", "Knock-ons", "Tarjetas"],
                   [a["pts_r"], a["tries_r"], a["pen_r"], a["ko_r"], a["tar_r"]],
                   [b["pts_r"], b["tries_r"], b["pen_r"], b["ko_r"], b["tar_r"]],
                   nombres=("1° tiempo", "2° tiempo"), colores=(ACENTO, "#9fb8ff"))
    nota("El 1° tiempo a la izquierda y el 2° a la derecha."
         + (" Las tarjetas por tiempo son las de Uni-Dat: el total del partido se corrigió en el tablero."
            if p.get("tarjetas_unidat") else ""))
    st.markdown("### Formaciones propias ganadas")
    items = []
    for s, per in ((a, "1° tiempo"), (b, "2° tiempo")):
        items += [("Line propio", s["line"]["uGan"], s["line"]["uLan"], UNI, f"{per} · UNI"),
                  ("Scrum propio", s["scrum"]["uGan"], s["scrum"]["uLan"], UNI, f"{per} · UNI"),
                  ("Salidas propias", s["salida"]["uGan"], s["salida"]["uPro"], UNI, f"{per} · UNI")]
    anillos(items)
    with st.expander("Ver también los del rival"):
        tabla(["", "1° T UNI", "1° T Rival", "2° T UNI", "2° T Rival"],
              [[n, xdey(a[k]["uGan"], a[k][l]), xdey(a[k]["rGan"], a[k][rl]),
                xdey(b[k]["uGan"], b[k][l]), xdey(b[k]["rGan"], b[k][rl])]
               for n, k, l, rl in (("Line", "line", "uLan", "rLan"), ("Scrum", "scrum", "uLan", "rLan"),
                                   ("Salidas", "salida", "uPro", "rPro"))])


def contra_temporada(p, t):
    """Este partido al lado de la temporada (sin juzgar)."""
    otros = t["partidos"]
    n = len(otros)
    tot = t["totales"]
    jug_t = C.tackles_temporada(otros)
    pa, pb = _pateo(p)
    ta, tb = _pateo(tot)
    ejes = [("Line propio", p["line"]["uGan"], p["line"]["uLan"], tot["line"]["uGan"], tot["line"]["uLan"]),
            ("Scrum propio", p["scrum"]["uGan"], p["scrum"]["uLan"], tot["scrum"]["uGan"], tot["scrum"]["uLan"]),
            ("Salidas propias", p["salida"]["uGan"], p["salida"]["uPro"], tot["salida"]["uGan"], tot["salida"]["uPro"]),
            ("Pateo a los palos", pa, pb, ta, tb),
            ("Tackles completados", _hechos(p["tackles"]), _intentos(p["tackles"]), _hechos(jug_t), _intentos(jug_t))]
    ejes = [e for e in ejes if e[2] and e[4]]
    c1, c2 = st.columns([1, 1], gap="large")
    with c1:
        st.markdown("### Este partido y la temporada")
        if len(ejes) >= 3:
            nombres = [e[0] for e in ejes]
            G.radar(nombres, [
                ("Temporada", [pct(e[3], e[4]) for e in ejes], "#8b93a3", "rgba(139,147,163,.15)",
                 [xdey(e[3], e[4]) for e in ejes]),
                ("Este partido", [pct(e[1], e[2]) for e in ejes], UNI, "rgba(0,200,83,.22)",
                 [xdey(e[1], e[2]) for e in ejes])])
            nota(f"Lo ganado de cada cosa, en %. La temporada suma sus {n} partidos.")
    with c2:
        def prom(v):
            return f"{v / n:.1f}".replace(".", ",")
        def x(f, g, l):
            return xdey(f[g], f[l])
        st.markdown("### En números")
        tabla(["", "Este partido", f"Temporada ({n})"],
              [["Puntos a favor", p["score_uni"], prom(tot["score_uni"])],
               ["Puntos en contra", p["score_rival"], prom(tot["score_rival"])],
               ["Line propio ganado", x(p["line"], "uGan", "uLan"), x(tot["line"], "uGan", "uLan")],
               ["Scrum propio ganado", x(p["scrum"], "uGan", "uLan"), x(tot["scrum"], "uGan", "uLan")],
               ["Salidas propias ganadas", x(p["salida"], "uGan", "uPro"), x(tot["salida"], "uGan", "uPro")],
               ["Pateo a los palos", xdey(pa, pb), xdey(ta, tb)],
               ["Penales cometidos por UNI", _pen(p), prom(_pen(tot))]])
        nota("En puntos y penales, la temporada es el promedio por partido; en el resto, la suma.")
