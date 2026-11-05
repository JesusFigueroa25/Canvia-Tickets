import pandas as pd
from sqlalchemy import (delete,insert,select,)
from sqlalchemy.orm import Session
from app.models.requirement_sla_model import (RequirementSLA,stg_requirement_sla_table,)
from datetime import date,datetime,time,timedelta
from sqlalchemy import Integer,case,cast,func
from app.schemas.sla_import_schema import RequirementSLADashboardFilters

# UTILIDAD
def _dataframe_a_registros(df: pd.DataFrame):
    df_sql = df.copy()
    df_sql = df_sql.astype(object).where(pd.notna(df_sql), None)
    return df_sql.to_dict(orient="records")

# STAGING
def limpiar_staging(db: Session):
    db.execute(delete(stg_requirement_sla_table))

def cargar_staging(db: Session,df: pd.DataFrame):
    columnas_staging = [
        columna.name
        for columna in stg_requirement_sla_table.columns
    ]

    faltantes = [
        columna
        for columna in columnas_staging
        if columna not in df.columns
    ]

    if faltantes:
        raise ValueError(f"Faltan columnas para staging: {faltantes}")

    df_staging = df[columnas_staging].copy()
    registros = _dataframe_a_registros(df_staging)

    if registros:
        tamano_lote = 500

        for inicio in range(0,len(registros),tamano_lote):
            lote = registros[inicio:inicio + tamano_lote]
            db.execute(insert(stg_requirement_sla_table),lote)

    return len(registros)

# CONSULTAS
def obtener_staging(db: Session):
    consulta = select(stg_requirement_sla_table)
    return pd.read_sql(consulta,db.connection())

#Optimizacion de extracion de datos
def obtener_oficial(db: Session):
    columnas = [
        RequirementSLA.__table__.c[columna.name]
        for columna in stg_requirement_sla_table.columns
    ]

    consulta = (
        select(*columnas)
        .select_from(
            RequirementSLA.__table__.join(
                stg_requirement_sla_table,
                RequirementSLA.Ticket_ID == stg_requirement_sla_table.c.Ticket_ID
            )
        )
    )

    return pd.read_sql(consulta,db.connection())

# INSERT
def insertar_nuevos(db: Session,df: pd.DataFrame):
    if df.empty:
        return 0
    registros = _dataframe_a_registros(df)
    db.execute(insert(RequirementSLA.__table__), registros)
    return len(registros)

# UPDATE
def actualizar_modificados(db: Session,df: pd.DataFrame):
    if df.empty:
        return 0
    registros = _dataframe_a_registros(df)
    db.bulk_update_mappings(RequirementSLA, registros)
    return len(registros)


def normalizar_tipos_requerimiento(tipos_requerimiento):
    if not tipos_requerimiento:
        return []

    if isinstance(tipos_requerimiento,str):
        tipos_requerimiento = [tipos_requerimiento]

    tipos_normalizados = []

    for tipo in tipos_requerimiento:
        if not isinstance(tipo, str):
            continue

        tipo_limpio = tipo.strip()
        if (
            tipo_limpio
            and tipo_limpio not in tipos_normalizados
        ):
            tipos_normalizados.append(tipo_limpio)

    return tipos_normalizados


# Obtener el rango del mes seleccionado
def obtener_rango_periodo(periodo: str):
    inicio = date.fromisoformat(f"{periodo}-01")

    if inicio.month == 12:
        fin = date(inicio.year + 1, 1, 1)
    else:
        fin = date(inicio.year, inicio.month + 1, 1)

    return inicio, fin


# Normalizar proyecto de SQL Server
def normalizar_proyecto(modelo=RequirementSLA):
      return func.coalesce(
          func.nullif(
              func.trim(modelo.Proyecto),
              ""
          ),
          "Sin especificar"
      )


# Normalizar lista de proyectos excluidos
def normalizar_proyectos_excluidos(proyectos):
    if not proyectos:
        return []

    if isinstance(proyectos, str):
        proyectos = [proyectos]

    resultado = []
    vistos = set()

    for valor in proyectos:
        if not isinstance(valor, str):
            continue

        nombre = valor.strip()

        if not nombre:
            continue

        clave = nombre.casefold()

        if clave not in vistos:
            vistos.add(clave)
            resultado.append(nombre)

    return resultado


