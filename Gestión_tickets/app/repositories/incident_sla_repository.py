import pandas as pd
from datetime import date, timedelta
from sqlalchemy import (delete, insert, literal_column, select, func,case,)
from sqlalchemy.orm import Session
from app.schemas.sla_import_schema  import IncidentSLADashboardFilters
from app.models.incident_sla_model import (IncidentSLA,stg_incident_sla_table,)

# UTILIDAD
def _dataframe_a_registros(df: pd.DataFrame):
    df_sql = df.copy()
    df_sql = df_sql.astype(object).where(pd.notna(df_sql), None)
    return df_sql.to_dict(orient="records")
    
# STAGING
def limpiar_staging(db: Session):
    db.execute(delete(stg_incident_sla_table))

def cargar_staging(db: Session, df: pd.DataFrame):
    columnas_staging = [
        columna.name
        for columna in stg_incident_sla_table.columns
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
            db.execute(insert(stg_incident_sla_table),lote)

    return len(registros)

# CONSULTAS
def obtener_staging(db: Session):
    consulta = select(stg_incident_sla_table)
    return pd.read_sql(consulta,db.connection())

#Optimizacion de extracion de datos
def obtener_oficial(db: Session):
    columnas = [
        IncidentSLA.__table__.c[columna.name]
        for columna in stg_incident_sla_table.columns
    ]

    consulta = (
        select(*columnas)
        .select_from(
            IncidentSLA.__table__.join(
                stg_incident_sla_table,
                IncidentSLA.Ticket_ID == stg_incident_sla_table.c.Ticket_ID
            )
        )
    )

    return pd.read_sql(consulta,db.connection())


# INSERT
def insertar_nuevos(db: Session,df: pd.DataFrame):
    if df.empty:
        return 0
    registros = _dataframe_a_registros(df)
    db.execute(insert(IncidentSLA.__table__), registros)
    return len(registros)

# UPDATE
def actualizar_modificados(db: Session,df: pd.DataFrame):
    if df.empty:
        return 0
    registros = _dataframe_a_registros(df)
    db.bulk_update_mappings(IncidentSLA, registros)
    return len(registros)

#--------------------------------------------------------------------------------------------

def obtener_kpis(
    db: Session,
    filtros: IncidentSLADashboardFilters
):
    consulta = select(
        func.count(IncidentSLA.Ticket_ID).label("total_tickets"),
        func.sum(case((IncidentSLA.SLA_Respuesta_Condicion == "Cumplido",1),else_=0)).label("sla_respuesta_cumple"),
        func.sum(case((IncidentSLA.SLA_Respuesta_Condicion.in_(["Cumplido","No cumplido"]),1),else_=0)).label("sla_respuesta_medibles"),
        func.sum(case((IncidentSLA.SLA_Solucion_Condicion == "Cumplido",1),else_=0)).label("sla_solucion_cumple"),
        func.sum(case((IncidentSLA.SLA_Solucion_Condicion.in_(["Cumplido","No cumplido"]),1),else_=0)).label("sla_solucion_medibles"),
        func.sum(case((IncidentSLA.OLA_Respuesta_Condicion == "Cumplido",1),else_=0)).label("ola_respuesta_cumple"),
        func.sum(case((IncidentSLA.OLA_Respuesta_Condicion.in_(["Cumplido","No cumplido"]),1),else_=0)).label("ola_respuesta_medibles"),
        func.sum(case((IncidentSLA.OLA_Solucion_Condicion == "Cumplido",1),else_=0)).label("ola_solucion_cumple"),
        func.sum(case((IncidentSLA.OLA_Solucion_Condicion.in_(["Cumplido","No cumplido"]),1),else_=0)).label("ola_solucion_medibles"),
    )

    consulta = aplicar_filtros_dashboard(
        consulta,
        filtros
    )

    return db.execute(consulta).mappings().one()



def obtener_opciones_filtros(db: Session):

    # RANGO DE FECHAS
    consulta_fechas = select(func.min(IncidentSLA.Fecha_Creacion).label("fecha_min"),func.max(IncidentSLA.Fecha_Creacion).label("fecha_max"))
    fechas = db.execute(consulta_fechas).mappings().one()

    # UTILIDAD: OBTENER VALORES ÚNICOS Y NO VACÍOS
    def obtener_opciones(columna):
        valor = func.trim(columna)
        consulta = (select(valor).where(columna.is_not(None),valor != "").distinct().order_by(valor))
        return db.execute(consulta).scalars().all()

    # FILTROS GENERALES
    grupos = obtener_opciones(IncidentSLA.Grupo_Resolutor)
    prioridades = obtener_opciones(IncidentSLA.Prioridad)

    # FILTROS DINÁMICOS
    proyectos = obtener_opciones(IncidentSLA.Proyecto)
    tipos_incidente = obtener_opciones(IncidentSLA.Categorizacion_Tipo)

    return {
        "fecha_min": fechas["fecha_min"],
        "fecha_max": fechas["fecha_max"],
        "grupos_resolutores": grupos,
        "prioridades": prioridades,
        "proyectos": proyectos,
        "tipos_incidente": tipos_incidente
    }



# Obtener inicio y fin del mes seleccionado
def obtener_rango_periodo(periodo: str):
    inicio = date.fromisoformat(f"{periodo}-01")

    if inicio.month == 12:
        fin = date(inicio.year + 1, 1, 1)
    else:
        fin = date(inicio.year, inicio.month + 1, 1)

    return inicio, fin


# Normalizar nombre de proyecto
def normalizar_proyecto(modelo=IncidentSLA):
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
            resultado.append(nombre)
            vistos.add(clave)

    return resultado




# Filtros compartidos por todos los gráficos
def aplicar_filtros_dashboard(
    consulta,
    filtros: IncidentSLADashboardFilters
):
    # Filtros de fechas
    if filtros.desde:
        consulta = consulta.where(
            IncidentSLA.Fecha_Creacion >= filtros.desde
        )

    if filtros.hasta:
        fecha_fin = filtros.hasta + timedelta(days=1)

        consulta = consulta.where(
            IncidentSLA.Fecha_Creacion < fecha_fin
        )

    # Grupo resolutor
    if filtros.grupo_resolutor:
        consulta = consulta.where(
            IncidentSLA.Grupo_Resolutor == filtros.grupo_resolutor
        )

    # Prioridad
    if filtros.prioridad:
        consulta = consulta.where(
            IncidentSLA.Prioridad == filtros.prioridad
        )

    # Proyecto individual
    if filtros.proyecto and filtros.proyecto.strip():
        consulta = consulta.where(
            normalizar_proyecto() == filtros.proyecto.strip()
        )

    # NUEVO: exclusión múltiple de proyectos
    excluidos = normalizar_proyectos_excluidos(
        filtros.proyectos_excluidos
    )

    if excluidos:
        consulta = consulta.where(
            normalizar_proyecto().notin_(excluidos)
        )

    # Tipos de incidente (selección múltiple)
    tipos = normalizar_tipos_incidente(
        filtros.tipo_incidente
    )

    if tipos:
        consulta = consulta.where(
            func.trim(
                IncidentSLA.Categorizacion_Tipo
            ).in_(tipos)
        )

    # Filtro dinámico por mes
    if filtros.periodo:
        inicio_mes, fin_mes = obtener_rango_periodo(
            filtros.periodo
        )

        consulta = consulta.where(
            IncidentSLA.Fecha_Creacion >= inicio_mes,
            IncidentSLA.Fecha_Creacion < fin_mes
        )
        

    # FILTRO DINAMICO POR TICKET ID
    if filtros.ticket_id and filtros.ticket_id.strip():

        consulta = consulta.where(
            IncidentSLA.Ticket_ID ==
            filtros.ticket_id.strip()
        )


    return consulta

  
# Insights 
# Insights
def obtener_estado_sla(
    db: Session,
    filtros: IncidentSLADashboardFilters
):
    consulta = select(
        func.sum(case((IncidentSLA.SLA_Solucion_Condicion == "Cumplido",1),else_=0)).label("cumple"),
        func.sum(case((IncidentSLA.SLA_Solucion_Condicion.in_(["Cumplido","No cumplido"]),1),else_=0)).label("medibles")
    )

    consulta = aplicar_filtros_dashboard(
        consulta,
        filtros
    )

    return db.execute(consulta).mappings().one()




def obtener_principal_foco(
    db: Session,
    filtros: IncidentSLADashboardFilters
):
    consulta = (
        select(
            IncidentSLA.Proyecto,
            func.count(IncidentSLA.Ticket_ID).label("incumplimientos")
        )
        .where(IncidentSLA.SLA_Solucion_Condicion == "No cumplido")
        .group_by(IncidentSLA.Proyecto)
        .order_by(func.count(IncidentSLA.Ticket_ID).desc())
    )

    consulta = aplicar_filtros_dashboard(
        consulta,
        filtros
    )

    return db.execute(consulta).mappings().all()



def obtener_prioridades_sla(
    db: Session,
    filtros: IncidentSLADashboardFilters
):
    consulta = (
        select(
            IncidentSLA.Prioridad,
            func.sum(case((IncidentSLA.SLA_Solucion_Condicion == "Cumplido",1),else_=0)).label("cumple"),
            func.sum(case((IncidentSLA.SLA_Solucion_Condicion.in_(["Cumplido","No cumplido"]),1),else_=0)).label("medibles")
        )
        .where(IncidentSLA.Prioridad.is_not(None))
        .group_by(IncidentSLA.Prioridad)
    )

    consulta = aplicar_filtros_dashboard(
        consulta,
        filtros
    )

    return db.execute(consulta).mappings().all()


#-------------------------------------


#SLA Solución: Tendencia
def obtener_sla_solucion_tendencia(
    db: Session,
    filtros: IncidentSLADashboardFilters
):
    mes = func.convert(literal_column("VARCHAR(7)"),IncidentSLA.Fecha_Creacion,literal_column("120"))

    consulta = (
        select(
            mes.label("mes"),
            func.sum(case((IncidentSLA.SLA_Solucion_Condicion == "Cumplido",1),else_=0)).label("cumple"),
            func.sum(case((IncidentSLA.SLA_Solucion_Condicion.in_(["Cumplido","No cumplido"]),1),else_=0)).label("medibles")
        )
        .where(IncidentSLA.Fecha_Creacion.is_not(None))
        .group_by(mes)
        .order_by(mes)
    )

    consulta = aplicar_filtros_dashboard(
        consulta,
        filtros
    )

    return db.execute(consulta).mappings().all()


#Volumen de Incidentes
def obtener_volumen_incidentes(
    db: Session,
    filtros: IncidentSLADashboardFilters
):
    mes = func.convert(literal_column("VARCHAR(7)"),IncidentSLA.Fecha_Creacion,literal_column("120"))

    consulta = (
        select(
            mes.label("mes"),
            func.count(IncidentSLA.Ticket_ID).label("tickets")
        )
        .where(IncidentSLA.Fecha_Creacion.is_not(None))
        .group_by(mes)
        .order_by(mes)
    )

    consulta = aplicar_filtros_dashboard(
        consulta,
        filtros
    )

    return db.execute(consulta).mappings().all()


#Explorador por Proyectos
def obtener_explorador_proyectos(
    db: Session,
    filtros: IncidentSLADashboardFilters
):
    consulta = (
        select(
            IncidentSLA.Proyecto,
            func.count(IncidentSLA.Ticket_ID).label("tickets"),

            # SLA SOLUCION - CUMPLE
            func.sum(case((IncidentSLA.SLA_Solucion_Condicion == "Cumplido",1),else_=0)).label("cumple"),

            # SLA SOLUCION - INCUMPLE
            func.sum(case((IncidentSLA.SLA_Solucion_Condicion == "No cumplido",1),else_=0)).label("incumple"),

            # SLA SOLUCION - SIN MEDICION
            func.sum(case((IncidentSLA.SLA_Solucion_Condicion == "Medición cancelada",1),else_=0)).label("sin_medicion"),

            # SLA RESPUESTA - CUMPLE
            func.sum(case((IncidentSLA.SLA_Respuesta_Condicion == "Cumplido",1),else_=0)).label("sla_respuesta_cumple"),

            # SLA RESPUESTA - MEDIBLES
            func.sum(case((IncidentSLA.SLA_Respuesta_Condicion.in_(["Cumplido","No cumplido"]),1),else_=0)).label("sla_respuesta_medibles")
        )
        .group_by(IncidentSLA.Proyecto)
        .order_by(func.count(IncidentSLA.Ticket_ID).desc())
    )

    consulta = aplicar_filtros_dashboard(
        consulta,
        filtros
    )

    return db.execute(consulta).mappings().all()


##Pareto de Tipos de Incidente
def obtener_pareto_tipos(
    db: Session,
    filtros: IncidentSLADashboardFilters
):
    tipo_col = func.trim(
        IncidentSLA.Categorizacion_Tipo
    )

    consulta = (
        select(
            tipo_col.label("tipo_incidente"),
            func.count(
                IncidentSLA.Ticket_ID
            ).label("tickets")
        )
        .group_by(tipo_col)
        .order_by(
            func.count(IncidentSLA.Ticket_ID).desc(),
            tipo_col.asc()
        )
    )

    consulta = aplicar_filtros_dashboard(
        consulta,
        filtros
    )

    return db.execute(consulta).mappings().all()


#Tendencia de Incidentes
def obtener_tendencia_incidentes(
    db: Session,
    tipos,
    filtros: IncidentSLADashboardFilters
):
    tipos = normalizar_tipos_incidente(tipos)

    if not tipos:
        return []

    mes = func.convert(
        literal_column("VARCHAR(7)"),
        IncidentSLA.Fecha_Creacion,
        literal_column("120")
    )

    tipo_col = func.trim(IncidentSLA.Categorizacion_Tipo)

    consulta = (
        select(
            mes.label("mes"),
            tipo_col.label("tipo_incidente"),
            func.count(IncidentSLA.Ticket_ID).label("tickets")
        )
        .where(IncidentSLA.Fecha_Creacion.is_not(None))
        .where(tipo_col.in_(tipos))
        .group_by(mes,tipo_col)
        .order_by(mes,tipo_col)
    )

    # El parámetro 'tipos' ya define los tipos de esta serie.
    # No aplicar una segunda selección de tipos.
    filtros_sin_tipo = filtros.model_copy(
        update={"tipo_incidente": []}
    )

    consulta = aplicar_filtros_dashboard(
        consulta,
        filtros_sin_tipo
    )

    return db.execute(consulta).mappings().all()


#Desempeño por Resolutor
def obtener_desempeno_resolutores(
    db: Session,
    filtros: IncidentSLADashboardFilters
):
    consulta = (
        select(
            IncidentSLA.Usuario_Resolutor.label("resolutor"),
            func.count(IncidentSLA.Ticket_ID).label("tickets"),
            func.sum(case((IncidentSLA.SLA_Solucion_Condicion == "Cumplido",1),else_=0)).label("cumple"),
            func.sum(case((IncidentSLA.SLA_Solucion_Condicion.in_(["Cumplido","No cumplido"]),1),else_=0)).label("medibles")
        )
        .group_by(IncidentSLA.Usuario_Resolutor)
        .order_by(func.count(IncidentSLA.Ticket_ID).desc())
    )

    consulta = aplicar_filtros_dashboard(
        consulta,
        filtros
    )

    return db.execute(consulta).mappings().all()



 
def normalizar_tipos_incidente(tipos_incidente):
    if not tipos_incidente:
        return []

    tipos_normalizados = []

    for tipo in tipos_incidente:
        if not isinstance(tipo, str):
            continue

        tipo_limpio = tipo.strip()
        if (
            tipo_limpio
            and tipo_limpio not in tipos_normalizados
        ):
            tipos_normalizados.append(tipo_limpio)

    return tipos_normalizados


#Home 
def contar_incumplimientos(db: Session):
    return (
        db.query(func.count())
        .select_from(IncidentSLA)
        .filter(IncidentSLA.SLA_Solucion_Condicion == "No cumplido")
        .scalar() or 0
    )
    
def obtener_incumplimientos_por_proyecto(db: Session):
    return (
        db.query(
            IncidentSLA.Proyecto.label("proyecto"),
            func.count().label("incumple"),
        )
        .filter(IncidentSLA.SLA_Solucion_Condicion == "No cumplido")
        .group_by(IncidentSLA.Proyecto)
        .all()
    )    
 
 
 
# TABLA PAGINADA - DETALLE DE TICKETS INCIDENTES SLA
def obtener_tickets(
    db: Session,
    filtros: IncidentSLADashboardFilters,
    pagina: int = 1,
    tamano: int = 10
):

    # 1. CONTAR LOS TICKETS QUE CUMPLEN LOS FILTROS
    consulta_total = (
        select(func.count())
        .select_from(IncidentSLA)
    )

    consulta_total = aplicar_filtros_dashboard(
        consulta_total,
        filtros
    )

    total = db.execute(
        consulta_total
    ).scalar_one()

    # 2. CALCULAR DESPLAZAMIENTO
    inicio = (pagina - 1) * tamano

    # 3. OBTENER TODAS LAS COLUMNAS DEL MODELO
    consulta = (
        select(*IncidentSLA.__table__.columns)
        .select_from(IncidentSLA)
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
            IncidentSLA.Fecha_Creacion.desc(),
            IncidentSLA.Ticket_ID.desc()
        )
        .offset(inicio)
        .limit(tamano)
    )

    # 6. OBTENER LOS REGISTROS DE LA PAGINA
    resultados = db.execute(
        consulta
    ).mappings().all()

    tickets = [
        dict(row)
        for row in resultados
    ]

    return {
        "tickets": tickets,
        "total": total
    }
