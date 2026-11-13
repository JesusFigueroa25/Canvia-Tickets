
import unittest

from types import SimpleNamespace
from unittest.mock import Mock, patch

from app.services.ai.chat_service import (
    GuionRespuestaGPT,
    redactar_respuesta_analitica,
)


# ============================================================
# CLIENTE OPENAI SIMULADO
# ============================================================

class FakeResponses:

    def __init__(self, parsed=None, error=None):
        self.parsed = parsed
        self.error = error
        self.last_request = None

    def parse(self, **kwargs):

        self.last_request = kwargs

        if self.error:
            raise self.error

        return SimpleNamespace(
            output_parsed=self.parsed
        )


class FakeClient:

    def __init__(self, parsed=None, error=None):

        self.responses = FakeResponses(
            parsed=parsed,
            error=error,
        )


def guion(ids, encabezado="resultado"):

    return GuionRespuestaGPT(
        encabezado=encabezado,
        orden_hechos=ids,
        detalle="detallado",
    )


# ============================================================
# EJECUCIÓN SIMULADA
# ============================================================

def ejecucion_count(
    route="tool",
    value=10481,
    source="incident_consolidated",
):

    tool = route == "tool"

    return {
        "status": "success",
        "route": route,
        "source": source,
        "tool_id": (
            "ic_consultar_kpis"
            if tool else None
        ),
        "metric_mapping": (
            {"n": "total_tickets"}
            if tool else {"n": "n"}
        ),
        "analytical_plan": {
            "version": 1,
            "source": source,
            "operation": "aggregate",
            "filters": [
                {
                    "field": "Fecha_Apertura",
                    "operator": "date_range",
                    "value": {
                        "from": "2026-03-01",
                        "to": "2026-03-31",
                    },
                }
            ],
            "group_by": [],
            "metrics": [
                {
                    "alias": "n",
                    "function": "count",
                    "field": None,
                    "condition": None,
                }
            ],
            "order_by": [],
            "limit": None,
            "offset": 0,
        },
        "result": {
            "status": "success",
            "source": source,
            "tool_id": (
                "ic_consultar_kpis"
                if tool else None
            ),
            "coverage": "complete",
            "complete": True,
            "metrics": {
                "total_tickets" if tool else "n": value,
                "otra_metrica": 999999,
            },
            "evidence": (
                {"validated": True}
                if tool
                else {
                    "validated": True,
                    "executed": True,
                }
            ),
        },
        "executed": True,
        "persisted": False,
    }


def ejecucion_grupos(route="dynamic_query"):

    obj = ejecucion_count(
        route=route
    )

    obj["analytical_plan"]["operation"] = (
        "grouped_aggregate"
    )

    obj["analytical_plan"]["group_by"] = [
        {
            "field": "Proyecto",
            "bucket": "value",
        }
    ]

    obj["analytical_plan"]["order_by"] = [
        {
            "field": "n",
            "direction": "desc",
        }
    ]

    if route == "tool":

        obj["tool_id"] = "ic_consultar_proyectos"

        obj["metric_mapping"] = {
            "n": "cantidad"
        }

        obj["result"]["tool_id"] = (
            "ic_consultar_proyectos"
        )

        obj["result"]["data"] = [
            {
                "proyecto": "UNACEM",
                "cantidad": 300,
            },
            {
                "proyecto": "SEDAPAL",
                "cantidad": 200,
            },
        ]

    else:

        obj["result"]["rows"] = [
            {
                "Proyecto": "UNACEM",
                "n": 300,
            },
            {
                "Proyecto": "SEDAPAL",
                "n": 200,
            },
        ]

    return obj


# ============================================================
# CASOS DE PRUEBA
# ============================================================

