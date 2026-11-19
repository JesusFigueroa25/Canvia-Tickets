"""Staging y sincronización idempotente de acciones en SQL Server."""
from __future__ import annotations

from typing import Any
from uuid import UUID

import pandas as pd
from sqlalchemy import delete, func, insert, select, text, literal_column
from sqlalchemy.orm import Session

from app.etl.change_detector import detectar_cambios
from app.etl.tickets_report_times_etl import COLUMNAS_NEGOCIO
from app.models.tickets_report_times_model import (
    TicketReportTime, stg_tickets_report_times_table,
)

from datetime import timedelta
from sqlalchemy import case

from app.schemas.tickets_report_times_schema import TicketsReportTimesDashboardFilters

TAMANO_INSERT = 60
COLUMNAS_PERSISTENTES = [*COLUMNAS_NEGOCIO, "Evento_Clave", "Contenido_Hash"]


def bloquear_importacion(db: Session) -> None:
    """Bloqueo transaccional para evitar importar dos archivos a la vez."""
    resultado = db.execute(text("""
        SET NOCOUNT ON;
        DECLARE @resultado INT;
        EXEC @resultado = sys.sp_getapplock
            @Resource = N'canvia_tickets_report_times_import',
            @LockMode = N'Exclusive',
            @LockOwner = N'Transaction',
            @LockTimeout = 15000;
        SELECT @resultado AS resultado;
    """)).scalar_one()
    db.execute(text("SET NOCOUNT OFF;"))
    if resultado < 0:
        raise RuntimeError("No fue posible bloquear la importación de tiempos")


def _registro_sql(fila: dict[str, Any]) -> dict[str, Any]:
    """Convertir escalares Pandas a tipos aceptados por pyodbc."""
    convertido = {}
    for columna, valor in fila.items():
        if valor is None or (not isinstance(valor, (bytes, bytearray)) and pd.isna(valor)):
            convertido[columna] = None
        elif isinstance(valor, pd.Timestamp):
            convertido[columna] = valor.to_pydatetime()
        elif hasattr(valor, "item") and not isinstance(valor, (str, bytes, bytearray)):
            convertido[columna] = valor.item()
        else:
            convertido[columna] = valor
    return convertido


def cargar_staging(db: Session, df: pd.DataFrame, lote_id: UUID) -> int:
    tabla = stg_tickets_report_times_table
    columnas = ["Fila_Excel", *COLUMNAS_PERSISTENTES]
    faltantes = [c for c in columnas if c not in df.columns]
    if faltantes:
        raise ValueError(f"Faltan campos para staging: {faltantes}")

    for inicio in range(0, len(df), TAMANO_INSERT):
        bloque = df.iloc[inicio:inicio + TAMANO_INSERT][columnas]
        registros = [
            {**_registro_sql(fila), "Lote_ID": lote_id}
            for fila in bloque.to_dict(orient="records")
        ]
        db.execute(insert(tabla), registros)
    return len(df)


def clasificar_cambios(db: Session, lote_id: UUID) -> dict[str, int]:
    """Reutiliza change_detector comparando clave + hash, no Ticket_ID."""
    stg = stg_tickets_report_times_table
    oficial = TicketReportTime

    consulta_staging = select(
        stg.c.Evento_Clave, stg.c.Contenido_Hash
    ).where(stg.c.Lote_ID == lote_id)
    datos_staging = db.execute(consulta_staging).mappings().all()

    consulta_oficial = (
        select(oficial.Evento_Clave, oficial.Contenido_Hash)
        .join(stg, stg.c.Evento_Clave == oficial.Evento_Clave)
        .where(stg.c.Lote_ID == lote_id)
    )
    datos_oficial = db.execute(consulta_oficial).mappings().all()

    def dataframe(filas):
        return pd.DataFrame.from_records(
            [
                {
                    "Evento_Clave": bytes(f["Evento_Clave"]),
                    "Contenido_Hash": bytes(f["Contenido_Hash"]),
                }
                for f in filas
            ],
            columns=["Evento_Clave", "Contenido_Hash"],
        )

    resultado = detectar_cambios(
        dataframe(datos_staging), dataframe(datos_oficial), clave="Evento_Clave"
    )
    return {
        "nuevos": len(resultado["NEW"]),
        "modificados": len(resultado["CHANGED"]),
        "sin_cambios": len(resultado["SAME"]),
    }


