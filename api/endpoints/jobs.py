from fastapi import APIRouter, Depends, UploadFile, File, HTTPException, Form, Response, Query
from fastapi.responses import FileResponse
from typing import Annotated, Literal, Optional
from api.core import models, config, db
from api.services import auth, jobs
import os, hashlib
from datetime import datetime

router = APIRouter()

@router.get("/jobs", response_model=models.Job)
async def get_jobs(current_user: Annotated[models.User, Depends(auth.check_roles(["admin", "moderator"]))],
                   status: Optional[str] = Query(None, description="Filter jobs by status")
    ):
    return jobs.get_jobs(status=status)

@router.get("/jobs/{job_id}", response_model=models.Job)
async def get_job(job_id: str, current_user: Annotated[models.User, Depends(auth.check_roles(["user", "admin", "moderator"]))]):
    return jobs.get_job(job_id)

@router.post("/jobs", response_model=models.Job)
async def create_job(
    current_user: Annotated[models.User, Depends(auth.check_roles(["user", "admin"]))],
    description: Annotated[Optional[str], Form(max_length=60)] = None,
    file: UploadFile = File(...)):

    if file.content_type != "text/plain":
        raise HTTPException(status_code=400, detail="Invalid file type. Expected text/plain")

    file_content = await file.read()

    return jobs.create_job(file_content, description, current_user.username)

@router.put("/jobs/{job_id}", response_model=models.Job)
async def approve_job(current_user: Annotated[models.User, Depends(auth.check_roles(["moderator", "admin"]))],job_id: str, job_status: Literal["approved", "declined"] = Form(...)):
    return jobs.approve_job(job_id, job_status)

@router.delete("/jobs/{job_id}")
async def delete_job(job_id: str, current_user: Annotated[models.User, Depends(auth.check_roles(["user", "admin"]))]):
    return jobs.delete_job(job_id, current_user)

@router.get("/jobs/files/{file_name}")
async def download_file(file_name: str, current_user: Annotated[models.User, Depends(auth.check_roles(["user", "admin"]))]):
    file_path = os.path.join(config.config.UPLOAD_DIR, file_name)
    if not os.path.exists(file_path):
        raise Response(status_code=404, detail="File not found")

    return FileResponse(file_path, media_type="text/plain", filename=file_name)
