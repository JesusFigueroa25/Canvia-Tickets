from datetime import date, timedelta

import pandas as pd
from sqlalchemy import (Date, Integer, case, cast, delete, func,insert,select,)
from sqlalchemy.orm import Session
from app.models.requirement_consolidated_model import (RequirementConsolidated,stg_requirement_consolidated_table,)
from app.schemas.consolidated_import_schema import RequirementConsolidatedDashboardFilters
from app.models.tickets_manual_updates import TicketsManualUpdate

# UTILIDAD
def _dataframe_a_registros(df: pd.DataFrame):
    df_sql = df.copy()
    df_sql = df_sql.astype(object).where(pd.notna(df_sql), None)
    return df_sql.to_dict(orient="records")

# STAGING
def limpiar_staging(db: Session):
    db.execute(delete(stg_requirement_consolidated_table))

def cargar_staging(db: Session,df: pd.DataFrame):
    columnas_staging = [
        columna.name
        for columna
        in stg_requirement_consolidated_table.columns
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
            db.execute(insert(stg_requirement_consolidated_table),lote)

    return len(registros)

# CONSULTAS
def obtener_staging(db: Session):
    consulta = select(stg_requirement_consolidated_table)
    return pd.read_sql(consulta,db.connection())

def obtener_oficial(db: Session):
    columnas = [
        RequirementConsolidated.__table__.c[columna.name]
        for columna in stg_requirement_consolidated_table.columns
    ]
    consulta = (
        select(*columnas)
        .select_from(
            RequirementConsolidated.__table__.join(
                stg_requirement_consolidated_table,
                RequirementConsolidated.Ticket_ID == stg_requirement_consolidated_table.c.Ticket_ID
            )
        )
    )
    return pd.read_sql(consulta,db.connection())

# INSERT
def insertar_nuevos(db: Session,df: pd.DataFrame):
    if df.empty:
        return 0
    registros = _dataframe_a_registros(df)
    db.execute(insert(RequirementConsolidated.__table__), registros)
    return len(registros)

# UPDATE
def actualizar_modificados(db: Session,df: pd.DataFrame):
    if df.empty:
        return 0
    registros = _dataframe_a_registros(df)
    db.bulk_update_mappings(RequirementConsolidated, registros)
    return len(registros)

def contar_total(db: Session):
    return db.query(func.count()).select_from(RequirementConsolidated).scalar() or 0

#-------------------------------------------------------------

#Metodos globales

# Normalizar proyecto de SQL Server
def normalizar_proyecto(modelo=RequirementConsolidated):
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


# Aplicar filtros del dashboard
def aplicar_filtros_dashboard(
    consulta,
    filtros: RequirementConsolidatedDashboardFilters
):
    # Fecha desde
    if filtros.desde:
        consulta = consulta.where(
            RequirementConsolidated.Fecha_Apertura >= filtros.desde
        )

    # Fecha hasta
    if filtros.hasta:
        consulta = consulta.where(
            RequirementConsolidated.Fecha_Apertura <
            filtros.hasta + timedelta(days=1)
        )

    # Prioridad
    if filtros.prioridad:
        consulta = consulta.where(
            RequirementConsolidated.Prioridad == filtros.prioridad
        )

    # Motivo de estado
    if filtros.motivo_estado:
        consulta = consulta.where(
            RequirementConsolidated.Motivo_Estado == filtros.motivo_estado
        )

    # Motivo de resolución
    if filtros.motivo_resolucion:
        consulta = consulta.where(
            RequirementConsolidated.Motivo_Resolucion ==
            filtros.motivo_resolucion
        )

    # Grupo resolutor
    if filtros.grupo_resolutor:
        consulta = consulta.where(
            func.trim(
                RequirementConsolidated.Grupo_Resolutor
            ) == filtros.grupo_resolutor
        )

    # Proyecto individual
    if filtros.proyecto is not None and filtros.proyecto.strip():
        consulta = consulta.where(
            normalizar_proyecto() == filtros.proyecto.strip()
        )

    # NUEVO: Proyectos excluidos
    excluidos = normalizar_proyectos_excluidos(
        filtros.proyectos_excluidos
    )

    if excluidos:
        consulta = consulta.where(
            normalizar_proyecto().notin_(excluidos)
        )

    # Filtro dinámico por mes
    if filtros.periodo:
        inicio_mes, fin_mes = obtener_rango_periodo(
            filtros.periodo
        )

        consulta = consulta.where(
            RequirementConsolidated.Fecha_Apertura >= inicio_mes,
            RequirementConsolidated.Fecha_Apertura < fin_mes
        )

    # Filtro dinámico por varios tipos
    tipos = normalizar_tipos_requerimiento(
        filtros.tipo_requerimiento
    )

    if tipos:
        consulta = consulta.where(
            func.lower(
                normalizar_tipo_requerimiento()
            ).in_(tipos)
        )
        

    # FILTRO DINAMICO POR TICKET ID
    if filtros.ticket_id and filtros.ticket_id.strip():

        consulta = consulta.where(
            RequirementConsolidated.Ticket_ID ==
            filtros.ticket_id.strip()
        )


    return consulta


# Normalizar lista de tipos seleccionados
def normalizar_tipos_requerimiento(tipos_requerimiento):
    if tipos_requerimiento is None:
        return []

    if isinstance(tipos_requerimiento, str):
        tipos_requerimiento = [tipos_requerimiento]

    resultado = []
    vistos = set()

    for valor in tipos_requerimiento:
        if not isinstance(valor, str):
            continue

        limpio = valor.strip()

        if not limpio:
            continue

        clave = limpio.lower()

        if clave not in vistos:
            resultado.append(clave)
            vistos.add(clave)

    return resultado


# Normalizar tipo de requerimiento de SQL Server
def normalizar_tipo_requerimiento():
    return func.coalesce(
        func.nullif(
            func.trim(
                RequirementConsolidated.Categorizacion_Nivel_3
            ),
            ""
        ),
        "Sin especificar"
    )


# Obtener inicio y fin del mes seleccionado
def obtener_rango_periodo(periodo: str):
    inicio = date.fromisoformat(f"{periodo}-01")

    if inicio.month == 12:
        fin = date(inicio.year + 1, 1, 1)
    else:
        fin = date(inicio.year, inicio.month + 1, 1)

    return inicio, fin



def obtener_kpis(
    db: Session,
    filtros: RequirementConsolidatedDashboardFilters
):
    proyecto_col = func.nullif(
        func.trim(RequirementConsolidated.Proyecto),
        ""
    )

    consulta = (
        select(
            func.count().label("total_tickets"),

            func.count(
                func.distinct(proyecto_col)
            ).label("total_proyectos"),

            func.sum(
                case(
                    (
                        RequirementConsolidated.Prioridad.in_(
                            ["1-Critical"]
                        ),
                        1
                    ),
                    else_=0
                )
            ).label("alta_criticidad")
        )
        .select_from(RequirementConsolidated)
    )

    consulta = aplicar_filtros_dashboard(
        consulta,
        filtros
    )

    return db.execute(consulta).mappings().one()



def obtener_opciones_filtros(db: Session):
    consulta_fechas = select(
        func.min(RequirementConsolidated.Fecha_Apertura).label("fecha_min"),
        func.max(RequirementConsolidated.Fecha_Apertura).label("fecha_max"),
    )

    fechas = db.execute(consulta_fechas).mappings().one()

    def obtener_opciones(columna):
        valor = func.trim(columna)

        consulta = (
            select(valor)
            .where(columna.isnot(None),valor != "")
            .distinct()
            .order_by(valor)
        )

        return db.execute(consulta).scalars().all()

    return {
        "fecha_min": fechas["fecha_min"],
        "fecha_max": fechas["fecha_max"],
        "prioridades": obtener_opciones(RequirementConsolidated.Prioridad),
        "motivos_estado": obtener_opciones(RequirementConsolidated.Motivo_Estado),
        "motivos_resolucion": obtener_opciones(RequirementConsolidated.Motivo_Resolucion),
        "grupos_resolutores": obtener_opciones(RequirementConsolidated.Grupo_Resolutor),
        "proyectos": obtener_opciones(RequirementConsolidated.Proyecto),
    }    
    
    
    
#-------------------------------------------------------------

#Volumen Mensual de Requerimientos
def obtener_volumen_mensual(
    db: Session,
    filtros: RequirementConsolidatedDashboardFilters
):
    anio = func.year(
        RequirementConsolidated.Fecha_Apertura
    )

    mes = func.month(
        RequirementConsolidated.Fecha_Apertura
    )

    consulta = (
        select(
            anio.label("anio"),
            mes.label("mes"),
            func.count().label("tickets")
        )
        .select_from(RequirementConsolidated)
        .where(
            RequirementConsolidated.Fecha_Apertura.isnot(None)
        )
        .group_by(anio, mes)
        .order_by(anio, mes)
    )

    consulta = aplicar_filtros_dashboard(
        consulta,
        filtros
    )

    return db.execute(consulta).all()



# Explorador por Proyectos
def obtener_proyectos(
    db: Session,
    filtros: RequirementConsolidatedDashboardFilters
):
    proyecto_col = normalizar_proyecto()

    consulta_base = (
        select(
            proyecto_col.label("proyecto")
        )
        .select_from(RequirementConsolidated)
    )

    consulta_base = aplicar_filtros_dashboard(
        consulta_base,
        filtros
    )

    datos = consulta_base.subquery()

    consulta = (
        select(
            datos.c.proyecto,
            func.count().label("cantidad")
        )
        .select_from(datos)
        .group_by(datos.c.proyecto)
        .order_by(
            func.count().desc(),
            datos.c.proyecto.asc()
        )
    )

    return db.execute(consulta).mappings().all()


#Distribución por Tipo de Requerimiento
def obtener_tipos(
    db: Session,
    filtros: RequirementConsolidatedDashboardFilters,
    limite: int = 10
):
    tipo = normalizar_tipo_requerimiento()

    consulta_base = (
        select(
            tipo.label("tipo")
        )
        .select_from(RequirementConsolidated)
    )

    consulta_base = aplicar_filtros_dashboard(
        consulta_base,
        filtros
    )

    datos = consulta_base.subquery()

    tipo_normalizado = func.lower(
        datos.c.tipo
    )

    consulta = (
        select(
            func.min(
                datos.c.tipo
            ).label("tipo_requerimiento"),

            func.count().label("cantidad")
        )
        .select_from(datos)
        .group_by(tipo_normalizado)
        .order_by(
            func.count().desc(),
            func.min(datos.c.tipo).asc()
        )
        .limit(limite)
    )

    return db.execute(consulta).mappings().all()


# Distribución por Prioridad
def obtener_prioridades(
    db: Session,
    filtros: RequirementConsolidatedDashboardFilters
):
    prioridad_col = func.coalesce(
        func.nullif(
            func.trim(RequirementConsolidated.Prioridad),
            ""
        ),
        "Sin especificar"
    )

    consulta_base = (
        select(
            prioridad_col.label("prioridad")
        )
        .select_from(RequirementConsolidated)
    )

    consulta_base = aplicar_filtros_dashboard(
        consulta_base,
        filtros
    )

    datos = consulta_base.subquery()

    consulta = (
        select(
            datos.c.prioridad,
            func.count().label("cantidad")
        )
        .select_from(datos)
        .group_by(datos.c.prioridad)
        .order_by(
            func.count().desc(),
            datos.c.prioridad.asc()
        )
    )

    return db.execute(consulta).mappings().all()



# Top 10: Tickets por Proyecto y Mes
def obtener_top_proyectos_mensual(
    db: Session,
    filtros: RequirementConsolidatedDashboardFilters
):
    anio = func.year(
        RequirementConsolidated.Fecha_Apertura
    )

    mes = func.month(
        RequirementConsolidated.Fecha_Apertura
    )

    proyecto_col = normalizar_proyecto()

    consulta_base = (
        select(
            proyecto_col.label("proyecto"),
            anio.label("anio"),
            mes.label("mes")
        )
        .select_from(RequirementConsolidated)
        .where(
            RequirementConsolidated.Fecha_Apertura.isnot(None)
        )
    )

    consulta_base = aplicar_filtros_dashboard(
        consulta_base,
        filtros
    )

    datos = consulta_base.subquery()

    consulta = (
        select(
            datos.c.proyecto,
            datos.c.anio,
            datos.c.mes,
            func.count().label("tickets")
        )
        .select_from(datos)
        .group_by(
            datos.c.proyecto,
            datos.c.anio,
            datos.c.mes
        )
        .order_by(
            datos.c.anio,
            datos.c.mes,
            datos.c.proyecto
        )
    )

    return db.execute(consulta).mappings().all()



# N.º de Requerimientos por Prioridad
def obtener_prioridad_mensual(
    db: Session,
    filtros: RequirementConsolidatedDashboardFilters
):
    anio = func.year(
        RequirementConsolidated.Fecha_Apertura
    )

    mes = func.month(
        RequirementConsolidated.Fecha_Apertura
    )

    prioridad_col = func.coalesce(
        func.nullif(
            func.trim(RequirementConsolidated.Prioridad),
            ""
        ),
        "Sin especificar"
    )

    consulta_base = (
        select(
            anio.label("anio"),
            mes.label("mes"),
            prioridad_col.label("prioridad")
        )
        .select_from(RequirementConsolidated)
        .where(
            RequirementConsolidated.Fecha_Apertura.isnot(None)
        )
    )

    consulta_base = aplicar_filtros_dashboard(
        consulta_base,
        filtros
    )

    datos = consulta_base.subquery()

    consulta = (
        select(
            datos.c.anio,
            datos.c.mes,
            datos.c.prioridad,
            func.count().label("cantidad")
        )
        .select_from(datos)
        .group_by(
            datos.c.anio,
            datos.c.mes,
            datos.c.prioridad
        )
        .order_by(
            datos.c.anio,
            datos.c.mes
        )
    )

    return db.execute(consulta).mappings().all()


# TABLA PAGINADA - DETALLE DE TICKETS REQUERIMIENTOS CONSOLIDADOS

def obtener_tickets(
    db: Session,
    filtros: RequirementConsolidatedDashboardFilters,
    pagina: int = 1,
    tamano: int = 10
):

    # 1. CONTAR LOS TICKETS QUE CUMPLEN LOS FILTROS
    consulta_total = (
        select(func.count())
        .select_from(RequirementConsolidated)
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
        select(*RequirementConsolidated.__table__.columns)
        .select_from(RequirementConsolidated)
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
            RequirementConsolidated.Fecha_Apertura.desc(),
            RequirementConsolidated.Ticket_ID.desc()
        )
        .offset(inicio)
        .limit(tamano)
    )

    # 6. OBTENER SOLO LOS REGISTROS DE LA PAGINA
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



