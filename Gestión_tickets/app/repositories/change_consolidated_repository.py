"""Persistencia e indicadores SQL Server de Cambios Consolidados."""

from datetime import date, timedelta

import pandas as pd
from sqlalchemy import case, delete, func, insert, select, text
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
# ================================================================
# ANALISIS DE ACTIVIDADES Y HORAS DE CAMBIOS (PRD 05)
# No crea tablas ni necesita que dos solicitudes compartan una sesión.
# La lógica SQL se conserva como CTEs reutilizables por endpoint.
# ================================================================


_GRUPO_BD_CAMBIOS = "BASE DE DATOS Y EBS"
_GRUPO_WINTEL_CAMBIOS = "WINTEL SO y AP"

# Bloque 1: clasificación y exclusiones de la consulta de referencia.
_SQL_CAMBIOS_ACTIVIDADES = r"""WITH TareasAgrupadas AS (SELECT
        Ticket_Padre,
        COUNT(CASE
            WHEN Grupo_Resolutor = :grupo_bd
                AND Estado = 'Closed'
                AND Motivo_Estado = 'Realizada'
            THEN 1
        END) AS Total_Tareas_BD,

        COUNT(CASE
            WHEN Grupo_Resolutor = :grupo_wintel
            THEN 1
        END) AS Total_Tareas_Wintel

    FROM dbo.task_consolidated

    WHERE Grupo_Resolutor IN (:grupo_bd, :grupo_wintel)

    GROUP BY Ticket_Padre

),
-- FILTROS GENERALES
CambiosBase AS (

    SELECT
        chg.*,

        ISNULL(t.Total_Tareas_BD, 0) AS Total_Tareas_BD,
        ISNULL(t.Total_Tareas_Wintel, 0) AS Total_Tareas_Wintel,

        CASE
            WHEN chg.Grupo_Resolutor = :grupo_bd
                THEN 'RESOLUTOR PRINCIPAL'
            ELSE 'SOLO PARTICIPO'
        END AS Tipo_Participacion

    FROM dbo.change_consolidated chg

    LEFT JOIN TareasAgrupadas t
        ON t.Ticket_Padre = chg.Ticket_ID

    WHERE ISNULL(chg.Motivo, '') NOT LIKE '%Cancelled%'

    AND chg.Grupo_Resolutor NOT IN (
        'LINUX-UNIX SO Y AP',
        'LinuxUnix La Positiva'
    )

    AND ISNULL(chg.ALP, '') NOT IN (
        '104859', '106010', '100260',
        '100532', '100908', '103971',
        '106364', '105440', '106415',
        '109100', '106117', '106098',
        '105518', '105339', '105162'
    )

    AND (
        chg.Grupo_Resolutor = :grupo_bd

        OR (
            chg.Grupo_Resolutor <> :grupo_bd
            AND t.Total_Tareas_BD > 0
            AND t.Total_Tareas_Wintel > 0
        )
    )

    /* FILTROS_DASHBOARD */
),

-- TEXTOS DEL CAMBIO Y TAREAS DE BD
Textos AS (

    SELECT
        c.Ticket_ID AS Cambio_ID,
        c.Ticket_ID AS Ticket_Origen,
        'CAMBIO' AS Origen,

        CONCAT(
            ' ', c.Descripcion, ' ', c.Detalle, ' '
        ) COLLATE Latin1_General_100_CI_AI AS Texto

    FROM CambiosBase c

    UNION ALL

    SELECT
        c.Ticket_ID,
        t.Ticket_ID,
        'TAREA',

        CONCAT(
            ' ', t.Descripcion, ' ', t.Detalle, ' '
        ) COLLATE Latin1_General_100_CI_AI

    FROM CambiosBase c

    INNER JOIN dbo.task_consolidated t
        ON t.Ticket_Padre = c.Ticket_ID

    WHERE t.Grupo_Resolutor = :grupo_bd
        AND t.Estado = 'Closed'
        AND t.Motivo_Estado = 'Realizada'

),

-- IDENTIFICAR MOTOR Y CONTEXTO TECNICO

Motores AS (

    SELECT
        *,

        CASE
            WHEN Texto LIKE '%SQL Server%'
                OR Texto LIKE '%SQLServer%'
                OR Texto LIKE '%MSSQL%'
            THEN 1 ELSE 0
        END AS Es_SQL_Server,

        CASE
            WHEN Texto LIKE '%servicios SQL%'
                OR Texto LIKE '%servicio SQL%'
                OR Texto LIKE '%instancia SQL%'
                OR Texto LIKE '%parchado SQL%'
                OR Texto LIKE '%parchado de BD SQL%'
            THEN 1 ELSE 0
        END AS Es_SQL_Probable,

        CASE
            WHEN Texto LIKE '%Oracle%'
                OR Texto LIKE '%PostgreSQL%'
                OR Texto LIKE '%MySQL%'
                OR Texto LIKE '%MariaDB%'
                OR Texto LIKE '%DB2%'
                OR Texto LIKE '%SAP HANA%'
            THEN 1 ELSE 0
        END AS Es_Otro_Motor,

        CASE
            WHEN Texto LIKE '%base de dato%'
                OR Texto LIKE '%base datos%'
                OR Texto LIKE '% BD%'
                OR Texto LIKE '%SQL Server%'
                OR Texto LIKE '%SQLServer%'
                OR Texto LIKE '%MSSQL%'
                OR Texto LIKE '%servicio% SQL%'
                OR Texto LIKE '%instancia SQL%'
            THEN 1 ELSE 0
        END AS Es_Contexto_BD

    FROM Textos

),

-- IDENTIFICAR ACTIVIDADES ESPECIFICAS

Actividades AS (

    SELECT
        *,

        -- SUBIDA Y BAJADA DE SERVICIOS
        CASE
            WHEN Es_Contexto_BD = 1
            AND (
                Texto LIKE '%subida y bajada de%servicio%'
                OR Texto LIKE '%bajada y subida de%servicio%'
                OR Texto LIKE '%bajar y subir%servicio%'
                OR Texto LIKE '%subir y bajar%servicio%'
                OR Texto LIKE '%bajar servicios%'
                OR Texto LIKE '%bajar los servicios%'
                OR Texto LIKE '%subir servicios%'
                OR Texto LIKE '%subir los servicios%'
                OR Texto LIKE '%bajada de servicio%'
                OR Texto LIKE '%subida de servicio%'
                OR Texto LIKE '%detener servicios%'
                OR Texto LIKE '%detener los servicios%'
                OR Texto LIKE '%iniciar servicios%'
                OR Texto LIKE '%iniciar los servicios%'
                OR Texto LIKE '%iniciar y validar los servicios%'
                OR Texto LIKE '%levantar servicios%'
                OR Texto LIKE '%levantar los servicios%'
                OR Texto LIKE '%reiniciar servicios%'
                OR Texto LIKE '%reinicio de servicios%'
                OR Texto LIKE '%detener instancia%'
                OR Texto LIKE '%iniciar instancia%'
            )
            THEN 1 ELSE 0
        END AS Es_Subida_Bajada,

        -- BAJA DE INSTANCIAS O BD
        -- CORRECCION INCORPORADA EN V2.1
        CASE
            WHEN (
                Es_Contexto_BD = 1

                OR (
                    Origen = 'CAMBIO'
                    AND EXISTS (
                        SELECT 1
                        FROM CambiosBase cb
                        WHERE cb.Ticket_ID = Motores.Cambio_ID
                        AND cb.Grupo_Resolutor = :grupo_bd
                        AND cb.Categorizacion_Nivel_1 =
                            'BASE DE DATOS Administracion'
                        AND cb.Categorizacion_Nivel_3 =
                            'Mantenimiento BD'
                    )
                )
            )
            AND (
                Texto LIKE '%baja de instancia%'
                OR Texto LIKE '%baja instancia%'
                OR Texto LIKE '%bajainstancia%'
                OR Texto LIKE '%baja de las siguientes instancia%'
                OR Texto LIKE '%eliminar instancia%'
                OR Texto LIKE '%deshabilitar instancia%'
                OR Texto LIKE '%desinstalar instancia%'
                OR (
                    Texto LIKE '%baja%'
                    AND Texto LIKE '%offline%'
                )
            )
            THEN 1 ELSE 0
        END AS Es_Baja_Instancia,

        -- VALIDACIONES OPERATIVAS
        CASE
            WHEN Es_Contexto_BD = 1
            AND (
                Texto LIKE '%validacion de servicios%'
                OR Texto LIKE '%validacion de los servicios%'
                OR Texto LIKE '%validar servicios%'
                OR Texto LIKE '%validar los servicios%'
                OR Texto LIKE '%validar disponibilidad, servicios%'
                OR (
                    Texto LIKE '%vali%'
                    AND Texto LIKE '%BD ONLINE%'
                    AND (
                        Texto LIKE '%JOB ACTIVOS%'
                        OR Texto LIKE '%REPLICAS EN FUNCIONAMIENTO%'
                    )
                )
            )
            THEN 1 ELSE 0
        END AS Es_Validacion

    FROM Motores

),

-- AGRUPAR EVIDENCIAS POR CAMBIO

EvidenciasAgrupadas AS (

    SELECT
        Cambio_ID,

        MAX(Es_SQL_Server) AS Es_SQL_Server,
        MAX(Es_SQL_Probable) AS Es_SQL_Probable,
        MAX(Es_Otro_Motor) AS Es_Otro_Motor,

        MAX(Es_Subida_Bajada) AS Es_Subida_Bajada,
        MAX(Es_Baja_Instancia) AS Es_Baja_Instancia,
        MAX(Es_Validacion) AS Es_Validacion,

        MAX(CASE
            WHEN Es_Subida_Bajada = 1
                OR Es_Baja_Instancia = 1
                OR Es_Validacion = 1
            THEN Ticket_Origen
        END) AS Ticket_Evidencia

    FROM Actividades

    GROUP BY Cambio_ID

),
CambiosFiltradosV2 AS (
SELECT
    c.*,

    CASE
        WHEN e.Es_Otro_Motor = 1
            AND (
                e.Es_SQL_Server = 1
                OR e.Es_SQL_Probable = 1
            )
            THEN 'MOTORES MIXTOS - REVISAR'

        WHEN e.Es_SQL_Server = 1
            THEN 'SQL SERVER EXPLICITO'

        WHEN e.Es_SQL_Probable = 1
            THEN 'SQL SERVER PROBABLE'

        ELSE 'BD GENERICA - REVISAR'
    END AS Clasificacion_Evidencia,

    CASE
        WHEN e.Es_Baja_Instancia = 1
            THEN 'BAJA DE INSTANCIA O BD'

        WHEN e.Es_Subida_Bajada = 1
            THEN 'SUBIDA Y BAJADA DE SERVICIOS'

        WHEN e.Es_Validacion = 1
            THEN 'SOLO VALIDACION OPERATIVA'
    END AS Tipo_Actividad,

    e.Es_Subida_Bajada,
    e.Es_Baja_Instancia,
    e.Es_Validacion,
    e.Ticket_Evidencia



FROM CambiosBase c

INNER JOIN EvidenciasAgrupadas e
    ON e.Cambio_ID = c.Ticket_ID

WHERE (
    e.Es_Subida_Bajada = 1
    OR e.Es_Baja_Instancia = 1
    OR (
        :incluir_solo_validacion = 1
        AND e.Es_Validacion = 1
    )
)

AND (
    e.Es_Otro_Motor = 0
    OR e.Es_SQL_Server = 1
    OR e.Es_SQL_Probable = 1
)
)"""

