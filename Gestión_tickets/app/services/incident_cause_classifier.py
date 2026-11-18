
import re

# ==========================================================
# CANVIA - CLASIFICADOR DE CAUSAS V3
# ==========================================================
# Identifica factores tecnicos documentados.
# NO certifica causas raiz.
# NO establece atribucion Cliente / Canvia.
# NO modifica registros de SQL Server.
# ==========================================================


# ==========================================================
# 1. CATALOGO DE FACTORES TECNICOS
# ==========================================================

# Estructura:
# (categoria, accion_recomendada, patron)

REGLAS = (
    (
        "Logs y registros",
        "Revisar rotación, tamaño y retención de logs.",
        r"/var/log(?:/[\w.\-]+)?|\\logs?\\|"
        r"\blog(?:s|\'s)?\b|\bbit[aá]coras?\b"
    ),
    (
        "Archivos temporales y caché",
        "Identificar el proceso que los genera y evaluar una depuración autorizada.",
        r"\.nuget[\\/]packages\b|\bnode_modules\b|"
        r"\btmp[\w.\-]*\.(?:tmp|txl)\b|"
        r"\\Temp\\|/tmp/|\barchivos?\s+temporales?\b|"
        r"\bcach[eé]\b"
    ),
    (
        "Bases de datos y archivos de datos",
        "Identificar objetos o archivos en crecimiento y revisar capacidad y mantenimiento.",
        r"\btablespace\b|\bdatafile\b|"
        r"\b[\w.\-]+\.(?:mdf|ldf)\b|"
        r"\bcrecimiento\s+(?:natural\s+)?(?:de\s+)?"
        r"(?:los\s+)?(?:objetos|tablas|bases? de datos)\b"
    ),
    (
        "Archivos históricos o retención",
        "Revisar vigencia y política de retención antes de eliminar archivos.",
        r"\barchivos?\s+(?:antiguos?|hist[oó]ricos?)\b|"
        r"\barchivos?\b.{0,85}?\bdesde\s+"
        r"(?:el\s+a[nñ]os?\s+)?20\d{2}\b"
    ),
    (
        "Actualizaciones y parches",
        "Revisar acumulación y mantenimiento de archivos de actualización.",
        r"\bsoftwaredistribution\b|"
        r"\bparchados?\s+antiguos?\b|"
        r"\bparches?\s+(?:antiguos?|acumulados?)\b"
    ),
    (
        "Archivos de usuarios o aplicaciones",
        "Revisar origen y crecimiento de archivos de usuarios o aplicaciones.",
        r"\bcarpeta\s+(?:de\s+)?usuarios?\b|"
        r"\bperfil\s+(?:del?\s+)?usuarios?\b|"
        r"\bcarpeta\s+users?\b|\\Users\\"
    ),
    (
        "Volcados de memoria (DMP)",
        "Revisar tamaño, origen y retención de los archivos DMP.",
        r"\b(?:[\w.\-]+\.dmp|archivos?\s+dmp|"
        r"volcados?\s+de\s+memoria)\b"
    ),
    (
        "Procesos con alto consumo de recursos",
        "Verificar proceso y consumo de CPU o memoria.",
        r"\b(?:procesos?|servicios?|aplicaci[oó]n|"
        r"aplicaciones|java|sqlservr|oracle|mysqld)\b"
    ),
    (
        "Fallas de conectividad",
        "Revisar enlace, red y eventos de conectividad.",
        r"\bp[eé]rdida\s+de\s+conexi[oó]n\b|"
        r"\b(?:falla|corte|ca[ií]da)\s+(?:de\s+)?"
        r"(?:conectividad|enlace|red|wifi)\b"
    ),
    (
        "Fallas de servicios o aplicaciones",
        "Revisar eventos, dependencias y errores del servicio.",
        r"\b(?:servicio|aplicaci[oó]n|proceso|job)\b"
    )
)


REGLAS_COMPILADAS = tuple(
    (
        nombre,
        accion,
        re.compile(patron, re.IGNORECASE)
    )
    for nombre, accion, patron in REGLAS
)


