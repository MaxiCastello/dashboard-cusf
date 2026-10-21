"""Carga manual de partidos (sólo admins de Uni-Dat).

Para los partidos que no se cargaron en Uni-Dat (no hay CSV) y para sumarle
a un partido de Uni-Dat lo que la app no registra (chances en 22). El
permiso lo controla la base: el tablero sólo pasa el usuario que ingresó.
"""

import time
from datetime import date

import streamlit as st

from . import calculos as C
from . import fuente
from .estilo import nota
from .vistas import etiqueta

MAX_TXT, MAX_N = 60, 300
SIT = C.SITUACIONES


def pagina():
    st.markdown("## Cargar partido a mano")
    nota("Para los partidos que no se cargaron en Uni-Dat. Lo que se carga en Uni-Dat aparece solo "
         "en el tablero: no hace falta cargarlo acá.")
    try:
        partidos, hay_tabla = fuente.partidos_base()
    except fuente.ErrorBase as e:
        st.error(str(e)); return
    if not hay_tabla:
        st.warning("Falta crear la tabla de partidos manuales en Supabase: correr "
                   "dashboard-cusf.supabase.sql en el SQL Editor (está fuera del repo).")
        return
    if not st.session_state.get("sesion"):
        _ingresar(); return
    try:
        st.session_state["sesion"] = fuente.renovar(st.session_state["sesion"])
    except fuente.ErrorBase as e:
        st.session_state.pop("sesion", None)
        st.error(str(e)); _ingresar(); return
    if st.button("Salir", key="salir"):
        st.session_state.pop("sesion", None); st.rerun()
    if st.session_state.get("aviso"):          # lo que quedó de la última carga
        tipo, txt = st.session_state.pop("aviso")
        (st.success if tipo == "ok" else st.warning)(txt)

    accion = st.radio("Qué querés hacer", ["Partido nuevo", "Corregir o borrar", "Chances en 22 (Uni-Dat)"],
                      horizontal=True, key="accion")
    try:
        if accion == "Partido nuevo":
            _formulario(None)
        elif accion == "Corregir o borrar":
            _corregir()
        else:
            _complemento([p for p in partidos if p["fuente"] == "unidat"])
    except fuente.ErrorBase as e:
        if e.codigo in (401, 403):
            st.session_state.pop("sesion", None)
        st.error(str(e))


def _ingresar():
    intentos = [t for t in st.session_state.get("intentos", []) if time.time() - t < 600]
    st.session_state["intentos"] = intentos
    with st.form("login"):
        st.markdown("Ingresá con tu usuario de admin de Uni-Dat.")
        mail = st.text_input("Mail", max_chars=120)
        clave = st.text_input("Contraseña", type="password", max_chars=120)
        ok = st.form_submit_button("Ingresar", type="primary")
    if not ok:
        return
    if len(intentos) >= 5:
        st.error("Demasiados intentos. Esperá unos minutos."); return
    try:
        st.session_state["sesion"] = fuente.ingresar(mail, clave)
        st.session_state["intentos"] = []
        st.rerun()
    except fuente.ErrorBase as e:
        st.session_state["intentos"] = intentos + [time.time()]
        st.error(str(e))


def _token():
    return st.session_state["sesion"]["token"]


def _n(col, rotulo, valor, key):
    return int(col.number_input(rotulo, min_value=0, max_value=MAX_N, value=int(valor or 0), step=1, key=key))


