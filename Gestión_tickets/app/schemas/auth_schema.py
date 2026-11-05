from pydantic import BaseModel, EmailStr


class UserLogin(BaseModel):
    correo: EmailStr
    password: str


class TokenLogin(BaseModel):
    access_token: str
    token_type: str
    correo: str