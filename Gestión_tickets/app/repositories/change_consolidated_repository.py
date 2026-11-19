"""Persistencia e indicadores SQL Server de Cambios Consolidados."""

from datetime import date, timedelta

import pandas as pd
from sqlalchemy import case, delete, func, insert, select
from sqlalchemy.orm import Session

from app.models.change_consolidated_model import (
    ChangeConsolidated,
    stg_change_consolidated_table,
)
from app.schemas.change_consolidated_schema import ChangeConsolidatedDashboardFilters


# STAGING Y DETECTOR NEW / CHANGED / SAME

def _dataframe_a_registros(df: pd.DataFrame) -> list[dict]:
    """Convierte valores pandas faltantes a NULL para pyodbc."""
    limpio = df.copy().astype(object).where(pd.notna(df), None)
    return limpio.to_dict(orient="records")


def limpiar_staging(db: Session) -> None:
    db.execute(delete(stg_change_consolidated_table))


def cargar_staging(db: Session, df: pd.DataFrame) -> int:
    columnas = [columna.name for columna in stg_change_consolidated_table.columns]
    faltantes = [col for col in columnas if col not in df.columns]
    if faltantes:
        raise ValueError(f"Faltan columnas para staging de Cambios: {faltantes}")
    registros = _dataframe_a_registros(df[columnas])

    # 31 columnas x 50 filas = 1550 parametros (< 2100 de SQL Server).
    tamano_lote = 50
    for inicio in range(0, len(registros), tamano_lote):
        db.execute(
            insert(stg_change_consolidated_table),
            registros[inicio: inicio + tamano_lote],
        )
    return len(registros)


def obtener_staging(db: Session) -> pd.DataFrame:
    return pd.read_sql(select(stg_change_consolidated_table), db.connection())


def obtener_oficial(db: Session) -> pd.DataFrame:
    """Recupera solo tickets oficiales presentes en staging, no toda la tabla."""
    columnas = [
        ChangeConsolidated.__table__.c[col.name]
        for col in stg_change_consolidated_table.columns
    ]
    consulta = select(*columnas).select_from(
        ChangeConsolidated.__table__.join(
            stg_change_consolidated_table,
            ChangeConsolidated.Ticket_ID == stg_change_consolidated_table.c.Ticket_ID,
        )
    )
    return pd.read_sql(consulta, db.connection())


def insertar_nuevos(db: Session, df: pd.DataFrame) -> int:
    if df.empty:
        return 0
    # Bulk insert con lotes conservadores para no exceder el máximo de parámetros.
    registros = _dataframe_a_registros(df)
    for inicio in range(0, len(registros), 50):
        db.execute(
            insert(ChangeConsolidated.__table__), registros[inicio: inicio + 50]
        )
    return len(registros)


def actualizar_modificados(db: Session, df: pd.DataFrame) -> int:
    if df.empty:
        return 0
    registros = _dataframe_a_registros(df)
    # Misma estrategia ya utilizada por el repositorio de Tareas Consolidadas.
    db.bulk_update_mappings(ChangeConsolidated, registros)
    return len(registros)


# FILTROS Y KPIS

def normalizar_proyecto():
    return func.coalesce(
        func.nullif(func.trim(ChangeConsolidated.Proyecto), ""),
        "Sin especificar",
    )


def normalizar_tipo_cambio():
    return func.coalesce(
        func.nullif(func.trim(ChangeConsolidated.Tipo_Cambio), ""),
        "Sin especificar",
    )


def _normalizar_selecciones(valores: list[str] | None) -> list[str]:
    resultado = []
    vistos = set()
    for valor in valores or []:
        if not isinstance(valor, str):
            continue
        limpio = valor.strip().casefold()
        if limpio and limpio not in vistos:
            resultado.append(limpio)
            vistos.add(limpio)
    return resultado


def _rango_periodo(periodo: str) -> tuple[date, date]:
    inicio = date.fromisoformat(f"{periodo}-01")
    if inicio.month == 12:
        fin = date(inicio.year + 1, 1, 1)
    else:
        fin = date(inicio.year, inicio.month + 1, 1)
    return inicio, fin