# Bloques 2, 3 y 4: deduplicación de tiempos por resolutor en
# todos los cambios incluidos, NO por Cambio_ID ni por Tarea_ID.
_SQL_INTERVALOS_CAMBIOS = r"""TiemposBD AS (
SELECT
        c.Ticket_ID AS Cambio_ID,
        c.Fecha_Creacion,
        t.Ticket_ID AS Tarea_ID,
        trt.Report_Time_ID,
        NULLIF(TRIM(trt.Nombre_Resolutor), '') AS Resolutor,
        trt.Action_Start_Date AS Inicio,
        trt.Action_End_Date AS Fin

    FROM CambiosFiltradosV2 c

    INNER JOIN dbo.task_consolidated t
        ON t.Ticket_Padre = c.Ticket_ID

    INNER JOIN dbo.tickets_report_times trt
        ON trt.Ticket_ID = t.Ticket_ID

    WHERE 
        trt.Grupo_Resolutor = 'BASE DE DATOS Y EBS'
        AND t.Estado = 'Closed'
        AND t.Motivo_Estado = 'Realizada'
        AND trt.Estado = 'Closed'
        AND trt.Motivo = 'Realizada'
        AND trt.Action_End_Date >= trt.Action_Start_Date

),

Intervalos AS (

    SELECT
        *,

        MAX(Fin) OVER (
            PARTITION BY
                Resolutor,
                CASE WHEN Resolutor IS NULL
                    THEN Report_Time_ID
                END
            ORDER BY Inicio, Fin, Report_Time_ID
            ROWS BETWEEN UNBOUNDED PRECEDING
                AND 1 PRECEDING
        ) AS Fin_Anterior

    FROM TiemposBD

),
HorasCalculadasBD AS (
SELECT
    Cambio_ID,
    Fecha_Creacion,
    Tarea_ID,
    Report_Time_ID,
    Resolutor,

    CASE
        WHEN Fin_Anterior >= Fin THEN 0

        WHEN Fin_Anterior > Inicio
            THEN DATEDIFF_BIG(
                SECOND, Fin_Anterior, Fin
            )

        ELSE DATEDIFF_BIG(SECOND, Inicio, Fin)

    END AS Segundos_Sin_Solapamiento



FROM Intervalos
)"""


