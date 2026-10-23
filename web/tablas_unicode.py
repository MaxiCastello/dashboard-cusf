"""Arma sitio/js/unicode.js: las letras que el Python del tablero (3.13,
Unicode 15.1) y el navegador (Unicode 16 o más nuevo) ven distinto, para
que python.js las trate como Python.

- NUEVAS: las que para Python todavía no existen (categoría Cn: sin
  mayúscula ni minúscula, no son cifras ni marcas, repr() las escapa) y
  para Node sí. Un navegador más viejo que Node conoce menos: igual da bien.
- DIGITOS: las que str.isdigit() acepta y no son cifras decimales ("²",
  "①"): int() de Python se cae con ellas.

Se corre de nuevo sólo si cambia la versión de Python del tablero.
Uso (desde web/): python tablas_unicode.py
"""
import json
import os
import subprocess
import sys
import unicodedata

AQUI = os.path.dirname(os.path.abspath(__file__))
SALIDA = os.path.join(AQUI, "sitio", "js", "unicode.js")
TODAS = [i for i in range(0x110000) if not 0xD800 <= i <= 0xDFFF]


def rangos(cps):
    out = []
    for c in cps:
        if out and out[-1][1] == c - 1:
            out[-1][1] = c
        else:
            out.append([c, c])
    return out


def clase(rs):
    h = lambda c: f"\\u{{{c:x}}}"  # noqa: E731
    return "".join(h(a) if a == b else f"{h(a)}-{h(b)}" for a, b in rs)


sin_asignar = [i for i in TODAS if unicodedata.category(chr(i)) == "Cn"]
# cuáles de ésas conoce Node (lo que no es \p{Cn} para la versión de Unicode de Node)
js = "const xs = JSON.parse(require('fs').readFileSync(0, 'utf8'));" \
     "process.stdout.write(JSON.stringify(xs.filter((c) => /\\P{Cn}/u.test(String.fromCodePoint(c)))));"
nuevas = json.loads(subprocess.run(["node", "-e", js], input=json.dumps(sin_asignar), capture_output=True,
                                   text=True, check=True).stdout)
digitos = [i for i in TODAS if chr(i).isdigit() and not chr(i).isdecimal()]
node = subprocess.run(["node", "-p", "process.versions.unicode"], capture_output=True, text=True, check=True).stdout.strip()

with open(SALIDA, "w", encoding="utf-8", newline="\n") as f:
    f.write(f"// GENERADO por web/tablas_unicode.py (Python {sys.version.split()[0]}, Unicode "
            f"{unicodedata.unidata_version}; Node con Unicode {node}): no editar a mano.\n"
            "// Las letras que Python todavía no conoce y el navegador sí.\n"
            f"export const NUEVAS = \"{clase(rangos(nuevas))}\";\n"
            "// Las que str.isdigit() acepta y no son decimales (int() de Python se cae).\n"
            f"export const DIGITOS = \"{clase(rangos(digitos))}\";\n")
print(f"{SALIDA}: {len(nuevas)} letras nuevas, {len(digitos)} dígitos no decimales")
