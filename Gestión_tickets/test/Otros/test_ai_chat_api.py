
import json
import unittest

from unittest.mock import patch

from fastapi import FastAPI, HTTPException
from fastapi.testclient import TestClient

from app.controllers import ai_chat_controller as ctrl


# ============================================================
# BASE DE DATOS SIMULADA
# ============================================================

class FakeResult:

    def __init__(self, value=None, rows=None):
        self.value = value
        self.rows = rows or []

    def scalar_one_or_none(self):
        return self.value

    def mappings(self):
        return self

    def one_or_none(self):
        return self.rows[0] if self.rows else None

    def all(self):
        return self.rows



from datetime import datetime


class FakeResult:

    def __init__(self, value=None, rows=None):
        self.value = value
        self.rows = rows if rows is not None else []

    def scalar_one_or_none(self):
        return self.value

    def scalar_one(self):
        return self.value

    def mappings(self):
        return self

    def one_or_none(self):
        return self.rows[0] if self.rows else None

    def first(self):
        return self.rows[0] if self.rows else None

    def all(self):
        return self.rows

    def fetchall(self):
        return self.rows


class FakeDB:

    def __init__(self):

        self.conversations = {
            1: {
                "id": 1,
                "title": "Nueva conversación",
                "context_state": json.dumps({
                    "version": 1,
                    "source": "incident_consolidated",
                    "date_field": "Fecha_Apertura",
                    "filters": [],
                }),
                "created_at": datetime(2026, 10, 27),
            }
        }

        self.messages = {
            1: [
                {
                    "id": 10,
                    "conversation_id": 1,
                    "role": "user",
                    "content": "¿Cuántos incidentes?",
                    "response_type": None,
                    "source": None,
                    "created_at": datetime(2026, 10, 27),
                },
                {
                    "id": 11,
                    "conversation_id": 1,
                    "role": "assistant",
                    "content": "Total de tickets: 12.",
                    "response_type": "text",
                    "source": "incident_consolidated",
                    "created_at": datetime(2026, 10, 27),
                },
            ]
        }

    def get_bind(self):
        return object()

    def execute(self, statement, params=None):

        sql = " ".join(
            str(statement).lower().split()
        )

        params = params or {}

        cid = params.get(
            "conversation_id",
            params.get("cid"),
        )

        if "dbo.ai_conversation_owners" in sql:
            raise AssertionError(
                "La prueba utiliza un esquema antiguo "
                "de propietarios de conversaciones"
            )

        # --------------------------------------------
        # Tabla de conversaciones
        # --------------------------------------------
        if "from dbo.ai_conversations" in sql:

            if "count(" in sql:
                return FakeResult(
                    value=len(self.conversations)
                )

            if cid is not None:

                row = self.conversations.get(cid)

                return FakeResult(
                    value=1 if row else None,
                    rows=[row] if row else [],
                )

            rows = list(self.conversations.values())

            offset = params.get(
                "offset",
                0,
            )

            limit = params.get("limit")

            if limit is not None:
                rows = rows[offset:offset + limit]
            else:
                rows = rows[offset:]

            return FakeResult(
                value=len(self.conversations),
                rows=rows,
            )

        # --------------------------------------------
        # Tabla de mensajes
        # --------------------------------------------
        if "from dbo.ai_messages" in sql:

            rows = self.messages.get(
                cid,
                [],
            )

            if "count(" in sql:
                return FakeResult(
                    value=len(rows)
                )

            offset = params.get(
                "offset",
                0,
            )

            limit = params.get("limit")

            if limit is not None:
                rows = rows[offset:offset + limit]
            else:
                rows = rows[offset:]

            return FakeResult(
                value=len(rows),
                rows=rows,
            )

        raise AssertionError(
            f"SQL no esperado: {sql}"
        )



# ============================================================
# RESPUESTA SIMULADA DEL NÚCLEO
# ============================================================

def chat_result(cid=1):

    return {
        "status": "success",
        "conversation_id": cid,
        "response_type": "text",
        "answer": "Total de tickets: 12 tickets.",
        "context_state": {
            "version": 1,
            "source": "incident_consolidated",
            "date_field": "Fecha_Apertura",
            "filters": [],
        },
        "source": "incident_consolidated",
        "route": "tool",
        "generation_mode": "openai_structured",
        "metrics": {"total_tickets": 12},
        "executed": True,
        "persisted": True,
        "analytical_plan": {
            "private_internal": "no_exponer"
        },
    }


# ============================================================
# TESTS HTTP
# ============================================================

