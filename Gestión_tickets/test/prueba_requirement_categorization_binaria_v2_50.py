
from __future__ import annotations
import csv
from collections import Counter
from pathlib import Path
from sqlalchemy import select
from app.database.sqlserver import SQLServerSessionLocal
from app.models.requirement_categorization_audit_model import RequirementCategoryCatalog
from app.repositories import requirement_categorization_audit_repository as repo
from app.services.categorization.preprocessor import preparar_ticket
from app.services.categorization.semantic_engine import SemanticConfig,SemanticEngine


GRUPO = "BASE DE DATOS Y EBS"
ORIGEN = Path("test/revision_categorization_muestra_validada_50.csv")
DESTINO = Path("test/experimento_minilm_binario_v3_50.csv")
HASH_ESPERADO = "987aa84154a849ff90b1fe07f7c140e93ebfea483b66651c4588c7491bf48b00"

ESTADOS = ("CORRECT","INCORRECT","REVIEW")


def cargar_referencias():
    with ORIGEN.open("r",encoding="utf-8-sig",newline="") as archivo:
        lector = csv.DictReader(archivo,delimiter=";")
        registros = list(lector)

    if len(registros) != 50:
        raise ValueError("Se esperaban 50 tickets validados")

    identificadores = set()

    for registro in registros:
        ticket_id = registro["Ticket_ID"]

        if ticket_id in identificadores:
            raise ValueError(f"Ticket duplicado: {ticket_id}")

        identificadores.add(ticket_id)

        if registro["Etiqueta_DBA"] not in ("CORRECT","INCORRECT"):
            raise ValueError(f"Etiqueta DBA invalida: {ticket_id}")

        if registro["Resultado_IA"] not in ESTADOS:
            raise ValueError(f"Resultado IA invalido: {ticket_id}")

    return registros


def cargar_datos(registros):
    with SQLServerSessionLocal() as db:
        catalogo = [
            {
                "catalog_id":categoria.catalog_id,
                "level_1":categoria.level_1,
                "level_2":categoria.level_2,
                "level_3":categoria.level_3,
                "description":categoria.description or "",
                "examples":categoria.examples or "",
            }
            for categoria in db.scalars(
                select(RequirementCategoryCatalog)
                .order_by(RequirementCategoryCatalog.catalog_id)
            ).all()
        ]

        preparados = {}

        for registro in registros:
            ticket_id = registro["Ticket_ID"]

            ticket = repo.obtener_ticket_fuente(
                db,ticket_id,GRUPO
            )

            if ticket is None:
                raise ValueError(f"Ticket no encontrado: {ticket_id}")

            preparados[ticket_id] = preparar_ticket(ticket)

    return catalogo,preparados


def imprimir_matriz(registros,columna):
    print("Referencia DBA | IA CORRECT | IA INCORRECT | IA REVIEW")

    for etiqueta in ("CORRECT","INCORRECT"):
        conteos = Counter(
            registro[columna]
            for registro in registros
            if registro["Etiqueta_DBA"] == etiqueta
        )

        print(
            etiqueta,
            conteos["CORRECT"],
            conteos["INCORRECT"],
            conteos["REVIEW"],
        )