def sincronizar_lote(db: Session, lote_id: UUID, clasificacion: dict[str, int]) -> None:
    """UPDATE + INSERT desde staging sin MERGE, dentro de la misma transacción."""
    columnas_actualizables = [c for c in COLUMNAS_NEGOCIO if c not in ("Ticket_ID",)]
    asignaciones = ",\n            ".join(
        f"d.[{columna}] = s.[{columna}]" for columna in columnas_actualizables
    )
    sql_update = f"""
        UPDATE d
        SET {asignaciones},
            d.[Contenido_Hash] = s.[Contenido_Hash],
            d.[Fecha_Importacion] = SYSUTCDATETIME()
        FROM dbo.tickets_report_times AS d
        INNER JOIN dbo.stg_tickets_report_times AS s
            ON s.Evento_Clave = d.Evento_Clave
        WHERE s.Lote_ID = CONVERT(uniqueidentifier, :lote_id)
          AND d.Contenido_Hash <> s.Contenido_Hash;
    """
    db.execute(text(sql_update), {"lote_id": str(lote_id)})

    columnas = ", ".join(f"[{c}]" for c in COLUMNAS_PERSISTENTES)
    origen = ", ".join(f"s.[{c}]" for c in COLUMNAS_PERSISTENTES)
    sql_insert = f"""
        INSERT INTO dbo.tickets_report_times ({columnas})
        SELECT {origen}
        FROM dbo.stg_tickets_report_times AS s
        WHERE s.Lote_ID = CONVERT(uniqueidentifier, :lote_id)
          AND NOT EXISTS (
              SELECT 1
              FROM dbo.tickets_report_times AS d WITH (UPDLOCK, HOLDLOCK)
              WHERE d.Evento_Clave = s.Evento_Clave
          );
    """
    db.execute(text(sql_insert), {"lote_id": str(lote_id)})

    # Verificación final: todas las claves del lote existen con idéntico hash.
    verificacion = db.execute(text("""
        SELECT
            COUNT_BIG(*) AS total,
            SUM(CASE
                WHEN d.Report_Time_ID IS NULL
                   OR d.Contenido_Hash <> s.Contenido_Hash
                THEN 1 ELSE 0
            END) AS discrepancias
        FROM dbo.stg_tickets_report_times AS s
        LEFT JOIN dbo.tickets_report_times AS d
            ON d.Evento_Clave = s.Evento_Clave
        WHERE s.Lote_ID = CONVERT(uniqueidentifier, :lote_id);
    """), {"lote_id": str(lote_id)}).mappings().one()

    total = int(verificacion["total"] or 0)
    discrepancias = int(verificacion["discrepancias"] or 0)
    clasificados = sum(clasificacion.values())
    if total != clasificados or discrepancias:
        raise RuntimeError(
            "No coincide la conciliación de acciones tras la sincronización"
        )


def limpiar_staging_lote(db: Session, lote_id: UUID) -> None:
    tabla = stg_tickets_report_times_table
    db.execute(delete(tabla).where(tabla.c.Lote_ID == lote_id))


def contar_total_acciones(db: Session) -> int:
    return int(db.execute(
        select(func.count()).select_from(TicketReportTime)
    ).scalar_one())



PROYECTOS_PREDETERMINADOS: tuple[str, ...] = (
    "104842 KOMATSU PROY CLOUD DTA CENT",
    "105811 ASOCIACION DE AFP PROY CLOUD HOST",
    "103532 SAN MIGUEL FRUIT PROY CLOUD IAAS",
    "103948 EUROMOTORS PROY CLOUD OUTSOUR",
    #"104859 CAMARACOMP PROY CLOUD OUT",
    #"106255 SEDAPAL PROY CLOUD SERV HOSTING (O)",
    #"100988 UNICON PROY CLOUD HOST PLATAF",
    #"104474 CELIMA PROY CLOUD HOST SAP",
)

