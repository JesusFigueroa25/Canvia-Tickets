from sqlalchemy import text
from sqlalchemy.orm import Session


def obtener_por_correo(db: Session, correo: str):
    consulta = text("""
        SELECT Usu_Correo, Usu_Clave
        FROM Usuarios
        WHERE Usu_Correo = :correo
    """)

    resultado = db.execute(consulta,{"correo": correo}).mappings().first()

    return resultado