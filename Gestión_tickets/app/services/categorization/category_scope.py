
from __future__ import annotations

import unicodedata

from dataclasses import dataclass
from typing import Iterable, Literal


# 1. REGLAS GENERALES DE CATEGORIZACIÓN

# Tipos de actividad utilizados para identificar la
# familia principal de cada categoria del catálogo.
# No representan grupos resolutores específicos.

TIPOS_ACTIVIDAD = (
    "Administracion",
    "Consultoria",
    "Implementacion",
    "PreVenta",
    "Operacion",
)

# Categoría transversal para todos los grupos.

CATEGORIA_GENERICA = "Actividades Genericas"


EstadoAlcance = Literal[
    "PERMITIDA",
    "FUERA_DE_ALCANCE",
    "SIN_CATEGORIA",
]


@dataclass(frozen=True, slots=True)
class CategoryScope:
    grupo_resolutor: str
    familia_catalogo: str
    niveles_1_permitidos: frozenset[str]
    tipo_coincidencia: str


# 2. NORMALIZACIÓN

def normalizar_valor(valor: str | None) -> str:
    """
    Normaliza texto sin modificar los valores originales.

    - Elimina espacios repetidos.
    - Convierte a minúsculas.
    - Elimina diferencias de tildes.
    """

    if not valor:
        return ""

    texto = " ".join(str(valor).split()).casefold()

    texto = unicodedata.normalize("NFKD", texto)

    return "".join(
        caracter
        for caracter in texto
        if not unicodedata.combining(caracter)
    )


# 3. IDENTIFICAR ACTIVIDADES GENÉRICAS

def es_actividad_generica(
    nivel_1: str | None,
) -> bool:

    return normalizar_valor(nivel_1) == normalizar_valor(
        CATEGORIA_GENERICA
    )


# 4. EXTRAER FAMILIA DESDE NIVEL 1

def extraer_familia(
    nivel_1: str | None,
) -> str:
    """
    Identifica la familia principal de una categoría.

    Ejemplos:
        APLICACIONES SAP Administracion
            -> aplicaciones sap

        Backups y Restores Implementacion
            -> backups y restores

        CECOM Operacion
            -> cecom

    Para nombres con estructura no reconocida,
    conserva el nombre completo normalizado.
    """

    categoria = normalizar_valor(nivel_1)

    if not categoria:
        return ""

    if es_actividad_generica(nivel_1):
        return ""

    for actividad in TIPOS_ACTIVIDAD:

        sufijo = " " + normalizar_valor(actividad)

        if categoria.endswith(sufijo):
            return categoria[:-len(sufijo)]

    return categoria


# 5. RESOLVER LA FAMILIA DEL GRUPO

def _resolver_familia_grupo(
    grupo_resolutor: str,
    categorias: list[str],
) -> tuple[str, str]:
    """
    Relaciona dinámicamente un grupo resolutor
    con una familia presente en el catálogo.

    Prioridades:
        1. Coincidencia exacta.
        2. Grupo compuesto con una familia identificable.
        3. Prefijo único para categorías especiales.

    Nunca selecciona entre familias ambiguas.
    """

    grupo = normalizar_valor(grupo_resolutor)

    familias = {
        extraer_familia(categoria)
        for categoria in categorias
        if not es_actividad_generica(categoria)
    }

    familias.discard("")

    if not grupo:
        raise ValueError("El grupo resolutor está vacío.")

    # 1. COINCIDENCIA EXACTA
    if grupo in familias:
        return grupo, "EXACTA"

    # 2. GRUPOS COMPUESTOS
    # Ejemplo:
    # BASE DE DATOS Y EBS -> BASE DE DATOS
    #
    # Solo se acepta una familia inicial identificable.
    # Si el texto adicional identifica otra familia,
    # la relación se considera ambigua.

    compuestas = []

    for familia in familias:

        prefijo = familia + " y "

        if not grupo.startswith(prefijo):
            continue

        restante = grupo[len(prefijo):].strip()

        if not restante:
            continue

        if restante in familias:
            raise ValueError(
                "El grupo resolutor combina varias familias: "
                f"{grupo_resolutor}"
            )

        compuestas.append(familia)

    if len(compuestas) == 1:
        return compuestas[0], "GRUPO_COMPUESTO"

    if len(compuestas) > 1:
        raise ValueError(
            "No es posible identificar una única familia "
            f"para {grupo_resolutor}."
        )

    # 3. CATEGORÍAS DE ESTRUCTURA ESPECIAL
    # Permite reconocer un grupo cuyo nombre es el prefijo
    # de una sola categoría no estándar.
    # Si aparecen múltiples familias, no adivina.

    posibles = {
        extraer_familia(categoria)
        for categoria in categorias
        if not es_actividad_generica(categoria)
        and normalizar_valor(categoria).startswith(grupo + " ")
    }

    if len(posibles) == 1:
        return next(iter(posibles)), "PREFIJO_UNICO"

    raise ValueError(
        "No se pudo determinar una familia única para "
        f"el grupo resolutor: {grupo_resolutor}. "
        "Se requiere revisar la correspondencia con el catálogo."
    )


