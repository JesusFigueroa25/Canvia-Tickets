import re
from collections import Counter, defaultdict
from datetime import datetime
from sqlalchemy import func, select
from sqlalchemy.orm import Session
from app.database.sqlserver import verificar_conexion_sqlserver
from app.etl.incident_consolidated_etl import procesar_incident_consolidated
from app.etl.change_detector import detectar_cambios
from app.models.incident_consolidated_model import IncidentConsolidated
from app.repositories import (incident_consolidated_repository,import_run_repository,)
from app.schemas.consolidated_import_schema import (IncidentConsolidatedDashboardFilters)
from app.services.incident_cause_classifier import (REGLAS,clasificar_causa)

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



# ANÁLISIS DE INCIDENTES
# DISTRIBUCIÓN POR ATRIBUCIÓN ORIGINAL

def obtener_atribucion_incidentes(
    db: Session,
    filtros: IncidentConsolidatedDashboardFilters
):
    resultados = (
        incident_consolidated_repository
        .obtener_atribucion_incidentes(
            db,
            filtros
        )
    )
 
    # Valores originales establecidos en ServiceAIDE.
    # No se realizan reclasificaciones.
    conteos = {
        "Atribuible a Cliente": 0,
        "Atribuible a Canvia": 0
    }

    sin_atribucion = 0

    for row in resultados:
        atribucion = row["atribucion"]
        cantidad = int(row["tickets"] or 0)

        if atribucion is None:
            sin_atribucion += cantidad

        elif atribucion in conteos:
            conteos[atribucion] += cantidad

        else:
            # Evitar ocultar o reasignar datos inesperados.
            raise ValueError(
                "Se encontró un valor de Motivo_Resolucion "
                f"no contemplado: {atribucion!r}"
            )

    total_atribuidos = sum(conteos.values())

    total_tickets = (
        total_atribuidos + sin_atribucion
    )

    distribucion = []

    for atribucion, cantidad in conteos.items():

        porcentaje = (
            round(
                cantidad * 100.0 / total_atribuidos,
                2
            )
            if total_atribuidos > 0
            else 0.0
        )

        distribucion.append({
            "atribucion": atribucion,
            "tickets": cantidad,
            "porcentaje": porcentaje
        })

    return {
        "total_tickets": total_tickets,
        "total_atribuidos": total_atribuidos,
        "sin_atribucion": sin_atribucion,
        "distribucion": distribucion
    }



# UTILIDAD - EXTRAER Y NORMALIZAR SERVIDORES
PATRON_SERVIDOR = re.compile(
    r"(?<![A-Z0-9_-])(?:"
    r"IP-(?:\d{1,3}-){3}\d{1,3}(?:\.EC2\.INTERNAL)?"
    r"|SRV[A-Z0-9][A-Z0-9_-]*"
    r"|UNHOS[A-Z0-9][A-Z0-9_-]*"
    r"|PC-[A-Z0-9][A-Z0-9_-]*"
    r")(?:\.[A-Z0-9-]+)*(?![A-Z0-9_-])",
    re.IGNORECASE
)


def extraer_servidores(texto: str | None) -> set[str]:

    if not texto:
        return set()

    servidores = set()

    for coincidencia in PATRON_SERVIDOR.finditer(texto):

        nombre = coincidencia.group(0).upper()
        nombre = nombre.strip("._-")

        # Normalizar nombres con dominio.
        # Ejemplo:
        # SRVPRDPIVI1.UNACEM.CORP -> SRVPRDPIVI1
        #
        # En AWS conservamos el identificador completo.
        if not nombre.startswith("IP-"):
            nombre = nombre.split(".", 1)[0]

        if len(nombre) >= 6:
            servidores.add(nombre)

    return servidores



# ANÁLISIS DE INCIDENTES
# TOP DE SERVIDORES CON MÁS INCIDENTES

