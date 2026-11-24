"""Construcción de respuestas para tabla y gráfico de Resolutores."""

MESES = {
    1: "ENE", 2: "FEB", 3: "MAR", 4: "ABR", 5: "MAY", 6: "JUN",
    7: "JUL", 8: "AGO", 9: "SEP", 10: "OCT", 11: "NOV", 12: "DIC",
}


def construir_rendimiento_resolutores(resultados, pagina: int = 1, tamano: int = 20) -> dict:
    """Replica el contrato y orden del servicio Incidentes Consolidados.

    La paginación se aplica solo al ranking; períodos y totales cubren todos los
    resolutores incluidos en el filtro, tal como en la implementación de origen.
    """
    claves_meses = sorted({(int(row["anio"]), int(row["mes"])) for row in resultados})
    periodos = [
        {"anio": anio, "mes": mes, "periodo": f"{MESES[mes]}-{str(anio)[-2:]}"}
        for anio, mes in claves_meses
    ]

    resumen: dict[str, dict] = {}
    totales_meses = {clave: 0 for clave in claves_meses}

    for row in resultados:
        nombre = row["nombre_resolutor"] or "Sin especificar"
        clave = (int(row["anio"]), int(row["mes"]))
        cantidad = int(row["tickets"] or 0)
        item = resumen.setdefault(nombre, {"total_tickets": 0, "mensual": {}})
        item["total_tickets"] += cantidad
        item["mensual"][clave] = item["mensual"].get(clave, 0) + cantidad
        totales_meses[clave] += cantidad

    ranking = sorted(resumen.items(), key=lambda item: (-item[1]["total_tickets"], item[0]))
    total_resolutores = len(ranking)
    inicio = (pagina - 1) * tamano
    ranking_paginado = ranking[inicio:inicio + tamano]

    return {
        "periodos": periodos,
        "resolutores": [
            {
                "nombre_resolutor": nombre,
                "total_tickets": datos["total_tickets"],
                "mensual": [
                    {"periodo": p["periodo"],
                     "tickets": datos["mensual"].get((p["anio"], p["mes"]), 0)}
                    for p in periodos
                ],
            }
            for nombre, datos in ranking_paginado
        ],
        "totales_mensuales": [
            {"periodo": p["periodo"], "tickets": totales_meses[(p["anio"], p["mes"])]}
            for p in periodos
        ],
        "total_general": sum(totales_meses.values()),
        "total_resolutores": total_resolutores,
        "pagina": pagina,
        "tamano": tamano,
        "total_paginas": (total_resolutores + tamano - 1) // tamano,
    }


def construir_tickets_por_resolutor(rendimiento: dict, limite: int) -> dict:
    return {
        "total_general": rendimiento["total_general"],
        "limite": limite,
        "periodos": rendimiento["periodos"],
        "resolutores": rendimiento["resolutores"],
    }