def _filtros_actividades_sql(filtros: ChangeConsolidatedDashboardFilters) -> tuple[str, dict]:
    """Filtros equivalentes a aplicar_filtros_dashboard, sobre el cambio padre.

    Para grupo_resolutor=BASE DE DATOS Y EBS se mantiene la participación
    de BD, incluso cuando el cambio pertenece a otro grupo principal.
    Esto permite conservar las 102 coincidencias del SQL sin filtros.
    """
    condiciones: list[str] = []
    parametros: dict = {}

    if filtros.desde:
        condiciones.append("chg.Fecha_Creacion >= :desde")
        parametros["desde"] = filtros.desde
    if filtros.hasta:
        condiciones.append("chg.Fecha_Creacion < :hasta_exclusivo")
        parametros["hasta_exclusivo"] = filtros.hasta + timedelta(days=1)
    if filtros.periodo:
        inicio_periodo, fin_periodo = _rango_periodo(filtros.periodo)
        condiciones.extend([
            "chg.Fecha_Creacion >= :inicio_periodo",
            "chg.Fecha_Creacion < :fin_periodo",
        ])
        parametros.update(inicio_periodo=inicio_periodo, fin_periodo=fin_periodo)

    for campo in ("prioridad", "motivo", "estado", "ticket_id"):
        valor = getattr(filtros, campo)
        if not valor or not valor.strip():
            continue
        parametros[campo] = valor.strip()
        if campo == "ticket_id":
            condiciones.append("chg.Ticket_ID = :ticket_id")
        else:
            columna = {"prioridad": "Prioridad", "motivo": "Motivo", "estado": "Estado"}[campo]
            condiciones.append(f"TRIM(chg.{columna}) = :{campo}")

    if filtros.grupo_resolutor and filtros.grupo_resolutor.strip():
        grupo = filtros.grupo_resolutor.strip()
        if grupo.casefold() != _GRUPO_BD_CAMBIOS.casefold():
            condiciones.append("TRIM(chg.Grupo_Resolutor) = :grupo_resolutor")
            parametros["grupo_resolutor"] = grupo

    proyecto_normalizado = "COALESCE(NULLIF(TRIM(chg.Proyecto), ''), 'Sin especificar')"
    if filtros.proyecto and filtros.proyecto.strip():
        condiciones.append(f"LOWER({proyecto_normalizado}) = :proyecto")
        parametros["proyecto"] = filtros.proyecto.strip().lower()

    excluidos = _normalizar_selecciones(filtros.proyectos_excluidos)
    if excluidos:
        llaves = []
        for i, valor in enumerate(excluidos):
            nombre = f"proyecto_excluido_{i}"
            llaves.append(f":{nombre}")
            parametros[nombre] = valor
        condiciones.append(f"LOWER({proyecto_normalizado}) NOT IN ({', '.join(llaves)})")

    tipos = _normalizar_selecciones(filtros.tipo_cambio)
    if tipos:
        llaves = []
        for i, valor in enumerate(tipos):
            nombre = f"tipo_cambio_{i}"
            llaves.append(f":{nombre}")
            parametros[nombre] = valor
        tipo_normalizado = "COALESCE(NULLIF(TRIM(chg.Tipo_Cambio), ''), 'Sin especificar')"
        condiciones.append(f"LOWER({tipo_normalizado}) IN ({', '.join(llaves)})")

    return "".join(f"\n    AND {condicion}" for condicion in condiciones), parametros


