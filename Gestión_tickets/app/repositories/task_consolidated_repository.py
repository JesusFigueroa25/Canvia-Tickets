"""Persistencia y consultas SQL Server de Tareas Consolidadas."""

from datetime import date, timedelta

import pandas as pd
from sqlalchemy import case, delete, func, insert, select
from sqlalchemy.orm import Session

from app.models.task_consolidated_model import (
    TaskConsolidated,
    stg_task_consolidated_table,
)
from app.schemas.task_consolidated_schema import TaskConsolidatedDashboardFilters


# IMPORTACION - STAGING / NEW / CHANGED
def _dataframe_a_registros(df: pd.DataFrame) -> list[dict]:
    """Convertir los nulos de pandas a NULL para pyodbc/SQL Server."""
    limpio = df.copy().astype(object).where(pd.notna(df), None)
    return limpio.to_dict(orient="records")


def limpiar_staging(db: Session) -> None:
    db.execute(delete(stg_task_consolidated_table))


def cargar_staging(db: Session, df: pd.DataFrame) -> int:
    columnas = [columna.name for columna in stg_task_consolidated_table.columns]
    faltantes = [col for col in columnas if col not in df.columns]
    if faltantes:
        raise ValueError(f"Faltan columnas para staging de Tareas: {faltantes}")

    datos = _dataframe_a_registros(df[columnas])
    # 22 columnas por registro. 90 filas <= 2.100 parametros de SQL Server.
    tamano_lote = 90
    for inicio in range(0, len(datos), tamano_lote):
        lote = datos[inicio: inicio + tamano_lote]
        db.execute(insert(stg_task_consolidated_table), lote)
    return len(datos)


def obtener_staging(db: Session) -> pd.DataFrame:
    consulta = select(stg_task_consolidated_table)
    return pd.read_sql(consulta, db.connection())


def obtener_oficial(db: Session) -> pd.DataFrame:
    """Solo tickets ya existentes que aparecen en este staging."""
    columnas = [
        TaskConsolidated.__table__.c[col.name]
        for col in stg_task_consolidated_table.columns
    ]
    consulta = select(*columnas).select_from(
        TaskConsolidated.__table__.join(
            stg_task_consolidated_table,
            TaskConsolidated.Ticket_ID == stg_task_consolidated_table.c.Ticket_ID,
        )
    )
    return pd.read_sql(consulta, db.connection())


def insertar_nuevos(db: Session, df: pd.DataFrame) -> int:
    if df.empty:
        return 0
    registros = _dataframe_a_registros(df)
    db.execute(insert(TaskConsolidated.__table__), registros)
    return len(registros)


def actualizar_modificados(db: Session, df: pd.DataFrame) -> int:
    if df.empty:
        return 0
    registros = _dataframe_a_registros(df)
    db.bulk_update_mappings(TaskConsolidated, registros)
    return len(registros)


# FILTROS REUTILIZABLES
def normalizar_proyecto():
    return func.coalesce(
        func.nullif(func.trim(TaskConsolidated.Proyecto), ""),
        "Sin especificar",
    )


def normalizar_tipo_tarea():
    return func.coalesce(
        func.nullif(func.trim(TaskConsolidated.Categorizacion_Nivel_3), ""),
        "Sin especificar",
    )


def normalizar_prioridad():
    return func.coalesce(
        func.nullif(func.trim(TaskConsolidated.Prioridad), ""),
        "Sin especificar",
    )


def _normalizar_selecciones(valores: list[str] | None) -> list[str]:
    if not valores:
        return []
    if isinstance(valores, str):
        valores = [valores]
    resultado = []
    vistos = set()
    for valor in valores:
        if not isinstance(valor, str):
            continue
        limpio = valor.strip()
        clave = limpio.casefold()
        if limpio and clave not in vistos:
            resultado.append(clave)
            vistos.add(clave)
    return resultado


def obtener_rango_periodo(periodo: str) -> tuple[date, date]:
    inicio = date.fromisoformat(f"{periodo}-01")
    if inicio.month == 12:
        fin = date(inicio.year + 1, 1, 1)
    else:
        fin = date(inicio.year, inicio.month + 1, 1)
    return inicio, fin


