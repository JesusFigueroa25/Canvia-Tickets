
from __future__ import annotations
from datetime import date,datetime
from types import SimpleNamespace
from unittest import TestCase,main
from unittest.mock import MagicMock,patch
from fastapi import BackgroundTasks,HTTPException
from pydantic import ValidationError
from app.controllers import requirement_categorization_audit_controller as controller
from app.repositories import requirement_categorization_audit_repository as repo
from app.schemas.requirement_categorization_audit_schema import (
    AuditRunCreate,AuditRunOut,AuditTicketFilters,AuditTicketOut,
)
from app.services import requirement_categorization_audit_service as servicio
from app.services.categorization.audit_runner import evaluar_estado_solucion


def _ejecucion(run_id: int = 7,status: str = "PENDING") -> AuditRunOut:

    return AuditRunOut(
        run_id=run_id,
        grupo_resolutor="BASE DE DATOS Y EBS",
        status=status,
        total_tickets=0,
        processed_tickets=0,
        correct_count=0,
        incorrect_count=0,
        error_count=0,
        created_at=datetime(2026,1,1),
    )



class TestReglasTickets(TestCase):
    def test_resueltos_y_cancelados(self):
        escenarios = [
            ("Closed","Auto Closed after 3 days",datetime(2026,5,15),"Se realizó","RESOLVED","PRESENT"),
            ("Resolved","Resolved",datetime(2026,5,15),"Se resolvió","RESOLVED","PRESENT"),
            ("Closed","Cancelled",None,None,"CANCELLED","OPTIONAL_MISSING"),
            ("Closed","Cancelled",None,"Comentario de cierre","CANCELLED","PRESENT"),
            ("Pending Stop Clock","Pendiente Cliente",None,None,"OPEN","OPTIONAL_MISSING"),
            ("Active","In Progress",None,None,"OPEN","OPTIONAL_MISSING"),
            ("Closed","Cerrado sin respuesta cliente",None,None,"UNCERTAIN","REVIEW_STATUS"),
            ("Closed","Created Incident",None,None,"UNCERTAIN","REVIEW_STATUS"),
            ("Closed","Auto Closed after 3 days",datetime(2026,5,15),None,"RESOLVED","MISSING_REQUIRED"),
        ]

        for estado,motivo,fecha,solucion,situacion,verificacion in escenarios:
            with self.subTest(estado=estado,motivo=motivo,solucion=solucion):
                ticket = SimpleNamespace(Estado=estado,Motivo_Estado=motivo,Fecha_Resolucion=fecha,Solucion=solucion)
                resultado = evaluar_estado_solucion(ticket)
                self.assertEqual(resultado.ticket_lifecycle_status,situacion)
                self.assertEqual(resultado.solution_check_status,verificacion)
                self.assertEqual(resultado.has_solution,bool(solucion))


class TestSchemas(TestCase):
    def test_periodo_valido(self):
        datos = AuditRunCreate(period_from=date(2026,1,1),period_to=date(2026,5,31))
        self.assertEqual(datos.period_from,date(2026,1,1))

    def test_periodo_invertido(self):
        with self.assertRaises(ValidationError):
            AuditRunCreate(period_from=date(2026,5,31),period_to=date(2026,1,1))

    def test_resultado_y_paginacion_invalidos(self):
        with self.assertRaises(ValidationError):
            AuditTicketFilters(resultado="UNKNOWN")
        with self.assertRaises(ValidationError):
            AuditTicketFilters(page=0)
        with self.assertRaises(ValidationError):
            AuditTicketFilters(page_size=201)


    def test_evidencia_sql_server(self):
        ticket = AuditTicketOut(
            result_id=1,run_id=7,ticket_id="100-233615",
            grupo_resolutor="BASE DE DATOS Y EBS",
            source_opened_at=datetime(2026,1,2),
            result_status="CORRECT",
            reason_code="AMBIGUOUS_CATEGORY",
            reason_text="Evidencia insuficiente",
            evidence_json='{"campos":["descripcion","solucion"]}',
            source_hash="a"*64,
            evaluated_at=datetime(2026,1,3),
        )

        self.assertEqual(
            ticket.evidence_json["campos"],
            ["descripcion","solucion"],
        )
        self.assertEqual(len(ticket.source_hash),64)



