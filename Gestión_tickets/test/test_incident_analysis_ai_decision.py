"""Pruebas unitarias de análisis ejecutivo v2 (sin OpenAI ni SQL Server)."""
from datetime import date
import pytest

from app.schemas.consolidated_import_schema import (
    IncidentConsolidatedAnalisisEjecutivoIAOut,
    IncidentConsolidatedDashboardFilters,
)
from app.services import incident_analysis_ai_decision as ai


def datos():
    filtros = IncidentConsolidatedDashboardFilters(
        desde=date(2026, 1, 1), hasta=date(2026, 10, 26),
        grupo_resolutor="BASE DE DATOS Y EBS", proyecto="CLIENTE PRIVADO"
    )
    atribucion = {
        "total_tickets": 100, "total_atribuidos_original": 100,
        "estado_ajuste": "PENDIENTE_REGLAS_APROBADAS",
        "distribucion_original": [
            {"atribucion": "Atribuible a Cliente", "tickets": 90},
            {"atribucion": "Atribuible a Canvia", "tickets": 10},
        ],
    }
    causas = {
        "total_incidentes": 100, "con_factor_tecnico": 30,
        "causas": [
            {"categoria": "Bases de datos y archivos de datos", "incidentes": 25,
             "es_causa_identificada": True, "accion_recomendada": "Revisar"},
            {"categoria": "Sin evidencia técnica suficiente", "incidentes": 70,
             "es_causa_identificada": False, "accion_recomendada": "Revisar"},
        ],
    }
    servidores = {
        "total_incidentes": 100, "servidores": [
            {"servidor": "SRV-CONTROL-PRIVADO", "incidentes": 20}
        ],
    }
    proyectos = [
        {"proyecto": "PROYECTO-SENSIBLE", "cantidad": 65},
        {"proyecto": "OTRO-PROYECTO", "cantidad": 35},
    ]
    top_proyectos = {"periodos": [], "proyectos": []}
    rendimiento = {
        "total_general": 100, "total_resolutores": 3,
        "resolutores": [
            {"nombre_resolutor": "PERSONA-CONFIDENCIAL", "total_tickets": 45},
            {"nombre_resolutor": "OTRO-RESOLUTOR", "total_tickets": 30},
        ],
    }
    prioridades = [{"prioridad": "2-High", "cantidad": 15}]
    tipos = [{"tipo_incidente": "Incidencia de base de datos", "cantidad": 60}]
    volumen = [
        {"anio": 2026, "mes": 8, "periodo": "AGO-26", "tickets": 40},
        {"anio": 2026, "mes": 9, "periodo": "SEP-26", "tickets": 55},
        {"anio": 2026, "mes": 10, "periodo": "OCT-26", "tickets": 5},
    ]
    return (filtros, atribucion, causas, servidores, proyectos,
            top_proyectos, rendimiento, prioridades, tipos, volumen)


def catalogo():
    return ai._crear_catalogo(*datos())


def test_hallazgos_operativos_no_incluyen_sin_evidencia():
    contenido = catalogo()
    assert len(contenido) >= 5
    assert all("sin evidencia" not in e["hecho"].lower() for e in contenido)
    assert {"C01", "P01", "R01", "S01", "Q01", "I01", "T01"}.issubset(
        {e["evidencia_id"] for e in contenido}
    )


def test_periodo_parcial_no_se_compara():
    datos_input = datos()
    filtros = datos_input[0]
    assert not ai._periodo_completo(2026, 10, filtros)
    assert ai._periodo_completo(2026, 9, filtros)
    contexto = catalogo()
    tendencia = next(e for e in contexto if e["evidencia_id"] == "T01")
    assert "SEP-26" in tendencia["hecho"]
    assert "AGO-26" in tendencia["hecho"]
    assert "OCT-26" not in tendencia["hecho"]


def test_contexto_no_envia_identificadores_privados():
    entradas = catalogo()
    filtros = datos()[0]
    salida = str(ai._contexto_llm(entradas, filtros, 100))
    for secreto in ("PROYECTO-SENSIBLE", "PERSONA-CONFIDENCIAL", "SRV-CONTROL-PRIVADO", "CLIENTE PRIVADO"):
        assert secreto not in salida