# 6. OBTENER ALCANCE DINÁMICO

def obtener_alcance(
    grupo_resolutor: str,
    categorias_nivel_1: Iterable[str],
) -> CategoryScope:
    """
    Construye las categorías permitidas utilizando
    los niveles 1 existentes en el catálogo.

    No contiene categorías específicas por grupo.
    No realiza consultas SQL.
    No modifica la base de datos.
    """

    # Eliminar valores vacíos y duplicados normalizados.
    categorias_por_clave = {}

    for categoria in categorias_nivel_1:

        clave = normalizar_valor(categoria)

        if clave:
            categorias_por_clave.setdefault(
                clave,
                " ".join(categoria.split()),
            )

    categorias = list(categorias_por_clave.values())

    if not categorias:
        raise ValueError(
            "No se recibieron categorías del catálogo."
        )

    familia, coincidencia = _resolver_familia_grupo(
        grupo_resolutor,
        categorias,
    )

    permitidas = set()

    for categoria in categorias:

        if es_actividad_generica(categoria):
            permitidas.add(categoria)
            continue

        familia_categoria = extraer_familia(categoria)

        # Coincidencia normal de familia.
        if familia_categoria == familia:
            permitidas.add(categoria)
            continue

        # Admitir nuevos tipos de actividad todavía
        # no incluidos en TIPOS_ACTIVIDAD, siempre que
        # comiencen con la familia seleccionada.
        #
        # Evita incluir una subfamilia reconocida
        # como distinta por sus sufijos conocidos.

        categoria_normalizada = normalizar_valor(categoria)

        if (
            familia_categoria == categoria_normalizada
            and categoria_normalizada.startswith(
                familia + " "
            )
        ):
            permitidas.add(categoria)

    if not any(
        not es_actividad_generica(categoria)
        for categoria in permitidas
    ):
        raise ValueError(
            f"No existen categorías específicas para "
            f"el grupo {grupo_resolutor}."
        )

    return CategoryScope(
        grupo_resolutor=grupo_resolutor,
        familia_catalogo=familia,
        niveles_1_permitidos=frozenset(permitidas),
        tipo_coincidencia=coincidencia,
    )


# 7. VALIDAR CATEGORÍA NIVEL 1

def validar_nivel_1(
    grupo_resolutor: str,
    nivel_1: str | None,
    alcance: CategoryScope,
) -> EstadoAlcance:
    """
    Valida el nivel 1 contra el alcance dinámico
    previamente calculado.
    """

    if (
        normalizar_valor(grupo_resolutor)
        != normalizar_valor(alcance.grupo_resolutor)
    ):
        raise ValueError(
            "El alcance no corresponde al grupo resolutor."
        )

    categoria = normalizar_valor(nivel_1)

    if not categoria:
        return "SIN_CATEGORIA"

    permitidas = {
        normalizar_valor(valor)
        for valor in alcance.niveles_1_permitidos
    }

    if categoria in permitidas:
        return "PERMITIDA"

    return "FUERA_DE_ALCANCE"


# 8. VALIDACIÓN BOOLEANA

def es_categoria_permitida(
    grupo_resolutor: str,
    nivel_1: str | None,
    alcance: CategoryScope,
) -> bool:

    return validar_nivel_1(
        grupo_resolutor,
        nivel_1,
        alcance,
    ) == "PERMITIDA"
