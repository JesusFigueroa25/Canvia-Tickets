
from __future__ import annotations
import json
from datetime import date, timedelta
from sqlalchemy import and_, case, func, insert, or_, select
from sqlalchemy.orm import Session, aliased
from app.services.categorization.category_scope import (
    CategoryScope,
    obtener_alcance,
    normalizar_valor,
)
from app.schemas.requirement_categorization_audit_schema import AuditDashboardFilters
from app.models.requirement_consolidated_model import RequirementConsolidated
from app.models.requirement_categorization_audit_model import (
    RequirementCategoryCatalog,
    RequirementCategorizationAuditGroup,
    RequirementCategorizationAuditRun,
    RequirementCategorizationAuditResult,
)

GRUPO_PREDETERMINADO = "BASE DE DATOS Y EBS"


def normalizar_grupo_resolutor(
    grupo_resolutor: str | None = None,
) -> str:
    """
    Normaliza el grupo resolutor sin restringirlo
    a un grupo específico.

    Mantiene BASE DE DATOS Y EBS como valor
    predeterminado para compatibilidad con el sistema.
    """

    valor = (
        GRUPO_PREDETERMINADO
        if grupo_resolutor is None
        else grupo_resolutor
    )

    grupo = " ".join(str(valor).split()).upper()

    if not grupo:
        raise ValueError(
            "El grupo resolutor no puede estar vacío."
        )

    if len(grupo) > 150:
        raise ValueError(
            "El grupo resolutor supera los 150 caracteres."
        )

    return grupo


def _filtrar_periodo(consulta,columna,desde: date | None = None,hasta: date | None = None):
    if desde and hasta and desde > hasta:
        raise ValueError("La fecha inicial no puede ser posterior a la final")
    if desde:
        consulta = consulta.where(columna >= desde)
    if hasta:
        consulta = consulta.where(columna < hasta + timedelta(days=1))
    return consulta


def _filtrar_fuente(consulta,grupo_resolutor: str | None = None,desde: date | None = None,hasta: date | None = None):
    grupo = normalizar_grupo_resolutor(grupo_resolutor)
    consulta = consulta.where(func.upper(func.trim(RequirementConsolidated.Grupo_Resolutor)) == grupo)
    return _filtrar_periodo(consulta,RequirementConsolidated.Fecha_Apertura,desde,hasta)


def contar_tickets_fuente(db: Session,grupo_resolutor: str | None = None,desde: date | None = None,hasta: date | None = None) -> int:
    consulta = select(func.count()).select_from(RequirementConsolidated)
    consulta = _filtrar_fuente(consulta,grupo_resolutor,desde,hasta)
    return int(db.scalar(consulta) or 0)


def obtener_tickets_lote(db: Session,grupo_resolutor: str | None = None,desde: date | None = None,hasta: date | None = None,ultimo_ticket_id: str | None = None,limite: int = 100) -> list[RequirementConsolidated]:
    if not 1 <= limite <= 500:
        raise ValueError("limite debe estar entre 1 y 500")

    consulta = select(RequirementConsolidated)
    consulta = _filtrar_fuente(consulta,grupo_resolutor,desde,hasta)

    if ultimo_ticket_id:
        consulta = consulta.where(RequirementConsolidated.Ticket_ID > ultimo_ticket_id)

    consulta = consulta.order_by(RequirementConsolidated.Ticket_ID.asc()).limit(limite)
    return list(db.scalars(consulta).all())


def obtener_ticket_fuente(db: Session,ticket_id: str,grupo_resolutor: str | None = None) -> RequirementConsolidated | None:
    consulta = select(RequirementConsolidated).where(RequirementConsolidated.Ticket_ID == ticket_id)
    consulta = _filtrar_fuente(consulta,grupo_resolutor)
    return db.scalar(consulta)


def sincronizar_catalogo_desde_tickets(db: Session,grupo_resolutor: str | None = None) -> dict[str,int]:
    R = RequirementConsolidated

    n1 = func.trim(R.Categorizacion_Nivel_1)
    n2 = func.trim(R.Categorizacion_Nivel_2)
    n3 = func.trim(R.Categorizacion_Nivel_3)

    consulta = select(
        n1.label("level_1"),
        n2.label("level_2"),
        n3.label("level_3"),
        func.min(R.Fecha_Apertura).label("primera"),
        func.max(R.Fecha_Apertura).label("ultima"),
    )

    consulta = _filtrar_fuente(consulta,grupo_resolutor)
    consulta = consulta.where(
        func.nullif(n1,"").is_not(None),
        func.nullif(n2,"").is_not(None),
        func.nullif(n3,"").is_not(None),
    )
    consulta = consulta.group_by(n1,n2,n3)

    rutas = db.execute(consulta).mappings().all()
    catalogo = RequirementCategoryCatalog
    existentes = db.scalars(select(catalogo)).all()

    por_ruta = {
        (x.level_1.strip().casefold(),x.level_2.strip().casefold(),x.level_3.strip().casefold()):x
        for x in existentes
    }

    creadas = 0
    actualizadas = 0

    for ruta in rutas:
        clave = (ruta["level_1"],ruta["level_2"],ruta["level_3"])
        clave_normalizada = tuple(valor.casefold() for valor in clave)
        registro = por_ruta.get(clave_normalizada)

        if registro is None:
            registro = catalogo(
                level_1=clave[0],
                level_2=clave[1],
                level_3=clave[2],
                catalog_source="SQL_SERVER",
                validation_status="OBSERVED",
                first_observed_at=ruta["primera"],
                last_observed_at=ruta["ultima"],
            )
            db.add(registro)
            por_ruta[clave_normalizada] = registro
            creadas += 1

        else:
            primera = min(x for x in (registro.first_observed_at,ruta["primera"]) if x is not None)
            ultima = max(x for x in (registro.last_observed_at,ruta["ultima"]) if x is not None)

            if primera != registro.first_observed_at or ultima != registro.last_observed_at:
                registro.first_observed_at = primera
                registro.last_observed_at = ultima
                registro.updated_at = func.sysutcdatetime()
                actualizadas += 1

    db.flush()

    return {
        "creadas":creadas,
        "actualizadas":actualizadas,
        "total_observadas":len(rutas),
    }


