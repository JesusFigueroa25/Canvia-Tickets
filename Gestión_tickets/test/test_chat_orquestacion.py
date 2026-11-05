
import json
import unittest

from copy import deepcopy
from contextlib import ExitStack
from unittest.mock import patch

from app.services.ai.chat_service import (
    procesar_mensaje_chat,
)


# ============================================================
# SESIÓN SQL SERVER SIMULADA
# ============================================================

class FakeResult:

    def __init__(self, value):
        self.value = value

    def scalar_one(self):
        return self.value

    def scalar_one_or_none(self):
        return self.value


class FakeSession:

    def __init__(self):

        self.conversations = {}
        self.messages = []

        self.next_conversation = 1
        self.next_message = 1

        self.commits = 0
        self.rollbacks = 0

        self.fail_commit = False
        self.fail_assistant = False

        self._snapshot = ({}, [])

    def checkpoint(self):

        self._snapshot = (
            deepcopy(self.conversations),
            deepcopy(self.messages),
        )

    def seed(self, context=None):

        conversation_id = self.next_conversation
        self.next_conversation += 1

        self.conversations[conversation_id] = (
            json.dumps(
                context or {
                    "version": 1,
                    "source": "incident_consolidated",
                    "date_field": "Fecha_Apertura",
                    "filters": [],
                }
            )
        )

        self.checkpoint()
        return conversation_id

    def execute(self, statement, params=None):

        query = " ".join(
            str(statement).lower().split()
        )

        params = params or {}

        cid = params.get("conversation_id")

        if (
            "select context_state" in query
            and "from dbo.ai_conversations" in query
        ):

            return FakeResult(
                self.conversations.get(cid)
            )

        if (
            "select max(id)" in query
            and "from dbo.ai_messages" in query
        ):

            ids = [
                msg["id"]
                for msg in self.messages
                if msg["conversation_id"] == cid
            ]

            return FakeResult(
                max(ids) if ids else None
            )

        if "insert into dbo.ai_conversations" in query:

            new_id = self.next_conversation
            self.next_conversation += 1

            self.conversations[new_id] = (
                params["context_state"]
            )

            return FakeResult(new_id)

        if "insert into dbo.ai_messages" in query:

            if (
                params["role"] == "assistant"
                and self.fail_assistant
            ):
                raise RuntimeError(
                    "Inserción assistant fallida"
                )

            row = dict(params)

            row["id"] = self.next_message
            self.next_message += 1

            self.messages.append(row)

            return FakeResult(row["id"])

        raise AssertionError(
            "Consulta no simulada: " + query
        )

    def commit(self):

        if self.fail_commit:
            raise RuntimeError(
                "Falló el commit"
            )

        self.commits += 1
        self.checkpoint()

    def rollback(self):

        self.rollbacks += 1

        self.conversations = deepcopy(
            self._snapshot[0]
        )

        self.messages = deepcopy(
            self._snapshot[1]
        )


# ============================================================
# COMPONENTES SIMULADOS
# ============================================================

def fake_cargar(db, cid, limit=10):

    if cid not in db.conversations:

        return {
            "status": "not_found",
            "detail": "No existe",
        }

    messages = [
        {
            "role": m["role"],
            "content": m["content"],
        }
        for m in db.messages
        if m["conversation_id"] == cid
    ]

    return {
        "status": "success",
        "context_state": json.loads(
            db.conversations[cid]
        ),
        "messages": messages[-limit:],
        "history_count": len(messages),
    }


def fake_guardar(db, cid, state):

    if cid not in db.conversations:
        return {"status": "not_found"}

    db.conversations[cid] = json.dumps(state)

    return {
        "status": "success",
        "committed": False,
    }


def fake_interpretar(
    pregunta,
    *,
    context_state=None,
    messages=None,
    **kwargs,
):

    state = deepcopy(
        context_state or {
            "version": 1,
            "source": None,
            "date_field": None,
            "filters": [],
        }
    )

    if state["source"] is None:
        state["source"] = "incident_consolidated"
        state["date_field"] = "Fecha_Apertura"

    if "abril" in pregunta.lower():

        state["filters"] = [{
            "field": "Fecha_Apertura",
            "operator": "date_range",
            "value": {
                "from": "2026-04-01",
                "to": "2026-04-30",
            },
        }]

    return {
        "status": "interpreted",
        "intent": "analytics",
        "model": "fake",
        "analytical_goal": "Contar tickets",
        "group_by": [],
        "max_results": None,
        "context_candidate": state,
        "warnings": [],
    }


