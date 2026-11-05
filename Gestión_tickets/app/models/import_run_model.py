from sqlalchemy import Column, Integer, String, Unicode, Text, DateTime
from app.database.database import Base


class ImportRun(Base):

    __tablename__ = "import_run"

    Eir_ID = Column(Integer, primary_key=True, autoincrement=True)
    Eir_Tipo = Column(String(50), nullable=False)
    Eir_Nombre_Archivo = Column(Unicode(255), nullable=True)
    Eir_Fecha_Inicio = Column(DateTime, nullable=False)
    Eir_Fecha_Fin = Column(DateTime, nullable=True)
    Eir_Estado = Column(String(20), nullable=False)
    Eir_Filas_Excel = Column(Integer, nullable=False, default=0)
    Eir_Filas_Aceptadas = Column(Integer, nullable=False, default=0)
    Eir_Filas_Rechazadas = Column(Integer, nullable=False, default=0)
    Eir_Tickets_Nuevos = Column(Integer, nullable=False, default=0)
    Eir_Tickets_Modificados = Column(Integer, nullable=False, default=0)
    Eir_Tickets_Sin_Cambios = Column(Integer, nullable=False, default=0)
    Eir_SQLServer_Status = Column(String(20), nullable=True)
    Eir_SQLite_Status = Column(String(20), nullable=True)
    Eir_Error_Mensaje = Column(Text, nullable=True)