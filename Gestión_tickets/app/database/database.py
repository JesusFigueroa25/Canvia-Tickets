from pathlib import Path
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, declarative_base

# Raíz del proyecto
BASE_DIR = Path(__file__).resolve().parents[2]

# Carpeta assets
ASSETS_DIR = BASE_DIR / "assets"

# Crear assets si no existe
ASSETS_DIR.mkdir(
    parents=True,
    exist_ok=True
)

# Archivo SQLite
DATABASE_PATH = ASSETS_DIR / "tickets_test.db"
DATABASE_URL = (
    f"sqlite:///{DATABASE_PATH.as_posix()}"
)

engine = create_engine(DATABASE_URL,connect_args={"check_same_thread": False})
SessionLocal = sessionmaker(autocommit=False,autoflush=False,bind=engine)
Base = declarative_base()

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()