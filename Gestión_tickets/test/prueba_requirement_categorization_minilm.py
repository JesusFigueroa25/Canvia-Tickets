
from __future__ import annotations
from sqlalchemy import func,select
from app.database.sqlserver import SQLServerSessionLocal
from app.models.requirement_consolidated_model import RequirementConsolidated
from app.models.requirement_categorization_audit_model import RequirementCategoryCatalog
from app.repositories import requirement_categorization_audit_repository as repo
from app.services.categorization.preprocessor import normalizar_texto,preparar_ticket
from app.services.categorization.semantic_engine import SemanticConfig,SemanticEngine
from app.services.categorization.audit_runner import evaluar_estado_solucion
from numbers import Real


GRUPO = "BASE DE DATOS Y EBS"

CASOS = [
    ("100-233615","INCORRECT"),
    ("100-234545","INCORRECT"),
    ("100-233601","CORRECT"),
    ("100-233580","CORRECT"),
    ("100-233581","CORRECT"),
]


def clave_ruta(nivel_1,nivel_2,nivel_3):
    return tuple(
        normalizar_texto(valor).casefold()
        for valor in (nivel_1,nivel_2,nivel_3)
    )


def texto_ruta(nivel_1,nivel_2,nivel_3):
    return " → ".join(
        normalizar_texto(valor)
        for valor in (nivel_1,nivel_2,nivel_3)
    )


def cargar_catalogo(db):
    registrados = db.scalars(
        select(RequirementCategoryCatalog)
        .order_by(RequirementCategoryCatalog.catalog_id)
    ).all()

    catalogo = []
    claves = set()

    for categoria in registrados:
        clave = clave_ruta(
            categoria.level_1,
            categoria.level_2,
            categoria.level_3,
        )

        if not all(clave) or clave in claves:
            continue

        catalogo.append({
            "catalog_id":categoria.catalog_id,
            "level_1":categoria.level_1,
            "level_2":categoria.level_2,
            "level_3":categoria.level_3,
            "description":categoria.description or "",
            "examples":categoria.examples or "",
        })

        claves.add(clave)

    consulta = (
        select(
            RequirementConsolidated.Categorizacion_Nivel_1,
            RequirementConsolidated.Categorizacion_Nivel_2,
            RequirementConsolidated.Categorizacion_Nivel_3,
        )
        .where(
            func.upper(
                func.trim(RequirementConsolidated.Grupo_Resolutor)
            ) == GRUPO
        )
        .distinct()
    )

    filas = db.execute(consulta).all()
    observadas_adicionales = 0

    for nivel_1,nivel_2,nivel_3 in filas:
        clave = clave_ruta(nivel_1,nivel_2,nivel_3)

        if not all(clave) or clave in claves:
            continue

        catalogo.append({
            "catalog_id":None,
            "level_1":nivel_1,
            "level_2":nivel_2,
            "level_3":nivel_3,
            "description":"",
            "examples":"",
        })

        claves.add(clave)
        observadas_adicionales += 1

    return catalogo,len(registrados),observadas_adicionales


def cargar_casos(db):
    casos = []

    for ticket_id,esperado in CASOS:
        ticket = repo.obtener_ticket_fuente(db,ticket_id,GRUPO)

        if ticket is None:
            print("Ticket no encontrado en el grupo:",ticket_id)
            continue

        preparado = preparar_ticket(ticket)
        situacion = evaluar_estado_solucion(ticket)

        casos.append({
            "ticket_id":ticket_id,
            "esperado":esperado,
            "preparado":preparado,
            "situacion":situacion,
            "ruta_original":texto_ruta(
                ticket.Categorizacion_Nivel_1,
                ticket.Categorizacion_Nivel_2,
                ticket.Categorizacion_Nivel_3,
            ),
        })

    return casos


