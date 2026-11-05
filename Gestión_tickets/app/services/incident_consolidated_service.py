from datetime import datetime
from sqlalchemy import func, select
from sqlalchemy.orm import Session
from app.database.sqlserver import verificar_conexion_sqlserver
from app.etl.incident_consolidated_etl import procesar_incident_consolidated
from app.etl.change_detector import detectar_cambios
from app.models.incident_consolidated_model import IncidentConsolidated
from app.repositories import (incident_consolidated_repository,import_run_repository,)
from app.schemas.consolidated_import_schema import (
    IncidentConsolidatedDashboardFilters
)


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
            tipo="incident_consolidated",
            nombre_archivo=nombre_archivo,
            fecha_inicio=fecha_inicio,
            sqlite_status="NO_APLICA",
            sqlserver_status="PROCESSING"
        )

        # 3. Ejecutar ETL
        archivo.seek(0)
        df, filas_excel, duplicados = procesar_incident_consolidated(archivo)
        filas_procesadas = len(df)

        # 4. STAGING - SQL SERVER
        incident_consolidated_repository.limpiar_staging(db)
        filas_staging = incident_consolidated_repository.cargar_staging(db,df)
        db.flush()

        # 5. COMPARACIÓN - SQL SERVER
        df_staging = incident_consolidated_repository.obtener_staging(db)
        df_oficial = incident_consolidated_repository.obtener_oficial(db)
        resultado = detectar_cambios(df_staging, df_oficial)

        df_new = resultado["NEW"]
        df_changed = resultado["CHANGED"]
        df_same = resultado["SAME"]

        #  6. INSERT - SQL SERVER
        nuevos = incident_consolidated_repository.insertar_nuevos(db, df_new)
        
        # 7. UPDATE - SQL SERVER
        modificados = incident_consolidated_repository.actualizar_modificados(db, df_changed)
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
                tipo="incident_consolidated",
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
        "tipo": "incident_consolidated",
        "tabla_staging": "stg_incident_consolidated",
        "tabla_destino": "incident_consolidated",
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
    return incident_consolidated_repository.obtener_opciones_filtros(db)


