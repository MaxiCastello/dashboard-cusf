"""De dónde salen los datos.

- 2026 en adelante: la base Supabase de Uni-Dat. Tabla `partidos` (lo que
  publica la app) y `partidos_manuales` (lo que se carga a mano en el
  tablero; ver dashboard-cusf.supabase.sql, fuera del repo).
- 2025: la planilla vieja (data/2025/*.xlsx), que sólo tiene totales de la
  temporada y los tackles de cada partido.

Leer no necesita usuario: la clave de abajo es la "publishable" de
Supabase, pública por diseño (la misma que trae Uni-Dat); lo que protege
los datos son los permisos de la base. Escribir sólo puede un admin con
su mail y contraseña de Uni-Dat.
"""

import glob
import os
import re
import sys
import time

import pandas as pd
import requests
import streamlit as st

from . import calculos as C

_URL = "https://yrxsqrfjqyoicohsfrrt.supabase.co"
_CLAVE = "sb_publishable_qmd1XRbPJ5Ej7i08ZUZq_g__Vn7_2PZ"
_TIEMPO = 15
ANIO_PLANILLA = 2025
_DATA = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "data")


class ErrorBase(Exception):
    """Algo falló hablando con Supabase. El mensaje es para mostrar; `codigo`
    es el estado HTTP (None si ni siquiera hubo respuesta) y `detalle`, el
    error_code de Supabase (ej. invalid_credentials). Nunca se muestran."""

    def __init__(self, msg, codigo=None, detalle=""):
        super().__init__(msg)
        self.codigo, self.detalle = codigo, detalle


def _conf():
    try:
        s = st.secrets.get("supabase", {})
        return s.get("url", _URL), s.get("clave", _CLAVE)
    except Exception:          # sin secrets.toml
        return _URL, _CLAVE


def _pedir(metodo, ruta, token=None, **kw):
    url, clave = _conf()
    cab = {"apikey": clave, "Authorization": "Bearer " + (token or clave)}
    cab.update(kw.pop("headers", {}))
    try:
        r = requests.request(metodo, url + ruta, headers=cab, timeout=_TIEMPO, **kw)
    except requests.RequestException:
        raise ErrorBase("No se pudo conectar con la base. Revisá la conexión y probá de nuevo.")
    if r.status_code < 400:
        return r
    try:
        j = r.json()
        detalle = str(j.get("error_code") or j.get("error") or j.get("code") or "") if isinstance(j, dict) else ""
        detalle = re.sub(r"[^\w.-]", "", detalle)[:40]     # es un código: se muestra al usuario
    except ValueError:
        detalle = ""
    if r.status_code in (401, 403):
        raise ErrorBase("La sesión venció o no tenés permiso. Volvé a ingresar.", r.status_code, detalle)
    if r.status_code == 404 and detalle == "PGRST205":
        raise ErrorBase("TABLA_MANUALES", 404, detalle)
    raise ErrorBase(f"La base rechazó el pedido ({r.status_code}).", r.status_code, detalle)


# ── Lectura (cacheada 5 minutos) ─────────────────────────────────────────────

@st.cache_data(ttl=300, show_spinner="Leyendo partidos…")
def _filas_unidat():
    # stats->main: los escudos (imágenes en base64) no hacen falta. Los borrados
    # ya los esconde la base a quien lee sin usuario; el filtro es por las dudas.
    return _pedir("GET", "/rest/v1/partidos?select=id,rival,categoria,fecha,score_uni,"
                         "score_rival,main:stats->main,tackles&borrado_en=is.null&order=fecha.asc").json()


@st.cache_data(ttl=300, show_spinner=False)
def _filas_manuales():
    try:
        return _pedir("GET", "/rest/v1/partidos_manuales?select=*&borrado_en=is.null&order=fecha.asc").json(), True
    except ErrorBase as e:
        if str(e) == "TABLA_MANUALES":     # todavía no se corrió el SQL
            return [], False
        raise


