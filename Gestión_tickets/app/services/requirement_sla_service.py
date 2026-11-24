from app.services.resolutor_dashboard_service import (
    construir_rendimiento_resolutores,
    construir_tickets_por_resolutor,
)
from datetime import datetime, date
from sqlalchemy.orm import Session
from app.database.sqlserver import SQLServerSessionLocal, verificar_conexion_sqlserver
from app.etl.requirement_sla_etl import procesar_requirement_sla
from app.etl.change_detector import detectar_cambios
from app.repositories import (requirement_sla_repository,import_run_repository,)
from app.etl.condicion_dia import agregar_condicion_dia
from app.schemas.sla_import_schema import RequirementSLADashboardFilters

MESES = {1: "ENE", 2: "FEB", 3: "MAR", 4: "ABR", 5: "MAY", 6: "JUN", 7: "JUL", 8: "AGO", 9: "SEP", 10: "OCT", 11: "NOV", 12: "DIC",}

def importar(db: Session,archivo,nombre_archivo=None):
    fecha_inicio = datetime.now()
    
    # 1. Validar conexión a SQL Server
    try:
        verificar_conexion_sqlserver(db)
    except Exception:
        db.rollback()
        raise ConnectionError(
            "No hay conexión con SQL Server. Verifique que esté conectado a la red de Canvia."
        ) from error

    try:
        # 2. Crear auditoría
        import_run = import_run_repository.crear(
            db=db,
            tipo="requirement_sla",
            nombre_archivo=nombre_archivo,
            fecha_inicio=fecha_inicio,
            sqlite_status="NO_APLICA",
            sqlserver_status="PROCESSING"
        )

        # 3. Ejecutar ETL
        archivo.seek(0)
        df, filas_excel, duplicados = procesar_requirement_sla(archivo)
        filas_procesadas = len(df)

        # 4. STAGING - SQL SERVER
        requirement_sla_repository.limpiar_staging(db)
        filas_staging = requirement_sla_repository.cargar_staging(db,df)
        db.flush()

        # 5. COMPARACIÓN - SQL SERVER
        df_staging = requirement_sla_repository.obtener_staging(db)
        df_oficial = requirement_sla_repository.obtener_oficial(db)
        resultado = detectar_cambios(df_staging,df_oficial)

        df_new = resultado["NEW"]
        df_changed = resultado["CHANGED"]
        df_same = resultado["SAME"]
        
        # TRANSFORMACION DE CONDICION_DIA 
        df_new = agregar_condicion_dia(df_new)
        df_changed = agregar_condicion_dia(df_changed)

        #  6. INSERT - SQL SERVER
        nuevos = requirement_sla_repository.insertar_nuevos(db,df_new)
        
        # 7. UPDATE - SQL SERVER
        modificados = requirement_sla_repository.actualizar_modificados(db,df_changed)
        sin_cambios = len(df_same)

        # 8. COMPLETAR AUDITORÍA
        fecha_fin = datetime.now()

        import_run_repository.completar(
            db=db,
            import_run=import_run,
            fecha_fin=fecha_fin,
            filas_excel=filas_excel,
            filas_aceptadas=filas_staging,
            filas_rechazadas=max(filas_excel - filas_staging,0),
            nuevos=nuevos,
            modificados=modificados,
            sin_cambios=sin_cambios,
            sqlite_status="NO_APLICA",
            sqlserver_status="SUCCESS"
        )
        
        # 9. CONFIRMAR TRANSACCIÓN
        db.commit()

    except Exception as error:

        db.rollback()

        try:
            import_run_error = import_run_repository.crear(
                db=db,
                tipo="requirement_sla",
                nombre_archivo=nombre_archivo,
                fecha_inicio=fecha_inicio,
                sqlite_status="NO_APLICA",
                sqlserver_status="ERROR"
            )

            import_run_repository.marcar_error(
                db=db,
                import_run=import_run_error,
                fecha_fin=datetime.now(),
                error=error,
                sqlite_status="NO_APLICA",
                sqlserver_status="ERROR"
            )

            db.commit()

        except Exception:
            db.rollback()

        raise

    return {
        "tipo": "requirement_sla",
        "tabla_staging": "stg_requirement_sla",
        "tabla_destino": "requirement_sla",
        "filas_excel": filas_excel,
        "filas_procesadas": filas_procesadas,
        "filas_staging": filas_staging,
        "duplicados": duplicados,
        "nuevos": nuevos,
        "modificados": modificados,
        "sin_cambios": sin_cambios,
        "mensaje": "Archivo procesado y cambios clasificados"
    }

