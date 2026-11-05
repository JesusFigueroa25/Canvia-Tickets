
"""Prueba reversible de persistencia para Fase 4.6."""

from sqlalchemy import text
from sqlalchemy.orm import Session

from app.database.sqlserver import SQLServerSessionLocal
from app.services.ai.chat_service import procesar_mensaje_chat


def main():

    base = SQLServerSessionLocal()

    try:
        engine = base.get_bind()
    finally:
        base.close()

    cid = None

    with engine.connect() as connection:

        database = connection.execute(
            text("SELECT DB_NAME()")
        ).scalar_one()

        assert database.casefold() == "serviciodba"

        connection.rollback()

        outer = connection.begin()

        try:

            with Session(
                bind=connection,
                join_transaction_mode="rollback_only",
            ) as db:

                result = procesar_mensaje_chat(
                    db,
                    (
                        "¿Cuántos incidentes se "
                        "aperturaron en marzo de 2026?"
                    ),
                )

                assert result["status"] == "success", result
                assert result["persisted"] is True

                cid = result["conversation_id"]

                # Simula la asociación de propietario
                # que realiza el controlador HTTP.
                db.execute(
                    text("""
                        INSERT INTO dbo.ai_conversation_owners
                            (conversation_id, owner_subject)
                        VALUES
                            (:cid, :subject)
                    """),
                    {
                        "cid": cid,
                        "subject": "usuario-prueba-fase-46",
                    },
                )

                n_messages = db.execute(
                    text("""
                        SELECT COUNT_BIG(*)
                        FROM dbo.ai_messages
                        WHERE conversation_id = :cid
                    """),
                    {"cid": cid},
                ).scalar_one()

                n_owner = db.execute(
                    text("""
                        SELECT COUNT_BIG(*)
                        FROM dbo.ai_conversation_owners
                        WHERE conversation_id = :cid
                    """),
                    {"cid": cid},
                ).scalar_one()

                assert n_messages == 2
                assert n_owner == 1

                print("[OK] Conversación creada:", cid)
                print("[OK] Dos mensajes guardados")
                print("[OK] Propietario asociado")

        finally:

            if outer.is_active:
                outer.rollback()

            print("[OK] ROLLBACK externo")

    if cid is not None:

        with engine.connect() as verify:

            for table in (
                "ai_conversations",
                "ai_messages",
                "ai_conversation_owners",
            ):

                where_column = (
                    "id"
                    if table == "ai_conversations"
                    else "conversation_id"
                )

                # Tabla y columna provienen solo
                # de constantes definidas aquí.
                count = verify.execute(
                    text(f"""
                        SELECT COUNT_BIG(*)
                        FROM dbo.{table}
                        WHERE {where_column} = :cid
                    """),
                    {"cid": cid},
                ).scalar_one()

                assert count == 0, (
                    f"Persistieron registros en {table}"
                )

                print(
                    f"[OK] Sin registros en {table}"
                )

    print("\nFASE 4.6 - TRANSACCIÓN REVERSIBLE CORRECTA")


if __name__ == "__main__":
    main()
