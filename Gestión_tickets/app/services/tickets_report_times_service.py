from __future__ import annotations
from decimal import Decimal
from app.schemas.tickets_report_times_schema import TicketsReportTimesDashboardFilters
import logging
from datetime import datetime
from uuid import uuid4
from sqlalchemy.orm import Session
from app.database.sqlserver import verificar_conexion_sqlserver
from app.etl.tickets_report_times_etl import procesar_tickets_report_times
from app.repositories import import_run_repository
from app.repositories import tickets_report_times_repository as repository

logger = logging.getLogger(__name__)


def importar(db: Session, archivo, nombre_archivo: str | None = None):
    inicio = datetime.now()
    lote_id = uuid4()

    try:
        verificar_conexion_sqlserver(db)
    except Exception as exc:
        db.rollback()
        raise ConnectionError("No hay conexión con SQL Server") from exc

    try:
        df, filas_excel, tickets_distintos = procesar_tickets_report_times(archivo)
        repository.bloquear_importacion(db)

        auditoria = import_run_repository.crear(
            db=db,
            tipo="tickets_report_times",
            nombre_archivo=nombre_archivo,
            fecha_inicio=inicio,
            sqlite_status="NO_APLICA",
            sqlserver_status="PROCESSING",
        )

        filas_staging = repository.cargar_staging(db, df, lote_id)
        db.flush()
        if filas_staging != len(df):
            raise RuntimeError("La cantidad cargada al staging no coincide")

        clasificacion = repository.clasificar_cambios(db, lote_id)
        if sum(clasificacion.values()) != filas_staging:
            raise RuntimeError("La clasificación de acciones no cuadra")

        repository.sincronizar_lote(db, lote_id, clasificacion)
        repository.limpiar_staging_lote(db, lote_id)
        total_acciones = repository.contar_total_acciones(db)

        import_run_repository.completar(
            db=db,
            import_run=auditoria,
            fecha_fin=datetime.now(),
            filas_excel=filas_excel,
            filas_aceptadas=filas_staging,
            filas_rechazadas=0,
            nuevos=clasificacion["nuevos"],
            modificados=clasificacion["modificados"],
            sin_cambios=clasificacion["sin_cambios"],
            sqlite_status="NO_APLICA",
            sqlserver_status="SUCCESS",
        )
        db.commit()

        logger.info(
            "Importación de tiempos completada: lote=%s nuevos=%d "
            "modificados=%d sin_cambios=%d",
            lote_id, clasificacion["nuevos"],
            clasificacion["modificados"], clasificacion["sin_cambios"],
        )
        return {
            "tipo": "tickets_report_times",
            "tabla_staging": "stg_tickets_report_times",
            "tabla_destino": "tickets_report_times",
            "lote_id": str(lote_id),
            "filas_excel": filas_excel,
            "filas_procesadas": len(df),
            "filas_staging": filas_staging,
            "filas_rechazadas": 0,
            "nuevos": clasificacion["nuevos"],
            "modificados": clasificacion["modificados"],
            "sin_cambios": clasificacion["sin_cambios"],
            "tickets_distintos": tickets_distintos,
            "total_acciones": total_acciones,
            "mensaje": "Reporte de tiempos importado correctamente",
        }

    except Exception as exc:
        db.rollback()
        logger.exception("Error importando tiempos: lote=%s", lote_id)
        try:
            auditoria_error = import_run_repository.crear(
                db=db,
                tipo="tickets_report_times",
                nombre_archivo=nombre_archivo,
                fecha_inicio=inicio,
                sqlite_status="NO_APLICA",
                sqlserver_status="ERROR",
            )
            import_run_repository.marcar_error(
                db=db, import_run=auditoria_error,
                fecha_fin=datetime.now(), error=exc,
                sqlite_status="NO_APLICA", sqlserver_status="ERROR",
            )
            db.commit()
        except Exception:
            db.rollback()
            logger.exception("No se pudo auditar la importación fallida")
        raise


def _horas(valor) -> float:
    return float(Decimal(str(valor or 0)).quantize(Decimal("0.01")))


def _segundos(valor) -> float:
    return float(
        Decimal(str(valor or 0)).quantize(Decimal("0.01"))
    )

def _periodo(anio: int, mes: int) -> str:
    return f"{int(anio):04d}-{int(mes):02d}"


def obtener_opciones_filtros(db: Session, grupo_resolutor: str | None = "BASE DE DATOS Y EBS"):
    return repository.obtener_opciones_filtros(db, grupo_resolutor)