def test_modelo_no_puede_inventar_cifras():
    entradas = catalogo()
    narrativa = {"hallazgos": [
        {"evidencia_id": "C01", "titulo": "Causas recurrentes",
         "interpretacion": "El servidor tuvo 999 fallas verificadas."}],
        "conclusiones": [{"titulo": "Acción recomendada", "conclusion": "Focalizar revisión.",
                         "recomendacion": "Revisar clasificación técnica.",
                         "evidencias": ["C01"]}]}
    with pytest.raises(ValueError, match="CIFRA_IA_NO_VERIFICADA"):
        ai._ensamblar(narrativa, entradas, 100, "PENDIENTE_REGLAS_APROBADAS")


def test_modelo_no_puede_citar_evidencias_ausentes():
    entradas = catalogo()
    narrativa = {"hallazgos": [
        {"evidencia_id": "C01", "titulo": "Factor predominante",
         "interpretacion": "Analizar los eventos recurrentes en los registros técnicos."}],
        "conclusiones": [{"titulo": "Control de recurrencias",
                         "conclusion": "El patrón requiere revisión focalizada.",
                         "recomendacion": "Revisar los registros y validar la hipótesis.",
                         "evidencias": ["NO_EXISTE"]}]}
    with pytest.raises(ValueError, match="REFERENCIAS_IA_INVALIDAS"):
        ai._ensamblar(narrativa, entradas, 100, "PENDIENTE_REGLAS_APROBADAS")


def test_respaldo_operativo_preserva_schema_angular():
    entradas = catalogo()
    h, c = ai._respaldo_operativo(entradas, 100, "PENDIENTE_REGLAS_APROBADAS")
    salida = {"origen": "reglas", "modelo": None, "advertencia": "Prueba",
              "hallazgos": h, "conclusiones": c}
    IncidentConsolidatedAnalisisEjecutivoIAOut.model_validate(salida)
    assert 1 <= len(h["hallazgos"]) <= 5
    assert all("sin evidencia técnica suficiente" not in e["descripcion"].lower()
               for e in h["hallazgos"])
    codigos = {e["codigo"] for e in h["hallazgos"]}
    assert all(set(item["hallazgos_referencia"]) <= codigos for item in c["conclusiones"])


def test_ensamblado_ia_conserva_cifras_y_contratos():
    entradas = catalogo()
    narrativa = {
        "hallazgos": [
            {"evidencia_id": "C01", "titulo": "Factores técnicos recurrentes",
             "interpretacion": "Conviene revisar la repetición de los mismos eventos y contrastar su resolución."},
            {"evidencia_id": "R01", "titulo": "Concentración de carga",
             "interpretacion": "La distribución de asignaciones puede orientar una revisión del equilibrio operativo."},
        ],
        "conclusiones": [
            {"titulo": "Revisión de factor técnico", "conclusion": "Es pertinente comprobar qué síntomas se repiten en los casos clasificados.",
             "recomendacion": "Documentar los casos repetidos, sus objetos afectados y las comprobaciones realizadas.",
             "evidencias": ["C01"]},
            {"titulo": "Distribución de asignaciones", "conclusion": "La participación del resolutor merece revisión como distribución, sin presumir una sobrecarga.",
             "recomendacion": "Contrastar períodos y tipos con cobertura del equipo y registrar diferencias verificables.",
             "evidencias": ["R01"]},
        ],
    }
    h, c = ai._ensamblar(narrativa, entradas, 100, "PENDIENTE_REGLAS_APROBADAS")
    salida = IncidentConsolidatedAnalisisEjecutivoIAOut.model_validate({
        "origen": "ia", "modelo": "prueba", "advertencia": None,
        "hallazgos": h, "conclusiones": c,
    })
    assert h["hallazgos"][0]["valor"] == 25
    assert h["hallazgos"][1]["valor"] == 45
    assert "PERSONA-CONFIDENCIAL" in h["hallazgos"][1]["descripcion"]
    assert c["conclusiones"][0]["hallazgos_referencia"] == ["H01"]
    assert c["conclusiones"][1]["hallazgos_referencia"] == ["H02"]
    assert "25" in c["conclusiones"][0]["conclusion"]
    assert "PERSONA-CONFIDENCIAL" in c["conclusiones"][1]["conclusion"]
    assert "Documentar los casos repetidos" in c["conclusiones"][0]["recomendacion"]
    assert salida.origen == "ia"