def extraer_metricas(valor,prefijo=""):
    metricas = {}

    if isinstance(valor,dict):
        for clave,dato in valor.items():
            ruta = f"{prefijo}.{clave}" if prefijo else str(clave)
            metricas.update(extraer_metricas(dato,ruta))

    elif isinstance(valor,(list,tuple)):
        for indice,dato in enumerate(valor[:5]):
            metricas.update(extraer_metricas(dato,f"{prefijo}[{indice}]"))

    elif isinstance(valor,Real) and not isinstance(valor,bool):
        metricas[prefijo] = round(float(valor),4)

    return metricas


def ejecutar_prueba():
    print("FASE 3.3 — INFERENCIA REAL MINILM")
    print("Grupo:",GRUPO)

    with SQLServerSessionLocal() as db:
        catalogo,registradas,observadas = cargar_catalogo(db)
        casos = cargar_casos(db)

        db.rollback()

    print("Rutas registradas en catálogo:",registradas)
    print("Rutas históricas adicionales:",observadas)
    print("Rutas disponibles para evaluar:",len(catalogo))
    print("Tickets encontrados:",len(casos))

    if len(catalogo) < 2:
        raise RuntimeError("El catálogo no contiene suficientes rutas")

    if not casos:
        raise RuntimeError("No se encontraron tickets de prueba")


    config = SemanticConfig(
        model_name="sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2",
        device="cpu",
        batch_size=16,
        incorrect_score=0.64,
    )


    motor = SemanticEngine(config=config)

    print("Modelo:",config.model_name)
    print("Dispositivo:",config.device)
    print("Preparando representaciones semánticas...")

    total_rutas = motor.preparar_catalogo(catalogo)

    print("Rutas preparadas:",total_rutas)
    print("Hash del catálogo:",motor.catalog_hash)

    categorias_por_id = {
        categoria["catalog_id"]:categoria
        for categoria in catalogo
        if categoria["catalog_id"] is not None
    }

    coincidencias = 0

    for caso in casos:
        resultado = motor.evaluar(caso["preparado"],catalogo)

        if resultado.result_status == caso["esperado"]:
            coincidencias += 1

        puntuacion = (
            f"{resultado.semantic_score:.4f}"
            if resultado.semantic_score is not None
            else "N/D"
        )

        print()
        print("="*65)
        print("Ticket:",caso["ticket_id"])
        print("Referencia manual:",caso["esperado"])
        print("Resultado MiniLM:",resultado.result_status)
        print("Código:",resultado.reason_code)
        print("Puntuación:",puntuacion)
        print("Ruta original:",caso["ruta_original"])
        print("Justificación:",resultado.reason_text)
        print(
            "Situación:",
            caso["situacion"].ticket_lifecycle_status,
        )
        print(
            "Validación solución:",
            caso["situacion"].solution_check_status,
        )

        sugerida = categorias_por_id.get(
            resultado.suggested_catalog_id
        )

        if sugerida is not None:
            print(
                "Ruta sugerida:",
                texto_ruta(
                    sugerida["level_1"],
                    sugerida["level_2"],
                    sugerida["level_3"],
                ),
            )
        elif resultado.suggested_catalog_id is not None:
            print(
                "ID de ruta sugerida:",
                resultado.suggested_catalog_id,
            )

        evidencia = resultado.evidence_json or {}

        print("Campos utilizados:",caso["preparado"].campos_disponibles)
        print("Fragmentos evaluados:",len(caso["preparado"].fragmentos))
        print("Fragmentos omitidos:",caso["preparado"].fragmentos_omitidos)
        print("Claves de evidencia:",list(evidencia.keys()))

        metricas = extraer_metricas(evidencia)

        for nombre,valor in metricas.items():
            print("Métrica:",nombre,"=",valor)


        if "ruta_alternativa" in evidencia:
            print(
                "Alternativa en evidencia:",
                str(evidencia["ruta_alternativa"])[:350],
            )

    print()
    print("="*65)
    print("RESUMEN DE LA PRUEBA")
    print("Casos evaluados:",len(casos))
    print("Coincidencias con referencia:",coincidencias)
    print("Diferencias:",len(casos)-coincidencias)
    print("Escrituras en SQL Server: ninguna")
    print("Prueba de inferencia real finalizada")


if __name__ == "__main__":
    ejecutar_prueba()
