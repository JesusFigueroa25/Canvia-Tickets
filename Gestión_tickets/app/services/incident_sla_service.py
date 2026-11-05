from datetime import datetime
from sqlalchemy.orm import Session
from app.etl.condicion_dia import agregar_condicion_dia
from app.etl.incident_sla_etl import procesar_incident_sla
from app.etl.change_detector import detectar_cambios
from app.database.sqlserver import (SQLServerSessionLocal, verificar_conexion_sqlserver,)
from app.repositories import (incident_sla_repository,import_run_repository,)
from app.schemas.sla_import_schema  import IncidentSLADashboardFilters


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
            tipo="incident_sla",
            nombre_archivo=nombre_archivo,
            fecha_inicio=fecha_inicio,
            sqlite_status="NO_APLICA",
            sqlserver_status="PROCESSING"
        )

        # 3. Ejecutar ETL
        archivo.seek(0)
        df, filas_excel, duplicados = procesar_incident_sla(archivo)
        filas_procesadas = len(df)

        # 4. STAGING - SQL SERVER
        incident_sla_repository.limpiar_staging(db)
        filas_staging = incident_sla_repository.cargar_staging(db,df)
        db.flush()

        # 5. COMPARACIÓN - SQL SERVER
        df_staging = incident_sla_repository.obtener_staging(db)
        df_oficial = incident_sla_repository.obtener_oficial(db)
        resultado = detectar_cambios(df_staging,df_oficial)

        df_new = resultado["NEW"]
        df_changed = resultado["CHANGED"]
        df_same = resultado["SAME"]

        # TRANSFORMACION DE CONDICION_DIA
        df_new = agregar_condicion_dia(df_new)
        df_changed = agregar_condicion_dia(df_changed)

        #  6. INSERT - SQL SERVER
        nuevos = incident_sla_repository.insertar_nuevos(db,df_new)
        
        # 7. UPDATE - SQL SERVER
        modificados = incident_sla_repository.actualizar_modificados(db,df_changed)
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
                tipo="incident_sla",
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
        "tipo": "incident_sla",
        "tabla_staging": "stg_incident_sla",
        "tabla_destino": "incident_sla",
        "filas_excel": filas_excel,
        "filas_procesadas": filas_procesadas,
        "filas_staging": filas_staging,
        "duplicados": duplicados,
        "nuevos": nuevos,
        "modificados": modificados,
        "sin_cambios": sin_cambios,
        "mensaje": "Archivo procesado y cambios clasificados"
    }
  

#--------------------------------------------------------------------
#KPIs
#--------------------------------------------------------------------

def obtener_kpis(
    db: Session,
    filtros: IncidentSLADashboardFilters
):
    resultado = incident_sla_repository.obtener_kpis(
        db,filtros
    )

    def calcular_porcentaje(cumple,medibles):
        cumple = cumple or 0
        medibles = medibles or 0
        if medibles == 0:
            return 0.0
        return round(cumple / medibles * 100, 2)

    return {
        "total_tickets": resultado["total_tickets"] or 0,
        "sla_respuesta": calcular_porcentaje(
            resultado["sla_respuesta_cumple"],
            resultado["sla_respuesta_medibles"]
        ),
        "sla_solucion": calcular_porcentaje(
            resultado["sla_solucion_cumple"],
            resultado["sla_solucion_medibles"]
        ),
        "ola_respuesta": calcular_porcentaje(
            resultado["ola_respuesta_cumple"],
            resultado["ola_respuesta_medibles"]
        ),
        "ola_solucion": calcular_porcentaje(
            resultado["ola_solucion_cumple"],
            resultado["ola_solucion_medibles"]
        ),
    }


#--------------------------------------------------------------------
#Filtros Generales
#--------------------------------------------------------------------

def obtener_opciones_filtros(db: Session):
    resultado = incident_sla_repository.obtener_opciones_filtros(db)
    fecha_min = resultado["fecha_min"]
    fecha_max = resultado["fecha_max"]
    return {
        "fecha_min": fecha_min.date() if fecha_min else None,
        "fecha_max": fecha_max.date() if fecha_max else None,
        "grupos_resolutores": resultado["grupos_resolutores"],
        "prioridades": resultado["prioridades"],
        "proyectos": resultado["proyectos"],
        "tipos_incidente": resultado["tipos_incidente"],
    }


#--------------------------------------------------------------------
#Insights
#--------------------------------------------------------------------