TIPO_REQUERIMIENTO = "Service Request"
CATEGORIA_INFORME = "Elaboracion Informe Mensual"



def _proyecto_sql():
    return func.coalesce(
        func.nullif(
            func.trim(TicketReportTime.Proyecto),
            literal_column("N''")
        ),
        literal_column("N'Sin especificar'")
    )


def _resolutor_sql():
    return func.coalesce(
        func.nullif(
            func.trim(TicketReportTime.Nombre_Resolutor),
            literal_column("N''")
        ),
        literal_column("N'Sin especificar'")
    )



def _base_informes(consulta):
    modelo = TicketReportTime
    return consulta.where(
        #modelo.Ticket_type == TIPO_REQUERIMIENTO,
        modelo.Categorizacion_Nivel_3 == CATEGORIA_INFORME,
    )


def _aplicar_filtros(
    consulta,
    filtros: TicketsReportTimesDashboardFilters,
    *,
    aplicar_proyectos: bool = False,
    aplicar_periodo: bool = True,
):
    modelo = TicketReportTime
    consulta = _base_informes(consulta)

    if filtros.desde is not None:
        consulta = consulta.where(modelo.Fecha_Creacion >= filtros.desde)
    if filtros.hasta is not None:
        consulta = consulta.where(modelo.Fecha_Creacion < filtros.hasta + timedelta(days=1))
    if filtros.grupo_resolutor and filtros.grupo_resolutor.strip():
        consulta = consulta.where(modelo.Grupo_Resolutor == filtros.grupo_resolutor.strip())

    if aplicar_periodo and filtros.periodo:
        anio, mes = map(int, filtros.periodo.split("-"))
        from datetime import date
        inicio = date(anio, mes, 1)
        fin = date(anio + 1, 1, 1) if mes == 12 else date(anio, mes + 1, 1)
        consulta = consulta.where(
            modelo.Fecha_Creacion >= inicio,
            modelo.Fecha_Creacion < fin,
        )

    if aplicar_proyectos and not filtros.todos_proyectos:
        seleccionados = [p.strip() for p in filtros.proyectos if p and p.strip()]
        if not seleccionados:
            seleccionados = list(PROYECTOS_PREDETERMINADOS)
        # No se usa LIKE: comparación con los nombres exactos del Excel.
        consulta = consulta.where(_proyecto_sql().in_(seleccionados))

    return consulta


def obtener_opciones_filtros(db: Session, grupo_resolutor: str | None = "BASE DE DATOS Y EBS"):
    modelo = TicketReportTime
    fecha = _base_informes(select(
        func.min(modelo.Fecha_Creacion).label("fecha_min"),
        func.max(modelo.Fecha_Creacion).label("fecha_max"),
    ))
    if grupo_resolutor and grupo_resolutor.strip():
        fecha = fecha.where(modelo.Grupo_Resolutor == grupo_resolutor.strip())
    fechas = db.execute(fecha).mappings().one()

    grupos_stmt = _base_informes(
        select(modelo.Grupo_Resolutor)
        .where(modelo.Grupo_Resolutor.isnot(None), modelo.Grupo_Resolutor != "")
        .distinct()
        .order_by(modelo.Grupo_Resolutor)
    )
    proyectos_stmt = _base_informes(
        select(modelo.Proyecto)
        .where(modelo.Proyecto.isnot(None), modelo.Proyecto != "")
        .distinct()
        .order_by(modelo.Proyecto)
    )
    if grupo_resolutor and grupo_resolutor.strip():
        proyectos_stmt = proyectos_stmt.where(modelo.Grupo_Resolutor == grupo_resolutor.strip())

    return {
        "fecha_min": fechas["fecha_min"].date() if fechas["fecha_min"] else None,
        "fecha_max": fechas["fecha_max"].date() if fechas["fecha_max"] else None,
        "grupos_resolutores": list(db.execute(grupos_stmt).scalars().all()),
        "proyectos": list(db.execute(proyectos_stmt).scalars().all()),
        "proyectos_predeterminados": list(PROYECTOS_PREDETERMINADOS),
    }