def recargar():
    _filas_unidat.clear()
    _filas_manuales.clear()


def partidos_base():
    """Todos los partidos de la base (Uni-Dat + manuales) ya armados.
    Devuelve (partidos, hay_tabla_manuales)."""
    unidat = [C.desde_unidat(f) for f in _filas_unidat()]
    manuales, hay_tabla = _filas_manuales()
    por_id = {p["id"]: p for p in unidat}
    sueltos = []
    for m in manuales:
        if m.get("partido_id"):
            p = por_id.get(m["partido_id"])
            if p:   # complemento: lo que Uni-Dat no registra
                p["efectividad_22"] = C._ef22((m.get("datos") or {}).get("efectividad_22"))
                p["complemento_id"] = m["id"]
        else:
            sueltos.append(C.desde_manual(m))
    todos = [p for p in unidat + sueltos if p["fecha"]]
    todos.sort(key=lambda p: p["fecha"])
    return todos, hay_tabla


def categoria_base(cat):
    """'Primera oro f3' -> 'Primera'. Uni-Dat guarda la categoría como texto
    libre; para filtrar alcanza con la primera palabra."""
    cat = (cat or "").strip()
    return cat.split()[0].capitalize() if cat else "Sin categoría"


# ── Planilla 2025 ────────────────────────────────────────────────────────────

@st.cache_data(show_spinner=False)
def temporada_planilla():
    """La temporada 2025 desde los Excel. Totales de la temporada + un
    partido por archivo de tackles (sólo con tackles)."""
    carpeta = os.path.join(_DATA, str(ANIO_PLANILLA))
    hojas = pd.read_excel(os.path.join(carpeta, "Estadistica.xlsx"), sheet_name=None)
    t = C.partido_vacio()

    pts = hojas["Puntos"].iloc[0]
    t["score_uni"], t["score_rival"] = int(pts["puntos_favor"]), int(pts["puntos_contra"])
    for lado, sfx in (("u", "favor"), ("r", "contra")):
        t["puntos"].update({
            "tries_" + lado: int(pts[f"tries_{sfx}"]),
            "conv_" + lado: int(pts[f"conv_{sfx}_m"]), "convt_" + lado: int(pts[f"conv_{sfx}_t"]),
            "palos_" + lado: int(pts[f"pen_{sfx}_m"]), "palost_" + lado: int(pts[f"pen_{sfx}_t"]),
            "drop_" + lado: int(pts[f"drops_{sfx}"]), "dropt_" + lado: int(pts[f"drops_{sfx}"])})

    def fp(nombre):
        r = hojas[nombre].iloc[0]
        r.index = r.index.str.strip().str.lower()
        # En la planilla todo está mirado desde UNI: "rival ganados" son los
        # lanzamientos del rival que ganó UNI (verificado: totales ganados =
        # propios ganados + rival ganados). Y como es ganado/perdido, todo lo
        # que pierde uno lo recupera el otro.
        ug, up = int(r["lanzamientos propios ganados"]), int(r["lanzamientos propios perdidos"])
        rg_uni, rp_uni = int(r["lanzamientos rival ganados"]), int(r["lanzamientos rival perdidos"])
        return {"uLan": int(r["lanzamientos propios"]), "uGan": ug, "uPer": up, "uRec": rg_uni,
                "rLan": int(r["lanzamientos rival"]), "rGan": rp_uni, "rPer": rg_uni, "rRec": up}
    t["line"], t["scrum"] = fp("Line"), fp("Scrum")

    def sal(nombre, pre):
        r = hojas[nombre].iloc[0]
        r.index = r.index.str.strip().str.lower()
        ug, up = int(r[f"{pre} propias ganadas"]), int(r[f"{pre} propias perdidas"])
        rg_uni, rp_uni = int(r[f"{pre} rival ganadas"]), int(r[f"{pre} rival perdidas"])
        return {"uPro": int(r[f"{pre} propias"]), "uGan": ug, "uPer": up, "uRec": rg_uni,
                "rPro": int(r[f"{pre} rival"]), "rGan": rp_uni, "rPer": rg_uni, "rRec": up}
    t["salida"], t["salida22"] = sal("Salidas", "salidas"), sal("Salidas de 22", "salidas 22")

    pen = hojas["Penales"]
    for _, r in pen.iterrows():
        sit = str(r["Situacion"]).strip()
        if sit.lower().startswith(("total", "penales")):
            continue
        mot = r["Motivo"] if isinstance(r["Motivo"], str) else sit
        t["penales"].append({"situacion": sit, "motivo": C._motivo(re.sub(r"\s*\(.*\)$", "", mot)),
                             "uni": int(r["Propios"]), "rival": int(r["Rival"])})

    ef = hojas["Efectividad 22"].iloc[:, :3]
    ef.columns = ["rival", "concretadas", "chances"]
    ef = ef.dropna()
    ef = ef[ef["rival"].str.lower() != "total"]
    serie = [{"rival": r.rival, "chances": int(r.chances), "concretadas": int(r.concretadas)}
             for r in ef.itertuples()]
    t["efectividad_22"] = {"chances": sum(x["chances"] for x in serie),
                           "concretadas": sum(x["concretadas"] for x in serie)}

    partidos = []
    for f in sorted(glob.glob(os.path.join(carpeta, "Tackles_*.xlsx")),
                    key=lambda f: (_nro_fecha(f), f)):
        res = pd.read_excel(f, sheet_name="Resumen")
        res.columns = res.columns.str.strip().str.lower()
        p = C.partido_vacio()
        p.update(id=os.path.basename(f), fuente="planilla", rival=_rival_archivo(f))
        p["fecha_txt"] = _fecha_archivo(f)
        for d in res.to_dict("records"):
            nombre = " ".join(str(d.get("nombre del jugador", "") or "").split())
            if not nombre or nombre.lower() == "nan":
                continue
            n = {k: _num(d.get(k)) for k in ("positivos", "neutrales", "negativos", "errados")}
            p["tackles"].append({"dorsal": str(d.get("jugador", "")), "nombre": nombre,
                                 "pos": n["positivos"], "neu": n["neutrales"],
                                 "neg": n["negativos"], "err": n["errados"],
                                 "pt": 0, "pt_err": 0, "st": 0, "st_err": 0})
        partidos.append(p)

    n = int(hojas["Info"].set_index("Variable").loc["cantidad_partidos", "Valor"])
    return {"anio": ANIO_PLANILLA, "partidos": partidos, "totales": t, "n_partidos": n,
            "planilla": True, "serie_22": serie}


