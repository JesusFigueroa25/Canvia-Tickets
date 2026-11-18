
from __future__ import annotations
import logging
from collections import Counter
from dataclasses import dataclass
from datetime import datetime,timezone
from typing import Callable
from sqlalchemy import select, update
from sqlalchemy.orm import Session
from app.models.requirement_categorization_audit_model import (
    RequirementCategorizationAuditRun,
    RequirementCategoryCatalog,
)
from app.repositories import requirement_categorization_audit_repository as repo
from app.services.categorization.preprocessor import normalizar_texto,preparar_ticket
from app.services.categorization.semantic_engine import SemanticConfig,SemanticEngine
from app.services.categorization.category_scope import CategoryScope

logger = logging.getLogger(__name__)


def _ahora_utc() -> datetime:
    return datetime.now(timezone.utc).replace(tzinfo=None,microsecond=0)


@dataclass(frozen=True,slots=True)
class EstadoSolucion:
    ticket_lifecycle_status: str
    has_solution: bool
    solution_check_status: str
    solution_check_reason: str


def evaluar_estado_solucion(ticket: object) -> EstadoSolucion:
    estado = normalizar_texto(getattr(ticket,"Estado",None)).casefold()
    motivo = normalizar_texto(getattr(ticket,"Motivo_Estado",None)).casefold()
    fecha = getattr(ticket,"Fecha_Resolucion",None)
    solucion = normalizar_texto(getattr(ticket,"Solucion",None))
    tiene_solucion = bool(solucion)

    if fecha is not None:
        situacion = "RESOLVED" if estado in {"closed","resolved"} and motivo != "cancelled" else "UNCERTAIN"
    elif motivo == "cancelled" and estado == "closed":
        situacion = "CANCELLED"
    elif estado in {"active","queued","pending stop clock","pending continue clock"} and motivo != "pendiente cancelado":
        situacion = "OPEN"
    else:
        situacion = "UNCERTAIN"

    if tiene_solucion:
        verificacion = "PRESENT"
        razon = "El ticket tiene una solución registrada."
    elif situacion == "RESOLVED":
        verificacion = "MISSING_REQUIRED"
        razon = "El ticket registra fecha de resolución, pero carece de la solución obligatoria."
    elif situacion in {"CANCELLED","OPEN"}:
        verificacion = "OPTIONAL_MISSING"
        razon = "El ticket no está resuelto y la solución no es obligatoria en su situación actual."
    else:
        verificacion = "REVIEW_STATUS"
        razon = "El estado, motivo o fecha de resolución no permiten verificar la obligatoriedad de la solución."

    return EstadoSolucion(situacion,tiene_solucion,verificacion,razon)