def obtener_kpis(db: Session, filtros: TicketsReportTimesDashboardFilters):
    modelo = TicketReportTime
    proyecto_valido = func.nullif(func.trim(modelo.Proyecto), "")
    resolutor_valido = func.nullif(func.trim(modelo.Nombre_Resolutor), "")
    
    # 1. INDICADORES GENERALES
    stmt = select(
        func.count(
            func.distinct(modelo.Ticket_ID)
        ).label("total_tickets"),

        func.count(
            func.distinct(proyecto_valido)
        ).label("total_proyectos"),

        func.coalesce(
            func.sum(modelo.Horas), 0
        ).label("horas_totales"),

        func.count(
            func.distinct(resolutor_valido)
        ).label("total_resolutores"),

        # Compatibilidad con el KPI anterior
        func.count(
            func.distinct(
                case(
                    (
                        modelo.Prioridad == "1-Critical",
                        modelo.Ticket_ID
                    ),
                    else_=None
                )
            )
        ).label("alta_criticidad"),

    ).select_from(modelo)
    stmt = _aplicar_filtros(
        stmt,
        filtros,
        aplicar_proyectos=True
    )
    resumen = db.execute(stmt).mappings().one()

    # 2. TICKETS DISTINTOS POR MES
    anio = func.year(modelo.Fecha_Creacion)
    mes = func.month(modelo.Fecha_Creacion)
    stmt_mensual = select(
        anio.label("anio"),
        mes.label("mes"),

        func.count(
            func.distinct(modelo.Ticket_ID)
        ).label("tickets")

    ).select_from(modelo)
    stmt_mensual = _aplicar_filtros(
        stmt_mensual,
        filtros,
        aplicar_proyectos=True
    )
    stmt_mensual = (
        stmt_mensual
        .group_by(anio, mes)
        .order_by(anio, mes)
    )
    registros_mensuales = (
        db.execute(stmt_mensual).mappings().all()
    )
    meses_con_datos = len(registros_mensuales)
    tickets_mensuales_acumulados = sum(
        int(registro["tickets"] or 0)
        for registro in registros_mensuales
    )

    # 3. RESULTADO
    return {
        **dict(resumen),
        "meses_con_datos": meses_con_datos,
        "tickets_mensuales_acumulados": (
            tickets_mensuales_acumulados
        )
    }


def obtener_volumen_mensual(db: Session, filtros: TicketsReportTimesDashboardFilters):
    modelo = TicketReportTime
    anio, mes = func.year(modelo.Fecha_Creacion), func.month(modelo.Fecha_Creacion)
    stmt = select(
        anio.label("anio"), mes.label("mes"),
        func.count(func.distinct(modelo.Ticket_ID)).label("tickets"),
        func.count().label("acciones"),
        func.sum(modelo.Horas).label("horas_totales"),
    ).select_from(modelo)
    # El gráfico mantiene la serie completa al seleccionar un período en el dashboard.
    stmt = _aplicar_filtros(
        stmt,
        filtros,
        aplicar_proyectos=True,
        aplicar_periodo=False
    )
    stmt = stmt.group_by(anio, mes).order_by(anio, mes)
    return db.execute(stmt).mappings().all()


def obtener_resumen(db: Session, filtros: TicketsReportTimesDashboardFilters):
    modelo = TicketReportTime
    stmt = select(
        func.count(func.distinct(modelo.Ticket_ID)).label("tickets_distintos"),
        func.count().label("acciones"),
        func.coalesce(func.sum(modelo.Horas), 0).label("horas_totales"),
        func.count(func.distinct(func.nullif(func.trim(modelo.Proyecto), ""))).label("proyectos_distintos"),
        func.count(func.distinct(func.nullif(func.trim(modelo.Nombre_Resolutor), ""))).label("resolutores_distintos"),
    ).select_from(modelo)
    stmt = _aplicar_filtros(stmt, filtros, aplicar_proyectos=True)
    return db.execute(stmt).mappings().one()


