
from pydantic import BaseModel, Field


class TicketsManualUpdatesImportOut(BaseModel):

    tipo: str = "tickets_manual_updates"

    tabla_staging: str = "stg_tickets_manual_updates"

    tabla_destino: str = "tickets_manual_updates"

    lote_id: str

    filas_excel: int = Field(ge=0)

    # Tickets únicos del archivo, después del ETL.
    filas_procesadas: int = Field(ge=0)

    filas_staging: int = Field(ge=0)

    # Repetidos del Excel + existentes en SQL Server.
    duplicados: int = Field(ge=0)

    nuevos: int = Field(ge=0)

    modificados: int = Field(default=0, ge=0)

    # Tickets de staging ya existentes en SQL Server.
    sin_cambios: int = Field(ge=0)

    tickets_distintos: int = Field(ge=0)

    # Duplicados eliminados dentro del Excel.
    filas_ticket_repetido: int = Field(ge=0)

    mensaje: str
    