"""Las cuentas del tablero.

Un partido de Uni-Dat llega como la lista de eventos que guardó la app.
Estas funciones son las MISMAS reglas que index.html de Uni-Dat
(computeScrumStats, resultadoLine/computeLineStats, whoWonSalida,
computeSalidaStats, computeKnockOnStats, computePeriodStats y el RESUMEN del
CSV), traducidas a Python. Si se cambia una regla en Uni-Dat hay que
cambiarla acá también; la prueba `comparar_con_unidat.py` corre las dos
versiones sobre los mismos partidos y avisa si dejan de coincidir.

Todos los partidos (de Uni-Dat, cargados a mano o de la planilla 2025)
terminan en el mismo diccionario, el que arma `partido_vacio()`.
"""

import re

# ── El partido ───────────────────────────────────────────────────────────────

def _cero_fp():
    """Formación (line/scrum): lanzados, ganados, perdidos y recuperados de
    cada lado. Recuperados = None cuando no se sabe (carga manual, 2025)."""
    return {"uLan": 0, "uGan": 0, "uPer": 0, "uRec": 0,
            "rLan": 0, "rGan": 0, "rPer": 0, "rRec": 0}


def _cero_sal():
    return {"uPro": 0, "uGan": 0, "uPer": 0, "uRec": 0,
            "rPro": 0, "rGan": 0, "rPer": 0, "rRec": 0}


PUNTOS_CAMPOS = ("tries_u", "tries_r", "triesp_u", "triesp_r",
                 "conv_u", "convt_u", "conv_r", "convt_r",
                 "palos_u", "palost_u", "palos_r", "palost_r",
                 "drop_u", "dropt_u", "drop_r", "dropt_r")


def partido_vacio():
    return {
        "id": "", "fuente": "", "rival": "", "categoria": "", "fecha": None,
        "score_uni": 0, "score_rival": 0,
        "puntos": {k: 0 for k in PUNTOS_CAMPOS},
        "scrum": _cero_fp(), "line": _cero_fp(),
        "salida": _cero_sal(), "salida22": _cero_sal(), "salida_ingoal": _cero_sal(),
        # [{situacion, motivo, uni, rival}]
        "penales": [],
        "tarjetas": {"am_u": 0, "ro_u": 0, "am_r": 0, "ro_r": 0},
        "knockons": None,          # {uni, rival}
        "efectividad_22": None,    # {chances, concretadas}
        # [{dorsal, nombre, pos, neu, neg, err, pt, pt_err, st, st_err}]
        "tackles": [],
        "periodos": None,          # {"PT": {...}, "ST": {...}}
        "line_tabla": None,        # {"jugadores|zona": [ganados, tirados]}
        "tries_origen": None,      # {origen: [uni, rival]}
        "marcador": None,          # [{periodo, u, r, eq, como}] anotación por anotación
    }


# ── Reglas de Uni-Dat ────────────────────────────────────────────────────────

def _d(e):
    return e.get("data") or {}


def scrum_stats(eventos):
    """computeScrumStats(): razona por quién se quedó con la pelota."""
    s = _cero_fp()
    for x in eventos:
        if x.get("tipo") != "SCRUM":
            continue
        gan, eq = _d(x).get("ganador"), _d(x).get("equipo")
        if eq == "UNI":
            s["uLan"] += 1
        else:
            s["rLan"] += 1
        if gan == "UNI":
            if eq == "UNI":
                s["uGan"] += 1
            else:
                s["uRec"] += 1; s["rPer"] += 1
        elif gan == "RIVAL":
            if eq == "RIVAL":
                s["rGan"] += 1
            else:
                s["rRec"] += 1; s["uPer"] += 1
        elif eq == "UNI":
            s["uPer"] += 1
        else:
            s["rPer"] += 1
    return s


def lanzo_line(l):
    return "UNI" if _d(l).get("equipo") == "UNI" else "RIVAL"


def resultado_line(l):
    """resultadoLine(): 'UNI', 'RIVAL' o None (sin dueño limpio)."""
    eq = lanzo_line(l)
    otro = "RIVAL" if eq == "UNI" else "UNI"
    fin, gan = _d(l).get("fin"), _d(l).get("ganador")
    if fin in ("GANADA", "FREE KICK", "INFRACCIÓN", "PENAL", "KNOCK-ON") and gan:
        return eq if gan == eq else otro
    if fin == "TORCIDA":
        return otro
    return None


