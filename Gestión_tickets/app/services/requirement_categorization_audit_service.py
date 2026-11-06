
from __future__ import annotations
from collections.abc import Callable
from sqlalchemy import select
from sqlalchemy.orm import Session
from app.models.requirement_categorization_audit_model import RequirementCategorizationAuditRun
from app.repositories import requirement_categorization_audit_repository as repo

from app.services.categorization.audit_runner import AuditRunner
from app.services.categorization.semantic_engine import SemanticConfig

from app.schemas.requirement_categorization_audit_schema import (
    AuditCategoryListOut,
    AuditGroupResolutionReasonListOut,
    AuditResolverListOut,
    AuditRunCreate,
    AuditRunOut,
    AuditSummaryOut,
    AuditTicketFilters,
    AuditTicketListOut,
    AuditGroupCreate,
    AuditGroupOut,
    AuditGroupSummaryOut,
    AuditGroupTicketListOut,
    AuditGroupResolverListOut,
    AuditGroupMonthlyStatsOut,
    AuditDashboardFilters,
    AuditGroupFilterOptionsOut,
)



class AuditoriaNoEncontradaError(LookupError):
    pass


class AuditoriaEnCursoError(RuntimeError):
    pass



def _validar_ejecucion(
    db: Session,
    run_id: int,
    grupo_resolutor: str | None = None,
) -> RequirementCategorizationAuditRun:

    if run_id < 1:
        raise ValueError(
            "run_id debe ser mayor a cero"
        )

    ejecucion = repo.obtener_ejecucion(
        db,
        run_id,
    )

    if ejecucion is None:
        raise AuditoriaNoEncontradaError(
            f"No se encontró la auditoría {run_id}."
        )

    # El grupo solo se valida cuando se proporciona
    # expresamente en la solicitud.
    if grupo_resolutor is not None:

        grupo_solicitado = (
            repo.normalizar_grupo_resolutor(
                grupo_resolutor
            )
        )

        grupo_ejecucion = (
            repo.normalizar_grupo_resolutor(
                ejecucion.grupo_resolutor
            )
        )

        if grupo_solicitado != grupo_ejecucion:
            raise AuditoriaNoEncontradaError(
                f"La auditoría {run_id} no pertenece "
                f"al grupo resolutor {grupo_solicitado}."
            )

    return ejecucion




def _resolver_ejecucion(
    db: Session,
    run_id: int | None = None,
    grupo_resolutor: str | None = None,
) -> RequirementCategorizationAuditRun:

    # 1. Si existe run_id, identificar directamente
    # la auditoría correspondiente.
    if run_id is not None:

        return _validar_ejecucion(
            db,
            run_id,
            grupo_resolutor,
        )

    # 2. Si no existe run_id, consultar la última
    # auditoría completada del grupo solicitado.
    #
    # Se conserva el grupo predeterminado únicamente
    # para mantener compatibilidad con el frontend.

    grupo = repo.normalizar_grupo_resolutor(
        grupo_resolutor
    )

    ejecucion = repo.obtener_ultima_ejecucion(
        db,
        grupo,
        solo_completadas=True,
    )

    if ejecucion is None:
        raise AuditoriaNoEncontradaError(
            "No existe una auditoría completada para "
            f"el grupo resolutor {grupo}."
        )

    return ejecucion