# Aplicar filtros del dashboard
def aplicar_filtros_dashboard(
    query,
    filtros: RequirementSLADashboardFilters
):
    # Fecha desde
    if filtros.desde:
        fecha_desde = datetime.combine(
            filtros.desde,
            time.min
        )

        query = query.filter(
            RequirementSLA.Fecha_Creacion >= fecha_desde
        )

    # Fecha hasta
    if filtros.hasta:
        fecha_hasta = datetime.combine(
            filtros.hasta + timedelta(days=1),
            time.min
        )

        query = query.filter(
            RequirementSLA.Fecha_Creacion < fecha_hasta
        )

    # Grupo resolutor
    if filtros.grupo_resolutor:
        query = query.filter(
            RequirementSLA.Grupo_Resolutor == filtros.grupo_resolutor
        )

    # Prioridad
    if filtros.prioridad:
        query = query.filter(
            RequirementSLA.Prioridad == filtros.prioridad
        )

    # Categoría
    if filtros.categoria:
        query = query.filter(
            RequirementSLA.Categorizacion_Categoria == filtros.categoria
        )

    # Proyecto individual
    if filtros.proyecto and filtros.proyecto.strip():
        query = query.filter(
            func.trim(RequirementSLA.Proyecto) == filtros.proyecto.strip()
        )

    # NUEVO: Exclusión múltiple de proyectos
    excluidos = normalizar_proyectos_excluidos(
        filtros.proyectos_excluidos
    )

    if excluidos:
        query = query.filter(
            normalizar_proyecto().notin_(excluidos)
        )

    # Tipos de requerimiento
    tipos = normalizar_tipos_requerimiento(
        filtros.tipo_requerimiento
    )

    if tipos:
        query = query.filter(
            func.trim(
                RequirementSLA.Categorizacion_Tipo
            ).in_(tipos)
        )

    # Condición día
    if filtros.condicion_dia:
        query = query.filter(
            RequirementSLA.Condicion_dia == filtros.condicion_dia
        )

    # Condición SLA de solución
    if filtros.sla_solucion_condicion:
        query = query.filter(
            RequirementSLA.SLA_Solucion_Condicion ==
            filtros.sla_solucion_condicion
        )

    # Filtro dinámico por mes
    if filtros.periodo:
        inicio_mes, fin_mes = obtener_rango_periodo(
            filtros.periodo
        )

        query = query.filter(
            RequirementSLA.Fecha_Creacion >= datetime.combine(
                inicio_mes,
                time.min
            ),
            RequirementSLA.Fecha_Creacion < datetime.combine(
                fin_mes,
                time.min
            )
        )


    # FILTRO DINAMICO POR TICKET ID
    if filtros.ticket_id and filtros.ticket_id.strip():

        query = query.filter(
            RequirementSLA.Ticket_ID ==
            filtros.ticket_id.strip()
        )



    return query


#KPIs
def obtener_kpis(
    db: Session,
    filtros: RequirementSLADashboardFilters
):

    query = db.query(
        func.count(RequirementSLA.Ticket_ID).label("total_tickets"),
        func.sum(case((RequirementSLA.SLA_Respuesta_Condicion == "Cumplido",1,),else_=0,)).label("sla_respuesta_cumple"),
        func.sum(case((RequirementSLA.SLA_Respuesta_Condicion == "No cumplido",1,),else_=0,)).label("sla_respuesta_incumple"),
        func.sum(case((RequirementSLA.SLA_Solucion_Condicion == "Cumplido",1,),else_=0,)).label("sla_solucion_cumple"),
        func.sum(case((RequirementSLA.SLA_Solucion_Condicion == "No cumplido",1,),else_=0,)).label("sla_solucion_incumple"),
        func.sum(case((RequirementSLA.OLA_Respuesta_Condicion == "Cumplido",1,),else_=0,)).label("ola_respuesta_cumple"),
        func.sum(case((RequirementSLA.OLA_Respuesta_Condicion == "No cumplido",1,),else_=0,)).label("ola_respuesta_incumple"),
        func.sum(case((RequirementSLA.OLA_Solucion_Condicion == "Cumplido",1,),else_=0,)).label("ola_solucion_cumple"),
        func.sum(case((RequirementSLA.OLA_Solucion_Condicion == "No cumplido",1,),else_=0,)).label("ola_solucion_incumple"),
    )
    
    query = aplicar_filtros_dashboard(
        query,
        filtros
    )

    return query.one()



