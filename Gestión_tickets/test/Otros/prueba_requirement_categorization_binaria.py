
from __future__ import annotations
import csv
from collections import Counter
from pathlib import Path
import numpy as np
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import confusion_matrix
from sklearn.model_selection import LeaveOneOut,cross_val_predict
from sklearn.pipeline import make_pipeline
from sklearn.preprocessing import StandardScaler


ORIGEN = Path("test/revision_categorization_muestra_validada_25.csv")
VALIDADO = Path("test/revision_categorization_muestra_validada_50.csv")
EXPERIMENTO = Path("test/experimento_categorizacion_binaria_50.csv")
UMBRAL_EXPERIMENTAL = 0.60

NUEVAS = {
    "100-257979":(
        "INCORRECT",
        "La categoria no corresponde a la actividad de despliegue en produccion.",
    ),
    "100-266653":(
        "CORRECT",
        "El cronograma de parches corresponde al levantamiento de informacion.",
    ),
    "100-270063":(
        "INCORRECT",
        "Existe desalineacion entre la categoria de usuarios y el requerimiento tecnico.",
    ),
    "100-245215":(
        "INCORRECT",
        "La actividad tecnica de WebLogic no corresponde a Reunion Tecnica.",
    ),
    "100-295122":(
        "CORRECT",
        "El DBA confirma alineacion entre la categoria y el contenido.",
    ),
    "100-256469":(
        "INCORRECT",
        "El analisis de una tabla Informix no corresponde a elaborar un plan de trabajo.",
    ),
    "100-293278":(
        "INCORRECT",
        "La programacion de cobertura operativa no corresponde a gestion de accesos.",
    ),
    "100-268840":(
        "CORRECT",
        "La actividad corresponde a gestion de accesos y desbloqueo de usuarios.",
    ),
    "100-283587":(
        "CORRECT",
        "La actividad y el entregable corresponden a Informe Tecnico.",
    ),
    "100-257061":(
        "CORRECT",
        "La extraccion y entrega de informacion corresponde a Generacion de Reportes.",
    ),
    "100-254641":(
        "INCORRECT",
        "El desarrollo y optimizacion de procesos ETL no es una simple documentacion.",
    ),
    "100-266595":(
        "INCORRECT",
        "La capacitacion IPERC no corresponde a revision de documentos de backups.",
    ),
    "100-279953":(
        "CORRECT",
        "La actividad corresponde a Validacion de Servicios de Aplicacion.",
    ),
    "100-257666":(
        "CORRECT",
        "La demostracion tecnica corresponde a Capacitacion Tecnica.",
    ),
    "100-284749":(
        "INCORRECT",
        "La administracion operativa general no equivale a Validacion de Servicios BD.",
    ),
    "100-256726":(
        "CORRECT",
        "La intervencion corresponde a resolver restricciones de espacio.",
    ),
    "100-291145":(
        "CORRECT",
        "La actividad corresponde a Elaboracion de Informe Mensual.",
    ),
    "100-251205":(
        "INCORRECT",
        "El diagnostico de CPU y reinicio de servicios no corresponde a Reunion Tecnica.",
    ),
    "100-271003":(
        "CORRECT",
        "La actividad corresponde a Elaboracion de Informe Mensual.",
    ),
    "100-294320":(
        "INCORRECT",
        "TRUNCATE y GATHER_TABLE_STATS son mantenimiento de BD, no gestion de accesos.",
    ),
    "100-238656":(
        "INCORRECT",
        "La ejecucion de scripts corresponde a cambios tecnicos, no a consulta de usuarios.",
    ),
    "100-255233":(
        "INCORRECT",
        "La implementacion del proyecto excede la revision de documentos tecnicos.",
    ),
    "100-261050":(
        "INCORRECT",
        "La optimizacion de procesamiento de datos no corresponde a documentacion.",
    ),
    "100-292489":(
        "CORRECT",
        "La elaboracion del informe DRP corresponde a Informe Tecnico.",
    ),
    "100-246031":(
        "INCORRECT",
        "El DBA confirma desalineacion entre la categoria y la tarea tecnica solicitada.",
    ),
}