def obtener_top_servidores(
    db: Session,
    filtros: IncidentConsolidatedDashboardFilters,
    limite: int = 10
):

    # 1. Total real de incidentes con los mismos filtros.
    # Reutilizamos los KPIs existentes.
    kpis = obtener_kpis(db, filtros)

    total_incidentes = int(
        kpis["total_tickets"] or 0
    )

    # 2. Contadores.
    contador_servidores = defaultdict(int)
    ejemplos_servidores = defaultdict(list)

    incidentes_con_servidor = 0

    # 3. Obtener tickets candidatos.
    filas = (
        incident_consolidated_repository
        .obtener_tickets_para_top_servidores(
            db,
            filtros
        )
    )

    try:
        for fila in filas:

            ticket_id = fila["Ticket_ID"]

            # 4. Fuentes principales.
            servidores = (
                extraer_servidores(fila["Descripcion"])
                |
                extraer_servidores(fila["Detalle"])
            )

            # 5. Fuentes complementarias:
            # solo cuando no encontramos identificadores
            # en Descripcion ni Detalle.
            if not servidores:
                servidores = (
                    extraer_servidores(fila["Causa"])
                    |
                    extraer_servidores(fila["Solucion"])
                )

            if not servidores:
                continue

            incidentes_con_servidor += 1

            # 6. Un mismo servidor cuenta una sola vez
            # por Ticket_ID.
            for servidor in servidores:

                contador_servidores[servidor] += 1

                # Conservar hasta 3 tickets de ejemplo.
                ejemplos = ejemplos_servidores[servidor]

                if len(ejemplos) < 3:
                    ejemplos.append(ticket_id)

    finally:
        # Liberar los recursos de la consulta.
        filas.close()

    # 7. Indicadores generales.
    incidentes_sin_servidor = (
        total_incidentes - incidentes_con_servidor
    )

    total_servidores_identificados = len(
        contador_servidores
    )

    # Un incidente con dos servidores genera
    # dos asociaciones ticket-servidor.
    total_asociaciones = sum(
        contador_servidores.values()
    )

    # 8. Ordenar por cantidad de incidentes.
    ranking = sorted(
        contador_servidores.items(),
        key=lambda item: (
            -item[1],
            item[0]
        )
    )

    # 9. Limitar resultados.
    ranking = ranking[:limite]

    # 10. Construir respuesta.
    servidores = []

    for servidor, cantidad in ranking:

        porcentaje = (
            round(
                cantidad * 100.0 / total_incidentes,
                2
            )
            if total_incidentes > 0
            else 0.0
        )

        servidores.append({
            "servidor": servidor,
            "incidentes": cantidad,
            "porcentaje": porcentaje,
            "tickets_ejemplo": ejemplos_servidores[servidor]
        })

    return {
        "total_incidentes": total_incidentes,
        "incidentes_con_servidor": incidentes_con_servidor,
        "incidentes_sin_servidor": incidentes_sin_servidor,
        "total_servidores_identificados": total_servidores_identificados,
        "total_asociaciones": total_asociaciones,
        "limite": limite,
        "servidores": servidores
    }



# ANÁLISIS DE INCIDENTES - ANÁLISIS DE LAS CAUSAS DE LOS INCIDENTES

