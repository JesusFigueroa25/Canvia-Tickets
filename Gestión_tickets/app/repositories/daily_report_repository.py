"""Consultas de lectura del Reporte Diario de Incidentes, Requerimientos y Tareas.

Las tres fuentes son exclusivamente tablas consolidadas: nunca se hace JOIN
entre ellas ni se consultan tablas SLA o staging.
"""

from datetime import date, timedelta

from sqlalchemy import Date, func, literal, literal_column, select, union_all
from sqlalchemy.orm import Session

from app.models.incident_consolidated_model import IncidentConsolidated
from app.models.requirement_consolidated_model import RequirementConsolidated
from app.models.task_consolidated_model import TaskConsolidated


MODELOS = (IncidentConsolidated, RequirementConsolidated, TaskConsolidated)


def _normalizar_texto(columna):
    """Uniformiza cadenas vacías y nulas entre los tres tipos de ticket."""
    return func.coalesce(func.nullif(func.trim(columna), ""), "Sin especificar")


def _aplicar_filtros(
    consulta,
    modelo,
    *,
    desde: date | None = None,
    hasta: date | None = None,
    grupo_resolutor: str | None = None,
    proyecto: str | None = None,
):
    """Filtros consistentes para cada tabla; evita CAST sobre Fecha_Apertura."""
    if desde is not None:
        consulta = consulta.where(modelo.Fecha_Apertura >= desde)

    if hasta is not None and hasta < date.max:
        consulta = consulta.where(
            modelo.Fecha_Apertura < hasta + timedelta(days=1)
        )

    if grupo_resolutor and grupo_resolutor.strip():
        consulta = consulta.where(
            func.lower(_normalizar_texto(modelo.Grupo_Resolutor))
            == grupo_resolutor.strip().lower()
        )

    if proyecto and proyecto.strip():
        consulta = consulta.where(
            func.lower(_normalizar_texto(modelo.Proyecto))
            == proyecto.strip().lower()
        )

    return consulta


def _conteos_por_fuente(
    modelo,
    posicion: int,
    *,
    desde: date | None = None,
    hasta: date | None = None,
    grupo_resolutor: str | None = None,
    proyecto: str | None = None,
):
    """Agrupa por fecha en origen, antes de combinar las tres fuentes."""
    # CONVERT(date, ...) evita agrupar por hora y no depende de que
    # el dialecto detecte correctamente la versión de SQL Server.
    fecha = func.convert(literal_column("date"), modelo.Fecha_Apertura, type_=Date())
    cantidad = func.count()

    consulta = select(
        fecha.label("fecha_accion"),
        (cantidad if posicion == 0 else literal(0)).label("incidentes"),
        (cantidad if posicion == 1 else literal(0)).label("requerimientos"),
        (cantidad if posicion == 2 else literal(0)).label("tareas"),
    ).select_from(modelo)

    consulta = _aplicar_filtros(
        consulta,
        modelo,
        desde=desde,
        hasta=hasta,
        grupo_resolutor=grupo_resolutor,
        proyecto=proyecto,
    )

    return consulta.group_by(fecha)


def obtener_conteos_diarios(
    db: Session,
    *,
    desde: date | None = None,
    hasta: date | None = None,
    grupo_resolutor: str | None = None,
    proyecto: str | None = None,
) -> list[dict]:
    """Una sola consulta: agrupa cada fuente por día y suma las tres series.

    El total se calcula en el servicio desde estas mismas series para garantizar
    que los KPIs, la tabla y el gráfico se refieran al mismo universo de datos.
    """
    filtros = {
        "desde": desde,
        "hasta": hasta,
        "grupo_resolutor": grupo_resolutor,
        "proyecto": proyecto,
    }

    fuentes = union_all(
        *(
            _conteos_por_fuente(modelo, posicion, **filtros)
            for posicion, modelo in enumerate(MODELOS)
        )
    ).subquery("fuentes_diarias")

    consulta = (
        select(
            fuentes.c.fecha_accion,
            func.sum(fuentes.c.incidentes).label("incidentes"),
            func.sum(fuentes.c.requerimientos).label("requerimientos"),
            func.sum(fuentes.c.tareas).label("tareas"),
        )
        .group_by(fuentes.c.fecha_accion)
        .order_by(fuentes.c.fecha_accion)
    )

    return [dict(fila) for fila in db.execute(consulta).mappings().all()]


