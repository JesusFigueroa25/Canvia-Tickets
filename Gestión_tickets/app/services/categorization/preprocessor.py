
from __future__ import annotations
import hashlib
import json
import re
import unicodedata
from dataclasses import dataclass
from datetime import date, datetime
from typing import Literal

CampoTexto = Literal["descripcion","detalle","solucion"]

CAMPOS_HASH = (
    "Ticket_ID","Grupo_Resolutor","Nombre_Resolutor","Categorizacion_Nivel_1",
    "Categorizacion_Nivel_2","Categorizacion_Nivel_3","Descripcion","Detalle",
    "Solucion","Estado","Motivo_Estado","Fecha_Resolucion",
)


@dataclass(frozen=True,slots=True)
class FragmentoSemantico:
    campo: CampoTexto
    indice: int
    texto: str


@dataclass(frozen=True,slots=True)
class TicketPreparado:
    ticket_id: str
    nivel_1: str
    nivel_2: str
    nivel_3: str
    ruta_texto: str
    descripcion: str
    detalle: str
    solucion: str
    campos_disponibles: tuple[CampoTexto,...]
    fragmentos: tuple[FragmentoSemantico,...]
    fragmentos_omitidos: int
    tiene_ruta_completa: bool
    source_hash: str


def normalizar_texto(valor: str | None) -> str:
    if valor is None:
        return ""

    if not isinstance(valor,str):
        raise TypeError("El valor del campo debe ser texto o None")

    texto = unicodedata.normalize("NFC",valor).replace("\u00a0"," ")
    texto = texto.replace("\r\n","\n").replace("\r","\n")
    texto = re.sub(r"[\u200b\u200c\u200d\ufeff]","",texto)
    texto = re.sub(r"[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]"," ",texto)
    texto = re.sub(r"[ \t]+"," ",texto)
    texto = re.sub(r"\n[ ]+|[ ]+\n","\n",texto)
    texto = re.sub(r"\n{3,}","\n\n",texto)

    return texto.strip()


def construir_ruta(nivel_1: str | None,nivel_2: str | None,nivel_3: str | None) -> str:
    niveles = (
        ("Clase",normalizar_texto(nivel_1)),
        ("Categoría",normalizar_texto(nivel_2)),
        ("Tipo de actividad",normalizar_texto(nivel_3)),
    )

    return ". ".join(f"{nombre}: {valor}" for nombre,valor in niveles if valor)


def fragmentar_texto(texto: str,max_palabras: int = 65,solapamiento: int = 10,max_caracteres: int = 450) -> list[str]:
    if max_palabras < 1 or max_caracteres < 1 or solapamiento < 0 or solapamiento >= max_palabras:
        raise ValueError("Parámetros de fragmentación inválidos")

    contenido = normalizar_texto(texto)

    if not contenido:
        return []

    palabras = []

    for palabra in contenido.split():
        if len(palabra) <= max_caracteres:
            palabras.append(palabra)
        else:
            palabras.extend(
                palabra[i:i+max_caracteres]
                for i in range(0,len(palabra),max_caracteres)
            )

    fragmentos = []
    inicio = 0

    while inicio < len(palabras):
        fin = inicio
        longitud = 0

        while fin < len(palabras) and fin-inicio < max_palabras:
            siguiente = len(palabras[fin]) + (1 if fin > inicio else 0)

            if longitud + siguiente > max_caracteres:
                break

            longitud += siguiente
            fin += 1

        if fin == inicio:
            fin += 1

        fragmentos.append(" ".join(palabras[inicio:fin]))

        if fin == len(palabras):
            break

        inicio = max(inicio+1,fin-solapamiento)

    return fragmentos


def seleccionar_fragmentos(fragmentos: list[str],limite: int = 8) -> list[tuple[int,str]]:
    if limite < 1:
        raise ValueError("El límite de fragmentos debe ser positivo")

    if len(fragmentos) <= limite:
        return list(enumerate(fragmentos))

    if limite == 1:
        return [(0,fragmentos[0])]

    indices = [
        round(i*(len(fragmentos)-1)/(limite-1))
        for i in range(limite)
    ]

    return [(i,fragmentos[i]) for i in indices]


def calcular_hash_ticket(ticket: object) -> str:
    valores = {}

    for campo in CAMPOS_HASH:
        valor = getattr(ticket,campo,None)

        if isinstance(valor,(datetime,date)):
            valor = valor.isoformat()

        elif valor is not None and not isinstance(valor,(str,int,float,bool)):
            raise TypeError(f"Tipo de dato inválido en {campo}")

        valores[campo] = valor

    serializado = json.dumps(
        valores,
        ensure_ascii=False,
        sort_keys=True,
        separators=(",",":"),
        allow_nan=False,
    )

    return hashlib.sha256(serializado.encode("utf-8")).hexdigest()


def preparar_ticket(ticket: object,max_palabras: int = 65,solapamiento: int = 10,max_caracteres: int = 450,max_fragmentos_por_campo: int = 8) -> TicketPreparado:
    if max_fragmentos_por_campo < 1:
        raise ValueError("max_fragmentos_por_campo debe ser positivo")

    ticket_id = normalizar_texto(getattr(ticket,"Ticket_ID",None))

    if not ticket_id:
        raise ValueError("Ticket_ID es obligatorio")

    nivel_1 = normalizar_texto(getattr(ticket,"Categorizacion_Nivel_1",None))
    nivel_2 = normalizar_texto(getattr(ticket,"Categorizacion_Nivel_2",None))
    nivel_3 = normalizar_texto(getattr(ticket,"Categorizacion_Nivel_3",None))

    descripcion = normalizar_texto(getattr(ticket,"Descripcion",None))
    detalle = normalizar_texto(getattr(ticket,"Detalle",None))
    solucion = normalizar_texto(getattr(ticket,"Solucion",None))

    campos = (
        ("descripcion",descripcion),
        ("detalle",detalle),
        ("solucion",solucion),
    )

    disponibles = tuple(campo for campo,texto in campos if texto)
    fragmentos = []
    omitidos = 0


    vistos_descripcion = set()

    for campo,texto in campos:
        if not texto:
            continue

        partes = fragmentar_texto(
            texto,max_palabras,solapamiento,max_caracteres
        )

        seleccionados = seleccionar_fragmentos(
            partes,max_fragmentos_por_campo
        )

        omitidos += len(partes)-len(seleccionados)

        for indice,parte in seleccionados:
            clave = " ".join(parte.split()).casefold()

            if campo == "detalle" and clave in vistos_descripcion:
                continue

            if campo == "descripcion":
                vistos_descripcion.add(clave)

            fragmentos.append(
                FragmentoSemantico(
                    campo=campo,
                    indice=indice,
                    texto=parte,
                )
            )


    return TicketPreparado(
        ticket_id=ticket_id,
        nivel_1=nivel_1,
        nivel_2=nivel_2,
        nivel_3=nivel_3,
        ruta_texto=construir_ruta(nivel_1,nivel_2,nivel_3),
        descripcion=descripcion,
        detalle=detalle,
        solucion=solucion,
        campos_disponibles=disponibles,
        fragmentos=tuple(fragmentos),
        fragmentos_omitidos=omitidos,
        tiene_ruta_completa=bool(nivel_1 and nivel_2 and nivel_3),
        source_hash=calcular_hash_ticket(ticket),
    )
