from datetime import datetime, timezone
from typing import Annotated, Literal

from fastapi import File, Form, HTTPException, UploadFile
from pydantic import BaseModel, Field, StringConstraints


class Token(BaseModel):
    access_token: str
    token_type: str
    refresh_token: str | None = None

class User(BaseModel):
    username: str
    full_name: str | None = None
    role: Literal["user", "moderator", "admin"]
    email: str | None = None
    enabled: bool = True
    auto_approve: bool = False
    method: Literal["local", "ldap", "oidc"] = "local"
    created_at: datetime | None = None
    updated_at: datetime | None = None
    last_login: datetime | None = None

class UserCreate(User):
    password: str

    @classmethod
    def create_form(
        cls,
        username: Annotated[str, Form(...)],
        password: Annotated[str, Form(...)],
        role: Annotated[Literal["user", "moderator", "admin"], Form(...)],
        full_name: Annotated[str | None, Form()] = None,
        email: Annotated[str | None, Form()] = None,
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
            created_at=datetime.now(timezone.utc),
        )

class UserUpdate(BaseModel):
    username: str | None = None
    full_name: str | None = None
    password: str | None = None
    role: Literal["user", "moderator", "admin"] | None = None
    email: str | None = None
    enabled: bool | None = None
    auto_approve: bool | None = None
    updated_at: datetime | None = None
    @classmethod
    def update_self_form(
        cls,
        full_name: Annotated[str | None, Form()] = None,
        password: Annotated[str | None, Form()] = None,
        email: Annotated[str | None, Form()] = None,
    ) -> "UserUpdate":
        return cls(
            full_name=full_name,
            password=password,
            email=email,
            updated_at=datetime.now(timezone.utc),
        )
    
    @classmethod
    def update_admin_form(
        cls,
        password: Annotated[str | None, Form()] = None,
        role: Annotated[Literal["user", "moderator", "admin"] | None, Form()] = None,
        enabled: Annotated[bool | None, Form()] = None,
        auto_approve: Annotated[bool | None, Form()] = None,
    ) -> "UserUpdate":
        return cls(
            password=password,
            role=role,
            enabled=enabled,
            auto_approve=auto_approve,
            updated_at=datetime.now(timezone.utc),
        )

class UserInDB(User):
    hashed_password: str

class Job(BaseModel):
    id: str | None = None
    name: str
    owner: str
    distributed: bool | None = False
    description: Annotated[str, StringConstraints(max_length=20)] | None = None
    status: Literal["pending", "ready", "declined", "starting", "stopping", "retrying", "running", "completed", "failed"]
    created_at: datetime

class JobCreate(BaseModel):
    description: Annotated[str, StringConstraints(max_length=20)] | None = None
    file_content: bytes
    created_at: datetime

    @classmethod
    async def create_form(
        cls,
        file: Annotated[UploadFile, File()],
        description: Annotated[str | None, Form(max_length=20)] = None,
    ) -> "JobCreate":   
        if file.content_type not in ["text/xml", "application/xml", "application/octet-stream"]:
            raise HTTPException(status_code=400, detail=f"Invalid file type. Received: {file.content_type}")
        else:
            file_content = await file.read()
            return cls(
                description=description,
                file_content=file_content,
                created_at=datetime.now(timezone.utc),
            )

class CapacityResources(BaseModel):
    cpu_m: int = 0
    memory_bytes: int = 0

class Capacity(BaseModel):
    nodesTotal: int = 0
    nodesMatching: int = 0
    capacity: CapacityResources = Field(default_factory=CapacityResources)
    remaining: CapacityResources = Field(default_factory=CapacityResources)
    # Diagnostics: what the scheduler cares about (requests) vs actual usage (metrics.k8s.io)
    usedRequests: CapacityResources = Field(default_factory=CapacityResources)
    usedUsage: CapacityResources = Field(default_factory=CapacityResources)
    updatedAt: datetime | None = None

class Pat(BaseModel):
    id: str | None = None
    user_id: str
    name: str
    created_at: datetime
    expires_at: datetime | None = None
    revoked: bool = False
    last_used_at: datetime | None = None

class PatInDB(Pat):
    prefix: str
    hashed_token: str

class PatCreate(BaseModel):
    name: str = Field(min_length=3, max_length=20)
    expires_in_days: int | None = Field(default=None, ge=1, le=3650)

class PatCreatedResponse(BaseModel):
    token: str

class JobLog(BaseModel):
    job_id: str = Field(..., description="Job identifier")
    ts: datetime = Field(
        default_factory=lambda: datetime.now(timezone.utc),
        description="Event timestamp (UTC)",
    )
    msg: str = Field(..., min_length=1, description="Event message")

    @staticmethod
    def coerce_msg(msg: str) -> str:
        s = msg if isinstance(msg, str) else str(msg)
        return s if s.strip() else " "

    @classmethod
    def from_mongo_doc(cls, doc: dict, *, fallback_job_id: str) -> "JobLog":
        raw_ts = doc.get("ts")
        ts = raw_ts if isinstance(raw_ts, datetime) else datetime.now(timezone.utc)
        return cls(
            job_id=str(doc.get("job_id", fallback_job_id)),
            ts=ts,
            msg=cls.coerce_msg(doc.get("msg", "")),
        )