def _formulario(fila):
    """fila = None para uno nuevo, o la fila de la base para corregirlo."""
    d = (fila or {}).get("datos") or {}
    # Un partido nuevo usa un formulario nuevo después de cada carga: así no
    # queda lleno y un segundo clic en GUARDAR no lo duplica.
    k = (fila or {}).get("id") or f"nuevo{st.session_state.get('cargados', 0) or ''}"
    pts, sc, li = d.get("puntos", {}), d.get("scrum", {}), d.get("line", {})
    sa, s22, tj = d.get("salida", {}), d.get("salida22", {}), d.get("tarjetas", {})
    pen = {f.get("situacion"): f for f in d.get("penales", [])}
    ef = d.get("efectividad_22") or {}
    with st.form(f"partido_{k}"):
        st.markdown("#### Partido")
        a, b = st.columns(2)
        rival = a.text_input("Rival", (fila or {}).get("rival", ""), max_chars=MAX_TXT, key=f"r{k}")
        cat = b.text_input("Categoría", (fila or {}).get("categoria", "Primera"), max_chars=MAX_TXT, key=f"c{k}")
        a, b, c = st.columns(3)
        try:
            f0 = date.fromisoformat((fila or {}).get("fecha") or "")
        except ValueError:
            f0 = date.today()
        fecha = a.date_input("Fecha", f0, format="DD/MM/YYYY", key=f"f{k}")
        su = _n(b, "Puntos UNI", (fila or {}).get("score_uni"), f"su{k}")
        sr = _n(c, "Puntos rival", (fila or {}).get("score_rival"), f"sr{k}")

        st.markdown("#### Cómo se hicieron los puntos")
        P = {}
        cols = st.columns(2)
        for col, lado, nombre in ((cols[0], "u", "UNI"), (cols[1], "r", "Rival")):
            col.markdown(f"**{nombre}**")
            for campo, rot in (("tries", "Tries"), ("triesp", "Tries penales"), ("conv", "Conversiones metidas"),
                               ("convt", "Conversiones pateadas"), ("palos", "Penales a los palos metidos"),
                               ("palost", "Penales a los palos pateados"), ("drop", "Drops metidos"),
                               ("dropt", "Drops pateados")):
                P[f"{campo}_{lado}"] = _n(col, rot, pts.get(f"{campo}_{lado}"), f"{campo}{lado}{k}")

        st.markdown("#### Formaciones (las que lanzó cada uno)")
        F = {}
        for titulo, clave, src, lan in (("Line", "line", li, "Lan"), ("Scrum", "scrum", sc, "Lan"),
                                        ("Salidas", "salida", sa, "Pro"), ("Salidas de 22", "salida22", s22, "Pro")):
            st.markdown(f"**{titulo}**")
            c1, c2, c3, c4 = st.columns(4)
            F[clave] = {f"u{lan}": _n(c1, "UNI lanzó", src.get(f"u{lan}"), f"{clave}ul{k}"),
                        "uGan": _n(c2, "UNI ganó", src.get("uGan"), f"{clave}ug{k}"),
                        f"r{lan}": _n(c3, "Rival lanzó", src.get(f"r{lan}"), f"{clave}rl{k}"),
                        "rGan": _n(c4, "Rival ganó", src.get("rGan"), f"{clave}rg{k}")}
            F[clave]["uPer"] = max(0, F[clave][f"u{lan}"] - F[clave]["uGan"])
            F[clave]["rPer"] = max(0, F[clave][f"r{lan}"] - F[clave]["rGan"])

        st.markdown("#### Penales cometidos")
        PEN = []
        cols = st.columns(len(SIT))
        for col, s in zip(cols, SIT):
            col.markdown(f"**{s}**")
            u = _n(col, "UNI", pen.get(s, {}).get("uni"), f"pu{s}{k}")
            r = _n(col, "Rival", pen.get(s, {}).get("rival"), f"pr{s}{k}")
            if u or r:
                PEN.append({"situacion": s, "motivo": "Sin detalle", "uni": u, "rival": r})

        st.markdown("#### Tarjetas y chances en 22")
        c1, c2, c3, c4, c5, c6 = st.columns(6)
        T = {"am_u": _n(c1, "Amarillas UNI", tj.get("am_u"), f"amu{k}"),
             "ro_u": _n(c2, "Rojas UNI", tj.get("ro_u"), f"rou{k}"),
             "am_r": _n(c3, "Amarillas rival", tj.get("am_r"), f"amr{k}"),
             "ro_r": _n(c4, "Rojas rival", tj.get("ro_r"), f"ror{k}")}
        E = {"chances": _n(c5, "Chances en 22", ef.get("chances"), f"ch{k}"),
             "concretadas": _n(c6, "Concretadas", ef.get("concretadas"), f"co{k}")}

        st.markdown("#### Tackles (opcional)")
        archivo = st.file_uploader("CSV del Tackle Tracker", type=["csv"], key=f"tk{k}")
        if d.get("tackles_registros"):
            nota(f"Ya tiene {len(d['tackles_registros'])} tackles cargados. Subí otro CSV sólo para reemplazarlos.")
        guardar = st.form_submit_button("Guardar partido", type="primary")

    if not guardar:
        return
    errores = []
    if not rival.strip():
        errores.append("Falta el rival.")
    for a_, b_, txt in (("conv_u", "convt_u", "conversiones de UNI"), ("conv_r", "convt_r", "conversiones del rival"),
                        ("palos_u", "palost_u", "penales a los palos de UNI"), ("palos_r", "palost_r", "penales a los palos del rival"),
                        ("drop_u", "dropt_u", "drops de UNI"), ("drop_r", "dropt_r", "drops del rival")):
        if P[a_] > P[b_]:
            errores.append(f"Hay más {txt} metidos que pateados.")
    for lado, quien in (("u", "UNI"), ("r", "el rival")):
        # sólo se patea una conversión después de un try (el try penal no se patea)
        if P["convt_" + lado] > P["tries_" + lado]:
            errores.append(f"Hay más conversiones pateadas que tries de {quien}.")
    for clave, f in F.items():
        lan = "Lan" if "uLan" in f else "Pro"
        if f["uGan"] > f["u" + lan] or f["rGan"] > f["r" + lan]:
            errores.append(f"En {clave.replace('salida22', 'salidas de 22')} hay más ganados que lanzados.")
    if E["concretadas"] > E["chances"]:
        errores.append("Hay más chances en 22 concretadas que chances.")
    registros = d.get("tackles_registros") or []
    if archivo is not None:
        try:
            registros, _ = C.leer_csv_tackles(archivo.getvalue().decode("utf-8-sig"))
        except UnicodeDecodeError:
            errores.append("El CSV de tackles no se pudo leer.")
            registros = []
        registros = [{"tiempo": r["tiempo"][:20], "jugador": r["jugador"][:3],
                      "nombre": r["nombre"][:MAX_TXT], "tipo": r["tipo"][:10]}
                     for r in registros if r["jugador"].isdigit()][:2000]
        if not registros:
            errores.append("El CSV no tiene tackles: ¿es el del Tackle Tracker?")
    if errores:
        for e in errores:
            st.error(e)
        return
    calc_u = P["tries_u"] * 5 + P["triesp_u"] * 7 + P["conv_u"] * 2 + (P["palos_u"] + P["drop_u"]) * 3
    calc_r = P["tries_r"] * 5 + P["triesp_r"] * 7 + P["conv_r"] * 2 + (P["palos_r"] + P["drop_r"]) * 3
    datos = {"puntos": P, **F, "penales": PEN, "tarjetas": T, "efectividad_22": E,
             "tackles_registros": registros}
    fuente.guardar_manual(_token(),
                          {"rival": rival.strip(), "categoria": cat.strip() or None, "fecha": fecha.isoformat(),
                           "score_uni": su, "score_rival": sr, "datos": datos},
                          (fila or {}).get("id"))
    txt = f"Guardado: UNI {su}–{sr} {rival.strip()}."
    if (calc_u, calc_r) != (su, sr):
        st.session_state["aviso"] = ("ojo", txt + f" Ojo: con tries y patadas da {calc_u}–{calc_r}, distinto del "
                                     f"tanteo cargado ({su}–{sr}). Se guardó igual; si fue un error, corregilo.")
    else:
        st.session_state["aviso"] = ("ok", txt)
    if not fila:
        st.session_state["cargados"] = st.session_state.get("cargados", 0) + 1
    st.rerun()


