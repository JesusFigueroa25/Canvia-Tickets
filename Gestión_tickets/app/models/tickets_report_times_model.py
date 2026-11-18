"""Modelo SQLAlchemy: cada registro representa una acción, no un Ticket_ID único."""
from sqlalchemy import BigInteger, Column, Identity, Integer, String, Table, Unicode, text
from sqlalchemy.dialects.mssql import BINARY, DATETIME2, DECIMAL, NVARCHAR, UNIQUEIDENTIFIER
from app.database.database import Base


class TicketReportTime(Base):
    __tablename__ = "tickets_report_times"
    __table_args__ = {"schema": "dbo"}

    Report_Time_ID = Column(BigInteger, Identity(start=1, increment=1), primary_key=True)
    Ticket_ID = Column(String(20), nullable=False)
    Ticket_type = Column(Unicode(50))
    Fecha_Creacion = Column(DATETIME2(precision=0), nullable=False)
    Proyecto = Column(Unicode(200))
    Categorizacion_Nivel_1 = Column(Unicode(150))
    Categorizacion_Nivel_2 = Column(Unicode(150))
    Categorizacion_Nivel_3 = Column(Unicode(200))
    Autor_created = Column(Unicode(200))
    Grupo_Resolutor = Column(Unicode(150))
    Resolutor_Apellido = Column(Unicode(150))
    Resolutor_Nombre = Column(Unicode(150))
    Nombre_Resolutor = Column(Unicode(300))
    Prioridad = Column(Unicode(30))
    Descripcion = Column(NVARCHAR(None))
    Estado = Column(Unicode(50))
    Motivo = Column(Unicode(250))
    Action_Start_Date = Column(DATETIME2(precision=0), nullable=False)
    Action_End_Date = Column(DATETIME2(precision=0))
    Segundos = Column(DECIMAL(18, 2))
    Minutos = Column(DECIMAL(18, 2))
    Horas = Column(DECIMAL(18, 4), nullable=False)
    Evento_Clave = Column(BINARY(32), nullable=False)
    Contenido_Hash = Column(BINARY(32), nullable=False)
    Fecha_Importacion = Column(DATETIME2(precision=0), nullable=False, server_default=text("SYSUTCDATETIME()"))


stg_tickets_report_times_table = Table(
    "stg_tickets_report_times",
    Base.metadata,
    Column("Lote_ID", UNIQUEIDENTIFIER(as_uuid=True), primary_key=True, nullable=False),
    Column("Fila_Excel", Integer, primary_key=True, nullable=False),
    Column("Ticket_ID", String(20)),
    Column("Ticket_type", Unicode(50)),
    Column("Fecha_Creacion", DATETIME2(precision=0)),
    Column("Proyecto", Unicode(200)),
    Column("Categorizacion_Nivel_1", Unicode(150)),
    Column("Categorizacion_Nivel_2", Unicode(150)),
    Column("Categorizacion_Nivel_3", Unicode(200)),
    Column("Autor_created", Unicode(200)),
    Column("Grupo_Resolutor", Unicode(150)),
    Column("Resolutor_Apellido", Unicode(150)),
    Column("Resolutor_Nombre", Unicode(150)),
    Column("Nombre_Resolutor", Unicode(300)),
    Column("Prioridad", Unicode(30)),
    Column("Descripcion", NVARCHAR(None)),
    Column("Estado", Unicode(50)),
    Column("Motivo", Unicode(250)),
    Column("Action_Start_Date", DATETIME2(precision=0)),
    Column("Action_End_Date", DATETIME2(precision=0)),
    Column("Segundos", DECIMAL(18, 2)),
    Column("Minutos", DECIMAL(18, 2)),
    Column("Horas", DECIMAL(18, 4)),
    Column("Evento_Clave", BINARY(32)),
    Column("Contenido_Hash", BINARY(32)),
    schema="dbo",
)
