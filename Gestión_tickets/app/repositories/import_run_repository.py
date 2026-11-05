from sqlalchemy import select
from sqlalchemy.orm import Session
from app.models.import_run_model import ImportRun

def crear(
    db: Session,
    tipo,
    nombre_archivo=None,
    fecha_inicio=None,
    sqlite_status=None,
    sqlserver_status=None
):
    import_run = ImportRun(
        Eir_Tipo=tipo,
        Eir_Nombre_Archivo=nombre_archivo,
        Eir_Fecha_Inicio=fecha_inicio,
        Eir_Estado="PROCESSING",
        Eir_Filas_Excel=0,
        Eir_Filas_Aceptadas=0,
        Eir_Filas_Rechazadas=0,
        Eir_Tickets_Nuevos=0,
        Eir_Tickets_Modificados=0,
        Eir_Tickets_Sin_Cambios=0,
        Eir_SQLite_Status=sqlite_status,
        Eir_SQLServer_Status=sqlserver_status
    )

    db.add(import_run)
    db.flush()

    return import_run


def completar(
    db: Session,
    import_run,
    fecha_fin,
    filas_excel,
    filas_aceptadas,
    filas_rechazadas,
    nuevos,
    modificados,
    sin_cambios,
    sqlite_status=None,
    sqlserver_status=None
):
    import_run.Eir_Fecha_Fin = fecha_fin
    import_run.Eir_Estado = "SUCCESS"
    import_run.Eir_Filas_Excel = filas_excel
    import_run.Eir_Filas_Aceptadas = filas_aceptadas
    import_run.Eir_Filas_Rechazadas = filas_rechazadas
    import_run.Eir_Tickets_Nuevos = nuevos
    import_run.Eir_Tickets_Modificados = modificados
    import_run.Eir_Tickets_Sin_Cambios = sin_cambios
    import_run.Eir_SQLite_Status = sqlite_status
    import_run.Eir_SQLServer_Status = sqlserver_status
    import_run.Eir_Error_Mensaje = None

    db.flush()

    return import_run


def marcar_error(
    db: Session,
    import_run,
    fecha_fin,
    error,
    sqlite_status=None,
    sqlserver_status=None
):
    import_run.Eir_Fecha_Fin = fecha_fin
    import_run.Eir_Estado = "ERROR"
    import_run.Eir_SQLite_Status = sqlite_status
    import_run.Eir_SQLServer_Status = sqlserver_status
    import_run.Eir_Error_Mensaje = str(error)

    db.flush()

    return import_run


def obtener_por_id(db: Session,import_run_id: int):
    consulta = select(ImportRun).where(
        ImportRun.Eir_ID == import_run_id
    )

    return db.execute(
        consulta
    ).scalar_one_or_none()