def _num(x):
    v = pd.to_numeric(x, errors="coerce")
    return 0 if pd.isna(v) else int(v)


def _nro_fecha(f):
    m = re.search(r"Fecha(\d+)", f)
    return int(m.group(1)) if m else 99


def _fecha_archivo(f):
    m = re.search(r"Fecha(\w+?)_", os.path.basename(f))
    return ("Fecha " + m.group(1)) if m else ""


def _rival_archivo(f):
    base = os.path.splitext(os.path.basename(f))[0]
    return base.split("_")[-1] if "_" in base else base


# ── Armar una temporada ──────────────────────────────────────────────────────

def anios_disponibles(partidos):
    anios = {int(p["fecha"][:4]) for p in partidos}
    anios.discard(ANIO_PLANILLA)
    return sorted(anios | {ANIO_PLANILLA}, reverse=True)


def temporada(partidos, anio, categoria):
    """Los partidos de la base de un año y una categoría, con sus totales."""
    ps = [p for p in partidos if p["fecha"].startswith(str(anio))
          and categoria_base(p["categoria"]) == categoria]
    serie = [{"rival": p["rival"], **p["efectividad_22"]} for p in ps if p["efectividad_22"]]
    return {"anio": anio, "partidos": ps, "totales": C.sumar(ps), "n_partidos": len(ps),
            "planilla": False, "serie_22": serie}


