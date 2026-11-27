from typing import Any
from uuid import UUID
import pandas as pd
from sqlalchemy import delete, insert, select, text
from sqlalchemy.orm import Session
from app.etl.tickets_manual_updates_etl import COLUMNAS_PERSISTENTES
from app.models.tickets_manual_updates import (TicketsManualUpdate,stg_tickets_manual_updates_table,)
from datetime import date, datetime, time, timedelta
from app.repositories.tickets_parallel_sql import SQL_BASE, TEMP_TABLES


COLUMNAS_NEGOCIO = COLUMNAS_PERSISTENTES

TAMANO_INSERT = 60
TAMANO_BUSQUEDA = 400


# NORMALIZAR REGISTROS PANDAS
def _dataframe_a_registros(
    df: pd.DataFrame
) -> list[dict[str, Any]]:

    registros = []

    for fila in df.to_dict(orient="records"):

        registro = {}

        for columna, valor in fila.items():

            if valor is None or (not isinstance(valor, (bytes, bytearray)) and pd.isna(valor)):
                registro[columna] = None

            elif isinstance(valor, pd.Timestamp):
                registro[columna] = valor.to_pydatetime()

            elif hasattr(valor, "item") and not isinstance(valor, str):
                registro[columna] = valor.item()

            else:
                registro[columna] = valor

        registros.append(registro)

    return registros


# BLOQUEO DE IMPORTACIONES CONCURRENTES
def bloquear_importacion(db: Session) -> None:
    """
    Evita importaciones simultáneas.

    Restablece NOCOUNT OFF para que SQLAlchemy pueda
    comprobar correctamente las filas afectadas
    durante el UPDATE de import_run.
    """

    # Opciones requeridas para escribir en una tabla con índice filtrado.
    db.execute(text("""SET ANSI_NULLS ON; SET ANSI_PADDING ON;
        SET ANSI_WARNINGS ON; SET ARITHABORT ON;
        SET CONCAT_NULL_YIELDS_NULL ON; SET QUOTED_IDENTIFIER ON;
        SET NUMERIC_ROUNDABORT OFF;"""))
    consulta = text("""
        SET NOCOUNT ON;

        DECLARE @resultado INT;

        EXEC @resultado = sys.sp_getapplock
            @Resource = N'canvia_tickets_manual_updates_import',
            @LockMode = N'Exclusive',
            @LockOwner = N'Transaction',
            @LockTimeout = 15000;

        SELECT @resultado AS resultado;
    """)

    resultado = db.execute(consulta).scalar_one()

    # IMPORTANTE:
    # Restaurar el conteo de filas afectadas.
    db.execute(text("SET NOCOUNT OFF;"))

    if resultado < 0:
        raise RuntimeError(
            "No se pudo obtener el bloqueo "
            "de importación de tickets manuales."
        )


# CARGAR STAGING
def cargar_staging(
    db: Session,
    df: pd.DataFrame,
    lote_id: UUID
) -> int:

    columnas = ["Fila_Excel", *COLUMNAS_NEGOCIO]

    faltantes = [
        c for c in columnas
        if c not in df.columns
    ]

    if faltantes:
        raise ValueError(
            f"Columnas faltantes: {faltantes}"
        )

    registros = _dataframe_a_registros(
        df[columnas].copy()
    )

    for registro in registros:
        registro["Lote_ID"] = lote_id

    tabla = stg_tickets_manual_updates_table

    for inicio in range(0, len(registros), TAMANO_INSERT):

        db.execute(
            insert(tabla),
            registros[inicio:inicio + TAMANO_INSERT]
        )

    return len(registros)


# LEER STAGING DEL LOTE
def obtener_staging_lote(
    db: Session,
    lote_id: UUID
) -> list[dict]:

    tabla = stg_tickets_manual_updates_table

    consulta = (
        select(
            tabla.c.Fila_Excel,
            *[
                tabla.c[columna]
                for columna in COLUMNAS_NEGOCIO
            ]
        )
        .where(tabla.c.Lote_ID == lote_id)
        .order_by(tabla.c.Fila_Excel)
    )

    return [
        dict(fila)
        for fila in db.execute(
            consulta
        ).mappings().all()
    ]