class TestRepositorio(TestCase):
    def test_grupo_predeterminado(self):
        self.assertEqual(repo.normalizar_grupo_resolutor(None),"BASE DE DATOS Y EBS")
        self.assertEqual(repo.normalizar_grupo_resolutor(" base de datos y ebs "),"BASE DE DATOS Y EBS")

    def test_otro_grupo_no_habilitado(self):
        with self.assertRaises(ValueError):
            repo.normalizar_grupo_resolutor("OTRO GRUPO")


    def test_resumen_y_porcentajes(self):
        from types import SimpleNamespace
        from unittest.mock import MagicMock, patch

        db = MagicMock()

        ejecucion = SimpleNamespace(
            run_id=7,
            grupo_resolutor="BASE DE DATOS Y EBS",
            status="COMPLETED",
            total_tickets=10,
            error_count=0,
        )

        # Simula 10 tickets: 7 correctos y 3 incorrectos.
        db.execute.return_value.mappings.return_value.one.return_value = {
            "evaluados": 10,
            "correctos": 7,
            "incorrectos": 3,
            "sin_solucion_obligatoria": 2,
            "sin_solucion_opcional": 1,
            "solucion_revision": 1,
        }

        with patch.object(
            repo,
            "_validar_run_grupo",
            return_value=ejecucion,
        ):
            resultado = repo.obtener_resumen(
                db,
                run_id=7,
                grupo_resolutor="BASE DE DATOS Y EBS",
            )

        self.assertEqual(resultado["run_id"], 7)
        self.assertEqual(resultado["processed_tickets"], 10)

        self.assertEqual(resultado["correct_count"], 7)
        self.assertEqual(resultado["incorrect_count"], 3)

        self.assertEqual(resultado["correct_percentage"], 70.0)
        self.assertEqual(resultado["incorrect_percentage"], 30.0)

        # Los resultados binarios deben cubrir todos los evaluados.
        self.assertEqual(
            resultado["correct_count"] + resultado["incorrect_count"],
            resultado["processed_tickets"],
        )

        self.assertEqual(
            resultado["correct_percentage"]
            + resultado["incorrect_percentage"],
            100.0,
        )

        # REVIEW ya no pertenece a la categorizacion.
        self.assertNotIn("review_count", resultado)
        self.assertNotIn("review_percentage", resultado)

        # La verificacion independiente de solucion se conserva.
        self.assertEqual(
            resultado["missing_required_solution_count"], 2
        )
        self.assertEqual(
            resultado["optional_missing_solution_count"], 1
        )
        self.assertEqual(
            resultado["review_solution_status_count"], 1
        )



