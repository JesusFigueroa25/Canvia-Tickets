
import re
from datetime import date, datetime, timedelta

import pandas as pd

from app.etl.etl import cargar_excel
from app.etl.validator import (
    ETLValidationError,
    validar_columnas,
    validar_tipo_archivo,
)


COLUMNAS_EXCEL_SQL = {
    "ID del ticket": "Ticket_ID",
    "Fecha de creación": "Fecha_Creacion",
    "ticket_type": "Ticket_type",
    "Asignar al grupo": "Grupo_Resolutor",
    "Asignar al individuo": "Nombre_Resolutor",
    "Motivo": "Motivo_Resolucion",
    "Estado": "Estado",
    "Organización del solicitante": "Proyecto",
}

COLUMNAS_EXCEL = list(COLUMNAS_EXCEL_SQL.keys())
COLUMNAS_SQL = list(COLUMNAS_EXCEL_SQL.values())

LONGITUDES = {
    "Ticket_ID": 20,
    "Ticket_type": 50,
    "Grupo_Resolutor": 150,
    "Nombre_Resolutor": 150,
    "Motivo_Resolucion": 150,
    "Estado": 50,
    "Proyecto": 200,
}

MESES = {
    "jan": 1, "feb": 2, "mar": 3,
    "apr": 4, "may": 5, "jun": 6,
    "jul": 7, "aug": 8, "sep": 9,
    "oct": 10, "nov": 11, "dec": 12,
}


def _limpiar_texto(serie: pd.Series) -> pd.Series:
    texto = serie.astype("string").str.strip()
    return texto.mask(texto.eq(""))


def _convertir_fecha(valor):

    if valor is None or pd.isna(valor):
        return None

    if isinstance(valor, pd.Timestamp):
        return valor.to_pydatetime().replace(microsecond=0)

    if isinstance(valor, datetime):
        return valor.replace(microsecond=0)

    if isinstance(valor, date):
        return datetime.combine(valor, datetime.min.time())

    if isinstance(valor, (int, float)) and not isinstance(valor, bool):
        try:
            return (
                datetime(1899, 12, 30)
                + timedelta(days=float(valor))
            ).replace(microsecond=0)
        except (OverflowError, ValueError) as exc:
            raise ETLValidationError(
                f"Fecha de creación inválida: {valor}"
            ) from exc

    texto = str(valor).strip()

    if not texto:
        return None

    patron = re.fullmatch(
        r"(\d{1,2})-([A-Za-z]{3})-(\d{4})\s+"
        r"(\d{1,2}):(\d{2})(?::(\d{2}))?",
        texto
    )

    if patron:
        dia = int(patron.group(1))
        mes = MESES.get(patron.group(2).lower())
        anio = int(patron.group(3))
        hora = int(patron.group(4))
        minuto = int(patron.group(5))
        segundo = int(patron.group(6) or 0)

        if mes is None:
            raise ETLValidationError(
                f"Mes inválido: {texto}"
            )

        try:
            return datetime(
                anio, mes, dia, hora, minuto, segundo
            )
        except ValueError as exc:
            raise ETLValidationError(
                f"Fecha inválida: {texto}"
            ) from exc

    formatos = [
        "%Y-%m-%d %H:%M:%S",
        "%Y-%m-%d %H:%M",
        "%Y-%m-%d",
        "%d/%m/%Y %H:%M:%S",
        "%d/%m/%Y %H:%M",
        "%d/%m/%Y",
    ]

    for formato in formatos:
        try:
            return datetime.strptime(texto, formato)
        except ValueError:
            pass

    raise ETLValidationError(
        f"Formato de fecha no reconocido: {texto}"
    )


def _validar_longitudes(df: pd.DataFrame) -> None:

    for columna, limite in LONGITUDES.items():

        excedidas = (
            df[columna]
            .astype("string")
            .str.len()
            .gt(limite)
            .fillna(False)
        )

        if excedidas.any():
            tickets = df.loc[
                excedidas, "Ticket_ID"
            ].head(5).tolist()

            raise ETLValidationError(
                f"'{columna}' supera {limite} caracteres. "
                f"Tickets: {tickets}"
            )


def procesar_tickets_manual_updates(archivo):
    """
    Regla definitiva:
    - Importar todos los tipos de ticket.
    - Conservar solamente ocho campos de negocio.
    - Mantener la primera aparición de cada Ticket_ID.
    - Eliminar las siguientes sin comparar sus valores.
    - Retornar los tickets únicos y los duplicados eliminados.
    """

    # 1. LEER EXCEL
    df = cargar_excel(archivo, sheet_name=0)
    filas_excel = len(df)

    if df.empty:
        raise ETLValidationError(
            "El Excel de tickets manuales está vacío."
        )

    df.columns = [
        str(columna).strip()
        for columna in df.columns
    ]

    if df.columns.duplicated().any():
        raise ETLValidationError(
            "El Excel contiene encabezados duplicados."
        )

    # 2. VALIDACIONES DEL ARCHIVO
    validar_tipo_archivo(
        df,
        [
            "ID del ticket",
            "Fecha de creación",
            "ticket_type",
            "Asignar al individuo",
        ],
        "El archivo no corresponde al reporte "
        "de tickets modificados manualmente."
    )

    validar_columnas(df, COLUMNAS_EXCEL)

    # 3. CONSERVAR LOS OCHO CAMPOS
    df = df[COLUMNAS_EXCEL].copy()
    df = df.reset_index(drop=True)

    df.insert(
        0,
        "Fila_Excel",
        df.index + 2
    )

    df.rename(
        columns=COLUMNAS_EXCEL_SQL,
        inplace=True
    )

    # 4. NORMALIZAR TEXTOS
    for columna in COLUMNAS_SQL:

        if columna != "Fecha_Creacion":
            df[columna] = _limpiar_texto(df[columna])

    # 5. VALIDAR IDENTIFICADORES
    invalidos = df["Ticket_ID"].isna()

    if invalidos.any():
        raise ETLValidationError(
            f"Existen {int(invalidos.sum())} "
            "filas sin Ticket_ID."
        )

    # 6. VALIDAR TIPO DE TICKET
    sin_tipo = df["Ticket_type"].isna()

    if sin_tipo.any():
        raise ETLValidationError(
            f"Existen {int(sin_tipo.sum())} "
            "filas sin ticket_type."
        )

    # 7. ELIMINAR DUPLICADOS POR TICKET_ID
    # keep='first' conserva la primera aparición original.
    duplicados = int(
        df["Ticket_ID"].duplicated(keep="first").sum()
    )

    df = df.drop_duplicates(
        subset=["Ticket_ID"],
        keep="first"
    ).copy()

    # 8. CONVERTIR FECHAS DE LAS FILAS CONSERVADAS
    fechas = []

    for fila_excel, valor in zip(
        df["Fila_Excel"],
        df["Fecha_Creacion"]
    ):
        try:
            fechas.append(_convertir_fecha(valor))
        except ETLValidationError as exc:
            raise ETLValidationError(
                f"Fila {fila_excel}: {exc}"
            ) from exc

    df["Fecha_Creacion"] = fechas

    # 9. VALIDAR LONGITUDES SQL SERVER
    _validar_longitudes(df)

    # 10. VERIFICAR UNICIDAD
    if df["Ticket_ID"].duplicated().any():
        raise ETLValidationError(
            "Persisten Ticket_ID duplicados."
        )

    # 11. RETORNAR
    df = df[
        ["Fila_Excel", *COLUMNAS_SQL]
    ].reset_index(drop=True)

    return df, filas_excel, duplicados
