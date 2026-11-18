import unittest
from datetime import date
from unittest.mock import patch

try:
    from app.services.ai import tool_service as tools
except ModuleNotFoundError:
    import tool_service as tools


class TestToolService(unittest.TestCase):
    def test_registry_counts(self):
        self.assertEqual(len(tools.TOOL_REGISTRY), 40)
        self.assertEqual(len(tools.listar_tools()), 34)
        self.assertEqual(len(tools.listar_tools(include_auxiliary=True)), 40)

    def test_wrong_source(self):
        x = tools.ejecutar_tool_analitica(None, {
            'source':'requirement_sla', 'tool_id':'ic_consultar_kpis'})
        self.assertEqual(x['status'], 'invalid_request')

    def test_dynamic_fallback_unsupported_filter(self):
        x = tools.ejecutar_tool_analitica(None, {
            'source':'requirement_consolidated', 'tool_id':'rc_consultar_kpis',
            'filters':{'estado':'Resolved'}})
        self.assertEqual(x['status'], 'unsupported_by_tool')

    def test_ignored_type_filter(self):
        x = tools.ejecutar_tool_analitica(None, {
            'source':'incident_sla', 'tool_id':'is_consultar_pareto_tipos',
            'filters':{'tipo_incidente':['Problema de red']}})
        self.assertEqual(x['status'], 'unsupported_by_tool')

    def test_bad_date(self):
        x = tools.ejecutar_tool_analitica(None, {
            'source':'incident_consolidated', 'tool_id':'ic_consultar_kpis',
            'filters':{'desde':'2026-02-30'}})
        self.assertEqual(x['status'], 'invalid_request')

    def test_historical_default_does_not_send_date(self):
        captured = {}
        def fake_service(db, **kwargs):
            captured.update(kwargs)
            return {'total_tickets':3, 'total_proyectos':1,
                    'alta_criticidad':1, 'porcentaje_alta_criticidad':33.33}
        with patch.object(tools, '_get_service', return_value=fake_service):
            x = tools.ejecutar_tool_analitica(None, {
                'source':'incident_consolidated', 'tool_id':'ic_consultar_kpis',
                'filters':{'proyecto':'ABC'}})
        self.assertEqual(x['status'],'success')
        self.assertNotIn('desde', captured)
        self.assertNotIn('hasta', captured)
        self.assertEqual(x['metrics']['total_tickets'],3)

    def test_top_proyectos_sort_and_limit(self):
        def fake_service(db, **kwargs):
            self.assertIsInstance(kwargs['desde'], date)
            return [{'proyecto':'A','cantidad':4}, {'proyecto':'B','cantidad':9},
                    {'proyecto':'C','cantidad':6}]
        with patch.object(tools,'_get_service',return_value=fake_service):
            x = tools.ejecutar_tool_analitica(None, {
                'source':'incident_consolidated', 'tool_id':'ic_consultar_proyectos',
                'filters':{'desde':'2026-01-01','hasta':'2026-01-31'},
                'options':{'metric':'cantidad','order':'desc','limit':2}})
        self.assertEqual([a['proyecto'] for a in x['data']], ['B','C'])
        self.assertEqual(x['coverage'], 'complete')

    def test_no_automatic_four_month_window(self):
        x = tools.ejecutar_tool_analitica(None, {
            'source':'requirement_consolidated','tool_id':'rc_consultar_top_proyectos',
            'options':{'limit':5,'metric':'total_tickets'}})
        self.assertEqual(x['status'], 'unsupported_by_tool')

    def test_invalid_ranking_from_limited_subset(self):
        x = tools.ejecutar_tool_analitica(None, {
            'source':'requirement_sla','tool_id':'rs_consultar_top_categorias',
            'options':{'limit':3,'metric':'incumplidos'}})
        self.assertEqual(x['status'], 'unsupported_by_tool')

    def test_mode_required(self):
        x = tools.ejecutar_tool_analitica(None, {
            'source':'requirement_sla','tool_id':'rs_consultar_tipos'})
        self.assertEqual(x['status'], 'needs_clarification')

    def test_service_exception_is_backend_error(self):
        def broken(db, **kwargs):
            raise ConnectionError('SQL no disponible')
        with patch.object(tools, '_get_service', return_value=broken):
            x = tools.ejecutar_tool_analitica(None, {
                'source':'incident_consolidated','tool_id':'ic_consultar_kpis'})
        self.assertEqual(x['status'], 'backend_error')

    def test_sla_no_measurable_is_null(self):
        class StubRepo:
            @staticmethod
            def obtener_kpis(db, **kwargs):
                return {
                    'total_tickets':3,
                    'sla_respuesta_medibles':0,'sla_solucion_medibles':0,
                    'ola_respuesta_medibles':0,'ola_solucion_medibles':0,
                }
        def fake_service(db, **kwargs):
            return {'total_tickets':3,'sla_respuesta':0.0,'sla_solucion':0.0,
                    'ola_respuesta':0.0,'ola_solucion':0.0}
        with patch.object(tools, '_get_service', return_value=fake_service), \
             patch.object(tools, 'import_module', return_value=StubRepo):
            x = tools.ejecutar_tool_analitica(None, {
                'source':'incident_sla','tool_id':'is_consultar_kpis'})
        self.assertEqual(x['status'],'success')
        self.assertIsNone(x['metrics']['sla_solucion']) if 'sla_solucion' in x['metrics'] else self.assertIsNone(x['data']['sla_solucion'])


if __name__ == '__main__':
    unittest.main()