# FILTROS
def obtener_opciones_filtros(db: Session):

    # 1. Obtener rango de fechas
    consulta_fechas = select(
        func.min(RequirementSLA.Fecha_Creacion).label("fecha_min"),
        func.max(RequirementSLA.Fecha_Creacion).label("fecha_max"),
    )
    fechas = db.execute(consulta_fechas).mappings().one()

    # 2. Función reutilizable para opciones de filtros
    def obtener_opciones(columna):
        valor = func.trim(columna)
        consulta = (
            select(valor)
            .where(columna.isnot(None), valor != "")
            .distinct()
            .order_by(valor)
        )
        return db.execute(consulta).scalars().all()

    # 3. Tipos de requerimiento
    tipo_col = func.trim(RequirementSLA.Categorizacion_Tipo)
    tipo_normalizado = func.lower(tipo_col)
    nombre_tipo = func.min(tipo_col)
    consulta_tipos = (
        select(nombre_tipo)
        .where(RequirementSLA.Categorizacion_Tipo.isnot(None), tipo_col != "")
        .group_by(tipo_normalizado)
        .order_by(nombre_tipo)
    )
    tipos_requerimiento = (db.execute(consulta_tipos).scalars().all())

    # 4. Condiciones de día
    consulta_condiciones = (
        select(RequirementSLA.Condicion_dia)
        .where(RequirementSLA.Condicion_dia.isnot(None))
        .distinct()
    )
    condiciones_existentes = set(db.execute(consulta_condiciones).scalars().all())
    orden_condiciones = [
        "Lun-Vie",
        "Fuera Horario",
        "Fin Sem."
    ]
    condiciones_dia = [
        valor
        for valor in orden_condiciones
        if valor in condiciones_existentes
    ]

    # 5. Resultado de todos los filtros
    return {
        "fecha_min": fechas["fecha_min"],
        "fecha_max": fechas["fecha_max"],
        "grupos_resolutores": obtener_opciones(RequirementSLA.Grupo_Resolutor),
        "prioridades": obtener_opciones(RequirementSLA.Prioridad),
        "categorias": obtener_opciones(RequirementSLA.Categorizacion_Categoria),
        "proyectos": obtener_opciones(RequirementSLA.Proyecto),
        "tipos_requerimiento": tipos_requerimiento,
        "condiciones_dia": condiciones_dia,
    }





#SLA Solución: Cumplidos vs Incumplidos
def obtener_sla_solucion_tendencia(
    db: Session,
    filtros: RequirementSLADashboardFilters
):
    anio = func.year(RequirementSLA.Fecha_Creacion)
    mes = func.month(RequirementSLA.Fecha_Creacion)

    query = db.query(
        anio.label("anio"),
        mes.label("mes"),
        func.sum(case((RequirementSLA.SLA_Solucion_Condicion == "Cumplido",1,),else_=0,)).label("cumplidos"),
        func.sum(case((RequirementSLA.SLA_Solucion_Condicion == "No cumplido",1,),else_=0,)).label("incumplidos"),
    )
    
    query = aplicar_filtros_dashboard(
        query,
        filtros
    )

    query = query.filter(RequirementSLA.Fecha_Creacion.isnot(None))

    return (query.group_by(anio,mes).order_by(anio,mes).all())




#Volumen de Requerimientos
def obtener_volumen_requerimientos(
    db: Session,
    filtros: RequirementSLADashboardFilters
):
    anio = func.year(RequirementSLA.Fecha_Creacion)
    mes = func.month(RequirementSLA.Fecha_Creacion)

    query = db.query(
        anio.label("anio"),
        mes.label("mes"),
        func.count(RequirementSLA.Ticket_ID).label("tickets"),
    )
    
    query = aplicar_filtros_dashboard(
        query,
        filtros
    )

    query = query.filter(RequirementSLA.Fecha_Creacion.isnot(None))

    return (query.group_by(anio,mes).order_by(anio,mes).all())




