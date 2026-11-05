from time import perf_counter

from sqlalchemy.orm import Session
from app.schemas.consolidated_import_schema import IncidentConsolidatedDashboardFilters, RequirementConsolidatedDashboardFilters
from app.services import (incident_sla_service,requirement_sla_service,)
from app.repositories import (incident_sla_repository,requirement_sla_repository, incident_consolidated_repository,requirement_consolidated_repository,)
from datetime import date
from app.schemas.sla_import_schema import IncidentSLADashboardFilters
from app.schemas.sla_import_schema import RequirementSLADashboardFilters

def medir(nombre,funcion,*args):
    inicio = perf_counter()
    resultado = funcion(*args)
    print(f"[HOME] {nombre}: {perf_counter() - inicio:.3f} segundos")
    return resultado

MESES = {
    1:"ENE",2:"FEB",3:"MAR",4:"ABR",
    5:"MAY",6:"JUN",7:"JUL",8:"AGO",
    9:"SEP",10:"OCT",11:"NOV",12:"DIC",
}

def obtener_resumen(db: Session):
    inicio = perf_counter()


    incidentes_sla = medir(
        "KPI Incidentes SLA",
        incident_sla_service.obtener_kpis,
        db,
        IncidentSLADashboardFilters()
    )

    requerimientos_sla = medir(
        "KPI Requerimientos SLA",
        requirement_sla_service.obtener_kpis,
        db,
        RequirementSLADashboardFilters()
    )


    incidentes_consolidados = medir("KPI Incidentes Consolidados",incident_consolidated_repository.contar_total,db)
    requerimientos_consolidados = medir("KPI Requerimientos Consolidados",requirement_consolidated_repository.contar_total,db)

    incumplimientos_incidentes = medir("Incumplimientos Incidentes",incident_sla_repository.contar_incumplimientos,db)
    incumplimientos_requerimientos = medir("Incumplimientos Requerimientos",requirement_sla_repository.contar_incumplimientos,db)

    volumen_mensual = medir("Volumen Mensual",obtener_volumen_mensual,db)
    evolucion_sla = medir("Evolucion SLA",obtener_evolucion_sla,db)
    evolucion_operativa = medir("Evolucion Operativa",obtener_evolucion_operativa,volumen_mensual)
    cumplimiento = medir("Cumplimiento",obtener_cumplimiento,incidentes_sla)
    foco_atencion = medir("Foco Atencion",obtener_foco_atencion,db,incumplimientos_incidentes,incumplimientos_requerimientos)

    print(f"[HOME] TIEMPO TOTAL: {perf_counter() - inicio:.3f} segundos")

    return {
        "kpis": {
            "incidentes_consolidados": incidentes_consolidados,
            "incidentes_sla": incidentes_sla["total_tickets"],
            "requerimientos_consolidados": requerimientos_consolidados,
            "requerimientos_sla": requerimientos_sla["total_tickets"],
        },
        "indicadores_clave": {
            "sla_solucion_incidentes": incidentes_sla["sla_solucion"],
            "sla_solucion_requerimientos": requerimientos_sla["sla_solucion"],
            "incumplimientos_incidentes": incumplimientos_incidentes,
            "incumplimientos_requerimientos": incumplimientos_requerimientos,
        },
        "graficos": {
            "volumen_mensual": volumen_mensual,
            "evolucion_sla": evolucion_sla,
        },
        "resumen_ejecutivo": {
            "evolucion_operativa": evolucion_operativa,
            "cumplimiento": cumplimiento,
            "foco_atencion": foco_atencion,
        },
    }
    
def obtener_volumen_mensual(db: Session):
    incidentes = incident_consolidated_repository.obtener_volumen_mensual(
        db,
        IncidentConsolidatedDashboardFilters()
    )

    requerimientos = requirement_consolidated_repository.obtener_volumen_mensual(
        db,
        RequirementConsolidatedDashboardFilters()
    )

    meses = {}

    for tipo,rows in (("incidentes",incidentes),("requerimientos",requerimientos)):
        for row in rows:
            if row.anio is None or row.mes is None:
                continue

            clave = (row.anio,row.mes)

            if clave not in meses:
                meses[clave] = {
                    "anio": row.anio,
                    "mes": row.mes,
                    "periodo": f"{MESES[row.mes]}-{str(row.anio)[-2:]}",
                    "incidentes": None,
                    "requerimientos": None,
                }

            meses[clave][tipo] = row.tickets

    return [meses[clave] for clave in sorted(meses)]