def aplicar_filtros_dashboard(consulta, filtros: TaskConsolidatedDashboardFilters):
    """Aplicar exactamente el mismo universo filtrado a todos los endpoints."""
    if filtros.desde:
        consulta = consulta.where(TaskConsolidated.Fecha_Apertura >= filtros.desde)
    if filtros.hasta:
        consulta = consulta.where(
            TaskConsolidated.Fecha_Apertura < filtros.hasta + timedelta(days=1)
        )

    if filtros.prioridad and filtros.prioridad.strip():
        consulta = consulta.where(
            func.trim(TaskConsolidated.Prioridad) == filtros.prioridad.strip()
        )
    if filtros.motivo_estado and filtros.motivo_estado.strip():
        consulta = consulta.where(
            func.trim(TaskConsolidated.Motivo_Estado) == filtros.motivo_estado.strip()
        )
    if filtros.grupo_resolutor and filtros.grupo_resolutor.strip():
        consulta = consulta.where(
            func.trim(TaskConsolidated.Grupo_Resolutor)
            == filtros.grupo_resolutor.strip()
        )

    if filtros.proyecto and filtros.proyecto.strip():
        consulta = consulta.where(
            func.lower(normalizar_proyecto()) == filtros.proyecto.strip().lower()
        )

    excluidos = _normalizar_selecciones(filtros.proyectos_excluidos)
    if excluidos:
        consulta = consulta.where(func.lower(normalizar_proyecto()).notin_(excluidos))

    if filtros.periodo:
        inicio, fin = obtener_rango_periodo(filtros.periodo)
        consulta = consulta.where(
            TaskConsolidated.Fecha_Apertura >= inicio,
            TaskConsolidated.Fecha_Apertura < fin,
        )

    tipos = _normalizar_selecciones(filtros.tipo_tarea)
    if tipos:
        consulta = consulta.where(func.lower(normalizar_tipo_tarea()).in_(tipos))

    if filtros.ticket_id and filtros.ticket_id.strip():
        consulta = consulta.where(
            TaskConsolidated.Ticket_ID == filtros.ticket_id.strip()
        )

    return consulta


# OPCIONES DE FILTROS
def obtener_opciones_filtros(db: Session) -> dict:
    fechas = db.execute(
        select(
            func.min(TaskConsolidated.Fecha_Apertura).label("fecha_min"),
            func.max(TaskConsolidated.Fecha_Apertura).label("fecha_max"),
        )
    ).mappings().one()

    def obtener_opciones(columna) -> list[str]:
        limpio = func.trim(columna)
        consulta = (
            select(limpio)
            .where(columna.isnot(None), limpio != "")
            .distinct()
            .order_by(limpio)
        )
        return list(db.execute(consulta).scalars().all())

    return {
        "fecha_min": fechas["fecha_min"],
        "fecha_max": fechas["fecha_max"],
        "prioridades": obtener_opciones(TaskConsolidated.Prioridad),
        "motivos_estado": obtener_opciones(TaskConsolidated.Motivo_Estado),
        "grupos_resolutores": obtener_opciones(TaskConsolidated.Grupo_Resolutor),
        "proyectos": obtener_opciones(TaskConsolidated.Proyecto),
        "tipos_tarea": obtener_opciones(TaskConsolidated.Categorizacion_Nivel_3),
    }


# KPIS
def obtener_kpis(db: Session, filtros: TaskConsolidatedDashboardFilters):
    proyecto_distinto = func.nullif(func.trim(TaskConsolidated.Proyecto), "")
    consulta = select(
        func.count().label("total_tickets"),
        func.count(func.distinct(proyecto_distinto)).label("total_proyectos"),
        func.sum(
            case((func.trim(TaskConsolidated.Prioridad) == "1-Critical", 1), else_=0)
        ).label("alta_criticidad"),
    ).select_from(TaskConsolidated)
    consulta = aplicar_filtros_dashboard(consulta, filtros)
    return db.execute(consulta).mappings().one()


# VOLUMEN MENSUAL
def obtener_volumen_mensual(db: Session, filtros: TaskConsolidatedDashboardFilters):
    anio = func.year(TaskConsolidated.Fecha_Apertura)
    mes = func.month(TaskConsolidated.Fecha_Apertura)
    consulta = (
        select(anio.label("anio"), mes.label("mes"), func.count().label("tickets"))
        .select_from(TaskConsolidated)
        .group_by(anio, mes)
        .order_by(anio, mes)
    )
    consulta = aplicar_filtros_dashboard(consulta, filtros)
    return db.execute(consulta).all()


