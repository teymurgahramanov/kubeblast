from fastapi import Form
from typing import Literal, Optional, Annotated
from pydantic import BaseModel
from datetime import datetime

class Token(BaseModel):
    access_token: str
    token_type: str

class User(BaseModel):
    username: str
    full_name: Optional[str] = None
    role: Literal["user", "moderator", "admin"]
    email: Optional[str] = None
    enabled: bool = True
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

class UserCreate(User):
    password: str

    @classmethod
    def create_form(
        cls,
        username: Annotated[str, Form(...)],
        password: Annotated[str, Form(...)],
        role: Annotated[Literal["user", "moderator", "admin"], Form(...)],
        full_name: Annotated[Optional[str], Form()] = None,
        email: Annotated[Optional[str], Form()] = None,
        enabled: Annotated[bool, Form()] = True,
    ) -> "UserCreate":
        return cls(
            username=username,
            full_name=full_name,
            password=password,
            role=role,
            email=email,
            enabled=enabled,
            created_at=datetime.now(),
        )

class UserUpdate(User):
    username: Optional[str] = None
    password: Optional[str] = None
    role: Optional[Literal["user", "moderator", "admin"]] = None
    enabled: Optional[bool] = None

    @classmethod
    def update_self_form(
        cls,
        full_name: Annotated[Optional[str], Form()] = None,
        password: Annotated[Optional[str], Form()] = None,
        email: Annotated[Optional[str], Form()] = None,
    ) -> "UserUpdate":
        return cls(
            full_name=full_name,
            password=password,
            email=email,
            updated_at=datetime.now(),
        )
    
    @classmethod
    def update_admin_form(
        cls,
        password: Annotated[Optional[str], Form()] = None,
        role: Annotated[Optional[Literal["user", "moderator", "admin"]], Form()] = None,
        enabled: Annotated[Optional[bool], Form()] = None,
    ) -> "UserUpdate":
        return cls(
            password=password,
            role=role,
            enabled=enabled,
            updated_at=datetime.now(),
        )

class UserInDB(User):
    hashed_password: str

class Job(BaseModel):
    id: Optional[str] = None
    name: str
    owner: str
    description: Optional[str] = None
    status: Literal["pending", "approved", "declined", "running", "suspended", "completed", "failed"]
    created_at: Optional[datetime] = None