def obtener_evolucion_sla(db: Session):
    incidentes = incident_sla_service.obtener_sla_solucion_tendencia(
        db,
        IncidentSLADashboardFilters()
    )

    requerimientos = requirement_sla_service.obtener_sla_solucion_tendencia(
        db,
        RequirementSLADashboardFilters()
    )


    claves = {
        tuple(map(int,item["mes"].split("-")))
        for item in incidentes
    }
    claves.update((item["anio"],item["mes"]) for item in requerimientos)

    meses = {
        clave: {
            "anio": clave[0],
            "mes": clave[1],
            "periodo": f"{MESES[clave[1]]}-{str(clave[0])[-2:]}",
            "incidentes": None,
            "requerimientos": None,
        }
        for clave in sorted(claves)
    }

    for item in incidentes:
        clave = tuple(map(int,item["mes"].split("-")))
        meses[clave]["incidentes"] = item["cumplimiento"] if item["medibles"] else None

    for item in requerimientos:
        clave = (item["anio"],item["mes"])
        cumplidos = item["cumplidos"]
        incumplidos = item["incumplidos"]
        medibles = cumplidos + incumplidos

        meses[clave]["requerimientos"] = (
            round(cumplidos * 100.0 / medibles,2)
            if medibles else None
        )

    #return list(meses.values())
    disponibles = [
        item for item in meses.values()
        if item["incidentes"] is not None or item["requerimientos"] is not None
    ]

    if not disponibles:
        return []

    disponibles.sort(key=lambda item:(item["anio"],item["mes"]))

    ultimo = disponibles[-1]
    limite = ultimo["anio"] * 12 + ultimo["mes"] - 4    

    return [
        item for item in disponibles
        if item["anio"] * 12 + item["mes"] >= limite
    ]

def obtener_evolucion_operativa(volumen_mensual):
    hoy = date.today()

    meses = [
        item for item in volumen_mensual
        if item["incidentes"] is not None
        and (item["anio"],item["mes"]) < (hoy.year,hoy.month)
    ]

    if len(meses) < 2:
        return {"variacion_porcentaje": None,"mensaje": "No hay suficientes meses para comparar."}

    anterior,actual = meses[-2:]

    diferencia_meses = (actual["anio"] * 12 + actual["mes"]) - (anterior["anio"] * 12 + anterior["mes"])

    if diferencia_meses != 1:
        return {"variacion_porcentaje": None,"mensaje": "No existen dos meses consecutivos disponibles."}

    if anterior["incidentes"] == 0:
        return {"variacion_porcentaje": None,"mensaje": "No se puede calcular la variación con el mes anterior en cero."}

    variacion = round((actual["incidentes"] - anterior["incidentes"]) * 100 / anterior["incidentes"],2)

    if variacion > 0:
        mensaje = f"El volumen de incidentes aumentó un {variacion:.2f}% respecto al mes anterior."
    elif variacion < 0:
        mensaje = f"El volumen de incidentes disminuyó un {abs(variacion):.2f}% respecto al mes anterior."
    else:
        mensaje = "El volumen de incidentes se mantuvo igual al mes anterior."

    return {
        "periodo_actual": actual["periodo"],
        "periodo_anterior": anterior["periodo"],
        "volumen_actual": actual["incidentes"],
        "volumen_anterior": anterior["incidentes"],
        "variacion_porcentaje": variacion,
        "mensaje": mensaje,
    }
    
def obtener_cumplimiento(incidentes_sla: dict):
    cumplimiento = incidentes_sla["sla_solucion"]
    objetivo = 95.0
    diferencia = round(cumplimiento - objetivo,2)

    if diferencia > 0:
        estado = f"{diferencia:.1f} pp sobre el objetivo."
    elif diferencia < 0:
        estado = f"{abs(diferencia):.1f} pp bajo el objetivo."
    else:
        estado = "en el objetivo."

    return {
        "sla_solucion": cumplimiento,
        "objetivo": objetivo,
        "diferencia_pp": diferencia,
        "mensaje": f"Cumplimiento {cumplimiento:.1f}%: {estado}",
    }

  
def obtener_foco_atencion(db: Session,incumplimientos_incidentes: int,incumplimientos_requerimientos: int):
    incidentes = incident_sla_repository.obtener_incumplimientos_por_proyecto(db)
    requerimientos = requirement_sla_repository.obtener_incumplimientos_por_proyecto(db)

    proyectos = {}

    for tipo,rows in (("incidentes",incidentes),("requerimientos",requerimientos)):
        for row in rows:
            proyecto = " ".join((row.proyecto or "").split())

            if not proyecto:
                continue

            clave = proyecto.casefold()

            if clave not in proyectos:
                proyectos[clave] = {
                    "proyecto": proyecto,
                    "incumplimientos_incidentes": 0,
                    "incumplimientos_requerimientos": 0,
                }

            proyectos[clave][f"incumplimientos_{tipo}"] += row.incumple or 0

    total_general = incumplimientos_incidentes + incumplimientos_requerimientos

    if not proyectos or total_general == 0:
        return {
            "proyecto": None,
            "incumplimientos_incidentes": 0,
            "incumplimientos_requerimientos": 0,
            "total_incumplimientos": 0,
            "porcentaje_total": 0.0,
            "mensaje": "No hay incumplimientos disponibles para identificar un proyecto crítico.",
        }

    foco = max(
        proyectos.values(),
        key=lambda item: item["incumplimientos_incidentes"] + item["incumplimientos_requerimientos"],
    )

    total_foco = foco["incumplimientos_incidentes"] + foco["incumplimientos_requerimientos"]
    porcentaje = round(total_foco * 100.0 / total_general,2)

    return {
        "proyecto": foco["proyecto"],
        "incumplimientos_incidentes": foco["incumplimientos_incidentes"],
        "incumplimientos_requerimientos": foco["incumplimientos_requerimientos"],
        "total_incumplimientos": total_foco,
        "porcentaje_total": porcentaje,
        "mensaje": f"El proyecto {foco['proyecto']} concentra {porcentaje:.2f}% de los incumplimientos de SLA Solución.",
    }