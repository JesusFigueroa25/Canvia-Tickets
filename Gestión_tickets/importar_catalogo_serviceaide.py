
from __future__ import annotations

import argparse
import re
from collections import Counter
from pathlib import Path

from sqlalchemy import select, text, func

from app.database.sqlserver import SQLServerSessionLocal
from app.models.requirement_categorization_audit_model import (
    RequirementCategoryCatalog,
)


# =====================================================
# CONFIGURACION
# =====================================================

ARCHIVO_CATALOGO = Path("catalogo_serviceaide.txt")
TOTAL_OFICIAL_ESPERADO = 1151
BASE_DATOS_ESPERADA = "ServicioDBA"

PATRON_ENCABEZADO = re.compile(
    r"^Nivel\s*[12]\b",
    re.IGNORECASE
)


# =====================================================
# 1. LEER CATALOGO ORIGINAL DE SERVICEAIDE
# =====================================================

def obtener_rutas() -> list[tuple[str, str, str]]:

    if not ARCHIVO_CATALOGO.is_file():
        raise FileNotFoundError(
            f"No existe: {ARCHIVO_CATALOGO.resolve()}"
        )

    contenido = ARCHIVO_CATALOGO.read_text(
        encoding="utf-8-sig"
    )

    contenido = contenido.replace("\r\n", "\n")
    contenido = contenido.replace("\r", "\n")

    bloques = re.split(r"\n[ \t]*\n", contenido)

    rutas = []
    claves = set()

    for numero, bloque in enumerate(bloques, start=1):

        lineas = [
            linea.strip()
            for linea in bloque.splitlines()
            if linea.strip()
        ]

        if not lineas:
            continue

        # Ignorar los encabezados Nivel 1 / Nivel 2
        if PATRON_ENCABEZADO.match(lineas[0]):
            lineas = lineas[1:]

        if not lineas:
            continue

        if len(lineas) != 3:
            raise ValueError(
                f"Bloque {numero} invalido: {lineas}"
            )

        nivel_1, nivel_2, nivel_3 = lineas

        if (
            len(nivel_1) > 150
            or len(nivel_2) > 150
            or len(nivel_3) > 200
        ):
            raise ValueError(
                f"Ruta supera longitud permitida: {lineas}"
            )

        clave = tuple(
            " ".join(valor.split()).casefold()
            for valor in lineas
        )

        if clave in claves:
            raise ValueError(
                f"Ruta duplicada en archivo: {lineas}"
            )

        claves.add(clave)
        rutas.append((nivel_1, nivel_2, nivel_3))

    if len(rutas) != TOTAL_OFICIAL_ESPERADO:
        raise ValueError(
            f"Se esperaban {TOTAL_OFICIAL_ESPERADO} rutas "
            f"y se encontraron {len(rutas)}. "
            "Revisa que hayas copiado todo el texto."
        )

    return rutas


def clave_ruta(valores) -> tuple[str, str, str]:

    return tuple(
        " ".join(str(valor).split()).casefold()
        for valor in valores
    )


# =====================================================
# 2. IMPORTACION MASIVA
# =====================================================

def importar(confirmar: bool = False):

    rutas = obtener_rutas()

    db = SQLServerSessionLocal()

    try:

        base_actual = db.scalar(text("SELECT DB_NAME()"))

        if base_actual != BASE_DATOS_ESPERADA:
            raise RuntimeError(
                f"Base incorrecta: {base_actual}"
            )

        modelo = RequirementCategoryCatalog

        existentes = db.scalars(
            select(modelo)
        ).all()

        por_clave = {
            clave_ruta((
                registro.level_1,
                registro.level_2,
                registro.level_3
            )): registro
            for registro in existentes
        }

        insertadas = 0
        actualizadas = 0
        sin_cambios = 0

        for nivel_1, nivel_2, nivel_3 in rutas:

            clave = clave_ruta((
                nivel_1,
                nivel_2,
                nivel_3
            ))

            registro = por_clave.get(clave)

            # INSERTAR CATEGORIA NUEVA
            if registro is None:

                registro = modelo(
                    level_1=nivel_1,
                    level_2=nivel_2,
                    level_3=nivel_3,
                    catalog_source="SERVICE_AIDE",
                    validation_status="VALIDATED"
                )

                db.add(registro)

                por_clave[clave] = registro

                insertadas += 1

            # VALIDAR CATEGORIA EXISTENTE
            elif (
                registro.catalog_source != "SERVICE_AIDE"
                or registro.validation_status != "VALIDATED"
            ):

                registro.catalog_source = "SERVICE_AIDE"
                registro.validation_status = "VALIDATED"
                registro.updated_at = func.sysutcdatetime()

                actualizadas += 1

            else:
                sin_cambios += 1

        # Ejecutar dentro de la transaccion
        db.flush()

        # =================================================
        # 3. VALIDACION ANTES DE GUARDAR
        # =================================================

        registros_finales = db.scalars(
            select(modelo)
        ).all()

        mapa_final = {
            clave_ruta((
                registro.level_1,
                registro.level_2,
                registro.level_3
            )): registro
            for registro in registros_finales
        }

        for ruta in rutas:

            registro = mapa_final.get(clave_ruta(ruta))

            if registro is None:
                raise RuntimeError(
                    f"Categoria no registrada: {ruta}"
                )

            if (
                registro.catalog_source != "SERVICE_AIDE"
                or registro.validation_status != "VALIDATED"
            ):
                raise RuntimeError(
                    f"Categoria no validada: {ruta}"
                )

        oficiales = sum(
            1
            for registro in registros_finales
            if registro.catalog_source == "SERVICE_AIDE"
            and registro.validation_status == "VALIDATED"
        )

        historicas = sum(
            1
            for registro in registros_finales
            if registro.catalog_source == "SQL_SERVER"
            and registro.validation_status == "OBSERVED"
        )

        # =================================================
        # 4. MOSTRAR RESULTADOS
        # =================================================

        print("\n" + "=" * 55)
        print("IMPORTACION MASIVA SERVICEAIDE")
        print("=" * 55)

        print(f"Rutas recibidas:       {len(rutas)}")
        print(f"Nuevas insertadas:     {insertadas}")
        print(f"Existentes actualizadas: {actualizadas}")
        print(f"Sin cambios:           {sin_cambios}")

        print("-" * 55)

        print(f"Oficiales validadas:   {oficiales}")
        print(f"Historicas observadas: {historicas}")
        print(f"Total en tabla:        {len(registros_finales)}")

        print("-" * 55)

        print("CLASES DEL CATALOGO:")

        for clase, cantidad in sorted(
            Counter(ruta[0] for ruta in rutas).items()
        ):
            print(f"  {clase}: {cantidad}")

        print("-" * 55)

        # =================================================
        # 5. CONFIRMAR O REVERTIR
        # =================================================

        if confirmar:

            db.commit()

            print("\nIMPORTACION CONFIRMADA - COMMIT")

        else:

            db.rollback()

            print("\nSIMULACION COMPLETADA - ROLLBACK")
            print("No se guardaron cambios.")

    except Exception:

        db.rollback()
        raise

    finally:

        db.close()


# =====================================================
# EJECUCION
# =====================================================

if __name__ == "__main__":

    parser = argparse.ArgumentParser()

    parser.add_argument(
        "--confirmar",
        action="store_true",
        help="Guardar la importacion en SQL Server"
    )

    argumentos = parser.parse_args()

    importar(confirmar=argumentos.confirmar)
