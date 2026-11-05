
"""Fase 4.3.4 - Pruebas de integración del motor dinámico Canvia.

Compara los resultados de ai_query_repository.py con SQL Server
mediante consultas independientes y parametrizadas.

SOLO LECTURA. No ejecuta INSERT, UPDATE, DELETE ni COMMIT.
"""

from calendar import monthrange
from datetime import date, timedelta
from math import isclose

from sqlalchemy import text

from app.database.sqlserver import SQLServerSessionLocal
from app.repositories.ai_query_repository import ejecutar_consulta_dinamica


# ============================================================
# 1. FUENTES AUTORIZADAS PARA LAS PRUEBAS
# ============================================================

FUENTES = {
    "incident_consolidated": "Fecha_Apertura",
    "incident_sla": "Fecha_Creacion",
    "requirement_consolidated": "Fecha_Apertura",
    "requirement_sla": "Fecha_Creacion",
}

CONDICIONES_SLA = {
    "sla_respuesta": "SLA_Respuesta_Condicion",
    "sla_solucion": "SLA_Solucion_Condicion",
    "ola_respuesta": "OLA_Respuesta_Condicion",
    "ola_solucion": "OLA_Solucion_Condicion",
}

CORRECTAS = 0
FALLIDAS = 0
OMITIDAS = 0


# ============================================================
# 2. UTILIDADES DE PRUEBAS
# ============================================================

def iguales(a, b, tolerancia=0.015):
    """Compara cifras, fechas, listas y resultados nulos."""

    if a is None or b is None:
        return a is None and b is None

    if (
        isinstance(a, (int, float))
        and not isinstance(a, bool)
        and isinstance(b, (int, float))
        and not isinstance(b, bool)
    ):
        return isclose(
            float(a),
            float(b),
            rel_tol=0,
            abs_tol=tolerancia,
        )

    return a == b


def comprobar(nombre, recibido, esperado, tolerancia=0.015):
    global CORRECTAS, FALLIDAS

    correcto = iguales(
        recibido,
        esperado,
        tolerancia,
    )

    if correcto:
        CORRECTAS += 1
        marca = "OK"
    else:
        FALLIDAS += 1
        marca = "FALLÓ"

    print(
        f"  [{marca}] {nombre}: "
        f"Motor={recibido!r} | SQL={esperado!r}"
    )

    return correcto


def omitir(nombre, motivo):
    global OMITIDAS
    OMITIDAS += 1
    print(f"  [OMITIDA] {nombre}: {motivo}")


def sql_una(db, sql, parametros=None):
    return db.execute(
        text(sql),
        parametros or {},
    ).mappings().one()


def sql_filas(db, sql, parametros=None):
    return db.execute(
        text(sql),
        parametros or {},
    ).mappings().all()


def filtro(field, operator, value):
    return {
        "field": field,
        "operator": operator,
        "value": value,
    }


def consulta(
    db,
    source,
    metrics,
    filters=None,
    groups=None,
    orders=None,
    limit=None,
    offset=0,
):
    groups = groups or []

    plan = {
        "version": 1,
        "source": source,
        "operation": (
            "grouped_aggregate"
            if groups
            else "aggregate"
        ),
        "filters": filters or [],
        "group_by": groups,
        "metrics": metrics,
        "order_by": orders or [],
        "limit": limit if groups else None,
        "offset": offset,
    }

    return ejecutar_consulta_dinamica(
        db=db,
        plan=plan,
    )


def resultado_valido(nombre, resultado, permitir_vacio=False):
    estados = {"success"}

    if permitir_vacio:
        estados.add("empty")

    if resultado.get("status") in estados:
        return True

    comprobar(
        nombre + " - estado",
        resultado.get("status"),
        "success",
    )

    print("  Detalle:", resultado.get("detail"))
    return False


def fechas_mes(inicio):
    ultimo = monthrange(inicio.year, inicio.month)[1]

    fin = date(
        inicio.year,
        inicio.month,
        ultimo,
    )

    siguiente = fin + timedelta(days=1)

    return {
        "inicio": inicio.isoformat(),
        "fin": fin.isoformat(),
        "siguiente": siguiente.isoformat(),
    }


