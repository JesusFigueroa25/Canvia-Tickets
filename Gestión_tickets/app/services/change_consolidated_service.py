"""Orquestación de importación y dashboard inicial de Cambios Consolidados."""

from app.services.resolutor_dashboard_service import (
    construir_rendimiento_resolutores,
    construir_tickets_por_resolutor,
)
import logging
from datetime import datetime

from sqlalchemy import select, text, update
from sqlalchemy.orm import Session

from app.database.sqlserver import verificar_conexion_sqlserver
from app.etl.change_detector import detectar_cambios
from app.etl.change_consolidated_etl import procesar_change_consolidated
from app.models.import_run_model import ImportRun
from app.repositories import import_run_repository, change_consolidated_repository
from app.schemas.change_consolidated_schema import ChangeConsolidatedDashboardFilters

logger = logging.getLogger(__name__)


def _bloquear_importacion(db: Session) -> None:
    """Serializa las cargas sobre la staging compartida del módulo Cambios."""
    resultado = db.execute(text("""
        DECLARE @resultado INT;
        EXEC @resultado = sys.sp_getapplock
            @Resource = 'canvia_change_consolidated_import',
            @LockMode = 'Exclusive',
            @LockOwner = 'Transaction',
            @LockTimeout = 15000;
        SELECT @resultado AS resultado;
    """)).scalar_one()
    if resultado < 0:
        raise RuntimeError(
            "No se pudo obtener el bloqueo de importación de Cambios. "
            "Existe otra carga en curso o se agotó la espera."
        )


def _actualizar_auditoria(
    db: Session,
    ejecucion: ImportRun,
    *,
    estado: str,
    fecha_fin: datetime,
    filas_excel: int = 0,
    filas_aceptadas: int = 0,
    filas_rechazadas: int = 0,
    nuevos: int = 0,
    modificados: int = 0,
    sin_cambios: int = 0,
    error_mensaje: str | None = None,
) -> None:
    """Actualización Core, igual que Tareas, evita StaleDataError por rowcount."""
    db.flush()
    ejecucion_id = ejecucion.Eir_ID
    if ejecucion_id is None:
        raise RuntimeError("La importación no obtuvo Eir_ID de auditoría")

    tabla = ImportRun.__table__
    db.connection().execute(
        update(tabla)
        .where(tabla.c.Eir_ID == ejecucion_id)
        .values(
            Eir_Fecha_Fin=fecha_fin,
            Eir_Estado=estado,
            Eir_Filas_Excel=filas_excel,
            Eir_Filas_Aceptadas=filas_aceptadas,
            Eir_Filas_Rechazadas=filas_rechazadas,
            Eir_Tickets_Nuevos=nuevos,
            Eir_Tickets_Modificados=modificados,
            Eir_Tickets_Sin_Cambios=sin_cambios,
            Eir_SQLServer_Status=estado,
            Eir_SQLite_Status="NO_APLICA",
            Eir_Error_Mensaje=error_mensaje,
        )
    )
    verificacion = db.connection().execute(
        select(tabla.c.Eir_Estado, tabla.c.Eir_SQLServer_Status)
        .where(tabla.c.Eir_ID == ejecucion_id)
    ).one_or_none()
    if verificacion is None or tuple(verificacion) != (estado, estado):
        raise RuntimeError(
            f"No se confirmó la actualización de import_run, Eir_ID={ejecucion_id}"
        )