def line_stats(eventos):
    s = _cero_fp()
    for l in eventos:
        if l.get("tipo") != "LINE":
            continue
        r = resultado_line(l)
        if lanzo_line(l) == "UNI":
            s["uLan"] += 1
            if r == "UNI":
                s["uGan"] += 1
            elif r == "RIVAL":
                s["uPer"] += 1; s["rRec"] += 1
            else:
                s["uPer"] += 1
        else:
            s["rLan"] += 1
            if r == "RIVAL":
                s["rGan"] += 1
            elif r == "UNI":
                s["rPer"] += 1; s["uRec"] += 1
            else:
                s["rPer"] += 1
    return s


def line_tabla(eventos):
    """Lines de UNI por cantidad de jugadores y posición (lineTablaHTML):
    {"7|2": [ganados, tirados]}. Lo cargado sin dato va a S/D."""
    t = {}
    for l in eventos:
        if l.get("tipo") != "LINE" or lanzo_line(l) != "UNI":
            continue
        try:
            n = int(_d(l).get("jugadores") or 0)
        except (TypeError, ValueError):
            n = 0
        j = str(n) if n > 0 else "S/D"
        m = re.match(r"^([123])", str(_d(l).get("zona") or ""))
        k = j + "|" + (m.group(1) if m else "S/D")
        c = t.setdefault(k, [0, 0])
        c[1] += 1
        if resultado_line(l) == "UNI":
            c[0] += 1
    return t


def quien_gano_salida(s):
    """whoWonSalida()."""
    d = _d(s)
    fin = d.get("fin")
    if fin == "GANADA":
        return d.get("ganador") or None
    if fin == "KNOCK-ON":
        return "RIVAL" if d.get("knockOn") == "UNI" else "UNI"
    if fin in ("SALE DIRECTO", "NO PASA LAS 10"):
        return "RIVAL" if d.get("equipo") == "UNI" else "UNI"
    return None


def salida_stats(eventos, sub_tipo):
    sal = [e for e in eventos if e.get("tipo") == "SALIDA" and _d(e).get("subTipo") == sub_tipo]
    uni = [s for s in sal if _d(s).get("equipo") == "UNI"]
    riv = [s for s in sal if _d(s).get("equipo") == "RIVAL"]
    u_gan = sum(1 for s in uni if quien_gano_salida(s) == "UNI")
    r_gan = sum(1 for s in riv if quien_gano_salida(s) == "RIVAL")
    return {"uPro": len(uni), "uGan": u_gan, "uPer": len(uni) - u_gan,
            "uRec": sum(1 for s in riv if quien_gano_salida(s) == "UNI"),
            "rPro": len(riv), "rGan": r_gan, "rPer": len(riv) - r_gan,
            "rRec": sum(1 for s in uni if quien_gano_salida(s) == "RIVAL")}


def knockon_stats(eventos):
    """computeKnockOnStats(): detectados en scrum/salida/line + manuales."""
    def n(pred):
        return sum(1 for e in eventos if pred(e))
    uni = (n(lambda e: e.get("tipo") == "SCRUM" and _d(e).get("origen") == "KNOCK-ON" and _d(e).get("equipo") == "RIVAL")
           + n(lambda e: e.get("tipo") in ("SALIDA", "LINE") and _d(e).get("fin") == "KNOCK-ON" and _d(e).get("knockOn") == "UNI")
           + n(lambda e: e.get("tipo") == "KNOCKON" and e.get("equipo") == "UNI"))
    riv = (n(lambda e: e.get("tipo") == "SCRUM" and _d(e).get("origen") == "KNOCK-ON" and _d(e).get("equipo") == "UNI")
           + n(lambda e: e.get("tipo") in ("SALIDA", "LINE") and _d(e).get("fin") == "KNOCK-ON" and _d(e).get("knockOn") == "RIVAL")
           + n(lambda e: e.get("tipo") == "KNOCKON" and e.get("equipo") == "RIVAL"))
    return {"uni": uni, "rival": riv}


