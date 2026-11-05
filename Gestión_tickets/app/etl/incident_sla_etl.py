from app.etl.etl import (cargar_excel, seleccionar_columnas, renombrar_columnas, convertir_fecha, obtener_duplicados, eliminar_duplicados,)
from app.etl.validator import (validar_columnas, filtrar_ticket_id, validar_prefijo_ticket, validar_tipo_archivo,)

COLUMNAS_INCIDENT_SLA = [
    "Identificador del ticket",
    "Proyecto",
    "GENERAL_DESCRIPTION",
    "GENERAL_DETAILS",
    "GENERAL_DATE_CREATED",
    "Fecha de resolución",
    "Estado",
    "Código de motivo",
    "Prioridad",
    "Usuario resolutor",
    "Grupo resolutor",
    "Categorización - Clase",
    "Categorización - Categoría",
    "Categorización - Tipo",
    "SLA Respuesta - Condición de medición",
    "OLA Respuesta - Condición de medición",
    "SLA Solución - Condición de medición",
    "OLA Solución - Condición de medición",
]

COLUMNAS_RENOMBRAR_INCIDENT_SLA = {
    "Identificador del ticket":                 "Ticket_ID",
    "GENERAL_DESCRIPTION":                      "Descripcion",
    "GENERAL_DETAILS":                          "Detalle",
    "GENERAL_DATE_CREATED":                     "Fecha_Creacion",
    "Fecha de resolución":                      "Fecha_Resolucion",
    "Código de motivo":                         "Codigo_Motivo",
    "Usuario resolutor":                        "Usuario_Resolutor",
    "Grupo resolutor":                          "Grupo_Resolutor",
    "Categorización - Clase":                   "Categorizacion_Clase",
    "Categorización - Categoría":               "Categorizacion_Categoria",
    "Categorización - Tipo":                    "Categorizacion_Tipo",
    "SLA Respuesta - Condición de medición":    "SLA_Respuesta_Condicion",
    "OLA Respuesta - Condición de medición":    "OLA_Respuesta_Condicion",
    "SLA Solución - Condición de medición":     "SLA_Solucion_Condicion",
    "OLA Solución - Condición de medición":     "OLA_Solucion_Condicion",
}

def procesar_incident_sla(archivo):

    # 1. Cargar Excel
    df = cargar_excel(
        archivo,
        sheet_name=2
    )
    
    filas_excel = len(df)

    # 2. Validar tipo de archivo
    validar_tipo_archivo(
        df,
        [
            "Identificador del ticket",
            "SLA Respuesta - Condición de medición",
            "SLA Solución - Condición de medición"
        ],
        "El archivo no corresponde a SLA de Incidentes - Error de archivo"
    )

    validar_prefijo_ticket(
        df,
        "Identificador del ticket",
        "300-",
        "El archivo no corresponde a SLA de Incidentes - Error de prefijo"
    )

    # 3. Validar columnas
    validar_columnas(
        df,
        COLUMNAS_INCIDENT_SLA
    )

    # 4. Seleccionar columnas
    df = seleccionar_columnas(
        df,
        COLUMNAS_INCIDENT_SLA
    )

    # 5. Renombrar columnas
    df = renombrar_columnas(
        df,
        COLUMNAS_RENOMBRAR_INCIDENT_SLA
    )

    # 6. Convertir fechas
    df = convertir_fecha(
        df,
        "Fecha_Creacion"
    )

    df = convertir_fecha(
        df,
        "Fecha_Resolucion"
    )

    # 7. Filtrar tickets
    filas_antes_filtro = len(df)

    df = filtrar_ticket_id(
        df,
        "300-"
    )

    filas_filtradas = filas_antes_filtro - len(df)

    print(f"Filas originales Excel: {filas_excel}")
    print(f"Filas descartadas por filtro: {filas_filtradas}")

    # 8. Revisar duplicados
    df_duplicados = obtener_duplicados(df)
    filas_antes_duplicados = len(df)

    # 9. Eliminar duplicados
    df = eliminar_duplicados(df)

    duplicados = filas_antes_duplicados - len(df)

    print(f"Duplicados eliminados: {duplicados}")
    print(f"Filas procesadas: {len(df)}")

    return df, filas_excel, duplicados