def muestra_mensual(db, source):
    """Selecciona el mes con mayor cantidad de registros."""

    campo = FUENTES[source]

    row = sql_filas(db, f"""
        SELECT TOP (1)
            DATEFROMPARTS(
                YEAR([{campo}]),
                MONTH([{campo}]),
                1
            ) AS mes,
            COUNT_BIG(*) AS tickets
        FROM dbo.[{source}]
        WHERE [{campo}] IS NOT NULL
        GROUP BY
            YEAR([{campo}]),
            MONTH([{campo}])
        ORDER BY
            COUNT_BIG(*) DESC,
            mes DESC
    """)

    if not row:
        return None

    inicio = row[0]["mes"]

    return fechas_mes(inicio)


def muestra_proyecto_prioridad(db, source, mes):
    campo = FUENTES[source]

    rows = sql_filas(
        db,
        f"""
        SELECT TOP (1)
            LTRIM(RTRIM(Proyecto)) AS proyecto,
            Prioridad AS prioridad
        FROM dbo.[{source}]
        WHERE [{campo}] >= :inicio
          AND [{campo}] < :siguiente
          AND Proyecto IS NOT NULL
          AND LTRIM(RTRIM(Proyecto)) <> N''
          AND Prioridad IS NOT NULL
        ORDER BY [{campo}] DESC
        """,
        {
            "inicio": mes["inicio"],
            "siguiente": mes["siguiente"],
        },
    )

    return dict(rows[0]) if rows else None


def filtro_mes(source, mes):
    return filtro(
        FUENTES[source],
        "date_range",
        {
            "from": mes["inicio"],
            "to": mes["fin"],
        },
    )


# ============================================================
# 3. CONTAR EL HISTÓRICO COMPLETO
# ============================================================

def prueba_historico(db, source):

    respuesta = consulta(
        db,
        source,
        [{"alias": "total", "function": "count"}],
    )

    if not resultado_valido(
        "Histórico completo", respuesta, True
    ):
        return

    esperado = sql_una(
        db,
        f"""
        SELECT COUNT_BIG(*) AS total
        FROM dbo.[{source}]
        """,
    )["total"]

    comprobar(
        "Histórico completo",
        respuesta["metrics"].get("total"),
        int(esperado),
    )

    comprobar(
        "Cobertura histórica",
        respuesta.get("coverage"),
        "complete",
    )


# ============================================================
# 4. FILTROS POR MES Y FECHA DE RESOLUCIÓN
# ============================================================

def prueba_fechas(db, source, mes):

    campo = FUENTES[source]

    respuesta = consulta(
        db,
        source,
        [{"alias": "total", "function": "count"}],
        filters=[filtro_mes(source, mes)],
    )

    if resultado_valido("Filtro mensual", respuesta):

        esperado = sql_una(
            db,
            f"""
            SELECT COUNT_BIG(*) AS total
            FROM dbo.[{source}]
            WHERE [{campo}] >= :inicio
              AND [{campo}] < :siguiente
            """,
            {
                "inicio": mes["inicio"],
                "siguiente": mes["siguiente"],
            },
        )["total"]

        comprobar(
            "Filtro mensual",
            respuesta["metrics"]["total"],
            int(esperado),
        )

    # Seleccionar un día real con resoluciones.
    row = sql_una(
        db,
        f"""
        SELECT MAX(
            CAST(Fecha_Resolucion AS date)
        ) AS fecha
        FROM dbo.[{source}]
        """,
    )

    dia = row["fecha"]

    if dia is None:
        omitir(
            "Fecha de resolución",
            "La fuente no contiene fechas de resolución",
        )
        return

    respuesta = consulta(
        db,
        source,
        [{"alias": "total", "function": "count"}],
        filters=[
            filtro(
                "Fecha_Resolucion",
                "eq",
                dia.isoformat(),
            )
        ],
    )

    if resultado_valido("Fecha de resolución", respuesta):

        siguiente = dia + timedelta(days=1)

        esperado = sql_una(
            db,
            f"""
            SELECT COUNT_BIG(*) AS total
            FROM dbo.[{source}]
            WHERE Fecha_Resolucion >= :inicio
              AND Fecha_Resolucion < :siguiente
            """,
            {
                "inicio": dia.isoformat(),
                "siguiente": siguiente.isoformat(),
            },
        )["total"]

        comprobar(
            "Filtro por Fecha_Resolucion",
            respuesta["metrics"]["total"],
            int(esperado),
        )