def _sql_base_actividades(
    filtros: ChangeConsolidatedDashboardFilters,
    incluir_solo_validacion: bool,
    *,
    incluir_horas: bool = False,
) -> tuple[str, dict]:
    extra, valores = _filtros_actividades_sql(filtros)
    sql_base = _SQL_CAMBIOS_ACTIVIDADES.replace("/* FILTROS_DASHBOARD */", extra)
    if incluir_horas:
        # CTEs adicionales comparten una sola sentencia SQL en cada solicitud.
        sql_base += ",\n" + _SQL_INTERVALOS_CAMBIOS
    parametros = {
        "grupo_bd": _GRUPO_BD_CAMBIOS,
        "grupo_wintel": _GRUPO_WINTEL_CAMBIOS,
        "incluir_solo_validacion": incluir_solo_validacion,
        **valores,
    }
    return sql_base, parametros


def _obtener_pagina_actividades(
    db: Session,
    filtros: ChangeConsolidatedDashboardFilters,
    incluir_solo_validacion: bool,
    pagina: int,
    tamano: int,
    *,
    incluir_horas: bool,
) -> dict:
    base, params = _sql_base_actividades(
        filtros, incluir_solo_validacion, incluir_horas=incluir_horas
    )
    params.update(offset=(pagina - 1) * tamano, tamano=tamano)
    if incluir_horas:
        base += """,
HorasPorCambio AS (
    SELECT
        Cambio_ID,
        COUNT(*) AS Registros_Tiempo_BD,
        COUNT(DISTINCT Resolutor) AS Total_Resolutores_BD,
        SUM(Segundos_Sin_Solapamiento) AS Segundos_Totales
    FROM HorasCalculadasBD
    GROUP BY Cambio_ID
)"""
        columnas = """
    c.Ticket_ID,
    c.Fecha_Creacion,
    c.ALP,
    c.Proyecto,
    c.Descripcion,
    c.Grupo_Resolutor,
    c.Nombre_Resolutor,
    c.Estado,
    c.Tipo_Participacion,
    c.Tipo_Actividad,
    c.Clasificacion_Evidencia,
    c.Total_Tareas_BD,
    c.Total_Tareas_Wintel,
    ISNULL(h.Registros_Tiempo_BD, 0) AS Registros_Tiempo_BD,
    ISNULL(h.Total_Resolutores_BD, 0) AS Total_Resolutores_BD,
    CAST(ISNULL(h.Segundos_Totales, 0) / 3600.0 AS DECIMAL(18,2)) AS Horas_Totales"""
        from_sql = "FROM CambiosFiltradosV2 c LEFT JOIN HorasPorCambio h ON h.Cambio_ID = c.Ticket_ID"
    else:
        columnas = "c.*"
        from_sql = "FROM CambiosFiltradosV2 c"

    consulta = f"""{base}
SELECT
    {columnas},
    COUNT_BIG(*) OVER() AS Total_Filas_Paginacion
{from_sql}
ORDER BY c.Fecha_Creacion ASC, c.Ticket_ID ASC
OFFSET :offset ROWS FETCH NEXT :tamano ROWS ONLY"""
    filas = [dict(row) for row in db.execute(text(consulta), params).mappings().all()]
    if filas:
        total = int(filas[0]["Total_Filas_Paginacion"])
        for fila in filas:
            fila.pop("Total_Filas_Paginacion", None)
    else:
        # Una página fuera de rango sigue informando el total real.
        base_conteo, parametros_conteo = _sql_base_actividades(
            filtros, incluir_solo_validacion
        )
        total = int(db.execute(
            text(base_conteo + "\nSELECT COUNT_BIG(*) FROM CambiosFiltradosV2"),
            parametros_conteo,
        ).scalar_one())
    return {"cambios": filas, "total": total}


