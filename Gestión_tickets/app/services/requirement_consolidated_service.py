from datetime import datetime
from sqlalchemy.orm import Session
from app.database.sqlserver import SQLServerSessionLocal, verificar_conexion_sqlserver
from app.etl.requirement_consolidated_etl import procesar_requirement_consolidated
from app.etl.change_detector import detectar_cambios
from app.repositories import (requirement_consolidated_repository,import_run_repository,)
from app.schemas.consolidated_import_schema import RequirementConsolidatedDashboardFilters


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
            tipo="requirement_consolidated",
            nombre_archivo=nombre_archivo,
            fecha_inicio=fecha_inicio,
            sqlite_status="NO_APLICA",
            sqlserver_status="PROCESSING"
        )

        # 3. Ejecutar ETL
        archivo.seek(0)
        df, filas_excel, duplicados = procesar_requirement_consolidated(archivo)
        filas_procesadas = len(df)
        
        tickets_revisar = ["100-233513", "100-233514"]
        print("TICKETS DESPUÉS DEL ETL:")
        print(
            df.loc[
                df["Ticket_ID"].isin(tickets_revisar),
                ["Ticket_ID", "Fecha_Apertura", "Proyecto"]
            ].to_string(index=False)
        )

        # 4. STAGING - SQL SERVER
        requirement_consolidated_repository.limpiar_staging(db)
        filas_staging = requirement_consolidated_repository.cargar_staging(db,df)
        db.flush()

        # 5. COMPARACIÓN - SQL SERVER
        df_staging = requirement_consolidated_repository.obtener_staging(db)
        print("TICKETS EN STAGING:")
        print(
            df_staging.loc[
                df_staging["Ticket_ID"].isin(tickets_revisar),
                ["Ticket_ID", "Proyecto"]
            ].to_string(index=False)
        )
        
        df_oficial = requirement_consolidated_repository.obtener_oficial(db)
        resultado = detectar_cambios(df_staging,df_oficial)

        df_new = resultado["NEW"]
        print("TICKETS CLASIFICADOS COMO NUEVOS:")

        print(
            df_new.loc[
                df_new["Ticket_ID"].isin(tickets_revisar),
                ["Ticket_ID", "Proyecto"]
            ].to_string(index=False)
        )
        df_changed = resultado["CHANGED"]
        df_same = resultado["SAME"]

        #  6. INSERT - SQL SERVER
        nuevos = requirement_consolidated_repository.insertar_nuevos(db,df_new)
        
        # 7. UPDATE - SQL SERVER
        modificados = requirement_consolidated_repository.actualizar_modificados(db,df_changed)
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

        from sqlalchemy import select, text

        tabla = (
            requirement_consolidated_repository
            .RequirementConsolidated
            .__table__
        )

        print("TABLA ORM:", tabla.fullname)

        print(
            "CONEXIÓN SQL:",
            db.execute(
                text("SELECT @@SERVERNAME AS servidor, DB_NAME() AS bd")
            ).mappings().first()
        )

        print(
            "TICKETS GUARDADOS:",
            db.execute(
                select(tabla.c.Ticket_ID).where(
                    tabla.c.Ticket_ID.in_(tickets_revisar)
                )
            ).scalars().all()
        )

        # 9. CONFIRMAR TRANSACCIÓN
        db.commit()

    except Exception as error:

        db.rollback()

        try:
            import_run_error = import_run_repository.crear(
                db=db,
                tipo="requirement_consolidated",
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
        "tipo": "requirement_consolidated",
        "tabla_staging": "stg_requirement_consolidated",
        "tabla_destino": "requirement_consolidated",
        "filas_excel": filas_excel,
        "filas_procesadas": filas_procesadas,
        "filas_staging": filas_staging,
        "duplicados": duplicados,
        "nuevos": nuevos,
        "modificados": modificados,
        "sin_cambios": sin_cambios,
        "mensaje": "Archivo procesado y cambios clasificados"
    }
    

def obtener_opciones_filtros(db: Session):
    resultado = requirement_consolidated_repository.obtener_opciones_filtros(db)

    fecha_min = resultado["fecha_min"]
    fecha_max = resultado["fecha_max"]

    return {
        "fecha_min": fecha_min.date() if fecha_min else None,
        "fecha_max": fecha_max.date() if fecha_max else None,
        "prioridades": resultado["prioridades"],
        "motivos_estado": resultado["motivos_estado"],
        "motivos_resolucion": resultado["motivos_resolucion"],
        "grupos_resolutores": resultado["grupos_resolutores"],
        "proyectos": resultado["proyectos"],
    }    




