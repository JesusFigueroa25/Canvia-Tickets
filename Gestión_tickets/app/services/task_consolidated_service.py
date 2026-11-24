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
from app.etl.task_consolidated_etl import procesar_task_consolidated
from app.models.import_run_model import ImportRun
from app.repositories import import_run_repository, task_consolidated_repository
from app.schemas.task_consolidated_schema import TaskConsolidatedDashboardFilters

logger = logging.getLogger(__name__)

MESES = {
    1: "ENE", 2: "FEB", 3: "MAR", 4: "ABR", 5: "MAY", 6: "JUN",
    7: "JUL", 8: "AGO", 9: "SEP", 10: "OCT", 11: "NOV", 12: "DIC",
}
PRIORIDADES = ["1-Critical", "2-High", "3-Medium", "4-Low"]


def _periodo(anio: int, mes: int) -> str:
    return f"{MESES[mes]}-{str(anio)[-2:]}"


def _indice_mes(anio: int, mes: int) -> int:
    return anio * 12 + mes - 1


def _bloquear_importacion(db: Session) -> None:
    """Serializa imports de tareas; protege la tabla staging común.

    sp_getapplock se libera automáticamente cuando se hace COMMIT o ROLLBACK.
    """
    resultado = db.execute(text("""
        DECLARE @resultado INT;
        EXEC @resultado = sys.sp_getapplock
            @Resource = 'canvia_task_consolidated_import',
            @LockMode = 'Exclusive',
            @LockOwner = 'Transaction',
            @LockTimeout = 15000;
        SELECT @resultado AS resultado;
    """)).scalar_one()
    if resultado < 0:
        raise RuntimeError(
            "No se pudo obtener el bloqueo de importación de Tareas. "
            "Existe otra carga en curso o se agotó la espera."
        )