def obtener_actividades_bd(
    db: Session,
    filtros: ChangeConsolidatedDashboardFilters,
    pagina: int = 1,
    tamano: int = 10,
    incluir_solo_validacion: bool = True,
) -> dict:
    """Bloque 1. Incluye clasificación de actividades y evidencia SQL."""
    return _obtener_pagina_actividades(
        db, filtros, incluir_solo_validacion, pagina, tamano, incluir_horas=False
    )


def obtener_horas_por_cambio(
    db: Session,
    filtros: ChangeConsolidatedDashboardFilters,
    pagina: int = 1,
    tamano: int = 10,
    incluir_solo_validacion: bool = True,
) -> dict:
    """Bloque 2. Horas sobre todos los intervalos del conjunto filtrado."""
    return _obtener_pagina_actividades(
        db, filtros, incluir_solo_validacion, pagina, tamano, incluir_horas=True
    )


def obtener_horas_por_resolutor(
    db: Session,
    filtros: ChangeConsolidatedDashboardFilters,
    incluir_solo_validacion: bool = True,
) -> list[dict]:
    """Bloque 3. Conserva GROUPING SETS y fila TOTAL GENERAL."""
    base, params = _sql_base_actividades(
        filtros, incluir_solo_validacion, incluir_horas=True
    )
    consulta = base + """
SELECT
    CASE
        WHEN GROUPING(Resolutor) = 1 THEN 'TOTAL GENERAL'
        ELSE ISNULL(Resolutor, 'SIN RESOLUTOR')
    END AS Resolutor,
    COUNT(*) AS Total_Registros,
    COUNT(DISTINCT Tarea_ID) AS Total_Tareas,
    CAST(SUM(Segundos_Sin_Solapamiento) / 3600.0 AS DECIMAL(18,2)) AS Horas_Totales
FROM HorasCalculadasBD
GROUP BY GROUPING SETS ((Resolutor), ())
ORDER BY GROUPING(Resolutor), Horas_Totales DESC"""
    return [dict(row) for row in db.execute(text(consulta), params).mappings().all()]


