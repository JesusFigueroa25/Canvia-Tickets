from datetime import date, datetime, timedelta
from sqlalchemy.orm import Session
from app.repositories import daily_report_repository


def _fecha(valor) -> date:
    if isinstance(valor, datetime):
        return valor.date()
    if isinstance(valor, date):
        return valor
    return date.fromisoformat(str(valor)[:10])


def obtener_opciones_filtros(db: Session) -> dict:
    datos = daily_report_repository.obtener_opciones_filtros(db)
    return {
        "fecha_min": _fecha(datos["fecha_min"]) if datos["fecha_min"] else None,
        "fecha_max": _fecha(datos["fecha_max"]) if datos["fecha_max"] else None,
        "grupos_resolutores": datos["grupos_resolutores"],
        "proyectos": datos["proyectos"],
    }


def obtener_resumen(
    db: Session,
    *,
    desde: date | None = None,
    hasta: date | None = None,
    grupo_resolutor: str | None = None,
    proyecto: str | None = None,
) -> dict:
    if desde is not None and hasta is not None and desde > hasta:
        raise ValueError("La fecha Desde no puede ser posterior a Hasta")

    registros = daily_report_repository.obtener_conteos_diarios(
        db,
        desde=desde,
        hasta=hasta,
        grupo_resolutor=grupo_resolutor,
        proyecto=proyecto,
    )

    por_fecha: dict[date, dict] = {}

    for registro in registros:
        fecha_accion = _fecha(registro["fecha_accion"])
        incidentes = int(registro["incidentes"] or 0)
        requerimientos = int(registro["requerimientos"] or 0)
        tareas = int(registro["tareas"] or 0)

        por_fecha[fecha_accion] = {
            "fecha_accion": fecha_accion,
            "total_tickets": incidentes + requerimientos + tareas,
            "incidentes": incidentes,
            "requerimientos": requerimientos,
            "tareas": tareas,
        }

    if por_fecha:
        inicio = desde if desde is not None else min(por_fecha)
        fin = hasta if hasta is not None else max(por_fecha)
    elif desde is not None and hasta is not None:
        inicio, fin = desde, hasta
    else:
        inicio = fin = None

    diario = []
    if inicio is not None and fin is not None:
        dia_actual = inicio
        while dia_actual <= fin:
            diario.append(
                por_fecha.get(
                    dia_actual,
                    {
                        "fecha_accion": dia_actual,
                        "total_tickets": 0,
                        "incidentes": 0,
                        "requerimientos": 0,
                        "tareas": 0,
                    },
                )
            )
            if dia_actual == fin:
                break
            dia_actual += timedelta(days=1)

    total_incidentes = sum(fila["incidentes"] for fila in diario)
    total_requerimientos = sum(fila["requerimientos"] for fila in diario)
    total_tareas = sum(fila["tareas"] for fila in diario)

    kpis = {
        "total_tickets": total_incidentes + total_requerimientos + total_tareas,
        "total_incidentes": total_incidentes,
        "total_requerimientos": total_requerimientos,
        "total_tareas": total_tareas,
    }

    return {"kpis": kpis, "diario": diario}


def obtener_kpis(db: Session, **filtros) -> dict:
    return obtener_resumen(db, **filtros)["kpis"]


def obtener_diario(db: Session, **filtros) -> list[dict]:
    return obtener_resumen(db, **filtros)["diario"]


def obtener_proyectos(
    db: Session,
    *,
    desde: date | None = None,
    hasta: date | None = None,
    grupo_resolutor: str | None = None,
    proyecto: str | None = None,
) -> list[dict]:

    return daily_report_repository.obtener_proyectos(
        db,
        desde=desde,
        hasta=hasta,
        grupo_resolutor=grupo_resolutor,
        proyecto=proyecto,
    )



def obtener_top_proyectos(
    db: Session,
    *,
    desde: date | None = None,
    hasta: date | None = None,
    grupo_resolutor: str | None = None,
    proyecto: str | None = None,
) -> dict:

    resultados = (
        daily_report_repository.obtener_top_proyectos_mensual(
            db,
            desde=desde,
            hasta=hasta,
            grupo_resolutor=grupo_resolutor,
            proyecto=proyecto,
        )
    )

    if not resultados:
        return {
            "periodos": [],
            "proyectos": []
        }

    meses = {
        1: "ENE",
        2: "FEB",
        3: "MAR",
        4: "ABR",
        5: "MAY",
        6: "JUN",
        7: "JUL",
        8: "AGO",
        9: "SEP",
        10: "OCT",
        11: "NOV",
        12: "DIC"
    }

    def indice(anio: int, mes: int) -> int:
        return int(anio) * 12 + int(mes) - 1

    indices = [
        indice(
            registro["anio"],
            registro["mes"]
        )
        for registro in resultados
    ]

    fin = (
        indice(hasta.year, hasta.month)
        if hasta
        else max(indices)
    )

    inicio = (
        indice(desde.year, desde.month)
        if desde
        else (
            min(indices)
            if hasta
            else max(min(indices), fin - 3)
        )
    )

    if inicio > fin:
        return {
            "periodos": [],
            "proyectos": []
        }

    periodos = []

    for valor in range(inicio, fin + 1):

        anio, mes_indice = divmod(valor, 12)
        mes = mes_indice + 1

        periodos.append({
            "anio": anio,
            "mes": mes,
            "periodo": f"{meses[mes]}-{str(anio)[-2:]}"
        })

    proyectos = {}

    for registro in resultados:

        clave_mes = indice(
            registro["anio"],
            registro["mes"]
        )

        if not inicio <= clave_mes <= fin:
            continue

        nombre = registro["proyecto"]
        cantidad = int(registro["tickets"] or 0)

        if nombre not in proyectos:
            proyectos[nombre] = {
                "total_tickets": 0,
                "mensual": {}
            }

        proyectos[nombre]["total_tickets"] += cantidad

        conteos = proyectos[nombre]["mensual"]

        conteos[clave_mes] = (
            conteos.get(clave_mes, 0) + cantidad
        )

    ranking = sorted(
        proyectos.items(),
        key=lambda item: (
            -item[1]["total_tickets"],
            item[0].casefold()
        )
    )[:10]

    return {
        "periodos": periodos,
        "proyectos": [
            {
                "proyecto": nombre,
                "total_tickets": datos["total_tickets"],
                "mensual": [
                    {
                        "periodo": periodo["periodo"],
                        "tickets": datos["mensual"].get(
                            indice(
                                periodo["anio"],
                                periodo["mes"]
                            ),
                            0
                        )
                    }
                    for periodo in periodos
                ]
            }
            for nombre, datos in ranking
        ]
    }


