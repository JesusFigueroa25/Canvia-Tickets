"""Pruebas sin acceso a SQL Server ni consumo de tokens OpenAI."""
import importlib.util
import sys
from copy import deepcopy
from datetime import date
from pathlib import Path
from types import ModuleType

import pytest

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))
from app.schemas.consolidated_import_schema import IncidentConsolidatedDashboardFilters


@pytest.fixture
def modulo(monkeypatch):
    # Carga el servicio aislado para no depender del ETL / la conexión SQL de producción.
    stub = ModuleType("app.services.incident_consolidated_service")
    monkeypatch.setitem(sys.modules, stub.__name__, stub)
    ruta = ROOT / "app/services/incident_analysis_ai_service.py"
    spec = importlib.util.spec_from_file_location("canvia_ia_aislado", ruta)
    m = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(m)
    return m, stub


def datos():
    hallazgos = {
        "total_incidentes": 20, "total_hallazgos": 2,
        "estado_ajuste": "PENDIENTE_REGLAS_APROBADAS",
        "metodologia": "Reglas", "hallazgos": [
            {"codigo": "H03", "tipo": "causas", "titulo": "Factor técnico",
             "descripcion": "Texto reglas", "valor": 12, "porcentaje": 60.0,
             "denominador": 20, "requiere_validacion": True},
            {"codigo": "H06", "tipo": "calidad_datos", "titulo": "Sin evidencia",
             "descripcion": "Texto reglas", "valor": 8, "porcentaje": 40.0,
             "denominador": 20, "requiere_validacion": True},
        ],
    }
    conclusiones = {
        "total_incidentes": 20, "total_conclusiones": 1,
        "estado_ajuste": "PENDIENTE_REGLAS_APROBADAS",
        "metodologia": "Reglas", "conclusiones": [{
            "codigo": "C01", "tipo": "causas", "titulo": "Conclusión",
            "conclusion": "Texto base", "recomendacion": "Validar",
            "hallazgos_referencia": ["H03"], "requiere_validacion": True,
        }],
    }
    atribucion = {
        "estado_ajuste": "PENDIENTE_REGLAS_APROBADAS", "ajustes_aplicados": 0,
        "distribucion_original": [{"atribucion": "Pendiente", "tickets": 20}],
    }
    analisis = {
        "total_incidentes": 20, "con_factor_tecnico": 12,
        "sin_causa_determinada": 8, "casos_multifactor": 0,
        "causas": [{"categoria": "Servicios BD", "incidentes": 12,
                    "accion_recomendada": "Verificar registros y alertas",
                    "evidencias": [{"ticket_id": "SECRETO", "texto": "dato sensible"}]}],
    }
    return hallazgos, conclusiones, atribucion, analisis


def narrativa():
    return {
        "hallazgos": [
            {"codigo": "H03", "titulo": "Predomina el factor técnico documentado",
             "descripcion": "La clasificación muestra una concentración que justifica revisar la recurrencia antes de decidir controles preventivos."},
            {"codigo": "H06", "titulo": "Vacíos de documentación limitan el diagnóstico",
             "descripcion": "La falta de evidencia impide distinguir un problema recurrente de registros incompletos y requiere análisis de casos."},
        ],
        "conclusiones": [
            {"titulo": "Priorizar revisión de eventos repetidos",
             "conclusion": "La recurrencia de factores documentados merece una verificación operativa antes de establecer un diagnóstico definitivo.",
             "recomendacion": "Contrastar los tickets agrupados con bitácoras y alertas del mismo intervalo para confirmar patrones de repetición.",
             "hallazgos_referencia": ["H03"]},
            {"titulo": "Elevar calidad del registro de incidentes",
             "conclusion": "La cobertura documental es insuficiente para distinguir factores concurrentes y describir el origen de algunos eventos.",
             "recomendacion": "Establecer criterios mínimos de registro técnico y auditar una muestra de tickets con documentación incompleta.",
             "hallazgos_referencia": ["H06", "H03"]},
        ],
    }


def configurar_aislado(monkeypatch, stub, d):
    h, c, atrib, anal = d
    calls = {"analisis": 0, "hallazgos": 0}
    stub.obtener_distribucion_ajustada_causas = lambda db, filtros: deepcopy(atrib)
    def a(db, filtros):
        calls["analisis"] += 1
        return deepcopy(anal)
    def hh(db, filtros, incluir_servidores, **kwargs):
        calls["hallazgos"] += 1
        assert kwargs["analisis_precalculado"] is not None
        return deepcopy(h)
    def cc(db, filtros, incluir_servidores, **kwargs):
        assert kwargs["hallazgos_precalculados"] is not None
        return deepcopy(c)
    stub.obtener_analisis_causas = a
    stub.obtener_principales_hallazgos = hh
    stub.obtener_conclusiones = cc
    stub.obtener_prioridades = lambda db, filtros: [{"prioridad": "1-Critical", "cantidad": 2}]
    stub.obtener_tipos = lambda db, filtros, limite: [{"tipo_incidente": "BD", "cantidad": 20}]
    return calls