# ==========================================================
# 2. VALIDACIONES CONTEXTUALES
# ==========================================================

# Una recomendacion no constituye por si sola evidencia.
_RECOMENDACION = re.compile(
    r"\b(?:se\s+recomienda|se\s+sugiere|"
    r"se\s+solicita|se\s+propone|"
    r"se\s+deber[ií]a|"
    r"considerar\s+(?:el|la)|"
    r"evaluar\s+(?:el|la))\b",
    re.IGNORECASE
)

# Diagnosticos que describen comportamiento normal.
_NORMAL = re.compile(
    r"\b(?:dentro\s+de\s+(?:los?\s+)?"
    r"rangos?\s+normales?|"
    r"sin\s+inconvenientes?|"
    r"comportamiento\s+normal)\b",
    re.IGNORECASE
)

# Negaciones de evidencia.
_NEGACION = re.compile(
    r"\b(?:no\s+se\s+(?:identific\w*|detect\w*|"
    r"evidenc\w*|observ\w*)|"
    r"sin\s+(?:evidencia|registro)\s+de|"
    r"no\s+se\s+evidencia\s+consumo)\b",
    re.IGNORECASE
)

# Indicadores de ocupacion o crecimiento.
_CONSUMO_ARCHIVOS = re.compile(
    r"(?:\b(?:"
    r"alto\s+consumo|"
    r"consumo\s+(?:elevado|excesivo|alto)|"
    r"mayor\s+(?:consumo|espacio)|"
    r"m[aá]s\s+(?:espacio|consumo)\s+"
    r"(?:ocupan|ocupa|tienen)|"
    r"(?:espacio|consumo)\s+se\s+concentra|"
    r"se\s+concentra\s+(?:el\s+)?"
    r"(?:mayor\s+)?consumo|"
    r"ocupa(?:n)?\s+\d|"
    r"peso\s+de\s+\d|"
    r"increment[oó]?\s+(?:su\s+)?tama[nñ]o|"
    r"crecimient\w*|"
    r"voluminos\w*|"
    r"gran\s+tama[nñ]o|"
    r"mayor\s+almacenamiento|"
    r"mayor\s+parte\s+del\s+(?:disco|espacio)|"
    r"consumo\s+est[aá]\s+asociado|"
    r"consumo\s+se\s+asocia"
    r")\b)",
    re.IGNORECASE
)

# Tamano de archivos documentado.
_TAMANO = re.compile(
    r"\b\d+(?:[.,]\d+)?\s*(?:GB|TB|MB)\b",
    re.IGNORECASE
)

# Categorias que requieren evidencia de almacenamiento.
_ALMACENAMIENTO = {
    "Logs y registros",
    "Archivos temporales y caché",
    "Bases de datos y archivos de datos",
    "Archivos históricos o retención",
    "Actualizaciones y parches",
    "Archivos de usuarios o aplicaciones",
    "Volcados de memoria (DMP)"
}

# Consumo de CPU o memoria.
_RECURSO = re.compile(
    r"\b(?:CPU|RAM|memoria)\b",
    re.IGNORECASE
)

_RECURSO_ALTO = re.compile(
    r"\b(?:alto\s+consumo|uso\s+considerable|"
    r"consumo\s+(?:elevado|excesivo)|"
    r"uso\s+elevado)\b|"
    r"\b(?:8\d|9\d|100)\s*%",
    re.IGNORECASE
)

_MEMORIA_NORMAL = re.compile(
    r"\b(?:cache/buffer|"
    r"buffers?\s+del\s+sistema|"
    r"memoria\s+cach[eé])\b",
    re.IGNORECASE
)

# Relacion causal expresada en los textos.
_CAUSAL = re.compile(
    r"\b(?:causad[ao]\s+por|"
    r"debido\s+a|"
    r"asociad[ao]\s+a|"
    r"ocasionad[ao]\s+por|"
    r"originad[ao]\s+por|"
    r"se\s+debe\s+a|"
    r"provocad[ao]\s+por|"
    r"por\s+ca[ií]da)\b",
    re.IGNORECASE
)