# ACTUALIZACION DE AUDITORIA PARA TAREAS
def _actualizar_auditoria_task(
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
    """Actualiza la auditoría usando SQLAlchemy Core.

    Evita el control ORM de `cursor.rowcount` que falla en algunas
    configuraciones de SQL Server/pyodbc (StaleDataError).
    La lectura posterior verifica el registro por su clave primaria,
    sin confiar en el número de filas reportado por el driver.
    """
    db.flush()
    ejecucion_id = ejecucion.Eir_ID
    if ejecucion_id is None:
        raise RuntimeError("La importación no obtuvo un Eir_ID de auditoría")

    tabla = ImportRun.__table__
    valores = {
        "Eir_Fecha_Fin": fecha_fin,
        "Eir_Estado": estado,
        "Eir_Filas_Excel": filas_excel,
        "Eir_Filas_Aceptadas": filas_aceptadas,
        "Eir_Filas_Rechazadas": filas_rechazadas,
        "Eir_Tickets_Nuevos": nuevos,
        "Eir_Tickets_Modificados": modificados,
        "Eir_Tickets_Sin_Cambios": sin_cambios,
        "Eir_SQLServer_Status": estado,
        "Eir_SQLite_Status": "NO_APLICA",
        "Eir_Error_Mensaje": error_mensaje,
    }

    conexion = db.connection()
    conexion.execute(
        update(tabla)
        .where(tabla.c.Eir_ID == ejecucion_id)
        .values(**valores)
    )

    verificacion = conexion.execute(
        select(tabla.c.Eir_Estado, tabla.c.Eir_SQLServer_Status)
        .where(tabla.c.Eir_ID == ejecucion_id)
    ).one_or_none()
    if verificacion is None or tuple(verificacion) != (estado, estado):
        raise RuntimeError(
            f"No se confirmó la actualización de import_run, Eir_ID={ejecucion_id}"
        )


# IMPORTACION CON AUDITORIA Y TRANSACCION SQL SERVER
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
            tipo="task_consolidated",
            nombre_archivo=nombre_archivo,
            fecha_inicio=fecha_inicio,
            sqlite_status="NO_APLICA",
            sqlserver_status="PROCESSING",
        )

        archivo.seek(0)
        df, filas_excel, duplicados = procesar_task_consolidated(archivo)
        filas_procesadas = len(df)

        task_consolidated_repository.limpiar_staging(db)
        filas_staging = task_consolidated_repository.cargar_staging(db, df)
        db.flush()

        df_staging = task_consolidated_repository.obtener_staging(db)
        df_oficial = task_consolidated_repository.obtener_oficial(db)
        clasificacion = detectar_cambios(df_staging, df_oficial)

        nuevos = task_consolidated_repository.insertar_nuevos(
            db, clasificacion["NEW"]
        )
        modificados = task_consolidated_repository.actualizar_modificados(
            db, clasificacion["CHANGED"]
        )
        sin_cambios = len(clasificacion["SAME"])

        if nuevos + modificados + sin_cambios != filas_staging:
            raise RuntimeError("Los conteos de la importación de Tareas no coinciden")

        _actualizar_auditoria_task(
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
        logger.exception("Falló la importación de Tareas Consolidadas")

        try:
            intento_fallido = import_run_repository.crear(
                db=db,
                tipo="task_consolidated",
                nombre_archivo=nombre_archivo,
                fecha_inicio=fecha_inicio,
                sqlite_status="NO_APLICA",
                sqlserver_status="ERROR",
            )
            _actualizar_auditoria_task(
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
        "tipo": "task_consolidated",
        "tabla_staging": "stg_task_consolidated",
        "tabla_destino": "task_consolidated",
        "filas_excel": filas_excel,
        "filas_procesadas": filas_procesadas,
        "filas_staging": filas_staging,
        "duplicados": duplicados,
        "nuevos": nuevos,
        "modificados": modificados,
        "sin_cambios": sin_cambios,
        "mensaje": "Archivo de Tareas procesado y cambios clasificados",
    }


# OPCIONES DE FILTROS
def obtener_opciones_filtros(db: Session) -> dict:
    datos = task_consolidated_repository.obtener_opciones_filtros(db)
    fecha_min, fecha_max = datos["fecha_min"], datos["fecha_max"]
    return {
        "fecha_min": fecha_min.date() if fecha_min else None,
        "fecha_max": fecha_max.date() if fecha_max else None,
        "prioridades": datos["prioridades"],
        "motivos_estado": datos["motivos_estado"],
        "grupos_resolutores": datos["grupos_resolutores"],
        "proyectos": datos["proyectos"],
        "tipos_tarea": datos["tipos_tarea"],
        "nombres_resolutores": datos["nombres_resolutores"],
    }


# KPIS
def obtener_kpis(db: Session, filtros: TaskConsolidatedDashboardFilters) -> dict:
    datos = task_consolidated_repository.obtener_kpis(db, filtros)
    total = int(datos["total_tickets"] or 0)
    alta = int(datos["alta_criticidad"] or 0)
    return {
        "total_tickets": total,
        "total_proyectos": int(datos["total_proyectos"] or 0),
        "alta_criticidad": alta,
        "porcentaje_alta_criticidad": round(alta * 100 / total, 2) if total else 0.0,
    }


# VOLUMEN MENSUAL / PROYECTOS / TIPOS / PRIORIDADES
def obtener_volumen_mensual(db: Session, filtros: TaskConsolidatedDashboardFilters):
    return [
        {
            "anio": fila.anio,
            "mes": fila.mes,
            "periodo": _periodo(fila.anio, fila.mes),
            "tickets": fila.tickets,
        }
        for fila in task_consolidated_repository.obtener_volumen_mensual(db, filtros)
    ]


def obtener_proyectos(db: Session, filtros: TaskConsolidatedDashboardFilters):
    return [
        {"proyecto": fila["proyecto"], "cantidad": fila["cantidad"]}
        for fila in task_consolidated_repository.obtener_proyectos(db, filtros)
    ]


def obtener_tipos(
    db: Session, filtros: TaskConsolidatedDashboardFilters, limite: int = 10
):
    return [
        {"tipo_tarea": fila["tipo_tarea"], "cantidad": fila["cantidad"]}
        for fila in task_consolidated_repository.obtener_tipos(db, filtros, limite)
    ]


def obtener_prioridades(db: Session, filtros: TaskConsolidatedDashboardFilters):
    return [
        {"prioridad": fila["prioridad"], "cantidad": fila["cantidad"]}
        for fila in task_consolidated_repository.obtener_prioridades(db, filtros)
    ]


# TOP 10: PROYECTOS POR MES
def obtener_top_proyectos(db: Session, filtros: TaskConsolidatedDashboardFilters):
    filas = task_consolidated_repository.obtener_top_proyectos_mensual(db, filtros)
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
        clave_mes = _indice_mes(fila["anio"], fila["mes"])
        if not inicio <= clave_mes <= fin:
            continue
        nombre = fila["proyecto"]
        if nombre not in proyectos:
            proyectos[nombre] = {"total_tickets": 0, "conteos": {}}
        proyectos[nombre]["total_tickets"] += fila["tickets"]
        proyectos[nombre]["conteos"][clave_mes] = fila["tickets"]

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


# PRIORIDADES POR MES
def obtener_prioridad_mensual(db: Session, filtros: TaskConsolidatedDashboardFilters):
    filas = task_consolidated_repository.obtener_prioridad_mensual(db, filtros)
    resumen = {}
    for fila in filas:
        if fila["anio"] is None or fila["mes"] is None:
            continue
        clave = (fila["anio"], fila["mes"])
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
            prioridad for prioridad in conteos if prioridad not in PRIORIDADES
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


# TABLA PAGINADA DE TICKETS
def obtener_tickets(
    db: Session,
    filtros: TaskConsolidatedDashboardFilters,
    pagina: int = 1,
    tamano: int = 10,
):
    datos = task_consolidated_repository.obtener_tickets(db, filtros, pagina, tamano)
    total = datos["total"]
    return {
        "tickets": datos["tickets"],
        "total": total,
        "pagina": pagina,
        "tamano": tamano,
        "total_paginas": (total + tamano - 1) // tamano,
    }



# PRD 06 - SERVICIO COMPARTIDO DE RESOLUTORES.
def obtener_rendimiento_resolutores(
    db: Session,
    filtros: TaskConsolidatedDashboardFilters,
    pagina: int = 1,
    tamano: int = 20,
) -> dict:
    filas = task_consolidated_repository.obtener_rendimiento_resolutores(db, filtros)
    return construir_rendimiento_resolutores(filas, pagina=pagina, tamano=tamano)


def obtener_tickets_por_resolutor(
    db: Session,
    filtros: TaskConsolidatedDashboardFilters,
    limite: int = 5,
) -> dict:
    rendimiento = obtener_rendimiento_resolutores(db, filtros, pagina=1, tamano=limite)
    return construir_tickets_por_resolutor(rendimiento, limite=limite)
