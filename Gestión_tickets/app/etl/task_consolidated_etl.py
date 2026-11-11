import pandas as pd

from app.etl.etl import (
    cargar_excel,
    seleccionar_columnas,
    renombrar_columnas,
    convertir_fecha,
)

from app.etl.validator import (
    ETLValidationError,
    validar_columnas,
    validar_tipo_archivo,
)


# 1. COLUMNAS DEL EXCEL
COLUMNAS_TASK_CONSOLIDATED = [
    "Numero de Ticket",
    "Ticket Padre",
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
]


# 2. MAPEO EXCEL -> SQL SERVER
COLUMNAS_RENOMBRAR_TASK_CONSOLIDATED = {
    "Numero de Ticket": "Ticket_ID",
    "Ticket Padre": "Ticket_Padre",
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
}


COLUMNAS_FECHA_TASK = [
    "Fecha_Apertura",
    "Fecha_Resolucion",
    "Fecha_Cierre",
    "Fecha_Ultima_Modificacion",
]

# 3. LONGITUDES MAXIMAS SQL SERVER
LONGITUDES_MAXIMAS_TASK = {
    "Ticket_ID": 20,
    "Ticket_Padre": 20,
    "Proyecto": 200,
    "ALP": 30,
    "BU": 50,
    "Grupo_Resolutor": 150,
    "Nombre_Resolutor": 150,
    "Categorizacion_Nivel_1": 150,
    "Categorizacion_Nivel_2": 150,
    "Categorizacion_Nivel_3": 200,
    "Prioridad": 30,
    "Urgencia": 30,
    "Impacto": 30,
    "Estado": 50,
    "Motivo_Estado": 100,
    "Descripcion": 1000,
    "Fuente_Reportada": 100,
}


# 4. NORMALIZAR IDENTIFICADORES
def _limpiar_texto_identificador(serie: pd.Series) -> pd.Series:
    resultado = serie.astype("string").str.strip()
    return resultado.mask(resultado.eq(""), pd.NA)


# 5. RESOLVER DUPLICADOS POR ALP Y PROYECTO

def _resolver_duplicados_por_alp(
    df: pd.DataFrame
) -> tuple[pd.DataFrame, int]:

    if df.empty:
        return df.copy(), 0

    trabajo = df.copy()

    # Mantener el orden original del Excel
    trabajo["_orden_excel"] = range(len(trabajo))

    # Extraer el código inicial de Proyecto
    # Ejemplo: 105162 GRUPO ROMERO PROY SD SMARTDESK
    codigo_proyecto = (
        trabajo["Proyecto"]
        .astype("string")
        .str.extract(
            r"^\s*(\d+)(?=\s|$)",
            expand=False
        )
    )

    # Normalizar ALP para comparar
    alp_comparable = _limpiar_texto_identificador(
        trabajo["ALP"]
    )

    alp_comparable = alp_comparable.str.replace(
        r"\.0+$",
        "",
        regex=True
    )

    # Identificar filas donde ALP coincide con Proyecto
    trabajo["_coincide_alp_proyecto"] = (
        alp_comparable.notna()
        & codigo_proyecto.notna()
        & alp_comparable.eq(codigo_proyecto)
    ).fillna(False)

    # Primero coincidencias ALP/Proyecto
    # Después se respeta el orden original
    trabajo = trabajo.sort_values(
        [
            "_coincide_alp_proyecto",
            "_orden_excel"
        ],
        ascending=[False, True],
        kind="stable"
    )

    # Conservar un solo registro por Ticket_ID
    trabajo = trabajo.drop_duplicates(
        subset=["Ticket_ID"],
        keep="first"
    )

    # Recuperar el orden original de los seleccionados
    trabajo = trabajo.sort_values(
        "_orden_excel",
        kind="stable"
    )

    duplicados_eliminados = len(df) - len(trabajo)

    trabajo = trabajo.drop(
        columns=[
            "_orden_excel",
            "_coincide_alp_proyecto"
        ]
    )

    return (
        trabajo.reset_index(drop=True),
        duplicados_eliminados
    )