# INDICADORES PRODUCTIVIDAD - REQUERIMIENTOS CONSOLIDADOS

def obtener_productividad_proyectos(db: Session, filtros: RequirementConsolidatedDashboardFilters, limite_grafico: int = 10):
    proyecto = normalizar_proyecto()
    resolutor = func.nullif(func.trim(RequirementConsolidated.Nombre_Resolutor), "")
    consulta_base = select(
        RequirementConsolidated.Ticket_ID.label("ticket_id"),
        proyecto.label("proyecto"),
        resolutor.label("resolutor"),
        cast(RequirementConsolidated.Fecha_Apertura, Date).label("fecha"),
    ).select_from(RequirementConsolidated)
    datos = aplicar_filtros_dashboard(consulta_base, filtros).subquery()

    consulta_resumen = (
        select(
            datos.c.proyecto,
            func.count(func.distinct(datos.c.ticket_id)).label("total_tickets"),
            func.count(func.distinct(datos.c.resolutor)).label("resolutores_distintos"),
        )
        .group_by(datos.c.proyecto)
        .order_by(func.count(func.distinct(datos.c.ticket_id)).desc(), datos.c.proyecto)
    )
    proyectos = [dict(fila) for fila in db.execute(consulta_resumen).mappings().all()]
    rango = db.execute(select(func.min(datos.c.fecha), func.max(datos.c.fecha))).one()

    seleccionados = [fila["proyecto"] for fila in proyectos[:limite_grafico]]
    diarios = []
    if seleccionados:
        consulta_diaria = (
            select(
                datos.c.proyecto,
                datos.c.fecha,
                func.count(func.distinct(datos.c.ticket_id)).label("tickets"),
            )
            .where(datos.c.proyecto.in_(seleccionados))
            .group_by(datos.c.proyecto, datos.c.fecha)
            .order_by(datos.c.fecha, datos.c.proyecto)
        )
        diarios = [dict(fila) for fila in db.execute(consulta_diaria).mappings().all()]

    return {
        "proyectos": proyectos,
        "diarios": diarios,
        "fecha_min": rango[0],
        "fecha_max": rango[1],
    }