def crear_ejecucion(
    db: Session,
    datos: AuditRunCreate,
) -> AuditRunOut:

    grupo = repo.normalizar_grupo_resolutor(
        datos.grupo_resolutor
    )

    try:

        # VALIDACIÓN DINÁMICA DEL GRUPO RESOLUTOR

        alcance, categorias = (
            repo.obtener_catalogo_ia_con_alcance(
                db,
                grupo_resolutor=grupo,
            )
        )

        if not categorias:
            raise ValueError(
                "No existen categorías autorizadas "
                f"para el grupo resolutor {grupo}."
            )

        # VALIDACIÓN DEL PERÍODO

        desde = datos.period_from
        hasta = datos.period_to

        if (desde is None) != (hasta is None):
            raise ValueError(
                "Debes indicar ambas fechas o ninguna."
            )

        if desde is not None and desde > hasta:
            raise ValueError(
                "La fecha inicial no puede superar la final."
            )

        group_id = datos.group_id

        # Buscar automáticamente la agrupación anual existente.
        # Así Angular puede seguir enviando las fechas sin group_id.
        if (
            group_id is None
            and desde is not None
            and hasta is not None
            and desde.year == hasta.year
        ):
            agrupacion = repo.obtener_grupo_por_anio(
                db,
                grupo,
                desde.year,
            )

            if agrupacion is not None:
                group_id = agrupacion.group_id

        # Validar la agrupación seleccionada.
        if group_id is not None:

            agrupacion = repo.obtener_grupo_bloqueado(
                db,
                group_id,
            )

            if agrupacion is None:
                raise AuditoriaNoEncontradaError(
                    f"No existe la agrupación {group_id}."
                )

            if (
                repo.normalizar_grupo_resolutor(
                    agrupacion.grupo_resolutor
                ) != grupo
            ):
                raise ValueError(
                    "La agrupación no corresponde al grupo resolutor."
                )

            if desde is None or hasta is None:
                raise ValueError(
                    "Una auditoría agrupada requiere un rango de fechas."
                )

            if (
                desde.year != agrupacion.audit_year
                or hasta.year != agrupacion.audit_year
            ):
                raise ValueError(
                    "El período debe pertenecer al año "
                    f"{agrupacion.audit_year}."
                )

        total = repo.contar_tickets_fuente(
            db,
            grupo,
            desde,
            hasta,
        )

        if total == 0:
            raise ValueError(
                "No se encontraron requerimientos para el período."
            )

        # Mantener una sola auditoría activa por grupo resolutor.
        R = RequirementCategorizationAuditRun

        activa = db.scalar(
            select(R.run_id)
            .where(
                R.grupo_resolutor == grupo,
                R.status.in_(("PENDING", "RUNNING")),
            )
            .order_by(R.run_id.desc())
            .limit(1)
        )

        if activa is not None:
            raise AuditoriaEnCursoError(
                f"Ya existe una auditoría activa: #{activa}."
            )

        # Se permiten períodos superpuestos para reauditorías.
        ejecucion = repo.crear_ejecucion(
            db,
            grupo_resolutor=grupo,
            group_id=group_id,
            period_from=desde,
            period_to=hasta,
            model_name=SemanticConfig().model_name,
        )

        db.commit()
        db.refresh(ejecucion)

        return AuditRunOut.model_validate(ejecucion)

    except Exception:
        db.rollback()
        raise

def ejecutar_auditoria(
    run_id: int,
    session_factory: Callable[[],Session] | None = None,
    batch_size: int = 100,
) -> dict:

    if run_id < 1:
        raise ValueError("run_id debe ser mayor a cero")

    if session_factory is None:
        from app.database.sqlserver import SQLServerSessionLocal
        session_factory = SQLServerSessionLocal

    runner = AuditRunner(
        session_factory=session_factory,
        batch_size=batch_size,
    )

    return runner.ejecutar(run_id)



def obtener_ejecucion(db: Session,run_id: int,grupo_resolutor: str | None = None) -> AuditRunOut:
    ejecucion = _validar_ejecucion(db,run_id,grupo_resolutor)
    return AuditRunOut.model_validate(ejecucion)


def listar_ejecuciones(db: Session,grupo_resolutor: str | None = None,limite: int = 50,offset: int = 0) -> list[AuditRunOut]:
    grupo = repo.normalizar_grupo_resolutor(grupo_resolutor)
    registros = repo.listar_ejecuciones(db,grupo,limite,offset)
    return [AuditRunOut.model_validate(registro) for registro in registros]