# ============================================================
# 5. FILTROS COMBINADOS
# ============================================================

def prueba_filtros_combinados(
    db, source, mes, muestra
):
    campo = FUENTES[source]

    respuesta = consulta(
        db,
        source,
        [{"alias": "total", "function": "count"}],
        filters=[
            filtro_mes(source, mes),
            filtro(
                "Proyecto",
                "eq",
                muestra["proyecto"],
            ),
            filtro(
                "Prioridad",
                "eq",
                muestra["prioridad"],
            ),
        ],
    )

    if not resultado_valido(
        "Filtros combinados", respuesta
    ):
        return

    esperado = sql_una(
        db,
        f"""
        SELECT COUNT_BIG(*) AS total
        FROM dbo.[{source}]
        WHERE [{campo}] >= :inicio
          AND [{campo}] < :siguiente
          AND LTRIM(RTRIM(Proyecto)) = :proyecto
          AND LTRIM(RTRIM(Prioridad)) = :prioridad
        """,
        {
            "inicio": mes["inicio"],
            "siguiente": mes["siguiente"],
            "proyecto": muestra["proyecto"],
            "prioridad": muestra["prioridad"],
        },
    )["total"]

    comprobar(
        "Mes + Proyecto + Prioridad",
        respuesta["metrics"]["total"],
        int(esperado),
    )


# ============================================================
# 6. COUNT DISTINCT, COUNT IF, MIN Y MAX
# ============================================================

def prueba_agregaciones(db, source, mes, muestra):

    campo = FUENTES[source]

    respuesta = consulta(
        db,
        source,
        [
            {
                "alias": "total_proyectos",
                "function": "count_distinct",
                "field": "Proyecto",
            },
            {
                "alias": "total_prioridad",
                "function": "count_if",
                "condition": filtro(
                    "Prioridad",
                    "eq",
                    muestra["prioridad"],
                ),
            },
            {
                "alias": "primera_fecha",
                "function": "min_date",
                "field": campo,
            },
            {
                "alias": "ultima_fecha",
                "function": "max_date",
                "field": campo,
            },
        ],
        filters=[filtro_mes(source, mes)],
    )

    if not resultado_valido(
        "Agregaciones", respuesta
    ):
        return

    esperado = sql_una(
        db,
        f"""
        SELECT
            COUNT(
                DISTINCT NULLIF(
                    LTRIM(RTRIM(Proyecto)), N''
                )
            ) AS proyectos,

            SUM(
                CASE WHEN
                    LTRIM(RTRIM(Prioridad)) = :prioridad
                THEN 1 ELSE 0 END
            ) AS prioridad,

            MIN(CAST([{campo}] AS date)) AS primera,
            MAX(CAST([{campo}] AS date)) AS ultima

        FROM dbo.[{source}]
        WHERE [{campo}] >= :inicio
          AND [{campo}] < :siguiente
        """,
        {
            "inicio": mes["inicio"],
            "siguiente": mes["siguiente"],
            "prioridad": muestra["prioridad"],
        },
    )

    m = respuesta["metrics"]

    comprobar(
        "COUNT DISTINCT proyectos",
        m["total_proyectos"],
        int(esperado["proyectos"]),
    )

    comprobar(
        "COUNT IF prioridad",
        m["total_prioridad"],
        int(esperado["prioridad"] or 0),
    )

    comprobar(
        "MIN fecha",
        m["primera_fecha"],
        esperado["primera"].isoformat(),
    )

    comprobar(
        "MAX fecha",
        m["ultima_fecha"],
        esperado["ultima"].isoformat(),
    )


# ============================================================
# 7. AGRUPACIÓN POR PROYECTO
# ============================================================

