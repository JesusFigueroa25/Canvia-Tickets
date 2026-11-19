"""Lectura y validación de Excel de Cambios Consolidados (tickets 200-).

Regla de deduplicación (igual que en task_consolidated_etl):
- Un registro por Ticket_ID.
- Preferir ALP == código numérico al inicio de Proyecto.
- En empates o ausencia de coincidencias, primera fila del Excel.
"""

from datetime import date, datetime, timedelta
from decimal import Decimal, InvalidOperation

import pandas as pd

from app.etl.validator import ETLValidationError, validar_columnas, validar_tipo_archivo


# IMPORTANTE: conservar los nombres reales del Excel, incluido "Detaile".
# El encabezado " Individuo Asignado" se normaliza con strip().
EXCEL_SQL = {
    "ID del Ticket": "Ticket_ID",
    "Fecha de creación": "Fecha_Creacion",
    "InicioPropuesto": "Fecha_Inicio_Propuesta",
    "FinPropuesto": "Fecha_Fin_Propuesta",
    "Fecha de inicio planificada": "Fecha_Inicio_Planificada",
    "Fecha de fin planificada": "Fecha_Fin_Planificada",
    "Fecha de Inicio real": "Fecha_Inicio_Real",
    "Fecha de fin real": "Fecha_Fin_Real",
    "Fecha ultimo Worklog": "Fecha_Ultimo_Worklog",
    "ALP": "ALP",
    "Proyecto": "Proyecto",
    "BU": "BU",
    "Grupo asignado": "Grupo_Resolutor",
    "Individuo Asignado": "Nombre_Resolutor",
    "Clase": "Categorizacion_Nivel_1",
    "Categoria": "Categorizacion_Nivel_2",
    "Tipo": "Categorizacion_Nivel_3",
    "Prioridad": "Prioridad",
    "Urgencia": "Urgencia",
    "Impacto": "Impacto",
    "Phase": "Phase",
    "Estado": "Estado",
    "Motivo": "Motivo",
    "Tipo de Cambio": "Tipo_Cambio",
    "Descripcion": "Descripcion",
    "Detaile": "Detalle",
    "Fuente": "Fuente",
    "Valor de riesgo": "Valor_Riesgo",
    "Autor de la creación": "Autor_Creacion",
    "Codigo de Cierre del Cambio": "Codigo_Cierre_Cambio",
    "Motivo de Cancelacion del Cambio": "Motivo_Cancelacion_Cambio",
}

COLUMNAS_SQL = list(EXCEL_SQL.values())
COLUMNAS_FECHA = (
    "Fecha_Creacion",
    "Fecha_Inicio_Propuesta",
    "Fecha_Fin_Propuesta",
    "Fecha_Inicio_Planificada",
    "Fecha_Fin_Planificada",
    "Fecha_Inicio_Real",
    "Fecha_Fin_Real",
    "Fecha_Ultimo_Worklog",
)
LONGITUDES = {
    "Ticket_ID": 20,
    "ALP": 30,
    "Proyecto": 200,
    "BU": 50,
    "Grupo_Resolutor": 150,
    "Nombre_Resolutor": 150,
    "Categorizacion_Nivel_1": 150,
    "Categorizacion_Nivel_2": 150,
    "Categorizacion_Nivel_3": 200,
    "Prioridad": 30,
    "Urgencia": 30,
    "Impacto": 30,
    "Phase": 100,
    "Estado": 50,
    "Motivo": 250,
    "Tipo_Cambio": 50,
    "Descripcion": 1000,
    "Fuente": 100,
    "Autor_Creacion": 200,
    "Codigo_Cierre_Cambio": 150,
    "Motivo_Cancelacion_Cambio": 250,
}


def _texto(serie: pd.Series) -> pd.Series:
    datos = serie.astype("string").str.strip()
    return datos.mask(datos.eq(""), pd.NA)


