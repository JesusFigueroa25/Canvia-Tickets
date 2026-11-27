
from sqlalchemy import Column, Table, String, Unicode
from sqlalchemy.dialects.mssql import DATETIME2, NVARCHAR

from app.database.database import Base


class TaskConsolidated(Base):

    __tablename__ = "task_consolidated" 

    Ticket_ID = Column(String(20), primary_key=True, nullable=False)
    Ticket_Padre = Column(String(20), nullable=True)
    Fecha_Apertura = Column(DATETIME2(precision=0),nullable=False)
    Fecha_Resolucion = Column(DATETIME2(precision=0),nullable=True)
    Fecha_Cierre = Column(DATETIME2(precision=0),nullable=True)
    Fecha_Ultima_Modificacion = Column(DATETIME2(precision=0),nullable=True)
    Proyecto = Column(Unicode(200), nullable=True)
    ALP = Column(String(30), nullable=True)
    BU = Column(Unicode(50), nullable=True)
    Grupo_Resolutor = Column(Unicode(150),nullable=True)
    Nombre_Resolutor = Column(Unicode(150),nullable=True)
    Categorizacion_Nivel_1 = Column(Unicode(150),nullable=True)
    Categorizacion_Nivel_2 = Column(Unicode(150),nullable=True)
    Categorizacion_Nivel_3 = Column(Unicode(200),nullable=True)
    Prioridad = Column(Unicode(30), nullable=True)
    Urgencia = Column(Unicode(30), nullable=True)
    Impacto = Column(Unicode(30), nullable=True)
    Estado = Column(Unicode(50), nullable=True)
    Motivo_Estado = Column(Unicode(100), nullable=True)
    Descripcion = Column(Unicode(1000), nullable=True)
    Detalle = Column(NVARCHAR(None), nullable=True)
    Fuente_Reportada = Column(Unicode(100),nullable=True)


# TABLA STAGING - TAREAS CONSOLIDADAS
stg_task_consolidated_table = Table(
    "stg_task_consolidated",
    Base.metadata,
    Column("Ticket_ID", String(20), nullable=True),
    Column("Ticket_Padre", String(20), nullable=True),
    Column("Fecha_Apertura", DATETIME2(precision=0), nullable=True),
    Column("Fecha_Resolucion", DATETIME2(precision=0), nullable=True),
    Column("Fecha_Cierre", DATETIME2(precision=0), nullable=True),
    Column("Fecha_Ultima_Modificacion", DATETIME2(precision=0), nullable=True),
    Column("Proyecto", Unicode(200), nullable=True),
    Column("ALP", String(30), nullable=True),
    Column("BU", Unicode(50), nullable=True),
    Column("Grupo_Resolutor", Unicode(150), nullable=True),
    Column("Nombre_Resolutor", Unicode(150), nullable=True),
    Column("Categorizacion_Nivel_1", Unicode(150), nullable=True),
    Column("Categorizacion_Nivel_2", Unicode(150), nullable=True),
    Column("Categorizacion_Nivel_3", Unicode(200), nullable=True),
    Column("Prioridad", Unicode(30), nullable=True),
    Column("Urgencia", Unicode(30), nullable=True),
    Column("Impacto", Unicode(30), nullable=True),
    Column("Estado", Unicode(50), nullable=True),
    Column("Motivo_Estado", Unicode(100), nullable=True),
    Column("Descripcion", Unicode(1000), nullable=True),
    Column("Detalle", NVARCHAR(None), nullable=True),
    Column("Fuente_Reportada", Unicode(100), nullable=True),
)