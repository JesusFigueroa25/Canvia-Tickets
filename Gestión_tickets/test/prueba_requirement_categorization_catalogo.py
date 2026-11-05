
from __future__ import annotations
import sys
from sqlalchemy import func,select
from app.database.sqlserver import SQLServerSessionLocal
from app.models.requirement_categorization_audit_model import RequirementCategoryCatalog
from app.repositories import requirement_categorization_audit_repository as repo


GRUPO = "BASE DE DATOS Y EBS"


def contar_catalogo(db):
    return db.scalar(
        select(func.count())
        .select_from(RequirementCategoryCatalog)
    )


def verificar_rutas(db):
    rutas = [
        (
            "Actividades Genericas",
            "Actividades",
            "Reunion Tecnica",
        ),
        (
            "BASE DE DATOS Administracion",
            "Mantenimiento",
            "Checklist Diario",
        ),
    ]

    for nivel_1,nivel_2,nivel_3 in rutas:
        categoria = repo.obtener_categoria_por_ruta(
            db,nivel_1,nivel_2,nivel_3
        )

        if categoria is None:
            raise RuntimeError(
                f"No se encontró la ruta: {nivel_1} / {nivel_2} / {nivel_3}"
            )

        print("Categoría:",categoria.catalog_id)
        print("Ruta:",categoria.level_3)
        print("Origen:",categoria.catalog_source)
        print("Validación:",categoria.validation_status)


def ejecutar_prueba(aplicar=False):
    print("SINCRONIZACIÓN DEL CATÁLOGO")
    print("Grupo:",GRUPO)
    print("Modo:","APLICAR" if aplicar else "SIMULACIÓN")

    antes = None
    despues = None

    with SQLServerSessionLocal() as db:
        try:
            antes = contar_catalogo(db)

            resultado = repo.sincronizar_catalogo_desde_tickets(
                db,grupo_resolutor=GRUPO
            )

            despues = contar_catalogo(db)

            print("Rutas anteriores:",antes)
            print("Resultado:",resultado)
            print("Rutas posteriores:",despues)

            verificar_rutas(db)

            if aplicar:
                db.commit()
                print("COMMIT ejecutado")
            else:
                db.rollback()
                print("ROLLBACK ejecutado")

        except Exception:
            db.rollback()
            print("ROLLBACK por error")
            raise

    with SQLServerSessionLocal() as db:
        persistidas = contar_catalogo(db)

    print("Rutas persistidas:",persistidas)

    if aplicar:
        assert persistidas == despues
        print("Sincronización persistida: OK")
    else:
        assert persistidas == antes
        print("Simulación revertida: OK")

    print("Prueba finalizada")


if __name__ == "__main__":
    argumentos = sys.argv[1:]

    if any(argumento != "--aplicar" for argumento in argumentos):
        raise ValueError("Argumento no reconocido")

    ejecutar_prueba(aplicar="--aplicar" in argumentos)