def obtener_categoria_por_ruta(db: Session,level_1: str,level_2: str,level_3: str) -> RequirementCategoryCatalog | None:
    C = RequirementCategoryCatalog
    consulta = select(C).where(
        C.level_1 == level_1.strip(),
        C.level_2 == level_2.strip(),
        C.level_3 == level_3.strip(),
    )
    return db.scalar(consulta)


def listar_catalogo(db: Session,grupo_resolutor: str | None = None,limite: int = 200,offset: int = 0) -> dict:
    grupo = normalizar_grupo_resolutor(grupo_resolutor)

    if not 1 <= limite <= 1000 or offset < 0:
        raise ValueError("Paginación de catálogo inválida")

    C = RequirementCategoryCatalog
    R = RequirementConsolidated

    coincide = (
        select(R.Ticket_ID)
        .where(
            func.upper(func.trim(R.Grupo_Resolutor)) == grupo,
            func.trim(R.Categorizacion_Nivel_1) == C.level_1,
            func.trim(R.Categorizacion_Nivel_2) == C.level_2,
            func.trim(R.Categorizacion_Nivel_3) == C.level_3,
        )
        .correlate(C)
        .exists()
    )

    consulta = select(C).where(coincide)
    total = db.scalar(select(func.count()).select_from(C).where(coincide)) or 0

    items = db.scalars(
        consulta.order_by(C.level_1,C.level_2,C.level_3)
        .offset(offset)
        .limit(limite)
    ).all()

    return {"total":int(total),"items":list(items)}




# ==========================================================
# CATÁLOGO DINÁMICO PARA AUDITORÍA CON MINILM
# ==========================================================

def obtener_catalogo_ia_con_alcance(
    db: Session,
    grupo_resolutor: str | None = None,
) -> tuple[CategoryScope, list[RequirementCategoryCatalog]]:
    """
    Resuelve dinámicamente la relación entre el grupo
    resolutor y las categorías de nivel 1 de ServiceAIDE.

    No contiene familias específicas hardcodeadas.

    Devuelve:
        - Alcance calculado para el grupo.
        - Rutas elegibles para MiniLM.

    No realiza escrituras en SQL Server.
    """

    # ======================================================
    # 1. NORMALIZAR GRUPO RESOLUTOR
    # ======================================================

    grupo = normalizar_grupo_resolutor(
        grupo_resolutor
    )

    C = RequirementCategoryCatalog

    # ======================================================
    # 2. OBTENER CATEGORÍAS OFICIALES E HISTÓRICAS
    # ======================================================
    #
    # Familias de servicio:
    #   SERVICE_AIDE / VALIDATED
    #
    # Actividades Genéricas históricas:
    #   SQL_SERVER / OBSERVED
    #
    # Las categorías históricas de otras familias
    # no se consideran automáticamente autorizadas.
    # ======================================================

    oficiales = and_(
        C.catalog_source == "SERVICE_AIDE",
        C.validation_status == "VALIDATED",
    )

    genericas_historicas = and_(
        C.level_1 == "Actividades Genericas",
        C.catalog_source == "SQL_SERVER",
        C.validation_status == "OBSERVED",
    )

    consulta = (
        select(C)
        .where(
            or_(
                oficiales,
                genericas_historicas,
            )
        )
        .order_by(
            C.level_1.asc(),
            C.level_2.asc(),
            C.level_3.asc(),
            C.catalog_id.asc(),
        )
    )

    catalogo_disponible = list(
        db.scalars(consulta).all()
    )

    if not catalogo_disponible:
        raise RuntimeError(
            "No existen categorías oficiales disponibles "
            "para construir el alcance de auditoría."
        )

    # ======================================================
    # 3. DESCUBRIR NIVELES 1 DISPONIBLES
    # ======================================================

    niveles_1 = {
        categoria.level_1
        for categoria in catalogo_disponible
        if categoria.level_1
    }

    # ======================================================
    # 4. RESOLVER ALCANCE DINÁMICAMENTE
    # ======================================================

    alcance = obtener_alcance(
        grupo_resolutor=grupo,
        categorias_nivel_1=niveles_1,
    )

    # ======================================================
    # 5. IDENTIFICAR CATEGORÍAS PERMITIDAS
    # ======================================================

    claves_permitidas = {
        normalizar_valor(categoria)
        for categoria in alcance.niveles_1_permitidos
    }

    # ======================================================
    # 6. FILTRAR LAS RUTAS DEL CATÁLOGO
    # ======================================================

    rutas_elegibles = [
        categoria
        for categoria in catalogo_disponible
        if normalizar_valor(categoria.level_1)
        in claves_permitidas
    ]

    if not rutas_elegibles:
        raise RuntimeError(
            "No se encontraron rutas elegibles para "
            f"el grupo resolutor: {grupo}"
        )

    return alcance, rutas_elegibles


def listar_catalogo_para_ia(
    db: Session,
    grupo_resolutor: str | None = None,
) -> list[RequirementCategoryCatalog]:
    """
    Mantiene la interfaz de lectura existente.

    Obtiene exclusivamente las rutas elegibles
    para el grupo resolutor seleccionado.
    """

    _, rutas = obtener_catalogo_ia_con_alcance(
        db,
        grupo_resolutor,
    )

    return rutas