#Explorador por Proyectos
def obtener_proyectos(
    db: Session,
    filtros: RequirementSLADashboardFilters
):
    query = db.query(
        RequirementSLA.Proyecto.label("proyecto"),
        func.count(RequirementSLA.Ticket_ID).label("tickets"),
        func.sum(case((RequirementSLA.SLA_Solucion_Condicion == "Cumplido",1,),else_=0,)).label("cumple"),
        func.sum(case((RequirementSLA.SLA_Solucion_Condicion == "No cumplido",1,),else_=0,)).label("incumple"),
        func.sum(case((RequirementSLA.SLA_Solucion_Condicion == "Medición cancelada",1,),else_=0,)).label("sin_medicion"),
        func.sum(case((RequirementSLA.SLA_Respuesta_Condicion == "Cumplido",1,),else_=0,)).label("respuesta_cumple"),
        func.sum(case((RequirementSLA.SLA_Respuesta_Condicion == "No cumplido",1,),else_=0,)).label("respuesta_incumple"),
    )
    
    query = aplicar_filtros_dashboard(
        query,
        filtros
    )

    return (query.group_by(RequirementSLA.Proyecto).order_by(func.count(RequirementSLA.Ticket_ID).desc()).all())





#Pareto de Tipos de Requerimiento
def obtener_pareto_requerimientos(
    db: Session,
    filtros: RequirementSLADashboardFilters
):
    tipo_limpio = func.trim(RequirementSLA.Categorizacion_Tipo)
    tipo_normalizado = func.lower(tipo_limpio)

    query = db.query(
        func.min(tipo_limpio).label("tipo_requerimiento"),
        tipo_normalizado.label("tipo_normalizado"),
        func.count(RequirementSLA.Ticket_ID).label("cantidad"),
    )
    
    query = aplicar_filtros_dashboard(
        query,
        filtros
    )

    query = query.filter(
        RequirementSLA.Categorizacion_Tipo.isnot(None),
        tipo_limpio != "",
    )

    return (
        query.group_by(tipo_normalizado)
        .order_by(
            func.count(RequirementSLA.Ticket_ID).desc(),
            tipo_normalizado,
        )
        .all()
    )



#Tendencia de Requerimientos
def obtener_tendencia_requerimientos(
    db: Session,
    tipos_normalizados: list[str],
    filtros: RequirementSLADashboardFilters
):
    tipo_normalizado = func.lower(func.trim(RequirementSLA.Categorizacion_Tipo))
    anio = func.year(RequirementSLA.Fecha_Creacion)
    mes = func.month(RequirementSLA.Fecha_Creacion)

    query = db.query(
        tipo_normalizado.label("tipo_normalizado"),
        anio.label("anio"),
        mes.label("mes"),
        func.count(RequirementSLA.Ticket_ID).label("tickets"),
    )
    
    query = aplicar_filtros_dashboard(
        query,
        filtros
    )

    query = query.filter(RequirementSLA.Fecha_Creacion.isnot(None))
    query = query.filter(tipo_normalizado.in_(tipos_normalizados))

    return (query.group_by(tipo_normalizado,anio,mes,).order_by(tipo_normalizado,anio,mes,).all())




