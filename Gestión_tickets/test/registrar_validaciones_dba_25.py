
from __future__ import annotations
import csv
from collections import Counter
from pathlib import Path


ORIGEN = Path("test/revision_categorization_muestra_validada_15_v2.csv")
DESTINO = Path("test/revision_categorization_muestra_validada_25.csv")

ANTERIORES = {
    "100-233615":"INCORRECT",
    "100-234545":"INCORRECT",
    "100-233580":"CORRECT",
    "100-233601":"CORRECT",
    "100-233581":"INCORRECT",
    "100-245278":"INCORRECT",
    "100-261125":"CORRECT",
    "100-279859":"CORRECT",
    "100-241640":"CORRECT",
    "100-253191":"CORRECT",
    "100-237586":"INCORRECT",
    "100-250642":"INCORRECT",
    "100-243619":"INCORRECT",
    "100-247321":"CORRECT",
    "100-268313":"CORRECT",
}

NUEVAS = {
    "100-276499":(
        "INCORRECT",
        "La actividad real fue una reunion Daily. No corresponde a Analisis de Reportes.",
    ),
    "100-247346":(
        "CORRECT",
        "La reunion Daily DBA corresponde a la categoria Reunion Tecnica.",
    ),
    "100-268727":(
        "CORRECT",
        "Existe relacion entre Elaboracion Informe Mensual y la descripcion. El ticket no esta resuelto y no requiere solucion registrada.",
    ),
    "100-282136":(
        "CORRECT",
        "El especialista DBA confirma la coherencia del checklist DBA.",
    ),
    "100-248783":(
        "INCORRECT",
        "La actividad documentada corresponde a modificacion o automatizacion de informes, no a la ejecucion rutinaria de Checklist Diario.",
    ),
    "100-276221":(
        "CORRECT",
        "Existe alineacion entre la categoria de accesos y el trabajo realizado.",
    ),
    "100-290562":(
        "CORRECT",
        "La solicitud de informacion de monitoreo es coherente con Consulta Tecnica.",
    ),
    "100-282122":(
        "INCORRECT",
        "Existe desalineacion entre Checklist Diario y la validacion tecnica de disco ASM.",
    ),
    "100-273026":(
        "CORRECT",
        "La actividad corresponde a la participacion en un comite de cambios.",
    ),
    "100-236777":(
        "INCORRECT",
        "Las pruebas de ACFS corresponden a verificacion tecnica y no a la creacion inicial de un ambiente.",
    ),
}


def ejecutar():
    if not ORIGEN.is_file():
        raise FileNotFoundError(f"No se encontro: {ORIGEN}")

    if DESTINO.exists():
        raise FileExistsError(f"El archivo ya existe: {DESTINO}")

    with ORIGEN.open("r",encoding="utf-8-sig",newline="") as archivo:
        lector = csv.DictReader(archivo,delimiter=";")
        columnas = lector.fieldnames
        registros = list(lector)

    if not columnas:
        raise ValueError("El CSV no contiene encabezados")

    requeridas = {
        "Ticket_ID",
        "Resultado_IA",
        "Etiqueta_DBA",
        "Ruta_Correcta_DBA",
        "Observacion_DBA",
    }

    if not requeridas.issubset(columnas):
        raise ValueError("Faltan columnas requeridas")

    if len(registros) != 50:
        raise ValueError("Se esperaban 50 tickets")

    por_id = {}

    for registro in registros:
        ticket_id = registro["Ticket_ID"]

        if ticket_id in por_id:
            raise ValueError(f"Ticket duplicado: {ticket_id}")

        por_id[ticket_id] = registro

    for ticket_id,etiqueta in ANTERIORES.items():
        registro = por_id.get(ticket_id)

        if registro is None:
            raise ValueError(f"Falta ticket anterior: {ticket_id}")

        if registro["Etiqueta_DBA"] != etiqueta:
            raise ValueError(f"Validacion anterior alterada: {ticket_id}")

    for ticket_id,(etiqueta,observacion) in NUEVAS.items():
        registro = por_id.get(ticket_id)

        if registro is None:
            raise ValueError(f"Ticket no encontrado: {ticket_id}")

        if registro["Etiqueta_DBA"].strip():
            raise ValueError(f"Ticket ya validado: {ticket_id}")

        registro["Etiqueta_DBA"] = etiqueta
        registro["Observacion_DBA"] = observacion
        registro["Ruta_Correcta_DBA"] = ""

    conteos = Counter(
        registro["Etiqueta_DBA"]
        for registro in registros
    )

    if (
        conteos["CORRECT"] != 14
        or conteos["INCORRECT"] != 11
        or conteos["REVIEW"] != 0
        or conteos[""] != 25
    ):
        raise ValueError("Los totales DBA no coinciden con lo esperado")

    with DESTINO.open("w",encoding="utf-8-sig",newline="") as archivo:
        escritor = csv.DictWriter(
            archivo,
            fieldnames=columnas,
            delimiter=";",
        )
        escritor.writeheader()
        escritor.writerows(registros)

    print("VALIDACION DBA — 25 TICKETS")
    print("Total de tickets:",len(registros))
    print("CORRECT DBA:",conteos["CORRECT"])
    print("INCORRECT DBA:",conteos["INCORRECT"])
    print("REVIEW DBA:",conteos["REVIEW"])
    print("Pendientes:",conteos[""])

    print()
    print("MATRIZ DBA VS MINILM")

    for estado in ("CORRECT","INCORRECT","REVIEW"):
        valores = Counter(
            registro["Resultado_IA"]
            for registro in registros
            if registro["Etiqueta_DBA"] == estado
        )

        print(
            estado,
            "IA CORRECT:",valores["CORRECT"],
            "IA INCORRECT:",valores["INCORRECT"],
            "IA REVIEW:",valores["REVIEW"],
        )

    print()
    print("Archivo generado:",DESTINO.resolve())
    print("Escrituras SQL Server: ninguna")


if __name__ == "__main__":
    ejecutar()