def _corregir():
    filas = [f for f in fuente.filas_manuales_crudas() if not f.get("partido_id") and not f.get("borrado_en")]
    if not filas:
        nota("Todavía no hay partidos cargados a mano."); return
    por_id = {f["id"]: f for f in filas}
    sel = st.selectbox("Partido", list(por_id), key="corregir_sel",
                       format_func=lambda i: etiqueta(C.desde_manual(por_id[i])))
    fila = por_id[sel]
    _formulario(fila)
    with st.expander("Borrar este partido"):
        nota("Se oculta enseguida y se elimina del todo a los 7 días (igual que en Uni-Dat). "
             "Hasta entonces se puede recuperar desde Supabase.")
        seguro = st.checkbox("Sí, quiero borrarlo", key=f"seguro{sel}")
        if st.button("Borrar", disabled=not seguro, key=f"borrar{sel}"):
            fuente.borrar_manual(_token(), sel)
            st.session_state["aviso"] = ("ok", "Borrado.")
            st.rerun()


def _complemento(unidat):
    nota("Uni-Dat no registra las chances en 22 rival: acá se le suman a un partido ya publicado.")
    if not unidat:
        nota("No hay partidos de Uni-Dat."); return
    por_id = {p["id"]: p for p in reversed(unidat)}
    sel = st.selectbox("Partido de Uni-Dat", list(por_id), format_func=lambda i: etiqueta(por_id[i]), key="comp_sel")
    p = por_id[sel]
    ef = p.get("efectividad_22") or {}
    with st.form(f"comp_{sel}"):
        a, b = st.columns(2)
        ch = _n(a, "Chances en 22", ef.get("chances"), f"cch{sel}")
        co = _n(b, "Concretadas", ef.get("concretadas"), f"cco{sel}")
        ok = st.form_submit_button("Guardar", type="primary")
    if ok:
        if co > ch:
            st.error("Hay más concretadas que chances."); return
        fila = {"partido_id": sel, "datos": {"efectividad_22": {"chances": ch, "concretadas": co}}}
        fuente.guardar_manual(_token(), fila, p.get("complemento_id"))
        st.success("Guardado.")