def aplicar_filtros_dashboard(consulta, filtros: ChangeConsolidatedDashboardFilters):
    """Filtro común para KPIs y próximos endpoints del dashboard."""
    if filtros.desde:
        consulta = consulta.where(ChangeConsolidated.Fecha_Creacion >= filtros.desde)
    if filtros.hasta:
        consulta = consulta.where(
            ChangeConsolidated.Fecha_Creacion < filtros.hasta + timedelta(days=1)
        )
    if filtros.prioridad and filtros.prioridad.strip():
        consulta = consulta.where(
            func.trim(ChangeConsolidated.Prioridad) == filtros.prioridad.strip()
        )
    if filtros.motivo and filtros.motivo.strip():
        consulta = consulta.where(
            func.trim(ChangeConsolidated.Motivo) == filtros.motivo.strip()
        )
    if filtros.grupo_resolutor and filtros.grupo_resolutor.strip():
        consulta = consulta.where(
            func.trim(ChangeConsolidated.Grupo_Resolutor)
            == filtros.grupo_resolutor.strip()
        )
    if filtros.estado and filtros.estado.strip():
        consulta = consulta.where(
            func.trim(ChangeConsolidated.Estado) == filtros.estado.strip()
        )
    if filtros.proyecto and filtros.proyecto.strip():
        consulta = consulta.where(
            func.lower(normalizar_proyecto()) == filtros.proyecto.strip().lower()
        )
    excluidos = _normalizar_selecciones(filtros.proyectos_excluidos)
    if excluidos:
        consulta = consulta.where(func.lower(normalizar_proyecto()).notin_(excluidos))
    if filtros.periodo:
        inicio, fin = _rango_periodo(filtros.periodo)
        consulta = consulta.where(
            ChangeConsolidated.Fecha_Creacion >= inicio,
            ChangeConsolidated.Fecha_Creacion < fin,
        )
    tipos = _normalizar_selecciones(filtros.tipo_cambio)
    if tipos:
        consulta = consulta.where(func.lower(normalizar_tipo_cambio()).in_(tipos))
    if filtros.ticket_id and filtros.ticket_id.strip():
        consulta = consulta.where(
            ChangeConsolidated.Ticket_ID == filtros.ticket_id.strip()
        )
    return consulta


def obtener_opciones_filtros(db: Session) -> dict:
    fechas = db.execute(
        select(
            func.min(ChangeConsolidated.Fecha_Creacion).label("fecha_min"),
            func.max(ChangeConsolidated.Fecha_Creacion).label("fecha_max"),
        )
    ).mappings().one()

    def opciones(columna) -> list[str]:
        normal = func.trim(columna)
        consulta = (
            select(normal)
            .where(columna.isnot(None), normal != "")
            .distinct()
            .order_by(normal)
        )
        return list(db.execute(consulta).scalars().all())

    return {
        "fecha_min": fechas["fecha_min"],
        "fecha_max": fechas["fecha_max"],
        "prioridades": opciones(ChangeConsolidated.Prioridad),
        "motivos": opciones(ChangeConsolidated.Motivo),
        "grupos_resolutores": opciones(ChangeConsolidated.Grupo_Resolutor),
        "estados": opciones(ChangeConsolidated.Estado),
        "proyectos": opciones(ChangeConsolidated.Proyecto),
        "tipos_cambio": opciones(ChangeConsolidated.Tipo_Cambio),
    }


def obtener_kpis(db: Session, filtros: ChangeConsolidatedDashboardFilters):
    proyecto = func.nullif(func.trim(ChangeConsolidated.Proyecto), "")
    consulta = select(
        func.count().label("total_tickets"),
        func.count(func.distinct(proyecto)).label("total_proyectos"),
        func.sum(
            case((func.trim(ChangeConsolidated.Prioridad) == "1-Critical", 1), else_=0)
        ).label("alta_criticidad"),
    ).select_from(ChangeConsolidated)
    return db.execute(aplicar_filtros_dashboard(consulta, filtros)).mappings().one()


# SIETE CONSULTAS DE DASHBOARD
# Nota: todas reutilizan aplicar_filtros_dashboard() y Fecha_Creacion.

def normalizar_prioridad():
    return func.coalesce(
        func.nullif(func.trim(ChangeConsolidated.Prioridad), ""),
        "Sin especificar",
    )


def obtener_volumen_mensual(db: Session, filtros: ChangeConsolidatedDashboardFilters):
    anio = func.year(ChangeConsolidated.Fecha_Creacion)
    mes = func.month(ChangeConsolidated.Fecha_Creacion)
    consulta = (
        select(anio.label("anio"), mes.label("mes"), func.count().label("tickets"))
        .select_from(ChangeConsolidated)
        .group_by(anio, mes)
        .order_by(anio, mes)
    )
    consulta = aplicar_filtros_dashboard(consulta, filtros)
    return db.execute(consulta).all()


