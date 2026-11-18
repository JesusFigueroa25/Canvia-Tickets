"""ETL del reporte de ocupabilidad: conserva cada acción del ticket."""
from __future__ import annotations

import hashlib
import json
import re
from datetime import date, datetime, timedelta
from zipfile import BadZipFile
from decimal import Decimal, InvalidOperation
from typing import Any

import pandas as pd
from openpyxl import load_workbook
from openpyxl.utils.exceptions import InvalidFileException

from app.etl.validator import ETLValidationError


EXCEL_SQL = {
    "ID del ticket": "Ticket_ID",
    "Tipo de ticket": "Ticket_type",
    "Fecha de creación": "Fecha_Creacion",
    "Organización del solicitante": "Proyecto",
    "Clase": "Categorizacion_Nivel_1",
    "Categoría": "Categorizacion_Nivel_2",
    "Tipo": "Categorizacion_Nivel_3",
    "Autor de la creación": "Autor_created",
    "Asignar al grupo": "Grupo_Resolutor",
    "action_by_last_name": "Resolutor_Apellido",
    "action_by_first_name": "Resolutor_Nombre",
    "Prioridad": "Prioridad",
    "Descripción": "Descripcion",
    "Estado": "Estado",
    "Motivo": "Motivo",
    "Action Start Date": "Action_Start_Date",
    "Action End Date": "Action_End_Date",
    "Segundos": "Segundos",
    "Minutos": "Minutos",
    "Horas": "Horas",
}

COLUMNAS_NEGOCIO = [
    *EXCEL_SQL.values(),
    "Nombre_Resolutor",
]

LONGITUDES = {
    "Ticket_ID": 20,
    "Ticket_type": 50,
    "Proyecto": 200,
    "Categorizacion_Nivel_1": 150,
    "Categorizacion_Nivel_2": 150,
    "Categorizacion_Nivel_3": 200,
    "Autor_created": 200,
    "Grupo_Resolutor": 150,
    "Resolutor_Apellido": 150,
    "Resolutor_Nombre": 150,
    "Nombre_Resolutor": 300,
    "Prioridad": 30,
    "Estado": 50,
    "Motivo": 250,
}

CAMPOS_FECHA = {"Fecha_Creacion", "Action_Start_Date", "Action_End_Date"}
CAMPOS_NUMERICOS = {"Segundos", "Minutos", "Horas"}
OBLIGATORIOS = {"Ticket_ID", "Fecha_Creacion", "Action_Start_Date", "Horas"}

MESES = {
    "jan": 1, "feb": 2, "mar": 3, "apr": 4,
    "may": 5, "jun": 6, "jul": 7, "aug": 8,
    "sep": 9, "oct": 10, "nov": 11, "dec": 12,
}


def _texto(valor: Any) -> str | None:
    if valor is None:
        return None
    texto = str(valor).strip()
    return texto or None


def _fecha(valor: Any) -> datetime | None:
    if valor is None or valor == "":
        return None
    if isinstance(valor, datetime):
        return valor.replace(microsecond=0, tzinfo=None)
    if isinstance(valor, date):
        return datetime(valor.year, valor.month, valor.day)
    if isinstance(valor, (int, float)) and not isinstance(valor, bool):
        try:
            return (datetime(1899, 12, 30) + timedelta(days=float(valor))).replace(microsecond=0)
        except (ValueError, OverflowError) as exc:
            raise ETLValidationError(f"Fecha inválida: {valor}") from exc

    texto = str(valor).strip()
    patron = re.fullmatch(
        r"(\d{1,2})-([A-Za-z]{3})-(\d{4})\s+"
        r"(\d{1,2}):(\d{2})(?::(\d{2}))?", texto
    )
    if patron:
        dia, mes_txt, anio, hora, minuto, segundo = patron.groups()
        mes = MESES.get(mes_txt.lower())
        if mes is None:
            raise ETLValidationError(f"Mes no reconocido: {texto}")
        try:
            return datetime(int(anio), mes, int(dia), int(hora), int(minuto), int(segundo or 0))
        except ValueError as exc:
            raise ETLValidationError(f"Fecha inválida: {texto}") from exc

    for formato in (
        "%Y-%m-%d %H:%M:%S", "%Y-%m-%d %H:%M", "%Y-%m-%d",
        "%d/%m/%Y %H:%M:%S", "%d/%m/%Y %H:%M", "%d/%m/%Y",
    ):
        try:
            return datetime.strptime(texto, formato)
        except ValueError:
            continue
    raise ETLValidationError(f"Formato de fecha no reconocido: {texto}")


def _decimal(valor: Any, decimales: int) -> Decimal | None:
    if valor is None or str(valor).strip() == "":
        return None
    if isinstance(valor, bool):
        raise ETLValidationError("Valor numérico booleano no permitido")
    texto = str(valor).strip().replace(" ", "")
    if "," in texto and "." in texto:
        texto = texto.replace(",", "")
    elif "," in texto:
        texto = texto.replace(",", ".")
    try:
        numero = Decimal(texto).quantize(Decimal(1).scaleb(-decimales))
    except (InvalidOperation, ValueError) as exc:
        raise ETLValidationError(f"Número inválido: {valor}") from exc
    limite = Decimal(10) ** (18 - decimales)
    if not numero.is_finite() or numero < 0 or numero >= limite:
        raise ETLValidationError(f"Número negativo, infinito o fuera de rango: {valor}")
    return numero


def _serializar(valor: Any) -> str | None:
    if valor is None:
        return None
    if isinstance(valor, datetime):
        return valor.isoformat(timespec="seconds")
    if isinstance(valor, Decimal):
        return format(valor, "f")
    return str(valor)


