
from __future__ import annotations
import csv
import random
from collections import Counter
from pathlib import Path
from sqlalchemy import func,select
from app.database.sqlserver import SQLServerSessionLocal
from app.models.requirement_consolidated_model import RequirementConsolidated
from app.models.requirement_categorization_audit_model import RequirementCategoryCatalog
from app.repositories import requirement_categorization_audit_repository as repo
from app.services.categorization.preprocessor import preparar_ticket
from app.services.categorization.semantic_engine import SemanticConfig,SemanticEngine
from app.services.categorization.audit_runner import evaluar_estado_solucion


GRUPO = "BASE DE DATOS Y EBS"
SEMILLA = 20261029
TOTAL_MUESTRA = 50
SALIDA = Path("test/revision_categorization_muestra_v2.csv")

REFERENCIAS = {
    "100-233615":"INCORRECT",
    "100-234545":"INCORRECT",
    "100-233580":"CORRECT",
}


def ruta(nivel_1,nivel_2,nivel_3):
    return " > ".join(
        str(valor or "").strip()
        for valor in (nivel_1,nivel_2,nivel_3)
    )


def limpiar(valor,limite=350):
    texto = " ".join(str(valor or "").split())[:limite]

    if texto.startswith(("=","+","-","@")):
        texto = "'" + texto

    return texto


def seleccionar_muestra(filas):
    aleatorio = random.Random(SEMILLA)
    por_id = {fila.Ticket_ID:fila for fila in filas}
    seleccionados = []
    identificadores = set()

    def agregar(fila):
        if fila is None or fila.Ticket_ID in identificadores:
            return False

        seleccionados.append(fila)
        identificadores.add(fila.Ticket_ID)
        return True

    for ticket_id in [
        "100-233615",
        "100-234545",
        "100-233601",
        "100-233580",
        "100-233581",
    ]:
        agregar(por_id.get(ticket_id))

    motivos = [
        "cancelled",
        "pendiente cliente",
        "assignment analyst",
        "in progress",
    ]

    for motivo in motivos:
        candidatos = [
            fila for fila in filas
            if str(fila.Motivo_Estado or "").casefold() == motivo
        ]

        aleatorio.shuffle(candidatos)

        for fila in candidatos[:3]:
            agregar(fila)

    candidatos = list(filas)
    aleatorio.shuffle(candidatos)

    categorias = {
        fila.Categorizacion_Nivel_3
        for fila in seleccionados
    }

    adicionales = 0

    for fila in candidatos:
        if adicionales >= 15:
            break

        categoria = fila.Categorizacion_Nivel_3

        if categoria not in categorias and agregar(fila):
            categorias.add(categoria)
            adicionales += 1

    for fila in candidatos:
        if len(seleccionados) >= TOTAL_MUESTRA:
            break

        agregar(fila)

    return seleccionados[:TOTAL_MUESTRA]


def cargar_datos():
    with SQLServerSessionLocal() as db:
        catalogo = [
            {
                "catalog_id":c.catalog_id,
                "level_1":c.level_1,
                "level_2":c.level_2,
                "level_3":c.level_3,
                "description":c.description or "",
                "examples":c.examples or "",
            }
            for c in db.scalars(
                select(RequirementCategoryCatalog)
                .order_by(RequirementCategoryCatalog.catalog_id)
            ).all()
        ]

        R = RequirementConsolidated

        filas = db.execute(
            select(
                R.Ticket_ID,R.Motivo_Estado,
                R.Categorizacion_Nivel_3,
            )
            .where(
                func.upper(func.trim(R.Grupo_Resolutor)) == GRUPO
            )
            .order_by(R.Ticket_ID)
        ).all()

        muestra = seleccionar_muestra(filas)

        tickets = [
            repo.obtener_ticket_fuente(db,fila.Ticket_ID,GRUPO)
            for fila in muestra
        ]

        db.expunge_all()
        db.rollback()

    return catalogo,[ticket for ticket in tickets if ticket is not None]