def obtener_analisis_causas(
    db: Session,
    filtros: IncidentConsolidatedDashboardFilters
):

    # 1. Reutilizar el total de KPIs existente.
    kpis = obtener_kpis(db, filtros)
    total_incidentes = int(kpis["total_tickets"] or 0)

    # 2. Catálogo provisional de acciones.
    acciones = {
        categoria: accion
        for categoria, accion, _ in REGLAS
    }

    # 3. Acumuladores.
    conteos = Counter()
    evidencias = defaultdict(list)

    con_factor_tecnico = 0
    sin_causa_determinada = 0
    casos_multifactor = 0

    tickets_para_revision = []

    # 4. Consultar los tickets filtrados.
    filas = (
        incident_consolidated_repository
        .obtener_tickets_para_analisis_causas(
            db,
            filtros
        )
    )

    try:
        for fila in filas:

            ticket_id = fila["Ticket_ID"]

            # 5. Clasificar cada ticket individualmente.
            analisis = clasificar_causa(
                causa=fila["Causa"],
                solucion=fila["Solucion"],
                detalle=fila["Detalle"],
                descripcion=fila["Descripcion"]
            )

            categoria = analisis["categoria"]

            # 6. Sin causa principal identificable.
            if categoria is None:

                sin_causa_determinada += 1

                if analisis["estado"] == "evidencia_multiple":
                    casos_multifactor += 1

                if len(tickets_para_revision) < 10:
                    tickets_para_revision.append(
                        ticket_id
                    )

                continue

            # 7. Un ticket = una categoría principal.
            con_factor_tecnico += 1
            conteos[categoria] += 1

            # 8. Evidencia auditable.
            if len(evidencias[categoria]) < 20:

                evidencias[categoria].append({
                    "ticket_id": ticket_id,
                    "campo": analisis["campo"],
                    "texto": analisis["evidencia"]
                })

    finally:
        filas.close()

    # 9. Construir tabla y gráfico usando
    # el mismo denominador y las mismas categorías.
    causas = []

    for categoria, cantidad in sorted(
        conteos.items(),
        key=lambda item: (-item[1], item[0])
    ):

        porcentaje = (
            round(
                cantidad * 100.0 / total_incidentes,
                2
            )
            if total_incidentes > 0
            else 0.0
        )

        causas.append({
            "categoria": categoria,
            "incidentes": cantidad,
            "porcentaje": porcentaje,
            "es_causa_identificada": True,
            "accion_recomendada": acciones[categoria],
            "evidencias": evidencias[categoria]
        })

    # CASOS MULTIFACTOR Y SIN EVIDENCIA
    sin_evidencia = (
        sin_causa_determinada - casos_multifactor
    )

    # 1. Casos con multiples factores documentados.
    causas.append({
        "categoria": "Múltiples factores (revisión)",
        "incidentes": casos_multifactor,
        "porcentaje": (
            round(
                casos_multifactor * 100.0 / total_incidentes,
                2
            )
            if total_incidentes > 0
            else 0.0
        ),
        "es_causa_identificada": False,
        "accion_recomendada": (
            "Revisar los factores técnicos concurrentes "
            "antes de determinar una causa principal."
        ),
        "evidencias": []
    })

    # 2. Incidentes sin evidencia suficiente.
    causas.append({
        "categoria": "Sin evidencia técnica suficiente",
        "incidentes": sin_evidencia,
        "porcentaje": (
            round(
                sin_evidencia * 100.0 / total_incidentes,
                2
            )
            if total_incidentes > 0
            else 0.0
        ),
        "es_causa_identificada": False,
        "accion_recomendada": (
            "Revisar los campos del ticket para "
            "determinar posibles factores técnicos."
        ),
        "evidencias": []
    })

    
    
    

    # 11. Comprobación de integridad.
    # Evita entregar distribuciones incompletas.
    if (
        con_factor_tecnico + sin_causa_determinada
        != total_incidentes
    ):
        raise RuntimeError(
            "El total del análisis de causas no "
            "coincide con el conjunto filtrado."
        )

    return {
        "total_incidentes": total_incidentes,
        "con_factor_tecnico": con_factor_tecnico,
        "sin_causa_determinada": sin_causa_determinada,
        "casos_multifactor": casos_multifactor,
        "metodologia": (
            "Clasificación técnica preliminar basada "
            "en Causa, Solucion, Detalle y Descripcion. "
            "Requiere validación del especialista."
        ),
        "causas": causas,
        "tickets_para_revision": tickets_para_revision
    }




# ANALISIS DE INCIDENTES
# DISTRIBUCION AJUSTADA POR ANALISIS DE CAUSA