def crear_ejecucion(
    db: Session,
    grupo_resolutor: str | None = None,
    period_from: date | None = None,
    period_to: date | None = None,
    model_name: str | None = None,
    model_version: str | None = None,
    engine_version: str | None = None,
    catalog_snapshot_hash: str | None = None,
    group_id: int | None = None,
) -> RequirementCategorizationAuditRun:

    if period_from and period_to and period_from > period_to:
        raise ValueError(
            "period_from no puede ser posterior a period_to"
        )

    grupo = normalizar_grupo_resolutor(grupo_resolutor)

    ejecucion = RequirementCategorizationAuditRun(
        group_id=group_id,
        grupo_resolutor=grupo,
        period_from=period_from,
        period_to=period_to,
        model_name=model_name,
        model_version=model_version,
        engine_version=engine_version,
        catalog_snapshot_hash=catalog_snapshot_hash,
        status="PENDING",
    )

    db.add(ejecucion)
    db.flush()

    return ejecucion



def obtener_ejecucion(db: Session,run_id: int) -> RequirementCategorizationAuditRun | None:
    return db.get(RequirementCategorizationAuditRun,run_id)


def obtener_ultima_ejecucion(db: Session,grupo_resolutor: str | None = None,solo_completadas: bool = True) -> RequirementCategorizationAuditRun | None:
    grupo = normalizar_grupo_resolutor(grupo_resolutor)
    R = RequirementCategorizationAuditRun
    consulta = select(R).where(R.grupo_resolutor == grupo)

    if solo_completadas:
        consulta = consulta.where(R.status == "COMPLETED")

    return db.scalar(consulta.order_by(R.run_id.desc()).limit(1))


def listar_ejecuciones(db: Session,grupo_resolutor: str | None = None,limite: int = 50,offset: int = 0) -> list[RequirementCategorizationAuditRun]:
    grupo = normalizar_grupo_resolutor(grupo_resolutor)

    if not 1 <= limite <= 200 or offset < 0:
        raise ValueError("Paginación de ejecuciones inválida")

    R = RequirementCategorizationAuditRun
    consulta = select(R).where(R.grupo_resolutor == grupo).order_by(R.run_id.desc()).offset(offset).limit(limite)

    return list(db.scalars(consulta).all())


def actualizar_ejecucion(db: Session,run_id: int,**cambios) -> RequirementCategorizationAuditRun:
    permitidos = {
        "status","model_name","model_version","engine_version","catalog_snapshot_hash",
        "total_tickets","processed_tickets","correct_count","incorrect_count",
        "review_count","error_count","started_at","finished_at","error_message",
    }

    desconocidos = set(cambios) - permitidos

    if desconocidos:
        raise ValueError(f"Campos no permitidos: {sorted(desconocidos)}")

    ejecucion = obtener_ejecucion(db,run_id)

    if ejecucion is None:
        raise ValueError(f"Ejecución no encontrada: {run_id}")

    for nombre,valor in cambios.items():
        setattr(ejecucion,nombre,valor)

    db.flush()
    return ejecucion


def guardar_resultados_lote(db: Session,run_id: int,registros: list[dict]) -> int:
    if not registros:
        return 0

    ejecucion = obtener_ejecucion(db,run_id)

    if ejecucion is None:
        raise ValueError(f"Ejecución no encontrada: {run_id}")

    modelo = RequirementCategorizationAuditResult
    columnas = {col.name for col in modelo.__table__.columns} - {"result_id","evaluated_at"}
    obligatorios = {"ticket_id","grupo_resolutor","source_opened_at","result_status","reason_code","reason_text","source_hash"}
    valores = []

    for registro in registros:
        desconocidos = set(registro) - columnas - {"run_id"}

        if desconocidos:
            raise ValueError(f"Columnas de resultado desconocidas: {sorted(desconocidos)}")

        faltantes = {nombre for nombre in obligatorios if registro.get(nombre) is None}

        if faltantes:
            raise ValueError(f"Columnas obligatorias sin valor: {sorted(faltantes)}")

        if registro["result_status"] not in {"CORRECT","INCORRECT"}:
            raise ValueError(
                "Estado de categorizacion invalido: "
                f"{registro['result_status']}. "
                "Solo se permiten CORRECT e INCORRECT."
            )


        if registro.get("run_id",run_id) != run_id:
            raise ValueError("Un registro pertenece a otra ejecución")

        if normalizar_grupo_resolutor(registro["grupo_resolutor"]) != ejecucion.grupo_resolutor:
            raise ValueError("El ticket pertenece a otro grupo resolutor")

        fila = {nombre:registro.get(nombre) for nombre in columnas}
        fila["run_id"] = run_id
        evidencia = fila.get("evidence_json")

        if isinstance(evidencia,dict):
            fila["evidence_json"] = json.dumps(evidencia,ensure_ascii=False)

        valores.append(fila)

    db.execute(insert(modelo),valores)
    db.flush()

    return len(valores)


def obtener_resultado(db: Session,run_id: int,ticket_id: str) -> RequirementCategorizationAuditResult | None:
    R = RequirementCategorizationAuditResult
    consulta = select(R).where(R.run_id == run_id,R.ticket_id == ticket_id)
    return db.scalar(consulta)


def _validar_run_grupo(db: Session,run_id: int,grupo_resolutor: str | None = None) -> RequirementCategorizationAuditRun:
    grupo = normalizar_grupo_resolutor(grupo_resolutor)
    ejecucion = obtener_ejecucion(db,run_id)

    if ejecucion is None:
        raise ValueError(f"Ejecución no encontrada: {run_id}")

    if ejecucion.grupo_resolutor != grupo:
        raise ValueError("La ejecución no corresponde al grupo resolutor solicitado")

    return ejecucion