def prueba_proyectos(db, source, mes):

    campo = FUENTES[source]

    respuesta = consulta(
        db,
        source,
        [{"alias": "n", "function": "count"}],
        filters=[filtro_mes(source, mes)],
        groups=[{"field": "Proyecto", "bucket": "value"}],
        orders=[{"field": "n", "direction": "desc"}],
        limit=5,
    )

    if not resultado_valido(
        "Agrupación por proyecto", respuesta
    ):
        return

    filas = sql_filas(
        db,
        f"""
        SELECT TOP (5)
            COALESCE(
                NULLIF(LTRIM(RTRIM(Proyecto)), N''),
                N'Sin especificar'
            ) AS proyecto,
            COUNT_BIG(*) AS n
        FROM dbo.[{source}]
        WHERE [{campo}] >= :inicio
          AND [{campo}] < :siguiente
        GROUP BY
            COALESCE(
                NULLIF(LTRIM(RTRIM(Proyecto)), N''),
                N'Sin especificar'
            )
        ORDER BY
            n DESC,
            proyecto ASC
        """,
        {
            "inicio": mes["inicio"],
            "siguiente": mes["siguiente"],
        },
    )

    esperado = [
        (x["proyecto"], int(x["n"]))
        for x in filas
    ]

    recibido = [
        (x["Proyecto"], int(x["n"]))
        for x in respuesta["data"]
    ]

    comprobar(
        "Top 5 proyectos",
        recibido,
        esperado,
    )


# ============================================================
# 8. AGRUPACIÓN MENSUAL
# ============================================================

def prueba_agrupacion_mensual(db, source, mes):

    campo = FUENTES[source]
    anio = int(mes["inicio"][:4])

    respuesta = consulta(
        db,
        source,
        [{"alias": "n", "function": "count"}],
        filters=[
            filtro(
                campo,
                "date_range",
                {
                    "from": f"{anio}-01-01",
                    "to": f"{anio}-12-31",
                },
            )
        ],
        groups=[
            {"field": campo, "bucket": "month"}
        ],
        orders=[
            {"field": campo, "direction": "asc"}
        ],
        limit=50,
    )

    if not resultado_valido(
        "Agrupación mensual", respuesta
    ):
        return

    filas = sql_filas(
        db,
        f"""
        SELECT
            DATEFROMPARTS(
                YEAR([{campo}]),
                MONTH([{campo}]),
                1
            ) AS mes,
            COUNT_BIG(*) AS n
        FROM dbo.[{source}]
        WHERE [{campo}] >= :inicio
          AND [{campo}] < :siguiente
        GROUP BY
            YEAR([{campo}]),
            MONTH([{campo}])
        ORDER BY mes ASC
        """,
        {
            "inicio": f"{anio}-01-01",
            "siguiente": f"{anio + 1}-01-01",
        },
    )

    esperado = [
        (str(x["mes"])[:7], int(x["n"]))
        for x in filas
    ]

    recibido = [
        (x[campo], int(x["n"]))
        for x in respuesta["data"]
    ]

    comprobar(
        "Tickets agrupados por mes",
        recibido,
        esperado,
    )


# ============================================================
# 9. PROMEDIO DE RESOLUCIÓN
# ============================================================

def prueba_duracion(db, source, mes):

    campo = FUENTES[source]

    respuesta = consulta(
        db,
        source,
        [
            {
                "alias": "horas",
                "function": "avg_resolution_hours",
            }
        ],
        filters=[filtro_mes(source, mes)],
    )

    if not resultado_valido(
        "Duración promedio", respuesta
    ):
        return

    esperado = sql_una(
        db,
        f"""
        SELECT
            COUNT_BIG(*) AS total,

            COUNT_BIG(
                CASE WHEN
                    [{campo}] IS NOT NULL
                    AND Fecha_Resolucion IS NOT NULL
                    AND Fecha_Resolucion >= [{campo}]
                THEN 1 END
            ) AS validos,

            AVG(
                CASE WHEN
                    [{campo}] IS NOT NULL
                    AND Fecha_Resolucion IS NOT NULL
                    AND Fecha_Resolucion >= [{campo}]
                THEN CAST(
                    DATEDIFF_BIG(
                        second,
                        [{campo}],
                        Fecha_Resolucion
                    ) AS float
                )
                ELSE NULL END
            ) / 3600.0 AS horas

        FROM dbo.[{source}]
        WHERE [{campo}] >= :inicio
          AND [{campo}] < :siguiente
        """,
        {
            "inicio": mes["inicio"],
            "siguiente": mes["siguiente"],
        },
    )

    m = respuesta["metrics"]

    comprobar(
        "Duración promedio (horas)",
        m["horas"],
        (
            round(float(esperado["horas"]), 2)
            if esperado["horas"] is not None
            else None
        ),
    )

    comprobar(
        "Tickets con duración válida",
        m["horas_validos"],
        int(esperado["validos"]),
    )

    comprobar(
        "Tickets excluidos del promedio",
        m["horas_excluidos"],
        int(esperado["total"])
        - int(esperado["validos"]),
    )


