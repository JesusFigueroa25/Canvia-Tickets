import pandas as pd
from sqlalchemy import (case, delete, func,insert,select,or_)
from sqlalchemy.orm import Session, aliased
from app.models.incident_consolidated_model import (IncidentConsolidated,stg_incident_consolidated_table,)
from sqlalchemy import (func,cast,Integer,UnicodeText,)
from datetime import date, timedelta
from sqlalchemy.dialects.mssql import NVARCHAR
from app.schemas.consolidated_import_schema import (
    IncidentConsolidatedDashboardFilters
)

# UTILIDAD
def _dataframe_a_registros(df: pd.DataFrame):
    df_sql = df.copy()
    df_sql = df_sql.astype(object).where(pd.notna(df_sql), None)
    return df_sql.to_dict(orient="records")

# STAGING
def limpiar_staging(db: Session):
    db.execute(delete(stg_incident_consolidated_table))


def cargar_staging(db: Session,df: pd.DataFrame):
    columnas_staging = [
        columna.name
        for columna in stg_incident_consolidated_table.columns
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
            db.execute(insert(stg_incident_consolidated_table),lote)

    return len(registros)


# CONSULTAS
def obtener_staging(db: Session):
    consulta = select(stg_incident_consolidated_table)
    return pd.read_sql(consulta,db.connection())

def obtener_oficial(db: Session):
    columnas = [
        IncidentConsolidated.__table__.c[columna.name]
        for columna in stg_incident_consolidated_table.columns
    ]
    consulta = (
        select(*columnas)
        .select_from(
            IncidentConsolidated.__table__.join(
                stg_incident_consolidated_table,
                IncidentConsolidated.Ticket_ID == stg_incident_consolidated_table.c.Ticket_ID
            )
        )
    )
    return pd.read_sql(consulta,db.connection())

# INSERT
def insertar_nuevos(db: Session,df: pd.DataFrame):
    if df.empty:
        return 0
    registros = _dataframe_a_registros(df)
    db.execute(insert(IncidentConsolidated.__table__), registros)
    return len(registros)

# UPDATE
def actualizar_modificados(db: Session,df: pd.DataFrame):
    if df.empty:
        return 0
    registros = _dataframe_a_registros(df)
    db.bulk_update_mappings(IncidentConsolidated, registros)
    return len(registros)

#Auxiliares
def contar_total(db: Session):
    return db.query(func.count()).select_from(IncidentConsolidated).scalar() or 0

def normalizar_tipos_incidente(tipos_incidente):
    if tipos_incidente is None:
        return []
    if isinstance(tipos_incidente, str):
        tipos_incidente = [tipos_incidente]

    resultado = []
    vistos = set()
    for valor in tipos_incidente:
        if not isinstance(valor, str):
            continue
        limpio = valor.strip()
        if limpio and limpio not in vistos:
            resultado.append(limpio)
            vistos.add(limpio)
    return resultado


def normalizar_proyectos_excluidos(proyectos):
    if not proyectos:
        return []

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


def normalizar_proyecto(modelo=IncidentConsolidated):
    return func.coalesce(
        func.nullif(
            func.trim(modelo.Proyecto),
            ""
        ),
        "Sin especificar"
    )


def normalizar_tipo_incidente(modelo=IncidentConsolidated):
    return func.coalesce(
        func.nullif(func.trim(modelo.Categorizacion_Nivel_3), ""),
        "Sin especificar"
    )

def normalizar_detalle(modelo=IncidentConsolidated):
    return func.coalesce(
        func.nullif(func.trim(cast(modelo.Detalle, NVARCHAR(None))), ""),
        "Sin especificar"
    )

def obtener_rango_periodo(periodo: str):
    inicio = date.fromisoformat(f"{periodo}-01")
    if inicio.month == 12:
        fin = date(inicio.year + 1, 1, 1)
    else:
        fin = date(inicio.year, inicio.month + 1, 1)
    return inicio, fin


def aplicar_filtros_dashboard(
    consulta,
    filtros: IncidentConsolidatedDashboardFilters
):

    # Fechas
    if filtros.desde:
        consulta = consulta.where(
            IncidentConsolidated.Fecha_Apertura >= filtros.desde
        )

    if filtros.hasta:
        consulta = consulta.where(
            IncidentConsolidated.Fecha_Apertura <
            filtros.hasta + timedelta(days=1)
        )

    # Prioridad
    if filtros.prioridad:
        consulta = consulta.where(
            IncidentConsolidated.Prioridad == filtros.prioridad
        )

    # Motivo de estado
    if filtros.motivo_estado:
        consulta = consulta.where(
            IncidentConsolidated.Motivo_Estado ==
            filtros.motivo_estado
        )

    # Motivo de resolución
    if filtros.motivo_resolucion:
        consulta = consulta.where(
            IncidentConsolidated.Motivo_Resolucion ==
            filtros.motivo_resolucion
        )

    # Grupo resolutor
    if filtros.grupo_resolutor:
        consulta = consulta.where(
            func.trim(
                IncidentConsolidated.Grupo_Resolutor
            ) == filtros.grupo_resolutor
        )

    # Proyecto individual
    if filtros.proyecto and filtros.proyecto.strip():
        consulta = consulta.where(
            normalizar_proyecto() ==
            filtros.proyecto.strip()
        )

    # NUEVO: proyectos excluidos
    excluidos = normalizar_proyectos_excluidos(
        filtros.proyectos_excluidos
    )

    if excluidos:
        consulta = consulta.where(
            normalizar_proyecto().notin_(excluidos)
        )

    # Nombre resolutor
    if filtros.nombre_resolutor and filtros.nombre_resolutor.strip():

        resolutor_col = func.coalesce(
            func.nullif(
                func.trim(IncidentConsolidated.Nombre_Resolutor),
                ""
            ),
            "Sin especificar"
        )

        consulta = consulta.where(
            resolutor_col ==
            filtros.nombre_resolutor.strip()
        )

    # Descripción
    if filtros.descripcion and filtros.descripcion.strip():

        descripcion_col = func.coalesce(
            func.nullif(
                func.trim(IncidentConsolidated.Descripcion),
                ""
            ),
            "Sin especificar"
        )

        consulta = consulta.where(
            descripcion_col ==
            filtros.descripcion.strip()
        )

    # Mes seleccionado
    if filtros.periodo:
        inicio_mes, fin_mes = obtener_rango_periodo(
            filtros.periodo
        )

        consulta = consulta.where(
            IncidentConsolidated.Fecha_Apertura >= inicio_mes,
            IncidentConsolidated.Fecha_Apertura < fin_mes
        )

    # Tipos múltiples de incidente
    tipos = normalizar_tipos_incidente(
        filtros.tipo_incidente
    )

    if tipos:
        consulta = consulta.where(
            normalizar_tipo_incidente().in_(tipos)
        )

    # Detalle técnico
    if filtros.detalle_id:

        referencia = aliased(IncidentConsolidated)

        detalle_referencia = (
            select(normalizar_detalle(referencia))
            .where(
                referencia.Ticket_ID == filtros.detalle_id
            )
            .scalar_subquery()
        )

        consulta = consulta.where(
            normalizar_detalle() == detalle_referencia
        )


    # FILTRO DINAMICO POR TICKET ID
    if filtros.ticket_id and filtros.ticket_id.strip():

        consulta = consulta.where(
            IncidentConsolidated.Ticket_ID ==
            filtros.ticket_id.strip()
        )


    return consulta


def obtener_opciones_filtros(db: Session):
    consulta_fechas = select(
        func.min(IncidentConsolidated.Fecha_Apertura).label("fecha_min"),
        func.max(IncidentConsolidated.Fecha_Apertura).label("fecha_max"),
    )

    fechas = db.execute(consulta_fechas).mappings().one()
    # SQL SERVER DATETIME2 -> PYTHON DATE
    fecha_min = fechas["fecha_min"]
    fecha_max = fechas["fecha_max"]
    fecha_min = (
        fecha_min.date()
        if fecha_min is not None
        else None
    )
    fecha_max = (
        fecha_max.date()
        if fecha_max is not None
        else None
    )

    def obtener_opciones(columna):
        valor = func.trim(columna)
        consulta = (
            select(valor)
            .where(columna.isnot(None),valor != "")
            .distinct()
            .order_by(valor)
        )
        return db.execute(consulta).scalars().all()

    # Obtener nombres de resolutores
    resolutor_col = func.coalesce(
        func.nullif(func.trim(IncidentConsolidated.Nombre_Resolutor),""),
        "Sin especificar"
    ).label("nombre_resolutor")
    consulta_resolutores = (
        select(resolutor_col)
        .distinct()
        .order_by("nombre_resolutor")
    )
    nombres_resolutores = (db.execute(consulta_resolutores).scalars().all())

    return {
        "fecha_min": fecha_min,
        "fecha_max": fecha_max,
        "prioridades": obtener_opciones(IncidentConsolidated.Prioridad),
        "motivos_estado": obtener_opciones(IncidentConsolidated.Motivo_Estado),
        "motivos_resolucion": obtener_opciones(IncidentConsolidated.Motivo_Resolucion),
        "grupos_resolutores": obtener_opciones(IncidentConsolidated.Grupo_Resolutor),
        "proyectos": obtener_opciones(IncidentConsolidated.Proyecto),
        "nombres_resolutores": nombres_resolutores,
        "tipos_incidente": obtener_opciones(IncidentConsolidated.Categorizacion_Nivel_3),
    }
  
#KPIs  
def obtener_kpis(
    db: Session,
    filtros: IncidentConsolidatedDashboardFilters
):
    proyecto_col = func.nullif(
        func.trim(IncidentConsolidated.Proyecto),
        ""
    )

    consulta = (
        select(
            func.count().label("total_tickets"),

            func.count(
                func.distinct(proyecto_col)
            ).label("total_proyectos"),

            func.coalesce(
                func.sum(
                    case(
                        (
                            IncidentConsolidated.Prioridad ==
                            "1-Critical",
                            1
                        ),
                        else_=0
                    )
                ),
                0
            ).label("alta_criticidad")
        )
        .select_from(IncidentConsolidated)
    )

    consulta = aplicar_filtros_dashboard(
        consulta,
        filtros
    )

    return db.execute(consulta).mappings().one()


#Graficos
def obtener_volumen_mensual(
    db: Session,
    filtros: IncidentConsolidatedDashboardFilters
):
    anio = func.year(
        IncidentConsolidated.Fecha_Apertura
    )

    mes = func.month(
        IncidentConsolidated.Fecha_Apertura
    )

    consulta = (
        select(
            anio.label("anio"),
            mes.label("mes"),
            func.count().label("tickets")
        )
        .select_from(IncidentConsolidated)
        .where(
            IncidentConsolidated.Fecha_Apertura.isnot(None)
        )
        .group_by(anio, mes)
        .order_by(anio, mes)
    )

    consulta = aplicar_filtros_dashboard(
        consulta,
        filtros
    )

    return db.execute(consulta).all()


def obtener_proyectos(
    db: Session,
    filtros: IncidentConsolidatedDashboardFilters
):
    proyecto_col = normalizar_proyecto()

    consulta_base = (
        select(
            proyecto_col.label("proyecto")
        )
        .select_from(IncidentConsolidated)
    )

    consulta_base = aplicar_filtros_dashboard(
        consulta_base,
        filtros
    )

    proyectos = consulta_base.subquery()
    cantidad = func.count()

    consulta = (
        select(
            proyectos.c.proyecto,
            cantidad.label("cantidad")
        )
        .select_from(proyectos)
        .group_by(proyectos.c.proyecto)
        .order_by(
            cantidad.desc(),
            proyectos.c.proyecto.asc()
        )
    )

    return db.execute(consulta).mappings().all()


def obtener_tipos(
    db: Session,
    filtros: IncidentConsolidatedDashboardFilters,
    limite: int = 10
):
    tipo_col = normalizar_tipo_incidente()

    consulta_base = (
        select(
            tipo_col.label("tipo_incidente")
        )
        .select_from(IncidentConsolidated)
    )

    consulta_base = aplicar_filtros_dashboard(
        consulta_base,
        filtros
    )

    tipos = consulta_base.subquery()
    cantidad = func.count()

    consulta = (
        select(
            tipos.c.tipo_incidente,
            cantidad.label("cantidad")
        )
        .select_from(tipos)
        .group_by(tipos.c.tipo_incidente)
        .order_by(
            cantidad.desc(),
            tipos.c.tipo_incidente.asc()
        )
        .limit(limite)
    )

    return db.execute(consulta).mappings().all()


def obtener_prioridades(
    db: Session,
    filtros: IncidentConsolidatedDashboardFilters
):
    prioridad_col = func.coalesce(
        func.nullif(
            func.trim(IncidentConsolidated.Prioridad),
            ""
        ),
        "Sin especificar"
    )

    consulta_base = (
        select(
            prioridad_col.label("prioridad")
        )
        .select_from(IncidentConsolidated)
    )

    consulta_base = aplicar_filtros_dashboard(
        consulta_base,
        filtros
    )

    prioridades = consulta_base.subquery()
    cantidad = func.count()

    consulta = (
        select(
            prioridades.c.prioridad,
            cantidad.label("cantidad")
        )
        .select_from(prioridades)
        .group_by(prioridades.c.prioridad)
        .order_by(
            cantidad.desc(),
            prioridades.c.prioridad.asc()
        )
    )

    return db.execute(consulta).mappings().all()


def obtener_top_proyectos_mensual(
    db: Session,
    filtros: IncidentConsolidatedDashboardFilters
):
    anio = func.year(
        IncidentConsolidated.Fecha_Apertura
    )

    mes = func.month(
        IncidentConsolidated.Fecha_Apertura
    )

    proyecto_col = normalizar_proyecto()

    consulta_base = (
        select(
            proyecto_col.label("proyecto"),
            anio.label("anio"),
            mes.label("mes")
        )
        .select_from(IncidentConsolidated)
        .where(
            IncidentConsolidated.Fecha_Apertura.isnot(None)
        )
    )

    consulta_base = aplicar_filtros_dashboard(
        consulta_base,
        filtros
    )

    datos = consulta_base.subquery()
    cantidad = func.count()

    consulta = (
        select(
            datos.c.proyecto,
            datos.c.anio,
            datos.c.mes,
            cantidad.label("tickets")
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


def obtener_prioridad_mensual(
    db: Session,
    filtros: IncidentConsolidatedDashboardFilters
):
    anio = func.year(
        IncidentConsolidated.Fecha_Apertura
    )

    mes = func.month(
        IncidentConsolidated.Fecha_Apertura
    )

    prioridad_col = func.coalesce(
        func.nullif(
            func.trim(IncidentConsolidated.Prioridad),
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
        .select_from(IncidentConsolidated)
        .where(
            IncidentConsolidated.Fecha_Apertura.isnot(None)
        )
    )

    consulta_filtrada = aplicar_filtros_dashboard(
        consulta_base,
        filtros
    )

    datos = consulta_filtrada.subquery()
    cantidad = func.count()

    consulta = (
        select(
            datos.c.anio,
            datos.c.mes,
            datos.c.prioridad,
            cantidad.label("cantidad")
        )
        .select_from(datos)
        .group_by(
            datos.c.anio,
            datos.c.mes,
            datos.c.prioridad
        )
        .order_by(
            datos.c.anio,
            datos.c.mes,
            datos.c.prioridad
        )
    )

    return db.execute(consulta).mappings().all()


def obtener_rendimiento_resolutores(
    db: Session,
    filtros: IncidentConsolidatedDashboardFilters
):
    resolutor_col = func.coalesce(
        func.nullif(
            func.trim(IncidentConsolidated.Nombre_Resolutor),
            ""
        ),
        "Sin especificar"
    )

    anio = func.year(
        IncidentConsolidated.Fecha_Apertura
    )

    mes = func.month(
        IncidentConsolidated.Fecha_Apertura
    )

    consulta_base = (
        select(
            resolutor_col.label("nombre_resolutor"),
            anio.label("anio"),
            mes.label("mes")
        )
        .select_from(IncidentConsolidated)
        .where(
            IncidentConsolidated.Fecha_Apertura.isnot(None)
        )
    )

    consulta_filtrada = aplicar_filtros_dashboard(
        consulta_base,
        filtros
    )

    datos = consulta_filtrada.subquery()
    cantidad = func.count()

    consulta = (
        select(
            datos.c.nombre_resolutor,
            datos.c.anio,
            datos.c.mes,
            cantidad.label("tickets")
        )
        .select_from(datos)
        .group_by(
            datos.c.nombre_resolutor,
            datos.c.anio,
            datos.c.mes
        )
        .order_by(
            datos.c.anio,
            datos.c.mes,
            datos.c.nombre_resolutor
        )
    )

    return db.execute(consulta).mappings().all()


def obtener_explorador_descripciones(
    db: Session,
    filtros: IncidentConsolidatedDashboardFilters,
    pagina: int = 1,
    tamano: int = 10,
    buscar: str | None = None
):
    descripcion_col = func.coalesce(
        func.nullif(
            func.trim(IncidentConsolidated.Descripcion),
            ""
        ),
        "Sin especificar"
    )

    anio = func.year(
        IncidentConsolidated.Fecha_Apertura
    )

    mes = func.month(
        IncidentConsolidated.Fecha_Apertura
    )

    consulta_base = (
        select(
            descripcion_col.label("descripcion"),
            anio.label("anio"),
            mes.label("mes")
        )
        .select_from(IncidentConsolidated)
        .where(
            IncidentConsolidated.Fecha_Apertura.isnot(None)
        )
    )

    consulta = aplicar_filtros_dashboard(
        consulta_base,
        filtros
    )

    busqueda = buscar.strip() if buscar and buscar.strip() else None

    if busqueda:
        consulta = consulta.where(
            descripcion_col.contains(
                busqueda,
                autoescape=True
            )
        )

    datos = consulta.subquery()

    consulta_resumen = (
        select(
            datos.c.descripcion,
            func.count().label("total_tickets")
        )
        .select_from(datos)
        .group_by(datos.c.descripcion)
    )

    resumen = consulta_resumen.subquery()

    inicio = (pagina - 1) * tamano

    if busqueda:
        total_descripciones = db.execute(
            select(func.count()).select_from(resumen)
        ).scalar_one()

        consulta_pagina = (
            select(
                resumen.c.descripcion,
                resumen.c.total_tickets
            )
            .order_by(
                resumen.c.total_tickets.desc(),
                resumen.c.descripcion.asc()
            )
            .limit(tamano)
            .offset(inicio)
        )

        descripciones = db.execute(
            consulta_pagina
        ).mappings().all()

    else:
        consulta_top = (
            select(
                resumen.c.descripcion,
                resumen.c.total_tickets
            )
            .order_by(
                resumen.c.total_tickets.desc(),
                resumen.c.descripcion.asc()
            )
            .limit(10)
        )

        top_descripciones = db.execute(
            consulta_top
        ).mappings().all()

        total_descripciones = len(top_descripciones)
        descripciones = top_descripciones[
            inicio:inicio + tamano
        ]

    if not descripciones:
        return {
            "descripciones": [],
            "mensual": [],
            "total_descripciones": total_descripciones
        }

    nombres = [
        row["descripcion"]
        for row in descripciones
    ]

    consulta_mensual = (
        select(
            datos.c.descripcion,
            datos.c.anio,
            datos.c.mes,
            func.count().label("tickets")
        )
        .select_from(datos)
        .where(datos.c.descripcion.in_(nombres))
        .group_by(
            datos.c.descripcion,
            datos.c.anio,
            datos.c.mes
        )
        .order_by(
            datos.c.descripcion,
            datos.c.anio,
            datos.c.mes
        )
    )

    mensual = db.execute(
        consulta_mensual
    ).mappings().all()

    return {
        "descripciones": descripciones,
        "mensual": mensual,
        "total_descripciones": total_descripciones
    }

 
def obtener_detalle_eventos_tecnicos(
    db: Session,
    filtros: IncidentConsolidatedDashboardFilters,
    pagina: int = 1,
    tamano: int = 10,
    buscar: str | None = None
):
    detalle_col = normalizar_detalle()

    consulta_total = (
        select(func.count())
        .select_from(IncidentConsolidated)
    )

    consulta_total = aplicar_filtros_dashboard(
        consulta_total,
        filtros
    )

    total_general = db.execute(
        consulta_total
    ).scalar_one()

    consulta_base = (
        select(
            IncidentConsolidated.Ticket_ID.label("ticket_id"),
            detalle_col.label("detalle")
        )
        .select_from(IncidentConsolidated)
    )

    consulta = aplicar_filtros_dashboard(
        consulta_base,
        filtros
    )

    busqueda = buscar.strip() if buscar and buscar.strip() else None

    if busqueda:
        consulta = consulta.where(
            detalle_col.contains(
                busqueda,
                autoescape=True
            )
        )

    datos = consulta.subquery()

    consulta_resumen = (
        select(
            func.min(
                datos.c.ticket_id
            ).label("detalle_id"),
            datos.c.detalle,
            func.count().label("total")
        )
        .select_from(datos)
        .group_by(datos.c.detalle)
    )

    resumen = consulta_resumen.subquery()

    inicio = (pagina - 1) * tamano

    if busqueda:
        total_detalles = db.execute(
            select(func.count()).select_from(resumen)
        ).scalar_one()

        consulta_pagina = (
            select(
                resumen.c.detalle_id,
                resumen.c.detalle,
                resumen.c.total
            )
            .order_by(
                resumen.c.total.desc(),
                resumen.c.detalle.asc()
            )
            .limit(tamano)
            .offset(inicio)
        )

        detalles = db.execute(
            consulta_pagina
        ).mappings().all()

    else:
        consulta_top = (
            select(
                resumen.c.detalle_id,
                resumen.c.detalle,
                resumen.c.total
            )
            .order_by(
                resumen.c.total.desc(),
                resumen.c.detalle.asc()
            )
            .limit(10)
        )

        top_detalles = db.execute(
            consulta_top
        ).mappings().all()

        total_detalles = len(top_detalles)

        detalles = top_detalles[
            inicio:inicio + tamano
        ]

    return {
        "detalles": detalles,
        "total_general": total_general,
        "total_detalles": total_detalles
    }


def obtener_incidentes_porcentajes(
    db: Session,
    filtros: IncidentConsolidatedDashboardFilters,
    limite: int = 20
):
    descripcion_col = func.coalesce(
        func.nullif(
            func.trim(IncidentConsolidated.Descripcion),
            ""
        ),
        "Sin especificar"
    )

    consulta_total = (
        select(func.count())
        .select_from(IncidentConsolidated)
    )

    consulta_total = aplicar_filtros_dashboard(
        consulta_total,
        filtros
    )

    total_general = db.execute(
        consulta_total
    ).scalar_one()

    consulta_base = (
        select(
            descripcion_col.label("descripcion")
        )
        .select_from(IncidentConsolidated)
    )

    consulta = aplicar_filtros_dashboard(
        consulta_base,
        filtros
    )

    datos = consulta.subquery()

    consulta = (
        select(
            datos.c.descripcion,
            func.count().label("cantidad")
        )
        .select_from(datos)
        .group_by(datos.c.descripcion)
        .order_by(
            func.count().desc(),
            datos.c.descripcion.asc()
        )
        .limit(limite)
    )

    resultados = db.execute(
        consulta
    ).mappings().all()

    return {
        "total_general": total_general,
        "resultados": resultados
    }


def obtener_top_descripciones_proyectos(
    db: Session,
    filtros: IncidentConsolidatedDashboardFilters
):
    descripcion_col = func.coalesce(
        func.nullif(
            func.trim(IncidentConsolidated.Descripcion),
            ""
        ),
        "Sin especificar"
    )

    proyecto_col = normalizar_proyecto()

    consulta_total = (
        select(func.count())
        .select_from(IncidentConsolidated)
    )

    consulta_total = aplicar_filtros_dashboard(
        consulta_total,
        filtros
    )

    total_general = db.execute(
        consulta_total
    ).scalar_one()

    consulta_base = (
        select(
            descripcion_col.label("descripcion"),
            proyecto_col.label("proyecto")
        )
        .select_from(IncidentConsolidated)
    )

    consulta = aplicar_filtros_dashboard(
        consulta_base,
        filtros
    )

    datos = consulta.subquery()

    consulta = (
        select(
            datos.c.descripcion,
            datos.c.proyecto,
            func.count().label("tickets")
        )
        .select_from(datos)
        .group_by(
            datos.c.descripcion,
            datos.c.proyecto
        )
        .order_by(
            func.count().desc(),
            datos.c.descripcion.asc(),
            datos.c.proyecto.asc()
        )
        .limit(10)
    )

    resultados = db.execute(
        consulta
    ).mappings().all()

    return {
        "total_general": total_general,
        "resultados": resultados
    }


def obtener_top_detalles(
    db: Session,
    filtros: IncidentConsolidatedDashboardFilters
):
    detalle_col = func.nullif(
        func.trim(IncidentConsolidated.Detalle),
        ""
    )

    consulta_total = (
        select(func.count())
        .select_from(IncidentConsolidated)
    )

    consulta_total = aplicar_filtros_dashboard(
        consulta_total,
        filtros
    )

    total_general = db.execute(
        consulta_total
    ).scalar_one()

    consulta_base = (
        select(
            detalle_col.label("detalle")
        )
        .select_from(IncidentConsolidated)
        .where(
            detalle_col.isnot(None),
            detalle_col != "Sin especificar"
        )
    )

    consulta = aplicar_filtros_dashboard(
        consulta_base,
        filtros
    )

    datos = consulta.subquery()

    consulta = (
        select(
            datos.c.detalle,
            func.count().label("tickets")
        )
        .select_from(datos)
        .group_by(datos.c.detalle)
        .order_by(
            func.count().desc(),
            datos.c.detalle.asc()
        )
        .limit(10)
    )

    resultados = db.execute(
        consulta
    ).mappings().all()

    return {
        "total_general": total_general,
        "resultados": resultados
    }


# TABLA PAGINADA - DETALLE DE TICKETS
def obtener_tickets(
    db: Session,
    filtros: IncidentConsolidatedDashboardFilters,
    pagina: int = 1,
    tamano: int = 10
):

    # 1. CONSULTA PARA CONTAR LOS TICKETS
    consulta_total = (
        select(func.count())
        .select_from(IncidentConsolidated)
    )

    # 2. APLICAR LOS FILTROS DEL DASHBOARD
    consulta_total = aplicar_filtros_dashboard(
        consulta_total,
        filtros
    )

    total = db.execute(
        consulta_total
    ).scalar_one()

    # 3. CALCULAR DESPLAZAMIENTO
    inicio = (pagina - 1) * tamano

    # 4. CONSULTAR TODAS LAS COLUMNAS DEL MODELO
    consulta = (
        select(*IncidentConsolidated.__table__.columns)
        .select_from(IncidentConsolidated)
    )

    # 5. APLICAR LOS MISMOS FILTROS
    consulta = aplicar_filtros_dashboard(
        consulta,
        filtros
    )

    # 6. ORDEN ESTABLE PARA SQL SERVER
    consulta = (
        consulta
        .order_by(
            IncidentConsolidated.Fecha_Apertura.desc(),
            IncidentConsolidated.Ticket_ID.desc()
        )
        .offset(inicio)
        .limit(tamano)
    )

    # 7. OBTENER SOLO LOS REGISTROS DE LA PAGINA
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



# ANÁLISIS DE INCIDENTES -  DISTRIBUCIÓN POR ATRIBUCIÓN ORIGINAL

def obtener_atribucion_incidentes(
    db: Session,
    filtros: IncidentConsolidatedDashboardFilters
):

    # 1. Normalizar Motivo_Resolucion.
    # No modifica los valores almacenados en SQL Server.
    atribucion_col = func.nullif(
        func.trim(
            IncidentConsolidated.Motivo_Resolucion
        ),
        ""
    )

    # 2. Construir consulta base.
    consulta_base = (
        select(
            atribucion_col.label("atribucion")
        )
        .select_from(IncidentConsolidated)
    )

    # 3. Aplicar todos los filtros existentes.
    consulta_base = aplicar_filtros_dashboard(
        consulta_base,
        filtros
    )

    # 4. Crear subconsulta.
    # Evita el error 8120 de SQL Server.
    datos = consulta_base.subquery()

    # 5. Agrupar por la columna de la subconsulta.
    consulta = (
        select(
            datos.c.atribucion,
            func.count().label("tickets")
        )
        .select_from(datos)
        .group_by(datos.c.atribucion)
        .order_by(datos.c.atribucion)
    )

    # 6. Ejecutar consulta de solo lectura.
    return db.execute(
        consulta
    ).mappings().all()



# ANÁLISIS DE INCIDENTES - TOP DE SERVIDORES
def obtener_tickets_para_top_servidores(
    db: Session,
    filtros: IncidentConsolidatedDashboardFilters
):
    # Columnas donde podría encontrarse un servidor.
    columnas = [
        IncidentConsolidated.Descripcion,
        IncidentConsolidated.Detalle,
        IncidentConsolidated.Causa,
        IncidentConsolidated.Solucion
    ]

    # Prefijos que podemos identificar con el extractor.
    patrones = [
        "%SRV%",
        "%UNHOS%",
        "%PC-%",
        "%IP-%"
    ]

    condiciones = [
        func.upper(columna).like(patron)
        for columna in columnas
        for patron in patrones
    ]

    consulta = (
        select(
            IncidentConsolidated.Ticket_ID,
            IncidentConsolidated.Descripcion,
            IncidentConsolidated.Detalle,
            IncidentConsolidated.Causa,
            IncidentConsolidated.Solucion
        )
        .select_from(IncidentConsolidated)
        .where(or_(*condiciones))
    )

    # Reutilizar TODOS los filtros existentes.
    consulta = aplicar_filtros_dashboard(
        consulta,
        filtros
    )

    # Procesar las filas por lotes para reducir memoria.
    resultado = db.execute(
        consulta.execution_options(
            stream_results=True
        )
    )

    return resultado.mappings().yield_per(500)




# ANÁLISIS DE INCIDENTES - CONSULTAR INFORMACIÓN PARA ANÁLISIS DE CAUSAS

def obtener_tickets_para_analisis_causas(
    db: Session,
    filtros: IncidentConsolidatedDashboardFilters
):
    consulta = (
        select(
            IncidentConsolidated.Ticket_ID,
            IncidentConsolidated.Causa,
            IncidentConsolidated.Solucion,
            IncidentConsolidated.Detalle,
            IncidentConsolidated.Descripcion
        )
        .select_from(IncidentConsolidated)
    )

    # Reutiliza todos los filtros del backend actual.
    consulta = aplicar_filtros_dashboard(
        consulta,
        filtros
    )

    # Lectura de registros por lotes.
    resultado = db.execute(
        consulta.execution_options(
            stream_results=True
        )
    )

    return resultado.mappings().yield_per(300)

