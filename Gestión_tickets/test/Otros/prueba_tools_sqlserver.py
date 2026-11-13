
"""Pruebas de integración de Tools frente a SQL Server (solo lectura).
Ejecutar desde la raíz del backend: py prueba_tools_sqlserver.py
"""

from calendar import monthrange
from datetime import date
from math import isclose

from sqlalchemy import text
from app.database.sqlserver import SQLServerSessionLocal
from app.services.ai.tool_service import ejecutar_tool_analitica


FUENTES = {
    "incident_consolidated": {
        "tool_kpi": "ic_consultar_kpis",
        "tool_proyectos": "ic_consultar_proyectos",
        "fecha": "Fecha_Apertura",
        "prioridades": ("1-Critical", "2-High", "3-Medium", "4-Low"),
    },
    "incident_sla": {
        "tool_kpi": "is_consultar_kpis",
        "tool_proyectos": "is_consultar_proyectos",
        "fecha": "Fecha_Creacion",
        "prioridades": ("P1", "P2", "P3", "P4"),
    },
    "requirement_consolidated": {
        "tool_kpi": "rc_consultar_kpis",
        "tool_proyectos": "rc_consultar_proyectos",
        "fecha": "Fecha_Apertura",
        "prioridades": ("1-Critical", "2-High", "3-Medium", "4-Low"),
    },
    "requirement_sla": {
        "tool_kpi": "rs_consultar_kpis",
        "tool_proyectos": "rs_consultar_proyectos",
        "fecha": "Fecha_Creacion",
        "prioridades": ("P1", "P2", "P3", "P4"),
    },
}

CONDICIONES = {
    "sla_respuesta": "SLA_Respuesta_Condicion",
    "sla_solucion": "SLA_Solucion_Condicion",
    "ola_respuesta": "OLA_Respuesta_Condicion",
    "ola_solucion": "OLA_Solucion_Condicion",
}

OK = 0
FALLAS = 0
OMITIDAS = 0


def reportar(nombre, correcto, detalle=""):
    global OK, FALLAS

    if correcto:
        OK += 1
        marca = "OK"
    else:
        FALLAS += 1
        marca = "FALLÓ"

    print(
        f"  [{marca}] {nombre}"
        + (f" | {detalle}" if detalle else "")
    )


def omitir(nombre, detalle):
    global OMITIDAS
    OMITIDAS += 1
    print(f"  [OMITIDA] {nombre} | {detalle}")


def solicitud(db, source, tool_id, filters=None, options=None):
    return ejecutar_tool_analitica(
        db=db,
        solicitud={
            "source": source,
            "tool_id": tool_id,
            "filters": filters or {},
            "options": options or {},
        }
    )


def periodo_mensual(fecha):
    inicio = date(fecha.year, fecha.month, 1)

    fin = date(
        fecha.year,
        fecha.month,
        monthrange(fecha.year, fecha.month)[1]
    )

    return {
        "desde": inicio.isoformat(),
        "hasta": fin.isoformat()
    }


def elegir_muestra(db, source):
    """
    Obtiene un proyecto, prioridad y fecha reales.
    No utiliza datos inventados.
    """

    cfg = FUENTES[source]

    valores = ", ".join(
        f"'{p}'" for p in cfg["prioridades"]
    )

    fecha = cfg["fecha"]

    sql = text(f"""
        SELECT TOP (1)
            LTRIM(RTRIM(Proyecto)) AS proyecto,
            Prioridad AS prioridad,
            CAST([{fecha}] AS date) AS fecha
        FROM dbo.[{source}]
        WHERE [{fecha}] IS NOT NULL
          AND Proyecto IS NOT NULL
          AND LTRIM(RTRIM(Proyecto)) <> N''
          AND Prioridad IN ({valores})
        ORDER BY [{fecha}] DESC
    """)

    row = db.execute(sql).mappings().first()

    if not row:
        return None

    return {
        "proyecto": row["proyecto"],
        "prioridad": row["prioridad"],
        "periodo": periodo_mensual(row["fecha"]),
    }


def clausula_sql(source, filters):
    """
    Construye condiciones de verificación.

    Las tablas y columnas proceden exclusivamente
    de las constantes FUENTES, no de GPT.
    """

    fecha = FUENTES[source]["fecha"]

    partes = []
    params = {}

    if "desde" in filters:
        partes.append(f"[{fecha}] >= :desde")
        params["desde"] = filters["desde"]

    if "hasta" in filters:
        partes.append(
            f"[{fecha}] < DATEADD(day, 1, CAST(:hasta AS date))"
        )
        params["hasta"] = filters["hasta"]

    if "prioridad" in filters:
        partes.append("Prioridad = :prioridad")
        params["prioridad"] = filters["prioridad"]

    if "proyecto" in filters:
        partes.append(
            "LTRIM(RTRIM(Proyecto)) = :proyecto"
        )
        params["proyecto"] = filters["proyecto"]

    where = (
        " WHERE " + " AND ".join(partes)
        if partes else ""
    )

    return where, params