def obtener_distribucion_ajustada_causas(
    db: Session,
    filtros: IncidentConsolidatedDashboardFilters
):
    # 1. REUTILIZAR ATRIBUCION ORIGINAL

    original = obtener_atribucion_incidentes(
        db=db,
        filtros=filtros
    )

    total_tickets = int(original["total_tickets"])
    total_atribuidos = int(original["total_atribuidos"])
    sin_atribucion = int(original["sin_atribucion"])

    # 2. ESTADO DE LAS REGLAS DE AJUSTE

    reglas_aprobadas = 0
    ajustes_aplicados = 0
    ajustes_habilitados = False

    estado_ajuste = "PENDIENTE_REGLAS_APROBADAS"

    # 3. DISTRIBUCION ORIGINAL
    distribucion_original = [
        {
            "atribucion": item["atribucion"],
            "tickets": int(item["tickets"]),
            "porcentaje": float(item["porcentaje"])
        }
        for item in original["distribucion"]
    ]

    # 4. DISTRIBUCION AJUSTADA

    distribucion_ajustada = [
        dict(item)
        for item in distribucion_original
    ]

    total_atribuidos_ajustado = total_atribuidos
    sin_atribucion_ajustado = sin_atribucion

    # 5. COMPARACION ENTRE DISTRIBUCIONES

    ajustados_por_atribucion = {
        item["atribucion"]: item
        for item in distribucion_ajustada
    }

    comparacion = []

    for item in distribucion_original:

        atribucion = item["atribucion"]

        ajustado = ajustados_por_atribucion[atribucion]

        tickets_originales = int(item["tickets"])
        tickets_ajustados = int(ajustado["tickets"])

        comparacion.append({
            "atribucion": atribucion,
            "tickets_originales": tickets_originales,
            "tickets_ajustados": tickets_ajustados,
            "variacion_tickets": (
                tickets_ajustados - tickets_originales
            ),
            "porcentaje_original": float(
                item["porcentaje"]
            ),
            "porcentaje_ajustado": float(
                ajustado["porcentaje"]
            )
        })

    # 6. VALIDACIONES DE INTEGRIDAD

    suma_original = sum(
        item["tickets"]
        for item in distribucion_original
    )

    suma_ajustada = sum(
        item["tickets"]
        for item in distribucion_ajustada
    )

    if suma_original != total_atribuidos:
        raise RuntimeError(
            "La distribucion original no coincide "
            "con el total de incidentes atribuidos."
        )

    if suma_ajustada != total_atribuidos_ajustado:
        raise RuntimeError(
            "La distribucion ajustada no coincide "
            "con el total de incidentes atribuidos."
        )

    if total_atribuidos + sin_atribucion != total_tickets:
        raise RuntimeError(
            "La atribucion original no coincide "
            "con el total filtrado."
        )

    if (
        total_atribuidos_ajustado
        + sin_atribucion_ajustado
        != total_tickets
    ):
        raise RuntimeError(
            "La atribucion ajustada no coincide "
            "con el total filtrado."
        )

    if not ajustes_habilitados:
        if any(
            item["variacion_tickets"] != 0
            for item in comparacion
        ):
            raise RuntimeError(
                "Se detectaron ajustes sin autorizacion."
            )

    # 7. RESPUESTA

    return {
        "total_tickets": total_tickets,

        "total_atribuidos_original": total_atribuidos,
        "total_atribuidos_ajustado": total_atribuidos_ajustado,

        "sin_atribucion_original": sin_atribucion,
        "sin_atribucion_ajustado": sin_atribucion_ajustado,

        "reglas_aprobadas": reglas_aprobadas,
        "ajustes_aplicados": ajustes_aplicados,
        "ajustes_habilitados": ajustes_habilitados,

        "estado_ajuste": estado_ajuste,

        "metodologia": (
            "Comparacion entre la atribucion original "
            "de ServiceAIDE y la distribucion ajustada. "
            "El analisis tecnico de causas V3 no determina "
            "automaticamente responsabilidades. "
            "No se aplican reclasificaciones hasta contar "
            "con reglas aprobadas por el especialista."
        ),

        "distribucion_original": distribucion_original,
        "distribucion_ajustada": distribucion_ajustada,

        "comparacion": comparacion
    }