# 1. KPIs
def obtener_kpis(
    db: Session,
    filtros: IncidentConsolidatedDashboardFilters
):
    resultado = incident_consolidated_repository.obtener_kpis(
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


# 2. VOLUMEN MENSUAL
def obtener_volumen_mensual(
    db: Session,
    filtros: IncidentConsolidatedDashboardFilters
):
    resultados = (
        incident_consolidated_repository.obtener_volumen_mensual(
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


# 3. EXPLORADOR POR PROYECTOS
def obtener_proyectos(
    db: Session,
    filtros: IncidentConsolidatedDashboardFilters
):
    resultados = incident_consolidated_repository.obtener_proyectos(
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


# 4. DISTRIBUCIÓN POR TIPO DE INCIDENTE
def obtener_tipos(
    db: Session,
    filtros: IncidentConsolidatedDashboardFilters,
    limite: int = 10
):
    resultados = incident_consolidated_repository.obtener_tipos(
        db,
        filtros,
        limite=limite
    )

    return [
        {
            "tipo_incidente": row["tipo_incidente"],
            "cantidad": row["cantidad"]
        }
        for row in resultados
    ]


# 5. DISTRIBUCIÓN POR PRIORIDAD
def obtener_prioridades(
    db: Session,
    filtros: IncidentConsolidatedDashboardFilters
):
    resultados = incident_consolidated_repository.obtener_prioridades(
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

# 6. TOP 10 TICKETS POR PROYECTO Y MES
def obtener_top_proyectos(
    db: Session,
    filtros: IncidentConsolidatedDashboardFilters
):
    resultados = (
        incident_consolidated_repository.obtener_top_proyectos_mensual(
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

    # Mantener el comportamiento actual del eje temporal.
    if filtros.hasta:
        fin = indice(
            filtros.hasta.year,
            filtros.hasta.month
        )
    else:
        fin = max(indices)

    if filtros.desde:
        inicio = indice(
            filtros.desde.year,
            filtros.desde.month
        )
    else:
        inicio = min(indices) if filtros.hasta else fin - 3

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

        proyecto = row["proyecto"]

        if proyecto not in proyectos:
            proyectos[proyecto] = {
                "total_tickets": 0,
                "conteos": {}
            }

        proyectos[proyecto]["total_tickets"] += row["tickets"]

        proyectos[proyecto]["conteos"][clave_mes] = (
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
                "proyecto": proyecto,
                "total_tickets": datos["total_tickets"],

                "mensual": [
                    {
                        "periodo": periodo["periodo"],

                        "tickets": datos["conteos"].get(
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
            for proyecto, datos in ranking
        ]
    }


# 7. NÚMERO DE INCIDENCIAS POR PRIORIDAD
def obtener_prioridad_mensual(
    db: Session,
    filtros: IncidentConsolidatedDashboardFilters
):
    resultados = (
        incident_consolidated_repository.obtener_prioridad_mensual(
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


# 8. RENDIMIENTO POR RESOLUTOR
def obtener_rendimiento_resolutores(
    db: Session,
    filtros: IncidentConsolidatedDashboardFilters,
    pagina: int = 1,
    tamano: int = 20
):
    resultados = (
        incident_consolidated_repository.obtener_rendimiento_resolutores(
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

    claves_meses = sorted({
        (row["anio"], row["mes"])
        for row in resultados
    })

    periodos = [
        {
            "anio": anio,
            "mes": mes,
            "periodo": f"{meses[mes]}-{str(anio)[-2:]}"
        }
        for anio, mes in claves_meses
    ]

    resumen = {}

    totales_meses = {
        clave: 0
        for clave in claves_meses
    }

    for row in resultados:

        nombre = row["nombre_resolutor"]

        clave = (
            row["anio"],
            row["mes"]
        )

        cantidad = row["tickets"]

        if nombre not in resumen:
            resumen[nombre] = {
                "total_tickets": 0,
                "mensual": {}
            }

        resumen[nombre]["total_tickets"] += cantidad
        resumen[nombre]["mensual"][clave] = cantidad

        totales_meses[clave] += cantidad

    ranking = sorted(
        resumen.items(),
        key=lambda item: (
            -item[1]["total_tickets"],
            item[0]
        )
    )

    total_resolutores = len(ranking)

    total_paginas = (
        total_resolutores + tamano - 1
    ) // tamano

    inicio = (pagina - 1) * tamano

    ranking_paginado = ranking[
        inicio:inicio + tamano
    ]

    return {
        "periodos": periodos,

        "resolutores": [
            {
                "nombre_resolutor": nombre,

                "total_tickets": datos["total_tickets"],

                "mensual": [
                    {
                        "periodo": periodo["periodo"],

                        "tickets": datos["mensual"].get(
                            (
                                periodo["anio"],
                                periodo["mes"]
                            ),
                            0
                        )
                    }
                    for periodo in periodos
                ]
            }

            for nombre, datos in ranking_paginado
        ],

        "totales_mensuales": [
            {
                "periodo": periodo["periodo"],

                "tickets": totales_meses[
                    (
                        periodo["anio"],
                        periodo["mes"]
                    )
                ]
            }
            for periodo in periodos
        ],

        "total_general": sum(
            totales_meses.values()
        ),

        "total_resolutores": total_resolutores,
        "pagina": pagina,
        "tamano": tamano,
        "total_paginas": total_paginas
    }


# 9. EXPLORADOR POR DESCRIPCIONES X MES
def obtener_explorador_descripciones(
    db: Session,
    filtros: IncidentConsolidatedDashboardFilters,
    pagina: int = 1,
    tamano: int = 10,
    buscar: str | None = None
):
    resultado = (
        incident_consolidated_repository.obtener_explorador_descripciones(
            db,
            filtros,
            pagina=pagina,
            tamano=tamano,
            buscar=buscar
        )
    )

    # Misma selección de filtros en los totales mensuales
    volumen = obtener_volumen_mensual(
        db,
        filtros
    )

    periodos = [
        {
            "anio": row["anio"],
            "mes": row["mes"],
            "periodo": row["periodo"]
        }
        for row in volumen
    ]

    conteos = {
        (
            row["descripcion"],
            row["anio"],
            row["mes"]
        ): row["tickets"]

        for row in resultado["mensual"]
    }

    descripciones = [
        {
            "descripcion": row["descripcion"],

            "total_tickets": row["total_tickets"],

            "mensual": [
                {
                    "periodo": periodo["periodo"],

                    "tickets": conteos.get(
                        (
                            row["descripcion"],
                            periodo["anio"],
                            periodo["mes"]
                        ),
                        0
                    )
                }
                for periodo in periodos
            ]
        }
        for row in resultado["descripciones"]
    ]

    total_descripciones = resultado[
        "total_descripciones"
    ]

    return {
        "periodos": periodos,
        "descripciones": descripciones,

        "totales_mensuales": [
            {
                "periodo": row["periodo"],
                "tickets": row["tickets"]
            }
            for row in volumen
        ],

        "total_general": sum(
            row["tickets"]
            for row in volumen
        ),

        "total_descripciones": total_descripciones,
        "pagina": pagina,
        "tamano": tamano,

        "total_paginas": (
            total_descripciones + tamano - 1
        ) // tamano
    }


# 10. TABLA DETALLE DE EVENTOS TÉCNICOS
def obtener_detalle_eventos_tecnicos(
    db: Session,
    filtros: IncidentConsolidatedDashboardFilters,
    pagina: int = 1,
    tamano: int = 10,
    buscar: str | None = None
):
    resultado = (
        incident_consolidated_repository.obtener_detalle_eventos_tecnicos(
            db,
            filtros,
            pagina=pagina,
            tamano=tamano,
            buscar=buscar
        )
    )

    total_detalles = resultado["total_detalles"]

    return {
        "detalles": [
            {
                "detalle_id": row["detalle_id"],
                "detalle": row["detalle"],
                "total": row["total"]
            }
            for row in resultado["detalles"]
        ],

        "total_general": resultado["total_general"],
        "total_detalles": total_detalles,
        "pagina": pagina,
        "tamano": tamano,

        "total_paginas": (
            total_detalles + tamano - 1
        ) // tamano
    }


# 11. NÚMERO DE INCIDENTES X PORCENTAJES
def obtener_incidentes_porcentajes(
    db: Session,
    filtros: IncidentConsolidatedDashboardFilters,
    limite: int = 20
):
    resultado = (
        incident_consolidated_repository.obtener_incidentes_porcentajes(
            db,
            filtros,
            limite=limite
        )
    )

    total_general = resultado["total_general"]

    return {
        "total_general": total_general,
        "limite": limite,

        "descripciones": [
            {
                "descripcion": row["descripcion"],
                "cantidad": row["cantidad"],

                "porcentaje": (
                    round(
                        row["cantidad"] * 100 / total_general,
                        2
                    )
                    if total_general
                    else 0.0
                )
            }
            for row in resultado["resultados"]
        ]
    }


# 12. TOP 10 TICKETS POR DESCRIPCIÓN Y PROYECTO
def obtener_top_descripciones_proyectos(
    db: Session,
    filtros: IncidentConsolidatedDashboardFilters
):
    resultado = (
        incident_consolidated_repository.obtener_top_descripciones_proyectos(
            db,
            filtros
        )
    )

    return {
        "total_general": resultado["total_general"],

        "combinaciones": [
            {
                "descripcion": row["descripcion"],
                "proyecto": row["proyecto"],
                "tickets": row["tickets"]
            }
            for row in resultado["resultados"]
        ]
    }


# 13. TOP 10 TICKETS POR DETALLE
def obtener_top_detalles(
    db: Session,
    filtros: IncidentConsolidatedDashboardFilters
):
    resultado = incident_consolidated_repository.obtener_top_detalles(
        db,
        filtros
    )

    return {
        "total_general": resultado["total_general"],

        "detalles": [
            {
                "detalle": row["detalle"],
                "tickets": row["tickets"]
            }
            for row in resultado["resultados"]
        ]
    }


# 14. NÚMERO DE TICKETS POR RESOLUTOR
def obtener_tickets_por_resolutor(
    db: Session,
    filtros: IncidentConsolidatedDashboardFilters,
    limite: int = 5
):
    # Reutilizar el servicio de rendimiento por resolutor
    resultado = obtener_rendimiento_resolutores(
        db,
        filtros,
        pagina=1,
        tamano=limite
    )

    return {
        "total_general": resultado["total_general"],
        "limite": limite,
        "periodos": resultado["periodos"],
        "resolutores": resultado["resolutores"]
    }



# TABLA PAGINADA - DETALLE DE TICKETS
def obtener_tickets(
    db: Session,
    filtros: IncidentConsolidatedDashboardFilters,
    pagina: int = 1,
    tamano: int = 10
):

    resultado = (
        incident_consolidated_repository.obtener_tickets(
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