def importar(db: Session, archivo, nombre_archivo: str | None = None) -> dict:
    fecha_inicio = datetime.now()
    try:
        verificar_conexion_sqlserver(db)
    except Exception as error:
        db.rollback()
        raise ConnectionError(
            "No hay conexión con SQL Server. Verifique la conexión a la red de Canvia."
        ) from error

    try:
        _bloquear_importacion(db)
        ejecucion = import_run_repository.crear(
            db=db,
            tipo="change_consolidated",
            nombre_archivo=nombre_archivo,
            fecha_inicio=fecha_inicio,
            sqlite_status="NO_APLICA",
            sqlserver_status="PROCESSING",
        )

        archivo.seek(0)
        df, filas_excel, duplicados = procesar_change_consolidated(archivo)
        filas_procesadas = len(df)

        change_consolidated_repository.limpiar_staging(db)
        filas_staging = change_consolidated_repository.cargar_staging(db, df)
        db.flush()
        df_staging = change_consolidated_repository.obtener_staging(db)
        df_oficial = change_consolidated_repository.obtener_oficial(db)
        clasificacion = detectar_cambios(df_staging, df_oficial)

        nuevos = change_consolidated_repository.insertar_nuevos(
            db, clasificacion["NEW"]
        )
        modificados = change_consolidated_repository.actualizar_modificados(
            db, clasificacion["CHANGED"]
        )
        sin_cambios = len(clasificacion["SAME"])

        if nuevos + modificados + sin_cambios != filas_staging:
            raise RuntimeError("No coinciden los conteos de importación de Cambios")

        _actualizar_auditoria(
            db=db,
            ejecucion=ejecucion,
            estado="SUCCESS",
            fecha_fin=datetime.now(),
            filas_excel=filas_excel,
            filas_aceptadas=filas_staging,
            filas_rechazadas=max(filas_excel - filas_staging, 0),
            nuevos=nuevos,
            modificados=modificados,
            sin_cambios=sin_cambios,
        )
        db.commit()
    except Exception as error:
        db.rollback()
        logger.exception("Falló la importación de Cambios Consolidados")
        try:
            intento_fallido = import_run_repository.crear(
                db=db,
                tipo="change_consolidated",
                nombre_archivo=nombre_archivo,
                fecha_inicio=fecha_inicio,
                sqlite_status="NO_APLICA",
                sqlserver_status="ERROR",
            )
            _actualizar_auditoria(
                db=db,
                ejecucion=intento_fallido,
                estado="ERROR",
                fecha_fin=datetime.now(),
                error_mensaje=str(error),
            )
            db.commit()
        except Exception:
            db.rollback()
            logger.exception("No fue posible registrar el error en import_run")
        raise

    return {
        "tipo": "change_consolidated",
        "tabla_staging": "stg_change_consolidated",
        "tabla_destino": "change_consolidated",
        "filas_excel": filas_excel,
        "filas_procesadas": filas_procesadas,
        "filas_staging": filas_staging,
        "duplicados": duplicados,
        "nuevos": nuevos,
        "modificados": modificados,
        "sin_cambios": sin_cambios,
        "mensaje": "Archivo de Cambios procesado y cambios clasificados",
    }


def obtener_opciones_filtros(db: Session) -> dict:
    datos = change_consolidated_repository.obtener_opciones_filtros(db)
    fecha_min, fecha_max = datos["fecha_min"], datos["fecha_max"]
    return {
        "fecha_min": fecha_min.date() if fecha_min else None,
        "fecha_max": fecha_max.date() if fecha_max else None,
        "prioridades": datos["prioridades"],
        "motivos": datos["motivos"],
        "grupos_resolutores": datos["grupos_resolutores"],
        "estados": datos["estados"],
        "proyectos": datos["proyectos"],
        "tipos_cambio": datos["tipos_cambio"],
        "nombres_resolutores": datos["nombres_resolutores"],
    }


def obtener_kpis(db: Session, filtros: ChangeConsolidatedDashboardFilters) -> dict:
    datos = change_consolidated_repository.obtener_kpis(db, filtros)
    total = int(datos["total_tickets"] or 0)
    alta = int(datos["alta_criticidad"] or 0)
    return {
        "total_tickets": total,
        "total_proyectos": int(datos["total_proyectos"] or 0),
        "alta_criticidad": alta,
        "porcentaje_alta_criticidad": round(alta * 100 / total, 2) if total else 0.0,
    }


# DASHBOARD DE CAMBIOS CONSOLIDADOS - RESULTADOS FORMATEADOS
MESES = {
    1: "ENE", 2: "FEB", 3: "MAR", 4: "ABR", 5: "MAY", 6: "JUN",
    7: "JUL", 8: "AGO", 9: "SEP", 10: "OCT", 11: "NOV", 12: "DIC",
}
PRIORIDADES = ["1-Critical", "2-High", "3-Medium", "4-Low"]


def _periodo(anio: int, mes: int) -> str:
    return f"{MESES[mes]}-{str(anio)[-2:]}"


def _indice_mes(anio: int, mes: int) -> int:
    return anio * 12 + mes - 1


