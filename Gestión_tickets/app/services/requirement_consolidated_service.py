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
