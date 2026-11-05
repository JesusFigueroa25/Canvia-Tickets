import urllib.parse
from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker
from app.core.config import settings

def _crear_url():
    if not settings.DB_SERVER:
        raise RuntimeError("Falta configurar DB_SERVER")
    if not settings.DB_DATABASE:
        raise RuntimeError("Falta configurar DB_DATABASE")
    if not settings.DB_USERNAME:
        raise RuntimeError("Falta configurar DB_USERNAME")
    if not settings.DB_PASSWORD:
        raise RuntimeError("Falta configurar DB_PASSWORD")
    connection_string = (
        "DRIVER={ODBC Driver 18 for SQL Server};"
        f"SERVER={settings.DB_SERVER};"
        f"DATABASE={settings.DB_DATABASE};"
        f"UID={settings.DB_USERNAME};"
        f"PWD={settings.DB_PASSWORD};"
        "Encrypt=no;"
        "TrustServerCertificate=yes;"
        "Connection Timeout=30;"
    )
    params = urllib.parse.quote_plus(connection_string)
    return f"mssql+pyodbc:///?odbc_connect={params}"

SQLSERVER_URL = _crear_url()

sqlserver_engine = create_engine(
    SQLSERVER_URL,
    echo=False,
    fast_executemany=True,
    pool_pre_ping=True,
    pool_recycle=240,
)
SQLServerSessionLocal = sessionmaker(autocommit=False,autoflush=False,bind=sqlserver_engine,)

def probar_conexion():
    with sqlserver_engine.connect() as connection:
        resultado = connection.execute(text("SELECT DB_NAME() AS database_name"))
        return resultado.scalar()
    
def verificar_conexion_sqlserver(db):
    db.execute(text("SELECT 1"))
    
def get_sqlserver_db():
    db = SQLServerSessionLocal()
    try:
        yield db
    finally:
        db.close()