def obtener_volumen_mensual(db: Session, filtros: ChangeConsolidatedDashboardFilters):
    return [
        {
            "anio": int(fila.anio),
            "mes": int(fila.mes),
            "periodo": _periodo(fila.anio, fila.mes),
            "tickets": int(fila.tickets),
        }
        for fila in change_consolidated_repository.obtener_volumen_mensual(db, filtros)
    ]


def obtener_proyectos(db: Session, filtros: ChangeConsolidatedDashboardFilters):
    return [
        {"proyecto": fila["proyecto"], "cantidad": int(fila["cantidad"])}
        for fila in change_consolidated_repository.obtener_proyectos(db, filtros)
    ]


def obtener_tipos(
    db: Session, filtros: ChangeConsolidatedDashboardFilters, limite: int = 10
):
    return [
        {"tipo_cambio": fila["tipo_cambio"], "cantidad": int(fila["cantidad"])}
        for fila in change_consolidated_repository.obtener_tipos(db, filtros, limite)
    ]


def obtener_prioridades(db: Session, filtros: ChangeConsolidatedDashboardFilters):
    return [
        {"prioridad": fila["prioridad"], "cantidad": int(fila["cantidad"])}
        for fila in change_consolidated_repository.obtener_prioridades(db, filtros)
    ]


def obtener_top_proyectos(db: Session, filtros: ChangeConsolidatedDashboardFilters):
    """Top 10 del rango visible; por defecto los últimos 4 meses, como Tareas."""
    filas = change_consolidated_repository.obtener_top_proyectos_mensual(db, filtros)
    if not filas:
        return {"periodos": [], "proyectos": []}

    indices = [_indice_mes(fila["anio"], fila["mes"]) for fila in filas]
    if filtros.periodo:
        anio_sel, mes_sel = map(int, filtros.periodo.split("-"))
        inicio = fin = _indice_mes(anio_sel, mes_sel)
    else:
        fin = (
            _indice_mes(filtros.hasta.year, filtros.hasta.month)
            if filtros.hasta else max(indices)
        )
        inicio = (
            _indice_mes(filtros.desde.year, filtros.desde.month)
            if filtros.desde else min(indices) if filtros.hasta else fin - 3
        )

    if inicio > fin:
        return {"periodos": [], "proyectos": []}

    periodos = []
    for numero in range(inicio, fin + 1):
        anio, mes_cero = divmod(numero, 12)
        mes = mes_cero + 1
        periodos.append({"anio": anio, "mes": mes, "periodo": _periodo(anio, mes)})

    proyectos = {}
    for fila in filas:
        indice = _indice_mes(fila["anio"], fila["mes"])
        if not inicio <= indice <= fin:
            continue
        nombre = fila["proyecto"]
        if nombre not in proyectos:
            proyectos[nombre] = {"total_tickets": 0, "conteos": {}}
        proyectos[nombre]["total_tickets"] += int(fila["tickets"])
        proyectos[nombre]["conteos"][indice] = int(fila["tickets"])

    ranking = sorted(
        proyectos.items(),
        key=lambda item: (-item[1]["total_tickets"], item[0]),
    )[:10]

    return {
        "periodos": periodos,
        "proyectos": [
            {
                "proyecto": nombre,
                "total_tickets": datos["total_tickets"],
                "mensual": [
                    {
                        "periodo": periodo["periodo"],
                        "tickets": datos["conteos"].get(
                            _indice_mes(periodo["anio"], periodo["mes"]), 0
                        ),
                    }
                    for periodo in periodos
                ],
            }
            for nombre, datos in ranking
        ],
    }


def obtener_prioridad_mensual(
    db: Session, filtros: ChangeConsolidatedDashboardFilters
):
    filas = change_consolidated_repository.obtener_prioridad_mensual(db, filtros)
    resumen = {}
    for fila in filas:
        if fila["anio"] is None or fila["mes"] is None:
            continue
        clave = (int(fila["anio"]), int(fila["mes"]))
        if clave not in resumen:
            resumen[clave] = {"total_tickets": 0, "conteos": {}}
        cantidad = int(fila["cantidad"] or 0)
        prioridad = fila["prioridad"]
        resumen[clave]["total_tickets"] += cantidad
        resumen[clave]["conteos"][prioridad] = (
            resumen[clave]["conteos"].get(prioridad, 0) + cantidad
        )

    respuesta = []
    for (anio, mes), datos in sorted(resumen.items()):
        total = datos["total_tickets"]
        conteos = datos["conteos"]
        categorias = PRIORIDADES + sorted(
            p for p in conteos if p not in PRIORIDADES
        )
        respuesta.append({
            "anio": anio,
            "mes": mes,
            "periodo": _periodo(anio, mes),
            "total_tickets": total,
            "prioridades": [
                {
                    "prioridad": prioridad,
                    "cantidad": conteos.get(prioridad, 0),
                    "porcentaje": round(conteos.get(prioridad, 0) * 100 / total, 2)
                    if total else 0.0,
                }
                for prioridad in categorias
            ],
        })
    return respuesta


