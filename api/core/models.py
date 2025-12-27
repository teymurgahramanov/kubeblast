from fastapi import Form, UploadFile, File, HTTPException, HTTPException
from typing import Literal, Optional, Annotated
from pydantic import BaseModel, StringConstraints, Field
from datetime import datetime

class Token(BaseModel):
    access_token: str
    token_type: str
    refresh_token: Optional[str] = None

class User(BaseModel):
    username: str
    full_name: Optional[str] = None
    role: Literal["user", "moderator", "admin"]
    email: Optional[str] = None
    enabled: bool = True
    auto_approve: bool = False
    method: Literal["local", "ldap", "oidc"] = "local"
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
        auto_approve: Annotated[bool, Form()] = False,
    ) -> "UserCreate":
        return cls(
            username=username,
            full_name=full_name,
            password=password,
            role=role,
            email=email,
            enabled=enabled,
            auto_approve=auto_approve,
            created_at=datetime.now(),
        )

class UserUpdate(User):
    username: Optional[str] = None
    password: Optional[str] = None
    role: Optional[Literal["user", "moderator", "admin"]] = None
    enabled: Optional[bool] = None
    auto_approve: Optional[bool] = None
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
        auto_approve: Annotated[Optional[bool], Form()] = None,
    ) -> "UserUpdate":
        return cls(
            password=password,
            role=role,
            enabled=enabled,
            auto_approve=auto_approve,
            updated_at=datetime.now(),
        )

class UserInDB(User):
    hashed_password: str

class Job(BaseModel):
    id: Optional[str] = None
    name: str
    owner: str
    distributed: Optional[bool] = False
    description: Optional[Annotated[str, StringConstraints(max_length=20)]] = None
    status: Literal["pending", "ready", "declined", "starting", "stopping", "retrying", "running", "completed", "failed"]
    created_at: datetime

class JobCreate(Job):
    name: Optional[str] = None  # Set by service layer
    owner: Optional[str] = None  # Set by service layer
    status: Optional[Literal["pending", "ready", "declined", "starting", "stopping", "retrying", "running", "completed", "failed"]] = None  # Set by service layer
    file_content: bytes  # File content from upload
    
    @classmethod
    async def create_form(
        cls,
        description: Annotated[Optional[str], Form(max_length=20)] = None,
        file: UploadFile = File(...),
    ) -> "JobCreate":   
        if file.content_type not in ["text/xml", "application/xml", "application/octet-stream"]:
            raise HTTPException(status_code=400, detail=f"Invalid file type. Received: {file.content_type}")
        else:
            file_content = await file.read()
            return cls(description=description, file_content=file_content, created_at=datetime.now())

class CapacityResources(BaseModel):
    cpu_m: int = 0
    memory_bytes: int = 0

class Capacity(BaseModel):
    nodesTotal: int = 0
    nodesMatching: int = 0
    capacity: CapacityResources = Field(default_factory=CapacityResources)
    remaining: CapacityResources = Field(default_factory=CapacityResources)
    updatedAt: Optional[datetime] = None

class Pat(BaseModel):
    id: Optional[str] = None
    user_id: str
    name: str
    created_at: datetime
    expires_at: Optional[datetime] = None
    revoked: bool = False
    last_used_at: Optional[datetime] = None

class PatInDB(Pat):
    prefix: str
    hashed_token: str

class PatCreate(BaseModel):
    name: str = Field(min_length=3, max_length=20)
    expires_in_days: Optional[int] = Field(default=None, ge=1, le=3650)

class PatCreatedResponse(BaseModel):
    token: str