def obtener_tabla(db: Session, filtros: TicketsReportTimesDashboardFilters,
                  dimension: str, pagina: int, tamano: int):
    """Agregación mensual paginada en SQL Server: dimension=resolutor|proyecto."""
    if dimension not in {"resolutor", "proyecto"}:
        raise ValueError("Dimensión inválida")
    modelo = TicketReportTime
    anio, mes = func.year(modelo.Fecha_Creacion), func.month(modelo.Fecha_Creacion)
    nombre = _resolutor_sql() if dimension == "resolutor" else _proyecto_sql()
    horas = func.sum(modelo.Horas)
    campos = [
        anio.label("anio"), mes.label("mes"), nombre.label(dimension),
        func.count(func.distinct(modelo.Ticket_ID)).label("tickets"),
        func.count().label("acciones"),
        horas.label("horas_totales"),
    ]
    if dimension == "proyecto":
        campos.append(func.count(func.distinct(
            func.nullif(func.trim(modelo.Nombre_Resolutor), "")
        )).label("resolutores_distintos"))

    base = select(*campos).select_from(modelo)
    base = _aplicar_filtros(base, filtros, aplicar_proyectos=True)
    base = base.group_by(anio, mes, nombre)
    total = db.execute(select(func.count()).select_from(base.subquery())).scalar_one()
    stmt = base.order_by(anio.desc(), mes.desc(), horas.desc(), nombre.asc())
    stmt = stmt.offset((pagina - 1) * tamano).limit(tamano)
    items = db.execute(stmt).mappings().all()
    return {"items": items, "total": int(total)}


def obtener_grafico(db: Session, filtros: TicketsReportTimesDashboardFilters,
                     dimension: str, limite: int):
    """Top N global por horas, luego horas mensuales de cada elemento elegido."""
    if dimension not in {"resolutor", "proyecto"}:
        raise ValueError("Dimensión inválida")
    modelo = TicketReportTime
    nombre = _resolutor_sql() if dimension == "resolutor" else _proyecto_sql()
    anio, mes = func.year(modelo.Fecha_Creacion), func.month(modelo.Fecha_Creacion)
    total_horas = func.sum(modelo.Horas)

    ranking_stmt = select(
        nombre.label("nombre"), total_horas.label("horas_totales")
    ).select_from(modelo)
    ranking_stmt = _aplicar_filtros(ranking_stmt, filtros, aplicar_proyectos=True)
    ranking_stmt = ranking_stmt.group_by(nombre).order_by(total_horas.desc(), nombre.asc()).limit(limite)
    ranking = [dict(r) for r in db.execute(ranking_stmt).mappings().all()]

    # Conservar los períodos de todos los proyectos / especialistas filtrados.
    periodos_stmt = select(anio.label("anio"), mes.label("mes")).select_from(modelo)
    periodos_stmt = _aplicar_filtros(periodos_stmt, filtros, aplicar_proyectos=True)
    periodos_stmt = periodos_stmt.group_by(anio, mes).order_by(anio, mes)
    fechas = db.execute(periodos_stmt).mappings().all()
    periodos = []
    if fechas:
        ini = int(fechas[0]["anio"]) * 12 + int(fechas[0]["mes"]) - 1
        fin = int(fechas[-1]["anio"]) * 12 + int(fechas[-1]["mes"]) - 1
        for indice in range(ini, fin + 1):
            year, m0 = divmod(indice, 12)
            periodos.append(f"{year:04d}-{m0 + 1:02d}")

    mensual = []
    nombres = [r["nombre"] for r in ranking]
    if nombres:
        stmt = select(
            nombre.label("nombre"), anio.label("anio"), mes.label("mes"),
            func.sum(modelo.Horas).label("horas"),
        ).select_from(modelo)
        stmt = _aplicar_filtros(stmt, filtros, aplicar_proyectos=True)
        stmt = stmt.where(nombre.in_(nombres)).group_by(nombre, anio, mes)
        mensual = db.execute(stmt).mappings().all()

    return {"ranking": ranking, "mensual": mensual, "periodos": periodos}