def _filtrar_resultados(consulta,run_id: int,resultado: str | None = None,nombre_resolutor: str | None = None,ticket_id: str | None = None,proyecto: str | None = None,desde: date | None = None,hasta: date | None = None):
    R = RequirementCategorizationAuditResult
    consulta = consulta.where(R.run_id == run_id)

    if resultado is not None:
        if resultado not in {"CORRECT","INCORRECT"}:
            raise ValueError("Estado de categorización inválido")
        consulta = consulta.where(R.result_status == resultado)

    if nombre_resolutor:
        consulta = consulta.where(func.trim(R.resolver_name) == nombre_resolutor.strip())

    if ticket_id:
        consulta = consulta.where(R.ticket_id == ticket_id.strip())

    if proyecto:
        consulta = consulta.where(func.trim(R.project_name) == proyecto.strip())

    return _filtrar_periodo(consulta,R.source_opened_at,desde,hasta)


def listar_tickets_evaluados(db: Session,run_id: int,grupo_resolutor: str | None = None,resultado: str | None = None,nombre_resolutor: str | None = None,ticket_id: str | None = None,proyecto: str | None = None,desde: date | None = None,hasta: date | None = None,page: int = 1,page_size: int = 25) -> dict:
    _validar_run_grupo(db,run_id,grupo_resolutor)

    if page < 1 or not 1 <= page_size <= 200:
        raise ValueError("Paginación de tickets inválida")

    A = RequirementCategorizationAuditResult
    R = RequirementConsolidated
    C = aliased(RequirementCategoryCatalog)

    conteo = select(func.count()).select_from(A)
    conteo = _filtrar_resultados(conteo,run_id,resultado,nombre_resolutor,ticket_id,proyecto,desde,hasta)
    total = int(db.scalar(conteo) or 0)

    columnas = [getattr(A,c.name).label(c.name) for c in A.__table__.columns]

    consulta = select(
        *columnas,
        R.Descripcion.label("descripcion"),
        R.Detalle.label("detalle"),
        R.Solucion.label("solucion"),
        C.level_1.label("suggested_level_1"),
        C.level_2.label("suggested_level_2"),
        C.level_3.label("suggested_level_3"),
    )

    consulta = (
        consulta.select_from(A)
        .outerjoin(R,R.Ticket_ID == A.ticket_id)
        .outerjoin(C,C.catalog_id == A.suggested_catalog_id)
    )

    consulta = _filtrar_resultados(consulta,run_id,resultado,nombre_resolutor,ticket_id,proyecto,desde,hasta)
    consulta = consulta.order_by(A.source_opened_at.desc(),A.ticket_id.desc()).offset((page-1)*page_size).limit(page_size)

    items = [dict(fila) for fila in db.execute(consulta).mappings().all()]

    return {
        "run_id":run_id,
        "grupo_resolutor":normalizar_grupo_resolutor(grupo_resolutor),
        "total":total,
        "page":page,
        "page_size":page_size,
        "items":items,
    }


def obtener_resumen(
    db: Session,
    run_id: int,
    grupo_resolutor: str | None = None,
) -> dict:
    ejecucion = _validar_run_grupo(
        db,
        run_id,
        grupo_resolutor,
    )

    R = RequirementCategorizationAuditResult

    def contar_si(condicion):
        return func.coalesce(
            func.sum(
                case((condicion,1),else_=0)
            ),
            0,
        )

    consulta = select(
        func.count().label("evaluados"),

        contar_si(
            R.result_status == "CORRECT"
        ).label("correctos"),

        contar_si(
            R.result_status == "INCORRECT"
        ).label("incorrectos"),

        contar_si(
            R.solution_check_status == "MISSING_REQUIRED"
        ).label("sin_solucion_obligatoria"),

        contar_si(
            R.solution_check_status == "OPTIONAL_MISSING"
        ).label("sin_solucion_opcional"),

        contar_si(
            R.solution_check_status == "REVIEW_STATUS"
        ).label("solucion_revision"),

    ).where(R.run_id == run_id)

    fila = db.execute(consulta).mappings().one()

    total = int(fila["evaluados"])
    correctos = int(fila["correctos"])
    incorrectos = int(fila["incorrectos"])

    def porcentaje(cantidad):
        return (
            round(100 * int(cantidad) / total,2)
            if total
            else 0.0
        )

    return {
        "run_id":run_id,
        "grupo_resolutor":ejecucion.grupo_resolutor,
        "run_status":ejecucion.status,

        "total_tickets":ejecucion.total_tickets,
        "processed_tickets":total,

        "correct_count":correctos,
        "incorrect_count":incorrectos,

        "error_count":ejecucion.error_count,

        "correct_percentage":porcentaje(correctos),
        "incorrect_percentage":porcentaje(incorrectos),

        "missing_required_solution_count":int(
            fila["sin_solucion_obligatoria"]
        ),

        "optional_missing_solution_count":int(
            fila["sin_solucion_opcional"]
        ),

        "review_solution_status_count":int(
            fila["solucion_revision"]
        ),
    }



def listar_resolutores(
    db: Session,
    run_id: int,
    grupo_resolutor: str | None = None,
) -> dict:
    ejecucion = _validar_run_grupo(
        db,
        run_id,
        grupo_resolutor,
    )

    R = RequirementCategorizationAuditResult

    def contar_si(condicion):
        return func.coalesce(
            func.sum(
                case((condicion,1),else_=0)
            ),
            0,
        )

    consulta = (
        select(
            R.resolver_name.label("resolver_name"),

            func.count().label("total_tickets"),

            contar_si(
                R.result_status == "CORRECT"
            ).label("correct_count"),

            contar_si(
                R.result_status == "INCORRECT"
            ).label("incorrect_count"),

            contar_si(
                R.solution_check_status == "MISSING_REQUIRED"
            ).label("missing_required_solution_count"),
        )
        .where(R.run_id == run_id)
        .group_by(R.resolver_name)
        .order_by(
            func.count().desc(),
            R.resolver_name,
        )
    )

    items = []

    for fila in db.execute(consulta).mappings():
        registro = dict(fila)

        total = int(registro["total_tickets"])

        correctos = int(registro["correct_count"])
        incorrectos = int(registro["incorrect_count"])

        registro["correct_percentage"] = (
            round(100 * correctos / total,2)
            if total
            else 0.0
        )

        registro["incorrect_percentage"] = (
            round(100 * incorrectos / total,2)
            if total
            else 0.0
        )

        items.append(registro)

    return {
        "run_id":run_id,
        "grupo_resolutor":ejecucion.grupo_resolutor,
        "total":len(items),
        "items":items,
    }