def obtener_tickets(
    db: Session,
    filtros: ChangeConsolidatedDashboardFilters,
    pagina: int = 1,
    tamano: int = 10,
):
    datos = change_consolidated_repository.obtener_tickets(db, filtros, pagina, tamano)
    total = datos["total"]
    return {
        "tickets": datos["tickets"],
        "total": total,
        "pagina": pagina,
        "tamano": tamano,
        "total_paginas": (total + tamano - 1) // tamano,
    }


# DISTRIBUCION POR CATEGORIA
def obtener_categorias(
    db: Session,
    filtros: ChangeConsolidatedDashboardFilters,
    limite: int = 10,
):
    return [
        {
            "categoria": fila["categoria"],
            "cantidad": int(fila["cantidad"]),
        }
        for fila in change_consolidated_repository.obtener_categorias(
            db, filtros, limite
        )
    ]

# ================================================================
# PRD 05 - ANALISIS DE ACTIVIDADES Y HORAS DE CAMBIOS
# ================================================================

def _respuesta_paginada_cambios(datos: dict, pagina: int, tamano: int) -> dict:
    total = int(datos["total"])
    return {
        "cambios": datos["cambios"],
        "total": total,
        "pagina": pagina,
        "tamano": tamano,
        "total_paginas": (total + tamano - 1) // tamano,
    }


def obtener_actividades_bd(
    db: Session,
    filtros: ChangeConsolidatedDashboardFilters,
    pagina: int = 1,
    tamano: int = 10,
    incluir_solo_validacion: bool = True,
) -> dict:
    datos = change_consolidated_repository.obtener_actividades_bd(
        db, filtros, pagina, tamano, incluir_solo_validacion
    )
    return _respuesta_paginada_cambios(datos, pagina, tamano)


def obtener_horas_por_cambio(
    db: Session,
    filtros: ChangeConsolidatedDashboardFilters,
    pagina: int = 1,
    tamano: int = 10,
    incluir_solo_validacion: bool = True,
) -> dict:
    datos = change_consolidated_repository.obtener_horas_por_cambio(
        db, filtros, pagina, tamano, incluir_solo_validacion
    )
    return _respuesta_paginada_cambios(datos, pagina, tamano)


def obtener_horas_por_resolutor(
    db: Session,
    filtros: ChangeConsolidatedDashboardFilters,
    incluir_solo_validacion: bool = True,
) -> list[dict]:
    return change_consolidated_repository.obtener_horas_por_resolutor(
        db, filtros, incluir_solo_validacion
    )


def obtener_horas_mensuales(
    db: Session,
    filtros: ChangeConsolidatedDashboardFilters,
    incluir_solo_validacion: bool = True,
) -> list[dict]:
    return change_consolidated_repository.obtener_horas_mensuales(
        db, filtros, incluir_solo_validacion
    )



# PRD 06 - SERVICIO COMPARTIDO DE RESOLUTORES.
def obtener_rendimiento_resolutores(
    db: Session,
    filtros: ChangeConsolidatedDashboardFilters,
    pagina: int = 1,
    tamano: int = 20,
) -> dict:
    filas = change_consolidated_repository.obtener_rendimiento_resolutores(db, filtros)
    return construir_rendimiento_resolutores(filas, pagina=pagina, tamano=tamano)


def obtener_tickets_por_resolutor(
    db: Session,
    filtros: ChangeConsolidatedDashboardFilters,
    limite: int = 5,
) -> dict:
    rendimiento = obtener_rendimiento_resolutores(db, filtros, pagina=1, tamano=limite)
    return construir_tickets_por_resolutor(rendimiento, limite=limite)