# Explorador de Tipos de Requerimientos
def obtener_explorador_tipos(
    db: Session,
    filtros: RequirementSLADashboardFilters
):

    tipo_limpio = func.trim(
        RequirementSLA.Categorizacion_Tipo
    )

    tipo_nombre = func.coalesce(
        func.nullif(tipo_limpio, ""),
        "Sin tipo"
    )

    query_base = db.query(
        tipo_nombre.label("tipo_nombre"),
        RequirementSLA.Ticket_ID.label("ticket_id"),
        RequirementSLA.Fecha_Creacion.label("fecha_creacion"),
        RequirementSLA.SLA_Solucion_Condicion.label("sla_solucion_condicion")
    )

    query_base = query_base.filter(
        RequirementSLA.Fecha_Creacion.isnot(None)
    )

    query_base = aplicar_filtros_dashboard(
        query_base,
        filtros
    )

    datos = query_base.subquery()

    tipo_normalizado = func.lower(datos.c.tipo_nombre)

    query_top = db.query(
        tipo_normalizado.label("tipo_normalizado"),
        func.count(datos.c.ticket_id).label("total")
    ).select_from(datos)

    top_tipos = (
        query_top
        .group_by(tipo_normalizado)
        .order_by(
            func.count(datos.c.ticket_id).desc(),
            tipo_normalizado.asc()
        )
        .limit(10)
        .all()
    )

    tipos_seleccionados = [
        row.tipo_normalizado
        for row in top_tipos
    ]

    if not tipos_seleccionados:
        return []

    anio = func.year(datos.c.fecha_creacion)
    mes = func.month(datos.c.fecha_creacion)

    query = db.query(
        func.min(datos.c.tipo_nombre).label("tipo_requerimiento"),
        tipo_normalizado.label("tipo_normalizado"),
        anio.label("anio"),
        mes.label("mes"),
        func.count(
            datos.c.ticket_id
        ).label("tot"),

        func.sum(
            case(
                (
                    datos.c.sla_solucion_condicion
                    == "Cumplido",
                    1
                ),
                else_=0
            )
        ).label("c"),

        func.sum(
            case(
                (
                    datos.c.sla_solucion_condicion
                    == "No cumplido",
                    1
                ),
                else_=0
            )
        ).label("i")
    ).select_from(datos)

    query = query.filter(
        tipo_normalizado.in_(tipos_seleccionados)
    )

    return (
        query
        .group_by(
            tipo_normalizado,
            anio,
            mes
        )
        .order_by(
            anio,
            mes,
            tipo_normalizado
        )
        .all()
    )


#Desempeño por Resolutor
def obtener_resolutores(
    db: Session,
    filtros: RequirementSLADashboardFilters
):
    resolutor = func.trim(RequirementSLA.Usuario_Resolutor)

    query = db.query(
        resolutor.label("resolutor"),
        func.count(RequirementSLA.Ticket_ID).label("cantidad"),
    )
    
    query = aplicar_filtros_dashboard(
        query,
        filtros
    )

    query = query.filter(RequirementSLA.Usuario_Resolutor.isnot(None),resolutor != "",)

    #Top 10
    return (query.group_by(resolutor).order_by(func.count(RequirementSLA.Ticket_ID).desc(),resolutor,).limit(10).all())

  
    
    


# Distribución por Condición Día
def obtener_distribucion_condicion_dia(
    db: Session,
    filtros: RequirementSLADashboardFilters
):

    # CONSULTA DE DISTRIBUCION
    query = db.query(
        RequirementSLA.Condicion_dia.label("condicion_dia"),

        func.count(
            RequirementSLA.Ticket_ID
        ).label("tickets")
    )

    # APLICAR FILTROS DEL DASHBOARD
    query = aplicar_filtros_dashboard(
        query,
        filtros
    )

    # CONDICIONES VALIDAS
    query = query.filter(
        RequirementSLA.Condicion_dia.in_([
            "Lun-Vie",
            "Fuera Horario",
            "Fin Sem."
        ])
    )

    # AGRUPAR POR CONDICION DIA
    return (
        query
        .group_by(
            RequirementSLA.Condicion_dia
        )
        .all()
    )



# Porcentaje de Cumplimiento de SLA
def obtener_porcentaje_cumplimiento_sla(
    db: Session,
    filtros: RequirementSLADashboardFilters
):

    query = db.query(
        RequirementSLA.SLA_Solucion_Condicion.label("condicion"),
        func.count(RequirementSLA.Ticket_ID).label("tickets")
    )

    query = aplicar_filtros_dashboard(
        query,
        filtros
    )

    return (
        query.group_by(RequirementSLA.SLA_Solucion_Condicion).all()
    )
 
    
    