# ============================================================
# 10. SLA Y OLA: PORCENTAJES Y DENOMINADORES
# ============================================================

def prueba_sla(db, source, mes):

    campo = FUENTES[source]

    metrics = [
        {
            "alias": nombre,
            "function": "sla_compliance",
            "field": columna,
        }
        for nombre, columna in CONDICIONES_SLA.items()
    ]

    respuesta = consulta(
        db,
        source,
        metrics,
        filters=[filtro_mes(source, mes)],
    )

    if not resultado_valido(
        "Cumplimiento SLA/OLA", respuesta
    ):
        return

    expresiones = []

    for nombre, columna in CONDICIONES_SLA.items():

        expresiones.extend([
            f"""SUM(CASE WHEN [{columna}] = N'Cumplido'
                THEN 1 ELSE 0 END) AS {nombre}_ok""",

            f"""SUM(CASE WHEN [{columna}] = N'No cumplido'
                THEN 1 ELSE 0 END) AS {nombre}_no""",
        ])

    esperado = sql_una(
        db,
        f"""
        SELECT {", ".join(expresiones)}
        FROM dbo.[{source}]
        WHERE [{campo}] >= :inicio
          AND [{campo}] < :siguiente
        """,
        {
            "inicio": mes["inicio"],
            "siguiente": mes["siguiente"],
        },
    )

    m = respuesta["metrics"]

    for nombre in CONDICIONES_SLA:

        cumplidos = int(
            esperado[f"{nombre}_ok"] or 0
        )

        incumplidos = int(
            esperado[f"{nombre}_no"] or 0
        )

        medibles = cumplidos + incumplidos

        porcentaje = (
            round(100 * cumplidos / medibles, 2)
            if medibles
            else None
        )

        comprobar(
            f"{nombre} (%)",
            m[nombre],
            porcentaje,
        )

        comprobar(
            f"{nombre} cumplidos",
            m[f"{nombre}_cumplidos"],
            cumplidos,
        )

        comprobar(
            f"{nombre} incumplidos",
            m[f"{nombre}_incumplidos"],
            incumplidos,
        )

        comprobar(
            f"{nombre} medibles",
            m[f"{nombre}_medibles"],
            medibles,
        )


# ============================================================
# 11. PORCENTAJE SOBRE EL TOTAL
# ============================================================

def prueba_porcentaje_total(db, source, mes):

    campo = FUENTES[source]

    respuesta = consulta(
        db,
        source,
        [
            {
                "alias": "pct",
                "function": "percent_of_total",
                "condition": filtro(
                    "SLA_Solucion_Condicion",
                    "eq",
                    "Cumplido",
                ),
            },
            {
                "alias": "total",
                "function": "count",
            },
        ],
        filters=[filtro_mes(source, mes)],
    )

    if not resultado_valido(
        "Porcentaje sobre el total", respuesta
    ):
        return

    esperado = sql_una(
        db,
        f"""
        SELECT
            COUNT_BIG(*) AS total,
            SUM(
                CASE WHEN
                    SLA_Solucion_Condicion = N'Cumplido'
                THEN 1 ELSE 0 END
            ) AS cumplidos
        FROM dbo.[{source}]
        WHERE [{campo}] >= :inicio
          AND [{campo}] < :siguiente
        """,
        {
            "inicio": mes["inicio"],
            "siguiente": mes["siguiente"],
        },
    )

    total = int(esperado["total"])
    cumplidos = int(esperado["cumplidos"] or 0)

    porcentaje = (
        round(100 * cumplidos / total, 2)
        if total
        else None
    )

    m = respuesta["metrics"]

    comprobar(
        "Cumplidos / total (%)",
        m["pct"],
        porcentaje,
    )

    comprobar(
        "Numerador",
        m["pct_numerador"],
        cumplidos,
    )

    comprobar(
        "Denominador",
        m["pct_denominador"],
        total,
    )


# ============================================================
# 12. DOS DIMENSIONES: PROYECTO + PRIORIDAD
# ============================================================