#Funciones globales
def _calcular_porcentaje(cumple: int,incumple: int,) -> float:
    medibles = cumple + incumple
    if medibles == 0:
        return 0.0

    return round(cumple * 100.0 / medibles,2,)

def _metricas_explorador(tot: int, c: int, i: int ):
    return {
        "tot": tot,
        "c": c,
        "i": i,
        "porcentaje_inc": (
            round(i * 100.0 / tot, 2)
            if tot > 0
            else 0.0
        )
    }    
   

def obtener_opciones_filtros(db: Session):
    resultado = requirement_sla_repository.obtener_opciones_filtros(db)
    fecha_min = resultado["fecha_min"]
    fecha_max = resultado["fecha_max"]

    return {
        "fecha_min": fecha_min.date().isoformat() if fecha_min else None,
        "fecha_max": fecha_max.date().isoformat() if fecha_max else None,
        "grupos_resolutores": resultado["grupos_resolutores"],
        "prioridades": resultado["prioridades"],
        "categorias": resultado["categorias"],
        "proyectos": resultado["proyectos"],
        "tipos_requerimiento": resultado["tipos_requerimiento"],
        "condiciones_dia": resultado["condiciones_dia"],
        "nombres_resolutores": resultado["nombres_resolutores"],
    }



#KPIS
def obtener_kpis(
    db: Session,
    filtros: RequirementSLADashboardFilters
):
    row = requirement_sla_repository.obtener_kpis(db,filtros)

    total_tickets = row.total_tickets or 0
    sla_respuesta_cumple = row.sla_respuesta_cumple or 0
    sla_respuesta_incumple = row.sla_respuesta_incumple or 0
    sla_solucion_cumple = row.sla_solucion_cumple or 0
    sla_solucion_incumple = row.sla_solucion_incumple or 0
    ola_respuesta_cumple = row.ola_respuesta_cumple or 0
    ola_respuesta_incumple = row.ola_respuesta_incumple or 0
    ola_solucion_cumple = row.ola_solucion_cumple or 0
    ola_solucion_incumple = row.ola_solucion_incumple or 0
    
    cant_req_cumplidos = sla_solucion_cumple
    cant_req_no_cumplidos = sla_solucion_incumple
    porcentaje_cumpl_req = (
        round(cant_req_cumplidos * 100.0 / total_tickets,2)
        if total_tickets > 0
        else 0.0
    )

    return {
        "total_tickets": total_tickets,
        "sla_respuesta": _calcular_porcentaje(sla_respuesta_cumple,sla_respuesta_incumple),
        "sla_solucion": _calcular_porcentaje(sla_solucion_cumple,sla_solucion_incumple),
        "ola_respuesta": _calcular_porcentaje(ola_respuesta_cumple,ola_respuesta_incumple),
        "ola_solucion": _calcular_porcentaje(ola_solucion_cumple,ola_solucion_incumple),
        "cant_req_cumplidos": cant_req_cumplidos,
        "cant_req_no_cumplidos": cant_req_no_cumplidos,
        "porcentaje_cumpl_req": porcentaje_cumpl_req
    }


#SLA Solución: Cumplidos vs Incumplidos
def obtener_sla_solucion_tendencia(
    db: Session,
    filtros: RequirementSLADashboardFilters
):
    rows = requirement_sla_repository.obtener_sla_solucion_tendencia(db,filtros)

    return [
        {
            "anio": row.anio,
            "mes": row.mes,
            "periodo": (f"{MESES[row.mes]}-{str(row.anio)[-2:]}"),
            "cumplidos": row.cumplidos or 0,
            "incumplidos": row.incumplidos or 0,
        }
        for row in rows
    ]


