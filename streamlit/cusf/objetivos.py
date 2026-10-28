"""Los objetivos que se pone el equipo, y si se cumplieron en cada partido.

Cada objetivo mide un partido y devuelve (a, b):
- con b: "a de b" (ej. 8 de 9 lines propios ganados);
- con b = None: una cantidad (ej. 7 penales).
Si el partido no tiene el dato, devuelve None: "sin datos", que no es
"no cumplido".
"""

# Minutos que el equipo juega con uno menos por cada tarjeta. Amarilla: 10
# (sin-bin). Roja: 20, como la roja de 20 minutos de World Rugby (después
# entra un reemplazo); una roja definitiva deja uno menos hasta el final.
MIN_AMARILLA, MIN_ROJA = 10, 20


def penales(p, lado="uni"):
    return sum(f[lado] for f in p["penales"])


def minutos_con_uno_menos(tj, lado="u"):
    return tj["am_" + lado] * MIN_AMARILLA + tj["ro_" + lado] * MIN_ROJA


def _de(a, b):
    """'a de b'; sin datos si no hubo ninguno (0 de 0 no se puede medir)."""
    return (a, b) if a is not None and b else None


def _chances(p):
    e = p.get("efectividad_22")
    return _de(e["concretadas"], e["chances"]) if e else None


OBJETIVOS = [
    {"nombre": "Line propio", "meta": "Ganar el 100% de los lines propios",
     "medir": lambda p: _de(p["line"]["uGan"], p["line"]["uLan"]),
     "cumple": lambda a, b: a == b},
    {"nombre": "Scrum propio", "meta": "Ganar el 100% de los scrums propios",
     "medir": lambda p: _de(p["scrum"]["uGan"], p["scrum"]["uLan"]),
     "cumple": lambda a, b: a == b},
    {"nombre": "Salidas del rival", "meta": "Quedarse con el 100% de las salidas que patea el rival",
     "medir": lambda p: _de(p["salida"]["uRec"], p["salida"]["rPro"]),
     "cumple": lambda a, b: a == b},
    {"nombre": "Chances en 22", "meta": "Convertir en puntos el 60% de las chances en 22",
     "medir": _chances,
     "cumple": lambda a, b: a * 100 >= 60 * b},
    {"nombre": "Penales: menos de la mitad", "meta": "Cometer menos de la mitad de los penales del partido",
     "medir": lambda p: _de(penales(p), penales(p) + penales(p, "rival")),
     "cumple": lambda a, b: a * 2 < b},
    {"nombre": "Penales: menos de 10", "meta": "Cometer menos de 10 penales por partido",
     "medir": lambda p: (penales(p), None),
     "cumple": lambda a, b: a < 10},
    {"nombre": "Tarjetas: ninguna", "meta": "0 tarjetas por partido",
     "medir": lambda p: (p["tarjetas"]["am_u"] + p["tarjetas"]["ro_u"], None),
     "cumple": lambda a, b: a == 0},
]


def evaluar(obj, p):
    """{'a', 'b', 'cumple'} del partido, o None si no tiene el dato."""
    m = obj["medir"](p)
    if m is None:
        return None
    a, b = m
    return {"a": a, "b": b, "cumple": obj["cumple"](a, b)}


def temporada(obj, partidos):
    """La temporada de un objetivo: la suma de los partidos que tienen el
    dato (a, b, cuántos son) y en cuántos se cumplió."""
    ev = [e for e in (evaluar(obj, p) for p in partidos) if e]
    con_b = all(e["b"] is not None for e in ev)
    return {"a": sum(e["a"] for e in ev), "b": sum(e["b"] for e in ev) if ev and con_b else None,
            "medidos": len(ev), "cumplidos": sum(1 for e in ev if e["cumple"]),
            "sin_datos": len(partidos) - len(ev)}