# =========================================================
# AGRUPACIONES DE AUDITORÍAS
# =========================================================

def obtener_grupo(
    db: Session,
    group_id: int,
) -> RequirementCategorizationAuditGroup | None:

    return db.get(
        RequirementCategorizationAuditGroup,
        group_id,
    )


def obtener_grupo_bloqueado(
    db: Session,
    group_id: int,
) -> RequirementCategorizationAuditGroup | None:
    """
    Bloquea la agrupación durante la validación y
    creación de una nueva ejecución en SQL Server.
    La transacción debe mantenerse hasta el commit.
    """
    G = RequirementCategorizationAuditGroup

    consulta = (
        select(G)
        .where(G.group_id == group_id)
        .with_hint(
            G,
            "WITH (UPDLOCK, HOLDLOCK)",
            dialect_name="mssql",
        )
    )

    return db.scalar(consulta)


def obtener_grupo_por_anio(
    db: Session,
    grupo_resolutor: str,
    audit_year: int,
) -> RequirementCategorizationAuditGroup | None:

    G = RequirementCategorizationAuditGroup
    grupo = normalizar_grupo_resolutor(grupo_resolutor)

    return db.scalar(
        select(G).where(
            G.grupo_resolutor == grupo,
            G.audit_year == audit_year,
        )
    )


def crear_grupo(
    db: Session,
    group_name: str,
    grupo_resolutor: str,
    audit_year: int,
    description: str | None = None,
) -> RequirementCategorizationAuditGroup:

    grupo = normalizar_grupo_resolutor(grupo_resolutor)

    registro = RequirementCategorizationAuditGroup(
        group_name=group_name.strip(),
        grupo_resolutor=grupo,
        audit_year=audit_year,
        description=description,
    )

    db.add(registro)
    db.flush()

    return registro


def listar_grupos(
    db: Session,
    grupo_resolutor: str | None = None,
    limite: int = 50,
    offset: int = 0,
) -> list[RequirementCategorizationAuditGroup]:

    if not 1 <= limite <= 200 or offset < 0:
        raise ValueError("Paginación de agrupaciones inválida")

    grupo = normalizar_grupo_resolutor(grupo_resolutor)
    G = RequirementCategorizationAuditGroup

    consulta = (
        select(G)
        .where(G.grupo_resolutor == grupo)
        .order_by(G.audit_year.desc(), G.group_id.desc())
        .offset(offset)
        .limit(limite)
    )

    return list(db.scalars(consulta).all())


def listar_ejecuciones_grupo(
    db: Session,
    group_id: int,
) -> list[RequirementCategorizationAuditRun]:

    R = RequirementCategorizationAuditRun

    consulta = (
        select(R)
        .where(R.group_id == group_id)
        .order_by(R.period_from, R.run_id)
    )

    return list(db.scalars(consulta).all())


def obtener_ejecucion_superpuesta(
    db: Session,
    group_id: int,
    period_from: date,
    period_to: date,
) -> RequirementCategorizationAuditRun | None:
    """
    Impide incorporar períodos superpuestos.
    Se excluyen ejecuciones FAILED sin resultados,
    que podrán reintentarse posteriormente.
    """
    R = RequirementCategorizationAuditRun

    consulta = (
        select(R)
        .where(
            R.group_id == group_id,
            R.status != "FAILED",
            R.period_from <= period_to,
            R.period_to >= period_from,
        )
        .order_by(R.run_id.desc())
        .limit(1)
    )

    return db.scalar(consulta)


def encontrar_ticket_repetido_grupo(
    db: Session,
    group_id: int,
    grupo_resolutor: str,
    period_from: date,
    period_to: date,
) -> str | None:
    """
    Comprueba si un ticket del período solicitado
    ya fue evaluado en otra ejecución del grupo.
    """
    T = RequirementConsolidated
    A = RequirementCategorizationAuditResult
    R = RequirementCategorizationAuditRun

    consulta = (
        select(T.Ticket_ID)
        .select_from(T)
        .join(A, A.ticket_id == T.Ticket_ID)
        .join(R, R.run_id == A.run_id)
        .where(R.group_id == group_id)
        .limit(1)
    )

    consulta = _filtrar_fuente(
        consulta,
        grupo_resolutor,
        period_from,
        period_to,
    )

    return db.scalar(consulta)



def _resultados_vigentes_grupo(group_id: int):
    A = RequirementCategorizationAuditResult
    R = RequirementCategorizationAuditRun

    return (
        select(
            A.result_id.label("result_id"),
            func.row_number().over(
                partition_by=A.ticket_id,
                order_by=(
                    R.run_id.desc(),
                    A.result_id.desc(),
                ),
            ).label("posicion"),
        )
        .select_from(A)
        .join(R, R.run_id == A.run_id)
        .where(
            R.group_id == group_id,
            R.status == "COMPLETED",
        )
        .subquery("resultados_vigentes")
    )