_FALLA_SERVICIO = re.compile(
    r"\b(?:se\s+detuvo|"
    r"dej[oó]\s+de\s+responder|"
    r"fall[oó]|colaps[oó]|"
    r"se\s+cay[oó])\b",
    re.IGNORECASE
)

# Dividir textos para reducir asociaciones
# entre frases tecnicas no relacionadas.
_PARTES = re.compile(
    r"\r?\n+|"
    r"(?<=[.!?])\s+(?=[A-ZÁÉÍÓÚ0-9])|"
    r";\s+"
)

# Usado exclusivamente para elegir la mejor
# evidencia dentro de una misma categoria.
_PRIORIDAD = {
    "Causa": 0,
    "Solucion": 1,
    "Detalle": 2,
    "Descripcion": 3
}


# ==========================================================
# 3. EXTRAER FRAGMENTO DE EVIDENCIA
# ==========================================================

def _fragmento(bloque, inicio, fin):

    texto = bloque[
        max(0, inicio - 130):
        min(len(bloque), fin + 140)
    ]

    return " ".join(texto.split())[:270]


# ==========================================================
# 4. VERIFICAR EVIDENCIA DEL FACTOR
# ==========================================================

def _evidencia(categoria, bloque, inicio, fin):

    previo = bloque[
        max(0, inicio - 150):inicio
    ]

    posterior = bloque[
        fin:min(len(bloque), fin + 130)
    ]

    entorno = (
        previo
        + bloque[inicio:fin]
        + posterior
    )

    # 1. Descartar negaciones y normalidad.
    if (
        _NORMAL.search(entorno)
        or _NEGACION.search(entorno)
    ):
        return False

    # 2. Factores relacionados con almacenamiento.
    if categoria in _ALMACENAMIENTO:

        # La sola mencion de una ruta o log
        # no constituye evidencia suficiente.
        if not (
            _CONSUMO_ARCHIVOS.search(entorno)
            or _TAMANO.search(posterior[:65])
        ):
            return False

        # Evitar confundir memoria cache Linux
        # con archivos cache almacenados en disco.
        if categoria == "Archivos temporales y caché":

            if _MEMORIA_NORMAL.search(entorno):
                return False

            menciona_memoria = re.search(
                r"\bmemoria\b",
                entorno,
                re.IGNORECASE
            )

            menciona_almacenamiento = re.search(
                r"\b(?:disco|filesystem|espacio|"
                r"almacenamiento|archivo|carpeta|"
                r"directorio|ruta|GB|TB)\b",
                entorno,
                re.IGNORECASE
            )

            if (
                menciona_memoria
                and not menciona_almacenamiento
            ):
                return False

        # Una ruta C:\Users no demuestra que
        # esa carpeta este causando consumo.
        if categoria == "Archivos de usuarios o aplicaciones":

            if not (
                _TAMANO.search(posterior[:65])
                or _CONSUMO_ARCHIVOS.search(entorno)
            ):
                return False

        return True

    # 3. Procesos con consumo elevado.
    if categoria == "Procesos con alto consumo de recursos":

        return bool(
            _RECURSO.search(entorno)
            and _RECURSO_ALTO.search(entorno)
            and not _MEMORIA_NORMAL.search(entorno)
        )

    # 4. Fallas de conectividad.
    if categoria == "Fallas de conectividad":

        return bool(
            _CAUSAL.search(entorno)
            or re.search(
                r"\b(?:problema|incidente)\s+"
                r"(?:est[aá]\s+)?asociad",
                entorno,
                re.IGNORECASE
            )
        )

    # 5. Fallas de servicios o aplicaciones.
    if categoria == "Fallas de servicios o aplicaciones":

        return bool(
            _FALLA_SERVICIO.search(entorno)
            and _CAUSAL.search(entorno)
        )

    return False


# ==========================================================
# 5. CLASIFICADOR PRINCIPAL
# ==========================================================

