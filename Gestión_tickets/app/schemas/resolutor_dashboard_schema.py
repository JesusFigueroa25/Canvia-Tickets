"""Contratos reutilizables para la sección de Resolutores de CANVIA.

Compatible con la estructura de los endpoints de Incidentes Consolidados.
"""
from pydantic import BaseModel, Field


class ResolverPeriodoItem(BaseModel):
    anio: int
    mes: int
    periodo: str


class ResolverMesItem(BaseModel):
    periodo: str
    tickets: int


class ResolverRendimientoItem(BaseModel):
    nombre_resolutor: str
    total_tickets: int
    mensual: list[ResolverMesItem] = Field(default_factory=list)


class ResolverRendimientoOut(BaseModel):
    periodos: list[ResolverPeriodoItem] = Field(default_factory=list)
    resolutores: list[ResolverRendimientoItem] = Field(default_factory=list)
    totales_mensuales: list[ResolverMesItem] = Field(default_factory=list)
    total_general: int = 0
    total_resolutores: int = 0
    pagina: int = 1
    tamano: int = 20
    total_paginas: int = 0


class ResolverTicketsPorResolutorOut(BaseModel):
    total_general: int = 0
    limite: int = 5
    periodos: list[ResolverPeriodoItem] = Field(default_factory=list)
    resolutores: list[ResolverRendimientoItem] = Field(default_factory=list)