def test_una_consulta_de_causas_y_respuesta_ia(monkeypatch):
    filtros, atribucion, causas, servidores, proyectos, top_proyectos, rendimiento, prioridades, tipos, volumen = datos()
    llamadas = {"causas": 0, "servidores": 0}

    monkeypatch.setattr(ai.incidentes, "obtener_distribucion_ajustada_causas", lambda db, filtros: atribucion)
    def cargar_causas(db, filtros):
        llamadas["causas"] += 1
        return causas
    monkeypatch.setattr(ai.incidentes, "obtener_analisis_causas", cargar_causas)
    def cargar_servidores(db, filtros, limite):
        llamadas["servidores"] += 1
        return servidores
    monkeypatch.setattr(ai.incidentes, "obtener_top_servidores", cargar_servidores)
    monkeypatch.setattr(ai.incidentes, "obtener_proyectos", lambda db, filtros: proyectos)
    monkeypatch.setattr(ai.incidentes, "obtener_top_proyectos", lambda db, filtros: top_proyectos)
    monkeypatch.setattr(ai.incidentes, "obtener_rendimiento_resolutores", lambda db, filtros, pagina, tamano: rendimiento)
    monkeypatch.setattr(ai.incidentes, "obtener_prioridades", lambda db, filtros: prioridades)
    monkeypatch.setattr(ai.incidentes, "obtener_tipos", lambda db, filtros, limite: tipos)
    monkeypatch.setattr(ai.incidentes, "obtener_volumen_mensual", lambda db, filtros: volumen)
    def respuesta_mock(contexto):
        assert "SRV-CONTROL-PRIVADO" not in str(contexto)
        return {
            "hallazgos": [
                {"evidencia_id": "C01", "titulo": "Patrones técnicos predominantes",
                 "interpretacion": "Revisar eventos repetidos y confirmar qué condiciones se repiten."},
                {"evidencia_id": "R01", "titulo": "Concentración de atención",
                 "interpretacion": "El volumen atendido sugiere revisar la distribución del trabajo."},
            ],
            "conclusiones": [
                {"titulo": "Revisión de factor técnico",
                 "conclusion": "Este factor técnico merece contrastarse con los registros operativos.",
                 "recomendacion": "Agrupar los tickets del factor por síntoma y solución para comprobar repetición.",
                 "evidencias": ["C01"]},
            ]
        }, "modelo-de-prueba"
    monkeypatch.setattr(ai, "_llamar_openai", respuesta_mock)
    salida = ai.generar_analisis_ejecutivo_ia(object(), filtros, incluir_servidores=True)
    assert salida["origen"] == "ia"
    assert llamadas == {"causas": 1, "servidores": 1}
    IncidentConsolidatedAnalisisEjecutivoIAOut.model_validate(salida)


def test_fallo_llm_respaldado_por_datos_sin_h06(monkeypatch):
    filtros, atribucion, causas, servidores, proyectos, top_proyectos, rendimiento, prioridades, tipos, volumen = datos()
    monkeypatch.setattr(ai.incidentes, "obtener_distribucion_ajustada_causas", lambda db, filtros: atribucion)
    monkeypatch.setattr(ai.incidentes, "obtener_analisis_causas", lambda db, filtros: causas)
    monkeypatch.setattr(ai.incidentes, "obtener_proyectos", lambda db, filtros: proyectos)
    monkeypatch.setattr(ai.incidentes, "obtener_top_proyectos", lambda db, filtros: top_proyectos)
    monkeypatch.setattr(ai.incidentes, "obtener_rendimiento_resolutores", lambda db, filtros, pagina, tamano: rendimiento)
    monkeypatch.setattr(ai.incidentes, "obtener_prioridades", lambda db, filtros: prioridades)
    monkeypatch.setattr(ai.incidentes, "obtener_tipos", lambda db, filtros, limite: tipos)
    monkeypatch.setattr(ai.incidentes, "obtener_volumen_mensual", lambda db, filtros: volumen)
    def error_red(contexto):
        raise TimeoutError("NO DEBE EXPONERSE EL DETALLE DEL PROVEEDOR")
    monkeypatch.setattr(ai, "_llamar_openai", error_red)
    salida = ai.generar_analisis_ejecutivo_ia(object(), filtros, incluir_servidores=False)
    assert salida["origen"] == "reglas"
    assert "NO DEBE EXPONERSE" not in salida["advertencia"]
    assert "sin evidencia técnica suficiente" not in str(salida["hallazgos"]).lower()
    IncidentConsolidatedAnalisisEjecutivoIAOut.model_validate(salida)


