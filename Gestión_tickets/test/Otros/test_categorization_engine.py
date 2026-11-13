
from __future__ import annotations
from dataclasses import replace
from datetime import datetime
from types import SimpleNamespace
from unittest import TestCase,main
from unittest.mock import MagicMock
import numpy as np
from app.services.categorization.preprocessor import (
    calcular_hash_ticket,fragmentar_texto,normalizar_texto,
    preparar_ticket,seleccionar_fragmentos,
)
from app.services.categorization.semantic_engine import (
    EvaluacionSemantica,SemanticConfig,SemanticEngine,
)
from app.services.categorization.audit_runner import AuditRunner


class ModeloSimulado:
    def __init__(self):
        self.llamadas = 0

    def encode(self,textos,**kwargs):
        self.llamadas += 1
        vectores = []

        for texto in textos:
            contenido = texto.casefold()

            if "checklist" in contenido:
                vector = [1.0,0.0,0.0]
            elif "reunion" in contenido:
                vector = [0.0,1.0,0.0]
            elif "backup" in contenido:
                vector = [0.0,0.0,1.0]
            else:
                vector = [1.0,1.0,1.0]

            vectores.append(vector)

        return np.asarray(vectores,dtype=np.float32)


def _catalogo():
    return [
        {
            "catalog_id":1,
            "level_1":"Actividades Genericas",
            "level_2":"Actividades",
            "level_3":"Reunion Tecnica",
        },
        {
            "catalog_id":2,
            "level_1":"BASE DE DATOS Administracion",
            "level_2":"Mantenimiento",
            "level_3":"Checklist Diario",
        },
        {
            "catalog_id":3,
            "level_1":"BASE DE DATOS Administracion",
            "level_2":"Gestion de Respaldos",
            "level_3":"Backup a Demanda de Base de Datos",
        },
    ]


def _ticket(**cambios):
    datos = {
        "Ticket_ID":"100-233615",
        "Grupo_Resolutor":"BASE DE DATOS Y EBS",
        "Nombre_Resolutor":"Resolutor de prueba",
        "Proyecto":"Proyecto DBA",
        "Fecha_Apertura":datetime(2026,1,2),
        "Fecha_Ultima_Modificacion":datetime(2026,1,3),
        "Fecha_Resolucion":datetime(2026,1,3),
        "Estado":"Closed",
        "Motivo_Estado":"Auto Closed after 3 days",
        "Categorizacion_Nivel_1":"BASE DE DATOS Administracion",
        "Categorizacion_Nivel_2":"Mantenimiento",
        "Categorizacion_Nivel_3":"Checklist Diario",
        "Descripcion":"Se solicita realizar checklist diario de Oracle",
        "Detalle":None,
        "Solucion":"Se realizó y envió el checklist diario",
    }

    datos.update(cambios)
    return SimpleNamespace(**datos)


def _motor():
    modelo = ModeloSimulado()
    return SemanticEngine(config=SemanticConfig(),modelo=modelo),modelo


class TestPreprocesador(TestCase):
    def test_conserva_informacion_tecnica(self):
        entrada = "  Error ORA-00600 en ipf_message   SELECT * FROM DBA_USERS  "
        resultado = normalizar_texto(entrada)

        self.assertIn("ORA-00600",resultado)
        self.assertIn("ipf_message",resultado)
        self.assertIn("SELECT * FROM DBA_USERS",resultado)

    def test_fragmentacion_de_texto_extenso(self):
        texto = "Revision de servicios Oracle, SQL Server y backup. "*100
        fragmentos = fragmentar_texto(texto)

        self.assertGreater(len(fragmentos),1)
        self.assertTrue(all(len(texto) <= 450 for texto in fragmentos))
        self.assertTrue(all(texto for texto in fragmentos))

    def test_seleccion_distribuida(self):
        fragmentos = [f"Fragmento {i}" for i in range(20)]
        seleccionados = seleccionar_fragmentos(fragmentos,limite=5)

        self.assertEqual(len(seleccionados),5)
        self.assertEqual(seleccionados[0],(0,"Fragmento 0"))
        self.assertEqual(seleccionados[-1],(19,"Fragmento 19"))

    def test_ticket_sin_detalle_ni_solucion(self):
        ticket = _ticket(
            Estado="Closed",
            Motivo_Estado="Cancelled",
            Fecha_Resolucion=None,
            Detalle=None,
            Solucion=None,
        )

        resultado = preparar_ticket(ticket)

        self.assertEqual(resultado.campos_disponibles,("descripcion",))
        self.assertTrue(resultado.tiene_ruta_completa)
        self.assertEqual(len(resultado.source_hash),64)

    def test_hash_detecta_cambio_de_solucion(self):
        original = _ticket()
        modificado = _ticket(Solucion="Se realizó un procedimiento distinto")

        hash_original = calcular_hash_ticket(original)
        hash_modificado = calcular_hash_ticket(modificado)

        self.assertNotEqual(hash_original,hash_modificado)
        self.assertEqual(hash_original,calcular_hash_ticket(original))

    def test_ticket_sin_identificador(self):
        ticket = _ticket(Ticket_ID=None)

        with self.assertRaises(ValueError):
            preparar_ticket(ticket)