def _consulta_dashboard_auditoria_grupo(
    db: Session,
    group_id: int,
    filtros: AuditDashboardFilters | None = None,
):
    """
    Consulta base compartida por KPIs, gráficos y tablas.

    1. Solo resultados de ejecuciones COMPLETED.
    2. Una sola evaluación vigente por ticket.
    3. Todos los filtros se aplican sobre ese resultado.
    """

    filtros = filtros or AuditDashboardFilters()

    A = RequirementCategorizationAuditResult
    T = RequirementConsolidated
    V = _resultados_vigentes_grupo(group_id)

    proyecto_col = func.coalesce(
        func.nullif(func.trim(A.project_name), ""),
        "Sin especificar",
    )

    resolutor_col = func.coalesce(
        func.nullif(func.trim(A.resolver_name), ""),
        "Sin asignar",
    )

    motivo_col = func.coalesce(
        func.nullif(func.trim(T.Motivo_Resolucion), ""),
        "SIN_DATO",
    )

    grupo_col = func.trim(A.grupo_resolutor)

    consulta = (
        select(
            A.result_id.label("result_id"),
            A.ticket_id.label("ticket_id"),
            grupo_col.label("grupo_resolutor"),
            proyecto_col.label("project_name"),
            resolutor_col.label("resolver_name"),
            A.source_opened_at.label("source_opened_at"),
            A.result_status.label("result_status"),
            A.solution_check_status.label("solution_check_status"),
            motivo_col.label("motivo_resolucion"),
        )
        .select_from(A)
        .join(V, V.c.result_id == A.result_id)
        .outerjoin(T, T.Ticket_ID == A.ticket_id)
        .where(V.c.posicion == 1)
    )

    # FILTROS GLOBALES

    if filtros.grupo_resolutor:
        grupo = normalizar_grupo_resolutor(
            filtros.grupo_resolutor
        )
        consulta = consulta.where(
            func.upper(grupo_col) == grupo
        )

    if filtros.proyecto:
        consulta = consulta.where(
            proyecto_col == filtros.proyecto.strip()
        )

    consulta = _filtrar_periodo(
        consulta,
        A.source_opened_at,
        filtros.desde,
        filtros.hasta,
    )

    # FILTROS DINÁMICOS

    if filtros.resultado:
        consulta = consulta.where(
            A.result_status == filtros.resultado
        )

    if filtros.motivo_resolucion:
        consulta = consulta.where(
            motivo_col == filtros.motivo_resolucion
        )

    if filtros.mes:
        grupo = obtener_grupo(db, group_id)

        if grupo is None:
            raise ValueError(
                f"Agrupación no encontrada: {group_id}"
            )

        inicio, fin = _rango_mes(
            filtros.mes,
            grupo.audit_year,
        )

        consulta = consulta.where(
            A.source_opened_at >= inicio,
            A.source_opened_at < fin,
        )

    if filtros.nombre_resolutor:
        consulta = consulta.where(
            resolutor_col == filtros.nombre_resolutor.strip()
        )

    if filtros.ticket_id:
        consulta = consulta.where(
            A.ticket_id == filtros.ticket_id.strip()
        )

    return consulta.subquery("dashboard_auditoria_filtrado")


def obtener_resumen_grupo(
    db: Session,
    group_id: int,
    filtros: AuditDashboardFilters | None = None,
) -> dict:

    grupo = obtener_grupo(db, group_id)
    if grupo is None:
        raise ValueError(f"Agrupación no encontrada: {group_id}")

    ejecuciones = listar_ejecuciones_grupo(db, group_id)
    completadas = [
        run for run in ejecuciones
        if run.status == "COMPLETED"
    ]

    F = _consulta_dashboard_auditoria_grupo(
        db, group_id, filtros
    )

    def contar_si(condicion):
        return func.coalesce(
            func.sum(case((condicion, 1), else_=0)),
            0,
        )

    consulta = select(
        func.count().label("evaluados"),
        contar_si(
            F.c.result_status == "CORRECT"
        ).label("correctos"),
        contar_si(
            F.c.result_status == "INCORRECT"
        ).label("incorrectos"),
        contar_si(
            F.c.solution_check_status == "MISSING_REQUIRED"
        ).label("sin_solucion_obligatoria"),
        contar_si(
            F.c.solution_check_status == "OPTIONAL_MISSING"
        ).label("sin_solucion_opcional"),
        contar_si(
            F.c.solution_check_status == "REVIEW_STATUS"
        ).label("solucion_revision"),
    ).select_from(F)

    fila = db.execute(consulta).mappings().one()

    total = int(fila["evaluados"])
    correctos = int(fila["correctos"])
    incorrectos = int(fila["incorrectos"])

    def porcentaje(cantidad):
        return round(100 * cantidad / total, 2) if total else 0.0

    return {
        "group_id": grupo.group_id,
        "group_name": grupo.group_name,
        "grupo_resolutor": grupo.grupo_resolutor,
        "audit_year": grupo.audit_year,
        "total_runs": len(ejecuciones),
        "completed_runs": len(completadas),
        "total_tickets": total,
        "processed_tickets": total,
        "correct_count": correctos,
        "incorrect_count": incorrectos,
        "error_count": sum(
            run.error_count for run in completadas
        ),
        "correct_percentage": porcentaje(correctos),
        "incorrect_percentage": porcentaje(incorrectos),
        "missing_required_solution_count": int(
            fila["sin_solucion_obligatoria"]
        ),
        "optional_missing_solution_count": int(
            fila["sin_solucion_opcional"]
        ),
        "review_solution_status_count": int(
            fila["solucion_revision"]
        ),
    }


