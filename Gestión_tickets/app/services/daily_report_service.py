"""Lógica de negocio del Reporte Diario INC / REQ / Tareas."""

from datetime import date, datetime, timedelta

from sqlalchemy.orm import Session

from app.repositories import daily_report_repository


def _fecha(valor) -> date:
    """Convierte la fecha agrupada de SQL Server a datetime.date."""
    if isinstance(valor, datetime):
        return valor.date()
    if isinstance(valor, date):
        return valor
    return date.fromisoformat(str(valor)[:10])


def obtener_opciones_filtros(db: Session) -> dict:
    datos = daily_report_repository.obtener_opciones_filtros(db)

    return {
        "fecha_min": _fecha(datos["fecha_min"]) if datos["fecha_min"] else None,
        "fecha_max": _fecha(datos["fecha_max"]) if datos["fecha_max"] else None,
        "grupos_resolutores": datos["grupos_resolutores"],
        "proyectos": datos["proyectos"],
    }


def obtener_resumen(
    db: Session,
    *,
    desde: date | None = None,
    hasta: date | None = None,
    grupo_resolutor: str | None = None,
    proyecto: str | None = None,
) -> dict:
    """Devuelve KPIs y serie diaria coherentes en una misma respuesta.

    Fecha Acción equivale a Fecha_Apertura de cada tabla consolidada.
    No se realizan JOIN con Ticket_Padre: cada tarea cuenta una vez.
    """
    if desde is not None and hasta is not None and desde > hasta:
        raise ValueError("La fecha Desde no puede ser posterior a Hasta")

    registros = daily_report_repository.obtener_conteos_diarios(
        db,
        desde=desde,
        hasta=hasta,
        grupo_resolutor=grupo_resolutor,
        proyecto=proyecto,
    )

    por_fecha: dict[date, dict] = {}

    for registro in registros:
        fecha_accion = _fecha(registro["fecha_accion"])
        incidentes = int(registro["incidentes"] or 0)
        requerimientos = int(registro["requerimientos"] or 0)
        tareas = int(registro["tareas"] or 0)

        por_fecha[fecha_accion] = {
            "fecha_accion": fecha_accion,
            "total_tickets": incidentes + requerimientos + tareas,
            "incidentes": incidentes,
            "requerimientos": requerimientos,
            "tareas": tareas,
        }

    # Incluye días sin tickets para mantener el eje X continuo.
    # Si uno o ambos extremos no se especifican, utiliza el rango de datos.
    if por_fecha:
        inicio = desde if desde is not None else min(por_fecha)
        fin = hasta if hasta is not None else max(por_fecha)
    elif desde is not None and hasta is not None:
        inicio, fin = desde, hasta
    else:
        inicio = fin = None

    diario = []
    if inicio is not None and fin is not None:
        dia_actual = inicio
        while dia_actual <= fin:
            diario.append(
                por_fecha.get(
                    dia_actual,
                    {
                        "fecha_accion": dia_actual,
                        "total_tickets": 0,
                        "incidentes": 0,
                        "requerimientos": 0,
                        "tareas": 0,
                    },
                )
            )
            if dia_actual == fin:
                break
            dia_actual += timedelta(days=1)

    total_incidentes = sum(fila["incidentes"] for fila in diario)
    total_requerimientos = sum(fila["requerimientos"] for fila in diario)
    total_tareas = sum(fila["tareas"] for fila in diario)

    kpis = {
        "total_tickets": total_incidentes + total_requerimientos + total_tareas,
        "total_incidentes": total_incidentes,
        "total_requerimientos": total_requerimientos,
        "total_tareas": total_tareas,
    }

    return {"kpis": kpis, "diario": diario}


def obtener_kpis(db: Session, **filtros) -> dict:
    return obtener_resumen(db, **filtros)["kpis"]


def obtener_diario(db: Session, **filtros) -> list[dict]:
    return obtener_resumen(db, **filtros)["diario"]
