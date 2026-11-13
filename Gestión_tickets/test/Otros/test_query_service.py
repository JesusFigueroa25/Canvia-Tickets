import unittest
from copy import deepcopy

from app.services.ai.query_service import (
    validar_plan_analitico,
    listar_capacidades_dinamicas,
)


BASE = {
    "source": "incident_consolidated",
    "operation": "aggregate",
    "metrics": [
        {
            "alias": "total_tickets",
            "function": "count",
        }
    ],
}


class TestQueryService(unittest.TestCase):

    def check(self, changes, expected, base=BASE):
        p = deepcopy(base)
        p.update(changes)

        resultado = validar_plan_analitico(p)

        self.assertEqual(
            expected,
            resultado["status"],
            resultado,
        )

        return resultado

    # 1
    def test_count_all_history(self):
        r = self.check({}, "valid")
        self.assertEqual([], r["normalized_plan"]["filters"])
        self.assertFalse(r["evidence"]["executed"])

    # 2
    def test_resolved_in_march(self):
        r = self.check({
            "filters": [{
                "field": "Fecha_Resolucion",
                "operator": "date_range",
                "value": {
                    "from": "2026-03-01",
                    "to": "2026-03-31",
                },
            }]
        }, "valid")

        self.assertEqual(
            "Fecha_Resolucion",
            r["normalized_plan"]["filters"][0]["field"],
        )

    # 3
    def test_grouped_count(self):
        self.check({
            "operation": "grouped_aggregate",
            "group_by": [{"field": "BU"}],
            "order_by": [
                {"field": "n", "direction": "desc"}
            ],
            "metrics": [
                {"alias": "n", "function": "count"}
            ],
        }, "valid")

    # 4
    def test_month_group(self):
        self.check({
            "operation": "grouped_aggregate",
            "group_by": [{
                "field": "Fecha_Resolucion",
                "bucket": "month",
            }],
        }, "valid")

    # 5
    def test_wrong_table(self):
        self.check(
            {"source": "ai_messages"},
            "invalid_plan",
        )

    # 6
    def test_wrong_operation(self):
        self.check(
            {"operation": "delete"},
            "invalid_plan",
        )

    # 7
    def test_extra_field(self):
        self.check(
            {"sql": "DROP TABLE dbo.incident_sla"},
            "invalid_plan",
        )

    # 8
    def test_unauthorized_column(self):
        self.check({
            "filters": [{
                "field": "Solucion",
                "operator": "eq",
                "value": "abc",
            }]
        }, "unsupported_operation")

    # 9
    def test_no_cross_source_column(self):
        self.check({
            "source": "incident_sla",
            "filters": [{
                "field": "BU",
                "operator": "eq",
                "value": "X",
            }],
        }, "unsupported_operation")

    # 10
    def test_bad_day(self):
        self.check({
            "filters": [{
                "field": "Fecha_Resolucion",
                "operator": "eq",
                "value": "2026-02-30",
            }]
        }, "invalid_plan")

    # 11
    def test_reverse_date_range(self):
        self.check({
            "filters": [{
                "field": "Fecha_Resolucion",
                "operator": "date_range",
                "value": {
                    "from": "2026-04-01",
                    "to": "2026-03-31",
                },
            }]
        }, "invalid_plan")

    # 12
    def test_overlapping_dates(self):
        self.check({
            "filters": [
                {
                    "field": "Fecha_Resolucion",
                    "operator": "gte",
                    "value": "2026-05-01",
                },
                {
                    "field": "Fecha_Resolucion",
                    "operator": "lt",
                    "value": "2026-04-01",
                },
            ]
        }, "invalid_plan")

    # 13
    def test_limit(self):
        self.check({
            "operation": "grouped_aggregate",
            "group_by": [{"field": "Proyecto"}],
            "limit": 201,
        }, "limit_exceeded")

    # 14
    def test_no_group_aggregate(self):
        self.check({
            "group_by": [{"field": "Proyecto"}],
        }, "invalid_plan")

    # 15
    def test_no_group_grouped(self):
        self.check({
            "operation": "grouped_aggregate",
        }, "invalid_plan")

    # 16
    def test_invalid_order(self):
        self.check({
            "operation": "grouped_aggregate",
            "group_by": [{"field": "Proyecto"}],
            "order_by": [{"field": "Estado"}],
        }, "invalid_plan")

    # 17
    def test_unknown_grouping(self):
        self.check({
            "operation": "grouped_aggregate",
            "group_by": [{"field": "Descripcion"}],
        }, "unsupported_operation")

    # 18
    def test_sla_other_source(self):
        self.check({
            "metrics": [{
                "alias": "compliance",
                "function": "sla_compliance",
                "field": "SLA_Solucion_Condicion",
            }]
        }, "unsupported_operation")

    # 19
    def test_sla_valid(self):
        self.check({
            "source": "requirement_sla",
            "metrics": [{
                "alias": "sla_solucion",
                "function": "sla_compliance",
                "field": "SLA_Solucion_Condicion",
            }],
        }, "valid")

    # 20
    def test_sla_tautology_rejected(self):
        self.check({
            "source": "requirement_sla",
            "filters": [{
                "field": "SLA_Solucion_Condicion",
                "operator": "eq",
                "value": "Cumplido",
            }],
            "metrics": [{
                "alias": "sla_solucion",
                "function": "sla_compliance",
                "field": "SLA_Solucion_Condicion",
            }],
        }, "invalid_plan")

    # 21
    def test_percent_of_total_valid(self):
        self.check({
            "source": "requirement_sla",
            "metrics": [{
                "alias": "cumplidos_pct",
                "function": "percent_of_total",
                "condition": {
                    "field": "SLA_Solucion_Condicion",
                    "operator": "eq",
                    "value": "Cumplido",
                },
            }],
        }, "valid")

    # 22
    def test_percent_of_total_tautology_rejected(self):
        self.check({
            "source": "requirement_sla",
            "filters": [{
                "field": "SLA_Solucion_Condicion",
                "operator": "eq",
                "value": "Cumplido",
            }],
            "metrics": [{
                "alias": "cumplidos_pct",
                "function": "percent_of_total",
                "condition": {
                    "field": "SLA_Solucion_Condicion",
                    "operator": "eq",
                    "value": "Cumplido",
                },
            }],
        }, "invalid_plan")

    # 23
    def test_countif(self):
        self.check({
            "metrics": [{
                "alias": "resueltos",
                "function": "count_if",
                "condition": {
                    "field": "Estado",
                    "operator": "eq",
                    "value": "Resolved",
                },
            }],
        }, "valid")

    # 24
    def test_contains_short(self):
        self.check({
            "filters": [{
                "field": "Descripcion",
                "operator": "contains",
                "value": "ab",
            }]
        }, "invalid_plan")

    # 25
    def test_contains_ok(self):
        self.check({
            "filters": [{
                "field": "Descripcion",
                "operator": "contains",
                "value": "CPU",
            }]
        }, "valid")

    # 26
    def test_sql_injection_as_literal(self):
        r = self.check({
            "filters": [{
                "field": "Proyecto",
                "operator": "eq",
                "value": "X'; DROP TABLE t; --",
            }]
        }, "valid")

        self.assertEqual(
            "X'; DROP TABLE t; --",
            r["normalized_plan"]["filters"][0]["value"],
        )

    # 27
    def test_ticket_not_groupable(self):
        self.check({
            "operation": "grouped_aggregate",
            "group_by": [{"field": "Ticket_ID"}],
        }, "unsupported_operation")

    # 28
    def test_dupe_metric_aliases(self):
        self.check({
            "metrics": [
                {"alias": "n", "function": "count"},
                {"alias": "n", "function": "count"},
            ],
        }, "invalid_plan")

    # 29
    def test_list_overflow(self):
        self.check({
            "filters": [{
                "field": "Proyecto",
                "operator": "in",
                "value": [str(i) for i in range(51)],
            }],
        }, "limit_exceeded")

    # 30
    def test_unknown_keys_filter(self):
        self.check({
            "filters": [{
                "field": "Proyecto",
                "operator": "eq",
                "value": "ABC",
                "raw_sql": "SELECT *",
            }],
        }, "invalid_plan")

    # 31
    def test_catalog(self):
        r = listar_capacidades_dinamicas()

        self.assertEqual(
            4,
            len(r["sources"]),
        )

        self.assertNotIn(
            "Detalle",
            r["sources"]["requirement_sla"]["columns"],
        )


if __name__ == "__main__":
    unittest.main(verbosity=2)