def test_proyecto_unico_no_produce_hallazgo_obvio():
    datos_input = list(datos())
    datos_input[4] = [{"proyecto": "PROYECTO-SENSIBLE", "cantidad": 100}]
    evidencias = ai._crear_catalogo(*datos_input)
    assert "P01" not in {e["evidencia_id"] for e in evidencias}


def test_rechaza_conclusiones_que_combinan_indicadores_sin_cruce_sql():
    entradas = catalogo()
    narrativa = {
        "hallazgos": [
            {"evidencia_id": "I01", "titulo": "Categoría frecuente",
             "interpretacion": "Conviene comprobar si se repite una falla concreta, no solo su nombre."},
            {"evidencia_id": "Q01", "titulo": "Volumen de prioridad alta",
             "interpretacion": "Es un subconjunto de atención prioritaria, no una infracción SLA."},
        ],
        "conclusiones": [{
            "titulo": "Cruce no calculado",
            "conclusion": "La combinación de ambas señales demuestra exposición operativa.",
            "recomendacion": "Revisar los incidentes para detectar cuáles coinciden.",
            "evidencias": ["I01", "Q01"],
        }],
    }
    with pytest.raises(ValueError, match="REFERENCIAS_IA_INVALIDAS"):
        ai._ensamblar(narrativa, entradas, 100, "PENDIENTE_REGLAS_APROBADAS")


def test_conclusion_numerica_enlazada_a_una_unica_evidencia():
    entradas = catalogo()
    narrativa = {
        "hallazgos": [{
            "evidencia_id": "I01", "titulo": "Categoría más frecuente",
            "interpretacion": "El volumen amerita revisar si existe repetición del mismo evento, no afirmarlo.",
        }],
        "conclusiones": [{
            "titulo": "Analizar el tipo más frecuente",
            "conclusion": "Debe verificarse si el conjunto comparte síntomas o soluciones comunes.",
            "recomendacion": "Registrar los eventos repetidos y contrastar las soluciones documentadas.",
            "evidencias": ["I01"],
        }],
    }
    h, c = ai._ensamblar(narrativa, entradas, 100, "PENDIENTE_REGLAS_APROBADAS")
    item = c["conclusiones"][0]
    assert "Incidencia de base de datos" in item["conclusion"]
    assert "60 de 100" in item["conclusion"]
    assert item["hallazgos_referencia"] == ["H01"]
    assert "Registrar los eventos repetidos" in item["recomendacion"]
    assert item["requiere_validacion"] is True


def test_rechaza_narrativa_que_declara_cruce_no_calculado():
    entradas = catalogo()
    narrativa = {
        "hallazgos": [{
            "evidencia_id": "I01", "titulo": "Categoría más frecuente",
            "interpretacion": "Debe analizarse este tipo de incidente de forma aislada.",
        }],
        "conclusiones": [{
            "titulo": "Análisis conjunto injustificado",
            "conclusion": "La combinación de ambas señales confirma un problema de recurrencia.",
            "recomendacion": "Contrastar las recurrencias del tipo seleccionado.",
            "evidencias": ["I01"],
        }],
    }
    with pytest.raises(ValueError, match="CRUCE_DE_METRICAS_NO_VERIFICADO"):
        ai._ensamblar(narrativa, entradas, 100, "PENDIENTE_REGLAS_APROBADAS")


def test_llm_recibe_una_accion_sugerida_sin_nombres_privados():
    contexto = ai._contexto_llm(catalogo(), datos()[0], 100)
    assert all("accion_sugerida" in item for item in contexto["observaciones"])
    texto = str(contexto)
    assert "PERSONA-CONFIDENCIAL" not in texto
    assert "PROYECTO-SENSIBLE" not in texto
    assert "SRV-CONTROL-PRIVADO" not in texto


