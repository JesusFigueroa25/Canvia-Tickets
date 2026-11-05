
import unittest

from copy import deepcopy
from types import SimpleNamespace
from unittest.mock import Mock

from app.services.ai.chat_service import (
    PlanAnaliticoGPT,
    ejecutar_plan_enrutado,
    planificar_y_ejecutar_analitica,
)


# ============================================================
# SIMULACIÓN DE GPT
# ============================================================

class FakeResponses:

    def __init__(self, plan):
        self.plan = plan

    def parse(self, **kwargs):
        return SimpleNamespace(
            output_parsed=self.plan
        )


class FakeClient:

    def __init__(self, plan):
        self.responses = FakeResponses(plan)


def plan_gpt(
    metrics=None,
    groups=None,
    orders=None,
    limit=None,
):

    return PlanAnaliticoGPT.model_validate({
        "decision": "ready",
        "clarification": None,
        "operation": (
            "grouped_aggregate"
            if groups
            else "aggregate"
        ),
        "group_by": groups or [],
        "metrics": metrics or [
            {
                "alias": "total",
                "function": "count",
                "field": None,
                "condition": None,
            }
        ],
        "order_by": orders or [],
        "limit": limit,
        "offset": 0,
    })


def interpretacion(
    source="incident_consolidated",
    filters=None,
    groups=None,
    limit=None,
):

    return {
        "status": "interpreted",
        "intent": "analytics",
        "model": "modelo-de-prueba",
        "analytical_goal": "Consultar los tickets solicitados",
        "group_by": groups or [],
        "max_results": limit,
        "context_candidate": {
            "version": 1,
            "source": source,
            "date_field": (
                "Fecha_Apertura"
                if source.endswith("_consolidated")
                else "Fecha_Creacion"
            ),
            "filters": filters or [],
        },
        "warnings": [],
    }


def filtro_fecha(field):
    return {
        "field": field,
        "operator": "date_range",
        "value": {
            "from": "2026-03-01",
            "to": "2026-03-31",
        },
    }


def respuesta_tool():

    return {
        "status": "success",
        "coverage": "complete",
        "complete": True,
        "metrics": {"total_tickets": 42},
        "data": {"total_tickets": 42},
    }


def respuesta_dinamica():

    return {
        "status": "success",
        "coverage": "complete",
        "metrics": {"total": 42},
        "data": [],
        "evidence": {
            "validated": True,
            "executed": True,
        },
    }


# ============================================================
# TESTS
# ============================================================