def obtener_resumen(db: Session,run_id: int | None = None,grupo_resolutor: str | None = None) -> AuditSummaryOut:
    ejecucion = _resolver_ejecucion(db,run_id,grupo_resolutor)
    datos = repo.obtener_resumen(db,ejecucion.run_id,ejecucion.grupo_resolutor)
    return AuditSummaryOut.model_validate(datos)


def obtener_tickets(db: Session,filtros: AuditTicketFilters) -> AuditTicketListOut:
    ejecucion = _resolver_ejecucion(db,filtros.run_id,filtros.grupo_resolutor)

    datos = repo.listar_tickets_evaluados(
        db,run_id=ejecucion.run_id,grupo_resolutor=ejecucion.grupo_resolutor,
        resultado=filtros.resultado,nombre_resolutor=filtros.nombre_resolutor,
        ticket_id=filtros.ticket_id,proyecto=filtros.proyecto,
        desde=filtros.desde,hasta=filtros.hasta,
        page=filtros.page,page_size=filtros.page_size,
    )

    return AuditTicketListOut.model_validate(datos)


def obtener_resolutores(db: Session,run_id: int | None = None,grupo_resolutor: str | None = None) -> AuditResolverListOut:
    ejecucion = _resolver_ejecucion(db,run_id,grupo_resolutor)
    datos = repo.listar_resolutores(db,ejecucion.run_id,ejecucion.grupo_resolutor)
    return AuditResolverListOut.model_validate(datos)


def obtener_categorias(db: Session,grupo_resolutor: str | None = None,limite: int = 200,offset: int = 0) -> AuditCategoryListOut:
    grupo = repo.normalizar_grupo_resolutor(grupo_resolutor)
    datos = repo.listar_catalogo(db,grupo,limite,offset)
    return AuditCategoryListOut.model_validate(datos)



# =========================================================
# SERVICIOS DE AGRUPACIONES
# =========================================================

def _validar_grupo(
    db: Session,
    group_id: int,
    grupo_resolutor: str | None = None,
):
    if group_id < 1:
        raise ValueError("group_id debe ser mayor a cero")

    grupo = repo.obtener_grupo(db, group_id)

    if grupo is None:
        raise AuditoriaNoEncontradaError(
            f"No existe la agrupación {group_id}"
        )

    if grupo_resolutor is not None:
        grupo_solicitado = repo.normalizar_grupo_resolutor(
            grupo_resolutor
        )

        if (
            repo.normalizar_grupo_resolutor(
                grupo.grupo_resolutor
            ) != grupo_solicitado
        ):
            raise AuditoriaNoEncontradaError(
                "La agrupación no corresponde al grupo resolutor solicitado."
            )

    return grupo


def crear_grupo(
    db: Session,
    datos: AuditGroupCreate,
) -> AuditGroupOut:

    grupo = repo.normalizar_grupo_resolutor(
        datos.grupo_resolutor
    )

    try:
        existente = repo.obtener_grupo_por_anio(
            db,
            grupo,
            datos.audit_year,
        )

        if existente is not None:
            raise ValueError(
                f"Ya existe la agrupación #{existente.group_id} "
                f"para {grupo}, año {datos.audit_year}."
            )

        registro = repo.crear_grupo(
            db,
            group_name=datos.group_name,
            grupo_resolutor=grupo,
            audit_year=datos.audit_year,
            description=datos.description,
        )

        db.commit()
        db.refresh(registro)

        return AuditGroupOut.model_validate(registro)

    except Exception:
        db.rollback()
        raise


def obtener_grupo(
    db: Session,
    group_id: int,
    grupo_resolutor: str | None = None,
) -> AuditGroupOut:

    grupo = _validar_grupo(
        db,
        group_id,
        grupo_resolutor,
    )

    return AuditGroupOut.model_validate(grupo)


def listar_grupos(
    db: Session,
    grupo_resolutor: str | None = None,
    limite: int = 50,
    offset: int = 0,
) -> list[AuditGroupOut]:

    registros = repo.listar_grupos(
        db,
        grupo_resolutor,
        limite,
        offset,
    )

    return [
        AuditGroupOut.model_validate(registro)
        for registro in registros
    ]