def puntos_stats(eventos):
    """Lo mismo que el RESUMEN del CSV de Uni-Dat (TRIES y PATADAS)."""
    def n(tipo, eq, ok=None, campo="resultado"):
        return sum(1 for e in eventos if e.get("tipo") == tipo and e.get("equipo") == eq
                   and (ok is None or _d(e).get(campo) == ok))
    p = {}
    for lado, eq in (("u", "UNI"), ("r", "RIVAL")):
        p["tries_" + lado] = n("TRY", eq)
        p["triesp_" + lado] = n("TRY PENAL", eq)
        p["conv_" + lado] = n("TRY", eq, "SI", "conversion")
        p["convt_" + lado] = n("TRY", eq)
        p["palos_" + lado] = n("PALOS", eq, "SI")
        p["palost_" + lado] = n("PALOS", eq)
        p["drop_" + lado] = n("DROP", eq, "SI")
        p["dropt_" + lado] = n("DROP", eq)
    return p


# Penales: Uni-Dat guarda en data.tipo qué fue y en data.subTipo el motivo
# de ruck, scrum y line. Para el tablero se agrupan en situaciones (las
# mismas de la planilla 2025) y el motivo es el texto de la app.
SITUACIONES = ("Scrum", "Line", "Ruck", "Maul", "Juego")


def situacion_penal(data):
    tipo = (data.get("tipo") or "OTRO").upper()
    sub = data.get("subTipo")
    if tipo == "PENAL EN SCRUM":
        return "Scrum", _motivo(sub)
    if tipo == "PENAL EN LINE":
        return "Line", _motivo(sub)
    if tipo == "RUCK":
        return "Ruck", _motivo(sub)
    if tipo == "MAUL":
        return "Maul", "Maul"
    if tipo == "PENAL POR TRY PENAL":
        return "Juego", "Try penal"
    return "Juego", _motivo(tipo)


def _motivo(txt):
    txt = texto(txt)
    if not txt or txt == "—":
        return "Sin motivo"
    return txt[0].upper() + txt[1:].lower()


def penales_stats(eventos):
    filas = {}
    for e in eventos:
        if e.get("tipo") != "PENAL":
            continue
        sit, mot = situacion_penal(_d(e))
        f = filas.setdefault((sit, mot), {"situacion": sit, "motivo": mot, "uni": 0, "rival": 0})
        f["uni" if e.get("equipo") == "UNI" else "rival"] += 1
    return list(filas.values())


def tarjetas_stats(eventos):
    def n(eq, color):
        return sum(1 for e in eventos if e.get("tipo") == "TARJETA" and e.get("equipo") == eq
                   and _d(e).get("color") == color)
    return {"am_u": n("UNI", "AMARILLA"), "ro_u": n("UNI", "ROJA"),
            "am_r": n("RIVAL", "AMARILLA"), "ro_r": n("RIVAL", "ROJA")}


def tries_origen(eventos):
    """updateTryOrigenStats(): try normal + try penal, por origen."""
    t = {}
    for e in eventos:
        if e.get("tipo") in ("TRY", "TRY PENAL"):
            o = texto(_d(e).get("origen")) or "OTRO"
            t.setdefault(o, [0, 0])[0 if e.get("equipo") == "UNI" else 1] += 1
    return t


def periodo_stats(eventos, p):
    """computePeriodStats(p) + line/scrum ganados del período."""
    ev = [e for e in eventos if e.get("periodo") == p]
    def n(pred):
        return sum(1 for e in ev if pred(e))
    s = {}
    for lado, eq in (("u", "UNI"), ("r", "RIVAL")):
        s["pts_" + lado] = sum(e.get("puntos") or 0 for e in ev if e.get("equipo") == eq)
        s["tries_" + lado] = n(lambda e: e.get("tipo") in ("TRY", "TRY PENAL") and e.get("equipo") == eq)
        s["pen_" + lado] = n(lambda e: e.get("tipo") == "PENAL" and e.get("equipo") == eq)
        s["tar_" + lado] = n(lambda e: e.get("tipo") == "TARJETA" and e.get("equipo") == eq)
    ko = knockon_stats(ev)
    s["ko_u"], s["ko_r"] = ko["uni"], ko["rival"]
    s["line"] = line_stats(ev)
    s["scrum"] = scrum_stats(ev)
    s["salida"] = salida_stats(ev, "SALIDA")
    return s