def obtener_horas_mensuales(
    db: Session,
    filtros: ChangeConsolidatedDashboardFilters,
    incluir_solo_validacion: bool = True,
) -> list[dict]:
    """Bloque 4. El período depende de Fecha_Creacion del cambio."""
    base, params = _sql_base_actividades(
        filtros, incluir_solo_validacion, incluir_horas=True
    )
    consulta = base + """
SELECT
    YEAR(Fecha_Creacion) AS Anio,
    MONTH(Fecha_Creacion) AS Mes,
    CONVERT(CHAR(7), Fecha_Creacion, 120) AS Periodo,
    COUNT(DISTINCT Cambio_ID) AS Total_Cambios,
    COUNT(DISTINCT Tarea_ID) AS Total_Tareas,
    COUNT(DISTINCT Resolutor) AS Total_Resolutores,
    CAST(SUM(Segundos_Sin_Solapamiento) / 3600.0 AS DECIMAL(18,2)) AS Horas_Totales,
    CAST(
        (SUM(Segundos_Sin_Solapamiento) / 3600.0)
        / NULLIF(COUNT(DISTINCT Cambio_ID), 0)
        AS DECIMAL(18,2)
    ) AS Promedio_Horas_Por_Cambio
FROM HorasCalculadasBD
GROUP BY
    YEAR(Fecha_Creacion),
    MONTH(Fecha_Creacion),
    CONVERT(CHAR(7), Fecha_Creacion, 120)
ORDER BY Anio, Mes"""
    return [dict(row) for row in db.execute(text(consulta), params).mappings().all()]
