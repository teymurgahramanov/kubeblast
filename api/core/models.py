from fastapi import Form
from typing import Literal, Optional
from pydantic import BaseModel, Field

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
    name: str = Field(..., max_length=24)
    user: str
    description: Optional[str] = Field(None, max_length=60)
    status: Literal["pending", "approved", "declined", "running", "completed", "failed"]
    file_name: str
    
class JobUpdate(Job):
    name: Optional[str] = None
    user: Optional[str] = None
    description: Optional[str] = None
    status: Literal["approved", "declined"]
    file_name: Optional[str] = None
    k8s_job_name: Optional[str] = None

    @classmethod
    def update_form(
        cls,
        status: Literal["approved", "declined"],
    ):
        return cls(status=status)