def marcador_evolucion(eventos):
    """El marcador después de cada anotación, en el orden en que se cargaron
    (Uni-Dat no guarda minutos). Usa los puntos de cada evento, igual que
    computePeriodStats."""
    como = {"TRY": "try", "TRY PENAL": "try penal", "PALOS": "penal a los palos", "DROP": "drop"}
    u = r = 0
    out = []
    for e in eventos:
        pts = e.get("puntos") or 0
        if not pts or e.get("equipo") not in ("UNI", "RIVAL"):
            continue
        if e["equipo"] == "UNI":
            u += pts
        else:
            r += pts
        c = como.get(e.get("tipo"), "puntos")
        if e.get("tipo") == "TRY" and pts == 7:
            c = "try convertido"
        out.append({"periodo": e.get("periodo"), "u": u, "r": r, "eq": e["equipo"], "como": c})
    return out


# ── Tackles (Tackle Tracker) ─────────────────────────────────────────────────

_TIPO_TK = {"positivo": "pos", "neutral": "neu", "negativo": "neg", "errado": "err"}


def tackles_desde_registros(registros, plantilla=None):
    """Registros [{tiempo, jugador, nombre, tipo}] -> una fila por jugador.
    El nombre es el que quedó anotado en el tackle; si falta, el de la
    plantilla. Efectividad del Tackle Tracker: (total - errados) / total."""
    plantilla = plantilla or {}
    filas = {}
    for r in registros or []:
        tipo = _TIPO_TK.get(str(r.get("tipo", "")).strip().lower())
        if not tipo:
            continue
        dorsal = str(r.get("jugador", "")).strip()
        dorsal = texto(dorsal, 4)
        nombre = texto(r.get("nombre") or plantilla.get(dorsal))
        f = filas.setdefault((dorsal, nombre), {
            "dorsal": dorsal, "nombre": nombre or ("#" + dorsal),
            "pos": 0, "neu": 0, "neg": 0, "err": 0,
            "pt": 0, "pt_err": 0, "st": 0, "st_err": 0})
        f[tipo] += 1
        mitad = "st" if str(r.get("tiempo", "")).lower().startswith("segundo") else "pt"
        f[mitad] += 1
        if tipo == "err":
            f[mitad + "_err"] += 1
    return list(filas.values())


def leer_csv_tackles(texto):
    """CSV del Tackle Tracker (nuevo o viejo) -> registros + plantilla.
    Sólo se leen las secciones PLANTILLA y el log de tackles."""
    import csv
    import io
    plantilla, registros, seccion = {}, [], None
    for celdas in csv.reader(io.StringIO(texto.lstrip("﻿"))):
        primero = celdas[0].strip() if celdas else ""
        if primero in ("PLANTILLA", "PARTIDO"):
            seccion = primero; continue
        if primero in ("RESUMEN POR JUGADOR", "TARJETAS", "SUSTITUCIONES"):
            seccion = None; continue
        if primero == "Tiempo" and len(celdas) >= 4:
            seccion = "registros"; continue
        if not primero or primero in ("Dorsal", "Rival"):
            continue
        if seccion == "PLANTILLA" and len(celdas) > 1 and celdas[1].strip():
            plantilla[primero] = celdas[1].strip()
        elif seccion == "registros" and len(celdas) >= 4:
            registros.append({"tiempo": primero, "jugador": celdas[1].strip(),
                              "nombre": celdas[2].strip(), "tipo": celdas[3].strip()})
    return registros, plantilla


# ── Armar partidos ───────────────────────────────────────────────────────────

def texto(x, largo=60):
    """Texto que viene de la base o de un CSV, listo para mostrar: sin < >
    (los gráficos interpretan algunas etiquetas HTML) y con un largo máximo."""
    return " ".join(str(x or "").replace("<", "").replace(">", "").split())[:largo]


def _entero(x):
    try:
        return int(x)
    except (TypeError, ValueError):
        return 0