# EXPLORADOR POR PROYECTOS
def obtener_proyectos(db: Session, filtros: TaskConsolidatedDashboardFilters):
    base = select(normalizar_proyecto().label("proyecto")).select_from(TaskConsolidated)
    datos = aplicar_filtros_dashboard(base, filtros).subquery()
    consulta = (
        select(datos.c.proyecto, func.count().label("cantidad"))
        .select_from(datos)
        .group_by(datos.c.proyecto)
        .order_by(func.count().desc(), datos.c.proyecto.asc())
    )
    return db.execute(consulta).mappings().all()


# DISTRIBUCION POR TIPO (CATEGORIZACION NIVEL 3)
def obtener_tipos(db: Session, filtros: TaskConsolidatedDashboardFilters, limite: int = 10):
    base = select(normalizar_tipo_tarea().label("tipo")).select_from(TaskConsolidated)
    datos = aplicar_filtros_dashboard(base, filtros).subquery()
    consulta = (
        select(
            func.min(datos.c.tipo).label("tipo_tarea"),
            func.count().label("cantidad"),
        )
        .select_from(datos)
        .group_by(func.lower(datos.c.tipo))
        .order_by(func.count().desc(), func.min(datos.c.tipo).asc())
        .limit(limite)
    )
    return db.execute(consulta).mappings().all()


# DISTRIBUCION POR PRIORIDAD
def obtener_prioridades(db: Session, filtros: TaskConsolidatedDashboardFilters):
    base = select(normalizar_prioridad().label("prioridad")).select_from(TaskConsolidated)
    datos = aplicar_filtros_dashboard(base, filtros).subquery()
    consulta = (
        select(datos.c.prioridad, func.count().label("cantidad"))
        .select_from(datos)
        .group_by(datos.c.prioridad)
        .order_by(func.count().desc(), datos.c.prioridad.asc())
    )
    return db.execute(consulta).mappings().all()


# TOP PROYECTOS POR MES
def obtener_top_proyectos_mensual(db: Session, filtros: TaskConsolidatedDashboardFilters):
    base = (
        select(
            normalizar_proyecto().label("proyecto"),
            func.year(TaskConsolidated.Fecha_Apertura).label("anio"),
            func.month(TaskConsolidated.Fecha_Apertura).label("mes"),
        )
        .select_from(TaskConsolidated)
    )
    datos = aplicar_filtros_dashboard(base, filtros).subquery()
    consulta = (
        select(
            datos.c.proyecto,
            datos.c.anio,
            datos.c.mes,
            func.count().label("tickets"),
        )
        .select_from(datos)
        .group_by(datos.c.proyecto, datos.c.anio, datos.c.mes)
        .order_by(datos.c.anio, datos.c.mes, datos.c.proyecto)
    )
    return db.execute(consulta).mappings().all()


# PRIORIDAD MENSUAL
def obtener_prioridad_mensual(db: Session, filtros: TaskConsolidatedDashboardFilters):
    base = (
        select(
            func.year(TaskConsolidated.Fecha_Apertura).label("anio"),
            func.month(TaskConsolidated.Fecha_Apertura).label("mes"),
            normalizar_prioridad().label("prioridad"),
        )
        .select_from(TaskConsolidated)
    )
    datos = aplicar_filtros_dashboard(base, filtros).subquery()
    consulta = (
        select(
            datos.c.anio,
            datos.c.mes,
            datos.c.prioridad,
            func.count().label("cantidad"),
        )
        .select_from(datos)
        .group_by(datos.c.anio, datos.c.mes, datos.c.prioridad)
        .order_by(datos.c.anio, datos.c.mes)
    )
    return db.execute(consulta).mappings().all()


# EXPLORADOR PAGINADO DE TICKETS
def obtener_tickets(
    db: Session,
    filtros: TaskConsolidatedDashboardFilters,
    pagina: int = 1,
    tamano: int = 10,
) -> dict:
    contar = select(func.count()).select_from(TaskConsolidated)
    contar = aplicar_filtros_dashboard(contar, filtros)
    total = db.execute(contar).scalar_one()

    consulta = select(*TaskConsolidated.__table__.columns).select_from(TaskConsolidated)
    consulta = aplicar_filtros_dashboard(consulta, filtros)
    consulta = (
        consulta.order_by(
            TaskConsolidated.Fecha_Apertura.desc(),
            TaskConsolidated.Ticket_ID.desc(),
        )
        .offset((pagina - 1) * tamano)
        .limit(tamano)
    )
    registros = db.execute(consulta).mappings().all()
    return {"tickets": [dict(row) for row in registros], "total": total}