#Volumen de Requerimientos
def obtener_volumen_requerimientos(
    db: Session,
    filtros: RequirementSLADashboardFilters
):
    rows = requirement_sla_repository.obtener_volumen_requerimientos(db,filtros)
    resultado = []

    for i,row in enumerate(rows):
        inicio = max(0,i - 2)
        ventana = rows[inicio:i + 1]
        promedio = sum(
            item.tickets
            for item in ventana
        ) / len(ventana)

        resultado.append(
            {
                "anio": row.anio,
                "mes": row.mes,
                "periodo": (f"{MESES[row.mes]}-{str(row.anio)[-2:]}"),
                "tickets": row.tickets,
                "tendencia": round(promedio,2),
            }
        )

    return resultado


#Explorador por Proyectos
def obtener_proyectos(
    db: Session,
    filtros: RequirementSLADashboardFilters
):
    rows = requirement_sla_repository.obtener_proyectos(db,filtros)

    total_general = sum(
        row.tickets or 0
        for row in rows
    )

    resultado = []

    for row in rows:
        tickets = row.tickets or 0
        cumple = row.cumple or 0
        incumple = row.incumple or 0
        sin_medicion = row.sin_medicion or 0
        medibles = cumple + incumple
        respuesta_cumple = (row.respuesta_cumple or 0)
        respuesta_incumple = (row.respuesta_incumple or 0)

        resultado.append(
            {
                "proyecto": row.proyecto,
                "tickets": tickets,
                "medibles": medibles,
                "sin_medicion": sin_medicion,
                "cumple": cumple,
                "incumple": incumple,
                "sla_solucion": _calcular_porcentaje(cumple,incumple,),
                "sla_respuesta": _calcular_porcentaje(respuesta_cumple,respuesta_incumple,),
                "porcentaje_volumen": (
                    round(tickets * 100.0 / total_general,2,)
                    if total_general
                    else 0.0
                ),
            }
        )

    return resultado


#Pareto de Tipos de Requerimiento
def obtener_pareto_requerimientos(
    db: Session,
    filtros: RequirementSLADashboardFilters
):
    filtros_pareto = filtros.model_copy(
        update={"tipo_requerimiento": []}
    )

    rows = requirement_sla_repository.obtener_pareto_requerimientos(
        db,
        filtros_pareto
    )
    
    total = sum(
        row.cantidad or 0
        for row in rows
    )

    acumulado = 0
    resultado = []

    for ranking,row in enumerate(rows[:10],start=1,):
        cantidad = row.cantidad or 0
        acumulado += cantidad

        resultado.append(
            {
                "ranking": ranking,
                "tipo_requerimiento":row.tipo_requerimiento,
                "cantidad": cantidad,
                "porcentaje": (
                    round(cantidad * 100.0 / total,2,)
                    if total
                    else 0.0
                ),
                "porcentaje_acumulado": (
                    round(acumulado * 100.0 / total,2,)
                    if total
                    else 0.0
                ),
            }
        )

    return resultado


#Tendencia de Requerimientos
def obtener_tendencia_requerimientos(
    db: Session,
    filtros: RequirementSLADashboardFilters,
    ranking_desde: int = 1,
    ranking_hasta: int = 5
):
    pareto = requirement_sla_repository.obtener_pareto_requerimientos(
        db,
        filtros
    )
    
    seleccionados = pareto[
        ranking_desde - 1:
        ranking_hasta
    ]
    
    if not seleccionados:
        return []

    mapa = {}

    for ranking,row in enumerate(pareto,start=1,):
        if (
            ranking_desde
            <= ranking
            <= ranking_hasta
        ):
            tipo_normalizado = (row.tipo_normalizado)
            mapa[tipo_normalizado] = {"ranking": ranking,"tipo_requerimiento":row.tipo_requerimiento,}

    rows = requirement_sla_repository.obtener_tendencia_requerimientos(
        db,
        list(mapa.keys()),
        filtros
    )

    resultado = []

    for row in rows:
        info = mapa[
            row.tipo_normalizado
        ]

        resultado.append(
            {
                "ranking": info["ranking"],
                "tipo_requerimiento":info["tipo_requerimiento"],
                "anio": row.anio,
                "mes": row.mes,
                "periodo": (f"{MESES[row.mes]}-{str(row.anio)[-2:]}"),
                "tickets": row.tickets or 0,
            }
        )
        
    return sorted(
        resultado,
        key=lambda item: (
            item["ranking"],
            item["anio"],
            item["mes"],
        ),
    )