class TestServicio(TestCase):
    def test_crear_ejecucion(self):
        db = MagicMock()
        db.scalar.return_value = None
        ejecucion = _ejecucion()

        with patch.object(repo,"contar_tickets_fuente",return_value=10),patch.object(repo,"crear_ejecucion",return_value=ejecucion):
            resultado = servicio.crear_ejecucion(db,AuditRunCreate())

        self.assertEqual(resultado.run_id,7)
        db.commit.assert_called_once()
        db.rollback.assert_not_called()

    def test_sin_tickets(self):
        db = MagicMock()

        with patch.object(repo,"contar_tickets_fuente",return_value=0):
            with self.assertRaisesRegex(ValueError,"No se encontraron requerimientos"):
                servicio.crear_ejecucion(db,AuditRunCreate())

        db.rollback.assert_called_once()

    def test_ejecucion_pendiente_existente(self):
        db = MagicMock()
        db.scalar.return_value = 25

        with patch.object(repo,"contar_tickets_fuente",return_value=10):
            with self.assertRaises(servicio.AuditoriaEnCursoError):
                servicio.crear_ejecucion(db,AuditRunCreate())

        db.rollback.assert_called_once()

    def test_run_de_otro_grupo(self):
        db = MagicMock()
        ejecucion = SimpleNamespace(run_id=7,grupo_resolutor="OTRO GRUPO")

        with patch.object(repo,"obtener_ejecucion",return_value=ejecucion):
            with self.assertRaises(servicio.AuditoriaNoEncontradaError):
                servicio.obtener_ejecucion(db,7)

    def test_tickets_filtrados(self):
        db = MagicMock()
        filtros = AuditTicketFilters(run_id=7,resultado="INCORRECT",page=2,page_size=10)
        datos = {"run_id":7,"grupo_resolutor":"BASE DE DATOS Y EBS","total":0,"page":2,"page_size":10,"items":[]}

        with patch.object(servicio,"_resolver_ejecucion",return_value=_ejecucion()),patch.object(repo,"listar_tickets_evaluados",return_value=datos) as consultar:
            resultado = servicio.obtener_tickets(db,filtros)

        self.assertEqual(resultado.page,2)
        self.assertEqual(consultar.call_args.kwargs["resultado"],"INCORRECT")
        self.assertEqual(consultar.call_args.kwargs["page_size"],10)
        

    def test_ejecutar_auditoria_utiliza_motor_binario(self):
        from unittest.mock import patch

        from app.services import (
            requirement_categorization_audit_service as servicio
        )
        from app.services.categorization.audit_runner import AuditRunner

        configuracion_capturada = {}

        def ejecutar_simulado(runner, run_id):
            configuracion_capturada["config"] = (
                runner.semantic_engine.config
            )

            return {
                "run_id":run_id,
                "status":"COMPLETED",
            }

        session_factory = lambda: None

        with patch.object(
            AuditRunner,
            "ejecutar",
            autospec=True,
            side_effect=ejecutar_simulado,
        ) as ejecutar_mock:

            resultado = servicio.ejecutar_auditoria(
                run_id=12,
                session_factory=session_factory,
                batch_size=10,
            )

        ejecutar_mock.assert_called_once()

        self.assertEqual(resultado["run_id"],12)

        config = configuracion_capturada["config"]

        self.assertTrue(config.binary_mode)
        self.assertEqual(config.binary_threshold,0.35)
        self.assertEqual(config.binary_uncertainty_margin,0.07)




class TestControlador(TestCase):
    def test_siete_endpoints(self):
        rutas = {(next(iter(r.methods)),r.path) for r in controller.router.routes}
        self.assertEqual(len(rutas),7)
        self.assertIn(("POST","/requirement-categorization-audit/runs"),rutas)
        self.assertIn(("GET","/requirement-categorization-audit/tickets"),rutas)

    def test_creacion_programa_tarea(self):
        background = BackgroundTasks()
        ejecucion = _ejecucion(run_id=12)

        with patch.object(controller.servicio,"crear_ejecucion",return_value=ejecucion):
            resultado = controller.crear_auditoria(AuditRunCreate(),background,MagicMock())

        self.assertEqual(resultado.run_id,12)
        self.assertEqual(len(background.tasks),1)
        self.assertEqual(background.tasks[0].args,(12,))

    def test_errores_http(self):
        casos = [
            (servicio.AuditoriaNoEncontradaError("No existe"),404),
            (servicio.AuditoriaEnCursoError("En proceso"),409),
            (ValueError("Grupo inválido"),400),
        ]

        for error,codigo in casos:
            with self.subTest(codigo=codigo):
                operacion = MagicMock(side_effect=error)

                with self.assertRaises(HTTPException) as capturado:
                    controller._ejecutar_operacion(operacion)

                self.assertEqual(capturado.exception.status_code,codigo)


if __name__ == "__main__":
    main()