def listar_ejecuciones_grupo(
    db: Session,
    group_id: int,
    grupo_resolutor: str | None = None,
) -> list[AuditRunOut]:

    _validar_grupo(db, group_id, grupo_resolutor)

    registros = repo.listar_ejecuciones_grupo(
        db,
        group_id,
    )

    return [
        AuditRunOut.model_validate(registro)
        for registro in registros
    ]



def obtener_resumen_grupo(
    db: Session,
    group_id: int,
    grupo_resolutor: str | None = None,
    filtros: AuditDashboardFilters | None = None,
) -> AuditGroupSummaryOut:

    filtros = filtros or AuditDashboardFilters(
        grupo_resolutor=grupo_resolutor
    )

    _validar_grupo(db, group_id, filtros.grupo_resolutor)

    datos = repo.obtener_resumen_grupo(
        db,
        group_id,
        filtros=filtros,
    )

    return AuditGroupSummaryOut.model_validate(datos)


def obtener_tickets_grupo(
    db: Session,
    group_id: int,
    filtros: AuditTicketFilters,
) -> AuditGroupTicketListOut:

    _validar_grupo(
        db,
        group_id,
        filtros.grupo_resolutor,
    )

    if filtros.run_id is not None:
        raise ValueError(
            "Para consultar una ejecución individual "
            "utiliza el endpoint de tickets por run_id."
        )

    datos = repo.listar_tickets_grupo(
        db,
        group_id=group_id,
        page=filtros.page,
        page_size=filtros.page_size,
        filtros=filtros,
    )

    return AuditGroupTicketListOut.model_validate(datos)


def obtener_resolutores_grupo(
    db: Session,
    group_id: int,
    grupo_resolutor: str | None = None,
    mes: str | None = None,
    filtros: AuditDashboardFilters | None = None,
) -> AuditGroupResolverListOut:

    filtros = filtros or AuditDashboardFilters(
        grupo_resolutor=grupo_resolutor,
        mes=mes,
    )

    _validar_grupo(db, group_id, filtros.grupo_resolutor)

    datos = repo.listar_resolutores_grupo(
        db,
        group_id,
        filtros=filtros,
    )

    return AuditGroupResolverListOut.model_validate(datos)


def obtener_estadisticas_mensuales_grupo(
    db: Session,
    group_id: int,
    grupo_resolutor: str | None = None,
    filtros: AuditDashboardFilters | None = None,
) -> AuditGroupMonthlyStatsOut:

    filtros = filtros or AuditDashboardFilters(
        grupo_resolutor=grupo_resolutor
    )

    _validar_grupo(db, group_id, filtros.grupo_resolutor)

    datos = repo.obtener_estadisticas_mensuales_grupo(
        db,
        group_id,
        filtros=filtros,
    )

    return AuditGroupMonthlyStatsOut.model_validate(datos)


def obtener_distribucion_motivo_resolucion_grupo(
    db: Session,
    group_id: int,
    grupo_resolutor: str | None = None,
    mes: str | None = None,
    filtros: AuditDashboardFilters | None = None,
) -> AuditGroupResolutionReasonListOut:

    filtros = filtros or AuditDashboardFilters(
        grupo_resolutor=grupo_resolutor,
        mes=mes,
    )

    _validar_grupo(db, group_id, filtros.grupo_resolutor)

    datos = repo.obtener_distribucion_motivo_resolucion_grupo(
        db,
        group_id,
        filtros=filtros,
    )

    return AuditGroupResolutionReasonListOut.model_validate(datos)



def obtener_opciones_filtros_grupo(
    db: Session,
    group_id: int,
) -> AuditGroupFilterOptionsOut:

    _validar_grupo(db, group_id)

    datos = repo.obtener_opciones_filtros_grupo(
        db,
        group_id,
    )

    return AuditGroupFilterOptionsOut.model_validate(datos)