# ── Escritura (sólo admins) ──────────────────────────────────────────────────

def _sesion(r):
    d = r.json()
    if not d.get("access_token"):
        raise ErrorBase("No se pudo ingresar. Probá de nuevo en un rato.")
    return {"token": d["access_token"], "refresh": d.get("refresh_token"),
            "vence": time.time() + int(d.get("expires_in") or 3600)}


def ingresar(email, clave):
    """Login con el usuario de Uni-Dat (igual que nube.js: el mail en
    minúsculas). Devuelve la sesión {token, refresh, vence} si es admin.
    Los mensajes no dicen si el mail existe."""
    email = (email or "").strip().lower()
    if not email or not clave:
        raise ErrorBase("Completá el mail y la contraseña. Si el navegador los completó solo, "
                        "hacé clic en cada casilla antes de INGRESAR.")
    try:
        r = _pedir("POST", "/auth/v1/token?grant_type=password", json={"email": email, "password": clave})
    except ErrorBase as e:
        if e.codigo == 429 or "rate" in e.detalle:
            raise ErrorBase("Demasiados intentos: esperá unos minutos.")
        if e.detalle in ("invalid_credentials", "invalid_grant"):
            raise ErrorBase("Mail o contraseña incorrectos.")
        if e.detalle == "email_not_confirmed":
            raise ErrorBase("Ese mail todavía no está confirmado en Supabase.")
        if e.codigo is None:
            raise                                   # sin conexión: el mensaje ya lo dice
        raise ErrorBase(f"No se pudo ingresar (error {e.codigo}). Probá de nuevo en un rato.")
    ses = _sesion(r)
    # La tabla admins sólo le deja ver a cada uno su propia fila: si vuelve una, es admin.
    try:
        es_admin = bool(_pedir("GET", "/rest/v1/admins?select=user_id", ses["token"]).json())
    except ErrorBase as e:
        print(f"ingresar: chequeo de admin {e.codigo} {e.detalle}", file=sys.stderr)
        raise ErrorBase(f"No se pudo comprobar si el usuario es admin (error {e.codigo or 'de conexión'}"
                        f"{' ' + e.detalle if e.detalle else ''}). Probá de nuevo en un rato.")
    if not es_admin:
        raise ErrorBase("Ese usuario no es admin.")
    return ses


def renovar(ses):
    """La sesión de Supabase dura 1 hora: antes de que venza se pide otra con
    el refresh token, así una carga larga no se pierde al guardar."""
    if ses.get("vence", 0) - time.time() > 300 or not ses.get("refresh"):
        return ses
    try:
        return _sesion(_pedir("POST", "/auth/v1/token?grant_type=refresh_token",
                              json={"refresh_token": ses["refresh"]}))
    except ErrorBase:
        raise ErrorBase("La sesión venció. Volvé a ingresar.")


_UUID = re.compile(r"^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$")


def _id_valido(x):
    # el id va en la URL: si no es un uuid, no se manda nada
    if not _UUID.match(str(x or "")):
        raise ErrorBase("Partido inválido.")
    return x


def guardar_manual(token, fila, id_existente=None):
    if id_existente:
        _id_valido(id_existente)
        _pedir("PATCH", f"/rest/v1/partidos_manuales?id=eq.{id_existente}", token, json=fila,
               headers={"Prefer": "return=minimal"})
    else:
        _pedir("POST", "/rest/v1/partidos_manuales", token, json=fila,
               headers={"Prefer": "return=minimal"})
    recargar()


def borrar_manual(token, id_fila):
    _id_valido(id_fila)
    from datetime import datetime, timezone
    _pedir("PATCH", f"/rest/v1/partidos_manuales?id=eq.{id_fila}", token,
           json={"borrado_en": datetime.now(timezone.utc).isoformat()},
           headers={"Prefer": "return=minimal"})
    recargar()


def filas_manuales_crudas():
    return _filas_manuales()[0]
