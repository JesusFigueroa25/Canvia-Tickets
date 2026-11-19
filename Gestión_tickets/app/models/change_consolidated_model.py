"""Modelo de Cambios Consolidados y su tabla staging en SQL Server."""

from sqlalchemy import Column, String, Table, Unicode
from sqlalchemy.dialects.mssql import DATETIME2, NVARCHAR, TINYINT

from app.database.database import Base


class ChangeConsolidated(Base):
    __tablename__ = "change_consolidated"
    __table_args__ = {"schema": "dbo"}

    Ticket_ID = Column(String(20), primary_key=True, nullable=False)
    Fecha_Creacion = Column(DATETIME2(precision=0), nullable=False)
    Fecha_Inicio_Propuesta = Column(DATETIME2(precision=0))
    Fecha_Fin_Propuesta = Column(DATETIME2(precision=0))
    Fecha_Inicio_Planificada = Column(DATETIME2(precision=0))
    Fecha_Fin_Planificada = Column(DATETIME2(precision=0))
    Fecha_Inicio_Real = Column(DATETIME2(precision=0))
    Fecha_Fin_Real = Column(DATETIME2(precision=0))
    Fecha_Ultimo_Worklog = Column(DATETIME2(precision=0))
    ALP = Column(String(30))
    Proyecto = Column(Unicode(200))
    BU = Column(Unicode(50))
    Grupo_Resolutor = Column(Unicode(150))
    Nombre_Resolutor = Column(Unicode(150))
    Categorizacion_Nivel_1 = Column(Unicode(150))
    Categorizacion_Nivel_2 = Column(Unicode(150))
    Categorizacion_Nivel_3 = Column(Unicode(200))
    Prioridad = Column(Unicode(30))
    Urgencia = Column(Unicode(30))
    Impacto = Column(Unicode(30))
    Phase = Column(Unicode(100))
    Estado = Column(Unicode(50))
    Motivo = Column(Unicode(250))
    Tipo_Cambio = Column(Unicode(50))
    Descripcion = Column(Unicode(1000))
    Detalle = Column(NVARCHAR(None))
    Fuente = Column(Unicode(100))
    Valor_Riesgo = Column(TINYINT)
    Autor_Creacion = Column(Unicode(200))
    Codigo_Cierre_Cambio = Column(Unicode(150))
    Motivo_Cancelacion_Cambio = Column(Unicode(250))


# Staging deliberadamente sin PRIMARY KEY: replica las columnas oficiales
# en modo nullable, siguiendo el patrón de stg_task_consolidated.
stg_change_consolidated_table = Table(
    "stg_change_consolidated",
    Base.metadata,
    Column("Ticket_ID", String(20)),
    Column("Fecha_Creacion", DATETIME2(precision=0)),
    Column("Fecha_Inicio_Propuesta", DATETIME2(precision=0)),
    Column("Fecha_Fin_Propuesta", DATETIME2(precision=0)),
    Column("Fecha_Inicio_Planificada", DATETIME2(precision=0)),
    Column("Fecha_Fin_Planificada", DATETIME2(precision=0)),
    Column("Fecha_Inicio_Real", DATETIME2(precision=0)),
    Column("Fecha_Fin_Real", DATETIME2(precision=0)),
    Column("Fecha_Ultimo_Worklog", DATETIME2(precision=0)),
    Column("ALP", String(30)),
    Column("Proyecto", Unicode(200)),
    Column("BU", Unicode(50)),
    Column("Grupo_Resolutor", Unicode(150)),
    Column("Nombre_Resolutor", Unicode(150)),
    Column("Categorizacion_Nivel_1", Unicode(150)),
    Column("Categorizacion_Nivel_2", Unicode(150)),
    Column("Categorizacion_Nivel_3", Unicode(200)),
    Column("Prioridad", Unicode(30)),
    Column("Urgencia", Unicode(30)),
    Column("Impacto", Unicode(30)),
    Column("Phase", Unicode(100)),
    Column("Estado", Unicode(50)),
    Column("Motivo", Unicode(250)),
    Column("Tipo_Cambio", Unicode(50)),
    Column("Descripcion", Unicode(1000)),
    Column("Detalle", NVARCHAR(None)),
    Column("Fuente", Unicode(100)),
    Column("Valor_Riesgo", TINYINT),
    Column("Autor_Creacion", Unicode(200)),
    Column("Codigo_Cierre_Cambio", Unicode(150)),
    Column("Motivo_Cancelacion_Cambio", Unicode(250)),
    schema="dbo",
)
