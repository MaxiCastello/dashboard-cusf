"""Pasa la planilla 2025 (data/2025/*.xlsx) a sitio/js/planilla2025.js, con
el mismo Python del tablero (streamlit/cusf/fuente.temporada_planilla): así la
temporada 2025 de la página es la misma, número por número, sin leer Excel
en el navegador. Es un módulo de JS y no un .json para que cargue con el
resto de la página (la CSP sólo deja pedir datos a Supabase).

La planilla ya no cambia: esto se corre una vez. Si se corre de nuevo, el
archivo tiene que salir idéntico (lo mira tests/calculos.test.js contra la
referencia).

Uso (desde la carpeta web/): python exportar_2025.py
"""
import json
import math
import re
import os
import sys

AQUI = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(os.path.dirname(AQUI), "streamlit"))

from cusf import fuente  # noqa: E402

SALIDA = os.path.join(AQUI, "sitio", "js", "planilla2025.js")


def revisar(x, donde="planilla"):
    """Sólo tipos de JSON (un tipo de numpy, un NaN o un infinito cortan)."""
    if isinstance(x, dict):
        for k, v in x.items():
            if not isinstance(k, str):
                raise SystemExit(f"{donde}: clave que no es texto: {k!r}")
            # JS pone primero las claves que parecen números: el orden ya no sería el de Python
            if re.fullmatch(r"0|[1-9][0-9]*", k):
                raise SystemExit(f"{donde}: clave que parece número ({k!r}): JS la cambiaría de lugar")
            revisar(v, f"{donde}.{k}")
    elif isinstance(x, list):
        for i, v in enumerate(x):
            revisar(v, f"{donde}[{i}]")
    elif isinstance(x, float) and not math.isfinite(x):
        raise SystemExit(f"{donde}: número inválido {x!r}")
    elif not (x is None or type(x) in (str, int, float, bool)):
        raise SystemExit(f"{donde}: tipo inesperado {type(x)}: {x!r}")


t = fuente.temporada_planilla()
revisar(t)
cuerpo = json.dumps(t, ensure_ascii=True, separators=(",", ":"), allow_nan=False)
with open(SALIDA, "w", encoding="utf-8", newline="\n") as f:
    f.write("// GENERADO por web/exportar_2025.py desde data/2025/*.xlsx: no editar a mano.\n"
            "// La temporada 2025 tal como la arma streamlit/cusf/fuente.temporada_planilla().\n"
            f"export const PLANILLA_2025 = {cuerpo};\n")
print(f"{SALIDA}: {len(t['partidos'])} partidos, {os.path.getsize(SALIDA)} bytes")
