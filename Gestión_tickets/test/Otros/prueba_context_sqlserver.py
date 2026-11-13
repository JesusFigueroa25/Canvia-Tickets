import json

from sqlalchemy import text

from app.database.sqlserver import SQLServerSessionLocal

from app.services.ai.context_service import (
    combinar_contexto,
    cargar_contexto,
    guardar_contexto,
)


def verificar(nombre, condicion):

    if not condicion:
        raise AssertionError(
            f"[FALLÓ] {nombre}"
        )

    print(f"[OK] {nombre}")


def main():

    db = SQLServerSessionLocal()
    conversation_id = None

    try:

        print("=" * 65)
        print("FASE 4.4 - INTEGRACIÓN CONTEXT SERVICE")
        print("=" * 65)

        # ------------------------------------------------
        # 1. Verificar la base de datos
        # ------------------------------------------------

        nombre_db = db.execute(
            text("SELECT DB_NAME()")
        ).scalar_one()

        print("Base de datos:", nombre_db)

        verificar(
            "Conexión a ServicioDBA",
            nombre_db.casefold() == "serviciodba",
        )

        # ------------------------------------------------
        # 2. Crear conversación dentro de la transacción
        # ------------------------------------------------

        conversation_id = db.execute(
            text("""
                INSERT INTO dbo.ai_conversations
                    (title, context_state)
                OUTPUT INSERTED.id
                VALUES
                    (:title, :context_state)
            """),
            {
                "title": "__PRUEBA_CONTEXT_CANVIA__",
                "context_state": "{}",
            },
        ).scalar_one()

        conversation_id = int(
            conversation_id
        )

        print(
            "Conversación temporal:",
            conversation_id,
        )

        verificar(
            "Conversación temporal creada",
            conversation_id > 0,
        )

        # ------------------------------------------------
        # 3. Insertar dos mensajes temporales
        # ------------------------------------------------

        mensajes = [
            (
                "user",
                "¿Cuántos incidentes tuvo UNACEM?",
            ),
            (
                "assistant",
                "Respuesta analítica de prueba.",
            ),
        ]

        for role, content in mensajes:

            db.execute(
                text("""
                    INSERT INTO dbo.ai_messages
                        (conversation_id, role, content)
                    VALUES
                        (:conversation_id, :role, :content)
                """),
                {
                    "conversation_id": conversation_id,
                    "role": role,
                    "content": content,
                },
            )

        # ------------------------------------------------
        # 4. Cargar el estado inicial desde SQL Server
        # ------------------------------------------------

        inicial = cargar_contexto(
            db,
            conversation_id,
            limit=10,
        )

        verificar(
            "Cargar conversación inicial",
            inicial["status"] == "success",
        )

        verificar(
            "Estado inicial sin filtros",
            inicial["context_state"]["filters"] == [],
        )

        verificar(
            "Recuperar dos mensajes",
            inicial["history_count"] == 2,
        )

        verificar(
            "Orden cronológico del historial",
            [
                m["role"]
                for m in inicial["messages"]
            ] == ["user", "assistant"],
        )

        # ------------------------------------------------
        # 5. Crear un contexto analítico válido
        # ------------------------------------------------

        combinado = combinar_contexto(
            inicial["context_state"],
            {
                "source": "incident_consolidated",
                "filters": [
                    {
                        "field": "Proyecto",
                        "operator": "eq",
                        "value": "UNACEM",
                    },
                    {
                        "field": "Prioridad",
                        "operator": "eq",
                        "value": "1-Critical",
                    },
                ],
                "period": {
                    "desde": "2026-03-01",
                    "hasta": "2026-03-31",
                },
            },
        )

        verificar(
            "Generar contexto estructurado",
            combinado["status"] == "success",
        )

        estado_esperado = combinado[
            "context_state"
        ]

        # ------------------------------------------------
        # 6. Guardar mediante el repositorio real
        # ------------------------------------------------

        guardado = guardar_contexto(
            db,
            conversation_id,
            estado_esperado,
        )

        verificar(
            "Guardar contexto con repository",
            guardado["status"] == "success",
        )

        verificar(
            "Servicio no hizo COMMIT",
            guardado["committed"] is False,
        )

        # ------------------------------------------------
        # 7. Leer directamente la columna SQL Server
        # ------------------------------------------------

        contexto_sql = db.execute(
            text("""
                SELECT context_state
                FROM dbo.ai_conversations
                WHERE id = :conversation_id
            """),
            {
                "conversation_id": conversation_id,
            },
        ).scalar_one()

        contexto_real = (
            json.loads(contexto_sql)
            if isinstance(contexto_sql, str)
            else contexto_sql
        )

        verificar(
            "JSON persistido correctamente",
            contexto_real == estado_esperado,
        )

        # ------------------------------------------------
        # 8. Recuperar nuevamente usando Context Service
        # ------------------------------------------------

        recuperado = cargar_contexto(
            db,
            conversation_id,
            limit=10,
        )

        verificar(
            "Recargar contexto desde repository",
            recuperado["status"] == "success",
        )

        verificar(
            "Estado recuperado coincide",
            recuperado["context_state"]
            == estado_esperado,
        )

        verificar(
            "Historial permanece disponible",
            recuperado["history_count"] == 2,
        )

        print("\nContexto recuperado:")
        print(
            json.dumps(
                recuperado["context_state"],
                indent=2,
                ensure_ascii=False,
            )
        )

    finally:

        # ------------------------------------------------
        # 9. Deshacer todos los registros temporales
        # ------------------------------------------------

        db.rollback()
        db.close()

        print("\nROLLBACK ejecutado.")
        print("Primera sesión cerrada.")

    # ----------------------------------------------------
    # 10. Verificar limpieza desde otra conexión
    # ----------------------------------------------------

    if conversation_id is not None:

        comprobacion = SQLServerSessionLocal()

        try:

            cantidad = comprobacion.execute(
                text("""
                    SELECT COUNT_BIG(*)
                    FROM dbo.ai_conversations
                    WHERE id = :conversation_id
                """),
                {
                    "conversation_id": conversation_id,
                },
            ).scalar_one()

            verificar(
                "No quedan conversaciones temporales",
                int(cantidad) == 0,
            )

            mensajes_restantes = comprobacion.execute(
                text("""
                    SELECT COUNT_BIG(*)
                    FROM dbo.ai_messages
                    WHERE conversation_id = :conversation_id
                """),
                {
                    "conversation_id": conversation_id,
                },
            ).scalar_one()

            verificar(
                "No quedan mensajes temporales",
                int(mensajes_restantes) == 0,
            )

        finally:

            comprobacion.rollback()
            comprobacion.close()

    print("\n" + "=" * 65)
    print("FASE 4.4 - VALIDACIÓN SQL SERVER CORRECTA")
    print("=" * 65)


if __name__ == "__main__":
    main()