# Cumplimiento de SLA por Horario - Condición Día
def obtener_cumplimiento_sla_horario(
    db: Session,
    filtros: RequirementSLADashboardFilters
):

    query = db.query(
        RequirementSLA.Condicion_dia.label("condicion_dia"),
        func.count(RequirementSLA.Ticket_ID).label("total_tickets"),
        func.sum(case((RequirementSLA.SLA_Solucion_Condicion== "Cumplido",1),else_=0)).label("cumplidos"),
        func.sum(case((RequirementSLA.SLA_Solucion_Condicion== "No cumplido",1),else_=0)).label("incumplidos"),
        func.sum(case((RequirementSLA.SLA_Solucion_Condicion== "Medición cancelada",1),else_=0)).label("cancelados")
    )

    query = aplicar_filtros_dashboard(
        query,
        filtros
    )

    query = query.filter(
        RequirementSLA.Condicion_dia.in_([
            "Lun-Vie",
            "Fuera Horario",
            "Fin Sem."
        ])
    )

    return (query.group_by(RequirementSLA.Condicion_dia).all())


# Cumplimiento de SLA por Prioridad
def obtener_cumplimiento_sla_prioridad(
    db: Session,
    filtros: RequirementSLADashboardFilters
):

    query = db.query(

        RequirementSLA.Prioridad.label("prioridad"),
        func.count(RequirementSLA.Ticket_ID).label("total_tickets"),

        func.sum(
            case(
                (
                    RequirementSLA.SLA_Solucion_Condicion
                    == "Cumplido",
                    1
                ),
                else_=0
            )
        ).label("cumplidos"),

        func.sum(
            case(
                (
                    RequirementSLA.SLA_Solucion_Condicion
                    == "No cumplido",
                    1
                ),
                else_=0
            )
        ).label("incumplidos"),

        func.sum(
            case(
                (
                    RequirementSLA.SLA_Solucion_Condicion
                    == "Medición cancelada",
                    1
                ),
                else_=0
            )
        ).label("cancelados")
    )

    query = aplicar_filtros_dashboard(
        query,
        filtros
    )

    query = query.filter(
        RequirementSLA.Prioridad.in_([
            "P1",
            "P2",
            "P3",
            "P4"
        ])
    )

    return (
        query
        .group_by(
            RequirementSLA.Prioridad
        )
        .order_by(
            RequirementSLA.Prioridad
        )
        .all()
    )


# Top 10 - Cumplimiento de SLA por Categoría
def obtener_top10_cumplimiento_sla_categoria(
    db: Session,
    filtros: RequirementSLADashboardFilters
):

    categoria_col = func.coalesce(
        func.nullif(func.trim(RequirementSLA.Categorizacion_Categoria),""),"Sin categoría"
    )

    query_base = db.query(
        categoria_col.label("categoria"),
        RequirementSLA.Ticket_ID.label("ticket_id"),
        RequirementSLA.SLA_Solucion_Condicion.label("sla_solucion_condicion")
    )

    query_base = aplicar_filtros_dashboard(
        query_base,
        filtros
    )

    datos = query_base.subquery()

    query = db.query(
        datos.c.categoria.label("categoria"),
        func.count(datos.c.ticket_id).label("total_tickets"),
        func.sum(case((datos.c.sla_solucion_condicion== "Cumplido",1),else_=0)).label("cumplidos"),
        func.sum(case((datos.c.sla_solucion_condicion== "No cumplido",1),else_=0)).label("incumplidos"),
        func.sum(case((datos.c.sla_solucion_condicion== "Medición cancelada",1),else_=0)).label("cancelados")
    )

    return (
        query.group_by(datos.c.categoria).order_by(func.count(datos.c.ticket_id).desc(),datos.c.categoria.asc()).limit(10).all()
    )


# Cumplimiento de SLA por Tipo
def obtener_cumplimiento_sla_tipo(
    db: Session,
    filtros: RequirementSLADashboardFilters,
    limite: int | None = None
):
    tipo_limpio = func.trim(RequirementSLA.Categorizacion_Tipo)
    tipo_nombre = func.coalesce(func.nullif(tipo_limpio, ""),"Sin tipo")

    query_base = db.query(
        tipo_nombre.label("tipo_nombre"),
        RequirementSLA.Ticket_ID.label("ticket_id"),
        RequirementSLA.SLA_Solucion_Condicion.label("sla_solucion_condicion")
    )

    query_base = aplicar_filtros_dashboard(
        query_base,
        filtros
    )

    datos = query_base.subquery()

    tipo_normalizado = func.lower(datos.c.tipo_nombre)

    query = db.query(
        func.min(datos.c.tipo_nombre).label("tipo_requerimiento"),
        func.count(datos.c.ticket_id).label("total_tickets"),
        func.sum(case((datos.c.sla_solucion_condicion== "Cumplido",1),else_=0)).label("cumplidos"),
        func.sum(case((datos.c.sla_solucion_condicion== "No cumplido",1),else_=0)).label("incumplidos"),
        func.sum(case((datos.c.sla_solucion_condicion== "Medición cancelada",1),else_=0)).label("cancelados")
    )

    query = (
        query
        .group_by(tipo_normalizado)
        .order_by(
            func.count(
                datos.c.ticket_id
            ).desc(),
            tipo_normalizado.asc()
        )
    )

    if limite is not None:
        query = query.limit(limite)

    return query.all()