def obtener_proyectos(db: Session, filtros: ChangeConsolidatedDashboardFilters):
    base = select(normalizar_proyecto().label("proyecto")).select_from(ChangeConsolidated)
    datos = aplicar_filtros_dashboard(base, filtros).subquery()
    consulta = (
        select(datos.c.proyecto, func.count().label("cantidad"))
        .select_from(datos)
        .group_by(datos.c.proyecto)
        .order_by(func.count().desc(), datos.c.proyecto.asc())
    )
    return db.execute(consulta).mappings().all()


def obtener_tipos(
    db: Session, filtros: ChangeConsolidatedDashboardFilters, limite: int = 10
):
    """Agrupa por Tipo_Cambio (Normal, Standard, Emergency, Exception)."""
    base = select(normalizar_tipo_cambio().label("tipo")).select_from(ChangeConsolidated)
    datos = aplicar_filtros_dashboard(base, filtros).subquery()
    consulta = (
        select(
            func.min(datos.c.tipo).label("tipo_cambio"),
            func.count().label("cantidad"),
        )
        .select_from(datos)
        .group_by(func.lower(datos.c.tipo))
        .order_by(func.count().desc(), func.min(datos.c.tipo).asc())
        .limit(limite)
    )
    return db.execute(consulta).mappings().all()


def obtener_prioridades(db: Session, filtros: ChangeConsolidatedDashboardFilters):
    base = select(normalizar_prioridad().label("prioridad")).select_from(ChangeConsolidated)
    datos = aplicar_filtros_dashboard(base, filtros).subquery()
    consulta = (
        select(datos.c.prioridad, func.count().label("cantidad"))
        .select_from(datos)
        .group_by(datos.c.prioridad)
        .order_by(func.count().desc(), datos.c.prioridad.asc())
    )
    return db.execute(consulta).mappings().all()


def obtener_top_proyectos_mensual(
    db: Session, filtros: ChangeConsolidatedDashboardFilters
):
    base = (
        select(
            normalizar_proyecto().label("proyecto"),
            func.year(ChangeConsolidated.Fecha_Creacion).label("anio"),
            func.month(ChangeConsolidated.Fecha_Creacion).label("mes"),
        )
        .select_from(ChangeConsolidated)
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


def obtener_prioridad_mensual(
    db: Session, filtros: ChangeConsolidatedDashboardFilters
):
    base = (
        select(
            func.year(ChangeConsolidated.Fecha_Creacion).label("anio"),
            func.month(ChangeConsolidated.Fecha_Creacion).label("mes"),
            normalizar_prioridad().label("prioridad"),
        )
        .select_from(ChangeConsolidated)
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
        .order_by(datos.c.anio, datos.c.mes, datos.c.prioridad)
    )
    return db.execute(consulta).mappings().all()


def obtener_tickets(
    db: Session,
    filtros: ChangeConsolidatedDashboardFilters,
    pagina: int = 1,
    tamano: int = 10,
) -> dict:
    contar = select(func.count()).select_from(ChangeConsolidated)
    total = db.execute(aplicar_filtros_dashboard(contar, filtros)).scalar_one()

    consulta = select(*ChangeConsolidated.__table__.columns).select_from(ChangeConsolidated)
    consulta = aplicar_filtros_dashboard(consulta, filtros)
    consulta = (
        consulta.order_by(
            ChangeConsolidated.Fecha_Creacion.desc(),
            ChangeConsolidated.Ticket_ID.desc(),
        )
        .offset((pagina - 1) * tamano)
        .limit(tamano)
    )
    registros = db.execute(consulta).mappings().all()
    return {"tickets": [dict(row) for row in registros], "total": int(total)}


# NORMALIZAR CATEGORIA NIVEL 3
def normalizar_categoria():
    return func.coalesce(
        func.nullif(func.trim(ChangeConsolidated.Categorizacion_Nivel_3), ""),
        "Sin especificar",
    )


# DISTRIBUCION POR CATEGORIA (Categorizacion_Nivel_3)
def obtener_categorias(
    db: Session,
    filtros: ChangeConsolidatedDashboardFilters,
    limite: int = 10,
):
    base = (
        select(
            normalizar_categoria().label("categoria")
        )
        .select_from(ChangeConsolidated)
    )

    datos = aplicar_filtros_dashboard(base, filtros).subquery()

    consulta = (
        select(
            func.min(datos.c.categoria).label("categoria"),
            func.count().label("cantidad"),
        )
        .select_from(datos)
        .group_by(func.lower(datos.c.categoria))
        .order_by(
            func.count().desc(),
            func.min(datos.c.categoria).asc(),
        )
        .limit(limite)
    )

    return db.execute(consulta).mappings().all()