class TestAIChatAPI(unittest.TestCase):


    def setUp(self):

        self.app = FastAPI()
        self.app.include_router(ctrl.router)

        self.db = FakeDB()

        # Simular la conexión SQL Server.
        self.app.dependency_overrides[
            ctrl.get_sqlserver_db
        ] = lambda: self.db

        self.client = TestClient(
            self.app,
            raise_server_exceptions=True,
        )

        self.addCleanup(self.client.close)

        self.addCleanup(
            self.app.dependency_overrides.clear
        )


    def test_01_crear_conversacion_http(self):

        with patch.object(
            ctrl,
            "procesar_mensaje_chat",
            return_value=chat_result(),
        ) as mocked:

            response = self.client.post(
                "/ai-chat/messages",
                json={
                    "pregunta": "Total de incidentes"
                },
            )

        self.assertEqual(
            response.status_code,
            201,
        )

        data = response.json()

        self.assertEqual(
            data["status"],
            "success",
        )

        self.assertEqual(
            data["conversation_id"],
            1,
        )

        self.assertTrue(data["persisted"])

        mocked.assert_called_once()

    def test_02_continuar_conversacion_http(self):

        with patch.object(
            ctrl,
            "procesar_mensaje_chat",
            return_value=chat_result(),
        ):

            response = self.client.post(
                "/ai-chat/messages",
                json={
                    "pregunta": "¿Y en abril?",
                    "conversation_id": 1,
                },
            )

        self.assertEqual(
            response.status_code,
            200,
        )

    def test_03_respuesta_no_expone_plan_interno(self):

        with patch.object(
            ctrl,
            "procesar_mensaje_chat",
            return_value=chat_result(),
        ):

            data = self.client.post(
                "/ai-chat/messages",
                json={
                    "pregunta": "Total"
                },
            ).json()

        self.assertNotIn(
            "analytical_plan",
            data,
        )

        self.assertIn(
            "answer",
            data,
        )

    def test_04_pregunta_vacia_422(self):

        response = self.client.post(
            "/ai-chat/messages",
            json={"pregunta": ""},
        )

        self.assertEqual(
            response.status_code,
            422,
        )

    def test_05_id_invalido_422(self):

        response = self.client.post(
            "/ai-chat/messages",
            json={
                "pregunta": "Total",
                "conversation_id": -4,
            },
        )

        self.assertEqual(
            response.status_code,
            422,
        )

    def test_06_parametro_no_admitido_422(self):

        response = self.client.post(
            "/ai-chat/messages",
            json={
                "pregunta": "Total",
                "sql": "SELECT * FROM usuarios",
            },
        )

        self.assertEqual(
            response.status_code,
            422,
        )

    def test_07_listar_conversaciones(self):

        response = self.client.get(
            "/ai-chat/conversations"
        )

        self.assertEqual(
            response.status_code,
            200,
        )

        self.assertEqual(
            len(
                response.json()["conversations"]
            ),
            1,
        )

    def test_08_obtener_conversacion_propia(self):

        response = self.client.get(
            "/ai-chat/conversations/1"
        )

        self.assertEqual(
            response.status_code,
            200,
        )

        self.assertEqual(
            response.json()["id"],
            1,
        )

    def test_09_historial_ordenado(self):

        response = self.client.get(
            "/ai-chat/conversations/1/messages"
        )

        self.assertEqual(
            response.status_code,
            200,
        )

        messages = response.json()["messages"]

        self.assertEqual(
            [m["id"] for m in messages],
            [10, 11],
        )

        self.assertEqual(
            [m["role"] for m in messages],
            ["user", "assistant"],
        )


    def test_10_conversacion_inexistente_404(self):

        response = self.client.get(
            "/ai-chat/conversations/999"
        )

        self.assertEqual(
            response.status_code,
            404,
        )

    def test_11_historial_inexistente_404(self):

        response = self.client.get(
            "/ai-chat/conversations/999/messages"
        )

        self.assertEqual(
            response.status_code,
            404,
        )

    def test_12_historial_vacio(self):

        self.db.messages[1] = []

        response = self.client.get(
            "/ai-chat/conversations/1/messages"
        )

        self.assertEqual(
            response.status_code,
            200,
        )

        self.assertEqual(
            response.json()["messages"],
            [],
        )

    def test_15_listado_vacio(self):

        self.db.conversations.clear()

        response = self.client.get(
            "/ai-chat/conversations"
        )

        self.assertEqual(
            response.status_code,
            200,
        )

        self.assertEqual(
            response.json()["conversations"],
            [],
        )



if __name__ == "__main__":
    unittest.main(verbosity=2)