def obtener_kpis(
    db: Session,
    filtros: TicketsReportTimesDashboardFilters
):
    datos = repository.obtener_kpis(db, filtros)

    total_tickets = int(datos["total_tickets"] or 0)
    total_proyectos = int(datos["total_proyectos"] or 0)
    total_resolutores = int(datos["total_resolutores"] or 0)

    horas = Decimal(str(datos["horas_totales"] or 0))
    segundos = Decimal(str(datos["segundos_totales"] or 0))

    meses = int(datos["meses_con_datos"] or 0)
    tickets_mensuales = int(
        datos["tickets_mensuales_acumulados"] or 0
    )

    promedio_horas = 0.0
    promedio_segundos = 0.0
    promedio_tickets = 0.0

    if meses > 0:
        promedio_horas = _horas(
            horas / Decimal(meses)
        )

        promedio_segundos = _segundos(
            segundos / Decimal(meses)
        )

        promedio_tickets = float(
            (
                Decimal(tickets_mensuales)
                / Decimal(meses)
            ).quantize(Decimal("0.01"))
        )

    criticos = int(datos["alta_criticidad"] or 0)

    porcentaje_criticos = (
        round(100 * criticos / total_tickets, 2)
        if total_tickets > 0
        else 0.0
    )

    return {
        "total_tickets": total_tickets,
        "total_proyectos": total_proyectos,
        "horas_totales": _horas(horas),
        "segundos_totales": _segundos(segundos),
        "total_resolutores": total_resolutores,
        "promedio_horas": promedio_horas,
        "promedio_segundos": promedio_segundos,
        "promedio_tickets": promedio_tickets,
        "alta_criticidad": criticos,
        "porcentaje_alta_criticidad": porcentaje_criticos,
    }


def obtener_volumen_mensual(
    db: Session,
    filtros: TicketsReportTimesDashboardFilters
):
    return [
        {
            "anio": int(r["anio"]),
            "mes": int(r["mes"]),
            "periodo": _periodo(r["anio"], r["mes"]),
            "tickets": int(r["tickets"]),
            "acciones": int(r["acciones"]),
            "horas_totales": _horas(r["horas_totales"]),
            "segundos_totales": _segundos(r["segundos_totales"]),
        }
        for r in repository.obtener_volumen_mensual(db, filtros)
    ]


def _resumen(
    db: Session,
    filtros: TicketsReportTimesDashboardFilters
) -> dict:

    r = repository.obtener_resumen(db, filtros)

    return {
        "tickets_distintos": int(r["tickets_distintos"] or 0),
        "acciones": int(r["acciones"] or 0),
        "horas_totales": _horas(r["horas_totales"]),
        "segundos_totales": _segundos(r["segundos_totales"]),
        "proyectos_distintos": int(r["proyectos_distintos"] or 0),
        "resolutores_distintos": int(r["resolutores_distintos"] or 0),
    }

def _tabla(
    db: Session,
    filtros: TicketsReportTimesDashboardFilters,
    dimension: str,
    pagina: int,
    tamano: int
):
    datos = repository.obtener_tabla(
        db, filtros, dimension, pagina, tamano
    )

    items = []

    for r in datos["items"]:
        item = {
            "anio": int(r["anio"]),
            "mes": int(r["mes"]),
            "periodo": _periodo(r["anio"], r["mes"]),
            dimension: r[dimension],
            "tickets": int(r["tickets"]),
            "acciones": int(r["acciones"]),
            "horas_totales": _horas(r["horas_totales"]),
            "segundos_totales": _segundos(r["segundos_totales"]),
        }

        if dimension == "proyecto":
            item["resolutores_distintos"] = int(
                r["resolutores_distintos"]
            )

        items.append(item)

    total = datos["total"]

    return {
        "resumen": _resumen(db, filtros),
        "items": items,
        "total": total,
        "pagina": pagina,
        "tamano": tamano,
        "total_paginas": (total + tamano - 1) // tamano,
    }


def obtener_tiempos_resolutores(db: Session, filtros: TicketsReportTimesDashboardFilters,
                                 pagina: int = 1, tamano: int = 25):
    return _tabla(db, filtros, "resolutor", pagina, tamano)


def obtener_tiempos_proyectos(db: Session, filtros: TicketsReportTimesDashboardFilters,
                               pagina: int = 1, tamano: int = 25):
    return _tabla(db, filtros, "proyecto", pagina, tamano)


def _grafico(
    db: Session,
    filtros: TicketsReportTimesDashboardFilters,
    dimension: str,
    limite: int
):
    datos = repository.obtener_grafico(
        db, filtros, dimension, limite
    )

    mapa_horas = {
        (r["nombre"], _periodo(r["anio"], r["mes"])):
            _horas(r["horas"])
        for r in datos["mensual"]
    }

    mapa_segundos = {
        (r["nombre"], _periodo(r["anio"], r["mes"])):
            _segundos(r["segundos"])
        for r in datos["mensual"]
    }

    return {
        "periodos": datos["periodos"],
        "series": [
            {
                "nombre": r["nombre"],
                "horas_totales": _horas(r["horas_totales"]),
                "segundos_totales": _segundos(
                    r["segundos_totales"]
                ),
                "mensual": [
                    {
                        "periodo": p,
                        "horas": mapa_horas.get(
                            (r["nombre"], p), 0.0
                        ),
                        "segundos": mapa_segundos.get(
                            (r["nombre"], p), 0.0
                        ),
                    }
                    for p in datos["periodos"]
                ],
            }
            for r in datos["ranking"]
        ],
        "limite": limite,
    }


def obtener_tiempos_resolutores_grafico(db: Session, filtros: TicketsReportTimesDashboardFilters,
                                         limite: int = 10):
    return _grafico(db, filtros, "resolutor", limite)


def obtener_tiempos_proyectos_grafico(db: Session, filtros: TicketsReportTimesDashboardFilters,
                                       limite: int = 10):
    return _grafico(db, filtros, "proyecto", limite)
