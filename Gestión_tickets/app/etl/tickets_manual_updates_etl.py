import re
import hashlib
import json
from collections import Counter
from decimal import Decimal, InvalidOperation
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
    "Date_Work_Created": "Date_Work_Created",
    "work_type": "work_type",
    "work_description": "work_description",
    "work_time_spent (mins)": "work_time_spent_mins",
    "created_by_contact_id": "created_by_contact_id",
    "work_by_first_name": "work_by_first_name",
    "work_by_last_name": "work_by_last_name",
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
    "work_type": 150,
    "work_by_first_name": 150,
    "work_by_last_name": 150,
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


CAMPOS_EVENTO = (
    "Ticket_ID", "Date_Work_Created", "created_by_contact_id",
    "work_by_first_name", "work_by_last_name", "work_type",
    "work_description", "work_time_spent_mins",
)
COLUMNAS_PERSISTENTES = [*COLUMNAS_SQL, "Evento_Clave", "Contenido_Hash"]


def _numero(valor, *, entero=False):
    if valor is None or pd.isna(valor) or not str(valor).strip():
        return None
    texto = str(valor).strip()
    # El export usa coma como separador de miles (p. ej. 1,755).
    if ',' in texto:
        if not re.fullmatch(r'[+-]?\d{1,3}(?:,\d{3})+(?:\.\d+)?', texto):
            raise ETLValidationError(f"Formato numérico no reconocido: {texto}")
        texto = texto.replace(',', '')
    try:
        numero = Decimal(texto)
        if not numero.is_finite():
            raise ValueError
        if entero:
            if numero != numero.to_integral_value() or not 0 <= numero <= 9223372036854775807:
                raise ValueError
            return int(numero)
        # Permitir ajustes negativos: el reporte puede contener correcciones.
        if abs(numero) >= Decimal('10000000000000000') or numero != numero.quantize(Decimal('0.01')):
            raise ValueError
        return abs(numero).quantize(Decimal('0.01')) if numero == 0 else numero.quantize(Decimal('0.01'))
    except (InvalidOperation, ValueError) as exc:
        raise ETLValidationError(f"Valor numérico fuera de rango o precisión: {texto}") from exc


def _canon(valor):
    if valor is None or pd.isna(valor):
        return None
    if isinstance(valor, (datetime, date)):
        return valor.isoformat()
    if isinstance(valor, Decimal):
        return format(valor, 'f')
    if hasattr(valor, 'item'):
        return valor.item()
    return valor


def _hash(valores):
    return hashlib.sha256(json.dumps([_canon(v) for v in valores],
        ensure_ascii=False, separators=(',', ':'), allow_nan=False).encode('utf-8')).digest()


def procesar_tickets_manual_updates(archivo):
    """Una fila por registro de trabajo; nunca descartar por Ticket_ID."""
    df = cargar_excel(archivo, sheet_name=0)
    filas_excel = len(df)
    if df.empty:
        raise ETLValidationError("El Excel de tickets manuales está vacío.")
    df.columns = [str(c).strip() for c in df.columns]
    if df.columns.duplicated().any():
        raise ETLValidationError("El Excel contiene encabezados duplicados.")
    validar_tipo_archivo(df, ["ID del ticket", "Fecha de creación", "ticket_type", "Asignar al individuo"],
                        "El archivo no corresponde al reporte de tickets modificados manualmente.")
    validar_columnas(df, COLUMNAS_EXCEL)
    df = df[COLUMNAS_EXCEL].copy().reset_index(drop=True)
    df.insert(0, "Fila_Excel", df.index + 2)
    df.rename(columns=COLUMNAS_EXCEL_SQL, inplace=True)
    especiales = {"Fecha_Creacion", "Date_Work_Created", "work_time_spent_mins", "created_by_contact_id"}
    for columna in COLUMNAS_SQL:
        if columna not in especiales:
            df[columna] = _limpiar_texto(df[columna])
    df["Ticket_ID"] = df["Ticket_ID"].str.upper()
    for columna in ("Ticket_ID", "Ticket_type"):
        if df[columna].isna().any():
            raise ETLValidationError(f"Existen filas sin {columna}.")
    for columna in especiales:
        valores = []
        for fila, valor in zip(df["Fila_Excel"], df[columna]):
            try:
                if columna in {"Fecha_Creacion", "Date_Work_Created"}:
                    convertido = _convertir_fecha(valor)
                else:
                    convertido = _numero(valor, entero=columna == "created_by_contact_id")
                valores.append(convertido)
            except ETLValidationError as exc:
                raise ETLValidationError(f"Fila {fila}, {columna}: {exc}") from exc
        df[columna] = pd.Series(valores, index=df.index, dtype=object)
    _validar_longitudes(df)
    # Identidad derivada. La ocurrencia distingue filas legítimas idénticas.
    # Ordenar por hash de contenido estabiliza el conjunto frente a reordenamientos.
    registros = df.to_dict(orient='records')
    huellas = [_hash([r[c] for c in CAMPOS_EVENTO]) for r in registros]
    contenidos = [_hash([r[c] for c in COLUMNAS_SQL]) for r in registros]
    orden = sorted(range(len(registros)), key=lambda i: (huellas[i], contenidos[i], i))
    ocurrencias = Counter()
    claves = [None] * len(registros)
    for i in orden:
        huella = huellas[i]
        ocurrencias[huella] += 1
        claves[i] = hashlib.sha256(huella + ocurrencias[huella].to_bytes(8, 'big')).digest()
    df['Evento_Clave'] = claves
    df['Contenido_Hash'] = contenidos
    repetidos_ticket = int(df['Ticket_ID'].duplicated().sum())
    return df[["Fila_Excel", *COLUMNAS_PERSISTENTES]], filas_excel, repetidos_ticket