class TestMotorSemantico(TestCase):
    def test_modelo_no_ejecuta_inferencia_al_inicializar(self):
        motor,modelo = _motor()

        self.assertEqual(modelo.llamadas,0)
        self.assertIsNone(motor.catalog_hash)

    def test_cache_del_catalogo(self):
        motor,modelo = _motor()
        catalogo = _catalogo()

        total_1 = motor.preparar_catalogo(catalogo)
        hash_1 = motor.catalog_hash
        llamadas_1 = modelo.llamadas

        total_2 = motor.preparar_catalogo(catalogo)

        self.assertEqual(total_1,3)
        self.assertEqual(total_2,3)
        self.assertEqual(hash_1,motor.catalog_hash)
        self.assertEqual(llamadas_1,modelo.llamadas)

    def test_categorizacion_correcta(self):
        motor,_ = _motor()
        preparado = preparar_ticket(_ticket())

        resultado = motor.evaluar(preparado,_catalogo())

        self.assertEqual(resultado.result_status,"CORRECT")
        self.assertEqual(resultado.reason_code,"SEMANTIC_MATCH")
        self.assertIsNone(resultado.suggested_catalog_id)
        self.assertGreaterEqual(resultado.semantic_score,0.60)

    def test_categorizacion_incorrecta(self):
        motor,_ = _motor()

        ticket = _ticket(
            Categorizacion_Nivel_1="Actividades Genericas",
            Categorizacion_Nivel_2="Actividades",
            Categorizacion_Nivel_3="Reunion Tecnica",
            Descripcion="checklist Prd",
            Detalle=None,
            Solucion="se envia checklist Servidores MQ",
        )

        resultado = motor.evaluar(preparar_ticket(ticket),_catalogo())

        self.assertEqual(resultado.result_status,"INCORRECT")
        self.assertEqual(resultado.reason_code,"SEMANTIC_MISMATCH")
        self.assertEqual(resultado.suggested_catalog_id,2)
        self.assertIn("ruta_alternativa",resultado.evidence_json)

    def test_revision_por_ambiguedad(self):
        motor,_ = _motor()

        ticket = _ticket(
            Categorizacion_Nivel_1="Actividades Genericas",
            Categorizacion_Nivel_2="Actividades",
            Categorizacion_Nivel_3="Reunion Tecnica",
            Descripcion="Se solicita apoyo general de producción",
            Detalle=None,
            Solucion=None,
        )

        resultado = motor.evaluar(preparar_ticket(ticket),_catalogo())

        self.assertEqual(resultado.result_status,"REVIEW")
        self.assertEqual(resultado.reason_code,"AMBIGUOUS_CATEGORY")

    def test_revision_por_informacion_insuficiente(self):
        motor,modelo = _motor()
        ticket = _ticket(Descripcion="Proyecto INSIS",Detalle=None,Solucion=None)

        resultado = motor.evaluar(preparar_ticket(ticket),_catalogo())

        self.assertEqual(resultado.result_status,"REVIEW")
        self.assertEqual(resultado.reason_code,"INSUFFICIENT_INFORMATION")
        self.assertEqual(modelo.llamadas,0)

    def test_revision_por_catalogo_vacio(self):
        motor,_ = _motor()
        preparado = preparar_ticket(_ticket())

        resultado = motor.evaluar(preparado,[])

        self.assertEqual(resultado.result_status,"REVIEW")
        self.assertEqual(resultado.reason_code,"CATALOG_EMPTY")

    def test_revision_por_catalogo_insuficiente(self):
        motor,_ = _motor()
        preparado = preparar_ticket(_ticket())

        resultado = motor.evaluar(preparado,_catalogo()[:1])

        self.assertEqual(resultado.result_status,"REVIEW")
        self.assertEqual(resultado.reason_code,"CATALOG_INSUFFICIENT")

    def test_revision_por_fragmentos_omitidos(self):
        motor,_ = _motor()

        ticket = _ticket(
            Categorizacion_Nivel_1="Actividades Genericas",
            Categorizacion_Nivel_2="Actividades",
            Categorizacion_Nivel_3="Reunion Tecnica",
            Descripcion="Se realizó el checklist diario de Oracle",
            Solucion="Se envió el checklist solicitado",
        )

        preparado = replace(preparar_ticket(ticket),fragmentos_omitidos=4)
        resultado = motor.evaluar(preparado,_catalogo())

        self.assertEqual(resultado.result_status,"REVIEW")
        self.assertEqual(resultado.reason_code,"PARTIAL_EVIDENCE")

    def test_categorizacion_incompleta(self):
        motor,modelo = _motor()
        ticket = _ticket(Categorizacion_Nivel_3=None)

        resultado = motor.evaluar(preparar_ticket(ticket),_catalogo())

        self.assertEqual(resultado.result_status,"INCORRECT")
        self.assertEqual(resultado.reason_code,"MISSING_CATEGORY")
        self.assertEqual(modelo.llamadas,0)


