
from __future__ import annotations
from datetime import date
from sqlalchemy import inspect,select,text
from app.database.sqlserver import SQLServerSessionLocal
from app.models.requirement_categorization_audit_model import (
    RequirementCategoryCatalog,RequirementCategorizationAuditRun,
    RequirementCategorizationAuditResult,
)
from app.repositories import requirement_categorization_audit_repository as repo


def ejecutar_prueba():
    modelos = (
        RequirementCategoryCatalog,
        RequirementCategorizationAuditRun,
        RequirementCategorizationAuditResult,
    )

    with SQLServerSessionLocal() as db:
        conexion = db.execute(text("SELECT DB_NAME() AS base_datos, @@SERVERNAME AS servidor")).mappings().one()

        print("Servidor:",conexion["servidor"])
        print("Base de datos:",conexion["base_datos"])

        if conexion["base_datos"].casefold() != "serviciodba":
            raise RuntimeError("La conexión no apunta a ServicioDBA")

        inspector = inspect(db.get_bind())

        for modelo in modelos:
            tabla = modelo.__tablename__

            if not inspector.has_table(tabla,schema="dbo"):
                raise RuntimeError(f"No existe la tabla dbo.{tabla}")

            columnas_sql = {
                columna["name"].casefold()
                for columna in inspector.get_columns(tabla,schema="dbo")
            }

            columnas_modelo = {
                columna.name.casefold()
                for columna in modelo.__table__.columns
            }

            faltantes = columnas_modelo-columnas_sql

            if faltantes:
                raise RuntimeError(f"Faltan columnas en {tabla}: {sorted(faltantes)}")

            db.execute(select(modelo).limit(1)).first()

            print(f"Tabla {tabla}: OK ({len(columnas_modelo)} columnas)")

        grupo = repo.normalizar_grupo_resolutor(None)
        total = repo.contar_tickets_fuente(db,grupo)

        enero = repo.contar_tickets_fuente(
            db,grupo,desde=date(2026,1,1),hasta=date(2026,1,31)
        )

        mayo = repo.contar_tickets_fuente(
            db,grupo,desde=date(2026,5,1),hasta=date(2026,5,31)
        )

        print("Grupo:",grupo)
        print("Total histórico:",total)
        print("Tickets enero:",enero)
        print("Tickets mayo:",mayo)

        muestra = repo.obtener_tickets_lote(
            db,grupo,desde=date(2026,1,1),
            hasta=date(2026,1,31),limite=3
        )

        print("Tickets de muestra:",[ticket.Ticket_ID for ticket in muestra])

        for ticket_id in ("100-233615","100-234545"):
            ticket = repo.obtener_ticket_fuente(db,ticket_id,grupo)

            print("Ticket",ticket_id,":","ENCONTRADO" if ticket else "NO ENCONTRADO")

        db.rollback()

    print("Integración de lectura SQL Server: OK")


if __name__ == "__main__":
    ejecutar_prueba()