def test_cautela_metodologica_no_descarta_todo_y_titulo_se_corrige():
    entradas = catalogo()
    narrativa = {
        "hallazgos": [{
            "evidencia_id": "I01",
            "titulo": "Datos insuficientes para conocer el origen",
            "interpretacion": "Una categoría frecuente no supone evidencia de una misma falla técnica.",
        }],
        "conclusiones": [{
            "titulo": "Revisión de la categoría frecuente",
            "conclusion": "La frecuencia permite delimitar tickets para verificar síntomas y soluciones documentadas.",
            "recomendacion": "Comparar descripciones y soluciones registradas e identificar similitudes comprobables.",
            "evidencias": ["I01"],
        }],
    }
    hallazgos, conclusiones = ai._ensamblar(narrativa, entradas, 100, "PENDIENTE_REGLAS_APROBADAS")
    assert hallazgos["hallazgos"][0]["titulo"] == "Tipo de incidente predominante"
    assert "no supone evidencia" in hallazgos["hallazgos"][0]["descripcion"]
    assert conclusiones["total_conclusiones"] == 1


def test_fallo_por_cifra_reintenta_una_vez_y_recupera_ia(monkeypatch):
    filtros, atribucion, causas, servidores, proyectos, top_proyectos, rendimiento, prioridades, tipos, volumen = datos()
    monkeypatch.setattr(ai.incidentes, "obtener_distribucion_ajustada_causas", lambda db, filtros: atribucion)
    monkeypatch.setattr(ai.incidentes, "obtener_analisis_causas", lambda db, filtros: causas)
    monkeypatch.setattr(ai.incidentes, "obtener_proyectos", lambda db, filtros: proyectos)
    monkeypatch.setattr(ai.incidentes, "obtener_top_proyectos", lambda db, filtros: top_proyectos)
    monkeypatch.setattr(ai.incidentes, "obtener_rendimiento_resolutores", lambda db, filtros, pagina, tamano: rendimiento)
    monkeypatch.setattr(ai.incidentes, "obtener_prioridades", lambda db, filtros: prioridades)
    monkeypatch.setattr(ai.incidentes, "obtener_tipos", lambda db, filtros, limite: tipos)
    monkeypatch.setattr(ai.incidentes, "obtener_volumen_mensual", lambda db, filtros: volumen)
    llamadas = []

    def responder(contexto, correccion=None):
        llamadas.append(correccion)
        interpretacion = (
            "El servicio tuvo 999 fallos confirmados." if correccion is None
            else "El volumen de tickets justifica agrupar síntomas antes de afirmar recurrencia."
        )
        return {
            "hallazgos": [{
                "evidencia_id": "I01", "titulo": "Categoría frecuente",
                "interpretacion": interpretacion,
            }],
            "conclusiones": [{
                "titulo": "Revisar causas documentadas",
                "conclusion": "La categoría permite seleccionar casos para una revisión técnica focalizada.",
                "recomendacion": "Comparar los casos y documentar eventos compartidos comprobables.",
                "evidencias": ["I01"],
            }],
        }, "modelo-prueba"

    monkeypatch.setattr(ai, "_llamar_openai", responder)
    respuesta = ai.generar_analisis_ejecutivo_ia(object(), filtros, incluir_servidores=False)
    assert respuesta["origen"] == "ia"
    assert len(llamadas) == 2
    assert llamadas[0] is None
    assert "no escribas dígitos" in llamadas[1]
    assert "999" not in str(respuesta)
    assert respuesta["hallazgos"]["hallazgos"][0]["valor"] == 60


def test_respaldo_informa_metodologia_neutra_y_recomendaciones_especificas():
    entradas = catalogo()
    h, c = ai._respaldo_operativo(entradas, 100, "PENDIENTE_REGLAS_APROBADAS")
    assert "priorizados con IA" not in h["metodologia"]
    assert "El indicador permite definir" not in str(h)
    assert "El volumen registrado permite delimitar" not in str(c)
    assert any("clasificar" in item["recomendacion"].lower() for item in c["conclusiones"])


def test_mes_corriente_no_es_mes_completo_sin_hasta():
    from datetime import date, timedelta
    hoy = date.today()
    comienzo_mes = hoy.replace(day=1)
    ultimo_dia = (date(hoy.year + (hoy.month == 12), (hoy.month % 12) + 1, 1) - timedelta(days=1))
    if hoy < ultimo_dia:
        assert not ai._periodo_completo(hoy.year, hoy.month, IncidentConsolidatedDashboardFilters())