def prueba_dos_dimensiones(db, mes):

    source = "incident_consolidated"

    respuesta = consulta(
        db,
        source,
        [{"alias": "n", "function": "count"}],
        filters=[filtro_mes(source, mes)],
        groups=[
            {"field": "Proyecto", "bucket": "value"},
            {"field": "Prioridad", "bucket": "value"},
        ],
        orders=[
            {"field": "n", "direction": "desc"}
        ],
        limit=5,
    )

    if not resultado_valido(
        "Dos dimensiones", respuesta
    ):
        return

    filas = sql_filas(
        db,
        """
        SELECT TOP (5)
            COALESCE(
                NULLIF(LTRIM(RTRIM(Proyecto)), N''),
                N'Sin especificar'
            ) AS proyecto,
            COALESCE(
                NULLIF(LTRIM(RTRIM(Prioridad)), N''),
                N'Sin especificar'
            ) AS prioridad,
            COUNT_BIG(*) AS n
        FROM dbo.incident_consolidated
        WHERE Fecha_Apertura >= :inicio
          AND Fecha_Apertura < :siguiente
        GROUP BY
            COALESCE(
                NULLIF(LTRIM(RTRIM(Proyecto)), N''),
                N'Sin especificar'
            ),
            COALESCE(
                NULLIF(LTRIM(RTRIM(Prioridad)), N''),
                N'Sin especificar'
            )
        ORDER BY
            n DESC,
            proyecto ASC,
            prioridad ASC
        """,
        {
            "inicio": mes["inicio"],
            "siguiente": mes["siguiente"],
        },
    )

    esperado = [
        (
            x["proyecto"],
            x["prioridad"],
            int(x["n"]),
        )
        for x in filas
    ]

    recibido = [
        (
            x["Proyecto"],
            x["Prioridad"],
            int(x["n"]),
        )
        for x in respuesta["data"]
    ]

    comprobar(
        "Proyecto + Prioridad",
        recibido,
        esperado,
    )


# ============================================================
# 13. PAGINACIÓN Y COVERAGE
# ============================================================

def prueba_paginacion(db):

    source = "requirement_consolidated"

    grupos = [
        {"field": "Proyecto", "bucket": "value"}
    ]

    metricas = [
        {"alias": "n", "function": "count"}
    ]

    orden = [
        {"field": "n", "direction": "desc"}
    ]

    def pagina(offset):
        return consulta(
            db,
            source,
            metricas,
            groups=grupos,
            orders=orden,
            limit=3,
            offset=offset,
        )

    primera = pagina(0)
    segunda = pagina(3)

    if not (
        resultado_valido("Página 1", primera)
        and resultado_valido("Página 2", segunda)
    ):
        return

    filas = sql_filas(
        db,
        """
        SELECT
            COALESCE(
                NULLIF(LTRIM(RTRIM(Proyecto)), N''),
                N'Sin especificar'
            ) AS proyecto,
            COUNT_BIG(*) AS n
        FROM dbo.requirement_consolidated
        GROUP BY
            COALESCE(
                NULLIF(LTRIM(RTRIM(Proyecto)), N''),
                N'Sin especificar'
            )
        ORDER BY
            n DESC,
            proyecto ASC
        OFFSET 0 ROWS FETCH NEXT 7 ROWS ONLY
        """,
    )

    esperado_1 = [
        (x["proyecto"], int(x["n"]))
        for x in filas[:3]
    ]

    esperado_2 = [
        (x["proyecto"], int(x["n"]))
        for x in filas[3:6]
    ]

    recibido_1 = [
        (x["Proyecto"], int(x["n"]))
        for x in primera["data"]
    ]

    recibido_2 = [
        (x["Proyecto"], int(x["n"]))
        for x in segunda["data"]
    ]

    comprobar(
        "Primera página",
        recibido_1,
        esperado_1,
    )

    comprobar(
        "Segunda página",
        recibido_2,
        esperado_2,
    )

    comprobar(
        "Página 1: has_more",
        primera["has_more"],
        len(filas) > 3,
    )

    comprobar(
        "Página 2: has_more",
        segunda["has_more"],
        len(filas) > 6,
    )

    comprobar(
        "Cobertura página 2",
        segunda["coverage"],
        "partial",
    )


# ============================================================
# 14. BÚSQUEDA LITERAL EN DESCRIPCIÓN
# ============================================================