def _hash(valores: list[Any]) -> bytes:
    contenido = json.dumps(
        [_serializar(x) for x in valores],
        ensure_ascii=False, separators=(",", ":"),
    )
    return hashlib.sha256(contenido.encode("utf-8")).digest()


def _leer_archivo_excel(archivo):
    archivo.seek(0)
    try:
        libro = load_workbook(archivo, read_only=True, data_only=True)
    except (BadZipFile, InvalidFileException, OSError, ValueError) as exc:
        raise ETLValidationError("Archivo Excel inválido o dañado") from exc
    try:
        if not libro.worksheets:
            raise ETLValidationError("El Excel no contiene hojas")
        hoja = libro.worksheets[0]
        # Algunos reportes Serviceaide declaran erróneamente dimension A1.
        # Restablecerla permite leer las 23 columnas y todas las filas.
        hoja.reset_dimensions()
        filas = hoja.iter_rows(values_only=True)
        cabecera = next(filas, None)
        if cabecera is None:
            raise ETLValidationError("El archivo Excel está vacío")
        encabezados = [str(x).strip() if x is not None else "" for x in cabecera]
        encabezados_validos = [x for x in encabezados if x]
        if len(set(encabezados_validos)) != len(encabezados_validos):
            raise ETLValidationError("El Excel contiene encabezados duplicados")
        faltantes = [c for c in EXCEL_SQL if c not in encabezados]
        if faltantes:
            raise ETLValidationError(f"Faltan columnas obligatorias del reporte: {faltantes}")

        posiciones = {columna: encabezados.index(columna) for columna in EXCEL_SQL}
        for numero_fila, fila in enumerate(filas, start=2):
            registro = {
                destino: fila[indice] if indice < len(fila) else None
                for origen, destino in EXCEL_SQL.items()
                for indice in [posiciones[origen]]
            }

            # Ignorar filas vacías en las 20 columnas de negocio, aunque
            # tengan notas o formato en columnas adicionales del Excel.
            if all(_texto(valor) is None for valor in registro.values()):
                continue

            # Ignorar pies de página o notas sin datos operativos.
            # Si hay fecha, tipo, proyecto o duración, no se descarta:
            # debe superarse la validación del Ticket_ID obligatorio.
            campos_operativos = (
                "Ticket_type", "Fecha_Creacion", "Proyecto",
                "Action_Start_Date", "Action_End_Date",
                "Segundos", "Minutos", "Horas",
            )
            if (
                _texto(registro["Ticket_ID"]) is None
                and all(_texto(registro[c]) is None for c in campos_operativos)
            ):
                continue

            yield numero_fila, registro
    finally:
        libro.close()


def procesar_tickets_report_times(archivo) -> tuple[pd.DataFrame, int, int]:
    """Retorna (acciones normalizadas, filas_excel, tickets_distintos)."""
    registros: list[dict[str, Any]] = []
    claves_vistas: dict[bytes, int] = {}
    tickets: set[str] = set()

    for fila_excel, registro in _leer_archivo_excel(archivo):
        try:
            for columna in COLUMNAS_NEGOCIO:
                if columna in CAMPOS_FECHA or columna in CAMPOS_NUMERICOS or columna == "Nombre_Resolutor":
                    continue
                registro[columna] = _texto(registro.get(columna))

            for columna in CAMPOS_FECHA:
                registro[columna] = _fecha(registro.get(columna))

            for columna in CAMPOS_NUMERICOS:
                registro[columna] = _decimal(registro.get(columna), 4 if columna == "Horas" else 2)

            for columna in OBLIGATORIOS:
                if registro.get(columna) is None:
                    raise ETLValidationError(f"'{columna}' es obligatorio")

            inicio = registro["Action_Start_Date"]
            fin = registro["Action_End_Date"]
            if fin is not None and fin < inicio:
                raise ETLValidationError("Action End Date es anterior a Action Start Date")

            registro["Nombre_Resolutor"] = " ".join(
                p for p in (registro["Resolutor_Nombre"], registro["Resolutor_Apellido"]) if p
            ) or None

            for columna, limite in LONGITUDES.items():
                valor = registro.get(columna)
                if valor is not None and len(valor) > limite:
                    raise ETLValidationError(f"'{columna}' supera {limite} caracteres")

            # Identidad de la acción. No depende de su duración, estado o proyecto.
            registro["Evento_Clave"] = _hash([
                registro["Ticket_ID"].casefold(),
                registro["Action_Start_Date"],
                (registro["Resolutor_Apellido"] or "").casefold(),
                (registro["Resolutor_Nombre"] or "").casefold(),
            ])
            registro["Contenido_Hash"] = _hash([
                registro[columna] for columna in COLUMNAS_NEGOCIO
            ])

            clave = registro["Evento_Clave"]
            if clave in claves_vistas:
                raise ETLValidationError(
                    "Dos acciones tienen la misma identidad; "
                    f"primera aparición en fila {claves_vistas[clave]}. "
                    "No se eliminará ninguna fila automáticamente"
                )
            claves_vistas[clave] = fila_excel
            tickets.add(registro["Ticket_ID"])
            registros.append({"Fila_Excel": fila_excel, **registro})
        except (ETLValidationError, TypeError, ValueError) as exc:
            raise ETLValidationError(f"Fila {fila_excel}: {exc}") from exc

    if not registros:
        raise ETLValidationError("El Excel no contiene acciones válidas")

    columnas = ["Fila_Excel", *COLUMNAS_NEGOCIO, "Evento_Clave", "Contenido_Hash"]
    df = pd.DataFrame.from_records(registros, columns=columnas)
    return df, len(registros), len(tickets)