def contar_sql(db, source, filters):
    where, params = clausula_sql(source, filters)

    sql = text(
        f"SELECT COUNT_BIG(*) "
        f"FROM dbo.[{source}]"
        + where
    )

    return int(
        db.execute(sql, params).scalar_one()
    )


def comprobar_kpi(db, source, nombre, filters):

    tool_id = FUENTES[source]["tool_kpi"]

    resultado = solicitud(
        db,
        source,
        tool_id,
        filters,
        {"metric": "total_tickets"}
    )

    if resultado.get("status") != "success":
        reportar(
            nombre,
            False,
            f"estado={resultado.get('status')} | "
            f"{resultado.get('detail', '')}"
        )
        return None

    total_tool = (
        resultado.get("metrics", {}).get("total_tickets")
    )

    total_sql = contar_sql(
        db,
        source,
        filters
    )

    correcto = (
        type(total_tool) in (int, float)
        and int(total_tool) == total_sql
        and resultado.get("applied_filters") == filters
    )

    reportar(
        nombre,
        correcto,
        f"Tool={total_tool}; "
        f"SQL={total_sql}; "
        f"filtros={filters}"
    )

    return resultado if correcto else None


def comprobar_proyectos(db, source, muestra):
    """
    Comprueba los tickets de un proyecto real
    y el Top 3 para fuentes Consolidadas.
    """

    tool_id = FUENTES[source]["tool_proyectos"]

    periodo = muestra["periodo"]

    filtros = {
        **periodo,
        "proyecto": muestra["proyecto"]
    }

    resultado = solicitud(
        db,
        source,
        tool_id,
        filtros
    )

    if resultado.get("status") != "success":
        reportar(
            "Proyecto concreto",
            False,
            f"estado={resultado.get('status')} | "
            f"{resultado.get('detail', '')}"
        )
        return

    filas = resultado.get("data")

    total_tool = (
        sum(
            int(
                fila.get(
                    "cantidad",
                    fila.get("tickets", 0)
                )
            )
            for fila in filas
        )
        if isinstance(filas, list)
        else None
    )

    total_sql = contar_sql(
        db,
        source,
        filtros
    )

    reportar(
        "Proyecto concreto",
        total_tool == total_sql,
        f"proyecto={muestra['proyecto']!r}; "
        f"Tool={total_tool}; "
        f"SQL={total_sql}"
    )

    # Los Consolidados admiten ranking general.
    if not source.endswith("_consolidated"):
        return

    resultado = solicitud(
        db,
        source,
        tool_id,
        periodo,
        {
            "metric": "cantidad",
            "order": "desc",
            "limit": 3
        }
    )

    if resultado.get("status") != "success":
        reportar(
            "Top 3 proyectos",
            False,
            f"estado={resultado.get('status')} | "
            f"{resultado.get('detail', '')}"
        )
        return

    datos = resultado.get("data", [])

    where, params = clausula_sql(
        source,
        periodo
    )

    sql = text(f"""
        SELECT TOP (3)
            COUNT_BIG(*) AS cantidad
        FROM dbo.[{source}]
        {where}
        GROUP BY COALESCE(
            NULLIF(LTRIM(RTRIM(Proyecto)), N''),
            N'Sin especificar'
        )
        ORDER BY COUNT_BIG(*) DESC
    """)

    esperados = [
        int(row[0])
        for row in db.execute(sql, params)
    ]

    reales = (
        [int(fila["cantidad"]) for fila in datos]
        if isinstance(datos, list)
        else []
    )

    reportar(
        "Top 3 proyectos",
        reales == esperados,
        f"cantidades Tool={reales}; SQL={esperados}"
    )