def prueba_contains(db):

    source = "incident_consolidated"

    for termino in ("CPU", "CPU%_"):

        respuesta = consulta(
            db,
            source,
            [
                {
                    "alias": "total",
                    "function": "count",
                }
            ],
            filters=[
                filtro(
                    "Descripcion",
                    "contains",
                    termino,
                )
            ],
        )

        if not resultado_valido(
            f"contains {termino}",
            respuesta,
            permitir_vacio=True,
        ):
            continue

        escaped = (
            termino.replace("\\", "\\\\")
            .replace("%", "\\%")
            .replace("_", "\\_")
        )

        esperado = sql_una(
            db,
            r"""
            SELECT COUNT_BIG(*) AS total
            FROM dbo.incident_consolidated
            WHERE Descripcion LIKE :patron ESCAPE '\'
            """,
            {
                "patron": "%" + escaped + "%",
            },
        )["total"]

        comprobar(
            f"contains literal {termino!r}",
            respuesta["metrics"]["total"],
            int(esperado),
        )


# ============================================================
# 15. CASO SIN TICKETS MEDIBLES
# ============================================================

def prueba_sla_sin_datos(db):

    source = "requirement_sla"

    nombre_inexistente = (
        "__PRUEBA_CANVIA_PROYECTO_INEXISTENTE__"
    )

    respuesta = consulta(
        db,
        source,
        [
            {
                "alias": "sla",
                "function": "sla_compliance",
                "field": "SLA_Solucion_Condicion",
            }
        ],
        filters=[
            filtro(
                "Proyecto",
                "eq",
                nombre_inexistente,
            )
        ],
    )

    cantidad = sql_una(
        db,
        """
        SELECT COUNT_BIG(*) AS total
        FROM dbo.requirement_sla
        WHERE LTRIM(RTRIM(Proyecto)) = :proyecto
        """,
        {"proyecto": nombre_inexistente},
    )["total"]

    if cantidad != 0:
        omitir(
            "SLA sin medibles",
            "El identificador de prueba existe en la base",
        )
        return

    comprobar(
        "Consulta sin registros: estado",
        respuesta["status"],
        "empty",
    )

    comprobar(
        "SLA sin medibles devuelve NULL",
        respuesta["metrics"].get("sla"),
        None,
    )

    comprobar(
        "SLA medibles = 0",
        respuesta["metrics"].get("sla_medibles"),
        0,
    )


# ============================================================
# 16. PLANES NO AUTORIZADOS
# ============================================================

def prueba_seguridad(db):

    casos = [
        (
            "Tabla no autorizada",
            {
                "source": "ai_messages",
                "operation": "aggregate",
                "metrics": [
                    {"alias": "n", "function": "count"}
                ],
            },
            "invalid_plan",
        ),
        (
            "Operación DELETE",
            {
                "source": "incident_consolidated",
                "operation": "delete",
                "metrics": [
                    {"alias": "n", "function": "count"}
                ],
            },
            "invalid_plan",
        ),
        (
            "SQL arbitrario",
            {
                "source": "incident_consolidated",
                "operation": "aggregate",
                "sql": "DROP TABLE incident_sla",
                "metrics": [
                    {"alias": "n", "function": "count"}
                ],
            },
            "invalid_plan",
        ),
        (
            "Columna inexistente",
            {
                "source": "incident_consolidated",
                "operation": "aggregate",
                "filters": [
                    filtro("Campo_Inexistente", "eq", "ABC")
                ],
                "metrics": [
                    {"alias": "n", "function": "count"}
                ],
            },
            "unsupported_operation",
        ),
        (
            "Columna de otra fuente",
            {
                "source": "requirement_sla",
                "operation": "aggregate",
                "filters": [
                    filtro("BU", "eq", "ABC")
                ],
                "metrics": [
                    {"alias": "n", "function": "count"}
                ],
            },
            "unsupported_operation",
        ),
        (
            "Fecha inválida",
            {
                "source": "incident_consolidated",
                "operation": "aggregate",
                "filters": [
                    filtro(
                        "Fecha_Apertura",
                        "eq",
                        "2026-02-30",
                    )
                ],
                "metrics": [
                    {"alias": "n", "function": "count"}
                ],
            },
            "invalid_plan",
        ),
        (
            "SLA en tabla Consolidada",
            {
                "source": "incident_consolidated",
                "operation": "aggregate",
                "metrics": [
                    {
                        "alias": "sla",
                        "function": "sla_compliance",
                        "field": "SLA_Solucion_Condicion",
                    }
                ],
            },
            "unsupported_operation",
        ),
    ]

    for nombre, plan, esperado in casos:

        resultado = ejecutar_consulta_dinamica(
            db=db,
            plan=plan,
        )

        comprobar(
            nombre,
            resultado.get("status"),
            esperado,
        )

        comprobar(
            nombre + " sin ejecutar SQL",
            resultado.get(
                "evidence", {}
            ).get("executed"),
            False,
        )