# 6. VALIDAR LONGITUDES
def _validar_longitudes(df: pd.DataFrame) -> None:

    for columna, limite in LONGITUDES_MAXIMAS_TASK.items():

        longitudes = (
            df[columna]
            .astype("string")
            .str.len()
        )

        excedidos = longitudes.gt(limite).fillna(False)

        if excedidos.any():

            ejemplos = (
                df.loc[excedidos, "Ticket_ID"]
                .head(5)
                .tolist()
            )

            raise ETLValidationError(
                f"La columna {columna} supera "
                f"{limite} caracteres en "
                f"{int(excedidos.sum())} registros. "
                f"Tickets: {ejemplos}"
            )


# 7. ETL PRINCIPAL - TAREAS CONSOLIDADAS
def procesar_task_consolidated(archivo):

    # 1. CARGAR EXCEL
    df = cargar_excel(
        archivo,
        sheet_name=0
    )

    filas_excel = len(df)

    # 2. VALIDAR TIPO DE ARCHIVO
    validar_tipo_archivo(
        df,
        [
            "Numero de Ticket",
            "Ticket Padre",
            "Nivel 3 Categorizacion"
        ],
        "El archivo no corresponde a Consolidado "
        "de Tareas - Error de archivo"
    )

    # 3. VALIDAR COLUMNAS
    validar_columnas(
        df,
        COLUMNAS_TASK_CONSOLIDATED
    )

    if df.empty:
        raise ETLValidationError(
            "El archivo de Tareas no contiene registros"
        )

    # 4. SELECCIONAR COLUMNAS
    df = seleccionar_columnas(
        df,
        COLUMNAS_TASK_CONSOLIDATED
    )

    # 5. RENOMBRAR COLUMNAS
    df = renombrar_columnas(
        df,
        COLUMNAS_RENOMBRAR_TASK_CONSOLIDATED
    )

    # 6. NORMALIZAR IDENTIFICADORES
    for columna in (
        "Ticket_ID",
        "Ticket_Padre",
        "ALP",
        "Proyecto"
    ):
        df[columna] = _limpiar_texto_identificador(
            df[columna]
        )

    # Corregir ALP numéricos interpretados como 105162.0
    df["ALP"] = df["ALP"].str.replace(
        r"\.0+$",
        "",
        regex=True
    )

    # 7. VALIDAR PREFIJO DE TODOS LOS TICKETS
    ids_validos = df["Ticket_ID"].str.startswith(
        "500-",
        na=False
    )

    invalidos = ~ids_validos

    if invalidos.any():

        ejemplos = (
            df.loc[invalidos, "Ticket_ID"]
            .head(5)
            .tolist()
        )

        raise ETLValidationError(
            f"El Excel contiene {int(invalidos.sum())} "
            f"Ticket_ID nulos o que no empiezan "
            f"con '500-'. Ejemplos: {ejemplos}"
        )

    # 8. CONVERTIR FECHAS
    for columna in COLUMNAS_FECHA_TASK:
        df = convertir_fecha(
            df,
            columna
        )

    # 9. RESOLVER DUPLICADOS
    df, duplicados = _resolver_duplicados_por_alp(
        df
    )

    # 10. VALIDAR FECHA DE APERTURA OBLIGATORIA
    sin_fecha = df["Fecha_Apertura"].isna()

    if sin_fecha.any():

        ejemplos = (
            df.loc[sin_fecha, "Ticket_ID"]
            .head(5)
            .tolist()
        )

        raise ETLValidationError(
            f"Existen {int(sin_fecha.sum())} tareas "
            f"sin Fecha_Apertura válida. "
            f"Tickets: {ejemplos}"
        )

    # 11. VALIDAR LONGITUDES SQL
    _validar_longitudes(df)

    # 12. VERIFICAR UNICIDAD
    if df["Ticket_ID"].duplicated().any():

        raise ETLValidationError(
            "Persisten Ticket_ID duplicados tras el ETL"
        )

    # 13. RETORNAR RESULTADOS
    return df, filas_excel, duplicados