# Análisis de Pareto de Incumplimientos por Categoría
def obtener_pareto_sla_categorias(
    db: Session,
    filtros: RequirementSLADashboardFilters
):
    categoria_col = func.coalesce(
        func.nullif(func.trim(RequirementSLA.Categorizacion_Categoria),""),"Sin categoría"
    )

    query_base = db.query(
        categoria_col.label("categoria"),
        RequirementSLA.Ticket_ID.label("ticket_id"),
        RequirementSLA.SLA_Solucion_Condicion.label("sla_solucion_condicion")
    )

    query_base = aplicar_filtros_dashboard(
        query_base,
        filtros
    )

    datos = query_base.subquery()

    query = db.query(
        datos.c.categoria.label("categoria"),
        func.count(datos.c.ticket_id).label("total_tickets"),
        func.sum(case((datos.c.sla_solucion_condicion== "Cumplido",1),else_=0)).label("cumplidos"),
        func.sum(case((datos.c.sla_solucion_condicion== "No cumplido",1),else_=0)).label("incumplidos"),
        func.sum(case((datos.c.sla_solucion_condicion== "Medición cancelada",1),else_=0)).label("cancelados")
    )

    return (
        query.group_by(datos.c.categoria).order_by(
            func.sum(case((datos.c.sla_solucion_condicion== "No cumplido",1),else_=0)).desc(),datos.c.categoria.asc()).all()
    )



#Home 
def contar_incumplimientos(db: Session):
    return (
        db.query(func.count())
        .select_from(RequirementSLA)
        .filter(RequirementSLA.SLA_Solucion_Condicion == "No cumplido")
        .scalar() or 0
    )
    
def obtener_incumplimientos_por_proyecto(db: Session):
    return (
        db.query(RequirementSLA.Proyecto.label("proyecto"),func.count().label("incumple"),)
        .filter(RequirementSLA.SLA_Solucion_Condicion == "No cumplido")
        .group_by(RequirementSLA.Proyecto)
        .all()
    )
    
    

# TABLA PAGINADA - DETALLE DE TICKETS REQUERIMIENTOS SLA
def obtener_tickets(
    db: Session,
    filtros: RequirementSLADashboardFilters,
    pagina: int = 1,
    tamano: int = 10
):

    # 1. CONTAR LOS TICKETS QUE CUMPLEN LOS FILTROS
    consulta_total = db.query(
        func.count(RequirementSLA.Ticket_ID)
    )

    consulta_total = aplicar_filtros_dashboard(
        consulta_total,
        filtros
    )

    total = consulta_total.scalar() or 0

    # 2. CALCULAR DESPLAZAMIENTO
    inicio = (pagina - 1) * tamano

    # 3. CONSULTAR TODAS LAS COLUMNAS DEL MODELO
    consulta = db.query(
        *RequirementSLA.__table__.columns
    )

    # 4. APLICAR LOS FILTROS DEL DASHBOARD
    consulta = aplicar_filtros_dashboard(
        consulta,
        filtros
    )

    # 5. ORDENAR Y PAGINAR DESDE SQL SERVER
    consulta = (
        consulta
        .order_by(
            RequirementSLA.Fecha_Creacion.desc(),
            RequirementSLA.Ticket_ID.desc()
        )
        .offset(inicio)
        .limit(tamano)
    )

    # 6. OBTENER LOS REGISTROS DE LA PAGINA
    resultados = consulta.all()

    tickets = [
        dict(row._mapping)
        for row in resultados
    ]

    return {
        "tickets": tickets,
        "total": total
    }