def cargar_y_validar():
    if not ORIGEN.is_file():
        raise FileNotFoundError(ORIGEN)

    if VALIDADO.exists() or EXPERIMENTO.exists():
        raise FileExistsError("Ya existe un archivo de salida experimental")

    with ORIGEN.open("r",encoding="utf-8-sig",newline="") as archivo:
        lector = csv.DictReader(archivo,delimiter=";")
        columnas = lector.fieldnames
        registros = list(lector)

    if not columnas or len(registros) != 50:
        raise ValueError("La muestra debe contener 50 tickets")

    requeridas = {
        "Ticket_ID",
        "Etiqueta_DBA",
        "Resultado_IA",
        "Score_Original",
        "Observacion_DBA",
        "Ruta_Correcta_DBA",
    }

    if not requeridas.issubset(columnas):
        raise ValueError("Faltan columnas necesarias")

    por_id = {}

    for registro in registros:
        ticket_id = registro["Ticket_ID"]

        if ticket_id in por_id:
            raise ValueError(f"Ticket duplicado: {ticket_id}")

        por_id[ticket_id] = registro

    anteriores = sum(
        bool(registro["Etiqueta_DBA"].strip())
        for registro in registros
    )

    if anteriores != 25:
        raise ValueError(f"Se esperaban 25 validaciones anteriores: {anteriores}")

    for ticket_id,(etiqueta,observacion) in NUEVAS.items():
        registro = por_id.get(ticket_id)

        if registro is None:
            raise ValueError(f"Ticket no encontrado: {ticket_id}")

        if registro["Etiqueta_DBA"].strip():
            raise ValueError(f"Ticket ya validado: {ticket_id}")

        registro["Etiqueta_DBA"] = etiqueta
        registro["Observacion_DBA"] = observacion

    conteos = Counter(
        registro["Etiqueta_DBA"]
        for registro in registros
    )

    if conteos["CORRECT"] != 25 or conteos["INCORRECT"] != 25:
        raise ValueError(f"Distribucion inesperada: {conteos}")

    if len(registros) != sum(conteos.values()):
        raise ValueError("Existen etiquetas DBA no admitidas")

    return columnas,registros


def guardar_csv(ruta,columnas,registros):
    with ruta.open("w",encoding="utf-8-sig",newline="") as archivo:
        escritor = csv.DictWriter(
            archivo,
            fieldnames=columnas,
            delimiter=";",
        )
        escritor.writeheader()
        escritor.writerows(registros)


def evaluar_umbral(etiquetas,puntuaciones,umbral):
    predicciones = (puntuaciones >= umbral).astype(int)

    tn,fp,fn,tp = confusion_matrix(
        etiquetas,
        predicciones,
        labels=[0,1],
    ).ravel()

    aciertos = int(tn+tp)

    print(
        f"Umbral: {umbral:.2f}",
        f"Aciertos: {aciertos}/50",
        f"Falsos positivos: {fp}",
        f"Falsos negativos: {fn}",
    )

    return predicciones


def experimentar_binario(registros):
    caracteristicas = np.array([
        [float(registro["Score_Original"] or 0.0)]
        for registro in registros
    ],dtype=float)

    etiquetas = np.array([
        1 if registro["Etiqueta_DBA"] == "INCORRECT" else 0
        for registro in registros
    ],dtype=int)

    clasificador = make_pipeline(
        StandardScaler(),
        LogisticRegression(
            random_state=42,
            max_iter=1000,
        ),
    )

    probabilidades = cross_val_predict(
        clasificador,
        caracteristicas,
        etiquetas,
        cv=LeaveOneOut(),
        method="predict_proba",
    )[:,1]

    print()
    print("EXPERIMENTO BINARIO - MINILM")
    print("Caracteristica: similitud de categoria original")
    print("Validacion: Leave-One-Out")
    print("Clase positiva: INCORRECT")
    print()

    for umbral in (0.50,0.60,0.70):
        evaluar_umbral(
            etiquetas,
            probabilidades,
            umbral,
        )

    predicciones = evaluar_umbral(
        etiquetas,
        probabilidades,
        UMBRAL_EXPERIMENTAL,
    )

    resultado = []

    for registro,prediccion,puntuacion in zip(
        registros,predicciones,probabilidades
    ):
        fila = dict(registro)

        fila["Resultado_Binario_IA"] = (
            "INCORRECT" if prediccion == 1 else "CORRECT"
        )

        fila["Puntuacion_Incorr_Experimental"] = round(
            float(puntuacion),4
        )

        resultado.append(fila)

    columnas = list(resultado[0]) if resultado else []

    guardar_csv(
        EXPERIMENTO,
        columnas,
        resultado,
    )

    print()
    print("FALSOS POSITIVOS DEL EXPERIMENTO")

    for fila in resultado:
        if (
            fila["Etiqueta_DBA"] == "CORRECT"
            and fila["Resultado_Binario_IA"] == "INCORRECT"
        ):
            print(
                fila["Ticket_ID"],
                fila["Puntuacion_Incorr_Experimental"],
            )

    print()
    print("Archivo experimental:",EXPERIMENTO.resolve())


def ejecutar():
    columnas,registros = cargar_y_validar()

    guardar_csv(
        VALIDADO,
        columnas,
        registros,
    )

    print("VALIDACION DBA COMPLETA")
    print("Total:",len(registros))
    print("CORRECT:",25)
    print("INCORRECT:",25)
    print("REVIEW DBA:",0)
    print("Pendientes:",0)
    print("Archivo validado:",VALIDADO.resolve())

    experimentar_binario(registros)
    print("Escrituras SQL Server: ninguna")


if __name__ == "__main__":
    ejecutar()
