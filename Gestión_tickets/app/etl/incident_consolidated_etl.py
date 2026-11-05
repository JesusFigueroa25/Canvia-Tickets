from app.etl.etl import (cargar_excel, seleccionar_columnas, renombrar_columnas,convertir_fecha,obtener_duplicados,eliminar_duplicados,)
from app.etl.validator import (validar_columnas, filtrar_ticket_id, validar_prefijo_ticket, validar_tipo_archivo,)


COLUMNAS_INCIDENT_CONSOLIDATED = [
    "Numero de Ticket",
    "Fecha de apertura",
    "Fecha de resolucion",
    "Fecha de cierre",
    "Fecha de ultima modificacion",
    "Proyecto",
    "ALP",
    "BU",
    "Grupo resolutor",
    "Nombre del resolutor",
    "Nivel 1 Categorizacion",
    "Nivel 2 Categorizacion",
    "Nivel 3 Categorizacion",
    "Prioridad",
    "Urgencia",
    "Impacto",
    "Estado",
    "Motivo de estado",
    "Descripcion",
    "Detalle",
    "Fuente reportada",
    "Solucion del Incidente",
    "Causa del Incidente",
    "Motivo Resolución",
]


COLUMNAS_RENOMBRAR_INCIDENT_CONSOLIDATED = {
    "Numero de Ticket": "Ticket_ID",
    "Fecha de apertura": "Fecha_Apertura",
    "Fecha de resolucion": "Fecha_Resolucion",
    "Fecha de cierre": "Fecha_Cierre",
    "Fecha de ultima modificacion": "Fecha_Ultima_Modificacion",
    "Grupo resolutor": "Grupo_Resolutor",
    "Nombre del resolutor": "Nombre_Resolutor",
    "Nivel 1 Categorizacion": "Categorizacion_Nivel_1",
    "Nivel 2 Categorizacion": "Categorizacion_Nivel_2",
    "Nivel 3 Categorizacion": "Categorizacion_Nivel_3",
    "Motivo de estado": "Motivo_Estado",
    "Fuente reportada": "Fuente_Reportada",
    "Solucion del Incidente": "Solucion",
    "Causa del Incidente": "Causa",
    "Motivo Resolución": "Motivo_Resolucion",
}


def procesar_incident_consolidated(archivo):

    # 1. Cargar Excel
    df = cargar_excel(
        archivo,
        sheet_name=0
    )
    
    filas_excel = len(df)
    
    validar_tipo_archivo(
        df,["Numero de Ticket", "Causa del Incidente"],
        "El archivo no corresponde a Consolidado de Incidentes - Error de archivo"
    )
    
    validar_prefijo_ticket(
        df,
        "Numero de Ticket",
        "300-",
        "El archivo no corresponde a Consolidado de Incidentes - Error de prefijo"
    )
    
    # 2. Validar que existan columnas
    validar_columnas(
        df,
        COLUMNAS_INCIDENT_CONSOLIDATED
    )

    # 3. Seleccionar columnas
    df = seleccionar_columnas(
        df,
        COLUMNAS_INCIDENT_CONSOLIDATED
    )

    # 4. Renombrar columnas
    df = renombrar_columnas(
        df,
        COLUMNAS_RENOMBRAR_INCIDENT_CONSOLIDATED
    )

    # 5. Convertir fechas
    df = convertir_fecha(
        df,
        "Fecha_Apertura"
    )

    df = convertir_fecha(
        df,
        "Fecha_Resolucion"
    )

    df = convertir_fecha(
        df,
        "Fecha_Cierre"
    )

    df = convertir_fecha(
        df,
        "Fecha_Ultima_Modificacion"
    )

    # 6. Solo tickets de Incidentes
    df = filtrar_ticket_id(
        df,
        "300-"
    )

    # 8. Revisar duplicados
    df_duplicados = obtener_duplicados(df)

    # Cantidad antes de eliminar duplicados
    filas_antes = len(df)

    # 9. Eliminar duplicados
    df = eliminar_duplicados(df)

    # Cantidad de duplicados realmente eliminados
    duplicados = filas_antes - len(df)

    return df, filas_excel, duplicados