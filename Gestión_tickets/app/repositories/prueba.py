
from app.database.sqlserver import SQLServerSessionLocal

from app.repositories import ai_conversation_repository
from app.repositories import ai_message_repository


db = SQLServerSessionLocal()

try:
    # 1. Crear conversación
    conversation = ai_conversation_repository.create(
        db,
        title="Prueba Chatbot IA",
        context_state={
            "domain": "incident",
            "source": "incident_consolidated",
            "filters": {}
        }
    )

    print("Conversación creada:", conversation.id)

    # 2. Guardar mensaje del usuario
    user_message = ai_message_repository.create(
        db,
        conversation_id=conversation.id,
        role="user",
        content="¿Cuántos incidentes hubo?"
    )

    # 3. Guardar respuesta de prueba
    assistant_message = ai_message_repository.create(
        db,
        conversation_id=conversation.id,
        role="assistant",
        content="Respuesta de prueba de persistencia.",
        response_type="text",
        source="incident_consolidated",
        filters_json={},
        metrics_json={"total_tickets": 0},
        evidence_json={"test": True}
    )

    # 4. Recuperar historial
    messages = ai_message_repository.get_last_messages(
        db,
        conversation_id=conversation.id
    )

    print("Mensajes recuperados:", len(messages))

    for message in messages:
        print(message.id, message.role, message.content)

    assert len(messages) == 2
    assert messages[0].role == "user"
    assert messages[1].role == "assistant"

    print("Prueba de persistencia correcta")

finally:
    # Deshace las inserciones de prueba.
    db.rollback()
    db.close()
