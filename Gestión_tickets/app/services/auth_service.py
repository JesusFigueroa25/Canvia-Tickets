from fastapi import HTTPException
from sqlalchemy.orm import Session

from app.repositories import user_repository
from app.security import auth


def login(db: Session,correo: str,password: str):
   
    correo_clean = correo.strip()
    usuario = user_repository.obtener_por_correo(db, correo_clean)

    if not usuario:
        raise HTTPException(status_code=401, detail="Correo o contraseña incorrectos")

    if password != usuario["Usu_Clave"]:
        raise HTTPException(status_code=401, detail="Correo o contraseña incorrectos")

    access_token = auth.create_access_token({"sub": usuario["Usu_Correo"]})

    return {
        "access_token": access_token,
        "token_type": "bearer",
        "correo": usuario["Usu_Correo"]
    }
    
    

#def login(db: Session,correo: str,password: str):
#   
#    correo_clean = correo.strip()
#    usuario = user_repository.obtener_por_correo(db, correo_clean)
#
#    if not usuario:
#        raise HTTPException(status_code=401, detail="Correo o contraseña incorrectos")
#
#    if password != usuario["Usu_Clave"]:
#        raise HTTPException(status_code=401, detail="Correo o contraseña incorrectos")
#
#    access_token = auth.create_access_token({"sub": usuario["Usu_Correo"]})
#
#    return {
#        "access_token": access_token,
#        "token_type": "bearer",
#        "correo": usuario["Usu_Correo"]
#    }