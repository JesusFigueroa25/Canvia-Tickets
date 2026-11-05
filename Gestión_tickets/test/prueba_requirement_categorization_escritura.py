
from __future__ import annotations
from datetime import datetime,timezone
from sqlalchemy import func,select
from app.database.sqlserver import SQLServerSessionLocal
from app.models.requirement_categorization_audit_model import RequirementCategorizationAuditResult
from app.repositories import requirement_categorization_audit_repository as repo
from app.schemas.requirement_categorization_audit_schema import (
    AuditResolverListOut,AuditSummaryOut,AuditTicketListOut,
)
from app.services.categorization.audit_runner import evaluar_estado_solucion
from app.services.categorization.preprocessor import preparar_ticket


def ahora_utc() -> datetime:
    return datetime.now(timezone.utc).replace(tzinfo=None,microsecond=0)


def ejecutar_prueba():
    run_id = None
    grupo = "BASE DE DATOS Y EBS"

    with SQLServerSessionLocal() as db:
        try:
            ticket = repo.obtener_ticket_fuente(db,"100-233615",grupo)

            if ticket is None:
                raise RuntimeError("No se encontró el ticket de prueba")

            preparado = preparar_ticket(ticket)
            situacion = evaluar_estado_solucion(ticket)

            ejecucion = repo.crear_ejecucion(
                db,grupo_resolutor=grupo,
                model_name="PRUEBA_TRANSACCIONAL",
                engine_version="TEST",
            )

            run_id = ejecucion.run_id

            repo.actualizar_ejecucion(
                db,run_id,status="RUNNING",
                total_tickets=1,processed_tickets=0,
                started_at=ahora_utc(),
            )

            registro = {
                "ticket_id":ticket.Ticket_ID,
                "grupo_resolutor":ticket.Grupo_Resolutor,
                "resolver_name":ticket.Nombre_Resolutor,
                "project_name":ticket.Proyecto,
                "source_opened_at":ticket.Fecha_Apertura,
                "source_status":ticket.Estado,
                "source_status_reason":ticket.Motivo_Estado,
                "source_last_modified_at":ticket.Fecha_Ultima_Modificacion,
                "source_resolved_at":ticket.Fecha_Resolucion,
                "original_level_1":ticket.Categorizacion_Nivel_1,
                "original_level_2":ticket.Categorizacion_Nivel_2,
                "original_level_3":ticket.Categorizacion_Nivel_3,
                "result_status":"REVIEW",
                "reason_code":"INTEGRATION_TEST",
                "reason_text":"Registro temporal de prueba. No representa una evaluación realizada por IA.",
                "evidence_json":{"prueba":"transaccion","evaluacion_real":False},
                "semantic_score":None,
                "source_hash":preparado.source_hash,
                "ticket_lifecycle_status":situacion.ticket_lifecycle_status,
                "has_solution":situacion.has_solution,
                "solution_check_status":situacion.solution_check_status,
                "solution_check_reason":situacion.solution_check_reason,
            }

            insertados = repo.guardar_resultados_lote(db,run_id,[registro])

            assert insertados == 1

            repo.actualizar_ejecucion(
                db,run_id,status="COMPLETED",
                total_tickets=1,processed_tickets=1,
                correct_count=0,incorrect_count=0,review_count=1,
                error_count=0,finished_at=ahora_utc(),
            )

            resultado = repo.obtener_resultado(db,run_id,ticket.Ticket_ID)

            assert resultado is not None
            assert resultado.result_status == "REVIEW"
            assert resultado.reason_code == "INTEGRATION_TEST"

            resumen = AuditSummaryOut.model_validate(
                repo.obtener_resumen(db,run_id,grupo)
            )

            assert resumen.total_tickets == 1
            assert resumen.processed_tickets == 1
            assert resumen.review_count == 1
            assert resumen.review_percentage == 100.0

            resolutores = AuditResolverListOut.model_validate(
                repo.listar_resolutores(db,run_id,grupo)
            )

            assert resolutores.total == 1
            assert resolutores.items[0].review_count == 1

            listado = AuditTicketListOut.model_validate(
                repo.listar_tickets_evaluados(
                    db,run_id,grupo_resolutor=grupo,
                    resultado="REVIEW",page=1,page_size=10,
                )
            )

            assert listado.total == 1
            assert len(listado.items) == 1
            assert listado.items[0].ticket_id == ticket.Ticket_ID
            assert listado.items[0].evidence_json["evaluacion_real"] is False

            print("Ejecución temporal:",run_id)
            print("Ticket evaluado:",ticket.Ticket_ID)
            print("Inserción de resultados: OK")
            print("Consulta de resultado: OK")
            print("KPIs:",resumen.review_count,resumen.review_percentage)
            print("Métricas por resolutor: OK")
            print("Listado de tickets: OK")
            print("Validación Pydantic: OK")

        finally:
            db.rollback()
            print("ROLLBACK ejecutado")

    if run_id is None:
        raise RuntimeError("No se creó una ejecución de prueba")

    with SQLServerSessionLocal() as db:
        ejecucion = repo.obtener_ejecucion(db,run_id)

        resultados = db.scalar(
            select(func.count())
            .select_from(RequirementCategorizationAuditResult)
            .where(RequirementCategorizationAuditResult.run_id == run_id)
        )

        assert ejecucion is None
        assert resultados == 0

        print("Verificación de reversión: OK")
        print("Registros permanentes de prueba: 0")

    print("Integración de escritura SQL Server: OK")


if __name__ == "__main__":
    ejecutar_prueba()
