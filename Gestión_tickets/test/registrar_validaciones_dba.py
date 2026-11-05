
from __future__ import annotations
import csv
from collections import Counter
from pathlib import Path


ORIGEN = Path("test/revision_categorization_muestra_v2.csv")
DESTINO = Path("test/revision_categorization_muestra_validada_parcial.csv")

ETIQUETAS = {
    "100-233615":(
        "INCORRECT",
        "La categoria Reunion Tecnica no guarda relacion con la descripcion y solucion de checklist.",
    ),
    "100-234545":(
        "INCORRECT",
        "La categoria Reunion Tecnica no corresponde al checklist solicitado y ejecutado.",
    ),
    "100-233580":(
        "CORRECT",
        "La descripcion, detalle y solucion corresponden al checklist diario de Informix.",
    ),
    "100-233601":(
        "CORRECT",
        "El especialista DBA confirma que la categoria de backup corresponde a la solicitud y solucion registradas.",
    ),
    "100-233581":(
        "INCORRECT",
        "La categoria Checklist Diario no corresponde a los reportes de ocupabilidad descritos en el ticket.",
    ),
}


def ejecutar():
    with ORIGEN.open("r",encoding="utf-8-sig",newline="") as archivo:
        lector = csv.DictReader(archivo,delimiter=";")
        columnas = lector.fieldnames
        registros = list(lector)

    if not columnas:
        raise ValueError("El CSV no contiene encabezados")

    encontrados = set()

    for registro in registros:
        ticket_id = registro["Ticket_ID"]

        if ticket_id not in ETIQUETAS:
            continue

        etiqueta,observacion = ETIQUETAS[ticket_id]

        registro["Etiqueta_DBA"] = etiqueta
        registro["Ruta_Correcta_DBA"] = ""
        registro["Observacion_DBA"] = observacion

        encontrados.add(ticket_id)

    faltantes = set(ETIQUETAS)-encontrados

    if faltantes:
        raise ValueError(f"Tickets no encontrados: {sorted(faltantes)}")

    with DESTINO.open("w",encoding="utf-8-sig",newline="") as archivo:
        escritor = csv.DictWriter(archivo,fieldnames=columnas,delimiter=";")
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
    print("Archivo:",DESTINO.resolve())


if __name__ == "__main__":
    ejecutar()
