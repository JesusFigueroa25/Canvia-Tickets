"""Pruebas IA 2.3 sin SQL Server ni OpenAI. Los textos sensibles nunca salen."""
from datetime import date
from types import SimpleNamespace
import json

from sqlalchemy.dialects import mssql

from app.schemas.consolidated_import_schema import (
    IncidentConsolidatedDashboardFilters,
    IncidentConsolidatedAnalisisEjecutivoIAOut,
)
from app.services import incident_analysis_ai_cross_service as cruces
from app.services import incident_analysis_ai_decision as ai
from app.repositories import incident_consolidated_repository as repo


def _fila(i, *, descripcion="", detalle="", causa="", solucion="", prioridad="3-Medium"):
    return {"ticket_id": f"T-{i}", "descripcion": descripcion, "detalle": detalle,
            "causa": causa, "solucion": solucion, "prioridad": prioridad}


def test_patrones_contabilizan_tickets_unicos_y_altas_de_mismos_tickets():
    filas = [
        _fila(1, descripcion="ORA-12170 timeout contacto usuario@empresa.com", solucion="Se indica reiniciar", prioridad="1-Critical"),
        _fila(1, descripcion="ORA-12170 timeout contacto usuario@empresa.com", solucion="Se indica reiniciar", prioridad="1-Critical"),
        _fila(2, detalle="ORA-12541", prioridad="4-Low"),
        _fila(3, descripcion="Indisponibilidad", solucion="reinicio solicitado", prioridad="2-High"),
    ]
    out = cruces._procesar_menciones(filas, total_universo=5)
    assert out["examinados"] == 3
    assert out["cobertura_completa"] is False
    oracle = next(x for x in out["sintomas"] if x["patron"] == "Error Oracle mencionado")
    assert oracle == {"patron": "Error Oracle mencionado", "tickets": 2, "altas": 1}
    assert all("usuario@" not in str(out) for _ in range(1))
    assert "T-1" not in json.dumps(out)
    assert out["criterio_muestra"] == "tickets_recientes_por_fecha_apertura"


def test_soluciones_son_solo_menciones_no_acciones_verificadas():
    filas = [
        _fila(1, solucion="No se reinició el servicio, se requiere aprobación"),
        _fila(2, solucion="Se solicita reiniciar; pendiente"),
    ]
    out = cruces._procesar_menciones(filas, total_universo=2)
    assert out["soluciones"][0]["patron"] == "Reinicio mencionado en solución"
    assert out["soluciones"][0]["tickets"] == 2
    assert out["cobertura_completa"] is True


def _adicional(total=100):
    return {
        "tipo_prioridad": [{"tipo_incidente": "INCONVENIENTE-CLIENTE-PRIVADO", "tickets": 50, "altos": 20}],
        "proyecto_tipo": [{"proyecto": "PROYECTO-PRIVADO", "tipo_incidente": "INCONVENIENTE-CLIENTE-PRIVADO", "tickets": 30}],
        "patrones": {
            "examinados": 80,
            "total_universo": total,
            "cobertura_completa": total == 80,
            "sintomas": [{"patron": "Error Oracle mencionado", "tickets": 15, "altas": 7}],
            "soluciones": [{"patron": "Reinicio mencionado en solución", "tickets": 12}],
        },
    }


def _catalogo(filtros=None, adicional=None):
    f = filtros or IncidentConsolidatedDashboardFilters(desde=date(2026, 1, 1), hasta=date(2026, 10, 26))
    atrib = {"total_tickets": 100, "total_atribuidos_original": 100,
            "distribucion_original": [{"atribucion": "Atribuible a Cliente", "tickets": 75},
                                      {"atribucion": "Atribuible a Canvia", "tickets": 25}]}
    causas = {"con_factor_tecnico": 10, "causas": []}
    proyectos = [{"proyecto": "PROYECTO-PRIVADO", "cantidad": 60},
                 {"proyecto": "OTRO-PROYECTO", "cantidad": 40}]
    rendimiento = {"resolutores": [], "total_resolutores": 0, "total_general": 100}
    return ai._crear_catalogo(f, atrib, causas, None, proyectos, {"proyectos": []},
                              rendimiento, [], [], [], adicional=adicional or _adicional())


def test_catalogo_contiene_cruces_reales_y_denominadores_correctos():
    datos = {e["evidencia_id"]: e for e in _catalogo()}
    assert {"X01", "X02", "E01", "E02", "E03"} <= datos.keys()
    assert (datos["X01"]["valor"], datos["X01"]["denominador"], datos["X01"]["porcentaje"]) == (20, 50, 40)
    assert (datos["X02"]["valor"], datos["X02"]["denominador"], datos["X02"]["porcentaje"]) == (30, 60, 50)
    assert (datos["E03"]["valor"], datos["E03"]["denominador"]) == (7, 15)
    assert "muestra no aleatoria" in datos["E01"]["hecho"]
    assert "PROYECTO-PRIVADO" in datos["X02"]["hecho"]


