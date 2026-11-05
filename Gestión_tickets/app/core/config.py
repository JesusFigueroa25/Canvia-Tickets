import os
from dotenv import load_dotenv

load_dotenv()

class Settings:
    DB_SERVER: str | None = os.getenv("DB_SERVER")
    DB_DATABASE: str | None = os.getenv("DB_DATABASE")
    DB_USERNAME: str | None = os.getenv("DB_USERNAME")
    DB_PASSWORD: str | None = os.getenv("DB_PASSWORD")
    JWT_SECRET_KEY: str | None = os.getenv("JWT_SECRET_KEY")

settings = Settings()