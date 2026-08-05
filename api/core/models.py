from datetime import datetime, timezone
from typing import Annotated, Literal

from fastapi import File, Form, HTTPException, UploadFile
from pydantic import BaseModel, Field, StringConstraints

_UPLOAD_CHUNK_SIZE = 1024 * 1024
_MAX_JMX_SIZE = 900 * 1024
_MAX_PARAMETER_FILE_SIZE = 100 * 1024 * 1024
_MAX_PARAMETER_FILES_SIZE = 100 * 1024 * 1024
_MAX_PARAMETER_FILES = 20
_MAX_FILENAME_BYTES = 255


async def _read_upload_limited(upload: UploadFile, maximum_size: int, label: str) -> bytes:
    chunks: list[bytes] = []
    size = 0
    while chunk := await upload.read(_UPLOAD_CHUNK_SIZE):
        size += len(chunk)
        if size > maximum_size:
            raise HTTPException(status_code=413, detail=f"{label} exceeds the upload size limit.")
        chunks.append(chunk)
    return b"".join(chunks)


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

JobStatus = Literal[
    "pending",
    "ready",
    "declined",
    "starting",
    "stopping",
    "retrying",
    "running",
    "completed",
    "failed",
]


class Job(BaseModel):
    id: str | None = None
    name: str
    owner: str
    distributed: bool | None = False
    description: Annotated[str, StringConstraints(max_length=20)] | None = None
    parameter_files: list[str] = Field(default_factory=list)
    status: JobStatus
    created_at: datetime


class JobCommandResponse(BaseModel):
    message: str = Field(description="Human-readable command acknowledgement")
    job_id: str = Field(description="Job identifier")
    status: JobStatus = Field(description="Job status after the command was accepted")


class JobVerdict(BaseModel):
    job_id: str = Field(description="Job identifier")
    execution_status: JobStatus = Field(description="Job execution lifecycle status")
    verdict: Literal["passed", "failed", "not_evaluated"] = Field(
        description="Result verdict, kept separate from execution status",
    )
    samples_total: int = Field(ge=0, description="Number of JMeter samples evaluated")
    samples_failed: int = Field(ge=0, description="Number of samples whose success field is false")
    error_rate: float = Field(
        ge=0,
        le=1,
        description="Failed sample ratio from 0.0 to 1.0",
    )
    reason: str | None = Field(
        default=None,
        description="Why a verdict could not be evaluated",
    )


class MessageResponse(BaseModel):
    message: str


class JobCreate(BaseModel):
    description: Annotated[str, StringConstraints(max_length=20)] | None = None
    file_content: bytes
    parameter_files: dict[str, bytes] = Field(default_factory=dict)
    created_at: datetime

    @classmethod
    async def create_form(
        cls,
        file: Annotated[
            UploadFile,
            File(description="JMeter .jmx test plan (maximum 900 KiB)"),
        ],
        description: Annotated[
            str | None,
            Form(max_length=20, description="Optional job description"),
        ] = None,
        parameter_files: Annotated[
            list[UploadFile] | None,
            File(description="Optional CSV parameter files (maximum 20 files and 100 MiB total)"),
        ] = None,
    ) -> "JobCreate":
        if not file.filename or not file.filename.lower().endswith(".jmx"):
            raise HTTPException(status_code=400, detail="The plan must be a JMX file.")
        if file.content_type not in ["text/xml", "application/xml", "application/octet-stream", "text/plain"]:
            raise HTTPException(status_code=400, detail=f"Invalid file type. Received: {file.content_type}")

        uploads = parameter_files or []
        if len(uploads) > _MAX_PARAMETER_FILES:
            raise HTTPException(
                status_code=413,
                detail=f"A maximum of {_MAX_PARAMETER_FILES} CSV parameter files can be uploaded.",
            )

        uploaded_parameters: dict[str, bytes] = {}
        total_parameter_size = 0
        for parameter_file in uploads:
            filename = parameter_file.filename or ""
            basename = filename.replace("\\", "/").rsplit("/", 1)[-1]
            has_control_character = any(ord(character) < 32 or ord(character) == 127 for character in filename)
            if (
                filename != basename
                or not filename.lower().endswith(".csv")
                or not filename
                or has_control_character
                or len(filename.encode("utf-8")) > _MAX_FILENAME_BYTES
            ):
                raise HTTPException(status_code=400, detail=f"Invalid CSV parameter filename: {filename}")
            if filename in uploaded_parameters:
                raise HTTPException(status_code=400, detail=f"Duplicate parameter filename: {filename}")

            remaining_total = _MAX_PARAMETER_FILES_SIZE - total_parameter_size
            content = await _read_upload_limited(
                parameter_file,
                min(_MAX_PARAMETER_FILE_SIZE, remaining_total),
                filename if remaining_total >= _MAX_PARAMETER_FILE_SIZE else "Combined CSV parameter files",
            )
            total_parameter_size += len(content)
            uploaded_parameters[filename] = content

        return cls(
            description=description,
            file_content=await _read_upload_limited(file, _MAX_JMX_SIZE, "JMX plan"),
            parameter_files=uploaded_parameters,
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