def test_filtrado_fechas_y_proyecto():
    filtros = IncidentConsolidatedDashboardFilters.model_validate({
        "desde": "2026-10-01", "hasta": "2026-10-26",
        "grupo_resolutor": "BASE DE DATOS Y EBS",
        "proyecto": "103855 LA POSITIVA PROY CLOUD GEST TI",
    })
    assert filtros.desde == date(2026, 10, 1)
    assert filtros.hasta == date(2026, 10, 26)
    assert filtros.proyecto.startswith("103855")


def test_salida_ia_mantiene_cifras_y_referencias(modulo):
    m, _ = modulo
    h, c, _, _ = datos()
    nueva_h, nueva_c = m._interpretar_narrativa(narrativa(), h, c)
    assert [x["valor"] for x in nueva_h["hallazgos"]] == [12, 8]
    assert [x["porcentaje"] for x in nueva_h["hallazgos"]] == [60.0, 40.0]
    assert nueva_c["conclusiones"][1]["hallazgos_referencia"] == ["H06", "H03"]
    assert all(x["requiere_validacion"] for x in nueva_h["hallazgos"])
    assert h["hallazgos"][0]["titulo"] == "Factor técnico"  # Sin mutar originales.


def test_rechaza_codigos_no_existentes(modulo):
    m, _ = modulo
    h, c, _, _ = datos()
    n = narrativa()
    n["conclusiones"][0]["hallazgos_referencia"] = ["H99"]
    with pytest.raises(ValueError, match="REFERENCIAS_CONCLUSION_INVALIDAS"):
        m._interpretar_narrativa(n, h, c)


def test_rechaza_cifras_creadas_por_modelo(modulo):
    m, _ = modulo
    h, c, _, _ = datos()
    n = narrativa()
    n["hallazgos"][0]["descripcion"] = "Se identificó un aumento de 99% que no está sustentado en los datos." 
    with pytest.raises(ValueError, match="NARRATIVA_IA_CON_CIFRAS_NO_VERIFICADAS"):
        m._interpretar_narrativa(n, h, c)


def test_contexto_sin_textos_de_tickets(modulo):
    m, _ = modulo
    h, c, atrib, anal = datos()
    f = IncidentConsolidatedDashboardFilters(desde=date(2026,10,1), hasta=date(2026,10,26))
    ctx = m._preparar_contexto(f, atrib, anal, h, [], [])
    import json
    texto = json.dumps(ctx)
    assert "SECRETO" not in texto
    assert "dato sensible" not in texto
    assert ctx["periodo_filtrado"]["desde"] == "2026-10-01"


def test_servicio_ia_y_un_solo_proceso_causas(modulo, monkeypatch):
    m, stub = modulo
    llamadas = configurar_aislado(monkeypatch, stub, datos())
    monkeypatch.setenv("OPENAI_API_KEY", "solo-mock")
    monkeypatch.setenv("OPENAI_MODEL", "gpt-4.1-mini")
    monkeypatch.setattr(m, "_obtener_narrativa", lambda ctx: (narrativa(), "gpt-4.1-mini"))
    resultado = m.generar_analisis_ejecutivo_ia(object(), IncidentConsolidatedDashboardFilters())
    assert resultado["origen"] == "ia"
    assert resultado["modelo"] == "gpt-4.1-mini"
    assert resultado["conclusiones"]["total_conclusiones"] == 2
    assert llamadas == {"analisis": 1, "hallazgos": 1}


def test_sin_credenciales_preserva_reglas(modulo, monkeypatch):
    m, stub = modulo
    configurar_aislado(monkeypatch, stub, datos())
    monkeypatch.delenv("OPENAI_API_KEY", raising=False)
    monkeypatch.delenv("OPENAI_MODEL", raising=False)
    resultado = m.generar_analisis_ejecutivo_ia(object(), IncidentConsolidatedDashboardFilters())
    assert resultado["origen"] == "reglas"
    assert resultado["hallazgos"]["hallazgos"][0]["valor"] == 12
    assert resultado["advertencia"] is not None


