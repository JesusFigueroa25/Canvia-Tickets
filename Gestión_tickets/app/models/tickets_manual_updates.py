from sqlalchemy import (BigInteger,Column,Identity,Integer,String,Table,Unicode)
from sqlalchemy.dialects.mssql import (DATETIME2,UNIQUEIDENTIFIER,DECIMAL,NVARCHAR,BINARY)
from app.database.database import Base

# TABLA OFICIAL
class TicketsManualUpdate(Base):
    __tablename__ = "tickets_manual_updates"
    Actualizacion_ID = Column(BigInteger,Identity(start=1, increment=1),primary_key=True,nullable=False)
    Ticket_ID = Column(String(20),nullable=False)
    Fecha_Creacion = Column(DATETIME2(precision=0),nullable=True)
    Ticket_type = Column(Unicode(50),nullable=True)
    Grupo_Resolutor = Column(Unicode(150),nullable=True)
    Nombre_Resolutor = Column(Unicode(150),nullable=True)
    Motivo_Resolucion = Column(Unicode(150),nullable=True)
    Estado = Column(Unicode(50),nullable=True)
    Proyecto = Column(Unicode(200),nullable=True)
    Date_Work_Created = Column(DATETIME2(precision=0), nullable=True)
    work_type = Column(Unicode(150), nullable=True)
    work_description = Column(NVARCHAR(None), nullable=True)
    work_time_spent_mins = Column(DECIMAL(18, 2), nullable=True)
    created_by_contact_id = Column(BigInteger, nullable=True)
    work_by_first_name = Column(Unicode(150), nullable=True)
    work_by_last_name = Column(Unicode(150), nullable=True)
    Evento_Clave = Column(BINARY(32), nullable=True)
    Contenido_Hash = Column(BINARY(32), nullable=True)

# TABLA STAGING
stg_tickets_manual_updates_table = Table(
    "stg_tickets_manual_updates",
    Base.metadata,
    Column("Lote_ID",UNIQUEIDENTIFIER,primary_key=True,nullable=False),
    Column("Fila_Excel",Integer,primary_key=True,nullable=False),
    Column("Ticket_ID",String(20),nullable=True),
    Column("Fecha_Creacion",DATETIME2(precision=0),nullable=True),
    Column("Ticket_type",Unicode(50),nullable=True),
    Column("Grupo_Resolutor",Unicode(150),nullable=True),
    Column("Nombre_Resolutor",Unicode(150),nullable=True),
    Column("Motivo_Resolucion",Unicode(150),nullable=True),
    Column("Estado",Unicode(50),nullable=True),
    Column("Proyecto",Unicode(200),nullable=True),
    Column("Date_Work_Created", DATETIME2(precision=0), nullable=True),
    Column("work_type", Unicode(150), nullable=True),
    Column("work_description", NVARCHAR(None), nullable=True),
    Column("work_time_spent_mins", DECIMAL(18, 2), nullable=True),
    Column("created_by_contact_id", BigInteger, nullable=True),
    Column("work_by_first_name", Unicode(150), nullable=True),
    Column("work_by_last_name", Unicode(150), nullable=True),
    Column("Evento_Clave", BINARY(32), nullable=True),
    Column("Contenido_Hash", BINARY(32), nullable=True),
    schema="dbo"
)
