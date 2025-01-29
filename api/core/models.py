from fastapi import Form
from typing import Literal, Optional
from pydantic import BaseModel

class User(BaseModel):
    username: str
    full_name: str | None = None
    role: Literal["user", "moderator", "admin"]
    enabled: bool = True

class UserCreate(User):
    password: str
    @classmethod
    def create_form(
        cls,
        username: str = Form(...),
        full_name: Optional[str] = Form(None),
        password: str = Form(...),
        role: Literal["user", "moderator", "admin"] = Form(...),
        enabled: bool = Form(True)
    ):
        return cls(username=username, full_name=full_name, password=password, role=role, enabled=enabled)

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
        enabled: Optional[bool] = Form(True)
    ):
        return cls(username=None, full_name=full_name, password=password, role=role, enabled=enabled)


class UserInDB(User):
    hashed_password: str

class Token(BaseModel):
    access_token: str
    token_type: str

class Job(BaseModel):
    name: str
    user: str
    description: str | None = None
    status: Literal["pending", "approved", "running", "completed", "failed"]
    plan: str

class JobCreate(Job):
    user: str | None = None
    plan: str | None = None

    @classmethod
    def create_form(
        cls,
        name: str = Form(...),
        description: Optional[str] = Form(None),
    ):
        return cls(name=name, description=description, status="pending")