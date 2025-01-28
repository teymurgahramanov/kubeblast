from fastapi import Depends, Form
from typing import Literal
from pydantic import BaseModel

class User(BaseModel):
    username: str
    full_name: str | None = None
    role: Literal["user", "moderator", "admin"]
    enabled: bool = True

class UserCreate(User):
    password: str
    @classmethod
    def as_form(
        cls,
        username: str = Form(...),
        full_name: str = Form(None),
        password: str = Form(...),
        role: Literal["user", "moderator", "admin"] = Form(...),
        enabled: bool = Form(True)
    ):
        return cls(username=username, full_name=full_name, password=password, role=role, enabled=enabled)

class UserInDB(User):
    hashed_password: str

class Token(BaseModel):
    access_token: str
    token_type: str