
from sqlalchemy import (
    BigInteger,
    Column,
    Identity,
    Integer,
    String,
    Table,
    Unicode,
    UniqueConstraint
)

from sqlalchemy.dialects.mssql import (
    DATETIME2,
    UNIQUEIDENTIFIER
)

from app.database.database import Base


# ============================================================
# TABLA OFICIAL
# ============================================================

class TicketsManualUpdate(Base):

    __tablename__ = "tickets_manual_updates"

    # Identificador interno generado por SQL Server
    Actualizacion_ID = Column(
        BigInteger,
        Identity(start=1, increment=1),
        primary_key=True,
        nullable=False
    )

    # Identificador del ticket
    Ticket_ID = Column(
        String(20),
        nullable=False
    )

    # Fecha de creación del ticket
    Fecha_Creacion = Column(
        DATETIME2(precision=0),
        nullable=True
    )

    # Tipo: Incident, Service Request, Task Ticket, etc.
    Ticket_type = Column(
        Unicode(50),
        nullable=True
    )

    # Grupo resolutor
    Grupo_Resolutor = Column(
        Unicode(150),
        nullable=True
    )

    # Persona asignada al ticket
    Nombre_Resolutor = Column(
        Unicode(150),
        nullable=True
    )

    # Motivo de resolución
    Motivo_Resolucion = Column(
        Unicode(150),
        nullable=True
    )

    # Estado
    Estado = Column(
        Unicode(50),
        nullable=True
    )

    # Proyecto
    Proyecto = Column(
        Unicode(200),
        nullable=True
    )


# ============================================================
# TABLA STAGING
# ============================================================

stg_tickets_manual_updates_table = Table(
    "stg_tickets_manual_updates",
    Base.metadata,

    # Identifica una ejecución de importación.
    Column(
        "Lote_ID",
        UNIQUEIDENTIFIER,
        primary_key=True,
        nullable=False
    ),

    # Identifica la posición de la fila dentro del Excel.
    Column(
        "Fila_Excel",
        Integer,
        primary_key=True,
        nullable=False
    ),

    Column(
        "Ticket_ID",
        String(20),
        nullable=True
    ),

    Column(
        "Fecha_Creacion",
        DATETIME2(precision=0),
        nullable=True
    ),

    Column(
        "Ticket_type",
        Unicode(50),
        nullable=True
    ),

    Column(
        "Grupo_Resolutor",
        Unicode(150),
        nullable=True
    ),

    Column(
        "Nombre_Resolutor",
        Unicode(150),
        nullable=True
    ),

    Column(
        "Motivo_Resolucion",
        Unicode(150),
        nullable=True
    ),

    Column(
        "Estado",
        Unicode(50),
        nullable=True
    ),

    Column(
        "Proyecto",
        Unicode(200),
        nullable=True
    ),

    schema="dbo"
)