def fake_planificar(db, interpretacion, **kwargs):

    state = interpretacion["context_candidate"]

    return {
        "status": "success",
        "route": "tool",
        "source": state["source"],
        "tool_id": "ic_consultar_kpis",
        "metric_mapping": {
            "total": "total_tickets",
        },
        "analytical_plan": {
            "version": 1,
            "source": state["source"],
            "operation": "aggregate",
            "filters": state["filters"],
            "group_by": [],
            "metrics": [{
                "alias": "total",
                "function": "count",
                "field": None,
                "condition": None,
            }],
            "order_by": [],
            "limit": None,
            "offset": 0,
        },
        "result": {
            "status": "success",
            "coverage": "complete",
            "metrics": {
                "total_tickets": 12,
            },
            "evidence": {
                "validated": True,
            },
        },
        "executed": True,
        "persisted": False,
    }


def fake_redactar(execution, **kwargs):

    return {
        "status": "success",
        "response_type": "text",
        "answer": "Total de tickets: 12 tickets.",
        "generation_mode": "openai_structured",
        "model": "fake",
        "facts_used": ["F1"],
        "persisted": False,
    }


# ============================================================
# PRUEBAS
# ============================================================

class TestChatOrquestacion(unittest.TestCase):

    def setUp(self):

        self.db = FakeSession()

        stack = ExitStack()

        self.addCleanup(stack.close)

        self.load = stack.enter_context(
            patch(
                "app.services.ai.context_service.cargar_contexto",
                side_effect=fake_cargar,
            )
        )

        self.save = stack.enter_context(
            patch(
                "app.services.ai.context_service.guardar_contexto",
                side_effect=fake_guardar,
            )
        )

        self.interpret = stack.enter_context(
            patch(
                "app.services.ai.chat_service"
                ".interpretar_pregunta_analitica",
                side_effect=fake_interpretar,
            )
        )

        self.plan = stack.enter_context(
            patch(
                "app.services.ai.chat_service"
                ".planificar_y_ejecutar_analitica",
                side_effect=fake_planificar,
            )
        )

        self.redact = stack.enter_context(
            patch(
                "app.services.ai.chat_service"
                ".redactar_respuesta_analitica",
                side_effect=fake_redactar,
            )
        )

    def send(self, question, cid=None):

        return procesar_mensaje_chat(
            self.db,
            question,
            conversation_id=cid,
        )

    def test_01_crear_conversacion(self):

        r = self.send(
            "¿Cuántos incidentes existen?"
        )

        self.assertEqual(r["status"], "success")
        self.assertEqual(r["conversation_id"], 1)
        self.assertTrue(r["persisted"])
        self.assertEqual(self.db.commits, 1)

    def test_02_guardar_dos_mensajes(self):

        r = self.send("Total de incidentes")

        self.assertEqual(
            [m["role"] for m in self.db.messages],
            ["user", "assistant"],
        )

        self.assertEqual(
            self.db.messages[0]["content"],
            "Total de incidentes",
        )

        self.assertIn(
            "12 tickets",
            self.db.messages[1]["content"],
        )

    def test_03_guardar_contexto(self):

        r = self.send("Total de incidentes")

        saved = json.loads(
            self.db.conversations[
                r["conversation_id"]
            ]
        )

        self.assertEqual(
            saved,
            r["context_state"],
        )

    def test_04_continuar_conversacion(self):

        first = self.send("Incidentes en marzo")

        second = self.send(
            "¿Y en abril?",
            first["conversation_id"],
        )

        self.assertEqual(
            second["conversation_id"],
            first["conversation_id"],
        )

        self.assertEqual(
            len(self.db.messages),
            4,
        )

        self.assertEqual(
            self.db.commits,
            2,
        )

        self.assertEqual(
            second["context_state"]["filters"][0]["value"]["from"],
            "2026-04-01",
        )

        self.assertEqual(
            len(self.interpret.call_args.kwargs["messages"]),
            2,
        )


    def test_05_aclaracion_sin_consulta(self):

        self.interpret.side_effect = None

        self.interpret.return_value = {
            "status": "clarification",
            "detail": "¿Quieres incidentes o requerimientos?",
        }

        r = self.send("¿Cuántos fueron?")

        self.assertEqual(
            r["status"],
            "needs_clarification",
        )

        self.assertTrue(r["persisted"])
        self.assertFalse(r["executed"])

        self.plan.assert_not_called()
        self.redact.assert_not_called()
        

    def test_06_fuera_del_alcance(self):

        self.interpret.side_effect = None

        self.interpret.return_value = {
            "status": "unsupported",
        }

        r = self.send("Otra solicitud")

        self.assertEqual(
            r["status"],
            "unsupported",
        )

        self.assertTrue(r["persisted"])

        self.plan.assert_not_called()
        self.redact.assert_not_called()

    def test_07_error_openai_no_guarda(self):
        
        self.plan.side_effect = None

        self.interpret.return_value = {
            "status": "llm_error",
        }

        r = self.send("Pregunta")

        self.assertFalse(r["persisted"])
        self.assertEqual(self.db.commits, 0)
        self.assertEqual(len(self.db.messages), 0)

    def test_08_error_analitico_no_guarda(self):
        
        self.plan.side_effect = None

        self.plan.return_value = {
            "status": "backend_error",
            "detail": "Falló SQL Server",
        }

        r = self.send("Pregunta")

        self.assertEqual(
            r["status"],
            "backend_error",
        )

        self.assertFalse(r["persisted"])
        self.assertEqual(len(self.db.messages), 0)

    def test_09_error_redaccion_no_guarda(self):

        self.redact.side_effect = None

        self.redact.return_value = {
            "status": "invalid_evidence",
        }

        r = self.send("Pregunta")

        self.assertEqual(
            r["status"],
            "redaction_error",
        )

        self.assertFalse(r["persisted"])

        self.assertEqual(
            len(self.db.messages),
            0,
        )

    def test_10_error_insert_assistant_rollback(self):

        self.db.fail_assistant = True

        r = self.send("Pregunta")

        self.assertEqual(
            r["status"],
            "persistence_error",
        )

        self.assertEqual(
            len(self.db.conversations),
            0,
        )

        self.assertEqual(
            len(self.db.messages),
            0,
        )

        self.assertGreaterEqual(
            self.db.rollbacks,
            1,
        )

    def test_11_error_commit_rollback(self):

        self.db.fail_commit = True

        r = self.send("Pregunta")

        self.assertEqual(
            r["status"],
            "persistence_error",
        )

        self.assertFalse(r["persisted"])
        self.assertEqual(len(self.db.messages), 0)

    def test_12_conversacion_inexistente(self):

        r = self.send(
            "Pregunta",
            999,
        )

        self.assertEqual(
            r["status"],
            "not_found",
        )

        self.interpret.assert_not_called()

    def test_13_concurrencia_conflictiva(self):

        cid = self.db.seed()

        def concurrent_change(db, interpretacion, **kwargs):

            # Simula un mensaje que otro proceso
            # guardó durante la llamada a OpenAI.
            db.messages.append({
                "id": 500,
                "conversation_id": cid,
                "role": "user",
                "content": "Otro mensaje",
            })

            return fake_planificar(
                db,
                interpretacion,
                **kwargs,
            )

        self.plan.side_effect = concurrent_change

        r = self.send("Pregunta", cid)

        self.assertEqual(
            r["status"],
            "stale_context",
        )

        self.assertFalse(r["persisted"])

    def test_14_metadata_guardada(self):

        self.send("Total")

        msg = self.db.messages[-1]

        metrics = json.loads(
            msg["metrics_json"]
        )

        evidence = json.loads(
            msg["evidence_json"]
        )

        self.assertEqual(
            metrics["total"],
            12,
        )

        self.assertEqual(
            evidence["route"],
            "tool",
        )

        self.assertTrue(
            evidence["validated"]
        )

    def test_15_id_invalido(self):

        r = self.send("Pregunta", -1)

        self.assertEqual(
            r["status"],
            "invalid_request",
        )

        self.assertEqual(self.db.commits, 0)

    def test_16_sin_doble_commit(self):

        self.send("Pregunta")

        self.assertEqual(self.db.commits, 1)

        self.assertEqual(
            self.save.call_count,
            1,
        )


if __name__ == "__main__":
    unittest.main(verbosity=2)
