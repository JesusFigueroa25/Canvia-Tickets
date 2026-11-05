
"""Prueba real de respuestas analíticas Canvia V1.

Fase 4.5.3:
OpenAI -> Interpretación -> Plan -> SQL Server -> Redacción.

No realiza COMMIT ni escrituras.
"""

from sqlalchemy import text

from app.database.sqlserver import SQLServerSessionLocal

from app.services.ai.chat_service import (
    interpretar_pregunta_analitica,
    planificar_y_ejecutar_analitica,
    redactar_respuesta_analitica,
)


CASOS = [
    {
        "pregunta": (
            "¿Cuántos incidentes se aperturaron "
            "en marzo de 2026?"
        ),
        "field": "Fecha_Apertura",
        "route": "tool",
    },
    {
        "pregunta": (
            "¿Cuántos incidentes se resolvieron "
            "en marzo de 2026?"
        ),
        "field": "Fecha_Resolucion",
        "route": "dynamic_query",
    },
]


def obtener_total_ejecutado(execution):

    plan = execution["analytical_plan"]

    assert len(plan["metrics"]) == 1
    assert plan["metrics"][0]["function"] == "count"

    alias = plan["metrics"][0]["alias"]

    actual_name = execution[
        "metric_mapping"
    ].get(alias, alias)

    return int(
        execution["result"]["metrics"][actual_name]
    )


def verificar_caso(db, caso):

    print("\n" + "=" * 65)
    print("PREGUNTA:", caso["pregunta"])
    print("=" * 65)

    # ---------------------------------------------
    # 1. Interpretar con OpenAI
    # ---------------------------------------------

    interpretation = interpretar_pregunta_analitica(
        caso["pregunta"]
    )

    assert interpretation["status"] == "interpreted", (
        f"Interpretación fallida: {interpretation}"
    )

    print("[OK] Interpretación validada")

    # ---------------------------------------------
    # 2. Planificar y consultar SQL Server
    # ---------------------------------------------

    execution = planificar_y_ejecutar_analitica(
        db,
        interpretation,
    )

    assert execution["status"] == "success", (
        f"Consulta fallida: {execution}"
    )

    assert execution["route"] == caso["route"], (
        f"Ruta inesperada: {execution['route']}"
    )

    plan = execution["analytical_plan"]

    assert plan["source"] == "incident_consolidated"

    assert plan["operation"] == "aggregate"

    assert len(plan["filters"]) == 1

    assert plan["filters"][0] == {
        "field": caso["field"],
        "operator": "date_range",
        "value": {
            "from": "2026-03-01",
            "to": "2026-03-31",
        },
    }

    print("[OK] Enrutamiento y filtros correctos")

    # ---------------------------------------------
    # 3. Verificación SQL independiente
    # ---------------------------------------------

    # El nombre de columna procede de CASOS,
    # una lista fija definida por el desarrollador.
    # Nunca procede de GPT.
    columna = caso["field"]

    esperado = int(
        db.execute(
            text(f"""
                SELECT COUNT_BIG(*)
                FROM dbo.incident_consolidated
                WHERE [{columna}] >= :desde
                  AND [{columna}] < :hasta
            """),
            {
                "desde": "2026-03-01",
                "hasta": "2026-04-01",
            },
        ).scalar_one()
    )

    total_motor = obtener_total_ejecutado(
        execution
    )

    assert total_motor == esperado, (
        f"Motor={total_motor}, SQL={esperado}"
    )

    print(
        f"[OK] Motor={total_motor} | "
        f"SQL={esperado}"
    )

    # ---------------------------------------------
    # 4. Generar respuesta con OpenAI
    # ---------------------------------------------

    redaccion = redactar_respuesta_analitica(
        execution
    )

    assert redaccion["status"] == "success", (
        f"Redacción fallida: {redaccion}"
    )

    assert (
        redaccion["generation_mode"]
        == "openai_structured"
    ), (
        "OpenAI no generó un guion válido: "
        + str(redaccion.get("generation_warning"))
    )

    cifra = f"{esperado:,}".replace(",", ".")

    assert cifra in redaccion["answer"], (
        "La respuesta no contiene el valor SQL esperado"
    )

    assert redaccion["source"] == (
        "incident_consolidated"
    )

    assert redaccion["persisted"] is False

    print("[OK] Redacción fundamentada")

    print("\nRESPUESTA DEL CHATBOT:\n")
    print(redaccion["answer"])

    print("\nRuta:", redaccion["route"])
    print(
        "Generación:",
        redaccion["generation_mode"]
    )


def main():

    db = SQLServerSessionLocal()

    try:

        db_name = db.execute(
            text("SELECT DB_NAME()")
        ).scalar_one()

        assert db_name.casefold() == "serviciodba"

        print(
            "FASE 4.5.3 - PRUEBA REAL "
            "OPENAI + SERVICIODBA"
        )

        for caso in CASOS:
            verificar_caso(db, caso)

        print("\n" + "=" * 65)
        print("FASE 4.5.3 - VALIDACIÓN CORRECTA")
        print("=" * 65)

    finally:

        db.rollback()
        db.close()

        print("Conexión SQL Server cerrada.")


if __name__ == "__main__":
    main()
