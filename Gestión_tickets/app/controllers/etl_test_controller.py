from fastapi import (
    APIRouter,
    Depends,
    HTTPException,
    UploadFile,
    File,
    Query,
)

from sqlalchemy.orm import Session

from app.database.database import get_db

from app.schemas.etl_test_schema import (
    ETLImportOut,
    ETLDataOut,
)

from app.services import (
    etl_test_service
)


router = APIRouter(
    prefix="/etl-test",
    tags=["ETL Test"]
)


@router.post(
    "/upload/{tipo}",
    response_model=ETLImportOut
)
def upload_excel(
    tipo: str,
    archivo: UploadFile = File(...)
):

    try:

        return etl_test_service.procesar_archivo(
            tipo,
            archivo.file
        )

    except Exception as error:

        raise HTTPException(
            status_code=400,
            detail=str(error)
        )


@router.get(
    "/data/{tipo}",
    response_model=ETLDataOut
)
def get_data(
    tipo: str,

    limit: int = Query(
        default=100,
        ge=1,
        le=1000
    ),

    db: Session = Depends(get_db)
):

    try:
        return etl_test_service.listar_datos(
            db,
            tipo,
            limit
        )

    except Exception as error:
        raise HTTPException(
            status_code=400,
            detail=str(error)
        )