def obtener_insights(
    db: Session,
    filtros: IncidentSLADashboardFilters
):
    estado = incident_sla_repository.obtener_estado_sla(
        db,filtros
    )

    proyectos = incident_sla_repository.obtener_principal_foco(
        db,filtros
    )

    prioridades = incident_sla_repository.obtener_prioridades_sla(
        db,filtros
    )

    # ESTADO SLA
    cumple = estado["cumple"] or 0
    medibles = estado["medibles"] or 0

    cumplimiento = (
        cumple / medibles * 100
        if medibles > 0
        else 0
    )

    objetivo = 95.0
    diferencia = cumplimiento - objetivo

    if diferencia > 0:
        estado_sla = (f"Cumplimiento {cumplimiento:.1f}%: "f"{diferencia:.1f} pp sobre el objetivo.")
    elif diferencia < 0:
        estado_sla = (f"Cumplimiento {cumplimiento:.1f}%: "f"{abs(diferencia):.1f} pp por debajo del objetivo.")
    else:
        estado_sla = (f"Cumplimiento {cumplimiento:.1f}%: ""en el objetivo.")

    # PRINCIPAL FOCO
    if proyectos:
        total_incumplimientos = sum(proyecto["incumplimientos"] for proyecto in proyectos)

        principal = proyectos[0]

        porcentaje = (
            principal["incumplimientos"]
            / total_incumplimientos
            * 100
            if total_incumplimientos > 0
            else 0
        )

        principal_foco = (f"{principal['Proyecto']} concentra "f"{porcentaje:.1f}% de los incumplimientos.")
    else:
        principal_foco = "No se registran incumplimientos."

    # PRIORIDAD A VIGILAR
    prioridades_validas = []

    for item in prioridades:
        medibles_prioridad = item["medibles"] or 0
        cumple_prioridad = item["cumple"] or 0

        if medibles_prioridad > 0:
            porcentaje = (
                cumple_prioridad
                / medibles_prioridad
                * 100
            )

            prioridades_validas.append({
                "prioridad": item["Prioridad"],
                "medibles": medibles_prioridad,
                "cumplimiento": porcentaje
            })

    if prioridades_validas:
        prioridad_critica = min(
            prioridades_validas,
            key=lambda x: x["cumplimiento"]
        )

        prioridad_vigilar = (
            f"{prioridad_critica['prioridad']} registra "
            f"{prioridad_critica['cumplimiento']:.1f}% "
            f"de cumplimiento en "
            f"{prioridad_critica['medibles']} tickets medibles."
        )
    else:
        prioridad_vigilar = (
            "No existen prioridades con tickets medibles."
        )

    return {
        "estado_sla": estado_sla,
        "principal_foco": principal_foco,
        "prioridad_vigilar": prioridad_vigilar
    }


#--------------------------------------------------------------------
#Gráficos Principales
#--------------------------------------------------------------------

#SLA Solución: Tendencia
def obtener_sla_solucion_tendencia(
    db: Session,
    filtros: IncidentSLADashboardFilters
):
    resultados = incident_sla_repository.obtener_sla_solucion_tendencia(
        db,filtros
    )

    tendencia = []

    for item in resultados:
        cumple = item["cumple"] or 0
        medibles = item["medibles"] or 0
        cumplimiento = (
            cumple / medibles * 100
            if medibles > 0
            else 0
        )

        tendencia.append({
            "mes": item["mes"],
            "cumplimiento": round(cumplimiento,2),
            "objetivo": 95.0,
            "medibles": medibles
        })

    return tendencia


#Volumen de Incidentes
def obtener_volumen_incidentes(
    db: Session,
    filtros: IncidentSLADashboardFilters
):
    resultados = incident_sla_repository.obtener_volumen_incidentes(
        db,filtros
    )

    volumen = []

    for i,item in enumerate(resultados):
        tickets = item["tickets"] or 0
        media_movil = None

        if i >= 2:
            ventana = resultados[i - 2:i + 1]
            media_movil = sum(
                fila["tickets"] or 0
                for fila in ventana
            ) / 3
            media_movil = round(media_movil,2)

        volumen.append({
            "mes": item["mes"],
            "tickets": tickets,
            "media_movil_3m": media_movil
        })

    return volumen


#--------------------------------------------------------------------
#Empresa
#--------------------------------------------------------------------

#Explorador por Proyectos
def obtener_explorador_proyectos(
    db: Session,
    filtros: IncidentSLADashboardFilters
):
    resultados = incident_sla_repository.obtener_explorador_proyectos(
        db,filtros
    )

    total_tickets = sum(
        item["tickets"] or 0
        for item in resultados
    )

    proyectos = []

    for item in resultados:
        tickets = item["tickets"] or 0

        cumple = item["cumple"] or 0
        incumple = item["incumple"] or 0
        sin_medicion = item["sin_medicion"] or 0

        medibles = cumple + incumple

        sla_solucion = (
            cumple / medibles * 100
            if medibles > 0
            else 0
        )

        respuesta_cumple = (
            item["sla_respuesta_cumple"] or 0
        )

        respuesta_medibles = (
            item["sla_respuesta_medibles"] or 0
        )

        sla_respuesta = (
            respuesta_cumple
            / respuesta_medibles
            * 100
            if respuesta_medibles > 0
            else 0
        )

        porcentaje_volumen = (
            tickets / total_tickets * 100
            if total_tickets > 0
            else 0
        )

        proyectos.append({
            "proyecto": item["Proyecto"],
            "tickets": tickets,
            "medibles": medibles,
            "sin_medicion": sin_medicion,
            "cumple": cumple,
            "incumple": incumple,
            "sla_solucion": round(sla_solucion,2),
            "sla_respuesta": round(sla_respuesta,2),
            "porcentaje_volumen": round(porcentaje_volumen,2)
        })

    return proyectos


