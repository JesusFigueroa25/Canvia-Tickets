
import unittest

from types import SimpleNamespace
from unittest.mock import patch

from app.services.ai.chat_service import (
    FiltroPropuesto,
    InterpretacionGPT,
    interpretar_pregunta_analitica,
)

from app.services.ai.context_service import (
    combinar_contexto,
)


class FakeResponses:

    def __init__(self, parsed):
        self.parsed = parsed
        self.last_request = None

    def parse(self, **kwargs):
        self.last_request = kwargs

        return SimpleNamespace(
            output_parsed=self.parsed
        )


class FakeOpenAI:

    def __init__(self, parsed):
        self.responses = FakeResponses(parsed)


def respuesta_gpt(**changes):

    data = {
        "intent": "analytics",
        "source": "incident_consolidated",
        "filters": [],
        "period": None,
        "remove_fields": [],
        "clear_filters": False,
        "clear_period": False,
        "reset_context": False,
        "group_by": [],
        "max_results": None,
        "analytical_goal": "Contar incidentes",
        "clarification": None,
    }

    data.update(changes)

    return InterpretacionGPT.model_validate(
        data
    )


def filtro_gpt(field, operator, value):

    return FiltroPropuesto(
        field=field,
        operator=operator,
        value_text=value,
        value_list=None,
        value_from=None,
        value_to=None,
    )


class TestChatService(unittest.TestCase):

    def test_01_interpretacion_valida(self):

        fake = FakeOpenAI(
            respuesta_gpt()
        )

        result = interpretar_pregunta_analitica(
            "¿Cuántos incidentes existen?",
            client=fake,
        )

        self.assertEqual(
            result["status"],
            "interpreted",
        )

        self.assertEqual(
            result["context_candidate"]["source"],
            "incident_consolidated",
        )

        self.assertFalse(result["executed"])
        self.assertFalse(result["persisted"])

    def test_02_no_ejecuta_sql(self):

        fake = FakeOpenAI(
            respuesta_gpt()
        )

        result = interpretar_pregunta_analitica(
            "Total de incidentes",
            client=fake,
        )

        self.assertFalse(
            result["executed"]
        )

        self.assertFalse(
            result["persisted"]
        )

        self.assertFalse(
            fake.responses.last_request["store"]
        )

    def test_03_filtro_proyecto_valido(self):

        fake = FakeOpenAI(
            respuesta_gpt(
                filters=[
                    filtro_gpt(
                        "Proyecto",
                        "eq",
                        "105932 UNACEM PROY CL SERV INFRAESTR",
                    )
                ]
            )
        )

        result = interpretar_pregunta_analitica(
            "Incidentes del proyecto indicado",
            client=fake,
        )

        self.assertEqual(
            result["status"],
            "interpreted",
        )

        self.assertEqual(
            result["context_candidate"]["filters"][0]["field"],
            "Proyecto",
        )

    def test_04_fecha_de_seguimiento(self):

        previo = combinar_contexto(
            {},
            {
                "source": "incident_consolidated",
                "period": {
                    "desde": "2026-03-01",
                    "hasta": "2026-03-31",
                },
            },
        )["context_state"]

        fake = FakeOpenAI(
            respuesta_gpt(
                source=None,
                period={
                    "desde": "2026-04-01",
                    "hasta": "2026-04-30",
                    "date_field": None,
                },
            )
        )

        result = interpretar_pregunta_analitica(
            "¿Y en abril?",
            context_state=previo,
            client=fake,
        )

        self.assertEqual(
            result["status"],
            "interpreted",
        )

        filters = result[
            "context_candidate"
        ]["filters"]

        self.assertEqual(
            filters[0]["value"]["from"],
            "2026-04-01",
        )

    def test_05_rechaza_columna_invalida(self):

        fake = FakeOpenAI(
            respuesta_gpt(
                filters=[
                    filtro_gpt(
                        "Tabla_Secreta",
                        "eq",
                        "ABC",
                    )
                ]
            )
        )

        result = interpretar_pregunta_analitica(
            "Pregunta de prueba",
            client=fake,
        )

        self.assertEqual(
            result["status"],
            "unsupported_operation",
        )

        self.assertFalse(
            result["executed"]
        )

    def test_06_rechaza_agrupacion_invalida(self):

        fake = FakeOpenAI(
            respuesta_gpt(
                group_by=["Detalle"]
            )
        )

        result = interpretar_pregunta_analitica(
            "Agrupar por detalle",
            client=fake,
        )

        self.assertEqual(
            result["status"],
            "invalid_llm_output",
        )

    def test_07_necesita_aclaracion(self):

        fake = FakeOpenAI(
            respuesta_gpt(
                intent="clarification",
                source=None,
                clarification=(
                    "¿Quieres consultar incidentes "
                    "o requerimientos?"
                ),
            )
        )

        result = interpretar_pregunta_analitica(
            "¿Cuántos fueron?",
            client=fake,
        )

        self.assertEqual(
            result["status"],
            "clarification",
        )

    def test_08_pregunta_vacia(self):

        result = interpretar_pregunta_analitica(
            "   ",
            client=FakeOpenAI(
                respuesta_gpt()
            ),
        )

        self.assertEqual(
            result["status"],
            "invalid_request",
        )

    def test_09_sin_clave_api(self):

        with patch.dict(
            "os.environ",
            {"OPENAI_API_KEY": ""},
        ):

            result = interpretar_pregunta_analitica(
                "Total de incidentes"
            )

        self.assertEqual(
            result["status"],
            "configuration_error",
        )

    def test_10_respuesta_llm_incompleta(self):

        fake = FakeOpenAI(None)

        result = interpretar_pregunta_analitica(
            "Total de incidentes",
            client=fake,
        )

        self.assertEqual(
            result["status"],
            "llm_no_structure",
        )


if __name__ == "__main__":
    unittest.main(verbosity=2)
