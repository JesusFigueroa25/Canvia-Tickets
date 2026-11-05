from fastapi import (APIRouter,Depends,)
from sqlalchemy.orm import Session
from app.database.sqlserver import get_sqlserver_db
from app.schemas.home_schema import (HomeResumenOut,)
from app.services import (home_service,)

router = APIRouter(prefix="/home", tags=["Home"])


@router.get("/resumen", response_model=HomeResumenOut)
def obtener_resumen(db: Session = Depends(get_sqlserver_db)):
    return home_service.obtener_resumen(db)