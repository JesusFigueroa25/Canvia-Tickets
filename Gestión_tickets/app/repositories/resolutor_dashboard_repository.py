"""Agregación SQLAlchemy común para Resolutores, conservando filtros por módulo.

No hace joins: cada Ticket_ID de la tabla de origen contribuye una sola vez,
y se contabiliza en el mes de su fecha de apertura/creación.
"""
from typing import Callable

from sqlalchemy import func, select
from sqlalchemy.orm import Session


def normalizar_resolutor(columna):
    """Unifica nombres nulos y en blanco con el contrato de Incidentes."""
    return func.coalesce(func.nullif(func.trim(columna), ""), "Sin especificar")


def obtener_nombres_resolutores(db: Session, columna) -> list[str]:
    # Usar el alias evita el error 145 de SQL Server
    # al combinar SELECT DISTINCT con ORDER BY.
    resolutor = normalizar_resolutor(columna).label("nombre_resolutor")

    consulta = (
        select(resolutor)
        .distinct()
        .order_by("nombre_resolutor")
    )

    return list(db.execute(consulta).scalars().all())


def consultar_rendimiento_resolutores(
    db: Session,
    filtros,
    *,
    modelo,
    fecha,
    resolutor,
    aplicar_filtros: Callable,
):
    """Devuelve (nombre, año, mes, tickets) para reconstrucción en Service.

    Usa los filtros existentes del dashboard antes de agrupar para que coincida
    con los demás indicadores y nunca multiplique filas mediante joins.
    """
    anio = func.year(fecha)
    mes = func.month(fecha)
    nombre = normalizar_resolutor(resolutor)

    base = (
        select(
            nombre.label("nombre_resolutor"),
            anio.label("anio"),
            mes.label("mes"),
        )
        .select_from(modelo)
        .where(fecha.isnot(None))
    )
    datos = aplicar_filtros(base, filtros).subquery()
    consulta = (
        select(
            datos.c.nombre_resolutor,
            datos.c.anio,
            datos.c.mes,
            func.count().label("tickets"),
        )
        .select_from(datos)
        .group_by(datos.c.nombre_resolutor, datos.c.anio, datos.c.mes)
        .order_by(datos.c.anio, datos.c.mes, datos.c.nombre_resolutor)
    )
    return db.execute(consulta).mappings().all()