# ============================================================
# 17. EJECUCIÓN GENERAL
# ============================================================

def main():
    db = SQLServerSessionLocal()

    try:
        nombre_db = db.execute(
            text("SELECT DB_NAME()")
        ).scalar_one()

        print("=" * 74)
        print("FASE 4.3.4 - PRUEBAS DEL MOTOR SQLALCHEMY")
        print("=" * 74)
        print("Base de datos:", nombre_db)

        if str(nombre_db).casefold() != "serviciodba":
            raise RuntimeError(
                "La conexión no apunta a ServicioDBA"
            )

        for source in FUENTES:

            print("\n" + "-" * 74)
            print("FUENTE:", source)
            print("-" * 74)

            try:
                prueba_historico(db, source)

                mes = muestra_mensual(db, source)

                if mes is None:
                    omitir(
                        source,
                        "Sin fechas para probar agrupaciones",
                    )
                    continue

                print(
                    "  Mes de muestra:",
                    mes["inicio"][:7],
                )

                prueba_fechas(db, source, mes)

                muestra = muestra_proyecto_prioridad(
                    db,
                    source,
                    mes,
                )

                if muestra:
                    prueba_filtros_combinados(
                        db, source, mes, muestra
                    )
                    prueba_agregaciones(
                        db, source, mes, muestra
                    )
                else:
                    omitir(
                        "Filtros combinados",
                        "Sin proyecto y prioridad de muestra",
                    )

                prueba_proyectos(db, source, mes)
                prueba_agrupacion_mensual(db, source, mes)
                prueba_duracion(db, source, mes)

                if source.endswith("_sla"):
                    prueba_sla(db, source, mes)
                    prueba_porcentaje_total(db, source, mes)

                if source == "incident_consolidated":
                    prueba_dos_dimensiones(db, mes)

            except Exception as exc:
                global FALLIDAS
                FALLIDAS += 1
                print(
                    f"  [FALLÓ] {type(exc).__name__}: {exc}"
                )
                db.rollback()

        print("\n" + "-" * 74)
        print("PAGINACIÓN")
        print("-" * 74)

        try:
            prueba_paginacion(db)
        except Exception as exc:
            FALLIDAS += 1
            print(f"  [FALLÓ] Paginación: {exc}")
            db.rollback()

        print("\n" + "-" * 74)
        print("BÚSQUEDA LITERAL")
        print("-" * 74)

        try:
            prueba_contains(db)
        except Exception as exc:
            FALLIDAS += 1
            print(f"  [FALLÓ] Contains: {exc}")
            db.rollback()

        print("\n" + "-" * 74)
        print("SLA SIN MEDICIÓN")
        print("-" * 74)

        try:
            prueba_sla_sin_datos(db)
        except Exception as exc:
            FALLIDAS += 1
            print(f"  [FALLÓ] SLA vacío: {exc}")
            db.rollback()

        print("\n" + "-" * 74)
        print("SEGURIDAD Y RECHAZOS")
        print("-" * 74)

        try:
            prueba_seguridad(db)
        except Exception as exc:
            FALLIDAS += 1
            print(f"  [FALLÓ] Seguridad: {exc}")
            db.rollback()

        print("\n" + "=" * 74)
        print("RESUMEN FINAL")
        print("=" * 74)
        print("Pruebas correctas:", CORRECTAS)
        print("Pruebas fallidas: ", FALLIDAS)
        print("Pruebas omitidas: ", OMITIDAS)

        if FALLIDAS == 0 and OMITIDAS == 0:
            print("\nTODAS LAS PRUEBAS FUERON CORRECTAS")
        elif FALLIDAS == 0:
            print("\nSIN FALLOS, PERO EXISTEN PRUEBAS OMITIDAS")
        else:
            print("\nSE DETECTARON INCIDENCIAS PARA REVISAR")

    finally:
        db.rollback()
        db.close()
        print("\nConexión SQL Server cerrada.")


if __name__ == "__main__":
    main()