class TestChatRedaccion(unittest.TestCase):

    def test_01_tool_count(self):

        client = FakeClient(
            guion(["F1"])
        )

        result = redactar_respuesta_analitica(
            ejecucion_count(),
            client=client,
        )

        self.assertEqual(
            result["status"],
            "success",
        )

        self.assertIn(
            "10.481",
            result["answer"],
        )

        self.assertEqual(
            result["generation_mode"],
            "openai_structured",
        )

    def test_02_dynamic_count(self):

        result = redactar_respuesta_analitica(
            ejecucion_count(
                route="dynamic_query",
                value=10250,
            ),
            client=FakeClient(guion(["F1"])),
        )

        self.assertEqual(
            result["status"],
            "success",
        )

        self.assertIn("10.250", result["answer"])

    def test_03_filtros_incluidos(self):

        result = redactar_respuesta_analitica(
            ejecucion_count(),
            client=FakeClient(guion(["F1"])),
        )

        self.assertIn(
            "fecha de apertura",
            result["answer"],
        )

        self.assertIn(
            "2026-03-01",
            result["answer"],
        )

    def test_04_no_calculable(self):

        obj = ejecucion_count(
            route="dynamic_query"
        )

        metric = obj[
            "analytical_plan"
        ]["metrics"][0]

        metric["function"] = "sla_compliance"
        metric["field"] = "SLA_Solucion_Condicion"

        obj["source"] = "incident_sla"

        obj["analytical_plan"]["source"] = (
            "incident_sla"
        )

        obj["result"]["source"] = "incident_sla"

        obj["result"]["metrics"] = {
            "n": None
        }

        result = redactar_respuesta_analitica(
            obj,
            client=FakeClient(guion(["F1"])),
        )

        self.assertIn(
            "No calculable",
            result["answer"],
        )

    def test_05_grupos_dinamicos(self):

        obj = ejecucion_grupos()

        result = redactar_respuesta_analitica(
            obj,
            client=FakeClient(
                guion(["F1", "F2"], "ranking")
            ),
        )

        self.assertEqual(
            result["status"],
            "success",
        )

        self.assertIn(
            "UNACEM",
            result["answer"],
        )

        self.assertIn(
            "SEDAPAL",
            result["answer"],
        )

        self.assertIn(
            "300",
            result["answer"],
        )

    def test_06_grupos_tool(self):

        result = redactar_respuesta_analitica(
            ejecucion_grupos(route="tool"),
            client=FakeClient(
                guion(["F1", "F2"], "ranking")
            ),
        )

        self.assertEqual(
            result["status"],
            "success",
        )

        self.assertIn(
            "UNACEM",
            result["answer"],
        )

    def test_07_cobertura_parcial(self):

        obj = ejecucion_grupos()

        obj["result"]["coverage"] = "partial"
        obj["result"]["has_more"] = True

        result = redactar_respuesta_analitica(
            obj,
            client=FakeClient(
                guion(["F1", "F2"])
            ),
        )

        self.assertIn(
            "Cobertura parcial",
            result["answer"],
        )

        self.assertIn(
            "resultados adicionales",
            result["answer"],
        )

    def test_08_evidencia_no_validada(self):

        obj = ejecucion_count()

        obj["result"]["evidence"] = {
            "validated": False
        }

        client = FakeClient(
            guion(["F1"])
        )

        result = redactar_respuesta_analitica(
            obj,
            client=client,
        )

        self.assertEqual(
            result["status"],
            "invalid_evidence",
        )

        self.assertIsNone(
            client.responses.last_request
        )

    def test_09_error_backend(self):

        obj = ejecucion_count()
        obj["status"] = "backend_error"

        result = redactar_respuesta_analitica(
            obj,
            client=FakeClient(),
        )

        self.assertEqual(
            result["status"],
            "invalid_evidence",
        )

    def test_10_tool_inconsistente(self):

        obj = ejecucion_count()

        obj["tool_id"] = "otra_tool"

        result = redactar_respuesta_analitica(
            obj,
            client=FakeClient(),
        )

        self.assertEqual(
            result["status"],
            "invalid_evidence",
        )

    def test_11_gpt_inventa_fact_id(self):

        result = redactar_respuesta_analitica(
            ejecucion_count(),
            client=FakeClient(
                guion(["F999"])
            ),
        )

        self.assertEqual(
            result["status"],
            "success",
        )

        self.assertEqual(
            result["generation_mode"],
            "deterministic_fallback",
        )

        self.assertIn(
            "10.481",
            result["answer"],
        )

    def test_12_fallo_openai(self):

        result = redactar_respuesta_analitica(
            ejecucion_count(),
            client=FakeClient(
                error=RuntimeError("Sin conexión")
            ),
        )

        self.assertEqual(
            result["status"],
            "success",
        )

        self.assertEqual(
            result["generation_mode"],
            "deterministic_fallback",
        )

    def test_13_sin_clave_api(self):

        with patch.dict(
            "os.environ",
            {"OPENAI_API_KEY": ""},
        ):

            result = redactar_respuesta_analitica(
                ejecucion_count()
            )

        self.assertEqual(
            result["status"],
            "success",
        )

        self.assertEqual(
            result["generation_mode"],
            "deterministic_fallback",
        )

    def test_14_sin_registros(self):

        obj = ejecucion_grupos()

        obj["status"] = "empty"

        obj["result"]["status"] = "empty"
        obj["result"]["rows"] = []

        client = FakeClient()

        result = redactar_respuesta_analitica(
            obj,
            client=client,
        )

        self.assertEqual(
            result["status"],
            "success",
        )

        self.assertIn(
            "No se encontraron",
            result["answer"],
        )

        self.assertIsNone(
            client.responses.last_request
        )

    def test_15_no_inventa_metricas(self):

        result = redactar_respuesta_analitica(
            ejecucion_count(),
            client=FakeClient(
                guion(["F1"])
            ),
        )

        self.assertNotIn(
            "999.999",
            result["answer"],
        )

        self.assertIn(
            "10.481",
            result["answer"],
        )

    def test_16_grupo_incompleto(self):

        obj = ejecucion_grupos()

        obj["result"]["rows"][0].pop(
            "Proyecto"
        )

        result = redactar_respuesta_analitica(
            obj,
            client=FakeClient(),
        )

        self.assertEqual(
            result["status"],
            "invalid_evidence",
        )

    def test_17_no_persistencia(self):

        result = redactar_respuesta_analitica(
            ejecucion_count(),
            client=FakeClient(
                guion(["F1"])
            ),
        )

        self.assertFalse(
            result["persisted"]
        )

        self.assertFalse(
            result["executed"]
        )

    def test_18_filtros_visibles_en_respuesta_breve(self):

        client = FakeClient(
            GuionRespuestaGPT(
                encabezado="resultado",
                orden_hechos=["F1"],
                detalle="breve",
            )
        )

        result = redactar_respuesta_analitica(
            ejecucion_count(),
            client=client,
        )

        self.assertEqual(
            result["status"],
            "success",
        )

        self.assertIn(
            "10.481",
            result["answer"],
        )

        self.assertIn(
            "Filtros aplicados:",
            result["answer"],
        )

        self.assertIn(
            "2026-03-01",
            result["answer"],
        )

        self.assertIn(
            "2026-03-31",
            result["answer"],
        )


if __name__ == "__main__":
    unittest.main(verbosity=2)