def ejecutar():
    if DESTINO.exists():
        raise FileExistsError(
            f"El archivo ya existe y no se sobrescribira: {DESTINO}"
        )

    registros = cargar_referencias()
    catalogo,preparados = cargar_datos(registros)


    config = SemanticConfig(
        model_name="sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2",
        device="cpu",
        batch_size=16,
        binary_mode=True,
        binary_threshold=0.35,
        binary_uncertainty_margin=0.07,
    )


    motor = SemanticEngine(config=config)
    motor.preparar_catalogo(catalogo)

    if motor.catalog_hash != HASH_ESPERADO:
        raise RuntimeError(
            "El catalogo cambio respecto al experimento original"
        )

    print("FASE 4.3 - COMPARACION MINILM")
    print("Tickets:",len(registros))
    print("Categorias:",len(catalogo))
    print("Hash:",motor.catalog_hash)
    print("Umbral binario:",config.binary_threshold)

    resultados = []
    cambios_estado = []
    cambios_puntaje = []

    for indice,registro in enumerate(registros,1):
        ticket_id = registro["Ticket_ID"]
        preparado = preparados[ticket_id]

        evaluacion = motor.evaluar(preparado,catalogo)

        anterior = registro["Resultado_IA"]
        actual = evaluacion.result_status

        puntuacion_anterior = (
            float(registro["Score_Original"])
            if registro["Score_Original"] else None
        )

        puntuacion_actual = evaluacion.semantic_score

        diferencia = (
            round(puntuacion_actual-puntuacion_anterior,4)
            if puntuacion_actual is not None
            and puntuacion_anterior is not None
            else None
        )

        campos = tuple(dict.fromkeys(
            fragmento.campo
            for fragmento in preparado.fragmentos
        ))

        fila = dict(registro)

        fila["Resultado_IA_Despues"] = actual
        fila["Codigo_IA_Despues"] = evaluacion.reason_code
        fila["Score_Original_Despues"] = puntuacion_actual
        fila["Diferencia_Score"] = diferencia
        fila["Campos_Semanticos_Despues"] = ",".join(campos)
        fila["Fragmentos_Despues"] = len(preparado.fragmentos)
        
        indicadores = evaluacion.evidence_json or {}

        fila["Indice_Coherencia"] = indicadores.get("indice_coherencia")
        fila["Score_Lexico"] = indicadores.get("score_lexico")
        fila["Proximidad_Relativa"] = indicadores.get("proximidad_relativa")
        fila["Confianza_Limitada"] = indicadores.get("confianza_limitada")


        resultados.append(fila)

        if anterior != actual:
            cambios_estado.append((
                ticket_id,registro["Etiqueta_DBA"],anterior,actual
            ))

        if diferencia is not None and abs(diferencia) >= 0.0001:
            cambios_puntaje.append((
                ticket_id,diferencia
            ))

        print(
            f"{indice:02d}/50",
            ticket_id,
            "DBA:",registro["Etiqueta_DBA"],
            "ANTES:",anterior,
            "AHORA:",actual,
            "DELTA:",diferencia,
        )

    print()
    print("MATRIZ ORIGINAL")
    imprimir_matriz(resultados,"Resultado_IA")

    print()
    print("MATRIZ CON DEDUPLICACION")
    imprimir_matriz(resultados,"Resultado_IA_Despues")

    print()
    print("CAMBIOS DE CLASIFICACION:",len(cambios_estado))

    for ticket_id,etiqueta,antes,despues in cambios_estado:
        print(ticket_id,"DBA:",etiqueta,antes,"->",despues)

    print()
    print("CAMBIOS DE PUNTUACION:",len(cambios_puntaje))

    for ticket_id,diferencia in cambios_puntaje:
        print(ticket_id,"Variacion:",diferencia)

    print()
    print("DISTRIBUCION NUEVA")

    conteos = Counter(
        registro["Resultado_IA_Despues"]
        for registro in resultados
    )

    for estado in ESTADOS:
        print(estado,conteos[estado])


    validos = {"CORRECT","INCORRECT"}

    if any(
        fila["Resultado_IA_Despues"] not in validos
        for fila in resultados
    ):
        raise AssertionError("El motor binario devolvio un estado no permitido")

    verdaderos_correctos = sum(
        fila["Etiqueta_DBA"] == "CORRECT"
        and fila["Resultado_IA_Despues"] == "CORRECT"
        for fila in resultados
    )

    verdaderos_incorrectos = sum(
        fila["Etiqueta_DBA"] == "INCORRECT"
        and fila["Resultado_IA_Despues"] == "INCORRECT"
        for fila in resultados
    )

    falsos_positivos = sum(
        fila["Etiqueta_DBA"] == "CORRECT"
        and fila["Resultado_IA_Despues"] == "INCORRECT"
        for fila in resultados
    )

    falsos_negativos = sum(
        fila["Etiqueta_DBA"] == "INCORRECT"
        and fila["Resultado_IA_Despues"] == "CORRECT"
        for fila in resultados
    )

    aciertos = verdaderos_correctos+verdaderos_incorrectos

    print()
    print("EVALUACION BINARIA V2")
    print("Aciertos:",aciertos,"/ 50")
    print("Exactitud:",round(aciertos/50*100,2),"%")
    print("Verdaderos CORRECT:",verdaderos_correctos)
    print("Verdaderos INCORRECT:",verdaderos_incorrectos)
    print("Falsos positivos:",falsos_positivos)
    print("Falsos negativos:",falsos_negativos)
    print("REVIEW:",0)

    print()
    print("TICKETS CLASIFICADOS INCORRECTAMENTE")

    for fila in resultados:
        if fila["Etiqueta_DBA"] != fila["Resultado_IA_Despues"]:
            print(
                fila["Ticket_ID"],
                "DBA:",fila["Etiqueta_DBA"],
                "IA:",fila["Resultado_IA_Despues"],
            )



    print()
    print("ANALISIS DE UMBRALES BINARIOS")
    print("Clase positiva: INCORRECT")

    for umbral in (0.25,0.30,0.35,0.40,0.45,0.50):
        tp = 0
        tn = 0
        fp = 0
        fn = 0

        for fila in resultados:
            indice = fila["Indice_Coherencia"]

            if indice is None:
                if fila["Codigo_IA_Despues"] not in {
                    "MISSING_CATEGORY",
                    "NO_TEXT_EVIDENCE",
                }:
                    raise ValueError(
                        f"Falta indice en {fila['Ticket_ID']}"
                    )

                prediccion = "INCORRECT"
            else:
                prediccion = (
                    "CORRECT"
                    if float(indice) >= umbral
                    else "INCORRECT"
                )

            etiqueta = fila["Etiqueta_DBA"]

            if etiqueta == "INCORRECT" and prediccion == "INCORRECT":
                tp += 1
            elif etiqueta == "CORRECT" and prediccion == "CORRECT":
                tn += 1
            elif etiqueta == "CORRECT" and prediccion == "INCORRECT":
                fp += 1
            elif etiqueta == "INCORRECT" and prediccion == "CORRECT":
                fn += 1

        print(
            f"Umbral: {umbral:.2f}",
            f"Aciertos: {tp+tn}/50",
            f"FP: {fp}",
            f"FN: {fn}",
            f"Errores detectados: {tp}/25",
        )

    print()
    print("ANALISIS DE CONFIANZA")

    limitados = [
        fila for fila in resultados
        if fila["Confianza_Limitada"] is True
    ]

    errores_limitados = sum(
        fila["Etiqueta_DBA"] != fila["Resultado_IA_Despues"]
        for fila in limitados
    )

    print("Decisiones con confianza limitada:",len(limitados))
    print("Errores dentro de ese grupo:",errores_limitados)


    columnas = list(resultados[0].keys())

    with DESTINO.open("w",encoding="utf-8-sig",newline="") as archivo:
        escritor = csv.DictWriter(
            archivo,
            fieldnames=columnas,
            delimiter=";",
        )
        escritor.writeheader()
        escritor.writerows(resultados)

    print()
    print("Archivo:",DESTINO.resolve())
    print("Escrituras SQL Server: ninguna")
    print("Experimento finalizado")


if __name__ == "__main__":
    ejecutar()
