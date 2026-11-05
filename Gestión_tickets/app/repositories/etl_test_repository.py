from sqlalchemy.orm import Session
from sqlalchemy import text

TABLAS_PERMITIDAS = {
    "incident_sla": "incident_sla",
    "requirement_sla": "requirement_sla",
    "incident_consolidated": "incident_consolidated",
    "requirement_consolidated": "requirement_consolidated",
}

def get(
    db: Session,
    tipo: str,
    limit: int = 100
):
    nombre_tabla = TABLAS_PERMITIDAS.get(tipo)

    if not nombre_tabla:
        raise ValueError(
            f"Tipo de tabla no válido: {tipo}"
        )

    consulta_total = text(
        f"""
        SELECT COUNT(*)
        FROM {nombre_tabla}
        """
    )

    total = db.execute(
        consulta_total
    ).scalar()


    consulta = text(
        f"""
        SELECT *
        FROM {nombre_tabla}
        LIMIT :limit
        """
    )

    resultado = db.execute(
        consulta,
        {
            "limit": limit
        }
    )

    registros = [
        dict(fila)
        for fila in resultado.mappings().all()
    ]

    return {
        "tabla": nombre_tabla,
        "total": total,
        "datos": registros
    }
    