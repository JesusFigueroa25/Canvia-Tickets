from sqlalchemy.orm import Session

from app.etl.incident_sla_etl import (procesar_incident_sla)
from app.etl.requirement_sla_etl import (procesar_requirement_sla)
from app.etl.incident_consolidated_etl import (procesar_incident_consolidated)
from app.etl.requirement_consolidated_etl import (procesar_requirement_consolidated)
from app.etl.export_data import (exportar_dataframe)
from app.repositories import (etl_test_repository)


TIPOS_ETL = {
    "incident_sla": {
        "funcion": procesar_incident_sla,
        "tabla": "incident_sla",
    },

    "requirement_sla": {
        "funcion": procesar_requirement_sla,
        "tabla": "requirement_sla",
    },

    "incident_consolidated": {
        "funcion": procesar_incident_consolidated,
        "tabla": "incident_consolidated",
    },

    "requirement_consolidated": {
        "funcion": procesar_requirement_consolidated,
        "tabla": "requirement_consolidated",
    },
}


def procesar_archivo(
    tipo: str,
    archivo
):

    configuracion = TIPOS_ETL.get(tipo)

    if not configuracion:
        raise ValueError(
            f"Tipo de ETL no válido: {tipo}"
        )

    funcion_etl = configuracion["funcion"]
    nombre_tabla = configuracion["tabla"]

    # Volver al inicio del archivo
    archivo.seek(0)

    # Ejecutar ETL
    df = funcion_etl(
        archivo
    )

    # Guardar DataFrame en SQLite
    filas = exportar_dataframe(
        df,
        nombre_tabla
    )

    return {
        "tipo": tipo,
        "tabla": nombre_tabla,
        "filas_procesadas": filas,
        "mensaje": "Archivo procesado correctamente"
    }


def listar_datos(
    db: Session,
    tipo: str,
    limit: int = 100
):

    return etl_test_repository.get(
        db,
        tipo,
        limit
    )