def obtener_dotacion_resolutores(db: Session, filtros: RequirementConsolidatedDashboardFilters):
    modelo = RequirementConsolidated
    resolutor = func.nullif(func.trim(modelo.Nombre_Resolutor), "")
    base = select(
        modelo.Ticket_ID.label("ticket_id"),
        normalizar_proyecto().label("proyecto"),
        resolutor.label("resolutor"),
        func.year(modelo.Fecha_Apertura).label("anio"),
        func.month(modelo.Fecha_Apertura).label("mes"),
    ).select_from(modelo)
    datos = aplicar_filtros_dashboard(base, filtros).subquery()

    consulta = (
        select(
            datos.c.anio,
            datos.c.mes,
            datos.c.proyecto,
            datos.c.resolutor,
            func.count(func.distinct(datos.c.ticket_id)).label("tickets"),
        )
        .group_by(datos.c.anio, datos.c.mes, datos.c.proyecto, datos.c.resolutor)
        .order_by(datos.c.anio, datos.c.mes, datos.c.proyecto, datos.c.resolutor)
    )
    return [dict(fila) for fila in db.execute(consulta).mappings().all()]


# ===============================================================
# ALCANCE 3 - ATENCIÓN PARALELA (SOLO CONSOLIDADOS)
# ===============================================================
def obtener_atencion_paralela(
    db: Session,
    filtros: RequirementConsolidatedDashboardFilters,
    fecha_inicio=None,
    fecha_fin_exclusiva=None,
    resolutor: str | None = None,
):
    """Obtiene intervalos válidos que intersectan el período solicitado.

    Las fechas y ticket_id no se aplican como filtros de apertura:
    necesitamos incluir tickets abiertos antes del período y otros
    tickets del mismo resolutor para comprobar coincidencias.
    """
    modelo = RequirementConsolidated
    resolutor_limpio = func.nullif(func.trim(modelo.Nombre_Resolutor), "")
    proyecto_limpio = normalizar_proyecto()

    consulta = select(
        modelo.Ticket_ID.label("ticket_id"),
        proyecto_limpio.label("proyecto"),
        resolutor_limpio.label("resolutor"),
        modelo.Fecha_Apertura.label("fecha_apertura"),
        modelo.Fecha_Resolucion.label("fecha_resolucion"),
    ).select_from(modelo)

    filtros_sin_fechas = filtros.model_copy(update={
        "desde": None,
        "hasta": None,
        "periodo": None,
        "ticket_id": None,
    })
    consulta = aplicar_filtros_dashboard(consulta, filtros_sin_fechas)
    consulta = consulta.where(
        resolutor_limpio.isnot(None),
        modelo.Fecha_Resolucion.isnot(None),
        modelo.Fecha_Resolucion > modelo.Fecha_Apertura,
    )

    if fecha_inicio is not None:
        consulta = consulta.where(modelo.Fecha_Resolucion > fecha_inicio)
    if fecha_fin_exclusiva is not None:
        consulta = consulta.where(modelo.Fecha_Apertura < fecha_fin_exclusiva)
    if resolutor and resolutor.strip():
        consulta = consulta.where(
            func.lower(resolutor_limpio) == resolutor.strip().lower()
        )

    consulta = consulta.order_by(
        resolutor_limpio, modelo.Fecha_Apertura, modelo.Ticket_ID
    )
    return db.execute(consulta).mappings().all()



