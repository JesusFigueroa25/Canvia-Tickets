
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
            duplicados_excel
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
        # COMPARAR POR TICKET_ID
        # ----------------------------------------------------

        registros_nuevos, sin_cambios = (
            repository.identificar_nuevos(
                db=db,
                registros_staging=registros_staging
            )
        )

        # ----------------------------------------------------
        # INSERTAR SOLO NUEVOS
        # ----------------------------------------------------

        nuevos = repository.insertar_nuevos(
            db=db,
            registros=registros_nuevos
        )

        modificados = 0

        # Excel repetido + tickets ya existentes.
        duplicados = duplicados_excel + sin_cambios

        # ----------------------------------------------------
        # VALIDACIONES
        # ----------------------------------------------------

        if nuevos + sin_cambios != filas_staging:
            raise RuntimeError(
                "No coincide la conciliación de staging."
            )

        if duplicados + nuevos != filas_excel:
            raise RuntimeError(
                "No coincide la conciliación del Excel."
            )

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
            filas_rechazadas=duplicados_excel,
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
            "filas_ticket_repetido": duplicados_excel,
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