def comprobar_indicadores_sla(db, source, muestra):
    """
    Verifica los cuatro indicadores SLA/OLA
    contra agregaciones SQL independientes.
    """

    filtros = {
        **muestra["periodo"],
        "proyecto": muestra["proyecto"]
    }

    resultado = solicitud(
        db,
        source,
        FUENTES[source]["tool_kpi"],
        filtros
    )

    if resultado.get("status") != "success":
        reportar(
            "KPIs SLA/OLA",
            False,
            f"estado={resultado.get('status')} | "
            f"{resultado.get('detail', '')}"
        )
        return

    where, params = clausula_sql(
        source,
        filtros
    )

    expresiones = []

    for clave, columna in CONDICIONES.items():

        expresiones.append(
            f"SUM(CASE WHEN [{columna}] = N'Cumplido' "
            f"THEN 1 ELSE 0 END) AS {clave}_ok"
        )

        expresiones.append(
            f"SUM(CASE WHEN [{columna}] = N'No cumplido' "
            f"THEN 1 ELSE 0 END) AS {clave}_no"
        )

    sql = text(
        f"SELECT COUNT_BIG(*) AS total, "
        f"{', '.join(expresiones)} "
        f"FROM dbo.[{source}] {where}"
    )

    valores = db.execute(
        sql,
        params
    ).mappings().one()

    metrics = resultado.get("metrics") or {}

    for clave in CONDICIONES:

        cumple = int(
            valores[f"{clave}_ok"] or 0
        )

        incumple = int(
            valores[f"{clave}_no"] or 0
        )

        medibles = cumple + incumple

        esperado = (
            round(100 * cumple / medibles, 2)
            if medibles
            else None
        )

        recibido = metrics.get(clave)

        if esperado is None:
            correcto = recibido is None
        else:
            correcto = (
                isinstance(recibido, (float, int))
                and isclose(
                    float(recibido),
                    esperado,
                    abs_tol=0.06
                )
            )

        reportar(
            clave,
            correcto,
            f"Tool={recibido}; "
            f"SQL={esperado}; "
            f"medibles={medibles}"
        )

    # Campos adicionales de Requerimientos SLA
    if source == "requirement_sla":

        cumple = int(
            valores["sla_solucion_ok"] or 0
        )

        incumple = int(
            valores["sla_solucion_no"] or 0
        )

        correcto = (
            metrics.get("cant_req_cumplidos") == cumple
            and metrics.get("cant_req_no_cumplidos")
            == incumple
        )

        reportar(
            "Conteos SLA solución",
            correcto,
            f"cumplidos={cumple}; "
            f"incumplidos={incumple}"
        )

        total = int(valores["total"] or 0)

        porcentaje = (
            round(100 * cumple / total, 2)
            if total
            else 0.0
        )

        recibido = metrics.get(
            "porcentaje_cumpl_req"
        )

        correcto = (
            isinstance(recibido, (float, int))
            and isclose(
                float(recibido),
                porcentaje,
                abs_tol=0.06
            )
        )

        reportar(
            "% cumplidos / total",
            correcto,
            f"Tool={recibido}; SQL={porcentaje}"
        )


def comprobar_condiciones_req_sla(db, muestra):
    """
    Verifica cumplidos, incumplidos,
    cancelados y otros de Requerimientos SLA.
    """

    source = "requirement_sla"

    filtros = {
        **muestra["periodo"],
        "proyecto": muestra["proyecto"]
    }

    resultado = solicitud(
        db,
        source,
        "rs_consultar_condiciones_sla",
        filtros
    )

    if resultado.get("status") != "success":
        reportar(
            "Condiciones de solución",
            False,
            f"estado={resultado.get('status')} | "
            f"{resultado.get('detail', '')}"
        )
        return

    where, params = clausula_sql(
        source,
        filtros
    )

    sql = text(f"""
        SELECT
            SUM(CASE
                WHEN SLA_Solucion_Condicion = N'Cumplido'
                THEN 1 ELSE 0
            END) AS cumplidos,

            SUM(CASE
                WHEN SLA_Solucion_Condicion = N'No cumplido'
                THEN 1 ELSE 0
            END) AS incumplidos,

            SUM(CASE
                WHEN SLA_Solucion_Condicion = N'Medición cancelada'
                THEN 1 ELSE 0
            END) AS cancelados,

            COUNT_BIG(*) AS total

        FROM dbo.requirement_sla
        {where}
    """)

    row = db.execute(
        sql,
        params
    ).mappings().one()

    datos = resultado.get("data") or {}

    esperados = {
        "cumplidos": int(row["cumplidos"] or 0),
        "incumplidos": int(row["incumplidos"] or 0),
        "cancelados": int(row["cancelados"] or 0)
    }

    esperados["otros"] = (
        int(row["total"] or 0)
        - sum(esperados.values())
    )

    recibidos = {
        clave: datos.get(clave)
        for clave in esperados
    }

    correcto = all(
        isinstance(recibidos[clave], (int, float))
        and int(recibidos[clave]) == valor
        for clave, valor in esperados.items()
    )

    reportar(
        "Condiciones de solución",
        correcto,
        f"Tool={recibidos}; SQL={esperados}"
    )