class AuditRunner:

    def __init__(self,session_factory: Callable[[],Session],semantic_engine: SemanticEngine | None = None,batch_size: int = 100):
        if not callable(session_factory):
            raise TypeError("session_factory debe ser invocable")

        if not 1 <= batch_size <= 500:
            raise ValueError("batch_size debe estar entre 1 y 500")

        self.session_factory = session_factory
        self.batch_size = batch_size
        self._alcance: CategoryScope | None = None
        self._catalogo: list[dict] = []
        self._indices_originales: dict[tuple[str, str, str], int] = {}

        if semantic_engine is not None:
            self.semantic_engine = semantic_engine
        else:
            config = SemanticConfig(
                binary_mode=True,
                binary_threshold=0.35,
                binary_uncertainty_margin=0.07,
            )

            self.semantic_engine = SemanticEngine(config=config)


    def _iniciar(self,run_id: int) -> tuple[str,object,object]:
        with self.session_factory() as db:
            ejecucion = repo.obtener_ejecucion(db,run_id)
            if ejecucion is None:
                raise ValueError(f"Ejecución no encontrada: {run_id}")


            grupo = repo.normalizar_grupo_resolutor(
                ejecucion.grupo_resolutor
            )

            desde = ejecucion.period_from
            hasta = ejecucion.period_to

            if ejecucion.group_id is not None:

                agrupacion = repo.obtener_grupo(
                    db,
                    ejecucion.group_id,
                )

                if agrupacion is None:
                    raise RuntimeError(
                        f"No existe la agrupación {ejecucion.group_id}"
                    )

                if agrupacion.grupo_resolutor != grupo:
                    raise RuntimeError(
                        "La ejecución y la agrupación tienen "
                        "diferentes grupos resolutores."
                    )

                if desde is None or hasta is None:
                    raise RuntimeError(
                        "Una ejecución agrupada requiere ambas fechas."
                    )

                if (
                    desde > hasta
                    or desde.year != agrupacion.audit_year
                    or hasta.year != agrupacion.audit_year
                ):
                    raise RuntimeError(
                        "El rango de fechas no corresponde "
                        "al año de la agrupación."
                    )

            total = repo.contar_tickets_fuente(
                db,
                grupo,
                desde,
                hasta,
            )


            sentencia = (
                update(RequirementCategorizationAuditRun)
                .where(RequirementCategorizationAuditRun.run_id == run_id,RequirementCategorizationAuditRun.status == "PENDING")
                .values(status="RUNNING",started_at=_ahora_utc(),total_tickets=total)
            )

            if db.execute(sentencia).rowcount != 1:
                db.rollback()
                raise ValueError("La ejecución ya fue iniciada o no está pendiente")

            db.commit()
            return grupo,desde,hasta



    def _cargar_catalogo(self, grupo: str) -> list[dict]:
        """
        Carga dinámicamente las categorías autorizadas para
        el grupo resolutor seleccionado.

        Conserva:
        - El alcance del grupo.
        - Las rutas candidatas para MiniLM.
        - El índice global de categorías originales.

        Solo realiza consultas de lectura.
        """

        with self.session_factory() as db:

            # 1. Resolver la familia y obtener las categorías
            # permitidas desde el catálogo ServiceAIDE.

            alcance, categorias = (
                repo.obtener_catalogo_ia_con_alcance(
                    db,
                    grupo_resolutor=grupo,
                )
            )

            # 2. Preparar las rutas candidatas para MiniLM.

            rutas = [
                {
                    "catalog_id": categoria.catalog_id,
                    "level_1": categoria.level_1,
                    "level_2": categoria.level_2,
                    "level_3": categoria.level_3,
                    "description": categoria.description,
                    "examples": categoria.examples,
                }
                for categoria in categorias
            ]

            if not rutas:
                raise RuntimeError(
                    f"No existen rutas elegibles para {grupo}"
                )

            # 3. Obtener los IDs de todas las categorías
            # originales, incluidas las que están fuera
            # del alcance del grupo.

            C = RequirementCategoryCatalog

            consulta = select(
                C.catalog_id,
                C.level_1,
                C.level_2,
                C.level_3,
            )

            registros = db.execute(consulta).all()

            indices_originales = {
                self._clave(nivel_1, nivel_2, nivel_3): catalog_id
                for catalog_id, nivel_1, nivel_2, nivel_3
                in registros
            }

        # 4. Guardar el contexto de la auditoría.

        self._alcance = alcance
        self._indices_originales = indices_originales

        logger.info(
            "Catálogo dinámico cargado: "
            "grupo=%s, familia=%s, coincidencia=%s, "
            "rutas_elegibles=%s, indices_originales=%s",
            grupo,
            alcance.familia_catalogo,
            alcance.tipo_coincidencia,
            len(rutas),
            len(indices_originales),
        )

        return rutas



    @staticmethod
    def _clave(nivel_1: str | None,nivel_2: str | None,nivel_3: str | None) -> tuple[str,str,str]:
        return tuple(" ".join(normalizar_texto(nivel).split()).casefold() for nivel in (nivel_1,nivel_2,nivel_3))

    def _evaluar_lote(
        self,
        tickets: list,
        run_id: int,
        indices: dict,
    ) -> list[dict]:

        if self._alcance is None:
            raise RuntimeError(
                "No se ha cargado el alcance dinámico de la auditoría."
            )

        registros = []

        for ticket in tickets:
            try:
                preparado = preparar_ticket(ticket)
                
                resultado = self.semantic_engine.evaluar(
                    ticket=preparado,
                    catalogo=self._catalogo,
                    grupo_resolutor=ticket.Grupo_Resolutor,
                    alcance=self._alcance,
                )
                situacion = evaluar_estado_solucion(ticket)
            except Exception as exc:
                raise RuntimeError(f"No se pudo evaluar el ticket {ticket.Ticket_ID}") from exc


            if resultado.result_status not in {"CORRECT","INCORRECT"}:
                raise RuntimeError(
                    f"Estado de categorizacion no permitido para {ticket.Ticket_ID}: {resultado.result_status}"
                )

            registros.append({
                "run_id":run_id,
                "ticket_id":ticket.Ticket_ID,
                "grupo_resolutor":ticket.Grupo_Resolutor,
                "resolver_name":ticket.Nombre_Resolutor,
                "project_name":ticket.Proyecto,
                "source_opened_at":ticket.Fecha_Apertura,
                "source_status":ticket.Estado,
                "source_last_modified_at":ticket.Fecha_Ultima_Modificacion,
                "original_level_1":ticket.Categorizacion_Nivel_1,
                "original_level_2":ticket.Categorizacion_Nivel_2,
                "original_level_3":ticket.Categorizacion_Nivel_3,
                "original_catalog_id":indices.get(self._clave(ticket.Categorizacion_Nivel_1,ticket.Categorizacion_Nivel_2,ticket.Categorizacion_Nivel_3)),
                "suggested_catalog_id":resultado.suggested_catalog_id,
                "result_status":resultado.result_status,
                "reason_code":resultado.reason_code,
                "reason_text":resultado.reason_text,
                "evidence_json":resultado.evidence_json,
                "semantic_score":resultado.semantic_score,
                "source_hash":preparado.source_hash,
                "source_status_reason":ticket.Motivo_Estado,
                "source_resolved_at":ticket.Fecha_Resolucion,
                "ticket_lifecycle_status":situacion.ticket_lifecycle_status,
                "has_solution":situacion.has_solution,
                "solution_check_status":situacion.solution_check_status,
                "solution_check_reason":situacion.solution_check_reason,
            })

        return registros



    def _guardar_lote(
        self,
        run_id: int,
        registros: list[dict],
    ) -> None:

        if not registros:
            return

        conteos = Counter(
            registro["result_status"]
            for registro in registros
        )

        with self.session_factory() as db:

            ejecucion = repo.obtener_ejecucion(
                db,
                run_id,
            )

            if ejecucion is None or ejecucion.status != "RUNNING":
                raise RuntimeError(
                    "La ejecución no está activa."
                )

            # Validar grupo y período.
            if ejecucion.group_id is not None:

                grupo = repo.normalizar_grupo_resolutor(
                    ejecucion.grupo_resolutor
                )

                desde = ejecucion.period_from
                hasta = ejecucion.period_to

                if desde is None or hasta is None:
                    raise RuntimeError(
                        "La auditoría agrupada requiere ambas fechas."
                    )

                for registro in registros:

                    grupo_ticket = repo.normalizar_grupo_resolutor(
                        registro["grupo_resolutor"]
                    )

                    if grupo_ticket != grupo:
                        raise RuntimeError(
                            f"El ticket {registro['ticket_id']} "
                            "no pertenece al grupo resolutor."
                        )

                    fecha = registro["source_opened_at"]

                    fecha_ticket = (
                        fecha.date()
                        if isinstance(fecha, datetime)
                        else fecha
                    )

                    if not desde <= fecha_ticket <= hasta:
                        raise RuntimeError(
                            f"El ticket {registro['ticket_id']} "
                            "está fuera del período de auditoría."
                        )

            # Insertar los resultados en la ejecución actual.
            # Los resultados anteriores se conservan como historial.
            insertados = repo.guardar_resultados_lote(
                db,
                run_id,
                registros,
            )

            repo.actualizar_ejecucion(
                db,
                run_id,
                processed_tickets=(
                    ejecucion.processed_tickets + insertados
                ),
                correct_count=(
                    ejecucion.correct_count + conteos["CORRECT"]
                ),
                incorrect_count=(
                    ejecucion.incorrect_count + conteos["INCORRECT"]
                ),
                review_count=(
                    ejecucion.review_count + conteos["REVIEW"]
                ),
            )

            db.commit()




    def _finalizar(self,run_id: int) -> dict:
        with self.session_factory() as db:
            ejecucion = repo.obtener_ejecucion(db,run_id)

            if ejecucion is None:
                raise ValueError(f"Ejecución no encontrada: {run_id}")

            completo = ejecucion.processed_tickets == ejecucion.total_tickets
            estado = "COMPLETED" if completo else "PARTIAL"
            cambios = {"status":estado,"finished_at":_ahora_utc()}

            if not completo:
                cambios["error_message"] = "El total procesado no coincide con el total inicial; comprobar modificaciones de la fuente."

            repo.actualizar_ejecucion(db,run_id,**cambios)

            resumen = {
                "run_id":run_id,
                "status":estado,
                "total_tickets":ejecucion.total_tickets,
                "processed_tickets":ejecucion.processed_tickets,
            }

            db.commit()
            return resumen

    def _registrar_fallo(self,run_id: int) -> None:
        try:
            with self.session_factory() as db:
                ejecucion = repo.obtener_ejecucion(db,run_id)

                if ejecucion is not None and ejecucion.status == "RUNNING":
                    repo.actualizar_ejecucion(
                        db,run_id,
                        status="PARTIAL" if ejecucion.processed_tickets else "FAILED",
                        finished_at=_ahora_utc(),
                        error_count=ejecucion.error_count+1,
                        error_message="Error técnico en el procesamiento. Revisar los registros del backend.",
                    )
                    db.commit()

        except Exception:
            logger.exception("No fue posible registrar el fallo de la ejecución %s",run_id)

    def ejecutar(self,run_id: int) -> dict:
        grupo,desde,hasta = self._iniciar(run_id)

        try:
            catalogo = self._cargar_catalogo(grupo)

            if not catalogo:
                raise RuntimeError("No hay rutas de categorización disponibles para el grupo")

            self._catalogo = catalogo
            self.semantic_engine.preparar_catalogo(catalogo)


            indices = self._indices_originales

            with self.session_factory() as db:
                repo.actualizar_ejecucion(
                    db,run_id,
                    model_name=self.semantic_engine.config.model_name,
                    catalog_snapshot_hash=self.semantic_engine.catalog_hash,
                    engine_version="2.3.2-dba-hybrid-candidates",
                )
                db.commit()

            cursor = None

            while True:
                with self.session_factory() as db:
                    tickets = repo.obtener_tickets_lote(db,grupo,desde,hasta,cursor,self.batch_size)
                    db.expunge_all()

                if not tickets:
                    break

                registros = self._evaluar_lote(tickets,run_id,indices)
                self._guardar_lote(run_id,registros)
                cursor = tickets[-1].Ticket_ID

            return self._finalizar(run_id)

        except Exception:
            logger.exception("Error durante la auditoría %s",run_id)
            self._registrar_fallo(run_id)
            raise



