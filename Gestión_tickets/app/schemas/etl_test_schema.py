from pydantic import BaseModel
from typing import Any


class ETLImportOut(BaseModel):
    tipo: str
    tabla: str
    filas_procesadas: int
    mensaje: str


class ETLDataOut(BaseModel):
    tabla: str
    total: int
    datos: list[dict[str, Any]]