#Desempeño por Resolutor
def obtener_resolutores(
    db: Session,
    filtros: RequirementSLADashboardFilters
):
    rows = requirement_sla_repository.obtener_resolutores(db,filtros)

    return [
        {
            "resolutor": row.resolutor,
            "cantidad": row.cantidad or 0,
        }
        for row in rows
    ]


#Participación por Proyecto
def obtener_participacion_proyectos(
    db: Session,
    filtros: RequirementSLADashboardFilters
):
    rows = requirement_sla_repository.obtener_proyectos(db,filtros)

    top_10 = rows[:10]

    total_top_10 = sum(
        row.tickets or 0
        for row in top_10
    )

    return [
        {
            "proyecto": row.proyecto,
            "tickets": row.tickets or 0,
            "participacion": (
                round((row.tickets or 0)* 100.0/ total_top_10,2,)
                if total_top_10
                else 0.0
            ),
        }
        for row in top_10
    ]

    
    

# Explorador de Tipos de Requerimientos
def obtener_explorador_tipos(
    db: Session,
    filtros: RequirementSLADashboardFilters
):
    rows = requirement_sla_repository.obtener_explorador_tipos(db,filtros)

    claves_periodos = sorted({
        (row.anio, row.mes)
        for row in rows
    })

    periodos = [
        {
            "anio": anio,
            "mes": mes,
            "periodo": f"{MESES[mes]}-{str(anio)[-2:]}"
        }
        for anio, mes in claves_periodos
    ]

    tipos = {}
    totales_mensuales = {
        clave: {
            "tot": 0,
            "c": 0,
            "i": 0
        }
        for clave in claves_periodos
    }

    for row in rows:
        clave_tipo = row.tipo_normalizado
        nombre_tipo = row.tipo_requerimiento
        clave_mes = (row.anio, row.mes)
        tot = int(row.tot or 0)
        c = int(row.c or 0)
        i = int(row.i or 0)

        if clave_tipo not in tipos:
            tipos[clave_tipo] = {
                "tipo_requerimiento": nombre_tipo,
                "mensual": {},
                "tot": 0,
                "c": 0,
                "i": 0
            }

        tipo = tipos[clave_tipo]
        if nombre_tipo < tipo["tipo_requerimiento"]:
            tipo["tipo_requerimiento"] = nombre_tipo

        tipo["mensual"][clave_mes] = {
            "tot": tot,
            "c": c,
            "i": i
        }

        tipo["tot"] += tot
        tipo["c"] += c
        tipo["i"] += i

        totales_mensuales[clave_mes]["tot"] += tot
        totales_mensuales[clave_mes]["c"] += c
        totales_mensuales[clave_mes]["i"] += i

    tipos_ordenados = sorted(
        tipos.values(),
        key=lambda item: (
            -item["tot"],
            item["tipo_requerimiento"].casefold()
        )
    )

    filas = []
    for tipo in tipos_ordenados:

        mensual = []

        for periodo in periodos:

            clave_mes = (
                periodo["anio"],
                periodo["mes"]
            )

            datos_mes = tipo["mensual"].get(
                clave_mes,
                {
                    "tot": 0,
                    "c": 0,
                    "i": 0
                }
            )

            mensual.append({
                **periodo,
                **_metricas_explorador(
                    datos_mes["tot"],
                    datos_mes["c"],
                    datos_mes["i"]
                )
            })

        filas.append({
            "tipo_requerimiento": tipo["tipo_requerimiento"],
            "mensual": mensual,
            "total": _metricas_explorador(
                tipo["tot"],
                tipo["c"],
                tipo["i"]
            )
        })

    total_mensual = []
    for periodo in periodos:

        clave_mes = (
            periodo["anio"],
            periodo["mes"]
        )

        datos_mes = totales_mensuales[clave_mes]

        total_mensual.append({
            **periodo,
            **_metricas_explorador(
                datos_mes["tot"],
                datos_mes["c"],
                datos_mes["i"]
            )
        })

    total_tickets = sum(
        item["tot"]
        for item in totales_mensuales.values()
    )

    total_cumplidos = sum(
        item["c"]
        for item in totales_mensuales.values()
    )

    total_incumplidos = sum(
        item["i"]
        for item in totales_mensuales.values()
    )

    return {
        "periodos": periodos,
        "filas": filas,
        "total_general": {
            "mensual": total_mensual,
            "total": _metricas_explorador(
                total_tickets,
                total_cumplidos,
                total_incumplidos
            )
        }
    }


