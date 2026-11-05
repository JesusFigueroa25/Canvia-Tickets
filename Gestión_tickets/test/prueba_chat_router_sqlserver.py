
"""Prueba real del enrutador Canvia 4.5.2.

Hace llamadas a OpenAI y consultas SELECT a ServicioDBA.
No realiza escrituras ni commits.
"""

from sqlalchemy import text

from app.database.sqlserver import SQLServerSessionLocal

from app.services.ai.chat_service import (
    interpretar_pregunta_analitica,
    planificar_y_ejecutar_analitica,
)


CASOS = [
    {
        "pregunta": (
            "¿Cuántos incidentes se aperturaron "
            "en marzo de 2026?"
        ),
        "fecha": "Fecha_Apertura",
        "ruta": "tool",
    },
    {
        "pregunta": (
            "¿Cuántos incidentes se resolvieron "
            "en marzo de 2026?"
        ),
        "fecha": "Fecha_Resolucion",
        "ruta": "dynamic_query",
    },
]


def obtener_conteo(resultado):

    plan = resultado["analytical_plan"]

    assert len(plan["metrics"]) == 1
    assert plan["metrics"][0]["function"] == "count"

    alias = plan["metrics"][0]["alias"]

    if resultado["route"] == "tool":

        nombre = resultado[
            "metric_mapping"
        ][alias]

    else:

        nombre = alias

    return int(
        resultado["result"]["metrics"][nombre]
    )


def ejecutar_caso(db, caso):

    pregunta = caso["pregunta"]

    print("\n" + "-" * 65)
    print("PREGUNTA:", pregunta)

    interpretacion = interpretar_pregunta_analitica(
        pregunta
    )

    print(
        "Interpretación:",
        interpretacion["status"],
    )

    if interpretacion["status"] != "interpreted":
        raise AssertionError(
            "Falló la interpretación: "
            + str(interpretacion.get("detail"))
        )

    respuesta = planificar_y_ejecutar_analitica(
        db,
        interpretacion,
    )

    print("Estado:", respuesta["status"])
    print("Ruta:", respuesta.get("route"))
    print("Tool:", respuesta.get("tool_id"))
    print("Plan:", respuesta.get("analytical_plan"))

    if respuesta["status"] not in {
        "success",
        "empty",
    }:

        raise AssertionError(
            "Falló el enrutamiento: "
            + str(
                respuesta.get("detail")
                or respuesta.get("result")
            )
        )

    if respuesta["route"] != caso["ruta"]:

        raise AssertionError(
            "Se esperaba la ruta "
            + caso["ruta"]
        )

    plan = respuesta["analytical_plan"]

    if plan["source"] != "incident_consolidated":
        raise AssertionError(
            "La fuente no coincide con la pregunta"
        )

    fechas = [
        item
        for item in plan["filters"]
        if item["field"] == caso["fecha"]
    ]

    if (
        len(fechas) != 1
        or fechas[0]["operator"] != "date_range"
        or fechas[0]["value"] != {
            "from": "2026-03-01",
            "to": "2026-03-31",
        }
    ):

        raise AssertionError(
            "El período o la fecha no son correctos"
        )

    obtenido = obtener_conteo(
        respuesta
    )

    # Campo SQL elegido exclusivamente desde
    # la lista fija CASOS, no desde GPT.
    columna = caso["fecha"]

    sql = text(f"""
        SELECT COUNT_BIG(*)
        FROM dbo.incident_consolidated
        WHERE [{columna}] >= :desde
          AND [{columna}] < :hasta
    """)

    esperado = int(
        db.execute(
            sql,
            {
                "desde": "2026-03-01",
                "hasta": "2026-04-01",
            },
        ).scalar_one()
    )

    print("Motor:", obtenido)
    print("SQL directo:", esperado)

    if obtenido != esperado:
        raise AssertionError(
            "El conteo no coincide con SQL Server"
        )

    print("[OK] Ruta, filtros y conteo correctos")


def main():

    db = SQLServerSessionLocal()

    try:

        nombre = db.execute(
            text("SELECT DB_NAME()")
        ).scalar_one()

        if nombre.casefold() != "serviciodba":
            raise AssertionError(
                "La conexión no apunta a ServicioDBA"
            )

        for caso in CASOS:
            ejecutar_caso(db, caso)

        print("\n" + "=" * 65)
        print("FASE 4.5.2 - INTEGRACIÓN REAL CORRECTA")
        print("=" * 65)

    finally:

        db.rollback()
        db.close()

        print("Conexión SQL Server cerrada.")


if __name__ == "__main__":
    main()