def desde_unidat(fila):
    """Una fila de la tabla partidos de Uni-Dat -> partido del tablero."""
    main = fila.get("main") or {}
    ev = [e for e in (main.get("eventos") or []) if isinstance(e, dict)]
    p = partido_vacio()
    p.update({
        "id": fila.get("id", ""), "fuente": "unidat",
        "rival": texto(fila.get("rival") or main.get("rivalName")) or "Rival",
        "categoria": texto(fila.get("categoria") or main.get("categoria")),
        "fecha": fila.get("fecha"),
        "score_uni": _entero(fila.get("score_uni")), "score_rival": _entero(fila.get("score_rival")),
        "puntos": puntos_stats(ev),
        "scrum": scrum_stats(ev), "line": line_stats(ev),
        "salida": salida_stats(ev, "SALIDA"), "salida22": salida_stats(ev, "SALIDA DE 22"),
        "salida_ingoal": salida_stats(ev, "SALIDA INGOAL"),
        "penales": penales_stats(ev), "tarjetas": tarjetas_stats(ev),
        "knockons": knockon_stats(ev),
        "periodos": {"PT": periodo_stats(ev, "PT"), "ST": periodo_stats(ev, "ST")},
        "line_tabla": line_tabla(ev), "tries_origen": tries_origen(ev),
        "marcador": marcador_evolucion(ev),
    })
    tk = fila.get("tackles") or {}
    ses = tk.get("session") or {}
    if isinstance(ses, dict) and ses.get("registros"):
        jug = tk.get("jugadores") if isinstance(tk.get("jugadores"), dict) else {}
        p["tackles"] = tackles_desde_registros(ses["registros"], jug)
        # los convocados (dorsal -> nombre): cuentan como PJ aunque no tacklearan
        p["plantel"] = {texto(str(d), 4): texto(n) for d, n in jug.items() if texto(n)}
    return p


def desde_manual(fila):
    """Un partido cargado a mano en el tablero (tabla partidos_manuales).
    `datos` tiene la misma forma que partido_vacio() en las claves que se
    cargaron; lo que falta queda en cero."""
    p = partido_vacio()
    d = fila.get("datos") or {}
    p.update({"id": fila.get("id", ""), "fuente": "manual",
              "rival": texto(fila.get("rival")) or "Rival",
              "categoria": texto(fila.get("categoria")),
              "fecha": fila.get("fecha"),
              "score_uni": _entero(fila.get("score_uni")),
              "score_rival": _entero(fila.get("score_rival"))})
    for clave in ("puntos", "scrum", "line", "salida", "salida22", "tarjetas"):
        if isinstance(d.get(clave), dict):
            p[clave].update({k: _entero(v) for k, v in d[clave].items() if k in p[clave]})
    for clave in ("scrum", "line", "salida", "salida22"):
        # a mano no se cargan las recuperadas: no se sabe, no es cero
        if not isinstance(d.get(clave), dict) or "uRec" not in d[clave]:
            p[clave]["uRec"] = p[clave]["rRec"] = None
    if isinstance(d.get("penales"), list):
        p["penales"] = [{"situacion": texto(f.get("situacion")) or "Juego", "motivo": texto(f.get("motivo")),
                         "uni": _entero(f.get("uni")), "rival": _entero(f.get("rival"))}
                        for f in d["penales"] if isinstance(f, dict)]
    p["efectividad_22"] = _ef22(d.get("efectividad_22"))
    if isinstance(d.get("tackles_registros"), list):
        p["tackles"] = tackles_desde_registros(d["tackles_registros"])
    return p


def tarjetas_corregidas(x):
    """Tarjetas corregidas a mano en el complemento de un partido de Uni-Dat:
    las cuatro cantidades, o None si no se corrigieron."""
    if not isinstance(x, dict):
        return None
    return {k: max(0, _entero(x.get(k))) for k in ("am_u", "ro_u", "am_r", "ro_r")}


def _ef22(x):
    if not isinstance(x, dict):
        return None
    ch, co = _entero(x.get("chances")), _entero(x.get("concretadas"))
    return {"chances": ch, "concretadas": co} if ch or co else None


# ── Sumar partidos ───────────────────────────────────────────────────────────

def _sumar_dicts(dicts):
    out = {}
    for k in dicts[0]:
        vals = [d.get(k) for d in dicts]
        out[k] = None if any(v is None for v in vals) else sum(vals)
    return out