def _fecha(valor):
    """Convierte fechas de Excel, nativos de Python o textos explícitos.

    No se descartan silenciosamente fechas inválidas: se informa del error.
    """
    if valor is None or pd.isna(valor):
        return None
    if isinstance(valor, (pd.Timestamp, datetime)):
        return pd.Timestamp(valor).round("s").to_pydatetime().replace(tzinfo=None)
    if isinstance(valor, date):
        return datetime.combine(valor, datetime.min.time())
    if isinstance(valor, (int, float, Decimal)) and not isinstance(valor, bool):
        try:
            fecha = datetime(1899, 12, 30) + timedelta(days=float(valor))
            return pd.Timestamp(fecha).round("s").to_pydatetime()
        except (ValueError, OverflowError, TypeError) as error:
            raise ETLValidationError(f"Fecha Excel inválida: {valor}") from error
    texto = str(valor).strip()
    if not texto:
        return None
    for formato in (
        "%d/%m/%Y %H:%M:%S", "%d/%m/%Y %H:%M", "%d/%m/%Y",
        "%Y-%m-%d %H:%M:%S", "%Y-%m-%d %H:%M", "%Y-%m-%d",
        "%d-%b-%Y %H:%M:%S", "%d-%b-%Y %H:%M",
    ):
        try:
            return datetime.strptime(texto, formato)
        except ValueError:
            continue
    raise ETLValidationError(f"Formato de fecha no reconocido: {texto!r}")


def _riesgo(valor) -> int | None:
    if valor is None or pd.isna(valor):
        return None
    texto = str(valor).strip()
    if not texto:
        return None
    try:
        numero = Decimal(texto)
    except (InvalidOperation, ValueError) as error:
        raise ETLValidationError(f"Valor_Riesgo no numérico: {valor!r}") from error
    if not numero.is_finite() or numero != numero.to_integral_value() or not 0 <= numero <= 255:
        raise ETLValidationError(f"Valor_Riesgo fuera del rango TINYINT: {valor!r}")
    return int(numero)


def _resolver_duplicados_por_alp(df: pd.DataFrame) -> tuple[pd.DataFrame, int]:
    """Prioridad ALP/Proyecto, desempate por la primera aparición en Excel."""
    if df.empty:
        return df.copy(), 0

    trabajo = df.copy()
    trabajo["_orden_excel"] = range(len(trabajo))
    codigo_proyecto = (
        trabajo["Proyecto"].astype("string")
        .str.extract(r"^\s*(\d+)(?=\s|$)", expand=False)
    )
    alp_comparable = (
        _texto(trabajo["ALP"])
        .str.replace(r"\.0+$", "", regex=True)
    )
    trabajo["_coincide_alp_proyecto"] = (
        alp_comparable.notna()
        & codigo_proyecto.notna()
        & alp_comparable.eq(codigo_proyecto)
    ).fillna(False)

    trabajo = trabajo.sort_values(
        ["_coincide_alp_proyecto", "_orden_excel"],
        ascending=[False, True],
        kind="stable",
    ).drop_duplicates(subset=["Ticket_ID"], keep="first")
    trabajo = trabajo.sort_values("_orden_excel", kind="stable")
    eliminados = len(df) - len(trabajo)
    return (
        trabajo.drop(columns=["_orden_excel", "_coincide_alp_proyecto"])
        .reset_index(drop=True),
        eliminados,
    )


def _validar_longitudes(df: pd.DataFrame) -> None:
    for columna, limite in LONGITUDES.items():
        longitudes = df[columna].astype("string").str.len()
        excedidos = longitudes.gt(limite).fillna(False)
        if excedidos.any():
            ejemplos = df.loc[excedidos, "Ticket_ID"].head(5).tolist()
            raise ETLValidationError(
                f"La columna {columna} supera {limite} caracteres "
                f"en {int(excedidos.sum())} registros. Tickets: {ejemplos}"
            )