# ANALISIS DE INCIDENTES - PRINCIPALES HALLAZGOS
def obtener_principales_hallazgos(
    db: Session,
    filtros: IncidentConsolidatedDashboardFilters,
    incluir_servidores: bool = False,
    atribucion_precalculada: dict | None = None,
    analisis_precalculado: dict | None = None
):
    # Los endpoints existentes siguen funcionando sin enviar los parámetros opcionales.
    atribucion = (
        atribucion_precalculada if atribucion_precalculada is not None
        else obtener_distribucion_ajustada_causas(db=db, filtros=filtros)
    )

    analisis = (
        analisis_precalculado if analisis_precalculado is not None
        else obtener_analisis_causas(db=db, filtros=filtros)
    )

    total = int(atribucion["total_tickets"])

    if total != int(analisis["total_incidentes"]):
        raise RuntimeError(
            "Los totales de atribucion y causas "
            "no coinciden."
        )

    hallazgos = []

    def porcentaje(cantidad, denominador):
        return (
            round(cantidad * 100.0 / denominador, 2)
            if denominador > 0
            else 0.0
        )

    def agregar(
        codigo,
        tipo,
        titulo,
        descripcion,
        valor,
        denominador=None,
        requiere_validacion=False
    ):
        hallazgos.append({
            "codigo": codigo,
            "tipo": tipo,
            "titulo": titulo,
            "descripcion": descripcion,
            "valor": int(valor),
            "porcentaje": (
                porcentaje(valor, denominador)
                if denominador is not None
                else None
            ),
            "denominador": denominador,
            "requiere_validacion": requiere_validacion
        })

    if total == 0:
        return {
            "total_incidentes": 0,
            "total_hallazgos": 0,
            "estado_ajuste": atribucion["estado_ajuste"],
            "metodologia": (
                "No existen incidentes para los filtros "
                "seleccionados."
            ),
            "hallazgos": []
        }

    # 1. ATRIBUCION ORIGINAL

    distribucion = atribucion["distribucion_original"]

    total_atribuidos = int(
        atribucion["total_atribuidos_original"]
    )

    if total_atribuidos > 0:

        principal = max(
            distribucion,
            key=lambda item: item["tickets"]
        )

        agregar(
            codigo="H01",
            tipo="atribucion",
            titulo="Distribución de atribución original",
            descripcion=(
                f"La categoría {principal['atribucion']} "
                f"registra {principal['tickets']} incidentes, "
                f"equivalentes al "
                f"{porcentaje(principal['tickets'], total_atribuidos)}% "
                f"de los incidentes con atribución original. "
                "Este resultado no implica una validación "
                "independiente de responsabilidad."
            ),
            valor=principal["tickets"],
            denominador=total_atribuidos
        )

    sin_atribucion = int(
        atribucion["sin_atribucion_original"]
    )

    if sin_atribucion > 0:
        agregar(
            codigo="H02",
            tipo="calidad_datos",
            titulo="Incidentes sin atribución registrada",
            descripcion=(
                f"Se identificaron {sin_atribucion} incidentes "
                "sin atribución original registrada. "
                "Requieren revisión antes de establecer "
                "responsabilidad."
            ),
            valor=sin_atribucion,
            denominador=total,
            requiere_validacion=True
        )

    # 2. FACTORES TECNICOS DOCUMENTADOS

    con_factor = int(
        analisis["con_factor_tecnico"]
    )

    agregar(
        codigo="H03",
        tipo="causas",
        titulo="Factores técnicos documentados",
        descripcion=(
            f"El análisis preliminar V3 identificó "
            f"un factor técnico principal en {con_factor} "
            f"de {total} incidentes. "
            "Esta clasificación no confirma causas raíz."
        ),
        valor=con_factor,
        denominador=total,
        requiere_validacion=True
    )

    # 3. FACTOR TECNICO MAS FRECUENTE

    causas_identificadas = [
        item
        for item in analisis["causas"]
        if item["es_causa_identificada"]
        and item["incidentes"] > 0
    ]

    if causas_identificadas:

        principal = max(
            causas_identificadas,
            key=lambda item: item["incidentes"]
        )

        agregar(
            codigo="H04",
            tipo="causas",
            titulo="Factor técnico más frecuente",
            descripcion=(
                f"La categoría '{principal['categoria']}' "
                f"se identificó en {principal['incidentes']} "
                "incidentes, representando el "
                f"{porcentaje(principal['incidentes'], con_factor)}% "
                "de los incidentes con un factor "
                "principal documentado."
            ),
            valor=principal["incidentes"],
            denominador=con_factor,
            requiere_validacion=True
        )

    # 4. CASOS MULTIFACTOR

    multifactor = int(
        analisis["casos_multifactor"]
    )

    if multifactor > 0:
        agregar(
            codigo="H05",
            tipo="causas",
            titulo="Incidentes con múltiples factores",
            descripcion=(
                f"Se detectaron {multifactor} incidentes "
                "con más de un factor técnico documentado. "
                "No se asignó automáticamente una "
                "causa principal."
            ),
            valor=multifactor,
            denominador=total,
            requiere_validacion=True
        )

    # 5. INCIDENTES SIN EVIDENCIA SUFICIENTE

    sin_evidencia = (
        int(analisis["sin_causa_determinada"])
        - multifactor
    )

    if sin_evidencia < 0:
        raise RuntimeError(
            "Cantidad inconsistente de incidentes "
            "sin evidencia tecnica."
        )

    if sin_evidencia > 0:
        agregar(
            codigo="H06",
            tipo="calidad_datos",
            titulo="Incidentes sin evidencia técnica suficiente",
            descripcion=(
                f"En {sin_evidencia} incidentes, "
                "las reglas V3 no encontraron evidencia "
                "suficiente para clasificar un factor "
                "principal. Esto no demuestra que "
                "los incidentes carezcan de causa."
            ),
            valor=sin_evidencia,
            denominador=total,
            requiere_validacion=True
        )

    # 6. SERVIDOR CON MAS INCIDENTES - OPCIONAL

    if incluir_servidores:

        resultado_servidores = obtener_top_servidores(
            db=db,
            filtros=filtros,
            limite=1
        )

        ranking = resultado_servidores["servidores"]

        if ranking:

            servidor = ranking[0]

            agregar(
                codigo="H07",
                tipo="servidores",
                titulo="Servidor con más incidentes asociados",
                descripcion=(
                    f"El identificador "
                    f"'{servidor['servidor']}' "
                    f"aparece asociado a "
                    f"{servidor['incidentes']} incidentes "
                    "del conjunto filtrado. "
                    "Su presencia en los textos no "
                    "demuestra que sea el origen "
                    "del incidente."
                ),
                valor=servidor["incidentes"],
                denominador=total,
                requiere_validacion=True
            )

    # 7. VERIFICACIONES DE INTEGRIDAD

    if (
        con_factor
        + multifactor
        + sin_evidencia
        != total
    ):
        raise RuntimeError(
            "La distribucion de factores tecnicos "
            "no coincide con el total de incidentes."
        )

    # 8. RESPUESTA FINAL

    return {
        "total_incidentes": total,
        "total_hallazgos": len(hallazgos),
        "estado_ajuste": atribucion["estado_ajuste"],
        "metodologia": (
            "Hallazgos descriptivos generados mediante "
            "indicadores de atribucion original, "
            "clasificacion tecnica V3 y, opcionalmente, "
            "asociaciones de servidores. "
            "Los resultados son preliminares, "
            "no constituyen un dictamen de causa raiz "
            "ni modifican responsabilidades. "
            "Requieren validacion del especialista."
        ),
        "hallazgos": hallazgos
    }



