import logging

from datetime import datetime
from uuid import uuid4

from sqlalchemy.orm import Session

from app.database.sqlserver import verificar_conexion_sqlserver

from app.etl.tickets_manual_updates_etl import (
    procesar_tickets_manual_updates,
)

from app.repositories import (
    import_run_repository,
    tickets_manual_updates_repository as repository,
)


logger = logging.getLogger(__name__)


def importar(
    db: Session,
    archivo,
    nombre_archivo: str | None = None
):

    fecha_inicio = datetime.now()
    lote_id = uuid4()

    # ========================================================
    # 1. VALIDAR SQL SERVER
    # ========================================================

    try:
        verificar_conexion_sqlserver(db)

    except Exception as error:
        db.rollback()

        raise ConnectionError(
            "No hay conexión con SQL Server."
        ) from error

    # ========================================================
    # 2. PROCESAR IMPORTACIÓN
    # ========================================================

    try:

        archivo.seek(0)

        (
            df,
            filas_excel,
            filas_ticket_repetido
        ) = procesar_tickets_manual_updates(
            archivo
        )

        filas_procesadas = len(df)
        tickets_distintos = int(df["Ticket_ID"].nunique())

        # Evitar importaciones simultáneas.
        repository.bloquear_importacion(db)

        # ----------------------------------------------------
        # AUDITORÍA
        # ----------------------------------------------------

        import_run = import_run_repository.crear(
            db=db,
            tipo="tickets_manual_updates",
            nombre_archivo=nombre_archivo,
            fecha_inicio=fecha_inicio,
            sqlite_status="NO_APLICA",
            sqlserver_status="PROCESSING"
        )

        # ----------------------------------------------------
        # STAGING
        # ----------------------------------------------------

        filas_staging = repository.cargar_staging(
            db=db,
            df=df,
            lote_id=lote_id
        )

        db.flush()

        registros_staging = repository.obtener_staging_lote(
            db=db,
            lote_id=lote_id
        )

        if len(registros_staging) != filas_procesadas:
            raise RuntimeError(
                "Las filas de staging no coinciden "
                "con las filas procesadas."
            )

        # ----------------------------------------------------
        # SINCRONIZAR POR EVENTO, NO POR TICKET_ID
        # ----------------------------------------------------
        clasificacion = repository.sincronizar_registros(db, registros_staging)
        nuevos = clasificacion['nuevos']
        modificados = clasificacion['modificados']
        sin_cambios = clasificacion['sin_cambios']
        duplicados = sin_cambios
        if nuevos + modificados + sin_cambios != filas_staging or filas_staging != filas_excel:
            raise RuntimeError('No coincide la conciliación de registros de trabajo.')

        # ----------------------------------------------------
        # LIMPIAR STAGING DEL LOTE
        # ----------------------------------------------------

        repository.limpiar_staging_lote(
            db=db,
            lote_id=lote_id
        )

        # ----------------------------------------------------
        # COMPLETAR AUDITORÍA
        # ----------------------------------------------------

        import_run_repository.completar(
            db=db,
            import_run=import_run,
            fecha_fin=datetime.now(),
            filas_excel=filas_excel,
            filas_aceptadas=filas_staging,
            filas_rechazadas=0,
            nuevos=nuevos,
            modificados=modificados,
            sin_cambios=sin_cambios,
            sqlite_status="NO_APLICA",
            sqlserver_status="SUCCESS"
        )

        db.commit()

        logger.info(
            "Tickets manuales importados: "
            "Excel=%s Nuevos=%s Duplicados=%s",
            filas_excel,
            nuevos,
            duplicados
        )

        return {
            "tipo": "tickets_manual_updates",
            "tabla_staging": "stg_tickets_manual_updates",
            "tabla_destino": "tickets_manual_updates",
            "lote_id": str(lote_id),
            "filas_excel": filas_excel,
            "filas_procesadas": filas_procesadas,
            "filas_staging": filas_staging,
            "duplicados": duplicados,
            "nuevos": nuevos,
            "modificados": modificados,
            "sin_cambios": sin_cambios,
            "tickets_distintos": tickets_distintos,
            "filas_ticket_repetido": filas_ticket_repetido,
            "mensaje": (
                "Archivo de tickets modificados "
                "manualmente procesado correctamente."
            )
        }

    # ========================================================
    # 3. ROLLBACK Y AUDITORÍA DE ERROR
    # ========================================================

    except Exception as error:

        db.rollback()

        logger.exception(
            "Error al importar tickets manuales. Lote=%s",
            lote_id
        )

        try:

            import_run_error = import_run_repository.crear(
                db=db,
                tipo="tickets_manual_updates",
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
            logger.exception(
                "No se pudo registrar la auditoría "
                "de importación fallida."
            )

        raise


# ============================================================
# PASO 3: SERVICIO ANALITICO (NO CAMBIA LA IMPORTACION MANUAL)
# ============================================================
from collections import OrderedDict
from datetime import date
from os import getenv
from threading import RLock
from time import monotonic

from app.schemas.tickets_manual_updates_schema import TicketsParallelFilters
from app.services.tickets_parallel_engine import ParallelSnapshot

# Una caché por proceso, opt-in si todos los usuarios autorizados comparten
# exactamente la misma visibilidad de SQL. Alternativamente un middleware
# de autorización puede fijar db.info['parallel_cache_scope'] (valor confiable).
_CACHE_TTL = 90
_CACHE_MAX = 2
_cache = OrderedDict()
_cache_lock = RLock()


def invalidar_cache_paralelos() -> None:
    """Invocar después del commit de una importación de tablas de origen."""
    with _cache_lock:
        _cache.clear()


def _rango(db: Session, filtros: TicketsParallelFilters):
    desde, hasta = filtros.desde, filtros.hasta
    if desde is None or hasta is None:
        minimo, maximo = repository.obtener_rango_paralelos(db, filtros.grupo_resolutor)
        if minimo is None or maximo is None:
            return desde or hasta, hasta or desde
        # Si solo se suministra un extremo fuera de la cobertura, devolver
        # un periodo válido sin datos en vez de invertir el rango.
        if desde is None:
            desde = min(minimo, hasta) if hasta is not None else minimo
        if hasta is None:
            hasta = max(maximo, desde)
    if desde > hasta or hasta == date.max:
        raise ValueError("Rango de fechas inválido.")
    return desde, hasta


def _snapshot(db: Session, filtros: TicketsParallelFilters, rango=None) -> ParallelSnapshot:
    desde, hasta = rango if rango is not None else _rango(db, filtros)
    if desde is None or hasta is None:
        return ParallelSnapshot(desde, hasta, [], [], [])
    def cargar():
        parents, consolidated, originals = repository.cargar_base_paralelos(
            db, desde, hasta, filtros.grupo_resolutor
        )
        return ParallelSnapshot(desde, hasta, parents, consolidated, originals)
    scope = db.info.get("parallel_cache_scope")
    if scope is None and getenv("CANVIA_PARALLEL_SHARED_CACHE", "0") == "1":
        scope = "shared-authorized-db"
    if scope is None:
        return cargar()
    # Identidad de bind + alcance de permisos + filtros del universo.
    # No incluir prioridad, motivo, proyecto o tipo: se aplican a la salida.
    key = (db.get_bind(), scope, desde, hasta, filtros.grupo_resolutor)
    # Un solo cálculo a la vez por proceso: evita fan-out al cargar la página.
    # La carga no se realiza en segundo plano ni se comparte entre procesos.
    with _cache_lock:
        now = monotonic()
        for old_key, (expires, _) in list(_cache.items()):
            if expires <= now:
                _cache.pop(old_key, None)
        if key in _cache:
            _cache.move_to_end(key)
            return _cache[key][1]
        snapshot = cargar()
        _cache[key] = (monotonic() + _CACHE_TTL, snapshot)
        while len(_cache) > _CACHE_MAX:
            _cache.popitem(last=False)
        return snapshot

def obtener_opciones_filtros(db: Session, filtros: TicketsParallelFilters):
    fecha_min, fecha_max = repository.obtener_rango_paralelos(db, filtros.grupo_resolutor)
    grupos = repository.obtener_grupos_paralelos(db)
    rango = (
        (fecha_min, fecha_max)
        if filtros.desde is None and filtros.hasta is None
        else None
    )
    snapshot = _snapshot(db, filtros, rango=rango)
    return {
        "fecha_min": fecha_min,
        "fecha_max": fecha_max,
        "grupos_resolutores": grupos,
        **snapshot.options()
    }


def obtener_kpis(db: Session, filtros: TicketsParallelFilters):
    s = _snapshot(db, filtros)
    return s.kpis(s.eligible(filtros))


def obtener_resumen_ejecutivo_mensual(db: Session, filtros: TicketsParallelFilters):
    s = _snapshot(db, filtros)
    return s.monthly(s.eligible(filtros))


def _paginar_grupos(filas, campo, pagina=None, tamano=None):
    """Mantiene todos los meses de cada entidad; sin parámetros conserva el array."""
    if pagina is None and tamano is None:
        return filas
    pagina = 1 if pagina is None else pagina
    tamano = 10 if tamano is None else tamano
    if pagina < 1 or not 1 <= tamano <= 100:
        raise ValueError("Paginación inválida.")
    # El orden original del motor es por entidad y mes.
    grupos = list(dict.fromkeys(fila[campo] for fila in filas))
    inicio = (pagina - 1) * tamano
    seleccion = set(grupos[inicio:inicio + tamano])
    return {"items": [fila for fila in filas if fila[campo] in seleccion],
            "total": len(grupos), "pagina": pagina, "tamano": tamano}


def obtener_paralelos_resolutores(db: Session, filtros: TicketsParallelFilters,
                                 pagina: int | None = None, tamano: int | None = None):
    s = _snapshot(db, filtros)
    return _paginar_grupos(s.grouped(s.eligible(filtros)), "resolutor", pagina, tamano)


def obtener_paralelos_tickets(
    db: Session,
    filtros: TicketsParallelFilters,
    pagina: int,
    tamano: int,
    tipo_ticket_local=None,
    resolutor_busqueda: str | None = None
):
    s = _snapshot(db, filtros)

    return s.tickets(
        s.eligible(filtros),
        pagina,
        tamano,
        tipo_ticket_local,
        resolutor_busqueda
    )


def obtener_detalle_paralelos(db: Session, filtros: TicketsParallelFilters, ticket_id: str, tipo_ticket: str, resolutor: str):
    s = _snapshot(db, filtros)
    return s.detail(s.eligible(filtros), ticket_id, tipo_ticket, resolutor)


def obtener_paralelos_proyectos(db: Session, filtros: TicketsParallelFilters,
                               pagina: int | None = None, tamano: int | None = None):
    s = _snapshot(db, filtros)
    return _paginar_grupos(s.grouped(s.eligible(filtros), by_project=True), "proyecto", pagina, tamano)
