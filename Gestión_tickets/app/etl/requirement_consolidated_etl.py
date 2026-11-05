import pandas as pd
from app.etl.etl import (cargar_excel,seleccionar_columnas,renombrar_columnas,convertir_fecha,obtener_duplicados,eliminar_duplicados,)
from app.etl.validator import (validar_columnas,filtrar_ticket_id, validar_prefijo_ticket, validar_tipo_archivo,)


COLUMNAS_REQUIREMENT_CONSOLIDATED = [
    "Numero de ticket",
    "Fecha de apertura",
    "Fecha de finalizacion real",
    "Fecha de cierre",
    "Fecha de ultima modificacion",
    "Proyecto",
    "ALP",
    "BU",
    "Grupo resolutor",
    "Nombre del Resolutor",
    "Nivel 1 de categorizacion",
    "Nivel 2 de categorizacion",
    "Nivel 3 de categorizacion",
    "Prioridad",
    "Urgencia",
    "Impacto",
    "Estado",
    "Motivo de estado",
    "Descripcion",
    "Detalles",
    "Fuente reportada",
    "Solucion del requerimiento",
    "Motivo Resolución",
]


COLUMNAS_RENOMBRAR_REQUIREMENT_CONSOLIDATED = {
    "Numero de ticket": "Ticket_ID",
    "Fecha de apertura": "Fecha_Apertura",
    "Fecha de finalizacion real": "Fecha_Resolucion",
    "Fecha de cierre": "Fecha_Cierre",
    "Fecha de ultima modificacion": "Fecha_Ultima_Modificacion",
    "Grupo resolutor": "Grupo_Resolutor",
    "Nombre del Resolutor": "Nombre_Resolutor",
    "Nivel 1 de categorizacion": "Categorizacion_Nivel_1",
    "Nivel 2 de categorizacion": "Categorizacion_Nivel_2",
    "Nivel 3 de categorizacion": "Categorizacion_Nivel_3",
    "Motivo de estado": "Motivo_Estado",
    "Detalles": "Detalle",
    "Fuente reportada": "Fuente_Reportada",
    "Solucion del requerimiento": "Solucion",
    "Motivo Resolución": "Motivo_Resolucion",
}


def procesar_requirement_consolidated(archivo):

    # 1. Cargar Excel
    df = cargar_excel(
        archivo,
        sheet_name=0
    )
    
    filas_excel = len(df)
    
    validar_tipo_archivo(
        df,["Numero de ticket", "Fecha de finalizacion real", "Solucion del requerimiento"],
        "El archivo no corresponde a Consolidado de Requerimientos - Error de archivo"
    )
    
    validar_prefijo_ticket(
        df,
        "Numero de ticket",
        "100-",
        "El archivo no corresponde a Consolidado de Requerimientos - Error de prefijo"
    )

    # 2. Validar columnas
    validar_columnas(
        df,
        COLUMNAS_REQUIREMENT_CONSOLIDATED
    )

    # 3. Seleccionar columnas
    df = seleccionar_columnas(
        df,
        COLUMNAS_REQUIREMENT_CONSOLIDATED
    )

    # 4. Renombrar columnas
    df = renombrar_columnas(
        df,
        COLUMNAS_RENOMBRAR_REQUIREMENT_CONSOLIDATED
    )

    # 6. Convertir fechas
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

    # 7. Solo tickets de requerimientos
    df = filtrar_ticket_id(
        df,
        "100-"
    )

    # 8. Revisar duplicados
    df_duplicados = obtener_duplicados(df)

    filas_antes = len(df)

    # 9. Eliminar duplicados
    df = eliminar_duplicados(df)

    duplicados = filas_antes - len(df)

    return df, filas_excel, duplicados