def _obtener_opciones(db: Session, nombre_campo: str) -> list[str]:
    """Combina las opciones de tres tablas sin duplicarlas."""
    valores = union_all(
        *(
            select(_normalizar_texto(getattr(modelo, nombre_campo)).label("valor")).distinct()
            for modelo in MODELOS
        )
    ).subquery("opciones")

    consulta = (
        select(valores.c.valor)
        .distinct()
        .order_by(valores.c.valor)
    )

    return list(db.execute(consulta).scalars().all())


def obtener_opciones_filtros(db: Session) -> dict:
    """Rango de Fecha_Apertura y opciones de grupo/proyecto de las tres tablas."""
    extremos = union_all(
        *(
            select(
                func.min(modelo.Fecha_Apertura).label("fecha_min"),
                func.max(modelo.Fecha_Apertura).label("fecha_max"),
            )
            for modelo in MODELOS
        )
    ).subquery("extremos_fechas")

    fechas = db.execute(
        select(
            func.min(extremos.c.fecha_min).label("fecha_min"),
            func.max(extremos.c.fecha_max).label("fecha_max"),
        )
    ).mappings().one()

    return {
        "fecha_min": fechas["fecha_min"],
        "fecha_max": fechas["fecha_max"],
        "grupos_resolutores": _obtener_opciones(db, "Grupo_Resolutor"),
        "proyectos": _obtener_opciones(db, "Proyecto"),
    }



def obtener_proyectos(
    db: Session,
    *,
    desde: date | None = None,
    hasta: date | None = None,
    grupo_resolutor: str | None = None,
    proyecto: str | None = None,
) -> list[dict]:

    filtros = {
        "desde": desde,
        "hasta": hasta,
        "grupo_resolutor": grupo_resolutor,
        "proyecto": proyecto,
    }

    consultas = []

    for modelo in MODELOS:

        nombre = _normalizar_texto(modelo.Proyecto)

        consulta = (
            select(
                nombre.label("proyecto"),
                func.count().label("cantidad")
            )
            .select_from(modelo)
        )


        consulta = _aplicar_filtros(
            consulta,
            modelo,
            **filtros
        ).group_by(modelo.Proyecto)


        consultas.append(consulta)

    fuentes = union_all(*consultas).subquery(
        "fuentes_proyectos"
    )

    nombre = func.min(fuentes.c.proyecto)
    cantidad = func.sum(fuentes.c.cantidad)

    consulta = (
        select(
            nombre.label("proyecto"),
            cantidad.label("cantidad")
        )
        .select_from(fuentes)
        .group_by(
            func.lower(fuentes.c.proyecto)
        )
        .order_by(
            cantidad.desc(),
            nombre.asc()
        )
    )

    return [
        dict(fila)
        for fila in db.execute(consulta).mappings().all()
    ]


def obtener_top_proyectos_mensual(
    db: Session,
    *,
    desde: date | None = None,
    hasta: date | None = None,
    grupo_resolutor: str | None = None,
    proyecto: str | None = None,
) -> list[dict]:

    filtros = {
        "desde": desde,
        "hasta": hasta,
        "grupo_resolutor": grupo_resolutor,
        "proyecto": proyecto,
    }

    consultas = []

    for modelo in MODELOS:

        nombre = _normalizar_texto(modelo.Proyecto)
        anio = func.year(modelo.Fecha_Apertura)
        mes = func.month(modelo.Fecha_Apertura)

        consulta = (
            select(
                nombre.label("proyecto"),
                anio.label("anio"),
                mes.label("mes"),
                func.count().label("tickets")
            )
            .select_from(modelo)
            .where(
                modelo.Fecha_Apertura.isnot(None)
            )
        )


        consulta = _aplicar_filtros(
            consulta,
            modelo,
            **filtros
        ).group_by(
            modelo.Proyecto,
            anio,
            mes
        )


        consultas.append(consulta)

    fuentes = union_all(*consultas).subquery(
        "fuentes_proyectos_mensuales"
    )

    nombre = func.min(fuentes.c.proyecto)
    total = func.sum(fuentes.c.tickets)

    consulta = (
        select(
            nombre.label("proyecto"),
            fuentes.c.anio,
            fuentes.c.mes,
            total.label("tickets")
        )
        .select_from(fuentes)
        .group_by(
            func.lower(fuentes.c.proyecto),
            fuentes.c.anio,
            fuentes.c.mes
        )
        .order_by(
            fuentes.c.anio,
            fuentes.c.mes,
            nombre
        )
    )

    return [
        dict(fila)
        for fila in db.execute(consulta).mappings().all()
    ]