# SINCRONIZAR EVENTOS EN TABLA OFICIAL
def sincronizar_registros(db: Session, registros_staging: list[dict]) -> dict[str, int]:
    """Bajo el bloqueo del lote: actualizar por evento y recuperar filas legacy."""
    modelo = TicketsManualUpdate
    claves = [bytes(f['Evento_Clave']) for f in registros_staging]
    if len(set(claves)) != len(claves):
        raise RuntimeError('Claves de evento repetidas en staging.')
    existentes = {}
    for inicio in range(0, len(claves), TAMANO_BUSQUEDA):
        filas = db.execute(select(modelo.Actualizacion_ID, modelo.Evento_Clave, modelo.Contenido_Hash)
            .where(modelo.Evento_Clave.in_(claves[inicio:inicio + TAMANO_BUSQUEDA]))).all()
        existentes.update({bytes(f.Evento_Clave): (f.Actualizacion_ID, bytes(f.Contenido_Hash) if f.Contenido_Hash is not None else None) for f in filas})
    ids = sorted({f['Ticket_ID'] for f in registros_staging})
    legacy = {}
    for inicio in range(0, len(ids), TAMANO_BUSQUEDA):
        filas = db.execute(select(modelo.Actualizacion_ID, modelo.Ticket_ID)
            .where(modelo.Evento_Clave.is_(None), modelo.Ticket_ID.in_(ids[inicio:inicio + TAMANO_BUSQUEDA]))
            .order_by(modelo.Actualizacion_ID)).all()
        for f in filas:
            legacy.setdefault(f.Ticket_ID.upper(), f.Actualizacion_ID)
    nuevos, cambios = [], []
    sin_cambios = 0
    for fila in registros_staging:
        registro = {c: fila.get(c) for c in COLUMNAS_NEGOCIO}
        clave = bytes(registro['Evento_Clave'])
        contenido = bytes(registro['Contenido_Hash'])
        previo = existentes.get(clave)
        if previo is not None:
            if previo[1] == contenido:
                sin_cambios += 1
            else:
                cambios.append({'Actualizacion_ID': previo[0], **registro})
        elif fila['Ticket_ID'].upper() in legacy:
            # Sustituir la representación incompleta por un evento real.
            cambios.append({'Actualizacion_ID': legacy.pop(fila['Ticket_ID'].upper()), **registro})
        else:
            nuevos.append(registro)
    for inicio in range(0, len(cambios), TAMANO_INSERT):
        db.bulk_update_mappings(modelo, cambios[inicio:inicio + TAMANO_INSERT])
    insertados = insertar_nuevos(db, nuevos)
    return {'nuevos': insertados, 'modificados': len(cambios), 'sin_cambios': sin_cambios}


# INSERTAR REGISTROS NUEVOS
def insertar_nuevos(
    db: Session,
    registros: list[dict]
) -> int:

    if not registros:
        return 0

    tabla = TicketsManualUpdate.__table__

    for inicio in range(
        0,
        len(registros),
        TAMANO_INSERT
    ):

        db.execute(
            insert(tabla),
            registros[inicio:inicio + TAMANO_INSERT]
        )

    return len(registros)


# LIMPIAR ÚNICAMENTE EL LOTE ACTUAL
def limpiar_staging_lote(
    db: Session,
    lote_id: UUID
) -> None:

    tabla = stg_tickets_manual_updates_table

    db.execute(
        delete(tabla).where(
            tabla.c.Lote_ID == lote_id
        )
    )


# TOTAL DE TICKETS IMPORTADOS
def contar_total(db: Session) -> int:

    from sqlalchemy import func

    return db.execute(
        select(func.count()).select_from(
            TicketsManualUpdate
        )
    ).scalar_one()


