
from typing import Any
from uuid import UUID

import pandas as pd

from sqlalchemy import delete, insert, select, text
from sqlalchemy.orm import Session

from app.models.tickets_manual_updates import (
    TicketsManualUpdate,
    stg_tickets_manual_updates_table,
)


COLUMNAS_NEGOCIO = [
    "Ticket_ID",
    "Fecha_Creacion",
    "Ticket_type",
    "Grupo_Resolutor",
    "Nombre_Resolutor",
    "Motivo_Resolucion",
    "Estado",
    "Proyecto",
]

TAMANO_INSERT = 150
TAMANO_BUSQUEDA = 400


# ============================================================
# NORMALIZAR REGISTROS PANDAS
# ============================================================

def _dataframe_a_registros(
    df: pd.DataFrame
) -> list[dict[str, Any]]:

    registros = []

    for fila in df.to_dict(orient="records"):

        registro = {}

        for columna, valor in fila.items():

            if valor is None or pd.isna(valor):
                registro[columna] = None

            elif isinstance(valor, pd.Timestamp):
                registro[columna] = valor.to_pydatetime()

            elif hasattr(valor, "item") and not isinstance(valor, str):
                registro[columna] = valor.item()

            else:
                registro[columna] = valor

        registros.append(registro)

    return registros


# ============================================================
# BLOQUEO DE IMPORTACIONES CONCURRENTES
# ============================================================


def bloquear_importacion(db: Session) -> None:
    """
    Evita importaciones simultáneas.

    Restablece NOCOUNT OFF para que SQLAlchemy pueda
    comprobar correctamente las filas afectadas
    durante el UPDATE de import_run.
    """

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



# ============================================================
# CARGAR STAGING
# ============================================================

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


# ============================================================
# LEER STAGING DEL LOTE
# ============================================================

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


# ============================================================
# BUSCAR IDs EXISTENTES EN TABLA OFICIAL
# ============================================================

def obtener_ids_existentes(
    db: Session,
    ticket_ids: list[str]
) -> set[str]:

    ids = list(dict.fromkeys(
        ticket
        for ticket in ticket_ids
        if ticket
    ))

    existentes = set()

    for inicio in range(0, len(ids), TAMANO_BUSQUEDA):

        bloque = ids[
            inicio:inicio + TAMANO_BUSQUEDA
        ]

        consulta = select(
            TicketsManualUpdate.Ticket_ID
        ).where(
            TicketsManualUpdate.Ticket_ID.in_(bloque)
        )

        existentes.update(
            db.execute(consulta).scalars().all()
        )

    return existentes


# ============================================================
# NUEVOS = TICKET_ID QUE TODAVÍA NO EXISTE
# ============================================================

def identificar_nuevos(
    db: Session,
    registros_staging: list[dict]
) -> tuple[list[dict], int]:

    ids = [
        fila["Ticket_ID"]
        for fila in registros_staging
    ]

    existentes = obtener_ids_existentes(db, ids)

    nuevos = []
    sin_cambios = 0
    vistos_lote = set()

    for fila in registros_staging:

        ticket_id = fila["Ticket_ID"]

        # Defensa adicional si staging recibe repetidos.
        if ticket_id in vistos_lote:
            sin_cambios += 1
            continue

        vistos_lote.add(ticket_id)

        # Si ya existe en SQL Server, conservar el anterior.
        if ticket_id in existentes:
            sin_cambios += 1
            continue

        nuevos.append({
            columna: fila.get(columna)
            for columna in COLUMNAS_NEGOCIO
        })

    return nuevos, sin_cambios


# ============================================================
# INSERTAR TICKETS NUEVOS
# ============================================================

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


# ============================================================
# LIMPIAR ÚNICAMENTE EL LOTE ACTUAL
# ============================================================

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


# ============================================================
# TOTAL DE TICKETS IMPORTADOS
# ============================================================

def contar_total(db: Session) -> int:

    from sqlalchemy import func

    return db.execute(
        select(func.count()).select_from(
            TicketsManualUpdate
        )
    ).scalar_one()
