
from __future__ import annotations
import csv
from collections import Counter
from pathlib import Path


ORIGEN = Path("test/revision_categorization_muestra_validada_parcial.csv")
DESTINO = Path("test/revision_categorization_muestra_validada_15_v2.csv")

ANTERIORES = {
    "100-233615":"INCORRECT",
    "100-234545":"INCORRECT",
    "100-233580":"CORRECT",
    "100-233601":"CORRECT",
    "100-233581":"INCORRECT",
}

NUEVAS = {
    "100-245278":(
        "INCORRECT",
        "El especialista DBA confirma una categorizacion incorrecta. La ruta esta vacia.",
    ),
    "100-261125":(
        "CORRECT",
        "El monitoreo y checklist comprende la revision de jobs. La categoria es coherente.",
    ),
    "100-279859":(
        "CORRECT",
        "El especialista DBA confirma que la categoria, descripcion, detalle y solucion son correctos. El Motivo_Resolucion es incorrecto, pero queda fuera del alcance de esta auditoria.",
    ),
    "100-241640":(
        "CORRECT",
        "El especialista DBA confirma que la categoria es adecuada.",
    ),
    "100-253191":(
        "CORRECT",
        "El especialista DBA confirma que la categoria es adecuada.",
    ),
    "100-237586":(
        "INCORRECT",
        "El especialista DBA confirma que la categoria es incorrecta.",
    ),
    "100-250642":(
        "INCORRECT",
        "No existe relacion entre la categoria registrada y la actividad descrita.",
    ),
    "100-243619":(
        "INCORRECT",
        "No existe una relacion coherente entre la categoria y la actividad realizada.",
    ),
    "100-247321":(
        "CORRECT",
        "El especialista DBA confirma que la categoria de Reunion Tecnica es adecuada.",
    ),
    "100-268313":(
        "CORRECT",
        "El especialista DBA confirma que la categoria de Checklist Diario es adecuada.",
    ),
}


def ejecutar():
    if not ORIGEN.is_file():
        raise FileNotFoundError(f"No se encontro el archivo: {ORIGEN}")

    if DESTINO.exists():
        raise FileExistsError(f"El archivo ya existe y no sera sobrescrito: {DESTINO}")

    with ORIGEN.open("r",encoding="utf-8-sig",newline="") as archivo:
        lector = csv.DictReader(archivo,delimiter=";")
        columnas = lector.fieldnames
        registros = list(lector)

    if not columnas:
        raise ValueError("El CSV no tiene encabezados")

    requeridas = {
        "Ticket_ID","Resultado_IA","Etiqueta_DBA",
        "Ruta_Correcta_DBA","Observacion_DBA",
    }

    if not requeridas.issubset(columnas):
        raise ValueError("Faltan columnas requeridas en el CSV")

    if len(registros) != 50:
        raise ValueError("La muestra debe contener exactamente 50 tickets")

    indices = {}

    for registro in registros:
        ticket_id = registro["Ticket_ID"]

        if ticket_id in indices:
            raise ValueError(f"Ticket duplicado: {ticket_id}")

        indices[ticket_id] = registro

    for ticket_id,etiqueta in ANTERIORES.items():
        if ticket_id not in indices:
            raise ValueError(f"Falta un ticket validado: {ticket_id}")

        if indices[ticket_id]["Etiqueta_DBA"] != etiqueta:
            raise ValueError(f"La etiqueta anterior fue modificada: {ticket_id}")

    for ticket_id,(etiqueta,observacion) in NUEVAS.items():
        if ticket_id not in indices:
            raise ValueError(f"Ticket no encontrado: {ticket_id}")

        registro = indices[ticket_id]

        if registro["Etiqueta_DBA"].strip():
            raise ValueError(f"El ticket ya tiene una etiqueta DBA: {ticket_id}")

        registro["Etiqueta_DBA"] = etiqueta
        registro["Observacion_DBA"] = observacion

    with DESTINO.open("w",encoding="utf-8-sig",newline="") as archivo:
        escritor = csv.DictWriter(
            archivo,fieldnames=columnas,delimiter=";"
        )
        escritor.writeheader()
        escritor.writerows(registros)

    conteos = Counter(
        registro["Etiqueta_DBA"]
        for registro in registros
    )

    print("Total de tickets:",len(registros))
    print("CORRECT DBA:",conteos["CORRECT"])
    print("INCORRECT DBA:",conteos["INCORRECT"])
    print("REVIEW DBA:",conteos["REVIEW"])
    print("Pendientes de validacion:",conteos[""])

    print()
    print("COMPARACION DBA VS IA")

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


if __name__ == "__main__":
    ejecutar()
