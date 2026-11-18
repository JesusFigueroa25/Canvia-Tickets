
import json
import unittest

from types import SimpleNamespace
from unittest.mock import patch, ANY

from app.services.ai.context_service import (
    combinar_contexto,
    cargar_contexto,
    guardar_contexto,
)


def iniciar():

    resultado = combinar_contexto(
        {},
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

    return resultado["context_state"]


def buscar(state, field):

    return next(
        (
            f
            for f in state["filters"]
            if f["field"] == field
        ),
        None,
    )


class TestContextService(unittest.TestCase):

    def setUp(self):
        self.state = iniciar()

    def test_01_estado_inicial(self):

        self.assertEqual(
            self.state["source"],
            "incident_consolidated",
        )

        self.assertEqual(
            len(self.state["filters"]),
            3,
        )

    def test_02_abril_conserva_filtros(self):

        r = combinar_contexto(
            self.state,
            {
                "period": {
                    "desde": "2026-04-01",
                    "hasta": "2026-04-30",
                }
            },
        )

        self.assertEqual(r["status"], "success")

        state = r["context_state"]

        self.assertEqual(
            buscar(state, "Proyecto")["value"],
            "UNACEM",
        )

        self.assertEqual(
            buscar(state, "Prioridad")["value"],
            "1-Critical",
        )

        self.assertEqual(
            buscar(
                state,
                "Fecha_Apertura",
            )["value"]["from"],
            "2026-04-01",
        )

        self.assertEqual(
            len(state["filters"]),
            3,
        )

    def test_03_cambiar_proyecto(self):

        r = combinar_contexto(
            self.state,
            {
                "filters": [
                    {
                        "field": "Proyecto",
                        "operator": "eq",
                        "value": "SEDAPAL",
                    }
                ]
            },
        )

        state = r["context_state"]

        self.assertEqual(
            buscar(state, "Proyecto")["value"],
            "SEDAPAL",
        )

        self.assertEqual(
            buscar(state, "Prioridad")["value"],
            "1-Critical",
        )

    def test_04_cambio_entre_consolidados(self):

        r = combinar_contexto(
            self.state,
            {
                "source": "requirement_consolidated"
            },
        )

        self.assertEqual(
            r["status"],
            "success",
        )

        self.assertEqual(
            len(r["context_state"]["filters"]),
            3,
        )

        self.assertEqual(
            r["dropped_filters"],
            [],
        )

    def test_05_cambio_a_sla_descarta_prioridad(self):

        r = combinar_contexto(
            self.state,
            {
                "source": "incident_sla"
            },
        )

        self.assertEqual(
            r["status"],
            "success",
        )

        self.assertEqual(
            r["dropped_filters"],
            ["Prioridad"],
        )

        state = r["context_state"]

        self.assertIsNone(
            buscar(state, "Prioridad"),
        )

        self.assertIsNotNone(
            buscar(state, "Fecha_Creacion"),
        )

        self.assertEqual(
            buscar(state, "Proyecto")["value"],
            "UNACEM",
        )

    def test_06_prioridad_explicita_incompatible(self):

        r = combinar_contexto(
            self.state,
            {
                "source": "incident_sla",
                "filters": [
                    {
                        "field": "Prioridad",
                        "operator": "eq",
                        "value": "1-Critical",
                    }
                ],
            },
        )

        self.assertEqual(
            r["status"],
            "invalid_patch",
        )

    def test_07_prioridad_sla_nueva(self):

        r = combinar_contexto(
            self.state,
            {
                "source": "incident_sla",
                "filters": [
                    {
                        "field": "Prioridad",
                        "operator": "eq",
                        "value": "P1",
                    }
                ],
            },
        )

        self.assertEqual(
            r["status"],
            "success",
        )

        self.assertEqual(
            buscar(
                r["context_state"],
                "Prioridad",
            )["value"],
            "P1",
        )
    def test_08_fecha_resolucion_se_preserva(self):

        a = combinar_contexto(
            self.state,
            {
                "period": {
                    "desde": "2026-03-01",
                    "hasta": "2026-03-31",
                    "date_field": "Fecha_Resolucion",
                }
            },
        )

        self.assertEqual(a["status"], "success")

        # La nueva fecha reemplaza a Fecha_Apertura.
        self.assertIsNone(
            buscar(a["context_state"], "Fecha_Apertura")
        )

        self.assertIsNotNone(
            buscar(a["context_state"], "Fecha_Resolucion")
        )

        b = combinar_contexto(
            a["context_state"],
            {"source": "requirement_sla"},
        )

        self.assertEqual(b["status"], "success")

        state = b["context_state"]

        self.assertIsNotNone(
            buscar(state, "Fecha_Resolucion")
        )

        self.assertIsNone(
            buscar(state, "Fecha_Creacion")
        )

        self.assertIsNotNone(
            buscar(state, "Proyecto")
        )

    def test_09_eliminar_cliente(self):

        r = combinar_contexto(
            self.state,
            {
                "remove_fields": ["Proyecto"]
            },
        )

        self.assertEqual(
            r["status"],
            "success",
        )

        self.assertIsNone(
            buscar(
                r["context_state"],
                "Proyecto",
            ),
        )

    def test_10_limpiar_periodo(self):

        r = combinar_contexto(
            self.state,
            {
                "clear_period": True
            },
        )

        self.assertEqual(
            r["status"],
            "success",
        )

        self.assertIsNone(
            buscar(
                r["context_state"],
                "Fecha_Apertura",
            ),
        )

        self.assertIsNotNone(
            buscar(
                r["context_state"],
                "Prioridad",
            ),
        )

    def test_11_limpiar_todos_los_filtros(self):

        r = combinar_contexto(
            self.state,
            {
                "clear_filters": True
            },
        )

        self.assertEqual(
            r["context_state"]["filters"],
            [],
        )

    def test_12_primera_pregunta_sin_fuente(self):

        r = combinar_contexto(
            {},
            {},
        )

        self.assertEqual(
            r["status"],
            "needs_clarification",
        )

    def test_13_fecha_invalida(self):

        r = combinar_contexto(
            self.state,
            {
                "period": {
                    "desde": "2026-02-30"
                }
            },
        )

        self.assertEqual(
            r["status"],
            "invalid_plan",
        )

    def test_14_estado_corrupto(self):

        r = combinar_contexto(
            "{incorrecto",
            {
                "source": "incident_sla"
            },
        )

        self.assertEqual(
            r["status"],
            "corrupt_context",
        )

    def test_15_propiedad_no_autorizada(self):

        r = combinar_contexto(
            self.state,
            {
                "sql": "DELETE FROM ..."
            },
        )

        self.assertEqual(
            r["status"],
            "invalid_patch",
        )

    def test_16_dos_fechas_ambiguas(self):

        a = combinar_contexto(
            {},
            {
                "source": "incident_consolidated",
                "filters": [
                    {
                        "field": "Fecha_Apertura",
                        "operator": "date_range",
                        "value": {
                            "from": "2026-03-01",
                            "to": "2026-03-31",
                        },
                    },
                    {
                        "field": "Fecha_Resolucion",
                        "operator": "date_range",
                        "value": {
                            "from": "2026-04-01",
                            "to": "2026-04-30",
                        },
                    },
                ],
            },
        )

        self.assertEqual(a["status"], "success")

        # Hay dos campos temporales activos.
        # Un seguimiento sin especificar cuál cambiar
        # necesita aclaración.

        b = combinar_contexto(
            a["context_state"],
            {
                "period": {
                    "desde": "2026-05-01",
                    "hasta": "2026-05-31",
                }
            },
        )

        self.assertEqual(
            b["status"],
            "needs_clarification",
        )

    def test_17_cargar_historial(self):

        messages = [
            SimpleNamespace(
                id=2,
                role="assistant",
                content="Respuesta",
            ),
            SimpleNamespace(
                id=1,
                role="user",
                content="Pregunta",
            ),
        ]

        with (
            patch(
                "app.services.ai.context_service."
                "ai_conversation_repository.get_by_id",
                return_value=SimpleNamespace(
                    context_state=json.dumps(
                        self.state
                    )
                ),
            ) as getter,
            patch(
                "app.services.ai.context_service."
                "ai_message_repository.get_last_messages",
                return_value=messages,
            ) as history_repo,
        ):

            r = cargar_contexto(
                object(),
                8,
                limit=5,
            )

        self.assertEqual(
            r["status"],
            "success",
        )

        self.assertEqual(
            [m["id"] for m in r["messages"]],
            [1, 2],
        )

        getter.assert_called_once()

        self.assertEqual(
            history_repo.call_args.kwargs["limit"],
            5,
        )

    def test_18_guardar_sin_commit(self):

        with patch(
            "app.services.ai.context_service."
            "ai_conversation_repository.update_context",
            return_value=object(),
        ) as update:

            r = guardar_contexto(
                object(),
                8,
                self.state,
            )

        self.assertEqual(
            r["status"],
            "success",
        )

        self.assertFalse(
            r["committed"]
        )

        update.assert_called_once_with(
            ANY,
            8,
            self.state,
        )

    def test_19_guardar_corrupto_rechazado(self):

        with patch(
            "app.services.ai.context_service."
            "ai_conversation_repository.update_context"
        ) as update:

            r = guardar_contexto(
                object(),
                8,
                {
                    "source": "ai_messages",
                    "version": 1,
                },
            )

        self.assertEqual(
            r["status"],
            "invalid_plan",
        )

        update.assert_not_called()
        
    def test_20_cambio_fecha_y_seguimiento(self):

        # Inicialmente: aperturados en marzo.
        a = combinar_contexto(
            self.state,
            {
                "period": {
                    "desde": "2026-04-01",
                    "hasta": "2026-04-30",
                    "date_field": "Fecha_Resolucion",
                }
            },
        )

        self.assertEqual(a["status"], "success")

        # Siguiente pregunta: ¿y en mayo?
        b = combinar_contexto(
            a["context_state"],
            {
                "period": {
                    "desde": "2026-05-01",
                    "hasta": "2026-05-31",
                }
            },
        )

        self.assertEqual(b["status"], "success")

        state = b["context_state"]

        self.assertIsNone(
            buscar(state, "Fecha_Apertura")
        )

        self.assertEqual(
            buscar(state, "Fecha_Resolucion")["value"],
            {
                "from": "2026-05-01",
                "to": "2026-05-31",
            },
        )

        self.assertEqual(
            buscar(state, "Proyecto")["value"],
            "UNACEM",
        )

        self.assertEqual(
            buscar(state, "Prioridad")["value"],
            "1-Critical",
        )

    def test_21_filtro_temporal_directo_reemplaza_anterior(self):

        r = combinar_contexto(
            self.state,
            {
                "filters": [
                    {
                        "field": "Fecha_Resolucion",
                        "operator": "date_range",
                        "value": {
                            "from": "2026-06-01",
                            "to": "2026-06-30",
                        },
                    }
                ]
            },
        )

        self.assertEqual(r["status"], "success")

        state = r["context_state"]

        self.assertIsNone(
            buscar(state, "Fecha_Apertura")
        )

        self.assertIsNotNone(
            buscar(state, "Fecha_Resolucion")
        )

        self.assertEqual(
            state["date_field"],
            "Fecha_Resolucion",
        )


if __name__ == "__main__":
    unittest.main(verbosity=2)