def _filtrar_resultados_grupo(
    consulta,
    group_id: int,
    resultado: str | None = None,
    nombre_resolutor: str | None = None,
    ticket_id: str | None = None,
    proyecto: str | None = None,
    desde: date | None = None,
    hasta: date | None = None,
):

    A = RequirementCategorizationAuditResult
    V = _resultados_vigentes_grupo(group_id)

    consulta = (
        consulta
        .join(V, V.c.result_id == A.result_id)
        .where(V.c.posicion == 1)
    )

    if resultado is not None:
        if resultado not in {"CORRECT", "INCORRECT"}:
            raise ValueError(
                "Resultado de auditoría inválido."
            )

        consulta = consulta.where(
            A.result_status == resultado
        )

    if nombre_resolutor:
        consulta = consulta.where(
            func.trim(A.resolver_name)
            == nombre_resolutor.strip()
        )

    if ticket_id:
        consulta = consulta.where(
            A.ticket_id == ticket_id.strip()
        )

    if proyecto:
        consulta = consulta.where(
            func.trim(A.project_name)
            == proyecto.strip()
        )

    return _filtrar_periodo(
        consulta,
        A.source_opened_at,
        desde,
        hasta,
    )


def listar_tickets_grupo(
    db: Session,
    group_id: int,
    resultado: str | None = None,
    nombre_resolutor: str | None = None,
    ticket_id: str | None = None,
    proyecto: str | None = None,
    desde: date | None = None,
    hasta: date | None = None,
    page: int = 1,
    page_size: int = 25,
    filtros: AuditDashboardFilters | None = None,
) -> dict:

    grupo = obtener_grupo(db, group_id)
    if grupo is None:
        raise ValueError(f"Agrupación no encontrada: {group_id}")

    if page < 1 or not 1 <= page_size <= 200:
        raise ValueError("Paginación de tickets inválida")

    if filtros is None:
        filtros = AuditDashboardFilters(
            resultado=resultado,
            nombre_resolutor=nombre_resolutor,
            ticket_id=ticket_id,
            proyecto=proyecto,
            desde=desde,
            hasta=hasta,
        )

    A = RequirementCategorizationAuditResult
    T = RequirementConsolidated
    C = aliased(RequirementCategoryCatalog)

    F = _consulta_dashboard_auditoria_grupo(
        db, group_id, filtros
    )

    total = int(
        db.scalar(
            select(func.count()).select_from(F)
        ) or 0
    )

    columnas = [
        getattr(A, columna.name).label(columna.name)
        for columna in A.__table__.columns
    ]

    consulta = (
        select(
            *columnas,
            T.Descripcion.label("descripcion"),
            T.Detalle.label("detalle"),
            T.Solucion.label("solucion"),
            C.level_1.label("suggested_level_1"),
            C.level_2.label("suggested_level_2"),
            C.level_3.label("suggested_level_3"),
        )
        .select_from(A)
        .join(F, F.c.result_id == A.result_id)
        .outerjoin(T, T.Ticket_ID == A.ticket_id)
        .outerjoin(C, C.catalog_id == A.suggested_catalog_id)
        .order_by(
            A.source_opened_at.desc(),
            A.ticket_id.desc(),
            A.run_id.desc(),
        )
        .offset((page - 1) * page_size)
        .limit(page_size)
    )

    items = [
        dict(fila)
        for fila in db.execute(consulta).mappings().all()
    ]

    return {
        "group_id": group_id,
        "grupo_resolutor": grupo.grupo_resolutor,
        "total": total,
        "page": page,
        "page_size": page_size,
        "items": items,
    }



def listar_resolutores_grupo(
    db: Session,
    group_id: int,
    mes: str | None = None,
    filtros: AuditDashboardFilters | None = None,
) -> dict:

    grupo = obtener_grupo(db, group_id)
    if grupo is None:
        raise ValueError(f"Agrupación no encontrada: {group_id}")

    if filtros is None:
        filtros = AuditDashboardFilters(mes=mes)

    F = _consulta_dashboard_auditoria_grupo(
        db, group_id, filtros
    )

    def contar_si(condicion):
        return func.coalesce(
            func.sum(case((condicion, 1), else_=0)),
            0,
        )

    consulta = (
        select(
            F.c.resolver_name.label("resolver_name"),
            func.count().label("total_tickets"),
            contar_si(
                F.c.result_status == "CORRECT"
            ).label("correct_count"),
            contar_si(
                F.c.result_status == "INCORRECT"
            ).label("incorrect_count"),
            contar_si(
                F.c.solution_check_status == "MISSING_REQUIRED"
            ).label("missing_required_solution_count"),
        )
        .select_from(F)
        .group_by(F.c.resolver_name)
        .order_by(
            func.count().desc(),
            F.c.resolver_name,
        )
    )

    items = []

    for fila in db.execute(consulta).mappings():
        registro = dict(fila)

        total = int(registro["total_tickets"])
        correctos = int(registro["correct_count"])
        incorrectos = int(registro["incorrect_count"])

        registro["correct_percentage"] = (
            round(100 * correctos / total, 2) if total else 0.0
        )
        registro["incorrect_percentage"] = (
            round(100 * incorrectos / total, 2) if total else 0.0
        )

        items.append(registro)

    return {
        "group_id": group_id,
        "grupo_resolutor": grupo.grupo_resolutor,
        "total": len(items),
        "items": items,
    }




def obtener_ticket_duplicado_en_lote(
    db: Session,
    group_id: int,
    run_id_actual: int,
    ticket_ids: list[str],
) -> str | None:
    """
    Busca tickets que ya tengan resultados en otra
    ejecución perteneciente a la misma agrupación.
    """

    if not ticket_ids:
        return None

    A = RequirementCategorizationAuditResult
    R = RequirementCategorizationAuditRun

    consulta = (
        select(A.ticket_id)
        .select_from(A)
        .join(R, R.run_id == A.run_id)
        .where(
            R.group_id == group_id,
            R.run_id != run_id_actual,
            A.ticket_id.in_(ticket_ids),
        )
        .limit(1)
    )

    return db.scalar(consulta)