#--------------------------------------------------------------------
#Alertas
#--------------------------------------------------------------------

#Pareto de Tipos de Incidente
def obtener_pareto_tipos(
    db: Session,
    filtros: IncidentSLADashboardFilters
):
    # Mantener comportamiento original del Pareto:
    # el filtro de tipo_incidente no limita el ranking.
    # Los proyectos excluidos sí deben aplicarse.
    filtros_pareto = filtros.model_copy(
        update={"tipo_incidente": []}
    )

    resultados = incident_sla_repository.obtener_pareto_tipos(
        db,filtros_pareto
    )

    total_tickets = sum(
        item["tickets"] or 0
        for item in resultados
    )

    acumulado = 0
    pareto = []

    for ranking,item in enumerate(resultados,start=1):
        tickets = item["tickets"] or 0
        acumulado += tickets

        porcentaje = (
            tickets / total_tickets * 100
            if total_tickets > 0
            else 0
        )

        porcentaje_acumulado = (
            acumulado / total_tickets * 100
            if total_tickets > 0
            else 0
        )

        pareto.append({
            "ranking": ranking,
            "tipo_incidente": item["tipo_incidente"],
            "tickets": tickets,
            "porcentaje": round(porcentaje,2),
            "porcentaje_acumulado": round(porcentaje_acumulado,2)
        })

    return pareto


#Tendencia de Incidentes
def obtener_tendencia_incidentes(
    db: Session,
    filtros: IncidentSLADashboardFilters
):
    tipos_seleccionados = (
        incident_sla_repository.normalizar_tipos_incidente(
            filtros.tipo_incidente
        )
    )

    # Obtener todos los tipos disponibles considerando
    # los filtros generales y proyectos excluidos.
    # No aplicar el filtro de tipo en este primer ranking.
    filtros_sin_tipo = filtros.model_copy(
        update={"tipo_incidente": []}
    )

    datos_pareto = incident_sla_repository.obtener_pareto_tipos(
        db,filtros_sin_tipo
    )

    tipos_disponibles = [
        item["tipo_incidente"]
        for item in datos_pareto
        if item["tipo_incidente"]
        and item["tipo_incidente"].strip()
    ]

    if tipos_seleccionados:
        conjunto_disponibles = set(tipos_disponibles)

        tipos = [
            tipo
            for tipo in tipos_seleccionados
            if tipo in conjunto_disponibles
        ]

        grupo = "Tipos seleccionados"

    else:
        tipos = tipos_disponibles[:5]
        grupo = "Top 5 tipos de incidente"

    if not tipos:
        return {
            "grupo": grupo,
            "series": []
        }

    # Construir las series de los tipos seleccionados
    resultados = incident_sla_repository.obtener_tendencia_incidentes(
        db,
        tipos,
        filtros_sin_tipo
    )

    # Meses del universo filtrado, sin limitar a un tipo.
    meses_resultado = incident_sla_repository.obtener_volumen_incidentes(
        db,filtros_sin_tipo
    )

    meses = [
        item["mes"]
        for item in meses_resultado
    ]

    conteos = {
        (
            item["mes"],
            item["tipo_incidente"]
        ): item["tickets"]
        for item in resultados
    }

    series = []

    for posicion, tipo in enumerate(tipos, start=1):
        puntos = []

        for mes in meses:
            puntos.append({
                "mes": mes,
                "tickets": conteos.get(
                    (mes, tipo),
                    0
                )
            })

        series.append({
            "ranking": posicion,
            "tipo_incidente": tipo,
            "puntos": puntos
        })

    return {
        "grupo": grupo,
        "series": series
    }


#--------------------------------------------------------------------
#Resolutores
#--------------------------------------------------------------------

#Desempeño por Resolutor
def obtener_desempeno_resolutores(
    db: Session,
    filtros: IncidentSLADashboardFilters
):
    resultados = incident_sla_repository.obtener_desempeno_resolutores(
        db,filtros
    )

    resolutores = []

    for item in resultados:
        tickets = item["tickets"] or 0
        cumple = item["cumple"] or 0
        medibles = item["medibles"] or 0

        sla = (
            cumple / medibles * 100
            if medibles > 0
            else 0
        )

        resolutores.append({
            "resolutor": item["resolutor"],
            "tickets": tickets,
            "sla": round(sla,2)
        })

    return resolutores



# TABLA PAGINADA - DETALLE DE TICKETS INCIDENTES SLA
def obtener_tickets(
    db: Session,
    filtros: IncidentSLADashboardFilters,
    pagina: int = 1,
    tamano: int = 10
):

    resultado = (
        incident_sla_repository.obtener_tickets(
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