def sumar(partidos):
    """Total de una lista de partidos con la misma forma que un partido."""
    t = partido_vacio()
    if not partidos:
        return t
    t["score_uni"] = sum(p["score_uni"] for p in partidos)
    t["score_rival"] = sum(p["score_rival"] for p in partidos)
    for clave in ("puntos", "scrum", "line", "salida", "salida22", "salida_ingoal", "tarjetas"):
        t[clave] = _sumar_dicts([p[clave] for p in partidos])
    pen = {}
    for p in partidos:
        for f in p["penales"]:
            g = pen.setdefault((f["situacion"], f["motivo"]), dict(f, uni=0, rival=0))
            g["uni"] += f["uni"]; g["rival"] += f["rival"]
    t["penales"] = list(pen.values())
    kos = [p["knockons"] for p in partidos if p["knockons"]]
    t["knockons"] = _sumar_dicts(kos) if kos else None
    efs = [p["efectividad_22"] for p in partidos if p["efectividad_22"]]
    t["efectividad_22"] = _sumar_dicts(efs) if efs else None
    return t


# Nombres mal escritos -> el correcto (la clave, sin tildes ni mayúsculas).
# 2025: en las planillas de la Fecha 14 y 15 (los Excel tienen fórmulas y
# guardarlos desde Python les borra los valores). 2026: en la plantilla del
# Tackle Tracker.
NOMBRES_CORREGIDOS = {"santiago hothan": "Santiago Hotham", "julian felitas": "Julian Fleitas",
                      "alvaro otteo": "Alvaro Oteo", "nahuel gonzales": "Nahuel Gonzalez"}


def tackles_temporada(partidos):
    """Tackles por jugador sumando partidos. El jugador se reconoce por el
    nombre (sin tildes ni mayúsculas): el dorsal cambia de un partido a otro.
    PJ = partidos en la lista del Tackle Tracker, aunque no haya tackleado
    (la planilla 2025 y el plantel de Uni-Dat listan a los convocados; de un
    partido cargado a mano sólo se conocen los que tacklearon). Titular =
    camiseta 1 a 15 en ese partido; suplente = 16 en adelante; sin número,
    ninguno de los dos."""
    import unicodedata
    def clave(n):
        n = unicodedata.normalize("NFD", " ".join(str(n).split()).lower())
        return "".join(c for c in n if unicodedata.category(c) != "Mn")
    out = {}
    for p in partidos:
        vistos = set()
        # los del plantel que no tienen fila de tackles, con todo en cero (el
        # dorsal manda: así no se duplica si el nombre se anotó distinto)
        con_fila = {f["dorsal"] for f in p["tackles"]}
        sin_tk = [{"dorsal": d, "nombre": n, "pos": 0, "neu": 0, "neg": 0, "err": 0}
                  for d, n in (p.get("plantel") or {}).items() if d not in con_fila]
        for f in p["tackles"] + sin_tk:
            nombre = NOMBRES_CORREGIDOS.get(clave(f["nombre"]), f["nombre"])
            k = clave(nombre)
            g = out.setdefault(k, {"nombre": _mayusculas(nombre), "pj": 0, "tit": 0, "sup": 0,
                                   "pos": 0, "neu": 0, "neg": 0, "err": 0})
            for c in ("pos", "neu", "neg", "err"):
                g[c] += f[c]
            if k not in vistos:
                g["pj"] += 1; vistos.add(k)
                d = str(f.get("dorsal", "")).strip()
                if d.isdigit() and int(d) >= 1:
                    g["tit" if int(d) <= 15 else "sup"] += 1
    return list(out.values())


def pj_texto(j):
    """'13 (10 titular - 3 suplente)'; si a algún partido le falta el número
    de camiseta, sólo los PJ (los de adentro no sumarían el total)."""
    if j["tit"] + j["sup"] != j["pj"]:
        return str(j["pj"])
    return f"{j['pj']} ({j['tit']} titular - {j['sup']} suplente)"


def _mayusculas(nombre):
    """'Federico bruzzone' -> 'Federico Bruzzone'. Sólo sube la primera letra
    de cada palabra: no toca el resto ('McLean', 'Dal Molin' quedan igual)."""
    return " ".join(p[:1].upper() + p[1:] for p in str(nombre).split())


def resultado(p):
    """'G', 'P' o 'E' a partir del tanteo (no se carga a mano)."""
    return "G" if p["score_uni"] > p["score_rival"] else "P" if p["score_uni"] < p["score_rival"] else "E"
