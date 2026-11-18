
import unittest
from copy import deepcopy

from app.services.ai.chat_service import (
    normalizar_patch_temporal_gpt,
)


class TestChatPatchTemporal(unittest.TestCase):

    def setUp(self):

        self.contexto = {
            "version": 1,
            "source": "incident_sla",
            "date_field": "Fecha_Creacion",
            "filters": [],
        }

        self.patch = {
            "source": "incident_sla",
            "period": {
                "desde": "2026-03-01",
                "hasta": "2026-03-31",
                "date_field": "Fecha_Creacion",
            },
            "filters": [{
                "field": "Fecha_Creacion",
                "operator": "date_range",
                "value": {
                    "from": "2026-03-01",
                    "to": "2026-03-31",
                },
            }],
        }

    def test_01_elimina_duplicado_exacto(self):

        result = normalizar_patch_temporal_gpt(
            self.patch,
            self.contexto,
        )

        self.assertEqual(
            result["filters"],
            [],
        )

    def test_02_conserva_prioridad(self):

        patch = deepcopy(self.patch)

        patch["filters"].append({
            "field": "Prioridad",
            "operator": "eq",
            "value": "P3",
        })

        result = normalizar_patch_temporal_gpt(
            patch,
            self.contexto,
        )

        self.assertEqual(
            len(result["filters"]),
            1,
        )

        self.assertEqual(
            result["filters"][0]["field"],
            "Prioridad",
        )

    def test_03_no_oculta_conflicto(self):

        patch = deepcopy(self.patch)

        patch["filters"][0]["value"]["from"] = (
            "2026-04-01"
        )

        result = normalizar_patch_temporal_gpt(
            patch,
            self.contexto,
        )

        self.assertEqual(
            len(result["filters"]),
            1,
        )

    def test_04_cambio_de_fuente(self):

        patch = {
            "source": "incident_consolidated",
            "period": {
                "desde": "2026-03-01",
                "hasta": "2026-03-31",
                "date_field": None,
            },
            "filters": [{
                "field": "Fecha_Apertura",
                "operator": "date_range",
                "value": {
                    "from": "2026-03-01",
                    "to": "2026-03-31",
                },
            }],
        }

        result = normalizar_patch_temporal_gpt(
            patch,
            self.contexto,
        )

        self.assertEqual(
            result["filters"],
            [],
        )

    def test_05_no_modifica_original(self):

        original = deepcopy(self.patch)

        normalizar_patch_temporal_gpt(
            self.patch,
            self.contexto,
        )

        self.assertEqual(
            self.patch,
            original,
        )

    def test_06_sin_periodo_no_modifica(self):

        patch = {
            "source": "incident_sla",
            "period": None,
            "filters": [{
                "field": "Prioridad",
                "operator": "eq",
                "value": "P3",
            }],
        }

        result = normalizar_patch_temporal_gpt(
            patch,
            self.contexto,
        )

        self.assertEqual(
            result,
            patch,
        )


if __name__ == "__main__":
    unittest.main(verbosity=2)
