from datetime import datetime
from pydantic import BaseModel


class ImportRunCreate(BaseModel):

    Eir_Tipo: str
    Eir_Nombre_Archivo: str | None = None
    Eir_Fecha_Inicio: datetime
    Eir_Usuario: str | None = None
    Eir_Estado: str


class ImportRunUpdate(BaseModel):

    Eir_Fecha_Fin: datetime | None = None
    Eir_Estado: str
    Eir_Filas_Excel: int = 0
    Eir_Filas_Aceptadas: int = 0
    Eir_Filas_Rechazadas: int = 0
    Eir_Tickets_Nuevos: int = 0
    Eir_Tickets_Modificados: int = 0
    Eir_Tickets_Sin_Cambios: int = 0
    Eir_SQLServer_Status: str | None = None
    Eir_SQLite_Status: str | None = None
    Eir_Error_Mensaje: str | None = None


class ImportRunOut(BaseModel):

    Eir_ID: int
    Eir_Tipo: str
    Eir_Nombre_Archivo: str | None = None
    Eir_Fecha_Inicio: datetime
    Eir_Fecha_Fin: datetime | None = None
    Eir_Estado: str
    Eir_Filas_Excel: int
    Eir_Filas_Aceptadas: int
    Eir_Filas_Rechazadas: int
    Eir_Tickets_Nuevos: int
    Eir_Tickets_Modificados: int
    Eir_Tickets_Sin_Cambios: int
    Eir_SQLServer_Status: str | None = None
    Eir_SQLite_Status: str | None = None
    Eir_Error_Mensaje: str | None = None

    model_config = {
        "from_attributes": True
    }