def ejecutar_prueba():
    catalogo,tickets = cargar_datos()

    if len(catalogo) < 2:
        raise RuntimeError("El catálogo no tiene suficientes rutas")

    if not tickets:
        raise RuntimeError("No se encontraron tickets")

    config = SemanticConfig(
        model_name="sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2",
        device="cpu",
        batch_size=16,
        incorrect_score=0.64,
    )

    motor = SemanticEngine(config=config)
    motor.preparar_catalogo(catalogo)

    por_categoria = {
        categoria["catalog_id"]:categoria
        for categoria in catalogo
    }

    registros = []
    conteos = Counter()

    print("Grupo:",GRUPO)
    print("Tickets seleccionados:",len(tickets))
    print("Categorías:",len(catalogo))
    print("Hash:",motor.catalog_hash)
    print("Umbral experimental:",config.incorrect_score)

    for indice,ticket in enumerate(tickets,1):
        preparado = preparar_ticket(ticket)
        resultado = motor.evaluar(preparado,catalogo)
        situacion = evaluar_estado_solucion(ticket)
        evidencia = resultado.evidence_json or {}

        alternativa = evidencia.get("ruta_alternativa") or {}

        ruta_alternativa = ""

        if isinstance(alternativa,dict) and all(
            alternativa.get(campo)
            for campo in ("level_1","level_2","level_3")
        ):
            ruta_alternativa = ruta(
                alternativa["level_1"],
                alternativa["level_2"],
                alternativa["level_3"],
            )


        sugerida = por_categoria.get(resultado.suggested_catalog_id)

        ruta_sugerida = (
            ruta(
                sugerida["level_1"],
                sugerida["level_2"],
                sugerida["level_3"],
            )
            if sugerida else ""
        )

        registro = {
            "Ticket_ID":ticket.Ticket_ID,
            "Fecha_Apertura":str(ticket.Fecha_Apertura or ""),
            "Estado":ticket.Estado or "",
            "Motivo_Estado":ticket.Motivo_Estado or "",
            "Ruta_Original":ruta(
                ticket.Categorizacion_Nivel_1,
                ticket.Categorizacion_Nivel_2,
                ticket.Categorizacion_Nivel_3,
            ),
            "Descripcion":limpiar(ticket.Descripcion),
            "Detalle":limpiar(ticket.Detalle),
            "Solucion":limpiar(ticket.Solucion),
            "Resultado_IA":resultado.result_status,
            "Codigo_IA":resultado.reason_code,
            "Score_Original":evidencia.get("score_original"),
            "Score_Mejor":evidencia.get("score_mejor"),
            "Margen_Original":evidencia.get("margen_original"),
            "Ruta_Sugerida":ruta_sugerida,
            "Ruta_Alternativa_IA":ruta_alternativa,
            "Situacion_Ticket":situacion.ticket_lifecycle_status,
            "Verificacion_Solucion":situacion.solution_check_status,
            "Referencia_Inicial":REFERENCIAS.get(ticket.Ticket_ID,""),
            "Etiqueta_DBA":"",
            "Ruta_Correcta_DBA":"",
            "Observacion_DBA":"",
        }

        registros.append(registro)
        conteos[resultado.result_status] += 1

        print(
            f"{indice:02d}/{len(tickets)}",
            ticket.Ticket_ID,
            resultado.result_status,
            resultado.reason_code,
        )

    SALIDA.parent.mkdir(parents=True,exist_ok=True)

    with SALIDA.open("w",encoding="utf-8-sig",newline="") as archivo:
        escritor = csv.DictWriter(
            archivo,fieldnames=list(registros[0].keys()),
            delimiter=";",
        )
        escritor.writeheader()
        escritor.writerows(registros)

    print()
    print("RESUMEN")
    print("CORRECT:",conteos["CORRECT"])
    print("INCORRECT:",conteos["INCORRECT"])
    print("REVIEW:",conteos["REVIEW"])
    print("Total:",sum(conteos.values()))
    print("CSV local:",SALIDA.resolve())
    print("Escrituras SQL Server: ninguna")


if __name__ == "__main__":
    ejecutar_prueba()