# Distribución por Condición Día
def obtener_distribucion_condicion_dia(
    db: Session,
    filtros: RequirementSLADashboardFilters
):
    rows = (
        requirement_sla_repository.obtener_distribucion_condicion_dia(
            db,
            filtros
        )
    )

    condiciones = [
        "Lun-Vie",
        "Fuera Horario",
        "Fin Sem."
    ]

    conteos = {
        row.condicion_dia: int(row.tickets or 0)
        for row in rows
    }

    total_tickets = sum(
        conteos.values()
    )

    distribucion = []

    for condicion in condiciones:

        tickets = conteos.get(
            condicion,
            0
        )

        porcentaje = (
            round(
                tickets * 100.0 / total_tickets,
                2
            )
            if total_tickets > 0
            else 0.0
        )

        distribucion.append({
            "condicion_dia": condicion,
            "tickets": tickets,
            "porcentaje": porcentaje
        })

    return {
        "total_tickets": total_tickets,
        "distribucion": distribucion
    }


# Porcentaje de Cumplimiento de SLA
def obtener_porcentaje_cumplimiento_sla(
    db: Session,
    filtros: RequirementSLADashboardFilters
):
    rows = (
        requirement_sla_repository.obtener_porcentaje_cumplimiento_sla(
            db,
            filtros
        )
    )

    condiciones = [
        "Cumplido",
        "No cumplido",
        "Medición cancelada"
    ]

    conteos = {
        row.condicion: int(row.tickets or 0)
        for row in rows
    }

    total_tickets = sum(conteos.values())
    cumplidos = conteos.get("Cumplido", 0)
    incumplidos = conteos.get("No cumplido", 0)
    cancelados = conteos.get("Medición cancelada", 0)

    otros = sum(
        cantidad
        for condicion, cantidad in conteos.items()
        if condicion not in condiciones
    )

    porcentaje_cumpl_req = (
        round(
            cumplidos * 100.0 / total_tickets,
            2
        )
        if total_tickets > 0
        else 0.0
    )

    distribucion = []

    for condicion in condiciones:
        tickets = conteos.get(condicion, 0)

        porcentaje = (
            round(
                tickets * 100.0 / total_tickets,
                2
            )
            if total_tickets > 0
            else 0.0
        )

        distribucion.append({
            "condicion": condicion,
            "tickets": tickets,
            "porcentaje": porcentaje
        })

    if otros > 0:
        distribucion.append({
            "condicion": "Otros / Sin medición",
            "tickets": otros,
            "porcentaje": round(
                otros * 100.0 / total_tickets,
                2
            ) if total_tickets > 0 else 0.0
        })

    return {
        "total_tickets": total_tickets,
        "cumplidos": cumplidos,
        "incumplidos": incumplidos,
        "cancelados": cancelados,
        "otros": otros,
        "porcentaje_cumpl_req": porcentaje_cumpl_req,
        "distribucion": distribucion
    }





