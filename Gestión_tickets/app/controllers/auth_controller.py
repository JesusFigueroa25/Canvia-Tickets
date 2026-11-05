from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from app.database.sqlserver import get_sqlserver_db
from app.schemas.auth_schema import UserLogin, TokenLogin
from app.services import auth_service

router = APIRouter(prefix="/auth",tags=["Auth"])

@router.post("/login",response_model=TokenLogin)
def login(user: UserLogin,db: Session = Depends(get_sqlserver_db)):
    return auth_service.login(db,user.correo, user.password) 


#@router.post("/login",response_model=TokenLogin)
#def login(user: UserLogin,db: Session = Depends(get_sqlserver_db)):
#    return auth_service.login(db,user.correo, user.password) 