def comprobar_rechazos(db):
    """
    Verifica que se rechacen solicitudes
    incompatibles antes de ejecutar SQL.
    """

    pruebas = [
        (
            "Filtro Estado no disponible",
            "requirement_consolidated",
            "rc_consultar_kpis",
            {"estado": "Resolved"},
            {},
            "unsupported_by_tool"
        ),
        (
            "Pareto ignora tipo",
            "incident_sla",
            "is_consultar_pareto_tipos",
            {"tipo_incidente": ["Ejemplo"]},
            {},
            "unsupported_by_tool"
        ),
        (
            "Ventana de cuatro meses",
            "requirement_consolidated",
            "rc_consultar_top_proyectos",
            {},
            {},
            "unsupported_by_tool"
        ),
        (
            "Fecha inválida",
            "incident_consolidated",
            "ic_consultar_kpis",
            {"desde": "2026-02-30"},
            {},
            "invalid_request"
        ),
    ]

    for (
        nombre,
        source,
        tool_id,
        filtros,
        opciones,
        esperado
    ) in pruebas:

        resultado = solicitud(
            db,
            source,
            tool_id,
            filtros,
            opciones
        )

        estado = resultado.get("status")

        reportar(
            nombre,
            estado == esperado,
            f"estado={estado}; esperado={esperado}"
        )


def main():

    db = SQLServerSessionLocal()

    try:
        nombre_db = db.execute(
            text("SELECT DB_NAME()")
        ).scalar_one()

        print("=" * 72)
        print("INTEGRACIÓN TOOLS VS SQL SERVER | SOLO LECTURA")
        print("=" * 72)
        print("Base de datos:", nombre_db)

        if str(nombre_db).casefold() != "serviciodba":
            raise RuntimeError(
                "La conexión no apunta a ServicioDBA"
            )

        for source in FUENTES:

            print("\n" + "-" * 72)
            print("FUENTE:", source)
            print("-" * 72)

            try:
                # 1. Histórico completo
                comprobar_kpi(
                    db,
                    source,
                    "Histórico completo",
                    {}
                )

                # 2. Obtener parámetros reales
                muestra = elegir_muestra(
                    db,
                    source
                )

                if muestra is None:
                    omitir(
                        "Filtros y rankings",
                        "No existen filas con proyecto "
                        "y prioridad estándar"
                    )
                    continue

                print("  Muestra:", muestra)

                # 3. Filtro mensual
                comprobar_kpi(
                    db,
                    source,
                    "Mes real",
                    muestra["periodo"]
                )

                # 4. Filtro por prioridad
                comprobar_kpi(
                    db,
                    source,
                    "Prioridad real",
                    {
                        "prioridad":
                        muestra["prioridad"]
                    }
                )

                # 5. Filtro por proyecto
                comprobar_kpi(
                    db,
                    source,
                    "Proyecto real",
                    {
                        "proyecto":
                        muestra["proyecto"]
                    }
                )

                # 6. Filtros combinados
                filtros_combinados = {
                    **muestra["periodo"],
                    "proyecto": muestra["proyecto"],
                    "prioridad": muestra["prioridad"]
                }

                comprobar_kpi(
                    db,
                    source,
                    "Mes + proyecto + prioridad",
                    filtros_combinados
                )

                # 7. Proyectos y rankings
                comprobar_proyectos(
                    db,
                    source,
                    muestra
                )

                # 8. SLA / OLA
                if source.endswith("_sla"):
                    comprobar_indicadores_sla(
                        db,
                        source,
                        muestra
                    )

                # 9. Condiciones Requerimientos SLA
                if source == "requirement_sla":
                    comprobar_condiciones_req_sla(
                        db,
                        muestra
                    )

            except Exception as error:

                reportar(
                    f"Ejecución {source}",
                    False,
                    f"{type(error).__name__}: {error}"
                )

                db.rollback()

        # 10. Solicitudes incompatibles
        print("\n" + "-" * 72)
        print("VALIDACIONES NEGATIVAS")
        print("-" * 72)

        comprobar_rechazos(db)

        # 11. Resumen
        print("\n" + "=" * 72)
        print("RESUMEN FINAL")
        print("=" * 72)

        print(f"Pruebas correctas: {OK}")
        print(f"Pruebas fallidas:  {FALLAS}")
        print(f"Pruebas omitidas:  {OMITIDAS}")

        if FALLAS == 0 and OMITIDAS == 0:
            print(
                "\nTODAS LAS PRUEBAS EJECUTADAS "
                "FUERON CORRECTAS"
            )
        elif FALLAS == 0:
            print(
                "\nSIN FALLOS, PERO HAY "
                "PRUEBAS QUE NO SE EJECUTARON"
            )
        else:
            print(
                "\nSE DETECTARON INCIDENCIAS "
                "QUE DEBEMOS REVISAR"
            )

    finally:
        # Nunca confirmamos transacciones.
        db.rollback()
        db.close()

        print("\nConexión SQL Server cerrada.")


if __name__ == "__main__":
    main()