# Cumplimiento de SLA por Horario - Condición Día
def obtener_cumplimiento_sla_horario(
    db: Session,
    filtros: RequirementSLADashboardFilters
):
    rows = (
        requirement_sla_repository.obtener_cumplimiento_sla_horario(
            db,
            filtros
        )
    )

    condiciones = [
        "Lun-Vie",
        "Fuera Horario",
        "Fin Sem."
    ]

    datos = {
        row.condicion_dia: {
            "total_tickets": int(row.total_tickets or 0),
            "cumplidos": int(row.cumplidos or 0),
            "incumplidos": int(row.incumplidos or 0),
            "cancelados": int(row.cancelados or 0)
        }
        for row in rows
    }

    distribucion = []

    for condicion in condiciones:
        valores = datos.get(
            condicion,
            {
                "total_tickets": 0,
                "cumplidos": 0,
                "incumplidos": 0,
                "cancelados": 0
            }
        )

        distribucion.append({
            "condicion_dia": condicion,
            "total_tickets": valores["total_tickets"],
            "cumplidos": valores["cumplidos"],
            "incumplidos": valores["incumplidos"],
            "cancelados": valores["cancelados"]
        })

    total_tickets = sum(
        item["total_tickets"]
        for item in distribucion
    )

    total_cumplidos = sum(
        item["cumplidos"]
        for item in distribucion
    )

    total_incumplidos = sum(
        item["incumplidos"]
        for item in distribucion
    )

    total_cancelados = sum(
        item["cancelados"]
        for item in distribucion
    )

    return {
        "total_tickets": total_tickets,
        "total_cumplidos": total_cumplidos,
        "total_incumplidos": total_incumplidos,
        "total_cancelados": total_cancelados,
        "distribucion": distribucion
    }


# Cumplimiento de SLA por Prioridad
def obtener_cumplimiento_sla_prioridad(
    db: Session,
    filtros: RequirementSLADashboardFilters
):
    rows = (
        requirement_sla_repository.obtener_cumplimiento_sla_prioridad(
            db,
            filtros
        )
    )

    prioridades = [
        "P1",
        "P2",
        "P3",
        "P4"
    ]

    datos = {
        row.prioridad: {
            "total_tickets": int(row.total_tickets or 0),
            "cumplidos": int(row.cumplidos or 0),
            "incumplidos": int(row.incumplidos or 0),
            "cancelados": int(row.cancelados or 0)
        }
        for row in rows
    }
    
    distribucion = []

    for prioridad_item in prioridades:

        valores = datos.get(
            prioridad_item,
            {
                "total_tickets": 0,
                "cumplidos": 0,
                "incumplidos": 0,
                "cancelados": 0
            }
        )

        distribucion.append({
            "prioridad": prioridad_item,
            "total_tickets": valores["total_tickets"],
            "cumplidos": valores["cumplidos"],
            "incumplidos": valores["incumplidos"],
            "cancelados": valores["cancelados"]
        })

    total_tickets = sum(
        item["total_tickets"]
        for item in distribucion
    )

    total_cumplidos = sum(
        item["cumplidos"]
        for item in distribucion
    )

    total_incumplidos = sum(
        item["incumplidos"]
        for item in distribucion
    )

    total_cancelados = sum(
        item["cancelados"]
        for item in distribucion
    )

    return {
        "total_tickets": total_tickets,
        "total_cumplidos": total_cumplidos,
        "total_incumplidos": total_incumplidos,
        "total_cancelados": total_cancelados,
        "distribucion": distribucion
    }


# Top 10 - Cumplimiento de SLA por Categoría
def obtener_top10_cumplimiento_sla_categoria(
    db: Session,
    filtros: RequirementSLADashboardFilters
):
    rows = (
        requirement_sla_repository.obtener_top10_cumplimiento_sla_categoria(
            db,
            filtros
        )
    )

    distribucion = []

    for row in rows:
        distribucion.append({
            "categoria": row.categoria,
            "total_tickets": int(row.total_tickets or 0),
            "cumplidos": int(row.cumplidos or 0),
            "incumplidos": int(row.incumplidos or 0),
            "cancelados": int(row.cancelados or 0)
        })

    total_tickets = sum(
        item["total_tickets"]
        for item in distribucion
    )

    total_cumplidos = sum(
        item["cumplidos"]
        for item in distribucion
    )

    total_incumplidos = sum(
        item["incumplidos"]
        for item in distribucion
    )

    total_cancelados = sum(
        item["cancelados"]
        for item in distribucion
    )

    return {
        "total_tickets": total_tickets,
        "total_cumplidos": total_cumplidos,
        "total_incumplidos": total_incumplidos,
        "total_cancelados": total_cancelados,
        "distribucion": distribucion
    }