def obtener_estadisticas_mensuales_grupo(
    db: Session,
    group_id: int,
    filtros: AuditDashboardFilters | None = None,
) -> dict:

    grupo = obtener_grupo(db, group_id)
    if grupo is None:
        raise ValueError(f"Agrupación no encontrada: {group_id}")

    F = _consulta_dashboard_auditoria_grupo(
        db, group_id, filtros
    )

    anio = func.year(F.c.source_opened_at)
    mes = func.month(F.c.source_opened_at)

    correctos = func.sum(
        case((F.c.result_status == "CORRECT", 1), else_=0)
    )
    incorrectos = func.sum(
        case((F.c.result_status == "INCORRECT", 1), else_=0)
    )

    consulta = (
        select(
            anio.label("anio"),
            mes.label("mes"),
            func.count().label("total_tickets"),
            correctos.label("correct_count"),
            incorrectos.label("incorrect_count"),
        )
        .select_from(F)
        .group_by(anio, mes)
        .order_by(anio, mes)
    )

    items = []

    for fila in db.execute(consulta).mappings():
        total = int(fila["total_tickets"])
        cantidad_correctos = int(fila["correct_count"])
        cantidad_incorrectos = int(fila["incorrect_count"])

        items.append({
            "month": (
                f"{int(fila['anio']):04d}-"
                f"{int(fila['mes']):02d}"
            ),
            "total_tickets": total,
            "correct_count": cantidad_correctos,
            "incorrect_count": cantidad_incorrectos,
            "correct_percentage": (
                round(100 * cantidad_correctos / total, 2)
                if total else 0.0
            ),
            "incorrect_percentage": (
                round(100 * cantidad_incorrectos / total, 2)
                if total else 0.0
            ),
        })

    return {
        "group_id": group_id,
        "grupo_resolutor": grupo.grupo_resolutor,
        "audit_year": grupo.audit_year,
        "total": len(items),
        "items": items,
    }




#Grafico Dona Motivo Resolucion
def _rango_mes(mes: str, audit_year: int) -> tuple[date, date]:
    """Devuelve (inicio, fin_exclusivo) para un mes 'YYYY-MM'."""
    try:
        if len(mes) != 7 or mes[4] != "-":
            raise ValueError()
        anio = int(mes[:4])
        numero_mes = int(mes[5:7])
        inicio = date(anio, numero_mes, 1)
    except ValueError:
        raise ValueError("El mes debe tener el formato YYYY-MM.")

    if anio != audit_year:
        raise ValueError(
            "El mes seleccionado no pertenece al año de la agrupación."
        )

    fin = date(anio + 1, 1, 1) if numero_mes == 12 else date(anio, numero_mes + 1, 1)
    return inicio, fin


MOTIVO_SIN_DATO = "SIN_DATO"

def obtener_distribucion_motivo_resolucion_grupo(
    db: Session,
    group_id: int,
    mes: str | None = None,
    filtros: AuditDashboardFilters | None = None,
) -> dict:

    grupo = obtener_grupo(db, group_id)
    if grupo is None:
        raise ValueError(f"Agrupación no encontrada: {group_id}")

    if filtros is None:
        filtros = AuditDashboardFilters(mes=mes)

    F = _consulta_dashboard_auditoria_grupo(
        db, group_id, filtros
    )

    consulta = (
        select(
            F.c.motivo_resolucion.label("reason"),
            func.count().label("total_tickets"),
        )
        .select_from(F)
        .group_by(F.c.motivo_resolucion)
        .order_by(
            func.count().desc(),
            F.c.motivo_resolucion,
        )
    )

    items = []
    total = 0

    for fila in db.execute(consulta).mappings():
        cantidad = int(fila["total_tickets"])
        total += cantidad

        items.append({
            "reason": fila["reason"],
            "total_tickets": cantidad,
            "percentage": 0.0,
        })

    for item in items:
        item["percentage"] = (
            round(100 * item["total_tickets"] / total, 2)
            if total else 0.0
        )

    return {
        "group_id": group_id,
        "grupo_resolutor": grupo.grupo_resolutor,
        "audit_year": grupo.audit_year,
        "total": total,
        "items": items,
    }



def obtener_opciones_filtros_grupo(
    db: Session,
    group_id: int,
) -> dict:

    grupo = obtener_grupo(db, group_id)

    if grupo is None:
        raise ValueError(
            f"Agrupación no encontrada: {group_id}"
        )

    F = _consulta_dashboard_auditoria_grupo(
        db,
        group_id,
    )

    consulta = select(
        F.c.grupo_resolutor,
        F.c.project_name,
        F.c.resolver_name,
        F.c.ticket_id,
        F.c.source_opened_at,
    ).select_from(F)

    grupos = set()
    proyectos = set()
    resolutores = set()
    meses = set()
    tickets = set()

    fecha_min = None
    fecha_max = None

    for fila in db.execute(consulta).mappings():

        if fila["grupo_resolutor"]:
            grupos.add(fila["grupo_resolutor"])

        if fila["project_name"]:
            proyectos.add(fila["project_name"])

        if fila["resolver_name"]:
            resolutores.add(fila["resolver_name"])

        if fila["ticket_id"]:
            tickets.add(fila["ticket_id"])

        fecha = fila["source_opened_at"]

        if fecha is not None:
            dia = fecha.date()

            if fecha_min is None or dia < fecha_min:
                fecha_min = dia

            if fecha_max is None or dia > fecha_max:
                fecha_max = dia

            meses.add(f"{fecha.year:04d}-{fecha.month:02d}")

    return {
        "group_id": group_id,
        "audit_year": grupo.audit_year,
        "fecha_min": fecha_min,
        "fecha_max": fecha_max,
        "grupos_resolutores": sorted(grupos),
        "proyectos": sorted(proyectos),
        "nombres_resolutores": sorted(resolutores),
        "meses": sorted(meses),
        "ticket_ids": sorted(tickets),
    }
