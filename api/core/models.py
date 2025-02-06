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
    enabled: bool = True
    pending_jobs_limit: int = 3
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
        pending_jobs_limit: Annotated[Optional[int], Form()] = None,
        enabled: Annotated[bool, Form()] = True,
    ) -> "UserCreate":
        return cls(
            username=username,
            full_name=full_name,
            pending_jobs_limit=pending_jobs_limit,
            password=password,
            role=role,
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
    ) -> "UserUpdate":
        return cls(
            full_name=full_name,
            password=password,
            updated_at=datetime.now(),
        )
    
    @classmethod
    def update_admin_form(
        cls,
        full_name: Annotated[Optional[str], Form()] = None,
        password: Annotated[Optional[str], Form()] = None,
        role: Annotated[Optional[Literal["user", "moderator", "admin"]], Form()] = None,
        enabled: Annotated[Optional[bool], Form()] = None,
        pending_jobs_limit: Annotated[Optional[int], Form()] = None
    ) -> "UserUpdate":
        return cls(
            full_name=full_name,
            password=password,
            role=role,
            enabled=enabled,
            pending_jobs_limit=pending_jobs_limit,
            updated_at=datetime.now(),
        )

class UserInDB(User):
    hashed_password: str

class Job(BaseModel):
    name: str
    owner: str
    description: Optional[str] = None
    status: Literal["pending", "approved", "declined", "completed", "failed"]
    file_name: str
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

class JobFromDB(Job):
    id: str
