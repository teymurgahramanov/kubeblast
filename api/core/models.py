from fastapi import Form
from typing import Literal, Optional
from pydantic import BaseModel, Field
from datetime import datetime

class User(BaseModel):
    username: str
    full_name: str | None = None
    role: Literal["user", "moderator", "admin"]
    enabled: bool = True
    created_at: datetime | None = None
    updated_at: datetime | None = None

class UserCreate(User):
    password: str
    @classmethod
    def create_form(
        cls,
        username: str = Form(...),
        full_name: Optional[str] = Form(None),
        password: str = Form(...),
        role: Literal["user", "moderator", "admin"] = Form(...),
        enabled: bool = Form(True),
    ):
        return cls(username=username, full_name=full_name, password=password, role=role, enabled=enabled, created_at=datetime.now)

class UserUpdate(User):
    username: Optional[str] = None
    password: Optional[str] = None
    role: Optional[Literal["user", "moderator", "admin"]] = None
    enabled: Optional[bool] = True

    @classmethod
    def update_form(
        cls,
        full_name: Optional[str] = Form(None),
        password: Optional[str] = Form(None),
        role: Optional[Literal["user", "moderator", "admin"]] = Form(None),
        enabled: Optional[bool] = Form(True),
    ):
        return cls(username=None, full_name=full_name, password=password, role=role, enabled=enabled, updated_at=datetime.now)

class UserInDB(User):
    hashed_password: str

class Token(BaseModel):
    access_token: str
    token_type: str