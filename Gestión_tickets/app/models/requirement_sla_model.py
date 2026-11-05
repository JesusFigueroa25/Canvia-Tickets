from sqlalchemy import Column, Table, String, Unicode, DateTime
from app.database.database import Base
from sqlalchemy.dialects.mssql import DATETIME2, NVARCHAR

class RequirementSLA(Base):

    __tablename__ = "requirement_sla"

    Ticket_ID = Column(String(20), primary_key=True, nullable=False)
    Proyecto = Column(Unicode(100), nullable=True)
    Descripcion = Column(Unicode(1000), nullable=True)
    Detalle = Column(NVARCHAR(None), nullable=True)
    Fecha_Creacion = Column(DATETIME2(precision=0), nullable=True)
    Fecha_Resolucion = Column(DATETIME2(precision=0), nullable=True)
    Estado = Column(Unicode(50), nullable=True)
    Codigo_Motivo = Column(Unicode(50), nullable=True)
    Prioridad = Column(String(5), nullable=True)
    Usuario_Resolutor = Column(Unicode(100), nullable=True)
    Grupo_Resolutor = Column(Unicode(100), nullable=True)
    Categorizacion_Clase = Column(Unicode(100), nullable=True)
    Categorizacion_Categoria = Column(Unicode(100), nullable=True)
    Categorizacion_Tipo = Column(Unicode(150), nullable=True)
    SLA_Respuesta_Condicion = Column(Unicode(30), nullable=True)
    OLA_Respuesta_Condicion = Column(Unicode(30), nullable=True)
    SLA_Solucion_Condicion = Column(Unicode(30), nullable=True)
    OLA_Solucion_Condicion = Column(Unicode(30), nullable=True)
    Condicion_dia = Column(Unicode(15), nullable=False)


stg_requirement_sla_table = Table("stg_requirement_sla", Base.metadata,

    Column("Ticket_ID", String(20), nullable=True),
    Column("Proyecto", Unicode(100), nullable=True),
    Column("Descripcion", Unicode(1000), nullable=True),
    Column("Detalle", NVARCHAR(None), nullable=True),
    Column("Fecha_Creacion", DATETIME2(precision=0), nullable=True),
    Column("Fecha_Resolucion", DATETIME2(precision=0), nullable=True),
    Column("Estado", Unicode(50), nullable=True),
    Column("Codigo_Motivo", Unicode(50), nullable=True),
    Column("Prioridad", String(5), nullable=True),
    Column("Usuario_Resolutor", Unicode(100), nullable=True),
    Column("Grupo_Resolutor", Unicode(100), nullable=True),
    Column("Categorizacion_Clase", Unicode(100), nullable=True),
    Column("Categorizacion_Categoria", Unicode(100), nullable=True),
    Column("Categorizacion_Tipo", Unicode(150), nullable=True),
    Column("SLA_Respuesta_Condicion", Unicode(30), nullable=True),
    Column("OLA_Respuesta_Condicion", Unicode(30), nullable=True),
    Column("SLA_Solucion_Condicion", Unicode(30), nullable=True),
    Column("OLA_Solucion_Condicion", Unicode(30), nullable=True),
)