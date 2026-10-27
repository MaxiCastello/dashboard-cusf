"""Arma sitio/js/pdf-recursos.js: las letras y el escudo del informe PDF
(fase 6), listos para jsPDF.

- jsPDF necesita las letras en TTF y de un solo peso. Las del tablero son
  woff2 de Google Fonts partidas en dos (latín y latín extendido) y DM Sans
  es variable: acá se fija cada peso, se juntan las dos partes en una letra
  y se guarda en base64. Son DM Sans (400 y 700), Bebas Neue y DM Mono
  (400), con la licencia OFL y sin nombre reservado: se pueden
  recortar y meter en un documento (Source Sans no: ver LICENCIAS.txt).
- Qué letras tiene cada una (para no escribir en el PDF una que la letra no
  tiene: jsPDF no busca otra, la deja en blanco o pone cualquier cosa).
- El escudo, achicado (en el PDF se ve de ~2 cm).

Es un módulo de JS y no archivos aparte: la CSP sólo deja pedir datos a
Supabase. La página lo carga recién al armar un PDF.
Se corre una vez; si se corre de nuevo, sale idéntico.

Uso (desde la carpeta web/): python letras_pdf.py
"""
import base64
import io
import json
import os

from fontTools.merge import Merger
from fontTools.ttLib import TTFont
from fontTools.varLib.instancer import instantiateVariableFont
from PIL import Image

AQUI = os.path.dirname(os.path.abspath(__file__))
LETRAS = os.path.join(AQUI, "sitio", "fonts")
SALIDA = os.path.join(AQUI, "sitio", "js", "pdf-recursos.js")
ESCUDO = os.path.join(AQUI, "sitio", "img", "escudo.png")

# nombre en el PDF: (las dos partes de Google Fonts, latín primero; peso si es variable)
FUENTES = {
    "DMSans": (["dmsans-40fe3c.woff2", "dmsans-e5bab1.woff2"], 400),
    "DMSans-Bold": (["dmsans-40fe3c.woff2", "dmsans-e5bab1.woff2"], 700),
    "Bebas": (["bebasneue-3c5f3a.woff2", "bebasneue-6524f8.woff2"], None),
    "DMMono": (["dmmono-7e5f82.woff2", "dmmono-1cb063.woff2"], None),
}


def ttf(partes, peso):
    """Las partes juntas en una sola letra TTF, con el peso fijo."""
    archivos = []
    for parte in partes:
        f = TTFont(os.path.join(LETRAS, parte))
        if peso is not None:
            f = instantiateVariableFont(f, {"wght": peso}, updateFontNames=False)
        f.flavor = None
        # el merger necesita las mismas tablas en todas las partes (y no sabe juntar las de variable)
        for t in ("STAT", "fvar", "gvar", "avar", "HVAR", "MVAR", "DSIG"):
            if t in f:
                del f[t]
        b = io.BytesIO()
        f.save(b)
        archivos.append(b)
    for b in archivos:
        b.seek(0)
    junta = Merger().merge(archivos)
    # que salga idéntico cada vez: las fechas de la letra original, no la de hoy
    junta.recalcTimestamp = False
    original = TTFont(os.path.join(LETRAS, partes[0]))["head"]
    junta["head"].created, junta["head"].modified = original.created, original.modified
    b = io.BytesIO()
    junta.save(b)
    return b.getvalue(), sorted(junta.getBestCmap())


def rangos(cps):
    """[[desde, hasta], ...] de los códigos que tiene la letra."""
    out = []
    for c in cps:
        if out and c == out[-1][1] + 1:
            out[-1][1] = c
        else:
            out.append([c, c])
    return out


letras, tiene = {}, {}
for nombre, (partes, peso) in FUENTES.items():
    datos, cps = ttf(partes, peso)
    letras[nombre] = base64.b64encode(datos).decode()
    tiene[nombre] = rangos(cps)
    print(f"{nombre}: {len(datos) // 1024} KB, {len(cps)} letras")

img = Image.open(ESCUDO).convert("RGBA")
img.thumbnail((240, 240), Image.LANCZOS)
b = io.BytesIO()
img.save(b, "PNG", optimize=True)
escudo = {"png": base64.b64encode(b.getvalue()).decode(), "ancho": img.width, "alto": img.height}
print(f"escudo: {img.width}x{img.height}, {len(b.getvalue()) // 1024} KB")

with open(SALIDA, "w", encoding="utf-8", newline="\n") as f:
    f.write("// GENERADO por web/letras_pdf.py: no editar a mano. Las letras (TTF en base64)\n"
            "// y el escudo del informe PDF, y qué letras tiene cada una.\n")
    f.write(f"export const LETRAS = {json.dumps(letras)};\n")
    f.write(f"export const TIENE = {json.dumps(tiene, separators=(',', ':'))};\n")
    f.write(f"export const ESCUDO = {json.dumps(escudo)};\n")
print(f"{SALIDA}: {os.path.getsize(SALIDA) // 1024} KB")