def test_contexto_ia_no_expone_clientes_ni_textos_libres():
    f = IncidentConsolidatedDashboardFilters(desde=date(2026, 1, 1), hasta=date(2026, 10, 26))
    contexto = ai._contexto_llm(_catalogo(), f, 100)
    serializado = json.dumps(contexto, ensure_ascii=False)
    assert "PROYECTO-PRIVADO" not in serializado
    assert "INCONVENIENTE-CLIENTE-PRIVADO" not in serializado
    assert "ORIGINAL-PII" not in serializado
    assert contexto["observaciones"][0]["evidencia_id"] in {"X01", "X02", "E01", "E02", "E03"}
    assert "Error Oracle mencionado" in serializado


def test_cruce_critico_no_aparece_si_prioridad_esta_filtrada():
    f = IncidentConsolidatedDashboardFilters(prioridad="2-High")
    ids = {e["evidencia_id"] for e in _catalogo(f)}
    assert "X01" not in ids and "E03" not in ids


def test_conclusion_de_cruce_completamente_anclada_y_schema_angular():
    catalogo = _catalogo()
    narrativa = {
        "hallazgos": [
            {"evidencia_id": "X01", "titulo": "Cruce de criticidad por categoría",
             "interpretacion": "Los mismos incidentes cumplen ambos criterios; procede examinar sus síntomas y recurrencias."},
            {"evidencia_id": "E01", "titulo": "Errores técnicos mencionados",
             "interpretacion": "Son menciones para revisión, no causas raíz demostradas."},
        ],
        "conclusiones": [
            {"titulo": "Revisión priorizada de una categoría",
             "conclusion": "El cruce ayuda a seleccionar incidentes que merecen revisión técnica específica.",
             "recomendacion": "Examinar los tickets de la intersección, verificar síntomas y crear una matriz de recurrencias comprobadas.",
             "evidencias": ["X01"]},
        ],
    }
    h, c = ai._ensamblar(narrativa, catalogo, 100, "PENDIENTE_REGLAS_APROBADAS")
    res = IncidentConsolidatedAnalisisEjecutivoIAOut.model_validate(
        {"origen": "ia", "modelo": "mock", "advertencia": None,
         "hallazgos": h, "conclusiones": c}
    )
    assert res.hallazgos.hallazgos[0].valor == 20
    assert "INCONVENIENTE-CLIENTE-PRIVADO" in res.hallazgos.hallazgos[0].descripcion
    assert res.conclusiones.conclusiones[0].hallazgos_referencia == ["H01"]


class CapturaDB:
    def __init__(self):
        self.sql = []
    def execute(self, statement):
        self.sql.append(str(statement.compile(dialect=mssql.dialect(), compile_kwargs={"literal_binds": True})))
        return SimpleNamespace(mappings=lambda: SimpleNamespace(all=lambda: []))


def test_sql_agrupaciones_compilan_dialecto_sql_server_y_usan_filtros():
    db = CapturaDB()
    filtros = IncidentConsolidatedDashboardFilters(
        desde=date(2026, 1, 1), hasta=date(2026, 10, 26),
        grupo_resolutor="GRUPO-DE-PRUEBA",
    )
    repo.obtener_cruces_tipo_prioridad_ia(db, filtros)
    repo.obtener_cruces_proyecto_tipo_ia(db, filtros)
    repo.obtener_tickets_para_patrones_ia(db, filtros)
    assert len(db.sql) == 3
    assert "GROUP BY" in db.sql[0] and "SUM(" in db.sql[0].upper()
    assert "GROUP BY" in db.sql[1] and "Ticket_ID" in db.sql[1]
    assert "SUBSTRING(" in db.sql[2].upper() and "ORDER BY" in db.sql[2]
    assert all("GRUPO-DE-PRUEBA" in sql for sql in db.sql)
    assert all("2026-10-27" in sql for sql in db.sql)  # hasta inclusive por < día siguiente
    assert all("UPDATE " not in sql and "DELETE " not in sql for sql in db.sql)