# Cumplimiento de SLA por Tipo
def obtener_cumplimiento_sla_tipo(
    db: Session,
    filtros: RequirementSLADashboardFilters,
    limite: int | None = None
):
    rows = (
        requirement_sla_repository.obtener_cumplimiento_sla_tipo(
            db,
            filtros,
            limite=limite
        )
    )

    distribucion = []

    for row in rows:
        distribucion.append({
            "tipo_requerimiento": row.tipo_requerimiento,
            "total_tickets": int(row.total_tickets or 0),
            "cumplidos": int(row.cumplidos or 0),
            "incumplidos": int(row.incumplidos or 0),
            "cancelados": int(row.cancelados or 0)
        })

    total_tickets = sum(
        item["total_tickets"]
        for item in distribucion
    )

    total_cumplidos = sum(
        item["cumplidos"]
        for item in distribucion
    )

    total_incumplidos = sum(
        item["incumplidos"]
        for item in distribucion
    )

    total_cancelados = sum(
        item["cancelados"]
        for item in distribucion
    )

    return {
        "total_tickets": total_tickets,
        "total_cumplidos": total_cumplidos,
        "total_incumplidos": total_incumplidos,
        "total_cancelados": total_cancelados,
        "distribucion": distribucion
    }


# Análisis de Pareto de Incumplimientos por Categoría
def obtener_pareto_sla_categorias(
    db: Session,
    filtros: RequirementSLADashboardFilters
):
    rows = (
        requirement_sla_repository.obtener_pareto_sla_categorias(
            db,
            filtros
        )
    )

    registros = [
        {
            "categoria": row.categoria,
            "total_tickets": int(row.total_tickets or 0),
            "cumplidos": int(row.cumplidos or 0),
            "incumplidos": int(row.incumplidos or 0),
            "cancelados": int(row.cancelados or 0)
        }
        for row in rows
    ]

    total_tickets = sum(
        item["total_tickets"]
        for item in registros
    )

    total_cumplidos = sum(
        item["cumplidos"]
        for item in registros
    )

    total_incumplidos = sum(
        item["incumplidos"]
        for item in registros
    )

    total_cancelados = sum(
        item["cancelados"]
        for item in registros
    )

    total_categorias = len(registros)

    registros.sort(
        key=lambda item: (
            -item["incumplidos"],
            item["categoria"].casefold()
        )
    )

    resultado = {
        "total_categorias": total_categorias,

        "total_general": {
            "total_tickets": total_tickets,
            "cumplidos": total_cumplidos,
            "incumplidos": total_incumplidos,
            "cancelados": total_cancelados,
            "incumplidos_acumulados": total_incumplidos,
            "porcentaje_req": (100.0 if total_incumplidos > 0 else 0.0),
            "porcentaje_acumulado": (100.0 if total_incumplidos > 0 else 0.0)
        },

        "filas": []
    }

    if total_incumplidos == 0:
        return resultado

    acumulado = 0
    posicion = 0
    filas = []

    while posicion < len(registros):

        incumplimientos = registros[posicion]["incumplidos"]
        fin_grupo = posicion

        while (
            fin_grupo < len(registros)
            and registros[fin_grupo]["incumplidos"]
            == incumplimientos
        ):
            fin_grupo += 1

        ranking = posicion + 1
        porcentaje_previo = (
            acumulado * 100.0 / total_incumplidos
        )

        acumulado += (
            incumplimientos * (fin_grupo - posicion)
        )

        porcentaje_acumulado = round(
            acumulado * 100.0 / total_incumplidos,
            2
        )

        if porcentaje_previo < 80:
            semaforo = "Rojo"
        elif porcentaje_previo < 95:
            semaforo = "Amarillo"
        else:
            semaforo = "Verde"

        for item in registros[posicion:fin_grupo]:

            porcentaje_req = round(
                item["incumplidos"] * 100.0 / total_incumplidos,
                2
            )

            filas.append({
                "categoria": item["categoria"],
                "total_tickets": item["total_tickets"],
                "cumplidos": item["cumplidos"],
                "incumplidos": item["incumplidos"],
                "cancelados": item["cancelados"],
                "ranking": ranking,
                "incumplidos_acumulados": acumulado,
                "porcentaje_req": porcentaje_req,
                "porcentaje_acumulado": porcentaje_acumulado,
                "semaforo": semaforo
            })

        posicion = fin_grupo

    resultado["filas"] = filas

    return resultado