class TestIntegracionRunner(TestCase):
    def test_preparacion_del_registro_para_sql_server(self):
        motor = MagicMock()

        motor.evaluar.return_value = EvaluacionSemantica(
            result_status="CORRECT",
            reason_code="BINARY_SEMANTIC_MATCH",
            reason_text="La categoria es coherente con el contenido.",
            semantic_score=0.75,
            suggested_catalog_id=None,
            evidence_json={
                "engine_mode":"BINARY_EXPERIMENTAL",
            },
        )

        runner = AuditRunner(
            lambda:None,
            semantic_engine=motor,
            batch_size=10,
        )

        runner._catalogo = _catalogo()

        ticket = _ticket(
            Estado="Closed",
            Motivo_Estado="Cancelled",
            Fecha_Resolucion=None,
            Solucion=None,
        )

        clave = runner._clave(
            ticket.Categorizacion_Nivel_1,
            ticket.Categorizacion_Nivel_2,
            ticket.Categorizacion_Nivel_3,
        )

        registros = runner._evaluar_lote(
            [ticket],
            run_id=12,
            indices={clave:2},
        )

        self.assertEqual(len(registros),1)

        registro = registros[0]

        self.assertEqual(registro["run_id"],12)
        self.assertEqual(registro["ticket_id"],"100-233615")
        self.assertEqual(registro["original_catalog_id"],2)

        self.assertEqual(registro["result_status"],"CORRECT")
        self.assertEqual(registro["reason_code"],"BINARY_SEMANTIC_MATCH")
        self.assertEqual(registro["semantic_score"],0.75)

        self.assertEqual(
            registro["ticket_lifecycle_status"],
            "CANCELLED",
        )

        self.assertEqual(
            registro["solution_check_status"],
            "OPTIONAL_MISSING",
        )

        self.assertFalse(registro["has_solution"])
        self.assertEqual(len(registro["source_hash"]),64)

        motor.evaluar.assert_called_once()

    def test_runner_rechaza_estado_review(self):
        motor = MagicMock()

        motor.evaluar.return_value = EvaluacionSemantica(
            result_status="REVIEW",
            reason_code="AMBIGUOUS_CATEGORY",
            reason_text="Clasificacion no permitida.",
            semantic_score=0.45,
            suggested_catalog_id=None,
            evidence_json={},
        )

        runner = AuditRunner(
            lambda:None,
            semantic_engine=motor,
            batch_size=10,
        )

        runner._catalogo = _catalogo()

        ticket = _ticket()

        with self.assertRaisesRegex(
            RuntimeError,
            "Estado de categorizacion no permitido",
        ):
            runner._evaluar_lote(
                [ticket],
                run_id=12,
                indices={},
            )

        motor.evaluar.assert_called_once()
 
 
 
if __name__ == "__main__":
    main()