def test_sin_tickets_no_invoca_modelo(modulo, monkeypatch):
    m, stub = modulo
    h, c, atrib, anal = datos()
    h["total_incidentes"] = c["total_incidentes"] = 0
    h["hallazgos"] = []
    c["conclusiones"] = []
    h["total_hallazgos"] = c["total_conclusiones"] = 0
    configurar_aislado(monkeypatch, stub, (h, c, atrib, anal))
    monkeypatch.setattr(m, "_obtener_narrativa", lambda ctx: pytest.fail("No llamar al modelo"))
    resultado = m.generar_analisis_ejecutivo_ia(object(), IncidentConsolidatedDashboardFilters())
    assert resultado["origen"] == "sin_datos"


def test_fallo_openai_activa_respaldo(modulo, monkeypatch):
    m, stub = modulo
    configurar_aislado(monkeypatch, stub, datos())
    monkeypatch.setenv("OPENAI_API_KEY", "solo-mock")
    monkeypatch.setenv("OPENAI_MODEL", "gpt-4.1-mini")
    def falla(ctx):
        raise TimeoutError("Tiempo de espera")
    monkeypatch.setattr(m, "_obtener_narrativa", falla)
    resultado = m.generar_analisis_ejecutivo_ia(object(), IncidentConsolidatedDashboardFilters())
    assert resultado["origen"] == "reglas"
    assert resultado["conclusiones"]["total_conclusiones"] == 1


def test_titulos_breves_permitidos_y_cifras_sin_cambios(modulo):
    m, _ = modulo
    h, c, _, _ = datos()
    n = narrativa()
    n["hallazgos"][0]["titulo"] = "Cobertura"
    n["conclusiones"][0]["titulo"] = "Revisar"
    salida_h, salida_c = m._interpretar_narrativa(n, h, c)
    assert salida_h["hallazgos"][0]["titulo"] == "Cobertura"
    assert salida_h["hallazgos"][0]["valor"] == 12
    assert salida_c["conclusiones"][0]["titulo"] == "Revisar"


def test_diagnostico_seguro_sin_claves_ni_mensajes_del_proveedor(modulo):
    m, _ = modulo
    assert m._codigo_diagnostico(RuntimeError("OPENAI_API_KEY_NO_CARGADA")) == "OPENAI_API_KEY_NO_CARGADA"
    assert m._codigo_diagnostico(ValueError("LONGITUD_IA_INVALIDA")) == "LONGITUD_IA_INVALIDA"
    assert m._codigo_diagnostico(ValueError("clave-token-123")) == "VALIDACION_IA_FALLIDA"


def test_respaldo_incluye_diagnostico(modulo, monkeypatch):
    m, stub = modulo
    configurar_aislado(monkeypatch, stub, datos())
    monkeypatch.delenv("OPENAI_API_KEY", raising=False)
    monkeypatch.setenv("OPENAI_MODEL", "gpt-4.1-mini")
    r = m.generar_analisis_ejecutivo_ia(object(), IncidentConsolidatedDashboardFilters())
    assert r["origen"] == "reglas"
    assert "OPENAI_API_KEY_NO_CARGADA" in r["advertencia"]


def test_modelo_moderno_usa_max_completion_tokens_y_modo_json(modulo, monkeypatch):
    """Evita el BadRequestError por max_tokens obsoleto, sin API real."""
    import json
    from types import SimpleNamespace
    import sys
    m, _ = modulo
    monkeypatch.setenv("OPENAI_API_KEY", "mock-no-es-una-clave")
    monkeypatch.setenv("OPENAI_MODEL", "gpt-5.6-luna")
    llamadas = []

    class FalsoCompletions:
        def create(self, **kwargs):
            llamadas.append(kwargs)
            return SimpleNamespace(choices=[SimpleNamespace(message=SimpleNamespace(content=json.dumps({"hallazgos":[], "conclusiones":[]})))])

    class ClienteFalso:
        def __init__(self, **kwargs):
            self.chat = SimpleNamespace(completions=FalsoCompletions())

    monkeypatch.setitem(sys.modules, "openai", SimpleNamespace(OpenAI=ClienteFalso))
    salida, modelo = m._obtener_narrativa({"total_incidentes": 12})
    assert modelo == "gpt-5.6-luna"
    assert salida == {"hallazgos": [], "conclusiones": []}
    assert len(llamadas) == 1
    assert "max_tokens" not in llamadas[0]
    assert llamadas[0]["max_completion_tokens"] == 4000
    assert llamadas[0]["response_format"] == {"type": "json_object"}
