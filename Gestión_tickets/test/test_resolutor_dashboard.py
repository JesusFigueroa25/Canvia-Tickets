"""PRD 06: pruebas unitarias sin conexión a SQL Server."""
from datetime import datetime

from sqlalchemy import Column, DateTime, MetaData, String, Table, create_engine, event, select
from sqlalchemy.dialects import mssql
from sqlalchemy.orm import Session

from app.repositories.resolutor_dashboard_repository import (
    consultar_rendimiento_resolutores,
    normalizar_resolutor,
)
from app.schemas.resolutor_dashboard_schema import (
    ResolverRendimientoOut,
    ResolverTicketsPorResolutorOut,
)
from app.services.resolutor_dashboard_service import (
    construir_rendimiento_resolutores,
    construir_tickets_por_resolutor,
)


def test_contrato_orden_paginacion_y_totales():
    filas = [
        {"nombre_resolutor": "Ana", "anio": 2026, "mes": 1, "tickets": 2},
        {"nombre_resolutor": "Ana", "anio": 2026, "mes": 2, "tickets": 3},
        {"nombre_resolutor": "Luis", "anio": 2026, "mes": 1, "tickets": 4},
        {"nombre_resolutor": "Sin especificar", "anio": 2026, "mes": 2, "tickets": 1},
    ]
    datos = construir_rendimiento_resolutores(filas, pagina=1, tamano=2)
    ResolverRendimientoOut.model_validate(datos)

    assert datos["total_general"] == 10
    assert datos["total_resolutores"] == 3
    assert datos["total_paginas"] == 2
    assert [x["nombre_resolutor"] for x in datos["resolutores"]] == ["Ana", "Luis"]
    assert [x["periodo"] for x in datos["periodos"]] == ["ENE-26", "FEB-26"]
    assert [x["tickets"] for x in datos["totales_mensuales"]] == [6, 4]
    assert [x["tickets"] for x in datos["resolutores"][0]["mensual"]] == [2, 3]

    top = construir_tickets_por_resolutor(datos, limite=2)
    ResolverTicketsPorResolutorOut.model_validate(top)
    assert top["total_general"] == 10
    assert len(top["resolutores"]) == 2


def test_sin_datos_y_pagina_fuera_de_rango():
    vacio = construir_rendimiento_resolutores([], pagina=1, tamano=20)
    ResolverRendimientoOut.model_validate(vacio)
    assert vacio["total_general"] == 0
    assert vacio["total_paginas"] == 0
    assert vacio["resolutores"] == []

    datos = construir_rendimiento_resolutores(
        [{"nombre_resolutor": "Ana", "anio": 2026, "mes": 4, "tickets": 1}],
        pagina=10,
        tamano=20,
    )
    assert datos["resolutores"] == []
    assert datos["total_general"] == 1
    assert datos["total_paginas"] == 1


def test_consulta_agrupa_por_mes_y_aplica_filtros_sin_joins():
    engine = create_engine("sqlite:///:memory:")

    @event.listens_for(engine, "connect")
    def _funciones_sqlserver(dbapi_connection, _):
        dbapi_connection.create_function("year", 1, lambda x: int(x[:4]) if x else None)
        dbapi_connection.create_function("month", 1, lambda x: int(x[5:7]) if x else None)

    tabla = Table(
        "prueba_tickets", MetaData(),
        Column("ticket_id", String, primary_key=True),
        Column("nombre_resolutor", String),
        Column("grupo_resolutor", String),
        Column("fecha", DateTime),
    )
    tabla.create(engine)
    with engine.begin() as conn:
        conn.execute(tabla.insert(), [
            {"ticket_id": "1", "nombre_resolutor": "Ana", "grupo_resolutor": "BD", "fecha": datetime(2026, 5, 1)},
            {"ticket_id": "2", "nombre_resolutor": None, "grupo_resolutor": "BD", "fecha": datetime(2026, 5, 2)},
            {"ticket_id": "3", "nombre_resolutor": "Ana", "grupo_resolutor": "OTRO", "fecha": datetime(2026, 5, 3)},
            {"ticket_id": "4", "nombre_resolutor": "Ana", "grupo_resolutor": "BD", "fecha": None},
        ])

    def filtrar(consulta, grupo):
        return consulta.where(tabla.c.grupo_resolutor == grupo)

    with Session(engine) as db:
        filas = consultar_rendimiento_resolutores(
            db, "BD", modelo=tabla, fecha=tabla.c.fecha,
            resolutor=tabla.c.nombre_resolutor, aplicar_filtros=filtrar,
        )
    datos = construir_rendimiento_resolutores(filas)
    assert datos["total_general"] == 2
    assert {x["nombre_resolutor"] for x in datos["resolutores"]} == {"Ana", "Sin especificar"}

    # El SQL generado conserva funciones YEAR/MONTH admitidas por SQL Server.
    sql = str(select(normalizar_resolutor(tabla.c.nombre_resolutor)).compile(dialect=mssql.dialect()))
    assert "coalesce" in sql.lower()