# ANALISIS DE INCIDENTES - CONCLUSIONES

def obtener_conclusiones(
    db: Session,
    filtros: IncidentConsolidatedDashboardFilters,
    incluir_servidores: bool = False,
    hallazgos_precalculados: dict | None = None
):

    resultado = (
        hallazgos_precalculados if hallazgos_precalculados is not None
        else obtener_principales_hallazgos(
            db=db,
            filtros=filtros,
            incluir_servidores=incluir_servidores
        )
    )

    total = int(resultado["total_incidentes"])
    estado_ajuste = resultado["estado_ajuste"]

    hallazgos = {
        item["codigo"]: item
        for item in resultado["hallazgos"]
    }

    conclusiones = []

    def agregar(
        codigo,
        tipo,
        titulo,
        conclusion,
        recomendacion,
        referencias,
        requiere_validacion=False
    ):
        conclusiones.append({
            "codigo": codigo,
            "tipo": tipo,
            "titulo": titulo,
            "conclusion": conclusion,
            "recomendacion": recomendacion,
            "hallazgos_referencia": referencias,
            "requiere_validacion": requiere_validacion
        })

    # 1. SIN RESULTADOS

    if total == 0:
        return {
            "total_incidentes": 0,
            "total_conclusiones": 0,
            "estado_ajuste": estado_ajuste,
            "metodologia": (
                "No existen incidentes para los filtros "
                "seleccionados. No se generan conclusiones."
            ),
            "conclusiones": []
        }

    def porcentaje(valor):
        return round(valor * 100.0 / total, 2)

    # 2. CONCLUSION SOBRE ATRIBUCION

    if "H01" in hallazgos:

        h01 = hallazgos["H01"]

        agregar(
            codigo="C01",
            tipo="atribucion",
            titulo="Distribución de atribución registrada",
            conclusion=h01["descripcion"],
            recomendacion=(
                "Conservar la atribución original de "
                "ServiceAIDE y revisar cualquier propuesta "
                "de cambio con el especialista responsable."
            ),
            referencias=["H01"],
            requiere_validacion=False
        )



    # ======================================================
    # 3. CONCLUSION SOBRE COBERTURA TECNICA
    # ======================================================

    if "H03" in hallazgos:

        con_factor = int(hallazgos["H03"]["valor"])

        multifactor = int(
            hallazgos.get("H05", {}).get("valor", 0)
        )

        sin_evidencia = int(
            hallazgos.get("H06", {}).get("valor", 0)
        )

        if con_factor + multifactor + sin_evidencia != total:
            raise RuntimeError(
                "Los hallazgos de causas no coinciden "
                "con el total de incidentes."
            )

        referencias = ["H03"]

        if "H05" in hallazgos:
            referencias.append("H05")

        if "H06" in hallazgos:
            referencias.append("H06")

        agregar(
            codigo="C02",
            tipo="cobertura",
            titulo="Cobertura de la identificación técnica",
            conclusion=(
                f"De {total} incidentes, el clasificador V3 "
                f"identificó un factor principal en "
                f"{con_factor} ({porcentaje(con_factor)}%), "
                f"múltiples factores en "
                f"{multifactor} ({porcentaje(multifactor)}%) "
                f"y evidencia insuficiente en "
                f"{sin_evidencia} "
                f"({porcentaje(sin_evidencia)}%). "
                "Estos resultados representan una "
                "clasificación preliminar, no una "
                "confirmación de causas raíz."
            ),
            recomendacion=(
                "Validar las clasificaciones contra los "
                "tickets originales y revisar los casos "
                "sin evidencia reconocida por las reglas V3."
            ),
            referencias=referencias,
            requiere_validacion=True
        )



    # 4. FACTOR TECNICO MAS FRECUENTE

    if "H04" in hallazgos:

        h04 = hallazgos["H04"]

        agregar(
            codigo="C03",
            tipo="causas",
            titulo="Factor técnico más frecuente",
            conclusion=h04["descripcion"],
            recomendacion=(
                "Revisar los tickets asociados a este "
                "factor y evaluar medidas preventivas "
                "únicamente después de confirmar "
                "su origen técnico."
            ),
            referencias=["H04"],
            requiere_validacion=True
        )

    # 5. FACTORES MULTIPLES

    if "H05" in hallazgos:

        h05 = hallazgos["H05"]

        agregar(
            codigo="C04",
            tipo="causas",
            titulo="Incidentes con factores concurrentes",
            conclusion=h05["descripcion"],
            recomendacion=(
                "Revisar individualmente los factores "
                "documentados antes de seleccionar "
                "una causa principal o establecer "
                "acciones correctivas."
            ),
            referencias=["H05"],
            requiere_validacion=True
        )

    # 6. ATRIBUCIONES NO REGISTRADAS

    if "H02" in hallazgos:

        h02 = hallazgos["H02"]

        agregar(
            codigo="C05",
            tipo="calidad_datos",
            titulo="Registros sin atribución original",
            conclusion=h02["descripcion"],
            recomendacion=(
                "Revisar los registros sin atribución "
                "y solicitar la validación correspondiente. "
                "No asignar responsabilidad automáticamente."
            ),
            referencias=["H02"],
            requiere_validacion=True
        )

    # 7. SERVIDOR MAS MENCIONADO - OPCIONAL

    if incluir_servidores and "H07" in hallazgos:

        h07 = hallazgos["H07"]

        agregar(
            codigo="C06",
            tipo="servidores",
            titulo="Concentración de incidentes por servidor",
            conclusion=h07["descripcion"],
            recomendacion=(
                "Revisar la recurrencia de tickets "
                "asociados al servidor identificado "
                "sin asumir que este sea la causa "
                "de los incidentes."
            ),
            referencias=["H07"],
            requiere_validacion=True
        )

    # 8. ESTADO DE LA DISTRIBUCION AJUSTADA

    if estado_ajuste == "PENDIENTE_REGLAS_APROBADAS":

        agregar(
            codigo="C07",
            tipo="gobernanza",
            titulo="Atribución ajustada pendiente de aprobación",
            conclusion=(
                "La distribución ajustada conserva "
                "actualmente la atribución original, "
                "debido a que no existen reglas "
                "de reclasificación aprobadas."
            ),
            recomendacion=(
                "Definir y aprobar reglas de ajuste "
                "con justificación y trazabilidad "
                "por ticket antes de habilitar "
                "cualquier reclasificación."
            ),
            referencias=[],
            requiere_validacion=True
        )

    # 9. VALIDACIONES DE INTEGRIDAD

    codigos = [
        item["codigo"]
        for item in conclusiones
    ]

    if len(codigos) != len(set(codigos)):
        raise RuntimeError(
            "Se encontraron códigos duplicados "
            "entre las conclusiones."
        )

    for item in conclusiones:
        for codigo_hallazgo in item["hallazgos_referencia"]:
            if codigo_hallazgo not in hallazgos:
                raise RuntimeError(
                    "Una conclusión hace referencia "
                    "a un hallazgo inexistente."
                )

    # 10. RESPUESTA FINAL

    return {
        "total_incidentes": total,
        "total_conclusiones": len(conclusiones),
        "estado_ajuste": estado_ajuste,
        "metodologia": (
            "Conclusiones descriptivas generadas a partir "
            "de los principales hallazgos, la atribución "
            "original de ServiceAIDE y la clasificación "
            "técnica preliminar V3. "
            "No se aplican inferencias automáticas "
            "de responsabilidad. Las recomendaciones "
            "requieren evaluación del especialista."
        ),
        "conclusiones": conclusiones
    }
