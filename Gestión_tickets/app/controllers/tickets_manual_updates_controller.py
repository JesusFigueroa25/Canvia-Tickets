
import logging
from pathlib import Path

from fastapi import (
    APIRouter,
    Depends,
    File,
    HTTPException,
    UploadFile,
)
from sqlalchemy.orm import Session

from app.database.sqlserver import get_sqlserver_db
from app.etl.validator import ETLValidationError
from app.schemas.tickets_manual_updates_schema import (
    TicketsManualUpdatesImportOut,
)
from app.services import tickets_manual_updates_service


logger = logging.getLogger(__name__)

router = APIRouter(
    prefix="/tickets-manual-updates",
    tags=["Tickets Manual Updates"]
)


@router.post(
    "/import",
    response_model=TicketsManualUpdatesImportOut
)
def importar_tickets_manual_updates(
    archivo: UploadFile = File(...),
    db: Session = Depends(get_sqlserver_db)
):

    nombre_archivo = Path(
        archivo.filename or ""
    ).name

    if not nombre_archivo:
        raise HTTPException(
            status_code=400,
            detail="Debe seleccionar un archivo Excel."
        )

    extension = Path(nombre_archivo).suffix.lower()

    if extension not in (".xlsx", ".xls"):
        raise HTTPException(
            status_code=400,
            detail="Solo se permiten archivos Excel."
        )

    try:
        # Comprobar el tamaño real del archivo.
        archivo.file.seek(0, 2)
        tamano = archivo.file.tell()
        archivo.file.seek(0)

        if tamano > 50 * 1024 * 1024:
            raise HTTPException(
                status_code=413,
                detail="El archivo supera los 50 MB."
            )

        return tickets_manual_updates_service.importar(
            db=db,
            archivo=archivo.file,
            nombre_archivo=nombre_archivo
        )

    except HTTPException:
        raise

    except (ETLValidationError, ValueError) as error:
        raise HTTPException(
            status_code=400,
            detail=str(error)
        ) from error

    except ConnectionError as error:
        raise HTTPException(
            status_code=503,
            detail=str(error)
        ) from error

    except Exception as error:
        logger.exception(
            "Error al importar tickets manuales."
        )

        raise HTTPException(
            status_code=500,
            detail=(
                "Error interno durante la importación. "
                "Revise los logs del backend."
            )
        ) from error

    finally:
        archivo.file.close()
