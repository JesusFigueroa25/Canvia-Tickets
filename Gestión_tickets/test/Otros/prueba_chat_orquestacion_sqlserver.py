
"""Canvia - Prueba de orquestación 4.5.4.

Prueba una conversación real de dos mensajes
con OpenAI y ServicioDBA.

Utiliza una transacción SQLAlchemy externa.
Al finalizar, revierte todos los registros de prueba.
"""

import json

from sqlalchemy import text
from sqlalchemy.orm import Session

from app.database.sqlserver import (
    SQLServerSessionLocal,
)

from app.services.ai.chat_service import (
    procesar_mensaje_chat,
)


def comprobar(condicion, mensaje):

    if not condicion:
        raise AssertionError(mensaje)

    print("[OK]", mensaje)


def main():

    # Obtener el engine real sin alterar
    # la configuración de SQL Server.
    initial_session = SQLServerSessionLocal()

    try:
        engine = initial_session.get_bind()

    finally:
        initial_session.close()

    conversation_id = None

    with engine.connect() as connection:

        db_name = connection.execute(
            text("SELECT DB_NAME()")
        ).scalar_one()

        comprobar(
            db_name.casefold() == "serviciodba",
            "Conexión a ServicioDBA",
        )

        # Este BEGIN es externo a Session.
        # Finalizar la transacción de lectura de DB_NAME().
        connection.rollback()

        # Iniciar la transacción real de prueba.
        outer_transaction = connection.begin()

        # No propagamos el commit de Session
        # a la transacción externa.
        db = Session(
            bind=connection,
            join_transaction_mode="rollback_only",
        )

        try:

            print("\n" + "=" * 65)
            print("FASE 4.5.4 - CONVERSACIÓN REAL")
            print("=" * 65)

            # ------------------------------------
            # Primera pregunta
            # ------------------------------------

            first = procesar_mensaje_chat(
                db,
                (
                    "¿Cuántos incidentes se "
                    "aperturaron en marzo de 2026?"
                ),
            )

            print("\nPRIMERA RESPUESTA")
            print(first.get("answer"))
            print("Estado:", first["status"])
            print("Ruta:", first.get("route"))

            comprobar(
                first["status"] == "success",
                "Primera pregunta respondida",
            )

            comprobar(
                first["persisted"] is True,
                "Primera pregunta guardada",
            )

            conversation_id = first[
                "conversation_id"
            ]

            comprobar(
                isinstance(conversation_id, int),
                "Conversation ID generado",
            )

            # ------------------------------------
            # Segunda pregunta
            # ------------------------------------

            second = procesar_mensaje_chat(
                db,
                "¿Y en abril de 2026?",
                conversation_id=conversation_id,
            )

            print("\nSEGUNDA RESPUESTA")
            print(second.get("answer"))
            print("Estado:", second["status"])
            print("Ruta:", second.get("route"))

            comprobar(
                second["status"] == "success",
                "Pregunta de seguimiento respondida",
            )

            comprobar(
                second["persisted"] is True,
                "Seguimiento guardado",
            )

            comprobar(
                second["conversation_id"]
                == conversation_id,
                "Misma conversación conservada",
            )

            filters = second[
                "context_state"
            ]["filters"]

            date_filters = [
                item
                for item in filters
                if item["field"] == "Fecha_Apertura"
            ]

            comprobar(
                len(date_filters) == 1
                and date_filters[0]["value"] == {
                    "from": "2026-04-01",
                    "to": "2026-04-30",
                },
                "El contexto avanzó de marzo a abril",
            )

            # ------------------------------------
            # Validar mensajes persistidos
            # ------------------------------------

            rows = db.execute(
                text("""
                    SELECT role, content
                    FROM dbo.ai_messages
                    WHERE conversation_id = :cid
                    ORDER BY id
                """),
                {"cid": conversation_id},
            ).all()

            comprobar(
                len(rows) == 4,
                "Dos preguntas y dos respuestas guardadas",
            )

            comprobar(
                [r[0] for r in rows]
                == [
                    "user",
                    "assistant",
                    "user",
                    "assistant",
                ],
                "Orden de mensajes correcto",
            )

            raw_context = db.execute(
                text("""
                    SELECT context_state
                    FROM dbo.ai_conversations
                    WHERE id = :cid
                """),
                {"cid": conversation_id},
            ).scalar_one()

            stored_context = json.loads(
                raw_context
            )

            comprobar(
                stored_context
                == second["context_state"],
                "Contexto SQL Server coincide",
            )

        finally:

            db.close()

            # Nunca dejamos estos datos de prueba.
            if outer_transaction.is_active:
                outer_transaction.rollback()

            print("\nROLLBACK externo ejecutado.")

    # ------------------------------------------------
    # Comprobar limpieza en una conexión independiente
    # ------------------------------------------------

    if conversation_id is not None:

        with engine.connect() as verify:

            count_conversation = verify.execute(
                text("""
                    SELECT COUNT_BIG(*)
                    FROM dbo.ai_conversations
                    WHERE id = :cid
                """),
                {"cid": conversation_id},
            ).scalar_one()

            count_messages = verify.execute(
                text("""
                    SELECT COUNT_BIG(*)
                    FROM dbo.ai_messages
                    WHERE conversation_id = :cid
                """),
                {"cid": conversation_id},
            ).scalar_one()

            comprobar(
                count_conversation == 0,
                "Conversación temporal eliminada",
            )

            comprobar(
                count_messages == 0,
                "Mensajes temporales eliminados",
            )

    print("\n" + "=" * 65)
    print("FASE 4.5.4 - INTEGRACIÓN CORRECTA")
    print("=" * 65)


if __name__ == "__main__":
    main()