def clasificar_causa(
    descripcion: str | None = None,
    detalle: str | None = None,
    causa: str | None = None,
    solucion: str | None = None
):

    campos = (
        ("Causa", causa),
        ("Solucion", solucion),
        ("Detalle", detalle),
        ("Descripcion", descripcion)
    )

    # Una categoria se contabiliza una sola vez
    # aunque aparezca en varios campos del ticket.
    candidatos = {}

    # Evaluar los cuatro campos, sin terminar
    # al encontrar la primera coincidencia.
    for campo, texto in campos:

        if (
            not isinstance(texto, str)
            or not texto.strip()
        ):
            continue

        for bloque in _PARTES.split(texto):

            if not bloque.strip():
                continue

            # Analizar la parte factual anterior
            # a una recomendacion.
            bloque = _RECOMENDACION.split(
                bloque,
                maxsplit=1
            )[0]

            if not bloque.strip():
                continue

            for categoria, accion, patron in REGLAS_COMPILADAS:

                # Ya existe evidencia para la categoria
                # en un campo con igual o mayor prioridad.
                if categoria in candidatos:

                    prioridad_actual = _PRIORIDAD[
                        candidatos[categoria]["campo"]
                    ]

                    if _PRIORIDAD[campo] >= prioridad_actual:
                        continue

                for coincidencia in patron.finditer(bloque):

                    inicio, fin = coincidencia.span()

                    if not _evidencia(
                        categoria,
                        bloque,
                        inicio,
                        fin
                    ):
                        continue

                    candidatos[categoria] = {
                        "categoria": categoria,
                        "accion_recomendada": accion,
                        "campo": campo,
                        "evidencia": _fragmento(
                            bloque,
                            inicio,
                            fin
                        )
                    }

                    break

    # ======================================================
    # 6. EVITAR CATEGORIAS GENERICAS DUPLICADAS
    # ======================================================

    # Ejemplo:
    # C:\Users\prdrpa\.nuget\packages
    #
    # No clasificar el mismo factor como
    # "Archivos de usuarios" y "Archivos temporales".

    generica = "Archivos de usuarios o aplicaciones"

    especificas = _ALMACENAMIENTO - {generica}

    if (
        generica in candidatos
        and any(
            categoria in candidatos
            for categoria in especificas
        )
    ):

        evidencia_usuario = (
            candidatos[generica]["evidencia"].lower()
        )

        misma_evidencia = any(
            (
                candidatos[categoria]["evidencia"].lower()
                == evidencia_usuario
                or candidatos[categoria]["evidencia"].lower()
                in evidencia_usuario
                or evidencia_usuario
                in candidatos[categoria]["evidencia"].lower()
            )
            for categoria in especificas
            if categoria in candidatos
        )

        ruta_especifica = any(
            valor in evidencia_usuario
            for valor in (
                "\\.nuget\\",
                "\\temp\\",
                "/var/log",
                "\\logs\\",
                "node_modules",
                ".mdf",
                ".ldf"
            )
        )

        if misma_evidencia or ruta_especifica:
            candidatos.pop(generica)

    # ======================================================
    # 7. RESULTADO SIN EVIDENCIA
    # ======================================================

    if not candidatos:

        return {
            "categoria": None,
            "estado": "sin_evidencia",
            "campo": None,
            "evidencia": None
        }

    # ======================================================
    # 8. RESULTADO MULTIFACTOR
    # ======================================================

    if len(candidatos) > 1:

        ordenados = sorted(
            candidatos.values(),
            key=lambda item: (
                _PRIORIDAD[item["campo"]],
                item["categoria"]
            )
        )

        resumen_evidencias = " | ".join(
            (
                f"{item['categoria']}: "
                f"{item['evidencia']}"
            )
            for item in ordenados[:2]
        )[:450]

        return {
            "categoria": None,
            "estado": "evidencia_multiple",
            "campo": ordenados[0]["campo"],
            "evidencia": resumen_evidencias,
            "factores_detectados": [
                item["categoria"]
                for item in ordenados
            ]
        }

    # ======================================================
    # 9. UN FACTOR DOCUMENTADO
    # ======================================================

    unico = next(iter(candidatos.values()))

    return {
        **unico,
        "estado": "factor_documentado"
    }