# Cant Req. No Cumplidos y % Acum. por Categorización - Categoría
def obtener_pareto_sla_categorias_grafico(
    db: Session,
    filtros: RequirementSLADashboardFilters
):
    pareto = obtener_pareto_sla_categorias(
        db,
        filtros
    )

    total_categorias = pareto["total_categorias"]
    total_incumplimientos = (pareto["total_general"]["incumplidos"])

    filas = [
        fila
        for fila in pareto["filas"]
        if fila["incumplidos"] > 0
    ][:10]

    serie = []

    for fila in filas:
        serie.append({
            "categoria": fila["categoria"],
            "ranking": fila["ranking"],
            "cumplidos": fila["cumplidos"],
            "incumplidos": fila["incumplidos"],
            "incumplidos_acumulados": (fila["incumplidos_acumulados"]),
            "porcentaje_req": fila["porcentaje_req"],
            "porcentaje_acumulado": (fila["porcentaje_acumulado"]),
            "semaforo": fila["semaforo"]
        })

    categorias_para_80 = 0
    porcentaje_categorias_para_80 = 0.0
    porcentaje_incumplimientos_cubiertos = 0.0

    if total_incumplimientos > 0:
        umbral_80 = total_incumplimientos * 0.80

        fila_corte = next(
            (
                fila
                for fila in serie
                if fila["incumplidos_acumulados"]
                >= umbral_80
            ),
            None
        )

        if fila_corte is not None:
            acumulado_corte = (fila_corte["incumplidos_acumulados"])

            categorias_para_80 = sum(
                1
                for fila in serie
                if fila["incumplidos_acumulados"]
                <= acumulado_corte
            )

            porcentaje_incumplimientos_cubiertos = round(
                acumulado_corte * 100.0 / total_incumplimientos,
                2
            )

            porcentaje_categorias_para_80 = (
                round(categorias_para_80 * 100.0 / total_categorias,2)
                if total_categorias > 0
                else 0.0
            )

    return {
        "total_categorias": total_categorias,
        "categorias_con_incumplimientos": len(serie),
        "total_incumplimientos": total_incumplimientos,
        "categorias_para_80": categorias_para_80,
        "porcentaje_categorias_para_80": (porcentaje_categorias_para_80),
        "porcentaje_incumplimientos_cubiertos": (porcentaje_incumplimientos_cubiertos),
        "serie": serie
    }


# TABLA PAGINADA - DETALLE DE TICKETS REQUERIMIENTOS SLA
def obtener_tickets(
    db: Session,
    filtros: RequirementSLADashboardFilters,
    pagina: int = 1,
    tamano: int = 10
):

    resultado = (
        requirement_sla_repository.obtener_tickets(
            db,
            filtros,
            pagina=pagina,
            tamano=tamano
        )
    )

    total = resultado["total"]

    total_paginas = (
        total + tamano - 1
    ) // tamano

    return {
        "tickets": resultado["tickets"],
        "total": total,
        "pagina": pagina,
        "tamano": tamano,
        "total_paginas": total_paginas
    }



# PRD 06 - SERVICIO COMPARTIDO DE RESOLUTORES.
def obtener_rendimiento_resolutores(
    db: Session,
    filtros: RequirementSLADashboardFilters,
    pagina: int = 1,
    tamano: int = 20,
) -> dict:
    filas = requirement_sla_repository.obtener_rendimiento_resolutores(db, filtros)
    return construir_rendimiento_resolutores(filas, pagina=pagina, tamano=tamano)


def obtener_tickets_por_resolutor(
    db: Session,
    filtros: RequirementSLADashboardFilters,
    limite: int = 5,
) -> dict:
    rendimiento = obtener_rendimiento_resolutores(db, filtros, pagina=1, tamano=limite)
    return construir_tickets_por_resolutor(rendimiento, limite=limite)