class TestChatRouter(unittest.TestCase):

    def setUp(self):

        self.tool = Mock(
            return_value=respuesta_tool()
        )

        self.dynamic = Mock(
            return_value=respuesta_dinamica()
        )

    def execute(self, previous, planned):

        return planificar_y_ejecutar_analitica(
            db=object(),
            interpretacion=previous,
            client=FakeClient(planned),
            tool_executor=self.tool,
            dynamic_executor=self.dynamic,
        )

    # --------------------------------------------------------
    # 1. COUNT con Tool existente
    # --------------------------------------------------------

    def test_01_count_usa_tool(self):

        result = self.execute(
            interpretacion(),
            plan_gpt(),
        )

        self.assertEqual(result["status"], "success")
        self.assertEqual(result["route"], "tool")

        self.assertEqual(
            result["tool_id"],
            "ic_consultar_kpis",
        )

        self.assertTrue(self.tool.called)
        self.assertFalse(self.dynamic.called)

    # --------------------------------------------------------
    # 2. Fecha de resolución exige SQLAlchemy
    # --------------------------------------------------------

    def test_02_resolucion_usa_dinamico(self):

        result = self.execute(
            interpretacion(
                filters=[
                    filtro_fecha("Fecha_Resolucion")
                ]
            ),
            plan_gpt(),
        )

        self.assertEqual(
            result["route"],
            "dynamic_query",
        )

        self.assertFalse(self.tool.called)
        self.assertTrue(self.dynamic.called)

    # --------------------------------------------------------
    # 3. COUNT DISTINCT exige SQLAlchemy
    # --------------------------------------------------------

    def test_03_distinct_usa_dinamico(self):

        result = self.execute(
            interpretacion(),
            plan_gpt(metrics=[
                {
                    "alias": "proyectos",
                    "function": "count_distinct",
                    "field": "Proyecto",
                    "condition": None,
                }
            ]),
        )

        self.assertEqual(
            result["route"],
            "dynamic_query",
        )

    # --------------------------------------------------------
    # 4. COUNT IF exige SQLAlchemy
    # --------------------------------------------------------

    def test_04_count_if_usa_dinamico(self):

        result = self.execute(
            interpretacion(),
            plan_gpt(metrics=[
                {
                    "alias": "resueltos",
                    "function": "count_if",
                    "field": None,
                    "condition": {
                        "field": "Estado",
                        "operator": "eq",
                        "value_text": "Resolved",
                        "value_list": None,
                        "value_from": None,
                        "value_to": None,
                    },
                }
            ]),
        )

        self.assertEqual(
            result["route"],
            "dynamic_query",
        )

    # --------------------------------------------------------
    # 5. Top 5 proyectos puede usar Tool
    # --------------------------------------------------------

    def test_05_top_proyectos_usa_tool(self):

        result = self.execute(
            interpretacion(
                groups=["Proyecto"],
                limit=5,
            ),
            plan_gpt(
                metrics=[
                    {
                        "alias": "n",
                        "function": "count",
                        "field": None,
                        "condition": None,
                    }
                ],
                groups=[
                    {
                        "field": "Proyecto",
                        "bucket": "value",
                    }
                ],
                orders=[
                    {
                        "field": "n",
                        "direction": "desc",
                    }
                ],
                limit=5,
            ),
        )

        self.assertEqual(
            result["route"],
            "tool",
        )

        self.assertEqual(
            result["tool_id"],
            "ic_consultar_proyectos",
        )

        request = self.tool.call_args.kwargs[
            "solicitud"
        ]

        self.assertEqual(
            request["options"]["limit"],
            5,
        )

    # --------------------------------------------------------
    # 6. Agrupación mensual exige SQLAlchemy
    # --------------------------------------------------------

    def test_06_mes_usa_dinamico(self):

        result = self.execute(
            interpretacion(
                groups=["Fecha_Apertura"],
            ),
            plan_gpt(
                groups=[
                    {
                        "field": "Fecha_Apertura",
                        "bucket": "month",
                    }
                ],
                orders=[
                    {
                        "field": "Fecha_Apertura",
                        "direction": "asc",
                    }
                ],
            ),
        )

        self.assertEqual(
            result["route"],
            "dynamic_query",
        )

    # --------------------------------------------------------
    # 7. SLA global puede utilizar KPI
    # --------------------------------------------------------

    def test_07_sla_global_usa_tool(self):

        result = self.execute(
            interpretacion(
                source="requirement_sla"
            ),
            plan_gpt(metrics=[
                {
                    "alias": "cumplimiento",
                    "function": "sla_compliance",
                    "field": "SLA_Solucion_Condicion",
                    "condition": None,
                }
            ]),
        )

        self.assertEqual(
            result["route"],
            "tool",
        )

        self.assertEqual(
            result["tool_id"],
            "rs_consultar_kpis",
        )

        self.assertEqual(
            result["metric_mapping"]["cumplimiento"],
            "sla_solucion",
        )

    # --------------------------------------------------------
    # 8. Unsupported Tool permite fallback
    # --------------------------------------------------------

    def test_08_tool_no_soportada_fallback(self):

        self.tool.return_value = {
            "status": "unsupported_by_tool",
            "detail": "Filtro no cubierto",
        }

        result = self.execute(
            interpretacion(),
            plan_gpt(),
        )

        self.assertEqual(
            result["route"],
            "dynamic_query",
        )

        self.assertTrue(self.dynamic.called)

    # --------------------------------------------------------
    # 9. Backend error no permite fallback silencioso
    # --------------------------------------------------------

    def test_09_backend_error_no_fallback(self):

        self.tool.return_value = {
            "status": "backend_error",
            "detail": "Error de base de datos",
        }

        result = self.execute(
            interpretacion(),
            plan_gpt(),
        )

        self.assertEqual(
            result["status"],
            "backend_error",
        )

        self.assertFalse(self.dynamic.called)

    # --------------------------------------------------------
    # 10. Columna no autorizada
    # --------------------------------------------------------

    def test_10_columna_invalida_no_ejecuta(self):

        result = self.execute(
            interpretacion(),
            plan_gpt(metrics=[
                {
                    "alias": "x",
                    "function": "count_distinct",
                    "field": "Tabla_Secreta",
                    "condition": None,
                }
            ]),
        )

        self.assertEqual(
            result["status"],
            "unsupported_operation",
        )

        self.assertFalse(self.tool.called)
        self.assertFalse(self.dynamic.called)

    # --------------------------------------------------------
    # 11. No permitir cambios de agrupación
    # --------------------------------------------------------

    def test_11_grupo_distinto_rechazado(self):

        result = self.execute(
            interpretacion(
                groups=["Proyecto"]
            ),
            plan_gpt(
                groups=[
                    {
                        "field": "Prioridad",
                        "bucket": "value",
                    }
                ]
            ),
        )

        self.assertEqual(
            result["status"],
            "invalid_llm_plan",
        )

        self.assertFalse(self.tool.called)
        self.assertFalse(self.dynamic.called)

    # --------------------------------------------------------
    # 12. Respuesta vacía del planificador
    # --------------------------------------------------------

    def test_12_llm_sin_plan(self):

        result = self.execute(
            interpretacion(),
            None,
        )

        self.assertEqual(
            result["status"],
            "llm_no_structure",
        )

        self.assertFalse(self.tool.called)
        self.assertFalse(self.dynamic.called)

    # --------------------------------------------------------
    # 13. Plan directo inválido
    # --------------------------------------------------------

    def test_13_plan_directo_invalido(self):

        result = ejecutar_plan_enrutado(
            object(),
            {
                "source": "ai_messages",
                "operation": "aggregate",
                "metrics": [
                    {
                        "alias": "n",
                        "function": "count",
                    }
                ],
            },
            tool_executor=self.tool,
            dynamic_executor=self.dynamic,
        )

        self.assertEqual(
            result["status"],
            "invalid_plan",
        )

        self.assertFalse(self.tool.called)
        self.assertFalse(self.dynamic.called)

    # --------------------------------------------------------
    # 14. El contexto no se guarda aquí
    # --------------------------------------------------------

    def test_14_no_persistencia(self):

        previous = interpretacion()
        original = deepcopy(
            previous["context_candidate"]
        )

        result = self.execute(
            previous,
            plan_gpt(),
        )

        self.assertFalse(
            result["persisted"]
        )

        self.assertEqual(
            result["context_candidate"],
            original,
        )

    # --------------------------------------------------------
    # 15. Error de cobertura permite motor dinámico
    # --------------------------------------------------------

    def test_15_cobertura_insuficiente(self):

        self.tool.return_value = {
            "status": "success",
            "coverage": "partial",
            "complete": False,
            "metrics": {},
            "data": [],
        }

        result = self.execute(
            interpretacion(),
            plan_gpt(),
        )

        self.assertEqual(
            result["route"],
            "dynamic_query",
        )

        self.assertTrue(self.dynamic.called)


if __name__ == "__main__":
    unittest.main(verbosity=2)