_INTERVALOS_VALIDOS = """
    Ticket_type IN (N'Incident', N'Service Request', N'Task Ticket')
    AND Action_End_Date > Action_Start_Date
    AND NULLIF(LTRIM(RTRIM(Nombre_Resolutor)), N'') IS NOT NULL
"""


def obtener_rango_paralelos(db: Session, grupo: str | None) -> tuple[date | None, date | None]:
    fila = db.execute(text(f"""
        SELECT CAST(MIN(Action_Start_Date) AS date) AS fecha_min,
               CAST(MAX(DATEADD(SECOND, -1, Action_End_Date)) AS date) AS fecha_max
        FROM dbo.tickets_report_times
        WHERE {_INTERVALOS_VALIDOS}
          AND (:grupo IS NULL OR Grupo_Resolutor = :grupo)
    """), {"grupo": grupo}).mappings().one()
    return fila["fecha_min"], fila["fecha_max"]


def obtener_grupos_paralelos(db: Session) -> list[str]:
    return list(db.execute(text(f"""
        SELECT DISTINCT Grupo_Resolutor FROM dbo.tickets_report_times
        WHERE {_INTERVALOS_VALIDOS}
          AND NULLIF(LTRIM(RTRIM(Grupo_Resolutor)), N'') IS NOT NULL
        ORDER BY Grupo_Resolutor
    """)).scalars().all())


_DROP_TEMP = ";\n".join(f"DROP TABLE IF EXISTS {t}" for t in reversed(TEMP_TABLES)) + ";"


def cargar_base_paralelos(db: Session, desde: date, hasta: date, grupo: str | None) -> tuple[list[dict], list[dict], list[dict]]:
    """Misma conexión para todas las temporales; no commit ni DML oficial.

    Devuelve padres, intervalos consolidados y evidencia original recortada.
    SQL Server conserva sus reglas de collation para la identidad de actores.
    """
    conn = db.connection()
    nocount_original = bool(conn.execute(text("SELECT @@OPTIONS & 512")).scalar_one())
    # Las temporales creadas por una sentencia preparada pueden quedar en el
    # ámbito de sp_executesql/sp_prepexec. Consumimos los tres result sets
    # dentro del mismo lote y cursor, sin depender de que sobrevivan al lote.
    sql = SQL_BASE.replace(":desde", "?").replace(":hasta_exclusiva", "?").replace(":grupo", "?")
   
    batch = (
        "SET NOCOUNT ON;\n"
        + _DROP_TEMP
        + "\n"
        + sql
        + "\n"
        "SELECT * FROM #canvia_pa_Padres;\n"
        "SELECT * FROM #canvia_pa_IntervalosConsolidados;\n"
        "SELECT * FROM #canvia_pa_Intervalos;\n"
        + _DROP_TEMP
    )
    
    cursor = conn.connection.cursor()

    try:
        cursor.execute(
            batch,
            datetime.combine(desde, time.min),
            datetime.combine(hasta + timedelta(days=1), time.min),
            grupo
        )
        sets = []
        while True:
            if cursor.description is not None:
                cols = [col[0] for col in cursor.description]
                sets.append([dict(zip(cols, row)) for row in cursor.fetchall()])
            if not cursor.nextset():
                break
        if len(sets) != 3:
            raise RuntimeError("El motor SQL no devolvió sus tres conjuntos esperados.")
        return sets[0], sets[1], sets[2]

    except conn.dialect.dbapi.Error as exc:
        # El acceso al cursor DBAPI es intencionado para consumir nextset.
        # Invalidar evita reutilizar la conexión tras un fallo del lote.
        conn.invalidate()
        raise ConnectionError("No se pudo cargar la base de atención paralela.") from exc
    finally:
        try:
            cursor.close()
        except Exception:
            if not conn.invalidated:
                conn.invalidate()
        if not conn.invalidated:
            try:
                conn.execute(text(_DROP_TEMP)).close()
                conn.execute(text("SET NOCOUNT ON" if nocount_original else "SET NOCOUNT OFF")).close()
            except Exception:
                conn.invalidate()
                raise