#-------------------------------------------------------------
#KPIs
#-------------------------------------------------------------

def obtener_kpis(
    db: Session,
    filtros: RequirementConsolidatedDashboardFilters
):
    resultado = requirement_consolidated_repository.obtener_kpis(
        db,
        filtros
    )

    total_tickets = resultado["total_tickets"] or 0
    total_proyectos = resultado["total_proyectos"] or 0
    alta_criticidad = resultado["alta_criticidad"] or 0

    porcentaje = (
        round(alta_criticidad * 100 / total_tickets, 2)
        if total_tickets
        else 0.0
    )

    return {
        "total_tickets": total_tickets,
        "total_proyectos": total_proyectos,
        "alta_criticidad": alta_criticidad,
        "porcentaje_alta_criticidad": porcentaje
    }


#-------------------------------------------------------------
#Volumen Mensual de Requerimientos
#-------------------------------------------------------------

def obtener_volumen_mensual(
    db: Session,
    filtros: RequirementConsolidatedDashboardFilters
):
    resultados = (
        requirement_consolidated_repository.obtener_volumen_mensual(
            db,
            filtros
        )
    )

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

    return [
        {
            "anio": row.anio,
            "mes": row.mes,
            "periodo": f"{meses[row.mes]}-{str(row.anio)[-2:]}",
            "tickets": row.tickets
        }
        for row in resultados
    ]


#-------------------------------------------------------------
#Explorador por Proyectos
#-------------------------------------------------------------

def obtener_proyectos(
    db: Session,
    filtros: RequirementConsolidatedDashboardFilters
):
    resultados = requirement_consolidated_repository.obtener_proyectos(
        db,
        filtros
    )

    return [
        {
            "proyecto": row["proyecto"],
            "cantidad": row["cantidad"]
        }
        for row in resultados
    ]


#-------------------------------------------------------------
#Distribución por Tipo de Requerimiento
#-------------------------------------------------------------

def obtener_tipos(
    db: Session,
    filtros: RequirementConsolidatedDashboardFilters,
    limite: int = 10
):
    resultados = requirement_consolidated_repository.obtener_tipos(
        db,
        filtros,
        limite=limite
    )

    return [
        {
            "tipo_requerimiento": row["tipo_requerimiento"],
            "cantidad": row["cantidad"]
        }
        for row in resultados
    ]


#-------------------------------------------------------------
#Distribución por Prioridad
#-------------------------------------------------------------

def obtener_prioridades(
    db: Session,
    filtros: RequirementConsolidatedDashboardFilters
):
    resultados = requirement_consolidated_repository.obtener_prioridades(
        db,
        filtros
    )

    return [
        {
            "prioridad": row["prioridad"],
            "cantidad": row["cantidad"]
        }
        for row in resultados
    ]
   
    

#-------------------------------------------------------------
#Top 10: Tickets por Proyecto y Mes
#-------------------------------------------------------------