def test_no_acepta_informe_solo_de_kpis_si_hay_cruces():
    import pytest
    catalogo = _catalogo()
    n = {
        "hallazgos": [{"evidencia_id": "A01", "titulo": "Distribución general",
                       "interpretacion": "Verificar el origen de la atribución antes de concluir responsabilidades."}],
        "conclusiones": [{"titulo": "Validación de atribución",
                         "conclusion": "Conviene revisar la clasificación sin presumir una responsabilidad.",
                         "recomendacion": "Auditar los registros y documentar diferencias con el especialista.",
                         "evidencias": ["A01"]}],
    }
    with pytest.raises(ValueError, match="OMISION_EVIDENCIA_CRUZADA"):
        ai._ensamblar(n, catalogo, 100, "PENDIENTE_REGLAS_APROBADAS")


def _patch_servicios_base(monkeypatch):
    a = {"total_tickets": 100, "total_atribuidos_original": 100,
         "estado_ajuste": "PENDIENTE_REGLAS_APROBADAS",
         "distribucion_original": [{"atribucion": "Atribuible a Cliente", "tickets": 60},
                                   {"atribucion": "Atribuible a Canvia", "tickets": 40}]}
    c = {"total_incidentes": 100, "con_factor_tecnico": 10, "causas": []}
    valores = {
        "obtener_distribucion_ajustada_causas": a,
        "obtener_analisis_causas": c,
        "obtener_proyectos": [{"proyecto": "PROYECTO-PRIVADO", "cantidad": 100}],
        "obtener_top_proyectos": {"proyectos": []},
        "obtener_rendimiento_resolutores": {"total_general": 100, "total_resolutores": 0, "resolutores": []},
        "obtener_prioridades": [{"prioridad": "1-Critical", "cantidad": 20}],
        "obtener_tipos": [{"tipo_incidente": "INCONVENIENTE-CLIENTE-PRIVADO", "cantidad": 100}],
        "obtener_volumen_mensual": [],
    }
    for nombre, valor in valores.items():
        monkeypatch.setattr(ai.incidentes, nombre, lambda *a, _valor=valor, **kw: _valor)


def test_integracion_mock_utiliza_cruces_y_conserva_contrato(monkeypatch):
    _patch_servicios_base(monkeypatch)
    llamadas = []
    def adicional(db, filtros, total):
        llamadas.append(total)
        return _adicional()
    monkeypatch.setattr(cruces, "obtener_evidencia_cruzada", adicional)
    def modelo(contexto):
        assert "PROYECTO-PRIVADO" not in json.dumps(contexto)
        assert any(x["evidencia_id"] == "X01" for x in contexto["observaciones"])
        return ({
            "hallazgos": [{"evidencia_id": "X01", "titulo": "Incidentes prioritarios por tipo",
                           "interpretacion": "Estos incidentes comparten categoría y prioridad, por lo que deben revisarse de forma diferenciada."}],
            "conclusiones": [{"titulo": "Definir revisión técnica prioritaria",
                             "conclusion": "Los mismos tickets reúnen los criterios y permiten enfocar la revisión.",
                             "recomendacion": "Agrupar los casos y contrastar síntomas para elaborar una matriz de recurrencia y prioridades.",
                             "evidencias": ["X01"]}],
        }, "modelo-de-prueba")
    monkeypatch.setattr(ai, "_llamar_openai", modelo)
    resultado = ai.generar_analisis_ejecutivo_ia(
        object(), IncidentConsolidatedDashboardFilters(proyecto="PROYECTO-PRIVADO")
    )
    assert resultado["origen"] == "ia"
    assert llamadas == [100]
    assert "20 de 50" in resultado["hallazgos"]["hallazgos"][0]["descripcion"]
    IncidentConsolidatedAnalisisEjecutivoIAOut.model_validate(resultado)


def test_error_cruces_opcional_mantiene_ia_anterior(monkeypatch):
    _patch_servicios_base(monkeypatch)
    def falla(*a, **k):
        raise RuntimeError("No imprimir identificadores privados")
    monkeypatch.setattr(cruces, "obtener_evidencia_cruzada", falla)
    monkeypatch.setattr(ai, "_llamar_openai", lambda contexto: ({
        "hallazgos": [{"evidencia_id": "I01", "titulo": "Categoría principal",
                       "interpretacion": "Este conjunto tiene suficiente volumen para seleccionar tickets representativos."}],
        "conclusiones": [{"titulo": "Revisión de categoría",
                         "conclusion": "La categoría registrada requiere una revisión de los síntomas descritos.",
                         "recomendacion": "Examinar una muestra de tickets y documentar síntomas confirmados.",
                         "evidencias": ["I01"]}],
    }, "mock"))
    resultado = ai.generar_analisis_ejecutivo_ia(
        object(), IncidentConsolidatedDashboardFilters(proyecto="PROYECTO-PRIVADO")
    )
    assert resultado["origen"] == "ia"
    IncidentConsolidatedAnalisisEjecutivoIAOut.model_validate(resultado)