def _detectar_cabecera(archivo) -> int:
    """Este Excel suele tener título en fila 1 y encabezados en fila 2."""
    archivo.seek(0)
    primeras = pd.read_excel(archivo, sheet_name=0, header=None, nrows=3)
    for indice, fila in primeras.iterrows():
        encabezados = {str(x).strip() for x in fila if pd.notna(x)}
        if {"ID del Ticket", "Fecha de creación", "Tipo de Cambio"}.issubset(encabezados):
            return int(indice)
    raise ETLValidationError(
        "No se encontró la cabecera de Cambios Consolidados "
        "en las tres primeras filas del archivo"
    )


def procesar_change_consolidated(archivo) -> tuple[pd.DataFrame, int, int]:
    """Retorna (tickets únicos normalizados, filas_excel, duplicados eliminados)."""
    encabezado = _detectar_cabecera(archivo)
    archivo.seek(0)
    df = pd.read_excel(archivo, sheet_name=0, header=encabezado)
    filas_excel = len(df)

    df.columns = [str(col).strip() for col in df.columns]
    if df.columns.duplicated().any():
        raise ETLValidationError("El Excel contiene encabezados duplicados")

    validar_tipo_archivo(
        df,
        ["ID del Ticket", "Fecha de creación", "Tipo de Cambio", "Detaile"],
        "El archivo no corresponde a Cambios Consolidados",
    )
    validar_columnas(df, list(EXCEL_SQL))
    if df.empty:
        raise ETLValidationError("El Excel de Cambios no contiene registros")

    df = df[list(EXCEL_SQL)].copy().rename(columns=EXCEL_SQL)

    for columna in COLUMNAS_SQL:
        if columna not in COLUMNAS_FECHA and columna != "Valor_Riesgo":
            df[columna] = _texto(df[columna])

    df["ALP"] = df["ALP"].str.replace(r"\.0+$", "", regex=True)
    validos = df["Ticket_ID"].str.startswith("200-", na=False)
    if (~validos).any():
        ejemplos = df.loc[~validos, "Ticket_ID"].head(5).tolist()
        raise ETLValidationError(
            f"Existen {int((~validos).sum())} tickets sin prefijo '200-' "
            f"o sin Ticket_ID. Ejemplos: {ejemplos}"
        )

    # Resolver duplicados antes de validar el resto de campos.
    # Así una variante descartada no invalida a la fila seleccionada.
    df, duplicados = _resolver_duplicados_por_alp(df)

    # Convertir fechas mostrando Ticket_ID y campo causante ante errores.
    for columna in COLUMNAS_FECHA:
        resultado = []
        for ticket_id, valor in zip(df["Ticket_ID"], df[columna]):
            try:
                resultado.append(_fecha(valor))
            except ETLValidationError as error:
                raise ETLValidationError(f"Ticket {ticket_id}, campo {columna}: {error}") from error
        df[columna] = resultado

    sin_fecha = df["Fecha_Creacion"].isna()
    if sin_fecha.any():
        ejemplos = df.loc[sin_fecha, "Ticket_ID"].head(5).tolist()
        raise ETLValidationError(
            f"Existen {int(sin_fecha.sum())} cambios sin Fecha_Creacion válida. "
            f"Tickets: {ejemplos}"
        )

    riesgos = []
    for ticket_id, valor in zip(df["Ticket_ID"], df["Valor_Riesgo"]):
        try:
            riesgos.append(_riesgo(valor))
        except ETLValidationError as error:
            raise ETLValidationError(f"Ticket {ticket_id}: {error}") from error
    df["Valor_Riesgo"] = riesgos

    _validar_longitudes(df)
    if df["Ticket_ID"].duplicated().any():
        raise ETLValidationError("Persisten Ticket_ID duplicados después del ETL")
    return df[COLUMNAS_SQL].reset_index(drop=True), filas_excel, duplicados