def obtener_top_proyectos(
    db: Session,
    filtros: RequirementConsolidatedDashboardFilters
):
    resultados = (
        requirement_consolidated_repository.obtener_top_proyectos_mensual(
            db,
            filtros
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

    def indice(anio, mes):
        return anio * 12 + mes - 1

    indices = [
        indice(row["anio"], row["mes"])
        for row in resultados
    ]

    # Si se seleccionó un mes, mostrar solo ese mes
    if filtros.periodo:
        anio_sel, mes_sel = map(int, filtros.periodo.split("-"))
        inicio = indice(anio_sel, mes_sel)
        fin = inicio

    else:
        # Conservar la lógica anterior sin período
        fin = (
            indice(filtros.hasta.year, filtros.hasta.month)
            if filtros.hasta
            else max(indices)
        )

        inicio = (
            indice(filtros.desde.year, filtros.desde.month)
            if filtros.desde
            else (
                min(indices)
                if filtros.hasta
                else fin - 3
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

    for row in resultados:
        clave_mes = indice(
            row["anio"],
            row["mes"]
        )

        if not inicio <= clave_mes <= fin:
            continue

        nombre_proyecto = row["proyecto"]

        if nombre_proyecto not in proyectos:
            proyectos[nombre_proyecto] = {
                "total_tickets": 0,
                "conteos": {}
            }

        proyectos[nombre_proyecto]["total_tickets"] += (
            row["tickets"]
        )

        proyectos[nombre_proyecto]["conteos"][clave_mes] = (
            row["tickets"]
        )

    ranking = sorted(
        proyectos.items(),
        key=lambda item: (
            -item[1]["total_tickets"],
            item[0]
        )
    )[:10]

    return {
        "periodos": periodos,

        "proyectos": [
            {
                "proyecto": nombre_proyecto,

                "total_tickets": datos["total_tickets"],

                "mensual": [
                    {
                        "periodo": mes_item["periodo"],

                        "tickets": datos["conteos"].get(
                            indice(
                                mes_item["anio"],
                                mes_item["mes"]
                            ),
                            0
                        )
                    }
                    for mes_item in periodos
                ]
            }

            for nombre_proyecto, datos in ranking
        ]
    }




#-------------------------------------------------------------
#N.º de Requerimientos por Prioridad
#-------------------------------------------------------------

def obtener_prioridad_mensual(
    db: Session,
    filtros: RequirementConsolidatedDashboardFilters
):
    resultados = (
        requirement_consolidated_repository.obtener_prioridad_mensual(
            db,
            filtros
        )
    )

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

    prioridades = [
        "1-Critical",
        "2-High",
        "3-Medium",
        "4-Low"
    ]

    resumen = {}

    for row in resultados:

        if row["anio"] is None or row["mes"] is None:
            continue

        clave = (
            row["anio"],
            row["mes"]
        )

        if clave not in resumen:
            resumen[clave] = {
                "anio": row["anio"],
                "mes": row["mes"],

                "periodo": (
                    f"{meses[row['mes']]}-"
                    f"{str(row['anio'])[-2:]}"
                ),

                "total_tickets": 0,
                "conteos": {}
            }

        cantidad = row["cantidad"] or 0
        categoria = row["prioridad"]

        resumen[clave]["total_tickets"] += cantidad

        resumen[clave]["conteos"][categoria] = (
            resumen[clave]["conteos"].get(categoria, 0)
            + cantidad
        )

    respuesta = []

    for clave in sorted(resumen):

        item = resumen[clave]
        total = item["total_tickets"]
        conteos = item["conteos"]

        categorias = prioridades + sorted(
            p for p in conteos
            if p not in prioridades
        )

        respuesta.append({
            "anio": item["anio"],
            "mes": item["mes"],
            "periodo": item["periodo"],
            "total_tickets": total,

            "prioridades": [
                {
                    "prioridad": p,
                    "cantidad": conteos.get(p, 0),

                    "porcentaje": (
                        round(
                            conteos.get(p, 0) * 100 / total,
                            2
                        )
                        if total
                        else 0.0
                    )
                }
                for p in categorias
            ]
        })

    return respuesta



# TABLA PAGINADA - DETALLE DE TICKETS REQUERIMIENTOS CONSOLIDADOS
def obtener_tickets(
    db: Session,
    filtros: RequirementConsolidatedDashboardFilters,
    pagina: int = 1,
    tamano: int = 10
):

    resultado = (
        requirement_consolidated_repository.obtener_tickets(
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


# ===============================================================
# INDICADORES PRODUCTIVIDAD - REQUERIMIENTOS CONSOLIDADOS
# ===============================================================
from datetime import date as _date, timedelta as _timedelta
from calendar import monthrange as _monthrange


def _rango_productividad(filtros, minimo, maximo):
    """Rango compartido por proyectos; respeta fechas y mes seleccionados."""
    if minimo is None or maximo is None:
        return None, None

    inicio_mes = fin_mes = None
    if filtros.periodo:
        inicio_mes = _date.fromisoformat(f"{filtros.periodo}-01")
        fin_mes = _date(inicio_mes.year, inicio_mes.month,
                        _monthrange(inicio_mes.year, inicio_mes.month)[1])

    desde = filtros.desde or inicio_mes or minimo
    hasta = filtros.hasta or fin_mes or maximo
    if inicio_mes:
        desde = max(desde, inicio_mes)
        hasta = min(hasta, fin_mes)
    return (desde, hasta) if desde <= hasta else (None, None)


def _clave_granularidad(fecha, granularidad):
    if granularidad == "dia":
        return fecha.isoformat()
    if granularidad == "semana":
        return (fecha - _timedelta(days=fecha.weekday())).isoformat()
    return fecha.strftime("%Y-%m")


def _periodos_grafico(inicio, fin, granularidad):
    if inicio is None or fin is None:
        return []
    if granularidad == "dia":
        actual = inicio
        paso = _timedelta(days=1)
    elif granularidad == "semana":
        actual = inicio - _timedelta(days=inicio.weekday())
        paso = _timedelta(days=7)
    else:
        actual = inicio.replace(day=1)
        paso = None
    resultado = []
    while actual <= fin:
        resultado.append(_clave_granularidad(actual, granularidad))
        if granularidad == "mes":
            actual = _date(actual.year + (actual.month == 12),
                           actual.month % 12 + 1, 1)
        else:
            actual += paso
    return resultado


def obtener_productividad_proyectos(db: Session, filtros: RequirementConsolidatedDashboardFilters,
                                    granularidad: str = "mes", limite_grafico: int = 10,
                                    pagina: int = 1, tamano: int = 25):
    datos = requirement_consolidated_repository.obtener_productividad_proyectos(
        db, filtros, limite_grafico=limite_grafico
    )
    inicio, fin = _rango_productividad(filtros, datos["fecha_min"], datos["fecha_max"])
    dias = (fin - inicio).days + 1 if inicio and fin else 0
    semanas = len(_periodos_grafico(inicio, fin, "semana"))
    meses = len(_periodos_grafico(inicio, fin, "mes"))

    filas = []
    for item in datos["proyectos"]:
        cantidad = int(item["total_tickets"])
        filas.append({
            "proyecto": item["proyecto"],
            "total_tickets": cantidad,
            "promedio_diario": round(cantidad / dias, 2) if dias else 0.0,
            "promedio_semanal": round(cantidad / semanas, 2) if semanas else 0.0,
            "promedio_mensual": round(cantidad / meses, 2) if meses else 0.0,
            "resolutores_distintos": int(item["resolutores_distintos"]),
        })

    periodos = _periodos_grafico(inicio, fin, granularidad)
    conteos = {}
    for item in datos["diarios"]:
        fecha = item["fecha"]
        clave = (item["proyecto"], _clave_granularidad(fecha, granularidad))
        conteos[clave] = conteos.get(clave, 0) + int(item["tickets"])

    series = [{
        "proyecto": fila["proyecto"],
        "total_tickets": fila["total_tickets"],
        "puntos": [{"periodo": periodo,
                    "tickets": conteos.get((fila["proyecto"], periodo), 0)}
                   for periodo in periodos],
    } for fila in filas[:limite_grafico]]

    total = len(filas)
    return {
        "resumen": {
            "total_tickets": sum(item["total_tickets"] for item in filas),
            "total_proyectos": total,
            "fecha_desde": inicio,
            "fecha_hasta": fin,
            "dias_calendario": dias,
            "semanas_calendario": semanas,
            "meses_calendario": meses,
        },
        "grafico": {"granularidad": granularidad, "periodos": periodos, "proyectos": series},
        "tabla": {"items": filas[(pagina - 1) * tamano:pagina * tamano],
                  "total": total, "pagina": pagina, "tamano": tamano,
                  "total_paginas": (total + tamano - 1) // tamano},
    }


def obtener_dotacion_resolutores(db: Session, filtros: RequirementConsolidatedDashboardFilters,
                                  pagina: int = 1, tamano: int = 25,
                                  limite_grafico: int = 10):
    resultados = requirement_consolidated_repository.obtener_dotacion_resolutores(db, filtros)
    grupos = {}
    nombres_globales = set()
    totales_proyecto = {}
    meses = set()

    for fila in resultados:
        anio, mes = int(fila["anio"]), int(fila["mes"])
        proyecto = fila["proyecto"]
        periodo = f"{anio:04d}-{mes:02d}"
        clave = (periodo, proyecto)
        meses.add(periodo)
        if clave not in grupos:
            grupos[clave] = {"anio": anio, "mes": mes, "periodo": periodo,
                             "proyecto": proyecto, "total_tickets": 0,
                             "resolutores_distintos": 0, "tickets_sin_resolutor": 0,
                             "resolutores": []}
        item = grupos[clave]
        tickets = int(fila["tickets"])
        item["total_tickets"] += tickets
        totales_proyecto[proyecto] = totales_proyecto.get(proyecto, 0) + tickets
        if fila["resolutor"]:
            item["resolutores_distintos"] += 1
            nombres_globales.add(fila["resolutor"].casefold())
            item["resolutores"].append({"nombre": fila["resolutor"], "tickets": tickets})
        else:
            item["tickets_sin_resolutor"] += tickets

    filas = sorted(grupos.values(), key=lambda x: (-x["anio"], -x["mes"],
                                                 -x["total_tickets"], x["proyecto"]))
    for item in filas:
        item["resolutores"].sort(key=lambda x: (-x["tickets"], x["nombre"]))

    if meses:
        inicial, final = min(meses), max(meses)
        inicio = _date.fromisoformat(inicial + "-01")
        fin = _date.fromisoformat(final + "-01")
        periodos = _periodos_grafico(inicio, fin, "mes")
    else:
        periodos = []

    top_proyectos = [p for p, _ in sorted(totales_proyecto.items(),
                                         key=lambda par: (-par[1], par[0]))[:limite_grafico]]
    mapa = {(i["periodo"], i["proyecto"]): i["resolutores_distintos"] for i in filas}
    series = [{"proyecto": proyecto, "puntos": [
        {"periodo": periodo, "resolutores": mapa.get((periodo, proyecto), 0)}
        for periodo in periodos]}
        for proyecto in top_proyectos]
    total = len(filas)
    return {
        "resumen": {"total_tickets": sum(i["total_tickets"] for i in filas),
                    "total_proyectos": len(totales_proyecto),
                    "total_resolutores_distintos": len(nombres_globales),
                    "total_proyecto_meses": total},
        "grafico": {"periodos": periodos, "proyectos": series},
        "tabla": {"items": filas[(pagina - 1) * tamano:pagina * tamano],
                  "total": total, "pagina": pagina, "tamano": tamano,
                  "total_paginas": (total + tamano - 1) // tamano},
    }


# ===============================================================
# ALCANCE 3 - ATENCIÓN PARALELA (SOLO CONSOLIDADOS)
# ===============================================================
def _ventana_atencion_paralela(filtros: RequirementConsolidatedDashboardFilters):
    """Intervalo [inicio, fin) combinando Desde/Hasta y período mensual."""
    from datetime import datetime as _datetime, time as _time, timedelta as _td

    inicios = []
    finales = []

    if filtros.desde:
        inicios.append(_datetime.combine(filtros.desde, _time.min))
    if filtros.hasta:
        finales.append(_datetime.combine(filtros.hasta + _td(days=1), _time.min))

    if filtros.periodo:
        inicio_mes = _datetime.strptime(filtros.periodo + "-01", "%Y-%m-%d")
        siguiente_mes = (
            inicio_mes.replace(year=inicio_mes.year + 1, month=1)
            if inicio_mes.month == 12
            else inicio_mes.replace(month=inicio_mes.month + 1)
        )
        inicios.append(inicio_mes)
        finales.append(siguiente_mes)

    inicio = max(inicios) if inicios else None
    fin_exclusivo = min(finales) if finales else None
    return inicio, fin_exclusivo


def obtener_atencion_paralela(
    db: Session,
    filtros: RequirementConsolidatedDashboardFilters,
    pagina: int = 1,
    tamano: int = 25,
    limite_grafico: int = 10,
    resolutor: str | None = None,
):
    """Calcula eventos de concurrencia potencial por resolutor.

    La fecha de apertura no representa necesariamente inicio efectivo
    del trabajo y el nombre corresponde al resolutor almacenado.
    """
    from collections import defaultdict
    from heapq import heappop, heappush
    from datetime import timedelta as _td

    inicio, fin_exclusivo = _ventana_atencion_paralela(filtros)
    ticket_objetivo = (filtros.ticket_id or "").strip() or None

    def salida_vacia(tickets_evaluados=0):
        return {
            "resumen": {
                "tickets_evaluados": tickets_evaluados,
                "tickets_con_superposicion": 0,
                "resolutores_con_superposicion": 0,
                "total_eventos": 0,
                "maximo_simultaneos": 0,
                "fecha_desde": inicio.date() if inicio else None,
                "fecha_hasta": (fin_exclusivo - _td(days=1)).date()
                if fin_exclusivo else None,
                "metodologia": "Superposición potencial entre apertura y resolución; no acredita trabajo simultáneo efectivo.",
            },
            "grafico": [],
            "tabla": {"items": [], "total": 0, "pagina": pagina,
                      "tamano": tamano, "total_paginas": 0},
        }

    if inicio is not None and fin_exclusivo is not None and inicio >= fin_exclusivo:
        return salida_vacia()

    filas = requirement_consolidated_repository.obtener_atencion_paralela(
        db, filtros, inicio, fin_exclusivo, resolutor=resolutor
    )
    grupos = defaultdict(list)
    for fila in filas:
        # El repositorio ya excluye resoluciones nulas e intervalos inválidos.
        apertura = max(fila["fecha_apertura"], inicio) if inicio else fila["fecha_apertura"]
        resolucion = min(fila["fecha_resolucion"], fin_exclusivo) if fin_exclusivo else fila["fecha_resolucion"]
        if apertura >= resolucion:
            continue
        nombre = fila["resolutor"].strip()
        grupos[nombre.casefold()].append({
            "ticket_id": fila["ticket_id"],
            "proyecto": fila["proyecto"],
            "resolutor": nombre,
            "fecha_apertura": fila["fecha_apertura"],
            "fecha_resolucion": fila["fecha_resolucion"],
            "inicio": apertura,
            "fin": resolucion,
        })

    evaluados = sum(len(items) for items in grupos.values())
    if ticket_objetivo and not any(
        registro["ticket_id"] == ticket_objetivo
        for items in grupos.values() for registro in items
    ):
        return salida_vacia()

    # Barrido cronológico: O(n log n) por resolutor.
    # No se generan pares cartesianos entre todos los tickets.
    eventos = []
    estadisticas = {}
    global_participantes = set()
    for clave, tickets in grupos.items():
        tickets.sort(key=lambda t: (t["inicio"], t["ticket_id"]))
        vigentes = {}
        heap_finalizaciones = []
        participantes = set()
        eventos_grupo = 0
        max_grupo = 0

        for ticket in tickets:
            apertura = ticket["inicio"]
            while heap_finalizaciones and heap_finalizaciones[0][0] <= apertura:
                _, terminado = heappop(heap_finalizaciones)
                vigentes.pop(terminado, None)

            cantidad = len(vigentes)
            evento_incluido = cantidad > 0 and (
                ticket_objetivo is None
                or ticket_objetivo == ticket["ticket_id"]
                or ticket_objetivo in vigentes
            )
            if evento_incluido:
                eventos_grupo += 1
                concurrencia = cantidad + 1
                max_grupo = max(max_grupo, concurrencia)
                participantes.add(ticket["ticket_id"])
                if ticket_objetivo:
                    participantes.update(vigentes.keys())
                elif cantidad == 1:
                    # Con 2+ vigentes, los anteriores ya fueron marcados.
                    participantes.add(next(iter(vigentes)))

                eventos.append({
                    "ticket_id": ticket["ticket_id"],
                    "proyecto": ticket["proyecto"],
                    "resolutor": ticket["resolutor"],
                    "fecha_apertura": ticket["fecha_apertura"],
                    "fecha_resolucion": ticket["fecha_resolucion"],
                    "inicio_coincidencia": apertura,
                    "fin_coincidencia": min(
                        ticket["fin"], heap_finalizaciones[0][0]
                    ),
                    "tickets_simultaneos": concurrencia,
                    "tickets_coincidentes": [],
                })

            vigentes[ticket["ticket_id"]] = ticket
            heappush(heap_finalizaciones, (ticket["fin"], ticket["ticket_id"]))

        if eventos_grupo:
            estadisticas[clave] = {
                "resolutor": tickets[0]["resolutor"],
                "eventos": eventos_grupo,
                "tickets_con_superposicion": len(participantes),
                "maximo_simultaneos": max_grupo,
            }
            global_participantes.update(participantes)

    eventos.sort(
        key=lambda e: (e["inicio_coincidencia"], e["ticket_id"]),
        reverse=True,
    )
    total = len(eventos)
    pagina_eventos = eventos[(pagina - 1) * tamano:pagina * tamano]

    # Segunda pasada solo para la página visible: completar los IDs
    # coincidentes sin guardar listas masivas en todos los eventos.
    pendientes = defaultdict(dict)
    for evento in pagina_eventos:
        pendientes[evento["resolutor"].casefold()][evento["ticket_id"]] = evento

    for clave, por_id in pendientes.items():
        vigentes = {}
        heap_finalizaciones = []
        for ticket in grupos[clave]:
            apertura = ticket["inicio"]
            while heap_finalizaciones and heap_finalizaciones[0][0] <= apertura:
                _, terminado = heappop(heap_finalizaciones)
                vigentes.pop(terminado, None)

            evento = por_id.get(ticket["ticket_id"])
            if evento is not None:
                evento["tickets_coincidentes"] = sorted(vigentes.keys())

            vigentes[ticket["ticket_id"]] = ticket
            heappush(heap_finalizaciones, (ticket["fin"], ticket["ticket_id"]))

    ranking = sorted(
        estadisticas.values(),
        key=lambda e: (-e["eventos"], -e["maximo_simultaneos"], e["resolutor"]),
    )[:limite_grafico]

    fechas_inicio = [t["inicio"] for items in grupos.values() for t in items]
    fechas_fin = [t["fin"] for items in grupos.values() for t in items]
    return {
        "resumen": {
            "tickets_evaluados": evaluados,
            "tickets_con_superposicion": len(global_participantes),
            "resolutores_con_superposicion": len(estadisticas),
            "total_eventos": total,
            "maximo_simultaneos": max(
                (v["maximo_simultaneos"] for v in estadisticas.values()), default=0
            ),
            "fecha_desde": inicio.date() if inicio else min(fechas_inicio).date() if fechas_inicio else None,
            "fecha_hasta": (fin_exclusivo - _td(days=1)).date() if fin_exclusivo else max(fechas_fin).date() if fechas_fin else None,
            "metodologia": "Superposición potencial entre apertura y resolución; no acredita trabajo simultáneo efectivo.",
        },
        "grafico": ranking,
        "tabla": {
            "items": pagina_eventos, "total": total, "pagina": pagina,
            "tamano": tamano, "total_paginas": (total + tamano - 1) // tamano,
        },
    }




# ALCANCE 4 - ACTUALIZACIONES MANUALES

def obtener_actualizaciones_manuales(
    db: Session,
    filtros: RequirementConsolidatedDashboardFilters,
    pagina: int = 1,
    tamano: int = 25,
    limite_grafico: int = 10,
    resolutor: str | None = None
):

    datos = (
        requirement_consolidated_repository
        .obtener_actualizaciones_manuales(
            db=db,
            filtros=filtros,
            pagina=pagina,
            tamano=tamano,
            limite_grafico=limite_grafico,
            resolutor=resolutor
        )
    )

    resumen = datos["resumen"]

    total_tickets = int(
        resumen["total_tickets"] or 0
    )

    def transformar_item(fila):

        cantidad = int(fila["tickets"] or 0)

        porcentaje = (
            round(
                cantidad * 100 / total_tickets,
                2
            )
            if total_tickets
            else 0.0
        )

        return {
            "grupo_resolutor": fila["grupo_resolutor"],
            "resolutor": fila["resolutor"],
            "tickets": cantidad,
            "proyectos": int(fila["proyectos"] or 0),
            "porcentaje": porcentaje
        }

    total_filas = int(datos["total"])

    return {
        "resumen": {
            "total_tickets": total_tickets,
            "total_resolutores": int(
                resumen["total_resolutores"] or 0
            ),
            "total_grupos": int(
                resumen["total_grupos"] or 0
            ),
            "total_proyectos": int(
                resumen["total_proyectos"] or 0
            ),
            "tickets_sin_resolutor": int(
                resumen["tickets_sin_resolutor"] or 0
            )
        },

        "grafico": [
            transformar_item(fila)
            for fila in datos["grafico"]
        ],

        "tabla": {
            "items": [
                transformar_item(fila)
                for fila in datos["items"]
            ],
            "total": total_filas,
            "pagina": pagina,
            "tamano": tamano,
            "total_paginas": (
                total_filas + tamano - 1
            ) // tamano
        }
    }