# ============================================================
# ALCANCE 4 - ACTUALIZACIONES MANUALES
# ============================================================



def obtener_actualizaciones_manuales(
    db: Session,
    filtros: RequirementConsolidatedDashboardFilters,
    pagina: int = 1,
    tamano: int = 25,
    limite_grafico: int = 10,
    resolutor: str | None = None
):
    """
    Obtiene el ranking de resolutores asignados a tickets
    presentes en el reporte de modificaciones manuales.

    - Solo Service Request.
    - JOIN por Ticket_ID con requirement_consolidated.
    - Filtros globales sobre requirement_consolidated.
    - Datos de resolutor y grupo desde tickets_manual_updates.
    - Conteos de Ticket_ID distintos.
    - Paginación ejecutada en SQL Server.
    """

    manual = TicketsManualUpdate
    consolidado = RequirementConsolidated

    nombre_original = func.nullif(
        func.trim(manual.Nombre_Resolutor),
        ""
    )

    grupo_original = func.nullif(
        func.trim(manual.Grupo_Resolutor),
        ""
    )

    # --------------------------------------------------------
    # 1. BASE DE TICKETS RELACIONADOS
    # --------------------------------------------------------

    consulta_base = (
        select(
            manual.Ticket_ID.label("ticket_id"),
            nombre_original.label("resolutor_original"),
            grupo_original.label("grupo_original"),
            normalizar_proyecto().label("proyecto")
        )
        .select_from(manual)
        .join(
            consolidado,
            consolidado.Ticket_ID == manual.Ticket_ID
        )
        .where(
            func.lower(
                func.trim(manual.Ticket_type)
            ) == "service request"
        )
    )

    # Reutilizamos todos los filtros del dashboard:
    # fechas, prioridad, motivo_estado, motivo_resolucion,
    # grupo_resolutor, proyecto, período, tipos y exclusiones.
    consulta_base = aplicar_filtros_dashboard(
        consulta_base,
        filtros
    )

    # --------------------------------------------------------
    # 2. FILTRO OPCIONAL POR RESOLUTOR DEL EXCEL
    # --------------------------------------------------------

    if resolutor and resolutor.strip():

        nombre_filtro = resolutor.strip()

        if nombre_filtro.casefold() == "sin especificar":
            consulta_base = consulta_base.where(
                nombre_original.is_(None)
            )
        else:
            consulta_base = consulta_base.where(
                func.lower(nombre_original)
                == nombre_filtro.lower()
            )

    datos = consulta_base.subquery()

    resolutor_normalizado = func.coalesce(
        datos.c.resolutor_original,
        "Sin especificar"
    )

    grupo_normalizado = func.coalesce(
        datos.c.grupo_original,
        "Sin especificar"
    )

    # --------------------------------------------------------
    # 3. RESUMEN GENERAL
    # --------------------------------------------------------

    consulta_resumen = select(

        func.count(
            func.distinct(datos.c.ticket_id)
        ).label("total_tickets"),

        func.count(
            func.distinct(
                func.lower(datos.c.resolutor_original)
            )
        ).label("total_resolutores"),

        func.count(
            func.distinct(
                func.lower(datos.c.grupo_original)
            )
        ).label("total_grupos"),

        func.count(
            func.distinct(datos.c.proyecto)
        ).label("total_proyectos"),

        func.count(
            func.distinct(
                case(
                    (
                        datos.c.resolutor_original.is_(None),
                        datos.c.ticket_id
                    ),
                    else_=None
                )
            )
        ).label("tickets_sin_resolutor")
    )

    resumen = dict(
        db.execute(
            consulta_resumen
        ).mappings().one()
    )

    # --------------------------------------------------------
    # 4. AGRUPAR POR GRUPO Y RESOLUTOR
    # --------------------------------------------------------

    agrupacion = (
        select(
            grupo_normalizado.label("grupo_resolutor"),
            resolutor_normalizado.label("resolutor"),

            func.count(
                func.distinct(datos.c.ticket_id)
            ).label("tickets"),

            func.count(
                func.distinct(datos.c.proyecto)
            ).label("proyectos")
        )
        .group_by(
            datos.c.grupo_original,
            datos.c.resolutor_original
        )
        .subquery()
    )


    # --------------------------------------------------------
    # 5. TOTAL DE FILAS PARA PAGINACIÓN
    # --------------------------------------------------------

    total = int(
        db.execute(
            select(func.count())
            .select_from(agrupacion)
        ).scalar_one()
    )

    # --------------------------------------------------------
    # 6. ORDENAMIENTO COMPARTIDO
    # --------------------------------------------------------

    orden = (
        agrupacion.c.tickets.desc(),
        agrupacion.c.grupo_resolutor.asc(),
        agrupacion.c.resolutor.asc()
    )

    # --------------------------------------------------------
    # 7. GRÁFICO TOP N
    # --------------------------------------------------------

    consulta_grafico = (
        select(agrupacion)
        .order_by(*orden)
        .limit(limite_grafico)
    )

    grafico = [
        dict(fila)
        for fila in db.execute(
            consulta_grafico
        ).mappings().all()
    ]

    # --------------------------------------------------------
    # 8. TABLA PAGINADA
    # --------------------------------------------------------

    desplazamiento = (pagina - 1) * tamano

    consulta_tabla = (
        select(agrupacion)
        .order_by(*orden)
        .offset(desplazamiento)
        .limit(tamano)
    )

    items = [
        dict(fila)
        for fila in db.execute(
            consulta_tabla
        ).mappings().all()
    ]

    # --------------------------------------------------------
    # 9. RESULTADO
    # --------------------------------------------------------

    return {
        "resumen": resumen,
        "grafico": grafico,
        "items": items,
        "total": total
    }
